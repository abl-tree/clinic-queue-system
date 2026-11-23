const queue = []
let speaking = false

function speakNext() {
  if (queue.length === 0) {
    speaking = false
    return
  }
  speaking = true
  const text = queue.shift()
  const synth = window.speechSynthesis
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = 1
  utterance.pitch = 1
  utterance.volume = 1
  utterance.onend = () => {
    speaking = false
    speakNext()
  }
  utterance.onerror = () => {
    speaking = false
    speakNext()
  }
  synth.speak(utterance)
}

export function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return
  queue.push(text)
  if (!speaking) speakNext()
}
