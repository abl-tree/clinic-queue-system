importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-app-compat.js')
importScripts('https://www.gstatic.com/firebasejs/13.4.0/firebase-messaging-compat.js')

firebase.initializeApp({
  apiKey: 'AIzaSyCbgaijyonu5BIeOsR-pY4RaAGLOBhygQ0',
  authDomain: 'spmc-cancer-queueing.firebaseapp.com',
  projectId: 'spmc-cancer-queueing',
  storageBucket: 'spmc-cancer-queueing.firebasestorage.app',
  messagingSenderId: '464271826711',
  appId: '1:464271826711:web:57f270ae27d2350161e152'
})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const { title, body, icon, image } = payload.notification || {}
  const notificationTitle = title || 'Clinic Queue'
  const notificationOptions = {
    body: body || '',
    icon: icon || '/favicon.svg',
    image,
    data: payload.data || {},
    tag: 'clinic-queue-notification',
    requireInteraction: false
  }
  self.registration.showNotification(notificationTitle, notificationOptions)
})
