import { useState } from 'react'
import { useQueue } from '../context/QueueContext'

export default function LoginPage({ onLogin }) {
  const { doctors } = useQueue()
  const [role, setRole] = useState('')
  const [doctorId, setDoctorId] = useState('')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (role === 'doctor' && !doctorId) return
    onLogin(role, doctorId)
  }

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole)
    if (selectedRole !== 'doctor') {
      setDoctorId('')
      onLogin(selectedRole, '')
    } else {
      setDoctorId('')
    }
  }

  return (
    <div className="page login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Clinic Queue System</h1>
          <p>Double-click a role to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <div className="role-options">
            <div 
              className={`role-option ${role === 'staff' ? 'selected' : ''}`}
              onDoubleClick={() => handleRoleSelect('staff')}
            >
              <div className="role-content">
                <span className="role-icon">👩‍⚕️</span>
                <span className="role-label">Staff / Nurse</span>
                <span className="role-desc">Manage patient queues</span>
              </div>
              {role === 'staff' && <span className="checkmark">✓</span>}
            </div>
            <div 
              className={`role-option ${role === 'doctor' ? 'selected' : ''}`}
              onDoubleClick={() => handleRoleSelect('doctor')}
            >
              <div className="role-content">
                <span className="role-icon">👨‍⚕️</span>
                <span className="role-label">Doctor</span>
                <span className="role-desc">Serve patients</span>
              </div>
              {role === 'doctor' && <span className="checkmark">✓</span>}
            </div>
            <div 
              className={`role-option ${role === 'patient' ? 'selected' : ''}`}
              onDoubleClick={() => handleRoleSelect('patient')}
            >
              <div className="role-content">
                <span className="role-icon">🧑‍🦱</span>
                <span className="role-label">Patient</span>
                <span className="role-desc">Check queue status</span>
              </div>
              {role === 'patient' && <span className="checkmark">✓</span>}
            </div>
          </div>

          {role === 'doctor' && (
            <div className="doctor-select">
              <label>Select Your Profile:</label>
              <select value={doctorId} onChange={(e) => setDoctorId(e.target.value)} required>
                <option value="">-- Choose Doctor --</option>
                {doctors.map(d => (
                  <option key={d.id} value={d.id}>{d.name} - {d.specialty}</option>
                ))}
              </select>
            </div>
          )}

          {role === 'doctor' && (
            <button type="submit" disabled={!doctorId} className="btn btn-primary btn-full">
              Continue
            </button>
          )}
        </form>
      </div>
    </div>
  )
}