import { getUser } from './storage'

// Bell contents. Server notes come with pings (BA), managerData (manager) or
// adminData (admin). Local notes are things only this phone knows, such as
// uploads finishing. Read state is kept per user on the device.
let server = []
const subs = new Set()

const uid = () => getUser()?.id || 'anon'
const read = (k, d) => {
  try {
    return JSON.parse(localStorage.getItem(k)) ?? d
  } catch {
    return d
  }
}
const write = (k, v) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    // ignore
  }
}

const localKey = () => `notes_local_${uid()}`
const readKey = () => `notes_read_${uid()}`

export function allNotes() {
  return [...server, ...read(localKey(), [])].sort((a, b) => (a.date < b.date ? 1 : -1))
}

export function readIds() {
  return new Set(read(readKey(), []))
}

function emit() {
  const list = allNotes()
  const seen = readIds()
  subs.forEach((fn) => fn(list, seen))
}

export function subscribeNotes(fn) {
  subs.add(fn)
  fn(allNotes(), readIds())
  return () => subs.delete(fn)
}

export function setServerNotes(list) {
  if (!Array.isArray(list)) return
  server = list
  emit()
}

export function addLocalNote(title, body = '', kind = 'local') {
  const list = read(localKey(), [])
  list.unshift({ id: `local:${Date.now()}`, date: new Date().toISOString(), kind, title, body })
  write(localKey(), list.slice(0, 20))
  emit()
}

export function markRead(ids) {
  const seen = readIds()
  ids.forEach((id) => seen.add(id))
  write(readKey(), [...seen].slice(-400))
  emit()
}

export function clearNotesMemory() {
  server = []
}
