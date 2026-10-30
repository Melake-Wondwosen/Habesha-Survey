// Everything this app keeps on the phone. Keys are chosen so they never clash
// with the wheel app (which uses `user`).
const USER_KEY = 'survey_user'
const QUEUE_KEY = 'offline_surveys'
const WHY_KEY = 'offline_surveys_why'
const DONE_KEY = 'surveys_done'
const SYNC_KEY = 'last_sync'
const DRAFT_KEY = 'survey_draft_v3'

// In-memory copy so the app still works where storage is blocked (private
// browsing, sandboxed previews). It just won't survive a reload there.
const mem = {}

function read(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    if (raw != null) return JSON.parse(raw)
  } catch {
    // fall through to memory
  }
  return key in mem ? mem[key] : fallback
}

function write(key, value) {
  mem[key] = value
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage full or blocked. The memory copy carries on.
  }
}

function remove(key) {
  delete mem[key]
  try {
    localStorage.removeItem(key)
  } catch {
    // ignore
  }
}

// Session. No expiry; survives closing the app.
export const getUser = () => read(USER_KEY, null)
export const setUser = (user) => write(USER_KEY, user)
// Sign-out clears the session only. The queue stays, because phones are shared
// and another BA's unsent surveys may be in it.
export const clearUser = () => remove(USER_KEY)

// Offline queue
export const getQueue = () => read(QUEUE_KEY, [])
export const setQueue = (list) => write(QUEUE_KEY, list)
export const pushQueue = (survey) => setQueue([...getQueue(), survey])
export const getQueueWhy = () => read(WHY_KEY, '')
export const setQueueWhy = (why) => (why ? write(WHY_KEY, why) : remove(WHY_KEY))

// Last time the Sync button (or the automatic sync) finished with nothing left waiting
export const getLastSync = () => read(SYNC_KEY, 0)
export const setLastSync = (ms) => write(SYNC_KEY, ms)

// Completed counter, per device, keyed by local date. Counts on submit
// whether or not the upload landed.
function todayKey() {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function countDone() {
  const done = read(DONE_KEY, {})
  done[todayKey()] = (done[todayKey()] || 0) + 1
  write(DONE_KEY, done)
}

export function getDoneCounts() {
  const done = read(DONE_KEY, {})
  const total = Object.values(done).reduce((a, b) => a + (Number(b) || 0), 0)
  return { today: done[todayKey()] || 0, total }
}

// The survey in progress. Saved after every answer, so closing the app or
// losing the page doesn't lose the work. Only the BA who started it sees it.
export function getDraft() {
  const d = read(DRAFT_KEY, null)
  const u = getUser()
  return d && u && d.baId === u.id ? d : null
}
export const setDraft = (draft) => write(DRAFT_KEY, draft)
export const clearDraft = () => remove(DRAFT_KEY)
