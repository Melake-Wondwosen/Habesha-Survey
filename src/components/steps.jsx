import { BRANDS, VISIBILITY_ITEMS } from '../config'
import { useEffect, useRef, useState } from 'react'
import { requestOutlet } from '../api'
import { latestFix } from '../location'
import { findOutlet, localOutlet, normOutletId } from '../outlets'
import { Button, Field, Notice, Sheet, Spinner, inputClass } from './ui'

export const STEP_COUNT = 4

function Title({ n, children, sub }) {
  return (
    <div className="mb-5 anim-rise">
      <p className="text-xs uppercase tracking-wider text-gold-dark font-semibold">Step {n} of {STEP_COUNT}</p>
      <h2 className="font-serif text-2xl mt-1 leading-tight">{children}</h2>
      {sub && <p className="text-sm text-ink/60 mt-1">{sub}</p>}
    </div>
  )
}

const brandLabel = (key, otherBrand) =>
  key === 'Other' && otherBrand.trim() ? otherBrand.trim() : BRANDS.find((b) => b.key === key).label

// Step 1: the BA types only the outlet ID. Name, division, agent and territory
// are filled from the National Outlet data, and the server fills them again on
// save, so a survey sent offline still gets the right details.
const DETAIL_ROWS = [
  ['division', 'Division'],
  ['agent', 'Agent'],
  ['parentTerritory', 'Parent territory'],
  ['territory', 'Territory'],
]
const CLEAR = { picked: false, offline: false, outletName: '', division: '', agent: '', parentTerritory: '', territory: '' }

export function StepOutlet({ data, set }) {
  const [state, setState] = useState(data.picked ? 'found' : data.offline ? 'offline' : 'idle') // idle | looking | found | notfound | offline
  const [asking, setAsking] = useState(false)
  const seq = useRef(0)

  function fill(id, o) {
    set({ ...CLEAR, picked: true, outletId: id, outletName: o.outletName, division: o.division, agent: o.agent, parentTerritory: o.parentTerritory, territory: o.territory })
    setState('found')
  }

  async function look(raw) {
    const id = normOutletId(raw)
    const n = ++seq.current
    if (id.length < 4) {
      setState('idle')
      return
    }
    setState('looking')
    try {
      const r = await findOutlet(id)
      if (n !== seq.current) return
      if (r.found) {
        fill(id, r.outlet)
      } else {
        setState('notfound')
      }
    } catch {
      if (n !== seq.current) return
      set({ offline: true })
      setState('offline')
    }
  }

  // Looks the ID up once the BA stops typing
  useEffect(() => {
    if (data.picked) return
    const t = setTimeout(() => look(data.outletId), 450)
    return () => clearTimeout(t)
  }, [data.outletId])

  // Outlets stored on the phone fill in on the keystroke, with no waiting
  function type(e) {
    seq.current++
    const id = e.target.value.replace(/\s+/g, '').toUpperCase()
    const o = id.length >= 4 ? localOutlet(id) : null
    if (o) return fill(id, o)
    set({ ...CLEAR, outletId: id })
    setState('idle')
  }

  if (data.picked) {
    return (
      <>
        <Title n={1}>Outlet</Title>
        <div className="anim-pop rounded-2xl bg-ink text-paper p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full gold-gradient text-ink flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
            </span>
            <div className="min-w-0">
              <p className="font-serif text-xl leading-tight">{data.outletName || 'No name in the data'}</p>
              <p className="text-gold font-semibold tracking-wide mt-1">{data.outletId}</p>
            </div>
          </div>
          <dl className="mt-4 pt-4 border-t border-paper/15 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
            {DETAIL_ROWS.map(([k, label]) => (
              <div key={k} className="contents">
                <dt className="text-paper/55">{label}</dt>
                <dd className="font-semibold min-w-0 break-words">{data[k] || '-'}</dd>
              </div>
            ))}
          </dl>
        </div>
        <Button variant="ghost" className="mt-4 btn-hover" onClick={() => { set({ ...CLEAR, outletId: '' }); setState('idle') }}>
          Change outlet
        </Button>
      </>
    )
  }

  return (
    <>
      <Title n={1} sub="Type the outlet ID. The rest fills in from the outlet data.">Outlet ID</Title>
      <div className="relative anim-rise">
        <input
          className={`${inputClass} text-xl tracking-widest font-semibold pr-12`}
          value={data.outletId}
          onChange={type}
          inputMode="numeric"
          autoComplete="off"
          autoCorrect="off"
          spellCheck="false"
          placeholder="e.g. 1237916"
          autoFocus
        />
        {state === 'looking' && (
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gold-dark">
            <Spinner />
          </span>
        )}
      </div>

      {state === 'notfound' && (
        <Notice className="mt-3">Outlet ID {normOutletId(data.outletId)} is not in the outlet data. Check the number.</Notice>
      )}
      {state === 'offline' && (
        <Notice tone="info" className="mt-3">
          No connection, so the outlet details can't be shown. You can carry on. They are filled in from the outlet data when the survey uploads.
        </Notice>
      )}

      <Button variant="quiet" className="mt-4" onClick={() => setAsking(true)}>
        Not on the list?
      </Button>
      {asking && <RequestOutlet initial={data.outletId} onClose={() => setAsking(false)} />}
    </>
  )
}

function RequestOutlet({ initial, onClose }) {
  const looksLikeId = /\d/.test(initial) && !/\s/.test(initial.trim())
  const [form, setForm] = useState({ outletName: looksLikeId ? '' : initial.trim(), outletId: looksLikeId ? initial.trim().toUpperCase() : '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const put = (k) => (e) => setForm({ ...form, [k]: k === 'outletId' ? e.target.value.toUpperCase() : e.target.value })

  async function send() {
    setBusy(true)
    setError('')
    try {
      await requestOutlet({ ...form, location: latestFix() })
      setDone(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Sheet
      title="Request outlet"
      onClose={onClose}
      footer={
        done ? (
          <Button onClick={onClose}>Close</Button>
        ) : (
          <Button variant="gold" onClick={send} disabled={busy || !form.outletName.trim()}>
            {busy ? <Spinner /> : 'Send'}
          </Button>
        )
      }
    >
      {done ? (
        <div className="anim-rise text-center py-6">
          <p className="font-serif text-xl">Request sent</p>
        </div>
      ) : (
        <>
          <Field label="Outlet name">
            <input className={inputClass} value={form.outletName} onChange={put('outletName')} autoComplete="off" />
          </Field>
          <Field label="Outlet ID">
            <input className={`${inputClass} uppercase`} value={form.outletId} onChange={put('outletId')} autoComplete="off" autoCapitalize="characters" />
          </Field>
          {error && <Notice>{error}</Notice>}
        </>
      )}
    </Sheet>
  )
}

// Step 2: tap brands in order of sales. Tapping again releases and closes the gap.
export function StepRank({ data, set }) {
  function tap(key) {
    const order = data.order.includes(key) ? data.order.filter((k) => k !== key) : [...data.order, key]
    set({ order })
  }
  const otherRanked = data.order.includes('Other')

  return (
    <>
      <Title n={2} sub="Tap in order of sales">
        Rank brands by sales
      </Title>
      <div className="space-y-2.5 stagger">
        {BRANDS.map((b, i) => {
          const rank = data.order.indexOf(b.key) + 1
          const on = rank > 0
          return (
            <button
              key={b.key}
              style={{ '--i': i }}
              type="button"
              onClick={() => tap(b.key)}
              className={`pick w-full min-h-[56px] flex items-center gap-3 rounded-2xl border px-3 text-left active:scale-[0.98] ${
                on ? 'bg-ink text-paper border-ink' : 'bg-white border-ink/15'
              }`}
            >
              <span
                className={`w-9 h-9 shrink-0 rounded-full flex items-center justify-center font-serif text-lg ${
                  on ? 'gold-gradient text-ink' : 'border-2 border-dashed border-ink/20 text-transparent'
                }`}
              >
                {on ? <span key={rank} className="anim-pop">{rank}</span> : '·'}
              </span>
              <span className="flex-1 text-[17px] font-semibold">{b.label}</span>
              {b.ours && <span className="text-[10px] font-bold tracking-widest rounded-full px-2 py-1 gold-gradient text-ink">OURS</span>}
            </button>
          )
        })}
      </div>
      {otherRanked && (
        <div className="mt-5 anim-rise">
          <Field label="Which brand is Other?">
            <input className={inputClass} value={data.otherBrand} onChange={(e) => set({ otherBrand: e.target.value })} placeholder="Brand name" autoComplete="off" />
          </Field>
        </div>
      )}
    </>
  )
}

// Step 3: weekly crates per brand. Blank means unknown, not zero.
export function StepCrates({ data, set }) {
  function put(key, value) {
    set({ crates: { ...data.crates, [key]: value } })
  }
  function bump(key, d) {
    const cur = data.crates[key]
    if (cur === '' || cur == null) {
      if (d > 0) put(key, '1')
      return
    }
    const next = Number(cur) + d
    put(key, next < 0 ? '' : String(next))
  }

  return (
    <>
      <Title n={3} sub="How many crates of each brand does this outlet sell in a week?">
        Weekly crate volume
      </Title>
      <div className="space-y-2.5 stagger">
        {data.order.map((key, i) => {
          const value = data.crates[key] ?? ''
          return (
            <div key={key} style={{ '--i': i }} className="flex items-center gap-2 rounded-2xl bg-white border border-ink/15 px-3 py-2">
              <span className="flex-1 min-w-0 text-[17px] font-semibold truncate">{brandLabel(key, data.otherBrand)}</span>
              <button type="button" onClick={() => bump(key, -1)} disabled={value === ''} className="w-11 h-11 rounded-xl bg-mist text-2xl leading-none disabled:opacity-30" aria-label="Less">
                −
              </button>
              <input
                className="w-16 h-11 rounded-xl border border-ink/15 text-center text-lg font-semibold outline-none focus:border-gold"
                inputMode="numeric"
                pattern="[0-9]*"
                value={value}
                placeholder="–"
                onChange={(e) => put(key, e.target.value.replace(/\D/g, '').replace(/^0+(?=\d)/, ''))}
              />
              <button type="button" onClick={() => bump(key, 1)} className="w-11 h-11 rounded-xl bg-ink text-paper text-2xl leading-none" aria-label="More">
                +
              </button>
            </div>
          )
        })}
      </div>
    </>
  )
}

// Line icons for the visibility tiles
const VIS_ICON = {
  ABSPoster: <><rect x="5" y="3" width="14" height="18" rx="1.5" /><path d="M8 7h8M8 11h8M8 15h5" /></>,
  PaperPoster: <><path d="M6 3h9l3 3v15H6z" /><path d="M15 3v3h3" /><path d="M9 11h6M9 15h4" /></>,
  BottleCutout: <><path d="M10 2h4v4l1.5 2.5V20a2 2 0 0 1-2 2h-3a2 2 0 0 1-2-2V8.5L10 6z" /><path d="M8.5 12h7" /></>,
  Banner: <><path d="M4 4h16v10l-8 3-8-3z" /><path d="M4 4v17M20 4v17" /></>,
  TableCloth: <><path d="M3 9h18l-2 5H5z" /><path d="M7 14v6M17 14v6" /></>,
  LEDLight: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.5.9 1.2.9 2.1h5.2c0-.9.3-1.6.9-2.1A6 6 0 0 0 12 3z" /></>,
  Fridge: <><rect x="6" y="2" width="12" height="20" rx="2" /><path d="M6 10h12M9 5v2M9 13v3" /></>,
}

// Step 4 (last): does Habesha have POSM here, and which pieces
export function StepVisibility({ data, set }) {
  const items = data.posmItems || []
  const toggle = (key) => set({ posmItems: items.includes(key) ? items.filter((k) => k !== key) : [...items, key] })
  const choose = (has) => set({ hasPosm: has, posmItems: has ? items : [] })

  return (
    <>
      <Title n={4} sub="Look around the outlet, inside and outside.">
        Does Habesha have POSM here?
      </Title>

      <div className="grid grid-cols-2 gap-3 anim-rise">
        {[
          [true, 'Yes'],
          [false, 'No'],
        ].map(([v, label]) => {
          const on = data.hasPosm === v
          return (
            <button
              key={label}
              type="button"
              onClick={() => choose(v)}
              className={`pick min-h-[60px] rounded-2xl border text-lg font-semibold active:scale-[0.98] ${
                on ? (v ? 'gold-gradient text-ink border-gold shadow-md' : 'bg-ink text-paper border-ink') : 'bg-white border-ink/15'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {data.hasPosm === true && (
        <div className="mt-6 anim-rise">
          <div className="flex items-baseline justify-between mb-3">
            <p className="font-semibold">Which ones can you see?</p>
            <p className="text-sm text-ink/55">{items.length ? `${items.length} selected` : 'Tap all that apply'}</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 stagger">
            {VISIBILITY_ITEMS.map((it, i) => {
              const on = items.includes(it.key)
              return (
                <button
                  key={it.key}
                  type="button"
                  style={{ '--i': i }}
                  onClick={() => toggle(it.key)}
                  aria-pressed={on}
                  className={`pick relative min-h-[92px] rounded-2xl border p-3 flex flex-col items-start justify-between text-left active:scale-[0.97] ${
                    on ? 'bg-ink text-paper border-ink' : 'bg-white border-ink/15'
                  }`}
                >
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={on ? 'text-gold' : 'text-ink/70'}>
                    {VIS_ICON[it.key]}
                  </svg>
                  <span className="text-[15px] font-semibold leading-tight">{it.label}</span>
                  <span className={`absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center ${on ? 'gold-gradient text-ink' : 'border-2 border-ink/20'}`}>
                    {on && (
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
                    )}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </>
  )
}

// What each step needs before Continue / Submit unlocks
export const stepReady = [
  (d) => d.outletId.trim() !== '' && (d.picked || d.offline),
  (d) => d.order.length > 0 && (!d.order.includes('Other') || d.otherBrand.trim() !== ''),
  () => true,
  (d) => d.hasPosm === false || (d.hasPosm === true && (d.posmItems || []).length > 0),
]
