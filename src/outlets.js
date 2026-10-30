import { fetchOutletPack, fetchOutlets, lookupOutlet } from './api'

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

// National Outlet data for the BA's division, kept on the phone so an outlet
// ID fills in the moment it's typed, with or without signal. Pulled after
// sign-in and again when the server says the data changed, or once a day.
const PACK_KEY = 'outlet_pack_v1'
const PACK_MAX_AGE = 24 * 3600 * 1000
let pack = null // { version, at, division, dict, rows }
let packIndex = null // Map id -> row

function loadPack() {
  if (pack) return pack
  try {
    pack = JSON.parse(localStorage.getItem(PACK_KEY)) || null
  } catch {
    pack = null
  }
  return pack
}

function index() {
  if (packIndex) return packIndex
  packIndex = new Map()
  for (const r of loadPack()?.rows || []) packIndex.set(r[0], r)
  return packIndex
}

export const normOutletId = (id) => String(id || '').trim().toUpperCase()

// Instant lookup on the phone. Null when the ID isn't in the stored data.
export function localOutlet(id) {
  const r = index().get(normOutletId(id))
  if (!r) return null
  const d = pack.dict
  return { outletId: r[0], outletName: r[1], division: d[r[2]] || '', agent: d[r[3]] || '', parentTerritory: d[r[4]] || '', territory: d[r[5]] || '' }
}

export const hasPack = () => (loadPack()?.rows?.length || 0) > 0

let packSync = null
// `serverVersion` comes from the heartbeat; without it the pack refreshes when
// it's over a day old.
export function syncPack(serverVersion) {
  const cur = loadPack()
  const fresh = cur && Date.now() - cur.at < PACK_MAX_AGE
  if (cur && (serverVersion ? cur.version.split('|')[0] === serverVersion : fresh)) return Promise.resolve(false)
  if (packSync) return packSync
  packSync = fetchOutletPack(cur?.version)
    .then((d) => {
      if (d.same) {
        pack = { ...cur, at: Date.now() }
      } else {
        pack = { version: d.version, at: Date.now(), division: d.division, dict: d.dict, rows: d.rows }
        packIndex = null
      }
      try {
        localStorage.setItem(PACK_KEY, JSON.stringify(pack))
      } catch {
        // storage full: keep it in memory for this session
      }
      return true
    })
    .catch(() => false)
    .finally(() => {
      packSync = null
    })
  return packSync
}

export function clearPack() {
  pack = null
  packIndex = null
  try {
    localStorage.removeItem(PACK_KEY)
  } catch {
    // ignore
  }
}

// Phone first, then the server (for outlets outside the BA's division or
// added since the last download). Throws when neither can answer.
export async function findOutlet(id) {
  const key = normOutletId(id)
  const local = localOutlet(key)
  if (local) return { found: true, outlet: local }
  const d = await lookupOutlet(key)
  return d.found ? { found: true, outlet: d.outlet } : { found: false }
}
