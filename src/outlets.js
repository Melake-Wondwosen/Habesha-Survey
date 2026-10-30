import { fetchOutlets, lookupOutlet } from './api'

// The outlet list lives on the phone so BAs can pick outlets without signal.
// Each entry is [id, name, lat, lng]. It refreshes whenever the server says
// the list has changed.
const KEY = 'outlets_cache_v2'
let cache = null
const subs = new Set()

function load() {
  if (cache) return cache
  try {
    cache = JSON.parse(localStorage.getItem(KEY)) || { version: '', list: [] }
  } catch {
    cache = { version: '', list: [] }
  }
  return cache
}

export const outletList = () => load().list
export const outletVersion = () => load().version
export function onOutlets(fn) {
  subs.add(fn)
  return () => subs.delete(fn)
}

let syncing = null
// Resolves true if a new list came in. Throws only when `strict` is set, so the
// Sync button can tell the BA it failed.
export function syncOutlets(serverVersion, strict = false) {
  if (serverVersion && serverVersion === load().version) return Promise.resolve(false)
  if (syncing) return syncing
  syncing = fetchOutlets(load().version)
    .then((d) => {
      if (d.same) return false
      cache = { version: d.version, list: d.list || [] }
      try {
        localStorage.setItem(KEY, JSON.stringify(cache))
      } catch {
        // storage full; keep it in memory
      }
      subs.forEach((fn) => fn())
      return true
    })
    .catch((err) => {
      if (strict) throw err
      return false
    })
    .finally(() => {
      syncing = null
    })
  return syncing
}

export function distanceM(a, b) {
  const R = 6371000
  const rad = Math.PI / 180
  const dLat = (b.lat - a.lat) * rad
  const dLng = (b.lng - a.lng) * rad
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

const hasCoords = (o) => o[2] !== '' && o[2] != null && o[3] !== '' && o[3] != null

// Outlets within `radius` metres of the fix, closest first
export function nearbyOutlets(fix, radius) {
  if (!fix) return []
  const out = []
  for (const o of load().list) {
    if (!hasCoords(o)) continue
    const d = distanceM(fix, { lat: Number(o[2]), lng: Number(o[3]) })
    if (d <= radius) out.push({ outletId: o[0], outletName: o[1], distance: Math.round(d) })
  }
  return out.sort((a, b) => a.distance - b.distance)
}

export const unlocatedCount = () => load().list.filter((o) => !hasCoords(o)).length

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()

export function matches(o, query) {
  const q = norm(query)
  if (!q) return true
  const qId = String(query).trim().toUpperCase()
  return o.outletId.includes(qId) || norm(o.outletName).includes(q)
}

// Outlets that have no coordinates yet can't be found by range, so they stay
// reachable by search until the admin adds their location.
export function searchUnlocated(query, limit = 6) {
  if (!norm(query)) return []
  return load()
    .list.filter((o) => !hasCoords(o))
    .map((o) => ({ outletId: o[0], outletName: o[1], distance: null }))
    .filter((o) => matches(o, query))
    .slice(0, limit)
}

// Outlet ID lookup against the National Outlet data on the server. Found
// outlets are kept on the phone, so an outlet surveyed before still fills in
// without signal.
const LOOKUP_KEY = 'outlet_lookup_v1'
function lookupCache() {
  try {
    return JSON.parse(localStorage.getItem(LOOKUP_KEY)) || {}
  } catch {
    return {}
  }
}

export const normOutletId = (id) => String(id || '').trim().toUpperCase()

// Resolves { found: true, outlet } or { found: false }. Throws when the server
// can't be reached and the outlet isn't cached.
export async function findOutlet(id) {
  const key = normOutletId(id)
  const cached = lookupCache()[key]
  try {
    const d = await lookupOutlet(key)
    if (d.found) {
      const all = lookupCache()
      all[key] = d.outlet
      const keys = Object.keys(all)
      if (keys.length > 500) keys.slice(0, keys.length - 500).forEach((k) => delete all[k])
      try {
        localStorage.setItem(LOOKUP_KEY, JSON.stringify(all))
      } catch {
        // storage full; skip caching
      }
      return { found: true, outlet: d.outlet }
    }
    return { found: false }
  } catch (err) {
    if (cached) return { found: true, outlet: cached }
    throw err
  }
}
