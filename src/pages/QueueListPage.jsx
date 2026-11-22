import { useState, useEffect, useRef } from 'react'
import { useQueue } from '../context/QueueContext'
import { Link, useLocation } from 'react-router-dom'
import { db } from '../lib/firebase'
import { collection, onSnapshot } from 'firebase/firestore'

const Breadcrumb = ({ items }) => (
  <nav className="breadcrumb">
    {items.map((item, i) => (
      <>
        {item.link ? <Link to={item.link}>{item.label}</Link> : <span>{item.label}</span>}
        {i < items.length - 1 && <span className="sep">›</span>}
      </>
    ))}
  </nav>
)

export default function QueueListPage() {
  const { queues, serving, doctors } = useQueue()
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'announcements'), (snap) => {
      snap.docChanges().forEach((c) => {
        if (c.type === 'added') {
          const text = c.doc.data().text
          if (text && 'speechSynthesis' in window) {
            window.speechSynthesis.speak(new SpeechSynthesisUtterance(text))
          }
        }
      })
    })
    return () => unsub()
  }, [])
  const prevServingRef = useRef({})
  const [filterDoctor, setFilterDoctor] = useState('all')
  const allPatients = []
  const servingPatients = []
  for (const [doctorId, queue] of Object.entries(queues)) {
    queue.forEach(p => {
      const doc = doctors.find(d => d.id === doctorId)
      allPatients.push({
        ...p,
        doctorId,
        doctorName: doc ? doc.name : doctorId,
        status: p.status || 'waiting'
      })
    })
  }
  for (const [doctorId, s] of Object.entries(serving)) {
    const doc = doctors.find(d => d.id === doctorId)
    const existing = allPatients.find(p => p.id === s.id && p.doctorId === doctorId)
    if (!existing) {
      allPatients.push({
        ...s,
        id: s.id,
        doctorId,
        doctorName: doc ? doc.name : doctorId,
        status: 'serving'
      })
    }
    servingPatients.push({
      ...s,
      id: s.id,
      doctorId,
      doctorName: doc ? doc.name : doctorId,
      status: 'serving'
    })
  }

  const servingIds = new Set(servingPatients.map(p => p.id))

  const waitingPatients = allPatients.filter(p => p.status === 'waiting' && !servingIds.has(p.id))

  const byDoctor = {}
  waitingPatients.forEach(p => {
    if (!byDoctor[p.doctorId]) byDoctor[p.doctorId] = []
    byDoctor[p.doctorId].push(p)
  })
  Object.values(byDoctor).forEach(list => list.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)))

  const filtered = filterDoctor === 'all'
    ? (() => {
        const result = []
        const maxLen = Math.max(...Object.values(byDoctor).map(list => list.length))
        for (let i = 0; i < maxLen; i++) {
          Object.values(byDoctor).forEach(list => {
            if (list[i]) result.push(list[i])
          })
        }
        return result
      })()
    : waitingPatients.filter(p => p.doctorId === filterDoctor).sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0))

  useEffect(() => {
    const prev = prevServingRef.current || {}
    const next = {}
    Object.keys(serving).forEach((doctorId) => {
      next[doctorId] = serving[doctorId]?.id
      if (prev[doctorId] !== next[doctorId] && 'speechSynthesis' in window) {
        const s = serving[doctorId]
        const doc = doctors.find(d => d.id === doctorId)
        const q = (queues[doctorId] || []).filter(p => p.id !== s?.id).sort((a,b) => (a.queueNumber||0)-(b.queueNumber||0))
        const nxt = q[0]
        const msg = `${doc ? doc.name : 'Doctor'} now serving ${s?.name || 'patient'}. Next: ${nxt ? (nxt.name || 'patient') : 'none'}.`
        const u = new SpeechSynthesisUtterance(msg)
        window.speechSynthesis.speak(u)
      }
    })
    prevServingRef.current = next
  }, [serving, queues, doctors])

  return (
    <div className="page queue-list-page">
      <div className="two-col">
        <div className="col now-serving">
            <div className="serving-section">
              <div className="serving-badge">NOW SERVING</div>
              <button onClick={() => { if ('speechSynthesis' in window) window.speechSynthesis.speak(new SpeechSynthesisUtterance('Sound enabled')) }} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>🔊</button>
            {servingPatients.length === 0 ? (
              <p className="empty">No patients being served.</p>
            ) : (
              <div className="serving-list">
                {servingPatients.map((patient) => (
                  <div key={patient.id} className="serving-item">
                    <div className="patient-info">
                      <span className="patient-number">#{patient.queueNumber !== undefined ? patient.queueNumber : '—'}</span>&nbsp;
                      <span className="patient-name">{patient.name || 'Patient'}</span>
                      {patient.doctorName && <span className="patient-doctor">with {patient.doctorName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col waiting-queue">
          <div className="doctor-filter">
            <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
              <option value="all">All Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="empty">No patients waiting in queue.</p>
          ) : (
            <div className="queue-list">
              {filtered.map((patient) => {
                const queueNumber = patient.queueNumber !== undefined ? patient.queueNumber : (patient.position !== undefined ? patient.position + 1 : '—')
                const isNext = byDoctor[patient.doctorId] && byDoctor[patient.doctorId][0]?.id === patient.id
                return (
                  <div key={patient.id} className={`queue-item-minimal ${patient.status}`}>
                    {isNext && <div className="next-badge-row"><span className="next-badge">You're next</span></div>}
                    <div className="queue-details-row">
                      <span className="queue-number">#{queueNumber}</span>
                      <span className="patient-name-minimal">{patient.name || 'Patient'}</span>
                      {patient.doctorName && <span className="patient-doctor-minimal">with {patient.doctorName}</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
