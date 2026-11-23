import { useState, useEffect, useRef, Fragment } from 'react'
import { useQueue } from '../context/QueueContext'
import { Link, useLocation } from 'react-router-dom'
import { db } from '../lib/firebase'
import { collection, onSnapshot } from 'firebase/firestore'

const Breadcrumb = ({ items }) => (
  <nav className="breadcrumb">
    {items.map((item, i) => (
      <Fragment key={i}>
        {item.link ? <Link to={item.link}>{item.label}</Link> : <span>{item.label}</span>}
        {i < items.length - 1 && <span className="sep">›</span>}
      </Fragment>
    ))}
  </nav>
)

function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return
  const synth = window.speechSynthesis
  // Cancel any pending speech to prevent queue buildup
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 1
  synth.speak(utterance)
}

export default function QueueListPage() {
  const { queues, serving, doctors } = useQueue()
  const isVisibleRef = useRef(true)
  const hasSpokenRef = useRef({})
  const lastSeenRef = useRef(Date.now())
  const unsubRef = useRef(null)

  // Track page visibility - only listen for announcements when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
      
      if (document.hidden) {
        // Detach listener when hidden - no speech queued at all
        if (unsubRef.current) {
          unsubRef.current()
          unsubRef.current = null
        }
        // Cancel any pending speech
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
      } else {
        // Attach listener when visible
        if (!unsubRef.current) {
          unsubRef.current = onSnapshot(collection(db, 'announcements'), (snap) => {
            snap.docChanges().forEach((c) => {
              if (c.type === 'added' && isVisibleRef.current) {
                const data = c.doc.data()
                const createdAt = data.createdAt || 0
                if (createdAt > lastSeenRef.current) {
                  lastSeenRef.current = createdAt
                  speakText(data.text)
                }
              }
            })
          })
        }
        // Reset spoken tracking when page becomes visible
        hasSpokenRef.current = {}
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    // Initial subscription if visible
    if (!document.hidden) {
      unsubRef.current = onSnapshot(collection(db, 'announcements'), (snap) => {
          snap.docChanges().forEach((c) => {
            if (c.type === 'added' && isVisibleRef.current) {
              const data = c.doc.data()
              const createdAt = data.createdAt || 0
              if (createdAt > lastSeenRef.current) {
                lastSeenRef.current = createdAt
                speakText(data.text)
              }
            }
          })
      })
    }
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (unsubRef.current) {
        unsubRef.current()
      }
    }
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
      if (prev[doctorId] !== next[doctorId] && isVisibleRef.current) {
        const s = serving[doctorId]
        const doc = doctors.find(d => d.id === doctorId)
        const q = (queues[doctorId] || []).filter(p => p.id !== s?.id).sort((a,b) => (a.queueNumber||0)-(b.queueNumber||0))
        const nxt = q[0]
        const msg = `${doc ? doc.name : 'Doctor'} now serving ${s?.name || 'patient'}. Next: ${nxt ? (nxt.name || 'patient') : 'none'}.`
        const key = `${doctorId}-${s?.id}`
        // Prevent duplicate announcements for the same patient
        if (!hasSpokenRef.current[key]) {
          hasSpokenRef.current[key] = true
          speakText(msg)
        }
      }
    })
    prevServingRef.current = next
  }, [serving, queues, doctors])

  return (
    <div className="page queue-list-page full-width">
      <div className="two-col">
        <div className="col now-serving">
<div className="serving-section">
            <div className="serving-badge">NOW SERVING</div>
            <button className="sound-toggle" onClick={() => speakText('Sound enabled')} aria-label="Enable sound announcements">🔊</button>
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

