import { useState, useEffect, Fragment } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useQueue } from '../context/QueueContext'
import SearchSelect from '../components/SearchSelect'

export default function StaffPage() {
  const { doctors, queues, addPatient, removePatient, clearQueue, clearAllQueues, getPatientProfile, addDoctor, savePatientProfile } = useQueue()
  const navigate = useNavigate()

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
  const [selectedDoctor, setSelectedDoctor] = useState('')
  const [formData, setFormData] = useState({ hrn: '', name: '', contact: '', reason: 'Consultation' })
  const [patientFound, setPatientFound] = useState(false)
  const [fetchedProfile, setFetchedProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(false)
  const [addingDoctor, setAddingDoctor] = useState(false)
  const [newDoctorName, setNewDoctorName] = useState('')
  const [newDoctorSpecialty, setNewDoctorSpecialty] = useState('Internal Medicine')
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [doctorToClear, setDoctorToClear] = useState(null)
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(null)
  const [toast, setToast] = useState(null)

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const confirmRemovePatient = async (id, doctorId) => {
    try {
      await removePatient(doctorId || selectedDoctor, id)
      setShowRemoveConfirm(null)
    } catch (err) {
      setShowRemoveConfirm(null)
    }
  }

  const cancelRemovePatient = () => setShowRemoveConfirm(null)

  const capitalize = (str) => {
    if (!str) return ''
    return str.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
  }

  const handleHrnBlur = async () => {
    const hrn = formData.hrn.trim()
    if (!hrn) return
    
    setLoadingProfile(true)
    const profile = await getPatientProfile(hrn)
    if (profile) {
      setFormData(prev => ({ 
        ...prev, 
        contact: profile.contact || '',
        name: profile.name || ''
      }))
      setFetchedProfile(profile)
      setPatientFound(true)
      if (profile.lastDoctorId) {
        setSelectedDoctor(profile.lastDoctorId)
      }
    } else {
      setFetchedProfile(null)
      setPatientFound(false)
    }
    setLoadingProfile(false)
  }

  const handleNameBlur = async () => {
    if (!patientFound || !fetchedProfile) return
    const newName = capitalize(formData.name)
    const oldName = fetchedProfile.name || ''
    if (newName.trim() && newName !== oldName) {
      try {
        await savePatientProfile(formData.hrn.trim(), { name: newName })
        setFetchedProfile(prev => prev ? { ...prev, name: newName } : null)
      } catch (err) {
        console.error('Error updating patient name:', err)
      }
    }
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!formData.hrn.trim()) return
    addPatient(selectedDoctor, {
      hrn: formData.hrn.trim(),
      name: capitalize(formData.name),
      contact: capitalize(formData.contact),
      reason: capitalize(formData.reason)
    })
    showToast('Patient added to queue')
    setFormData({ hrn: '', name: '', contact: '', reason: 'Consultation' })
    setPatientFound(false)
  }

  const handleAddDoctor = async (e) => {
    if (e) e.preventDefault()
    if (!newDoctorName.trim()) return
    const password = 'doc1234'
    const newId = await addDoctor({ name: capitalize(newDoctorName), specialty: capitalize(newDoctorSpecialty), password })
    setAddingDoctor(false)
    setSelectedDoctor(newId)
    setNewDoctorName('')
    setNewDoctorSpecialty('Internal Medicine')
  }

  const currentQueue = selectedDoctor ? (queues[selectedDoctor] || []) : null
  const currentDoctor = selectedDoctor ? doctors.find(d => d.id === selectedDoctor) : null
  const allQueueCount = Object.values(queues).reduce((sum, q) => sum + (q ? q.length : 0), 0)

  return (
    <div className="page staff-page">
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', alignItems: 'flex-start' }}>
          <Breadcrumb items={[{ label: 'Home', link: '/' }, { label: 'Staff' }]} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
            <h1>Staff / Nurse Station</h1>
            <Link to="/staff/manage-doctors">
              <button className="btn btn-primary btn-sm">Manage Doctors</button>
            </Link>
          </div>
        </div>
      </header>

      <div className="toast-container">
        {toast && <div className="toast">{toast}</div>}
      </div>

      <div className="content-grid">
        <section className="card add-patient-card">
          <h2>Add Patient to Queue</h2>
          <form onSubmit={handleSubmit} className="patient-form">
            <div className="hrn-field">
              <input
                type="text"
                placeholder="HRN (Patient ID) *"
                value={formData.hrn}
                onChange={(e) => {
                  setFormData({...formData, hrn: e.target.value})
                  if (e.target.value.trim() === '') setPatientFound(false)
                }}
                onBlur={handleHrnBlur}
                required
                autoFocus
              />
              {loadingProfile && <span className="loading-spinner" />}
              {patientFound && <span className="patient-found-badge">Patient found ✓</span>}
            </div>
            <input
              type="text"
              placeholder="Patient Name *"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              onBlur={handleNameBlur}
              autoCapitalize="words"
              required
            />
            <div className="form-field">
              <label>Doctor</label>
              <div className="doctor-field-row">
                <SearchSelect
                  options={doctors}
                  value={selectedDoctor}
                  onChange={setSelectedDoctor}
                  onClear={() => setSelectedDoctor('')}
                  placeholder="Search doctor by name or specialty"
                  labelKey="name"
                  searchKeys={['name', 'specialty']}
                  optionTitle={(d) => `${d.name} - ${d.specialty}`}
                  noResultsText="No doctors match"
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  title="Add New Doctor"
                  onClick={() => setAddingDoctor(true)}
                  style={{ flexShrink: 0 }}
                >+</button>
              </div>
            </div>
            <input
              type="text"
              placeholder="Reason for Visit"
              value={formData.reason}
              onChange={(e) => setFormData({...formData, reason: e.target.value})}
              autoCapitalize="sentences"
            />
            <button type="submit" className="btn btn-primary">Add to Queue</button>
          </form>
        </section>

        <section className="card queue-card">
          <div className="queue-header">
            <h2>Queue for {currentDoctor?.name || 'All Doctors'} ({selectedDoctor ? currentQueue.length : allQueueCount})</h2>
            {selectedDoctor && currentQueue.length > 0 && (
               <Fragment>
                <button onClick={() => { setDoctorToClear(selectedDoctor); setShowClearConfirm(true) }} className="btn btn-danger btn-sm" style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                  Clear Queue
                </button>
               </Fragment>
            )}
            {!selectedDoctor && allQueueCount > 0 && (
               <Fragment>
                <button onClick={() => { setDoctorToClear(null); setShowClearConfirm(true) }} className="btn btn-danger btn-sm" style={{ background: '#dc2626', borderColor: '#dc2626' }}>
                  Clear All Queue
                </button>
               </Fragment>
            )}
          </div>
          {showClearConfirm && doctorToClear && (
            <div className="modal-overlay" onClick={() => setShowClearConfirm(false)}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '90vw' }}>
                <div className="modal-header">
                  <h3>Confirm Clear Queue</h3>
                  <button className="btn-close" onClick={() => setShowClearConfirm(false)}>×</button>
                </div>
                <div className="modal-body">
                  <p style={{ margin: 0, fontSize: 14 }}>Are you sure you want to clear all patients from this doctor's queue? This cannot be undone.</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowClearConfirm(false)}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={() => { if (doctorToClear) { clearQueue(doctorToClear) } else { clearAllQueues() }; setShowClearConfirm(false); setDoctorToClear(null) }} style={{ background: '#dc2626', borderColor: '#dc2626' }}>Clear Queue</button>
                </div>
              </div>
            </div>
          )}
          {showRemoveConfirm && (
            <div className="modal-overlay" onClick={cancelRemovePatient}>
              <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, width: '90vw' }}>
                <div className="modal-header">
                  <h3>Confirm Remove Patient</h3>
                  <button className="btn-close" onClick={cancelRemovePatient}>×</button>
                </div>
                <div className="modal-body">
                  <p style={{ margin: 0, fontSize: 14 }}>Are you sure you want to remove this patient from the queue? This cannot be undone.</p>
                </div>
                <div className="modal-footer">
                  <button type="button" className="btn btn-ghost" onClick={cancelRemovePatient}>Cancel</button>
                  <button type="button" className="btn btn-danger" onClick={() => { confirmRemovePatient(showRemoveConfirm.id, showRemoveConfirm.doctorId) }} style={{ background: '#dc2626', borderColor: '#dc2626' }}>Remove</button>
                </div>
              </div>
            </div>
          )}
          <div className="queue-list">
            {currentQueue === null ? (
              <div className="all-queues-list">
                {Object.keys(queues).length === 0 ? (
                  <p className="empty">No queues available</p>
                ) : (
                  Object.entries(queues).map(([docId, q]) => {
                    const doc = doctors.find(d => d.id === docId)
                    return (
                      <div key={docId} className="queue-section">
<div className="queue-section-header">
                          <h3 className="queue-section-title">{doc?.name || docId} ({q.length})</h3>
                        </div>
                        {q.length === 0 ? (
                          <p className="empty">No patients in queue</p>
                        ) : (
                          q.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)).map((patient, index) => (
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
                                onClick={() => setShowRemoveConfirm({ id: patient.id, doctorId: docId })}
                                className="btn btn-ghost btn-sm queue-item-remove"
                                title="Remove"
                                style={{ color: '#dc2626' }}
                              >
                                ×
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                    )
                  })
                )}
              </div>
            ) : currentQueue.length === 0 ? (
              <p className="empty">No patients in queue</p>
            ) : (
              currentQueue.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)).map((patient, index) => (
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
                    onClick={() => setShowRemoveConfirm({ id: patient.id, doctorId: selectedDoctor })}
                    className="btn btn-ghost btn-sm queue-item-remove"
                    title="Remove"
                    style={{ color: '#dc2626' }}
                  >
                    ×
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
      {addingDoctor && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h3>Add New Doctor</h3>
              <button className="btn-close" onClick={() => setAddingDoctor(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddDoctor}>
                <input
                  placeholder="Doctor Name"
                  value={newDoctorName}
                  onChange={(e) => setNewDoctorName(e.target.value)}
                  autoFocus
                  autoCapitalize="words"
                />
                <select value={newDoctorSpecialty} onChange={(e) => setNewDoctorSpecialty(e.target.value)}>
                  <option value="Internal Medicine">Internal Medicine</option>
                  <option value="Cardiology">Cardiology</option>
                  <option value="Dermatology">Dermatology</option>
                  <option value="Pediatrics">Pediatrics</option>
                  <option value="Neurology">Neurology</option>
                  <option value="Orthopedics">Orthopedics</option>
                  <option value="Oncology">Oncology</option>
                </select>
                <p style={{ fontSize: 12, color: '#64748b', marginTop: 8, marginBottom: 0 }}>
                  Default password is doc1234.
                </p>
              </form>
            </div>
            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-ghost"
              onClick={() => {
                setAddingDoctor(false)
                setNewDoctorName('')
                setNewDoctorSpecialty('Internal Medicine')
                setNewDoctorUsername('')
              }}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddDoctor}
              >
                Add Doctor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
