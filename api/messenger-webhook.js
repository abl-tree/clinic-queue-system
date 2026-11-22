import { db } from './_firebase.js'

const VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || 'clinic_queue_verify'
const APP_URL = process.env.APP_URL || process.env.VITE_APP_URL || 'https://your-vercel-app.vercel.app'

async function sendMessengerMessage(psid, text) {
  const pageAccessToken = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
  if (!pageAccessToken || !psid) return

  try {
    const res = await fetch('https://graph.facebook.com/v19.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text },
        messaging_type: 'RESPONSE',
        access_token: pageAccessToken
      })
    })
    if (!res.ok) {
      console.error(`Facebook API error: ${res.status}`)
    } else {
      console.log(`Messenger message sent to ${psid}: ${text}`)
    }
  } catch (err) {
    console.error('Error sending Messenger message:', err)
  }
}

async function handleMessengerMessage(psid, text) {
  const lower = text.toLowerCase().trim()

  if (lower === 'help' || lower === 'menu' || lower === 'start') {
    await sendMessengerMessage(
      psid,
      'Clinic Queue Bot\n\nOptions:\n• "followup appointment" — check your queue status and register push notifications\n• Send your HRN (e.g. HRN12345) — look up by Patient ID'
    )
    return
  }

  const followupTriggers = [
    'followup appointment', 'follow-up appointment', 'followup', 'follow-up',
    'check queue', 'my queue', 'my appointment', 'queue status', 'status'
  ]

  let hrn = null

  if (followupTriggers.includes(lower)) {
    const patientsSnap = await db.collection('patients').where('psid', '==', psid).get()
    if (patientsSnap.empty) {
      await sendMessengerMessage(
        psid,
        'No patient profile linked to this Messenger account.\nPlease send your HRN (Patient ID) first to link your account.\nExample: HRN12345'
      )
      return
    }
    const profile = patientsSnap.docs[0].data()
    hrn = profile.hrn
    if (!hrn) {
      await sendMessengerMessage(
        psid,
        'Your patient profile has no HRN on file. Please contact the front desk.'
      )
      return
    }
  } else {
    hrn = text.toUpperCase().replace(/\s/g, '')
    const profileSnap = await db.collection('patients').doc(hrn).get()
    if (profileSnap.exists) {
      await profileSnap.ref.set({ psid }, { merge: true })
    }
  }

  let found = null
  const queuesSnap = await db.collectionGroup('patients').where('hrn', '==', hrn).get()
  if (!queuesSnap.empty) {
    const doc = queuesSnap.docs[0]
    const data = doc.data()
    const doctorId = doc.ref.parent.parent.id
    const doctorSnap = await db.collection('doctors').doc(doctorId).get()
    found = {
      hrn,
      ...data,
      doctorName: doctorSnap.exists ? doctorSnap.data().name : 'Unknown Doctor',
      doctorId
    }
  }

  if (!found) {
    const servingSnap = await db.collection('serving').where('hrn', '==', hrn).get()
    if (!servingSnap.empty) {
      const data = servingSnap.docs[0].data()
      const doctorId = servingSnap.docs[0].id
      const doctorSnap = await db.collection('doctors').doc(doctorId).get()
      found = {
        hrn,
        ...data,
        status: 'serving',
        doctorName: doctorSnap.exists ? doctorSnap.data().name : 'Unknown Doctor',
        doctorId,
        queueNumber: '—'
      }
    }
  }

  const pushLink = `${APP_URL}/patient?hrn=${hrn}&registerPush=1`

  if (found) {
    const positionLine = found.position !== undefined ? `Position: #${found.position + 1}` : ''
    const queueLine = found.queueNumber !== undefined ? `Queue #: ${found.queueNumber}` : ''
    await sendMessengerMessage(
      psid,
      `HRN: ${found.hrn}\nStatus: ${found.status}\n${queueLine}\n${positionLine}\nDoctor: ${found.doctorName}\n\nEnable push notifications:\n${pushLink}\n\nTap "followup appointment" again to refresh.`
    )
  } else {
    await sendMessengerMessage(
      psid,
      `HRN ${hrn} not found in any active queue.\n\nEnable push notifications when you check in:\n${pushLink}\n\nPlease check with the front desk or try again later.`
    )
  }
}

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      console.log('Messenger webhook verified')
      return res.status(200).send(challenge)
    }
    console.log('Messenger webhook verification failed')
    return res.status(403).send('Forbidden')
  }

  if (req.method === 'POST') {
    const body = req.body
    if (body.object === 'page') {
      for (const entry of body.entry) {
        for (const event of entry.messaging || []) {
          const senderPsid = event.sender.id
          if (event.message && event.message.text) {
            const text = event.message.text.trim()
            await handleMessengerMessage(senderPsid, text)
          }
        }
      }
      return res.status(200).send('EVENT_RECEIVED')
    }
  }

  return res.status(404).send('Not found')
}
