import { useState } from 'react'
import { useQueue } from '../context/QueueContext'
import { decrypt } from '../lib/crypto'

export default function LoginPage({ onLogin }) {
  const { doctors, staffs, changeDoctorPassword, changeStaffPassword } = useQueue()
  const [role, setRole] = useState('')
  const [doctorId, setDoctorId] = useState('')
  const [staffId, setStaffId] = useState('')
  const [password, setPassword] = useState('')
  const [loginError, setLoginError] = useState('')
  const [showDoctorModal, setShowDoctorModal] = useState(false)
  const [showStaffModal, setShowStaffModal] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [changeType, setChangeType] = useState('')
  const [changeId, setChangeId] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [changeError, setChangeError] = useState('')

  const handleDoctorLogin = async () => {
    setLoginError('')
    const doctor = doctors.find(d => d.id === doctorId)
    if (!doctor || !doctor.password) {
      setLoginError('Invalid doctor selection')
      return
    }
    try {
      const storedPassword = await decrypt(doctor.password)
      if (storedPassword !== password) {
        setLoginError('Invalid doctor password')
        return
      }
    } catch {
      setLoginError('Invalid doctor password')
      return
    }
    if (doctor.mustChangePassword) {
      setChangeId(doctor.id)
      setChangeType('doctor')
      setShowDoctorModal(false)
      setShowChangePassword(true)
      setPassword('')
      setDoctorId('')
      setNewPassword('')
      setConfirmPassword('')
      setChangeError('')
      return
    }
    onLogin('doctor', doctor.id)
    setShowDoctorModal(false)
    setPassword('')
    setDoctorId('')
  }

  const handleStaffLogin = async () => {
    setLoginError('')
    const staff = staffs.find(s => s.id === staffId)
    if (!staff || !staff.password) {
      setLoginError('Invalid staff selection')
      return
    }
    try {
      const storedPassword = await decrypt(staff.password)
      if (storedPassword !== password) {
        setLoginError('Invalid staff password')
        return
      }
    } catch {
      setLoginError('Invalid staff password')
      return
    }
    if (staff.mustChangePassword) {
      setChangeId(staff.id)
      setChangeType('staff')
      setShowStaffModal(false)
      setShowChangePassword(true)
      setPassword('')
      setStaffId('')
      setNewPassword('')
      setConfirmPassword('')
      setChangeError('')
      return
    }
    onLogin('staff', staff.id)
    setShowStaffModal(false)
    setPassword('')
    setStaffId('')
  }

  const handleChangePassword = () => {
    setChangeError('')
    if (!newPassword || !confirmPassword) {
      setChangeError('Enter and confirm your new password')
      return
    }
    if (newPassword !== confirmPassword) {
      setChangeError('Passwords do not match')
      return
    }
    const cleanPassword = newPassword.trim().toLowerCase().replace(/\s+/g, '')
    if (changeType === 'doctor') {
      changeDoctorPassword(changeId, cleanPassword)
        .then(() => {
          setShowChangePassword(false)
          setNewPassword('')
          setConfirmPassword('')
          onLogin('doctor', changeId)
        })
        .catch(() => setChangeError('Failed to change password'))
    } else if (changeType === 'staff') {
      changeStaffPassword(changeId, cleanPassword)
        .then(() => {
          setShowChangePassword(false)
          setNewPassword('')
          setConfirmPassword('')
          onLogin('staff', changeId)
        })
        .catch(() => setChangeError('Failed to change password'))
    }
  }

  const handleRoleSelect = (selectedRole) => {
    setRole(selectedRole)
    setPassword('')
    setDoctorId('')
    setStaffId('')
    setLoginError('')
    setShowDoctorModal(false)
    setShowStaffModal(false)
    setShowChangePassword(false)
    if (selectedRole !== 'doctor' && selectedRole !== 'staff') {
      onLogin(selectedRole, '')
    } else if (selectedRole === 'doctor') {
      setShowDoctorModal(true)
    } else {
      setShowStaffModal(true)
    }
  }

  return (
    <div className="page login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Clinic Queue System</h1>
          <p>Double-click a role to continue</p>
        </div>

        <form className="login-form">
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
        </form>

        {showDoctorModal && (
          <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="modal">
              <div className="modal-header">
                <h3>Doctor Login</h3>
                <button className="btn-close" onClick={() => {
                  setShowDoctorModal(false)
                  setPassword('')
                  setDoctorId('')
                  setLoginError('')
                }}>×</button>
              </div>
              <div className="modal-body">
                <form id="doctor-login-form" onSubmit={(e) => { e.preventDefault(); handleDoctorLogin(); }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
                    Select Doctor
                  </label>
                  <select
                    value={doctorId}
                    onChange={(e) => setDoctorId(e.target.value)}
                    required
                    style={{ width: '100%', padding: 10, fontSize: 14, marginBottom: 12, borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', background: '#fff' }}
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map(d => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
                    Enter your password
                  </label>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  {loginError && <span className="login-error">{loginError}</span>}
                </form>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowDoctorModal(false)
                    setPassword('')
                    setDoctorId('')
                    setLoginError('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="doctor-login-form"
                  className="btn btn-primary"
                  disabled={!doctorId || !password}
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        )}

        {showStaffModal && (
          <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="modal">
              <div className="modal-header">
                <h3>Staff Login</h3>
                <button className="btn-close" onClick={() => {
                  setShowStaffModal(false)
                  setPassword('')
                  setStaffId('')
                  setLoginError('')
                }}>×</button>
              </div>
              <div className="modal-body">
                <form id="staff-login-form" onSubmit={(e) => { e.preventDefault(); handleStaffLogin(); }}>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
                    Select Staff
                  </label>
                  <select
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    required
                    style={{ width: '100%', padding: 10, fontSize: 14, marginBottom: 12, borderRadius: 6, border: '1px solid var(--border, #e2e8f0)', background: '#fff' }}
                  >
                    <option value="">-- Choose Staff --</option>
                    {staffs.map(s => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
                    Enter your password
                  </label>
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  {loginError && <span className="login-error">{loginError}</span>}
                </form>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowStaffModal(false)
                    setPassword('')
                    setStaffId('')
                    setLoginError('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="staff-login-form"
                  className="btn btn-primary"
                  disabled={!staffId || !password}
                >
                  Login
                </button>
              </div>
            </div>
          </div>
        )}

        {showChangePassword && (
          <div className="modal-overlay" onClick={(e) => e.stopPropagation()}>
            <div className="modal">
              <div className="modal-header">
                <h3>Change Password</h3>
                <button className="btn-close" onClick={() => {
                  setShowChangePassword(false)
                  setNewPassword('')
                  setConfirmPassword('')
                  setChangeError('')
                }}>×</button>
              </div>
              <div className="modal-body">
                <form id="change-password-form" onSubmit={(e) => { e.preventDefault(); handleChangePassword(); }}>
                  <p style={{ fontSize: 13, color: '#64748b', marginBottom: 16 }}>
                    Your password was set by the clinic staff. Please set a new password before continuing.
                  </p>
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
                    New password
                  </label>
                  <input
                    type="password"
                    placeholder="New password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    autoFocus
                  />
                  <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
                    Confirm password
                  </label>
                  <input
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                  />
                  {changeError && <span className="login-error">{changeError}</span>}
                </form>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setShowChangePassword(false)
                    setNewPassword('')
                    setConfirmPassword('')
                    setChangeError('')
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="change-password-form"
                  className="btn btn-primary"
                  disabled={!newPassword || !confirmPassword}
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
