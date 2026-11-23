import { useQueue } from '../context/QueueContext'
import { Link } from 'react-router-dom'
import { db } from '../lib/firebase'
import { collection, addDoc } from 'firebase/firestore'
import { useState, useEffect, useRef, Fragment } from 'react'

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
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 1
  synth.speak(utterance)
}

const formatTimeSpend = (startedAt) => {
  if (!startedAt) return '0:00'
  const start = startedAt.toDate ? startedAt.toDate() : new Date(startedAt)
  const now = new Date()
  const diffMs = now - start
  const minutes = Math.floor(diffMs / 60000)
  const seconds = Math.floor((diffMs % 60000) / 1000)
  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}

export default function DoctorPage({ doctorId } = {}) {
  const { doctors, queues, serving, loading, serveNext, servePatient, skipPatient, donePatient } = useQueue()
  const currentDoctorId = doctorId
  const doctor = doctors.find(d => d.id === currentDoctorId)
  const queue = queues[currentDoctorId] || []
  const currentServing = serving[currentDoctorId]
  const [timeSpend, setTimeSpend] = useState('0:00')
  const [recallCooldown, setRecallCooldown] = useState(0)
  const [skipLoading, setSkipLoading] = useState(false)
  const [doneLoading, setDoneLoading] = useState(false)
  const recallCooldownRef = useRef(0)
  const isVisibleRef = useRef(true)
  const hasSpokenRef = useRef({})

  // Cooldown timer
  useEffect(() => {
    if (recallCooldown > 0) {
      const timer = setInterval(() => {
        setRecallCooldown(c => {
          const next = Math.max(0, c - 1)
          recallCooldownRef.current = next
          return next
        })
      }, 1000)
      return () => clearInterval(timer)
    }
  }, [recallCooldown])

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden
      if (document.hidden) {
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel()
        }
      } else {
        hasSpokenRef.current = {}
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [])

  useEffect(() => {
    if (!currentServing?.startedAt) {
      setTimeSpend('0:00')
      return
    }
    const interval = setInterval(() => {
      setTimeSpend(formatTimeSpend(currentServing.startedAt))
    }, 1000)
    return () => clearInterval(interval)
  }, [currentServing?.startedAt])

  // Announce when a new patient starts being served
  useEffect(() => {
    if (currentServing && isVisibleRef.current) {
      const key = `${currentDoctorId}-${currentServing.id}`
      if (!hasSpokenRef.current[key]) {
        hasSpokenRef.current[key] = true
        const msg = `${currentServing.name || 'Patient'}.`
        speakText(msg)
      }
    }
  }, [currentServing?.id, currentDoctorId])

  if (loading) return (
    <div className="page doctor-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="loading-spinner" style={{ marginBottom: 12 }}></div>
      <p style={{ color: '#64748b', fontSize: 14 }}>Loading...</p>
    </div>
  )
  if (!doctor) return <div className="page">Doctor not found</div>

  return (
    <div className="page doctor-page">
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Breadcrumb items={[{ label: 'Home', link: '/' }, { label: 'Doctor' }]} />
          <div>
            <h1>{doctor.name}</h1>
            <span className="specialty">{doctor.specialty}</span>
          </div>
        </div>
      </header>

      {currentServing && (
        <section className="serving-window">
          <div className="serving-badge">NOW SERVING</div>
          <button className="sound-toggle" onClick={() => speakText('Sound enabled')} aria-label="Enable sound announcements">🔊</button>
          <div className="serving-patient-info">
            <span className="patient-number">#{currentServing.queueNumber || '—'}</span>
            <span className="patient-name">
              {currentServing.name ? currentServing.name : 'Patient'}
            </span>
            {currentServing.hrn && (
              <span className="patient-hrn">HRN: {currentServing.hrn}</span>
            )}
            {currentServing.contact && (
              <span className="patient-contact">{currentServing.contact}</span>
            )}
            {currentServing.reason && (
              <span className="patient-reason">{currentServing.reason}</span>
            )}
            {currentServing.startedAt && (
              <span className="patient-timespend">Time: {timeSpend}</span>
            )}
          </div>
          <div className="serving-actions">
            <button
              type="button"
              onClick={async () => {
                setSkipLoading(true)
                try { await skipPatient(currentDoctorId) } finally { setSkipLoading(false) }
              }}
              className="btn btn-warning btn-sm"
              style={{ background: '#f59e0b', borderColor: '#f59e0b' }}
              disabled={skipLoading}
            >
              {skipLoading && <span className="loading-spinner" />} Skip
            </button>
            <button
              type="button"
              onClick={async () => {
                if (recallCooldownRef.current > 0) return
                recallCooldownRef.current = 5
                setRecallCooldown(5)
                const msg = `${currentServing?.name || 'patient'}.`
                try { await addDoc(collection(db, 'announcements'), { text: msg, createdAt: Date.now() }) } catch {}
                speakText(msg)
              }}
              className="btn btn-primary btn-sm"
              disabled={recallCooldown > 0}
            >
              {recallCooldown > 0 ? `Recall (${recallCooldown}s)` : 'Recall'}
            </button>
            <button
              type="button"
              onClick={async () => {
                setDoneLoading(true)
                try { await donePatient(currentDoctorId) } finally { setDoneLoading(false) }
              }}
              className="btn btn-success btn-sm"
              style={{ background: '#16a34a', borderColor: '#16a34a' }}
              disabled={doneLoading}
            >
              {doneLoading && <span className="loading-spinner" />} Done/Next
            </button>
          </div>
        </section>
      )}

      <section className="card queue-card">
        <div className="queue-header">
          <h2>Waiting Queue ({queue.length})</h2>
          {!currentServing && (
            <button
              onClick={() => serveNext(currentDoctorId)}
              disabled={queue.length === 0}
              className="btn btn-primary"
            >
              {queue.length > 0 ? 'Start' : 'No Patients'}
            </button>
          )}
        </div>
        <div className="queue-list">
          {queue.length === 0 ? (
            <p className="empty">No patients waiting</p>
          ) : (
            queue.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)).map((patient, index) => (
              <div key={patient.id} className="queue-item">
                <span className="queue-number">#{patient.queueNumber !== undefined ? patient.queueNumber : index + 1}</span>
                <div className="patient-info">
                  <span className="patient-name">{patient.name ? `${patient.name} (HRN: ${patient.hrn})` : `HRN: ${patient.hrn}`}</span>
                  <span className="patient-meta">
                    {patient.contact && `${patient.contact}`}
                    {patient.reason && ` | ${patient.reason}`}
                  </span>
                </div>
                <span className="time">{patient.timestamp}</span>
                <button
                  type="button"
                  onClick={() => servePatient(currentDoctorId, patient.id)}
                  className="btn btn-primary btn-sm"
                >
                  Serve
                </button>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}
