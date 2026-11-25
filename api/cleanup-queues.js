import { db } from './_firebase.js'

export default async function handler(req, res) {
  // Only allow cron-triggered requests (Vercel sends this header)
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    // Delete ALL waiting/serving patients regardless of batch key
    const doctorsSnap = await db.collection('doctors').get()
    const batch = db.batch()

    for (const docSnap of doctorsSnap.docs) {
      const doctorId = docSnap.id
      const oldSnap = await db
        .collection('queues', doctorId, 'patients')
        .where('status', 'in', ['waiting', 'serving'])
        .get()

      oldSnap.forEach((patientDoc) => {
        batch.delete(patientDoc.ref)
      })
    }

    await batch.commit()

    // Delete serving records for all doctors
    for (const docSnap of doctorsSnap.docs) {
      try {
        await db.collection('serving').doc(docSnap.id).delete()
      } catch {}
    }

    return res.status(200).json({
      ok: true,
      cleaned: true,
      message: 'All queues deleted'
    })
  } catch (err) {
    console.error('Cleanup error:', err)
    return res.status(500).json({ error: err.message })
  }
}