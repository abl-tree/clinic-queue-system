const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore')
const { initializeApp } = require('firebase-admin/app')
const { getMessaging } = require('firebase-admin/messaging')
const { getFirestore } = require('firebase-admin/firestore')

initializeApp()
const db = getFirestore()
const messaging = getMessaging()

function patientTitle(doctorName) {
  return doctorName ? `Clinic Queue - Dr. ${doctorName}` : 'Clinic Queue'
}

async function notifyPatient(hrn, title, body, data = {}) {
  if (!hrn) return
  const tokenSnap = await db.collection('fcmTokens').doc(hrn).get()
  if (!tokenSnap.exists) {
    console.log(`No FCM token for patient ${hrn}`)
    return
  }
  const token = tokenSnap.data().token
  await messaging.send({
    token,
    notification: { title, body },
    data: { ...data, hrn },
    android: { priority: 'high' },
    apns: { payload: { aps: { sound: 'default' } } }
  })
  console.log(`Push sent to ${hrn}: ${title}`)
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
