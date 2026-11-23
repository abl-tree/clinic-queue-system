import { db } from './_firebase.js'

const todayKey = () => new Date().toISOString().split('T')[0]

const isPastCleanupHour = () => {
  const now = new Date()
  return now.getHours() >= 3
}

export default async function handler(req, res) {
  // Only allow cron-triggered requests (Vercel sends this header)
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today = todayKey()

  if (!isPastCleanupHour()) {
    return res.status(200).json({
      ok: true,
      skipped: true,
      reason: `Not yet 3 AM (current hour: ${new Date().getHours()})`,
      today
    })
  }

  try {
    // Reset queue counter for today to 0
    const counterRef = db.collection('queueCounters').doc(today)
    await counterRef.set(
      { count: 0, date: today, updatedAt: new Date() },
      { merge: true }
    )

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

    return res.status(200).json({
      ok: true,
      today,
      cleaned: true,
      message: `Queue counter reset and old waiting patients marked completed for ${today}`
    })
  } catch (err) {
    console.error('Cleanup error:', err)
    return res.status(500).json({ error: err.message })
  }
}
