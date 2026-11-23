import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQueue } from '../context/QueueContext'

export default function AdminLogin({ onLogin }) {
  const { verifyAdmin } = useQueue()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const admin = await verifyAdmin(username.trim(), password)
      if (!admin) {
        setError('Invalid admin credentials')
        setLoading(false)
        return
      }
      onLogin('admin', admin.id)
      navigate('/admin')
    } catch {
      setError('Login failed')
      setLoading(false)
    }
  }

  return (
    <div className="page login-page">
      <div className="login-card">
        <div className="login-header">
          <h1>Admin Login</h1>
          <p>Secret administration panel</p>
        </div>

        <form onSubmit={handleSubmit} className="login-form">
          <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14 }}>
            Username
          </label>
          <input
            type="text"
            placeholder="Admin username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
            autoCapitalize="words"
          />
          <label style={{ display: 'block', fontWeight: 500, marginBottom: 8, fontSize: 14, marginTop: 16 }}>
            Password
          </label>
          <input
            type="password"
            placeholder="Admin password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && <span className="login-error">{error}</span>}
          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={loading || !username || !password}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
          <p style={{ marginTop: 16, fontSize: 12, color: '#64748b', textAlign: 'center' }}>
            <Link to="/login">Back to role selection</Link>
          </p>
        </form>
      </div>
    </div>
  )
}

