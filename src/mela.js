import { DEMO } from './config'
import { melaLogin } from './api'
import { setUser } from './storage'

// MELA opens this app as  <app url>#mela=<ticket>. The ticket is swapped for a
// normal session here, before the app starts, and removed from the address.
export async function melaStart() {
  const m = location.hash.match(/[#&]mela=([^&]+)/)
  if (!m || DEMO) return
  history.replaceState(null, '', location.pathname + location.search)
  const tell = (msg) => { try { if (window.parent !== window) window.parent.postMessage(msg, '*') } catch { /* not in MELA */ } }
  try {
    const user = await melaLogin(decodeURIComponent(m[1]))
    setUser(user)
    tell({ mela: 'signed-in' })
  } catch (err) {
    tell({ mela: 'error', message: err.message })
  }
}
