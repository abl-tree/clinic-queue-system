const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { onRequest } = require('firebase-functions/v2/https')
const { initializeApp } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp()
const db = getFirestore()
const messaging = getMessaging()

const FACEBOOK_PAGE_ACCESS_TOKEN = process.env.FACEBOOK_PAGE_ACCESS_TOKEN
const MESSENGER_VERIFY_TOKEN = process.env.MESSENGER_VERIFY_TOKEN || 'clinic_queue_verify'
const APP_URL = process.env.APP_URL || 'https://your-vercel-app.vercel.app'

function patientTitle(doctorName) {
  return doctorName ? `Clinic Queue - Dr. ${doctorName}` : 'Clinic Queue'
}

async function sendMessengerMessage(psid, text) {
  if (!FACEBOOK_PAGE_ACCESS_TOKEN || !psid) {
    return
  }
  try {
    const res = await fetch('https://graph.facebook.com/v19.0/me/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { text },
        messaging_type: 'RESPONSE',
        access_token: FACEBOOK_PAGE_ACCESS_TOKEN
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

async function notifyPatient(hrn, title, body, data = {}) {
  if (!hrn) return

  // Send FCM push to all registered devices
  const devicesSnap = await db.collection('fcmTokens').doc(hrn).collection('devices').get()
  const tokens = devicesSnap.docs.map(d => d.data().token).filter(Boolean)
  if (tokens.length > 0) {
    await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: { ...data, hrn },
      android: { priority: 'high' },
      apns: { payload: { aps: { sound: 'default' } } }
    })
    console.log(`Push sent to ${tokens.length} device(s) for ${hrn}: ${title}`)
  } else {
    console.log(`No FCM tokens for patient ${hrn}`)
  }

  // Send Facebook Messenger message if a PSID is linked to this patient
  const profileSnap = await db.collection('patients').doc(hrn).get()
  if (profileSnap.exists) {
    const psid = profileSnap.data().psid
    if (psid) {
      await sendMessengerMessage(psid, `${title}: ${body}`)
    }
  }
}

exports.notifyPatientQueued = onDocumentCreated(
  'queues/{doctorId}/patients/{patientId}',
  async (event) => {
    const patient = event.data.data()
    const { hrn, doctorId, queueNumber } = patient
    const doctorSnap = await db.collection('doctors').doc(doctorId).get()
    const doctorName = doctorSnap.exists ? doctorSnap.data().name : 'your doctor'
    await notifyPatient(
      hrn,
      patientTitle(doctorName),
      `You've been added to the queue (${doctorName}). Queue #${queueNumber || '—'}`,
      { doctorId, queueNumber: String(queueNumber || ''), type: 'queued' }
    )
  }
)

exports.notifyPatientServing = onDocumentCreated(
  'serving/{doctorId}',
  async (event) => {
    const patient = event.data.data()
    const { hrn, doctorId } = patient
    const doctorSnap = await db.collection('doctors').doc(doctorId).get()
    const doctorName = doctorSnap.exists ? doctorSnap.data().name : 'your doctor'
    await notifyPatient(
      hrn,
      patientTitle(doctorName),
      `It's your turn! Dr. ${doctorName} is now seeing you.`,
      { doctorId, type: 'serving' }
    )
  }
)

exports.notifyTopTenPrepare = onDocumentCreated(
  'queues/{doctorId}/patients/{patientId}',
  async (event) => {
    const patient = event.data.data()
    const { hrn, doctorId, position, queueNumber, status } = patient
    if (status !== 'waiting') return
    if (!position || position > 10) return
    const doctorSnap = await db.collection('doctors').doc(doctorId).get()
    const doctorName = doctorSnap.exists ? doctorSnap.data().name : 'your doctor'
    await notifyPatient(
      hrn,
      patientTitle(doctorName),
      `Get ready! You're #${position} in line to see Dr. ${doctorName}.`,
      { doctorId, position: String(position), queueNumber: String(queueNumber || ''), type: 'prepare' }
    )
  }
)

exports.notifyTopTenPrepareOnShift = onDocumentUpdated(
  'queues/{doctorId}/patients/{patientId}',
  async (event) => {
    const before = event.data.before.data()
    const after = event.data.after.data()
    const { hrn, doctorId, position, queueNumber, status } = after
    if (status !== 'waiting') return
    const wasTop10 = before.position && before.position <= 10
    const isNowTop10 = position && position <= 10
    if (!isNowTop10 || wasTop10) return
    const doctorSnap = await db.collection('doctors').doc(doctorId).get()
    const doctorName = doctorSnap.exists ? doctorSnap.data().name : 'your doctor'
    await notifyPatient(
      hrn,
      patientTitle(doctorName),
      `Get ready! You're now #${position} in line to see Dr. ${doctorName}.`,
      { doctorId, position: String(position), queueNumber: String(queueNumber || ''), type: 'prepare' }
    )
  }
)

exports.messengerWebhook = onRequest(async (req, res) => {
  if (req.method === 'GET') {
    const mode = req.query['hub.mode']
    const token = req.query['hub.verify_token']
    const challenge = req.query['hub.challenge']
    if (mode === 'subscribe' && token === MESSENGER_VERIFY_TOKEN) {
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
})

async function handleMessengerMessage(psid, text) {
  const lower = text.toLowerCase().trim()

  // Static menu triggers
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
    // Patient clicked a static button: look up their HRN by PSID
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
    // Patient sent an HRN directly
    hrn = text.toUpperCase().replace(/\s/g, '')
    // Link this PSID to the patient profile
    const profileSnap = await db.collection('patients').doc(hrn).get()
    if (profileSnap.exists) {
      await profileSnap.ref.set({ psid }, { merge: true })
    }
  }

  // Search all queues for this HRN
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
