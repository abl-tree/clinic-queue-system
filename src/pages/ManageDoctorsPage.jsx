import { useState, useEffect, useRef, Fragment } from 'react'
import { Link } from 'react-router-dom'
import { useQueue } from '../context/QueueContext'

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

export default function ManageDoctorsPage() {
  const { doctors, updateDoctor, resetDoctorPassword } = useQueue()
  const [editingId, setEditingId] = useState(null)
  const [edits, setEdits] = useState({})
  const [resettingId, setResettingId] = useState(null)
  const [toast, setToast] = useState(null)
  const prevPasswordDates = useRef({})

  useEffect(() => {
    if (doctors.length > 0) {
      const initial = {}
      doctors.forEach(d => {
        initial[d.id] = { name: d.name || '', specialty: d.specialty || '' }
      })
      setEdits(initial)
    }
  }, [doctors])

  const showToast = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

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

  return (
    <div className="page staff-page">
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Breadcrumb items={[{ label: 'Home', link: '/' }, { label: 'Staff', link: '/staff' }, { label: 'Manage Doctors' }]} />
          <h1>Manage Doctors</h1>
        </div>
      </header>

      <div className="toast-container">
        {toast && <div className="toast">{toast}</div>}
      </div>

      <section className="card">
        <div className="queue-header">
          <h2>Doctors ({doctors.length})</h2>
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
    </div>
  )
}

