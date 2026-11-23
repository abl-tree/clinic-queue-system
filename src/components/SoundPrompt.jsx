import { useState } from 'react'

import { speakText } from '../lib/speech'

export default function SoundPrompt() {
  const [show, setShow] = useState(() => {
    const stored = localStorage.getItem('clinic-sound-enabled-date')
    const today = new Date().toDateString()
    return stored !== today
  })

  const dismiss = () => {
    localStorage.setItem('clinic-sound-enabled-date', new Date().toDateString())
    setShow(false)
  }

  const enable = () => {
    speakText('Sound enabled')
    dismiss()
  }

  if (!show) return null

  return (
    <div className="sound-prompt-overlay" onClick={dismiss}>
      <div className="sound-prompt" onClick={e => e.stopPropagation()}>
        <div className="sound-prompt-icon">🔊</div>
        <strong>Enable Sound Announcements?</strong>
        <p>Get voice alerts when patients are called and when you start serving.</p>
        <div className="sound-prompt-actions">
          <button className="btn btn-primary" onClick={enable}>Enable Sound</button>
          <button className="btn btn-ghost" onClick={dismiss}>Dismiss</button>
        </div>
      </div>
    </div>
  )
}