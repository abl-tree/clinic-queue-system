import { db } from './_firebase.js'

const BATCH_SIZE = 500

const todayKey = () => new Date().toISOString().split('T')[0]

export default async function handler(req, res) {
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const patientsSnap = await db.collectionGroup('patients').get()
    const refs = patientsSnap.docs
      .map((doc) => doc.ref)
      .filter((ref) => ref.path.startsWith('queues/'))

    let deleted = 0
    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = db.batch()
      const chunk = refs.slice(i, i + BATCH_SIZE)
      chunk.forEach((ref) => batch.delete(ref))
      await batch.commit()
      deleted += chunk.length
    }

    // Reset queue counter for today so new queues start from 1
    const today = todayKey()
    const counterRef = db.collection('queueCounters').doc(today)
    await counterRef.set(
      { count: 0, date: today, updatedAt: new Date() },
      { merge: true }
    )

    return res.status(200).json({
      ok: true,
      cleaned: true,
      deleted,
      today,
      message: `Deleted ${deleted} queued patients across all doctors; counter reset to 0 (next queue starts from 1)`
    })
  } catch (err) {
    console.error('Cleanup error:', err)
    return res.status(500).json({ error: err.message })
  }
}
