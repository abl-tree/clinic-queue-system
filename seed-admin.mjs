import { initializeApp, cert } from 'firebase-admin/app'
import { getFirestore, FieldValue } from 'firebase-admin/firestore'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// Load .env manually
function loadEnv() {
  const envPath = path.resolve(__dirname, '.env')
  if (!fs.existsSync(envPath)) return {}
  const lines = fs.readFileSync(envPath, 'utf8').split('\n')
  const env = {}
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIndex = trimmed.indexOf('=')
    if (eqIndex === -1) continue
    const key = trimmed.slice(0, eqIndex).trim()
    let value = trimmed.slice(eqIndex + 1).trim().replace(/^"(.*)"$/, '$1')
    // Convert literal \n to actual newlines (for private key)
    if (key.endsWith('_PRIVATE_KEY')) {
      value = value.replace(/\\n/g, '\n')
    }
    env[key] = value
  }
  return env
}

const env = loadEnv()

const serviceAccount = {
  projectId: env.FIREBASE_PROJECT_ID,
  clientEmail: env.FIREBASE_CLIENT_EMAIL,
  privateKey: env.FIREBASE_PRIVATE_KEY
}

if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
  console.error('Missing Firebase service account env vars. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY in .env')
  process.exit(1)
}

initializeApp({
  credential: cert(serviceAccount)
})

const db = getFirestore()

const ENC_KEY = env.VITE_ENCRYPTION_KEY || 'spmc-queueing-default-key-change-in-production'

async function encrypt(text) {
  const crypto = await import('crypto')
  const key = crypto.pbkdf2Sync(ENC_KEY, 'spmc-queueing-salt', 100000, 32, 'sha256')
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  const combined = Buffer.concat([iv, encrypted, authTag])
  return combined.toString('base64')
}

async function main() {
  const username = process.argv[2]
  const password = process.argv[3]

  if (!username || !password) {
    console.error('Usage: node seed-admin.mjs <username> <password>')
    process.exit(1)
  }

  // Check if admin already exists
  const adminsRef = db.collection('admins')
  const snapshot = await adminsRef.where('username', '==', username).get()
  if (!snapshot.empty) {
    console.log(`Admin "${username}" already exists.`)
    process.exit(0)
  }

  const encryptedPassword = await encrypt(password)
  await adminsRef.add({
    username,
    password: encryptedPassword,
    createdAt: FieldValue.serverTimestamp()
  })

  console.log(`Admin "${username}" created successfully.`)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
