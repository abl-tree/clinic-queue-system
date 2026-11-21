import {
  getToken,
  onMessage
} from 'firebase/messaging'
import { messaging } from './firebase'
import {
  doc, setDoc, serverTimestamp
} from 'firebase/firestore'
import { db } from './firebase'

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY

export async function registerPush(identifier, role) {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service workers not supported')
    return null
  }

  if (!VAPID_KEY) {
    console.warn('VITE_FIREBASE_VAPID_KEY not set. Push notifications disabled.')
    return null
  }

  try {
    await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
      scope: '/'
    })

    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      console.warn('Notification permission not granted')
      return null
    }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: await navigator.serviceWorker.ready
    })

    if (token) {
      await setDoc(doc(db, 'fcmTokens', identifier), {
        token,
        role,
        identifier,
        updatedAt: serverTimestamp()
      }, { merge: true })
    }

    return token
  } catch (err) {
    console.error('Error registering push notifications:', err)
    return null
  }
}

export function onPushMessage(callback) {
  return onMessage(messaging, (payload) => {
    const { title, body, icon, image } = payload.notification || {}
    callback({
      title: title || 'Clinic Queue',
      body: body || '',
      icon,
      image,
      data: payload.data || {}
    })
  })
}
