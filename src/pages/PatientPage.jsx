import { useState, useEffect } from 'react'
import { useQueue } from '../context/QueueContext'

export default function PatientPage() {
  const { doctors, getPatientView, savePatientProfile } = useQueue()
  const [patientId, setPatientId] = useState('')
  const [contact, setContact] = useState('')
  const [view, setView] = useState(null)
  const [searched, setSearched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  const capitalize = (str) => {
    if (!str) return ''
    return str.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  useEffect(() => {
    if (patientId) {
      const data = getPatientView(patientId)
      setView(data)
      setSearched(true)
    }
  }, [patientId, getPatientView])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (patientId.trim()) setSearched(true)
  }

  const handleSaveContact = async (e) => {
    e.preventDefault()
    if (!patientId.trim() || !contact.trim()) return
    setSaving(true)
    try {
      await savePatientProfile(patientId.trim(), { contact: capitalize(contact) })
      setSaved(true)
    } catch {
      // handled by context error
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page patient-page">
      <header className="page-header">
        <div>
          <h1>Patient Queue Status</h1>
          <p className="subtitle">Enter your HRN to check your position</p>
        </div>
      </header>

      <section className="card search-card">
        <form onSubmit={handleSubmit} className="search-form">
          <input
            type="text"
            placeholder="Enter your HRN (Patient ID)"
            value={patientId}
            onChange={(e) => setPatientId(e.target.value)}
            autoFocus
          />
          <input
            type="text"
            placeholder="Contact Number"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">Check Status</button>
        </form>

        <form onSubmit={handleSaveContact} className="search-form" style={{ marginTop: '10px' }}>
          <button
            type="submit"
            disabled={saving || !patientId.trim() || !contact.trim()}
            className="btn btn-primary"
          >
            {saving ? 'Saving...' : 'Save Contact'}
          </button>
          {saved && <span className="patient-found-badge">Contact saved ✓</span>}
        </form>
      </section>

      {searched && view && (
        <section className="card status-card">
          <div className={`status-header ${view.status}`}>
            <span className="status-badge">{view.status.toUpperCase()}</span>
            <span className="doctor-name">with {doctors.find(d => d.id === view.doctorId)?.name}</span>
          </div>
          <div className="patient-details">
            <h2>{view.name ? `${view.name} (HRN: ${view.hrn})` : `HRN: ${view.hrn}`}</h2>
            <div className="detail-row">
              <span className="label">Queue Position:</span>
              <span className="value position">{view.status === 'serving' ? 'NOW SERVING' : `#${view.position + 1} of ${view.queueLength}`}</span>
            </div>
            {view.contact && <div className="detail-row"><span className="label">Contact:</span> <span>{view.contact}</span></div>}
            {view.reason && <div className="detail-row"><span className="label">Reason:</span> <span>{view.reason}</span></div>}
            <div className="detail-row"><span className="label">Registered:</span> <span>{view.timestamp}</span></div>
          </div>
          {view.status === 'waiting' && (
            <p className="wait-message">
              {view.position === 0 ? 'You are next!' : `${view.position} patient(s) ahead of you`}
            </p>
          )}
        </section>
      )}

      {searched && !view && (
        <section className="card not-found-card">
          <div className="not-found">⚠</div>
          <h3>HRN Not Found</h3>
          <p>No active queue entry found for this HRN. Please check with the front desk.</p>
        </section>
      )}

      <section className="card doctors-card">
        <h3>Available Doctors</h3>
        <div className="doctors-list">
          {doctors.map(d => (
            <div key={d.id} className="doctor-item">
              <span className="doctor-name">{d.name}</span>
              <span className="doctor-specialty">{d.specialty}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}