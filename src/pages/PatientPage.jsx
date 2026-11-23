import { useState, useEffect, Fragment } from 'react'
import { useQueue } from '../context/QueueContext'
import { Link, useSearchParams } from 'react-router-dom'
import { registerPush } from '../lib/push'

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

export default function PatientPage() {
  const { doctors, getPatientView } = useQueue()
  const [searchParams] = useSearchParams()
  const [patientId, setPatientId] = useState('')
  const [view, setView] = useState(null)
  const [searched, setSearched] = useState(false)
  const [isSearching, setIsSearching] = useState(false)
  const [searchKey, setSearchKey] = useState(0)

  useEffect(() => {
    const hrnParam = searchParams.get('hrn')
    const registerParam = searchParams.get('registerPush')
    if (hrnParam && registerParam === '1') {
      setPatientId(hrnParam.trim().toUpperCase())
      setSearched(true)
      setIsSearching(true)
      registerPush(hrnParam.trim().toUpperCase(), 'patient')
    }
  }, [searchParams, registerPush])

  useEffect(() => {
    if (!searched || !patientId) return
    
    let mounted = true
    setIsSearching(true)
    
    const data = getPatientView(patientId.trim().toUpperCase())
    
    if (mounted) {
      setView(data)
      setIsSearching(false)
    }
    
    return () => { mounted = false }
  }, [searchKey, searched, patientId, getPatientView])

  const handleSubmit = (e) => {
    e.preventDefault()
    if (patientId.trim()) {
      setSearched(true)
      setIsSearching(true)
      setSearchKey(k => k + 1)
      registerPush(patientId.trim().toUpperCase(), 'patient')
    }
  }

  const clearSearch = () => {
    setPatientId('')
    setView(null)
    setSearched(false)
    setIsSearching(false)
  }

  const doctor = view ? doctors.find(d => d.id === view.doctorId) : null
  const queueNumber = view?.queueNumber
  const position = view?.position
  const queueLength = view?.queueLength
  const isServing = view?.status === 'serving'
  const isWaiting = view?.status === 'waiting'

  return (
    <div className="page patient-page">
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Breadcrumb items={[{ label: 'Patient', link: '/patient' }]} />
          <div>
            <h1>Queue Status Lookup</h1>
            <p className="subtitle">Enter your HRN to check your queue position and doctor</p>
          </div>
        </div>
      </header>

      <main className="patient-main">
        <section className="card search-section" aria-labelledby="search-heading">
          <h2 id="search-heading" className="section-title">Search by HRN</h2>
          
          <form onSubmit={handleSubmit} className="search-form" noValidate>
            <div className="search-input-group">
              <label htmlFor="hrn-input" className="visually-hidden">Hospital Registration Number (HRN)</label>
              <div className="input-wrapper">
                <span className="input-icon" aria-hidden="true">🔍</span>
                <input
                  id="hrn-input"
                  type="text"
                  placeholder="Enter your HRN (e.g., HRN-2024-00123)"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value.toUpperCase())}
                  autoFocus
                  autoComplete="off"
                  disabled={isSearching}
                  className={searched ? 'has-value' : ''}
                />
                {patientId && !isSearching && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={clearSearch}
                    aria-label="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
            
            <div className="search-actions">
              <button 
                type="submit" 
                className="btn btn-primary btn-search"
                disabled={isSearching || !patientId.trim()}
              >
                {isSearching ? (
                  <>
                    <span className="loading-spinner" aria-hidden="true"></span>
                    Searching...
                  </>
                ) : (
                  'Check Queue Status'
                )}
              </button>
              
              {searched && (
                <button
                  type="button"
                  className="btn btn-ghost btn-clear"
                  onClick={clearSearch}
                >
                  New Search
                </button>
              )}
            </div>
          </form>

          <div className="search-hint">
            <span className="hint-icon" aria-hidden="true">ℹ️</span>
            <span>Your HRN can be found on your registration card or appointment slip</span>
          </div>
        </section>

        {searched && isSearching && (
          <section className="card loading-section" aria-live="polite">
            <div className="loading-state">
              <div className="loading-spinner large" aria-hidden="true"></div>
              <p>Looking up your queue information...</p>
            </div>
          </section>
        )}

        {searched && !isSearching && view && (
          <section className="card result-section" aria-labelledby="result-heading">
            <header className="result-header">
              <div className="result-status">
                <span className={`status-badge ${view.status}`}>
                  {view.status === 'serving' ? 'Now Serving' : 
                   view.status === 'waiting' ? 'Waiting' : view.status}
                </span>
              </div>
              <div className="result-doctor">
                <span className="doctor-label">Your Doctor</span>
                <span className="doctor-name">{doctor?.name || 'Unknown'}</span>
                {doctor?.specialty && <span className="doctor-specialty">{doctor.specialty}</span>}
              </div>
            </header>

            <div className="result-main">
              <div className="queue-position-card">
                <div className="queue-number-display">
                  <span className="queue-number-label">Queue Number</span>
                  <span className="queue-number-value">#{queueNumber || '—'}</span>
                </div>
                
                {isWaiting && (
                  <div className="position-display">
                    <span className="position-label">Your Position</span>
                    <div className="position-visual">
                      <span className="position-value">{position + 1}</span>
                      <span className="position-total">of {queueLength}</span>
                    </div>
                    <div className="position-bar">
                      <div 
                        className="position-progress" 
                        style={{ width: `${((position + 1) / queueLength) * 100}%` }}
                        role="progressbar"
                        aria-valuenow={position + 1}
                        aria-valuemin={1}
                        aria-valuemax={queueLength}
                        aria-label={`Position ${position + 1} of ${queueLength}`}
                      ></div>
                    </div>
                    <p className="wait-message">
                      {position === 0 ? 'You are next!' : `${position} patient(s) ahead of you`}
                    </p>
                  </div>
                )}

                {isServing && (
                  <div className="serving-display">
                    <span className="serving-badge-large">NOW SERVING</span>
                    <p className="serving-message">Please proceed to the consultation room</p>
                  </div>
                )}
              </div>

              <div className="patient-info-card">
                <h3 className="info-title">Patient Details</h3>
                <dl className="info-list">
                  <div className="info-row">
                    <dt>Name</dt>
                    <dd>{view.name || 'Not provided'}</dd>
                  </div>
                  <div className="info-row">
                    <dt>HRN</dt>
                    <dd className="hrn-value">{view.hrn}</dd>
                  </div>
                  {view.reason && (
                    <div className="info-row">
                      <dt>Reason for Visit</dt>
                      <dd>{view.reason}</dd>
                    </div>
                  )}
                  <div className="info-row">
                    <dt>Registered</dt>
                    <dd>{view.timestamp}</dd>
                  </div>
                </dl>
              </div>
            </div>
          </section>
        )}

        {searched && !isSearching && !view && (
          <section className="card not-found-section" aria-labelledby="not-found-heading">
            <div className="not-found-content">
              <div className="not-found-icon" aria-hidden="true">🔍</div>
              <h2 id="not-found-heading">No Active Queue Found</h2>
              <p>No active queue entry found for <strong>{patientId.toUpperCase()}</strong>.</p>
              <div className="not-found-suggestions">
                <p>This could mean:</p>
                <ul>
                  <li>You haven't been added to a queue yet</li>
                  <li>Your appointment has been completed</li>
                  <li>The HRN was entered incorrectly</li>
                </ul>
              </div>
              <button 
                type="button" 
                className="btn btn-primary"
                onClick={clearSearch}
              >
                Try Another HRN
              </button>
              <p className="not-found-help">If you believe this is an error, please check with the front desk.</p>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}