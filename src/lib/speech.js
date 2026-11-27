const queue = []
let speaking = false
let watchdog = null

function clearWatchdog() {
  if (watchdog) {
    clearTimeout(watchdog)
    watchdog = null
  }
}

function speakNext() {
  clearWatchdog()
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

  let finished = false
  const done = () => {
    if (finished) return
    finished = true
    clearWatchdog()
    speaking = false
    speakNext()
  }

  utterance.onend = done
  utterance.onerror = done

  // Mobile browsers can silently drop an utterance (e.g. no user gesture) or
  // get stuck without firing onend/onerror. Force the queue to advance so a
  // single blocked utterance can't wedge every future announcement.
  const words = text.trim().split(/\s+/).length
  const estimatedMs = Math.max(5000, (words / 2.5) * 1000 + 4000)
  watchdog = setTimeout(done, estimatedMs)

  try {
    // Android Chrome can leave the synth in a paused state; resume() unsticks it.
    synth.resume()
    synth.speak(utterance)
  } catch {
    done()
  }
}

export function speakText(text) {
  if (!text || !('speechSynthesis' in window)) return
  queue.push(text)
  if (!speaking) speakNext()
}