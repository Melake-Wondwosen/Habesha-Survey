import { DEMO } from './config'

// Keeps the latest GPS fix while the app is open. Browsers can't read location
// once the app is closed or the screen is off.
let last = null
let lastError = null
let watchId = null
const listeners = new Set()

const toFix = (p) => ({
  lat: Number(p.coords.latitude.toFixed(6)),
  lng: Number(p.coords.longitude.toFixed(6)),
  accuracy: Math.round(p.coords.accuracy),
  at: p.timestamp || Date.now(),
})

const DEMO_FIX = () => ({ lat: 9.0108 + (Math.random() - 0.5) * 0.00008, lng: 38.7613 + (Math.random() - 0.5) * 0.00008, accuracy: 12, at: Date.now() })

export function locationMessage(err) {
  if (err?.code === 1) return 'Location is blocked. Turn on location in phone settings and allow it for this app, then try again.'
  if (!navigator.geolocation) return 'This phone or browser cannot share location.'
  return 'Could not get your location. Check that location is on, step near a door or window, and try again.'
}

function notify() {
  listeners.forEach((fn) => fn({ fix: last, error: lastError }))
}

export function onLocation(fn) {
  listeners.add(fn)
  fn({ fix: last, error: lastError })
  return () => listeners.delete(fn)
}

export const latestFix = () => last
export const locationError = () => lastError

export function startWatch() {
  if (watchId != null || !navigator.geolocation) return
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      last = toFix(p)
      lastError = null
      notify()
    },
    (e) => {
      if (DEMO) return
      lastError = e
      notify()
    },
    { enableHighAccuracy: true, maximumAge: 30000, timeout: 60000 },
  )
}

export function stopWatch() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId)
  watchId = null
}

function once(highAccuracy, timeout) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject({ code: 2 })
    navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: highAccuracy, timeout, maximumAge: 30000 })
  })
}

// One fresh fix. Tries GPS first, then the faster network location.
// Rejects with the browser error (code 1 = permission denied).
export async function getFix() {
  try {
    const p = await once(true, 12000).catch((e) => {
      if (e?.code === 1) throw e
      return once(false, 10000)
    })
    last = toFix(p)
    lastError = null
    notify()
    return last
  } catch (e) {
    if (DEMO) {
      last = DEMO_FIX()
      return last
    }
    lastError = e
    notify()
    throw e
  }
}
