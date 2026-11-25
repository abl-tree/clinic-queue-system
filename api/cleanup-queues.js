import { db } from './_firebase.js'

const BATCH_SIZE = 500

export default async function handler(req, res) {
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const patientsSnap = await db.collectionGroup('patients').get()
    const refs = patientsSnap.docs.map((doc) => doc.ref)

    let deleted = 0
    for (let i = 0; i < refs.length; i += BATCH_SIZE) {
      const batch = db.batch()
      const chunk = refs.slice(i, i + BATCH_SIZE)
      chunk.forEach((ref) => batch.delete(ref))
      await batch.commit()
      deleted += chunk.length
    }

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
