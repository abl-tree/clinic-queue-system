import { Link } from 'react-router-dom'
import { useQueue } from '../context/QueueContext'

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

export default function DoctorPage({ doctorId } = {}) {
  const { doctors, queues, serving, loading, serveNext, skipPatient, donePatient } = useQueue()
  const currentDoctorId = doctorId
  const doctor = doctors.find(d => d.id === currentDoctorId)
  const queue = queues[currentDoctorId] || []
  const currentServing = serving[currentDoctorId]

  if (loading) return (
    <div className="page doctor-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="loading-spinner" style={{ marginBottom: 12 }}></div>
      <p style={{ color: '#64748b', fontSize: 14 }}>Loading...</p>
    </div>
  )
  if (!doctor) return <div className="page">Doctor not found</div>

  return (
    <div className="page doctor-page">
      <header className="page-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <Breadcrumb items={[{ label: 'Home', link: '/' }, { label: 'Doctor' }]} />
          <div>
            <h1>{doctor.name}</h1>
            <span className="specialty">{doctor.specialty}</span>
          </div>
        </div>
      </header>

      {currentServing && (
        <section className="serving-window">
          <div className="serving-badge">NOW SERVING</div>
          <div className="serving-patient-info">
            <span className="patient-name">
              {currentServing.name ? currentServing.name : 'Patient'}
            </span>
            {currentServing.hrn && (
              <span className="patient-hrn">HRN: {currentServing.hrn}</span>
            )}
            {currentServing.contact && (
              <span className="patient-contact">{currentServing.contact}</span>
            )}
            {currentServing.reason && (
              <span className="patient-reason">{currentServing.reason}</span>
            )}
          </div>
          <div className="serving-actions">
            <button
              type="button"
              onClick={() => skipPatient(currentDoctorId)}
              className="btn btn-danger btn-sm"
            >
              Skip
            </button>
            <button
              type="button"
              onClick={() => donePatient(currentDoctorId)}
              className="btn btn-primary btn-sm"
            >
              Done
            </button>
          </div>
        </section>
      )}

      <section className="card queue-card">
        <div className="queue-header">
          <h2>Waiting Queue ({queue.length})</h2>
          {!currentServing && (
            <button
              onClick={() => serveNext(currentDoctorId)}
              disabled={queue.length === 0}
              className="btn btn-primary"
            >
              {queue.length > 0 ? 'Start' : 'No Patients'}
            </button>
          )}
        </div>
        <div className="queue-list">
          {queue.length === 0 ? (
            <p className="empty">No patients waiting</p>
          ) : (
            queue.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0)).map((patient, index) => (
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
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  )
}