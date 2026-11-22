import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { 
  collection, doc, addDoc, updateDoc, deleteDoc, 
  onSnapshot, query, where, orderBy, serverTimestamp,
  getDocs, writeBatch, setDoc, getDoc, increment
} from 'firebase/firestore'
import { db } from '../lib/firebase'
import { encrypt, decrypt } from '../lib/crypto'

const QueueContext = createContext(null)

export const doctors = []

const todayKey = () => new Date().toISOString().split('T')[0]

const sendNotification = async (hrn, title, body, data = {}) => {
  try {
    await fetch('/api/notify-patient', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hrn, title, body, data })
    })
  } catch (err) {
    console.error('Error sending notification:', err)
  }
}

export function QueueProvider({ children }) {
  const [doctors, setDoctors] = useState([])
  const [staffs, setStaffs] = useState([])
  const [queues, setQueues] = useState({})
  const [serving, setServing] = useState({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const unsubscribers = doctors.map(doctor => {
      const qRef = collection(db, 'queues', doctor.id, 'patients')
      const q = query(qRef, where('status', '==', 'waiting'), orderBy('position'))
      
      return onSnapshot(q, (snapshot) => {
        const patients = []
        snapshot.forEach(doc => {
          patients.push({ id: doc.id, ...doc.data() })
        })
        setQueues(prev => ({ ...prev, [doctor.id]: patients }))
        setLoading(false)
      }, (err) => {
        console.error(`Error listening to ${doctor.id} queue:`, err)
        setError(err.message)
        setLoading(false)
      })
    })

    return () => {
      unsubscribers.forEach(unsub => unsub())
    }
  }, [doctors])

  useEffect(() => {
    const servingRef = collection(db, 'serving')
    const servingUnsub = onSnapshot(servingRef, (snapshot) => {
      const servingData = {}
      snapshot.forEach(doc => {
        servingData[doc.id] = doc.data()
      })
      setServing(servingData)
    })

    const doctorsRef = collection(db, 'doctors')
    const doctorsUnsub = onSnapshot(doctorsRef, (snapshot) => {
      const doctorsData = []
      snapshot.forEach(doc => {
        doctorsData.push({ id: doc.id, ...doc.data() })
      })
      setDoctors(doctorsData)
    })

    const staffsRef = collection(db, 'staffs')
    const staffsUnsub = onSnapshot(staffsRef, (snapshot) => {
      const staffsData = []
      snapshot.forEach(doc => {
        staffsData.push({ id: doc.id, ...doc.data() })
      })
      setStaffs(staffsData)
    })

    return () => {
      servingUnsub()
      doctorsUnsub()
      staffsUnsub()
    }
  }, [])

  const getPatientProfile = useCallback(async (hrn) => {
    try {
      const profileRef = doc(db, 'patients', hrn)
      const snapshot = await getDoc(profileRef)
      if (snapshot.exists()) {
        return { hrn, ...snapshot.data() }
      }
      return null
    } catch (err) {
      console.error('Error fetching patient profile:', err)
      return null
    }
  }, [])

  const savePatientProfile = useCallback(async (hrn, profileData) => {
    try {
      const profileRef = doc(db, 'patients', hrn)
      await setDoc(profileRef, {
        ...profileData,
        hrn,
        updatedAt: serverTimestamp()
      }, { merge: true })
    } catch (err) {
      console.error('Error saving patient profile:', err)
      throw err
    }
  }, [])

  const addDoctor = useCallback(async (doctorData) => {
    try {
      const { name, specialty, password } = doctorData
      const encryptedPassword = password ? await encrypt(password) : undefined
      const doctorsRef = collection(db, 'doctors')
      const docRef = await addDoc(doctorsRef, {
        name,
        specialty,
        password: encryptedPassword,
        mustChangePassword: true,
        createdAt: serverTimestamp()
      })
      return docRef.id
    } catch (err) {
      console.error('Error adding doctor:', err)
      throw err
    }
  }, [])

  const updateDoctor = useCallback(async (doctorId, updates) => {
    try {
      const doctorRef = doc(db, 'doctors', doctorId)
      await updateDoc(doctorRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error updating doctor:', err)
      throw err
    }
  }, [])

  const resetDoctorPassword = useCallback(async (doctorId, password) => {
    try {
      const encryptedPassword = password ? await encrypt(password) : undefined
      const doctorRef = doc(db, 'doctors', doctorId)
      await updateDoc(doctorRef, {
        password: encryptedPassword,
        passwordUpdatedAt: serverTimestamp(),
        mustChangePassword: true,
        updatedAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error resetting doctor password:', err)
      throw err
    }
  }, [])

  const changeDoctorPassword = useCallback(async (doctorId, password) => {
    try {
      const encryptedPassword = password ? await encrypt(password) : undefined
      const doctorRef = doc(db, 'doctors', doctorId)
      await updateDoc(doctorRef, {
        password: encryptedPassword,
        passwordUpdatedAt: serverTimestamp(),
        mustChangePassword: false,
        updatedAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error changing doctor password:', err)
      throw err
    }
  }, [])

  const changeStaffPassword = useCallback(async (staffId, password) => {
    try {
      const encryptedPassword = password ? await encrypt(password) : undefined
      const staffRef = doc(db, 'staffs', staffId)
      await updateDoc(staffRef, {
        password: encryptedPassword,
        passwordUpdatedAt: serverTimestamp(),
        mustChangePassword: false,
        updatedAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error changing staff password:', err)
      throw err
    }
  }, [])

  const deleteDoctor = useCallback(async (doctorId) => {
    try {
      const doctorRef = doc(db, 'doctors', doctorId)
      await deleteDoc(doctorRef)
    } catch (err) {
      console.error('Error deleting doctor:', err)
      throw err
    }
  }, [])

  const addStaff = useCallback(async (staffData) => {
    try {
      const { name, role } = staffData
      const encryptedPassword = await encrypt('staff1234')
      const staffsRef = collection(db, 'staffs')
      await addDoc(staffsRef, {
        name,
        role,
        password: encryptedPassword,
        mustChangePassword: true,
        createdAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error adding staff:', err)
      throw err
    }
  }, [])

  const updateStaff = useCallback(async (staffId, updates) => {
    try {
      const staffRef = doc(db, 'staffs', staffId)
      await updateDoc(staffRef, {
        ...updates,
        updatedAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error updating staff:', err)
      throw err
    }
  }, [])

  const deleteStaff = useCallback(async (staffId) => {
    try {
      const staffRef = doc(db, 'staffs', staffId)
      await deleteDoc(staffRef)
    } catch (err) {
      console.error('Error deleting staff:', err)
      throw err
    }
  }, [])

  const verifyAdmin = useCallback(async (username, password) => {
    try {
      const adminsRef = collection(db, 'admins')
      const q = query(adminsRef, where('username', '==', username))
      const snapshot = await getDocs(q)
      if (snapshot.empty) return null
      const adminDoc = snapshot.docs[0]
      const adminData = { id: adminDoc.id, ...adminDoc.data() }
      if (!adminData.password) return null
      const storedPassword = await decrypt(adminData.password)
      if (storedPassword === password) {
        return adminData
      }
      return null
    } catch (err) {
      console.error('Error verifying admin:', err)
      return null
    }
  }, [])

  const addAdmin = useCallback(async (username, password) => {
    try {
      const encryptedPassword = password ? await encrypt(password) : undefined
      const adminsRef = collection(db, 'admins')
      const q = query(adminsRef, where('username', '==', username))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) throw new Error('Admin already exists')
      await addDoc(adminsRef, {
        username,
        password: encryptedPassword,
        createdAt: serverTimestamp()
      })
    } catch (err) {
      console.error('Error adding admin:', err)
      throw err
    }
  }, [])

  const addPatient = useCallback(async (doctorId, patientData) => {
    try {
      const { hrn, name, contact, reason } = patientData
      
      // Save/update patient profile
      if (hrn) {
        await savePatientProfile(hrn, { name, contact })
      }

      const queueRef = collection(db, 'queues', doctorId, 'patients')
      const q = query(queueRef, where('status', '==', 'waiting'), orderBy('position', 'desc'))
      
      let position = 0
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        position = (snapshot.docs[0].data().position || 0) + 1
      }

      // Daily queue counter (resets at midnight)
      const counterRef = doc(db, 'queueCounters', todayKey())
      const counterSnap = await getDoc(counterRef)
      let queueNumber = 1
      if (counterSnap.exists()) {
        queueNumber = (counterSnap.data().count || 0) + 1
        await updateDoc(counterRef, { count: queueNumber, updatedAt: serverTimestamp() })
      } else {
        await setDoc(counterRef, { count: queueNumber, date: todayKey(), createdAt: serverTimestamp(), updatedAt: serverTimestamp() })
      }

      const newPatient = {
        hrn,
        name,
        contact,
        reason,
        doctorId,
        status: 'waiting',
        position,
        queueNumber,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      }

      await addDoc(queueRef, newPatient)

      const doctor = doctors.find(d => d.id === doctorId)
      await sendNotification(
        hrn,
        doctor ? `Clinic Queue - Dr. ${doctor.name}` : 'Clinic Queue',
        `You've been added to the queue (${doctor ? doctor.name : 'your doctor'}). Queue #${queueNumber || '—'}`,
        { doctorId, queueNumber: String(queueNumber || ''), type: 'queued' }
      )
    } catch (err) {
      console.error('Error adding patient:', err)
      throw err
    }
  }, [savePatientProfile, doctors])

  const serveNext = useCallback(async (doctorId) => {
    try {
      const queueRef = collection(db, 'queues', doctorId, 'patients')
      const q = query(queueRef, where('status', '==', 'waiting'), orderBy('position'), orderBy('createdAt'))
      
      const snapshot = await getDocs(q)
      if (snapshot.empty) return

      const nextPatientDoc = snapshot.docs[0]
      const nextPatient = { id: nextPatientDoc.id, ...nextPatientDoc.data() }

      const servingRef = doc(db, 'serving', doctorId)
      const currentServingSnap = await getDoc(servingRef)
      if (currentServingSnap.exists()) {
        const currentServing = currentServingSnap.data()
        if (currentServing.id) {
          await updateDoc(doc(db, 'queues', doctorId, 'patients', currentServing.id), {
            status: 'completed',
            updatedAt: serverTimestamp()
          })
        }
      }

      await deleteDoc(servingRef)

      await updateDoc(doc(db, 'queues', doctorId, 'patients', nextPatientDoc.id), {
        status: 'serving',
        updatedAt: serverTimestamp()
      })

      await setDoc(doc(db, 'serving', doctorId), {
        ...nextPatient,
        startedAt: serverTimestamp()
      })

      const doctor = doctors.find(d => d.id === doctorId)
      await sendNotification(
        nextPatient.hrn,
        doctor ? `Clinic Queue - Dr. ${doctor.name}` : 'Clinic Queue',
        `It's your turn! Dr. ${doctor ? doctor.name : 'your doctor'} is now seeing you.`,
        { doctorId, type: 'serving' }
      )

    } catch (err) {
      console.error('Error serving next:', err)
      throw err
    }
  }, [doctors])

  const skipPatient = useCallback(async (doctorId) => {
    try {
      const servingRef = doc(db, 'serving', doctorId)
      const currentServingSnap = await getDoc(servingRef)
      if (!currentServingSnap.exists()) return

      const currentServing = currentServingSnap.data()
      if (!currentServing.id) return

      const queueRef = collection(db, 'queues', doctorId, 'patients')
      
      // Get the first waiting patient (position 1)
      const firstQ = query(queueRef, where('status', '==', 'waiting'), orderBy('position'), orderBy('createdAt'))
      const firstSnapshot = await getDocs(firstQ)

      // Swap positions: serving patient goes to position 1 waiting,
      // first waiting patient becomes serving immediately
      if (!firstSnapshot.empty) {
        const firstPatientDoc = firstSnapshot.docs[0]
        const firstPatientPos = firstPatientDoc.data().position || 0

        // Move current serving patient to position 1
        await updateDoc(doc(db, 'queues', doctorId, 'patients', currentServing.id), {
          status: 'waiting',
          position: 1,
          updatedAt: serverTimestamp()
        })

        // Shift all waiting patients down by 1 position
        const allQ = query(queueRef, where('status', '==', 'waiting'), orderBy('position'), orderBy('createdAt'))
        const allSnapshot = await getDocs(allQ)
        const batch = writeBatch(db)
        allSnapshot.forEach(doc => {
          const data = doc.data()
          const currentPos = data.position || 0
          if (currentPos > 1) {
            batch.update(doc.ref, { position: currentPos + 1, updatedAt: serverTimestamp() })
          }
        })
        await batch.commit()

        // Serve the first waiting patient immediately
        await updateDoc(doc(db, 'queues', doctorId, 'patients', firstPatientDoc.id), {
          status: 'serving',
          updatedAt: serverTimestamp()
        })

        await setDoc(doc(db, 'serving', doctorId), {
          ...firstPatientDoc.data(),
          id: firstPatientDoc.id,
          startedAt: serverTimestamp()
        })

        const doctor = doctors.find(d => d.id === doctorId)
        await sendNotification(
          firstPatientDoc.data().hrn,
          doctor ? `Clinic Queue - Dr. ${doctor.name}` : 'Clinic Queue',
          `It's your turn! Dr. ${doctor ? doctor.name : 'your doctor'} is now seeing you.`,
          { doctorId, type: 'serving' }
        )
      } else {
        // No waiting patients: just move serving patient to position 1 waiting
        await updateDoc(doc(db, 'queues', doctorId, 'patients', currentServing.id), {
          status: 'waiting',
          position: 1,
          updatedAt: serverTimestamp()
        })
        await deleteDoc(servingRef)
      }

    } catch (err) {
      console.error('Error skipping patient:', err)
      throw err
    }
  }, [doctors])

  const donePatient = useCallback(async (doctorId) => {
    try {
      const servingRef = doc(db, 'serving', doctorId)
      const currentServingSnap = await getDoc(servingRef)
      if (!currentServingSnap.exists()) return

      const currentServing = currentServingSnap.data()
      if (!currentServing.id) return

      const queueRef = collection(db, 'queues', doctorId, 'patients')

      // Mark current patient as completed
      await updateDoc(doc(db, 'queues', doctorId, 'patients', currentServing.id), {
        status: 'completed',
        updatedAt: serverTimestamp()
      })

      // Remove from serving
      await deleteDoc(servingRef)

      // Immediately serve the next waiting patient
      const nextQ = query(queueRef, where('status', '==', 'waiting'), orderBy('position'), orderBy('createdAt'))
      const nextSnapshot = await getDocs(nextQ)
      if (!nextSnapshot.empty) {
        const nextPatientDoc = nextSnapshot.docs[0]
        const nextPatient = { id: nextPatientDoc.id, ...nextPatientDoc.data() }

        await updateDoc(doc(db, 'queues', doctorId, 'patients', nextPatientDoc.id), {
          status: 'serving',
          updatedAt: serverTimestamp()
        })

        await setDoc(doc(db, 'serving', doctorId), {
          ...nextPatient,
          startedAt: serverTimestamp()
        })

        const doctor = doctors.find(d => d.id === doctorId)
        await sendNotification(
          nextPatient.hrn,
          doctor ? `Clinic Queue - Dr. ${doctor.name}` : 'Clinic Queue',
          `It's your turn! Dr. ${doctor ? doctor.name : 'your doctor'} is now seeing you.`,
          { doctorId, type: 'serving' }
        )
      }

    } catch (err) {
      console.error('Error completing patient:', err)
      throw err
    }
  }, [doctors])

  const removePatient = useCallback(async (doctorId, patientId) => {
    try {
      await deleteDoc(doc(db, 'queues', doctorId, 'patients', patientId))
    } catch (err) {
      console.error('Error removing patient:', err)
      throw err
    }
  }, [])

  const clearQueue = useCallback(async (doctorId) => {
    try {
      const queueRef = collection(db, 'queues', doctorId, 'patients')
      const q = query(queueRef, where('status', 'in', ['waiting', 'serving']))
      const snapshot = await getDocs(q)
      
      const batch = writeBatch(db)
      snapshot.forEach(doc => {
        batch.delete(doc.ref)
      })
      await batch.commit()
      
      await deleteDoc(doc(db, 'serving', doctorId))

      // Reset daily queue counter
      const counterRef = doc(db, 'queueCounters', todayKey())
      await setDoc(counterRef, { count: 0, date: todayKey(), updatedAt: serverTimestamp() }, { merge: true })
    } catch (err) {
      console.error('Error clearing queue:', err)
      throw err
    }
  }, [])

  const getPatientView = useCallback((patientId) => {
    const hrn = patientId.toUpperCase()
    for (const [doctorId, queue] of Object.entries(queues)) {
      const patient = queue.find(p => p.id === patientId || p.hrn === hrn)
      if (patient) {
        return { ...patient, doctorId, queueLength: queue.length }
      }
      if (serving[doctorId]?.id === patientId || serving[doctorId]?.hrn === hrn) {
        return { ...serving[doctorId], doctorId, status: 'serving', queueLength: queue.length }
      }
    }
    return null
  }, [queues, serving])

  const value = {
    doctors,
    staffs,
    queues,
    serving,
    loading,
    error,
    addPatient,
    addDoctor,
    updateDoctor,
    resetDoctorPassword,
    changeDoctorPassword,
    changeStaffPassword,
    deleteDoctor,
    addStaff,
    updateStaff,
    deleteStaff,
    verifyAdmin,
    addAdmin,
    serveNext,
    skipPatient,
    donePatient,
    removePatient,
    clearQueue,
    getPatientView,
    getPatientProfile,
    savePatientProfile
  }

  return <QueueContext.Provider value={value}>{children}</QueueContext.Provider>
}

export function useQueue() {
  const context = useContext(QueueContext)
  if (!context) throw new Error('useQueue must be used within QueueProvider')
  return context
}