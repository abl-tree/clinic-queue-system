import { initializeApp, cert, getApps } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'

const SERVICE_ACCOUNT_PATH = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './firebase-service-account.json'

const todayKey = () => new Date().toISOString().split('T')[0]

const isPastCleanupHour = () => {
  const now = new Date()
  return now.getHours() >= 3
}

const initAdmin = () => {
  if (getApps().length > 0) return getFirestore()
  const serviceAccount = require(SERVICE_ACCOUNT_PATH)
  initializeApp({ credential: cert(serviceAccount) })
  return getFirestore()
}

const cleanupOldQueues = async () => {
  const today = todayKey()

  if (!isPastCleanupHour()) {
    console.log(`Not yet 3 AM (current hour: ${new Date().getHours()}). Skipping cleanup.`)
    return
  }

  const db = initAdmin()

  try {
    // Reset queue counter for today to 0
    const counterRef = db.collection('queueCounters').doc(today)
    await counterRef.set(
      { count: 0, date: today, updatedAt: new Date() },
      { merge: true }
    )
    console.log(`Reset queue counter for ${today}`)

    // Get all doctors
    const doctorsSnap = await db.collection('doctors').get()
    const batch = db.batch()

    for (const docSnap of doctorsSnap.docs) {
      const doctorId = docSnap.id
      const oldSnap = await db
        .collection('queues', doctorId, 'patients')
        .where('status', '==', 'waiting')
        .where('date', '!=', today)
        .get()

      oldSnap.forEach((patientDoc) => {
        batch.update(patientDoc.ref, {
          status: 'completed',
          updatedAt: new Date(),
          cleanedAt: new Date()
        })
      })
    }

    await batch.commit()
    console.log(`Cleanup complete for ${today}: old waiting patients marked completed, counter reset`)
  } catch (err) {
    console.error('Auto-cleanup error:', err)
    process.exit(1)
  }
}

cleanupOldQueues().then(() => process.exit(0))
