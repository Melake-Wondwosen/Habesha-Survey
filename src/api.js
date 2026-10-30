import { API_URL, DEMO, REQUEST_TIMEOUT_MS } from './config'
import { getQueue, getUser, setQueue, setQueueWhy } from './storage'

// Apps Script answers with an HTML page when the deployment is misconfigured.
// Turn that into something a BA (or whoever they call) can act on.
function explainHtml(text) {
  const head = text.slice(0, 800).toLowerCase()
  if (head.includes('authoriz') || head.includes('authoris') || head.includes('permission')) {
    return 'The script needs re-authorising. Open Apps Script, run any function once and accept the permissions.'
  }
  if (head.includes('accounts.google.com') || head.includes('sign in') || head.includes('you need access') || head.includes('servicelogin')) {
    return 'The deployment is not open to everyone. Set "Who has access" to Anyone and redeploy.'
  }
  if (head.includes('script function not found') || head.includes('dopost') || head.includes('not found')) {
    return 'The deployment was not updated to the new version. In Apps Script use Deploy > Manage deployments > Edit > New version.'
  }
  return 'The server sent an error page instead of data. Check the Apps Script deployment.'
}

export async function post(action, payload = {}, timeoutMs = REQUEST_TIMEOUT_MS) {
  if (DEMO) {
    const { demoCall } = await import('./demo')
    return demoCall(action, payload)
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res
  try {
    // text/plain keeps this a CORS "simple request": no OPTIONS preflight,
    // which Apps Script cannot answer. Do not change it to application/json.
    res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, ...payload }),
      redirect: 'follow',
      signal: controller.signal,
    })
  } catch (err) {
    throw new Error(err.name === 'AbortError' ? 'The server took too long to answer. Weak signal?' : 'No connection. Could not reach the server.')
  } finally {
    clearTimeout(timer)
  }

  const text = await res.text()
  let data
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error(text.trim().startsWith('<') ? explainHtml(text) : 'The server sent a reply the app could not read.')
  }

  const ok = data.ok === true || data.success === true || data.status === 'success'
  if (!ok) throw new Error(data.message || data.error || 'The server rejected the request.')
  return data
}

// Same as post, with the signed-in user's token attached
const authed = (action, payload = {}) => post(action, { token: getUser()?.token, ...payload })

export function deviceLabel() {
  const ua = navigator.userAgent
  const m = ua.match(/Android [\d.]+; ([^;)]+)/) || ua.match(/(iPhone|iPad|Windows NT [\d.]+|Mac OS X [\d_]+)/)
  return (m ? m[1] || m[0] : ua).slice(0, 80)
}

// `need` = 'admin' on the admin sign-in page, so other accounts are turned away there
export async function login(username, password, location, need) {
  // Sign-in gets extra time: the first call after a quiet spell wakes Apps Script up
  const data = await post('surveyLogin', { username: username.trim(), password, location, device: deviceLabel(), need }, 45000)
  const user = data.user
  if (!user || !user.token) throw new Error('Sign-in worked but no session came back. Is Survey.gs deployed?')
  const role = ['manager', 'admin'].includes(user.role) ? user.role : 'ba'
  return { id: String(user.id), name: String(user.name), username: String(user.username), role, token: user.token }
}

export const ping = (body) => post('ping', body)
export const notifications = () => authed('notifications')
export const fetchOutlets = (version) => authed('outlets', { version })
export const requestOutlet = (req) => authed('requestOutlet', req)
export const lookupOutlet = (outletId) => authed('lookupOutlet', { outletId })
export const fetchOutletPack = (version) => authed('outletPack', { version })
export const managerData = (from, trackFrom) => authed('managerData', { from, trackFrom })
export const adminData = () => authed('adminData')
export const saveUser = (user) => authed('saveUser', { user })
export const saveOutlet = (outlet) => authed('saveOutlet', { outlet })
export const importOutlets = (rows) => authed('importOutlets', { rows })
export const resolveFlag = (id) => authed('resolveFlag', { id })
export const sendNotice = (target, title, body) => authed('sendNotice', { target, title, body })

// Fire-and-forget for when the app is being hidden or closed
export function beacon(action, body) {
  if (DEMO || !navigator.sendBeacon) return
  try {
    navigator.sendBeacon(API_URL, new Blob([JSON.stringify({ action, ...body })], { type: 'text/plain;charset=utf-8' }))
  } catch {
    // nothing to do
  }
}

export async function reportFlag(body) {
  return post('flag', body).catch(() => beacon('flag', body))
}

export const addSurvey = (survey) => post('addSurvey', { survey })

// Send everything waiting on the phone. Each survey is removed as soon as it
// lands, so one bad record never blocks the rest.
let flushing = null
export function flushQueue() {
  if (flushing) return flushing
  flushing = (async () => {
    let sent = 0
    let why = ''
    const tried = new Set()
    // Keep going while new surveys land in the queue during the upload
    for (;;) {
      const next = getQueue().find((s) => !tried.has(s.id))
      if (!next) break
      tried.add(next.id)
      try {
        await addSurvey(next)
        sent++
        setQueue(getQueue().filter((s) => s.id !== next.id))
      } catch (err) {
        why = err.message
      }
    }
    setQueueWhy(why)
    return { sent, left: getQueue().length, why }
  })().finally(() => {
    flushing = null
  })
  return flushing
}
