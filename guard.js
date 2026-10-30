import { reportFlag } from './api'
import { LOCK_DEVTOOLS } from './config'
import { getUser } from './storage'

// Stops casual tampering: blocks the menu and shortcuts that open developer
// tools, and locks the app if a debugger is attached (desktop DevTools or
// Android remote debugging over USB). A web page cannot see whether Android
// developer options are switched on, so this is a deterrent, not a guarantee.

let locked = false
const listeners = new Set()

export const isLocked = () => locked
export function onLock(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

function trip(detail) {
  if (locked) return
  locked = true
  listeners.forEach((fn) => fn(true))
  const u = getUser()
  if (u?.token) reportFlag({ token: u.token, baName: u.name, type: 'devtools', detail })
}

// A real statement, not new Function, so it also runs under a strict content security policy
function probe() {
  // eslint-disable-next-line no-debugger
  debugger
}

export function startGuard() {
  if (!LOCK_DEVTOOLS) return

  document.addEventListener('contextmenu', (e) => e.preventDefault())
  document.addEventListener('keydown', (e) => {
    const k = e.key?.toUpperCase()
    const ctrl = e.ctrlKey || e.metaKey
    if (k === 'F12' || (ctrl && e.shiftKey && ['I', 'J', 'C', 'K'].includes(k)) || (ctrl && k === 'U') || (e.metaKey && e.altKey && ['I', 'J', 'C'].includes(k))) {
      e.preventDefault()
      e.stopPropagation()
    }
  }, true)

  // `debugger` only pauses when developer tools are attached. A long pause = attached.
  setInterval(() => {
    const t = performance.now()
    probe()
    if (performance.now() - t > 150) trip('Debugger attached')
  }, 1500)
}
