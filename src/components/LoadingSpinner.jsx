export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div className="loading-spinner-container" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <div className="loading-spinner" style={{ marginBottom: 12 }}></div>
      <p style={{ color: '#64748b', fontSize: 14 }}>{message}</p>
    </div>
  )
}
