const ENC_KEY = import.meta.env.VITE_ENCRYPTION_KEY || 'spmc-queueing-default-key-change-in-production'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

let cryptoKey = null

const getKey = async () => {
  if (cryptoKey) return cryptoKey
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(ENC_KEY),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )
  cryptoKey = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('spmc-queueing-salt'),
      iterations: 100000,
      hash: 'SHA-256'
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
  return cryptoKey
}

export const encrypt = async (text) => {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = encoder.encode(text)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  const combined = new Uint8Array(iv.length + ciphertext.byteLength)
  combined.set(iv)
  combined.set(new Uint8Array(ciphertext), iv.length)
  return btoa(String.fromCharCode(...combined))
}

export const decrypt = async (encryptedText) => {
  if (!encryptedText) return ''
  const key = await getKey()
  const combined = new Uint8Array(atob(encryptedText).split('').map(c => c.charCodeAt(0)))
  const iv = combined.slice(0, 12)
  const ciphertext = combined.slice(12)
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext)
  return decoder.decode(decrypted)
}
