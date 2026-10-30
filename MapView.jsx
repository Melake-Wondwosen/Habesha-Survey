import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { topBrand, text } from './calc'
import { DEMO } from '../config'

const ADDIS = [9.0108, 38.7613]
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

function baIcon(ba, selected) {
  const initials = ba.name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const color = ba.online ? '#c9a24a' : '#000'
  return L.divIcon({
    className: '',
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    html: `<div style="width:34px;height:34px;border-radius:50%;background:${color};color:${ba.online ? '#000' : '#fff'};font:600 12px/34px Calibri,system-ui,sans-serif;text-align:center;border:3px solid ${selected ? '#c9a24a' : '#fff'};box-shadow:0 1px 4px rgba(0,0,0,.35)">${esc(initials)}</div>`,
  })
}

export default function MapView({ team, surveys, selectedId, onSelect, now }) {
  const box = useRef(null)
  const map = useRef(null)
  const layers = useRef(null)
  const fitted = useRef(false)

  useEffect(() => {
    map.current = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(ADDIS, 12)
    // The demo preview can't load map tiles, so it draws on a plain grid instead
    if (!DEMO) {
      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19,
        subdomains: 'abcd',
        attribution: '&copy; OpenStreetMap &copy; CARTO',
      }).addTo(map.current)
    }
    layers.current = L.layerGroup().addTo(map.current)
    return () => map.current.remove()
  }, [])

  useEffect(() => {
    const g = layers.current
    g.clearLayers()
    const bounds = []

    surveys.forEach((s) => {
      const lat = Number(s.lat)
      const lng = Number(s.lng)
      if (!s.lat || !s.lng || isNaN(lat) || isNaN(lng)) return
      bounds.push([lat, lng])
      L.circleMarker([lat, lng], { radius: 5, color: '#a9832f', weight: 1, fillColor: '#c9a24a', fillOpacity: 0.85 })
        .bindPopup(`<b>${esc(text(s.outletName))}</b> ${esc(text(s.outletId))}<br>${esc(text(s.baName))} · ${new Date(s.date).toLocaleString()}<br>#1: ${esc(topBrand(s))}`)
        .addTo(g)
    })

    const sel = team.find((b) => b.id === selectedId)
    if (sel && sel.track.length > 1) {
      L.polyline(sel.track.map((p) => [p.lat, p.lng]), { color: '#000', weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(g)
      sel.track.forEach((p) =>
        L.circleMarker([p.lat, p.lng], { radius: 3, color: '#000', weight: 1, fillOpacity: 0.6 })
          .bindTooltip(`${new Date(p.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} · ${esc(p.activity)}`)
          .addTo(g),
      )
    }

    team.forEach((ba) => {
      if (ba.lat == null || ba.lng == null) return
      bounds.push([ba.lat, ba.lng])
      L.marker([ba.lat, ba.lng], { icon: baIcon(ba, ba.id === selectedId), zIndexOffset: ba.online ? 1000 : 500 })
        .bindTooltip(`<b>${esc(ba.name)}</b><br>${esc(ba.activity || '')}`, { direction: 'top', offset: [0, -16] })
        .on('click', () => onSelect(ba.id))
        .addTo(g)
    })

    if (!fitted.current && bounds.length) {
      map.current.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 })
      fitted.current = true
    }
  }, [team, surveys, selectedId, now])

  // Fly to a BA picked from the list
  useEffect(() => {
    const sel = team.find((b) => b.id === selectedId)
    if (!sel) return
    const pts = sel.track.map((p) => [p.lat, p.lng])
    if (sel.lat != null) pts.push([sel.lat, sel.lng])
    if (pts.length > 1) map.current.fitBounds(pts, { padding: [40, 40], maxZoom: 16 })
    else if (pts.length) map.current.setView(pts[0], 15)
  }, [selectedId])

  return (
    <div
      ref={box}
      className="w-full h-full min-h-[320px] rounded-2xl overflow-hidden z-0"
      style={DEMO ? { background: '#fafafa linear-gradient(rgba(0,0,0,.05) 1px, transparent 1px) 0 0 / 40px 40px, linear-gradient(90deg, rgba(0,0,0,.05) 1px, transparent 1px) 0 0 / 40px 40px' } : undefined}
    />
  )
}
