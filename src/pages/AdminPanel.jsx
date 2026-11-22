import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQueue } from '../context/QueueContext'
import { collection, onSnapshot, query, orderBy, getDocs } from 'firebase/firestore'
import { db } from '../lib/firebase'

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

const capitalize = (str) => {
  if (!str) return ''
  return str.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

const formatDate = (ts) => {
  if (!ts) return '---'
  try {
    const d = ts.toDate ? ts.toDate() : new Date(ts)
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  } catch {
    return '---'
  }
}

export default function AdminPanel() {
  const {
    doctors, staffs, queues, serving,
    addDoctor, updateDoctor, resetDoctorPassword, deleteDoctor,
    addStaff, updateStaff, deleteStaff,
    addPatient
  } = useQueue()
  const [patients, setPatients] = useState([])
  const [loadingPatients, setLoadingPatients] = useState(false)
  const [tab, setTab] = useState('doctors')
  const [editingId, setEditingId] = useState(null)
  const [edits, setEdits] = useState({})
  const [resettingId, setResettingId] = useState(null)
  const [staffEditingId, setStaffEditingId] = useState(null)
  const [staffEdits, setStaffEdits] = useState({})
  const [toast, setToast] = useState(null)
  const prevPasswordDates = useRef({})
  const [showAddDoctor, setShowAddDoctor] = useState(false)
  const [showAddStaff, setShowAddStaff] = useState(false)
  const [showAddPatient, setShowAddPatient] = useState(false)
  const [newPatient, setNewPatient] = useState({ hrn: '', name: '', contact: '', reason: '' })

  useEffect(() => {
    if (doctors.length > 0) {
      const initial = {}
      doctors.forEach(d => {
        initial[d.id] = { name: d.name || '', specialty: d.specialty || '' }
      })
      setEdits(initial)
    }
  }, [doctors])

  useEffect(() => {
    if (staffs.length > 0) {
      const initial = {}
      staffs.forEach(s => {
        initial[s.id] = { name: s.name || '', role: s.role || 'Staff' }
      })
      setStaffEdits(initial)
    }
  }, [staffs])

  useEffect(() => {
    setLoadingPatients(true)
    const patientsRef = collection(db, 'patients')
    const unsub = onSnapshot(query(patientsRef, orderBy('updatedAt', 'desc')), (snapshot) => {
      const data = []
      snapshot.forEach(doc => {
        data.push({ id: doc.id, ...doc.data() })
      })
      setPatients(data)
      setLoadingPatients(false)
    }, (err) => {
      console.error('Error loading patients:', err)
      setLoadingPatients(false)
    })
    return () => unsub()
  }, [])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  // Doctor actions
  const startEdit = (id) => setEditingId(id)
  const cancelEdit = () => setEditingId(null)

  const handleEditChange = (id, field, value) => {
    setEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const saveEdit = async (id) => {
    const edit = edits[id]
    try {
      await updateDoctor(id, { name: capitalize(edit.name), specialty: capitalize(edit.specialty) })
      setEditingId(null)
      showToast('Doctor updated')
    } catch (err) {
      showToast('Failed to update doctor')
    }
  }

  const defaultPassword = () => 'doc1234'

  const startReset = (id) => {
    const doctor = doctors.find(d => d.id === id)
    if (doctor) {
      prevPasswordDates.current[id] = doctor.passwordUpdatedAt
    }
    setResettingId(id)
  }
  const cancelReset = () => {
    prevPasswordDates.current[resettingId] = undefined
    setResettingId(null)
  }

  const saveReset = async (id) => {
    const doctor = doctors.find(d => d.id === id)
    if (!doctor) return
    try {
      await resetDoctorPassword(id, defaultPassword())
      prevPasswordDates.current[id] = undefined
      setResettingId(null)
      showToast('Password reset to default')
    } catch (err) {
      showToast('Failed to reset password')
    }
  }

  const handleDeleteDoctor = async (id) => {
    if (!window.confirm('Are you sure you want to delete this doctor?')) return
    try {
      await deleteDoctor(id)
      showToast('Doctor deleted')
    } catch (err) {
      showToast('Failed to delete doctor')
    }
  }

  const handleAddDoctor = async (e) => {
    e.preventDefault()
    const form = new FormData(e.target)
    const name = form.get('name').trim()
    const specialty = form.get('specialty').trim()
    if (!name) {
      showToast('Doctor name is required')
      return
    }
    try {
      await addDoctor({ name: capitalize(name), specialty: capitalize(specialty || 'Internal Medicine'), password: defaultPassword() })
      setShowAddDoctor(false)
      showToast('Doctor added')
    } catch (err) {
      showToast(err.message || 'Failed to add doctor')
    }
  }

  // Staff actions
  const startStaffEdit = (id) => setStaffEditingId(id)
  const cancelStaffEdit = () => setStaffEditingId(null)

  const handleStaffEditChange = (id, field, value) => {
    setStaffEdits(prev => ({ ...prev, [id]: { ...prev[id], [field]: value } }))
  }

  const saveStaffEdit = async (id) => {
    const edit = staffEdits[id]
    try {
      await updateStaff(id, { name: capitalize(edit.name), role: edit.role })
      setStaffEditingId(null)
      showToast('Staff updated')
    } catch (err) {
      showToast('Failed to update staff')
    }
  }

  const handleAddStaff = async (e) => {
    e.preventDefault()
    const form = new FormData(e.target)
    const name = form.get('name').trim()
    const role = form.get('role').trim()
    if (!name) {
      showToast('Name is required')
      return
    }
    try {
      await addStaff({ name, role: role || 'Staff' })
      setShowAddStaff(false)
      showToast('Staff added')
    } catch (err) {
      showToast(err.message || 'Failed to add staff')
    }
  }

  const handleDeleteStaff = async (id) => {
    if (!window.confirm('Are you sure you want to delete this staff?')) return
    try {
      await deleteStaff(id)
      showToast('Staff deleted')
    } catch (err) {
      showToast('Failed to delete staff')
    }
  }

  const handleAddPatient = async (e) => {
    e.preventDefault()
    const { hrn, name, contact, reason } = newPatient
    if (!hrn || !name) {
      showToast('HRN and name are required')
      return
    }
    try {
      await addPatient(doctors[0]?.id || '', { hrn, name, contact, reason })
      setShowAddPatient(false)
      setNewPatient({ hrn: '', name: '', contact: '', reason: '' })
      showToast('Patient added')
    } catch (err) {
      showToast(err.message || 'Failed to add patient')
    }
  }

  const totalWaiting = Object.values(queues).flat().filter(p => p.status === 'waiting').length
  const totalServing = Object.values(serving).filter(Boolean).length

  return (
    <div className="page staff-page">
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Breadcrumb items={[{ label: 'Home', link: '/' }, { label: 'Admin Panel' }]} />
          <h1>Admin Panel</h1>
        </div>
      </header>

      <div className="toast-container">
        {toast && <div className="toast">{toast}</div>}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value">{doctors.length}</div>
          <div className="stat-label">Doctors</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{staffs.length}</div>
          <div className="stat-label">Staff</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{patients.length}</div>
          <div className="stat-label">Patients</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalWaiting}</div>
          <div className="stat-label">Waiting</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{totalServing}</div>
          <div className="stat-label">Serving</div>
        </div>
      </div>

      <div className="tabs">
        <button
          className={tab === 'doctors' ? 'tab-active' : ''}
          onClick={() => setTab('doctors')}
        >
          Doctors
        </button>
        <button
          className={tab === 'staff' ? 'tab-active' : ''}
          onClick={() => setTab('staff')}
        >
          Staff
        </button>
        <button
          className={tab === 'patients' ? 'tab-active' : ''}
          onClick={() => setTab('patients')}
        >
          Patients
        </button>
      </div>

      {tab === 'doctors' && (
        <section className="card">
          <div className="queue-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Doctors ({doctors.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddDoctor(true)}>Add Doctor</button>
          </div>
          <div className="queue-list">
            {doctors.length === 0 ? (
              <p className="empty">No doctors</p>
            ) : (
              doctors.map((doctor) => {
                const isEditing = editingId === doctor.id
                const isResetting = resettingId === doctor.id
                const edit = edits[doctor.id] || { name: doctor.name || '', specialty: doctor.specialty || '' }
                const displayPasswordUpdatedAt = isResetting
                  ? (prevPasswordDates.current[doctor.id] ?? doctor.passwordUpdatedAt)
                  : doctor.passwordUpdatedAt
                return (
                  <div key={doctor.id} className="queue-item" style={{ padding: 16, gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
                      <span style={{ fontWeight: 600 }}>{doctor.name}</span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{doctor.specialty}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>ID: {doctor.id}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>Password last updated: {formatDate(displayPasswordUpdatedAt)}</span>
                    </div>

                    {isEditing ? (
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          value={edit.name}
                          onChange={(e) => handleEditChange(doctor.id, 'name', e.target.value)}
                          placeholder="Name"
                          style={{ padding: 8, fontSize: 13 }}
                        />
                        <input
                          value={edit.specialty}
                          onChange={(e) => handleEditChange(doctor.id, 'specialty', e.target.value)}
                          placeholder="Specialty"
                          style={{ padding: 8, fontSize: 13 }}
                        />
                        <button onClick={() => saveEdit(doctor.id)} className="btn btn-primary btn-sm">Save</button>
                        <button onClick={cancelEdit} className="btn btn-ghost btn-sm">Cancel</button>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => startEdit(doctor.id)} className="btn btn-ghost btn-sm">Edit</button>
                        <button onClick={() => startReset(doctor.id)} className="btn btn-ghost btn-sm">Reset Password</button>
                        <button onClick={() => handleDeleteDoctor(doctor.id)} className="btn btn-danger btn-sm">Delete</button>
                      </div>
                    )}

                    {isResetting ? (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexDirection: 'column' }}>
                        <p style={{ fontSize: 12, color: '#64748b', margin: 0 }}>
                          Default password: <strong>{defaultPassword()}</strong>
                        </p>
                        <button onClick={() => saveReset(doctor.id)} className="btn btn-primary btn-sm">Reset</button>
                        <button onClick={cancelReset} className="btn btn-ghost btn-sm">Cancel</button>
                      </div>
                    ) : null}
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {tab === 'staff' && (
        <section className="card">
          <div className="queue-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Staff ({staffs.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddStaff(true)}>Add Staff</button>
          </div>
          <div className="queue-list">
            {staffs.length === 0 ? (
              <p className="empty">No staff</p>
            ) : (
              staffs.map((staff) => {
                const isEditing = staffEditingId === staff.id
                const edit = staffEdits[staff.id] || { name: staff.name || '', role: staff.role || 'Staff', username: staff.username || '' }
                return (
                  <div key={staff.id} className="queue-item" style={{ padding: 16, gap: 12, alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 220 }}>
                      <span style={{ fontWeight: 600 }}>{staff.name}</span>
                      <span style={{ fontSize: 13, color: '#64748b' }}>{staff.role}</span>
                      <span style={{ fontSize: 12, color: '#94a3b8' }}>ID: {staff.id}</span>
                    </div>

                    {isEditing ? (
                      <form onSubmit={(e) => { e.preventDefault(); saveStaffEdit(staff.id) }} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                        <input
                          value={edit.name}
                          onChange={(e) => handleStaffEditChange(staff.id, 'name', e.target.value)}
                          placeholder="Name"
                          style={{ padding: 8, fontSize: 13, minWidth: 120 }}
                        />
                        <select
                          value={edit.role}
                          onChange={(e) => handleStaffEditChange(staff.id, 'role', e.target.value)}
                          style={{ padding: 8, fontSize: 13, minWidth: 100 }}
                        >
                          <option value="Staff">Staff</option>
                          <option value="Nurse">Nurse</option>
                        </select>
                        <button type="submit" className="btn btn-primary btn-sm">Save</button>
                        <button type="button" onClick={cancelStaffEdit} className="btn btn-ghost btn-sm">Cancel</button>
                      </form>
                    ) : (
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        <button onClick={() => startStaffEdit(staff.id)} className="btn btn-ghost btn-sm">Edit</button>
                        <button onClick={() => handleDeleteStaff(staff.id)} className="btn btn-danger btn-sm">Delete</button>
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        </section>
      )}

      {tab === 'patients' && (
        <section className="card">
          <div className="queue-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Patients ({patients.length})</h2>
            <button className="btn btn-primary btn-sm" onClick={() => setShowAddPatient(true)}>Add Patient</button>
          </div>
          <div className="queue-list">
            {loadingPatients ? (
              <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                <div className="loading-spinner" style={{ marginBottom: 12 }}></div>
                <p style={{ color: '#64748b', fontSize: 14 }}>Loading patients...</p>
              </div>
            ) : patients.length === 0 ? (
              <p className="empty">No patients</p>
            ) : (
              patients.map((patient) => (
                <div key={patient.id} className="queue-item" style={{ padding: 12, gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
                    <span style={{ fontWeight: 600 }}>{patient.name || '—'}</span>
                    <span style={{ fontSize: 12, color: '#64748b' }}>HRN: {patient.hrn || patient.id}</span>
                    {patient.contact && <span style={{ fontSize: 12, color: '#64748b' }}>Contact: {patient.contact}</span>}
                  </div>
                  <span style={{ fontSize: 12, color: '#94a3b8' }}>{formatDate(patient.updatedAt)}</span>
                </div>
              ))
            )}
          </div>
        </section>
      )}

      {showAddDoctor && (
        <div className="modal-overlay" onClick={() => setShowAddDoctor(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '90vw' }}>
            <div className="modal-header">
              <h3>Add Doctor</h3>
              <button className="btn-close" onClick={() => setShowAddDoctor(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddDoctor} className="add-form">
                <h3 className="add-form-title" style={{ margin: 0 }}>Doctor Information</h3>
                <p className="add-form-desc">Default password is set to <strong>{defaultPassword()}</strong>. Doctor can change it on first login.</p>

                <div className="modal-form-group">
                  <label>Doctor Name</label>
                  <input
                    name="name"
                    placeholder="e.g. John Doe"
                    required
                    autoCapitalize="words"
                  />
                </div>

                <div className="modal-form-group">
                  <label>Specialty</label>
                  <select name="specialty">
                    <option value="Internal Medicine">Internal Medicine</option>
                    <option value="Cardiology">Cardiology</option>
                    <option value="Dermatology">Dermatology</option>
                    <option value="Pediatrics">Pediatrics</option>
                    <option value="Neurology">Neurology</option>
                    <option value="Orthopedics">Orthopedics</option>
                    <option value="Oncology">Oncology</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddDoctor(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Doctor</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddStaff && (
        <div className="modal-overlay" onClick={() => setShowAddStaff(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '90vw' }}>
            <div className="modal-header">
              <h3>Add Staff</h3>
              <button className="btn-close" onClick={() => setShowAddStaff(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddStaff} className="add-form">
                <h3 className="add-form-title" style={{ margin: 0 }}>Staff Information</h3>
                <p className="add-form-desc">Create a new staff account. Default password is set to <strong>staff1234</strong>. Staff can change it on first login.</p>

                <div className="modal-form-group">
                  <label>Name</label>
                  <input name="name" placeholder="e.g. Jane Smith" required autoCapitalize="words" />
                </div>

                <div className="modal-form-group">
                  <label>Role</label>
                  <select name="role">
                    <option value="Staff">Staff</option>
                    <option value="Nurse">Nurse</option>
                  </select>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddStaff(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Staff</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {showAddPatient && (
        <div className="modal-overlay" onClick={() => setShowAddPatient(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480, width: '90vw' }}>
            <div className="modal-header">
              <h3>Add Patient</h3>
              <button className="btn-close" onClick={() => setShowAddPatient(false)}>×</button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleAddPatient} className="add-form">
                <h3 className="add-form-title" style={{ margin: 0 }}>Patient Information</h3>
                <p className="add-form-desc">Register a new patient to the queue system.</p>

                <div className="modal-form-group">
                  <label>HRN (Health Record Number)</label>
                  <input
                    name="hrn"
                    placeholder="e.g. HRN-12345"
                    required
                    value={newPatient.hrn}
                    onChange={(e) => setNewPatient({ ...newPatient, hrn: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Name</label>
                  <input
                    name="name"
                    placeholder="e.g. Alice Jones"
                    required
                    autoCapitalize="words"
                    value={newPatient.name}
                    onChange={(e) => setNewPatient({ ...newPatient, name: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Contact Number</label>
                  <input
                    name="contact"
                    placeholder="e.g. 09123456789"
                    value={newPatient.contact}
                    onChange={(e) => setNewPatient({ ...newPatient, contact: e.target.value })}
                  />
                </div>

                <div className="modal-form-group">
                  <label>Reason for Visit</label>
                  <input
                    name="reason"
                    placeholder="e.g. Consultation"
                    value={newPatient.reason}
                    onChange={(e) => setNewPatient({ ...newPatient, reason: e.target.value })}
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setShowAddPatient(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary">Add Patient</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
