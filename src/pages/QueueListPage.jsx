import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
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

export default function QueueListPage() {
  const { queues, serving, doctors } = useQueue()
  const [filterDoctor, setFilterDoctor] = useState('all')

  const allPatients = []
  const servingPatients = []
  for (const [doctorId, queue] of Object.entries(queues)) {
    queue.forEach(p => {
      const doc = doctors.find(d => d.id === doctorId)
      allPatients.push({
        ...p,
        doctorId,
        doctorName: doc ? doc.name : doctorId,
        status: p.status || 'waiting'
      })
    })
  }
  for (const [doctorId, s] of Object.entries(serving)) {
    const doc = doctors.find(d => d.id === doctorId)
    const existing = allPatients.find(p => p.id === s.id && p.doctorId === doctorId)
    if (!existing) {
      allPatients.push({
        ...s,
        id: s.id,
        doctorId,
        doctorName: doc ? doc.name : doctorId,
        status: 'serving'
      })
    }
    servingPatients.push({
      ...s,
      id: s.id,
      doctorId,
      doctorName: doc ? doc.name : doctorId,
      status: 'serving'
    })
  }

  const servingIds = new Set(servingPatients.map(p => p.id))

  const waitingPatients = allPatients.filter(p => p.status === 'waiting' && !servingIds.has(p.id))

  const filtered = filterDoctor === 'all'
    ? waitingPatients.sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0))
    : waitingPatients.filter(p => p.doctorId === filterDoctor).sort((a, b) => (a.queueNumber || 0) - (b.queueNumber || 0))

  return (
    <div className="page queue-list-page">
      <Breadcrumb items={[{ label: 'Queue' }]} />
      <div className="two-col">
        <div className="col now-serving">
          <div className="serving-section">
            <h3 className="serving-section-title">Now Serving</h3>
            {servingPatients.length === 0 ? (
              <p className="empty">No patients being served.</p>
            ) : (
              <div className="serving-list">
                {servingPatients.map((patient) => (
                  <div key={patient.id} className="serving-item">
                    <div className="patient-info">
                      <span className="patient-name">{patient.name || 'Patient'}</span>
                      {patient.contact && <span className="patient-contact">{patient.contact}</span>}
                      {patient.reason && <span className="patient-reason">{patient.reason}</span>}
                      {patient.doctorName && <span className="patient-doctor">with {patient.doctorName}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="col waiting-queue">
          <div className="doctor-filter">
            <select value={filterDoctor} onChange={(e) => setFilterDoctor(e.target.value)}>
              <option value="all">All Doctors</option>
              {doctors.map(d => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          {filtered.length === 0 ? (
            <p className="empty">No patients waiting in queue.</p>
          ) : (
            <div className="queue-list">
              {filtered.map((patient) => {
                const queueNumber = patient.queueNumber !== undefined ? patient.queueNumber : (patient.position !== undefined ? patient.position + 1 : '—')
                return (
                  <div key={patient.id} className={`queue-item-minimal ${patient.status}`}>
                    <span className="queue-number">#{queueNumber}</span>
                    <span className="patient-name-minimal">{patient.name || 'Patient'}</span>
                    {patient.doctorName && <span className="patient-doctor-minimal">with {patient.doctorName}</span>}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
