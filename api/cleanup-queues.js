import { db } from './_firebase.js'

export default async function handler(req, res) {
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const doctorsSnap = await db.collection('doctors').get()
    const batch = db.batch()
    let deleted = 0

    for (const docSnap of doctorsSnap.docs) {
      const doctorId = docSnap.id
      const patientsSnap = await db
        .collection('queues', doctorId, 'patients')
        .get()

      patientsSnap.forEach((patientDoc) => {
        batch.delete(patientDoc.ref)
        deleted++
      })
    }

    await batch.commit()

    return res.status(200).json({
      ok: true,
      cleaned: true,
      deleted,
      message: `Deleted ${deleted} queue entries`
    })
  } catch (err) {
    console.error('Cleanup error:', err)
    return res.status(500).json({ error: err.message })
  }
}
