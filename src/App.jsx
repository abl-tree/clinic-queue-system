import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
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
    const userData = { role, doctorId }
    setUser(userData)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(userData))
    if (role === 'doctor') {
      navigate(`/doctor/${doctorId}`)
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
    return <div className="app loading">Loading...</div>
  }

  return (
    <div className="app">
      <header className="top-bar">
        <div className="logo">🏥 Clinic Queue</div>
        {user ? (
          <div className="user-info">
            <span>{user.role === 'doctor' ? 'Dr. View' : user.role === 'staff' ? 'Staff Station' : 'Patient View'}</span>
            <button onClick={logout} className="btn btn-ghost btn-sm">Logout</button>
          </div>
        ) : null}
      </header>
      <main className="main-content">
        <Routes>
          <Route path="/" element={
            user && user.role === 'admin' ? <Navigate to="/admin" replace />
              : user && user.role === 'staff' ? <StaffPage />
                : user && user.role === 'doctor' ? <Navigate to={`/doctor/${user.doctorId}`} replace />
                  : user && user.role === 'patient' ? <PatientPage />
                    : <QueueListPage />
          } />
          <Route path="/login" element={<LoginPage onLogin={login} />} />
          {user && user.role === 'staff' && <Route path="/staff" element={<StaffPage />} />}
          {user && user.role === 'staff' && <Route path="/staff/manage-doctors" element={<ManageDoctorsPage />} />}
          {user && user.role === 'staff' && <Route path="/staff/manage-doctors" element={<ManageDoctorsPage />} />}
          <Route path="/admin" element={
            user && user.role === 'admin' ? <AdminPanel /> : <AdminLogin onLogin={login} />
          } />
          {user && user.role === 'doctor' && <Route path="/doctor/:doctorId" element={<DoctorPage />} />}
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
