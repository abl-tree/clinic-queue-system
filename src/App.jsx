import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { QueueProvider } from './context/QueueContext'
import LoginPage from './pages/LoginPage'
import StaffPage from './pages/StaffPage'
import DoctorPage from './pages/DoctorPage'
import PatientPage from './pages/PatientPage'
import QueueListPage from './pages/QueueListPage'
import ManageDoctorsPage from './pages/ManageDoctorsPage'
import AdminPanel from './pages/AdminPanel'
import AdminLogin from './pages/AdminLogin'
import { registerPush, onPushMessage } from './lib/push'
import './App.css'

const STORAGE_KEY = 'clinic-queue-user'

function AppRoutes() {
  const [user, setUser] = useState(null)
  const [hydrated, setHydrated] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        setUser(JSON.parse(stored))
      } catch {
        localStorage.removeItem(STORAGE_KEY)
      }
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!user) return
    const id = user.role === 'doctor' ? `doctor:${user.doctorId}` : 'staff'
    if (user.role === 'staff' || user.role === 'doctor') {
      registerPush(id, user.role)
    }
  }, [user])

  useEffect(() => {
    if (!('Notification' in window)) return
    return onPushMessage(({ title, body, icon, image, data }) => {
      new Notification(title, { body, icon, image, data })
    })
  }, [])

  useEffect(() => {
    const handleKey = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === 'A') {
        e.preventDefault()
        navigate('/admin')
      }
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [navigate])

  const login = (role, doctorId) => {
    if (user) return
    const userData = { role, doctorId }
    setUser(userData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    if (role === 'doctor') {
      navigate('/doctor')
    } else if (role === 'staff') {
      navigate('/staff')
    } else if (role === 'admin') {
      navigate('/admin')
    } else {
      navigate('/patient')
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem(STORAGE_KEY)
    navigate('/login')
  }

  if (!hydrated) {
    return (
      <div className="app loading" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="loading-spinner" style={{ marginBottom: 12 }}></div>
        <p style={{ color: '#64748b', fontSize: 14 }}>Loading...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="logo">
          <Link to="/" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer' }}>🏥 Clinic Queue</Link>
        </div>
        {user ? (
          <div className="user-info">
            <a href="/queue" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit', cursor: 'pointer', marginRight: 16 }}>📋 Queue Window</a>
            <span style={{ marginLeft: 16 }}>{user.role === 'doctor' ? 'Dr. View' : user.role === 'staff' ? 'Staff Station' : 'Patient View'}</span>
            <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
          </div>
        ) : (
          <a href="/queue" target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none', color: 'inherit' }}>
            <button className="btn btn-ghost btn-sm">Queue Window</button>
          </a>
        )}
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={
            user && user.role === 'admin' ? <Navigate to="/admin" replace />
              : user && user.role === 'staff' ? <StaffPage />
                : user && user.role === 'doctor' ? <DoctorPage doctorId={user.doctorId} />
                  : user && user.role === 'patient' ? <PatientPage />
                    : <QueueListPage />
          } />
          <Route path="/queue" element={<QueueListPage />} />
          <Route path="/login" element={
            user ? <Navigate to="/" replace /> : <LoginPage onLogin={login} />
          } />
          {user && user.role === 'staff' && <Route path="/staff" element={<StaffPage />} />}
          {user && user.role === 'staff' && <Route path="/staff/manage-doctors" element={<ManageDoctorsPage />} />}
          <Route path="/admin" element={
            user && user.role === 'admin' ? <AdminPanel />
              : user ? <Navigate to="/" replace />
                : <AdminLogin onLogin={login} />
          } />
          {user && user.role === 'patient' && <Route path="/patient" element={<PatientPage />} />}
          {!user ? (
            <Route path="*" element={<Navigate to="/login" replace />} />
          ) : (
            <Route path="*" element={<Navigate to="/" replace />} />
          )}
        </Routes>
      </main>
    </div>
  )
}

function App() {
  return (
    <QueueProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueueProvider>
  )
}

export default App
