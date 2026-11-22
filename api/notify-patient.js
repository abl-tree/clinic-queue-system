import { db, messaging } from './_firebase.js'

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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { hrn, title, body, data = {} } = req.body
  if (!hrn) {
    return res.status(400).json({ error: 'Missing hrn' })
  }

  try {
    // Send FCM push to all registered devices
    const devicesSnap = await db.collection('fcmTokens').doc(hrn).collection('devices').get()
    const tokens = devicesSnap.docs.map(d => d.data().token).filter(Boolean)

    let pushSent = 0
    if (tokens.length > 0) {
      await messaging.sendEachForMulticast({
        tokens,
        notification: { title, body },
        data: { ...data, hrn },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } }
      })
      pushSent = tokens.length
      console.log(`Push sent to ${tokens.length} device(s) for ${hrn}: ${title}`)
    }

    // Send Messenger fallback if PSID linked
    let messengerSent = false
    const profileSnap = await db.collection('patients').doc(hrn).get()
    if (profileSnap.exists) {
      const psid = profileSnap.data().psid
      if (psid) {
        await sendMessengerMessage(psid, `${title}: ${body}`)
        messengerSent = true
      }
    }

    return res.status(200).json({
      ok: true,
      pushSent,
      messengerSent,
      hrn
    })
  } catch (err) {
    console.error('notify-patient error:', err)
    return res.status(500).json({ error: err.message })
  }
}
