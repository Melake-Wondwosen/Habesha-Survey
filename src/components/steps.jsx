import { BRANDS, REASONS, REASON_QUESTION } from '../config'
import { useEffect, useRef, useState } from 'react'
import { requestOutlet } from '../api'
import { latestFix } from '../location'
import { findOutlet, localOutlet, normOutletId } from '../outlets'
import { Button, Field, Notice, Sheet, Spinner, inputClass } from './ui'

function Title({ n, children, sub }) {
  return (
    <div className="mb-5 anim-rise">
      <p className="text-xs uppercase tracking-wider text-gold-dark font-semibold">Step {n} of 4</p>
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

// Step 4: single-select reason
export function StepReason({ data, set }) {
  return (
    <>
      <Title n={4}>{REASON_QUESTION}</Title>
      <div className="space-y-2.5 stagger">
        {REASONS.map((r, i) => {
          const on = data.reason === r
          return (
            <button
              key={r}
              style={{ '--i': i }}
              type="button"
              onClick={() => set({ reason: r })}
              className={`pick w-full min-h-[54px] flex items-center gap-3 rounded-2xl border px-4 text-left active:scale-[0.98] ${
                on ? 'bg-ink text-paper border-ink' : 'bg-white border-ink/15'
              }`}
            >
              <span className={`w-5 h-5 shrink-0 rounded-full border-2 ${on ? 'border-gold bg-gold shadow-[inset_0_0_0_3px_#000]' : 'border-ink/30'}`} />
              <span className="text-[17px] font-semibold">{r}</span>
            </button>
          )
        })}
      </div>
      {data.reason === 'Other' && (
        <div className="mt-5 anim-rise">
          <Field label="What is the reason?">
            <textarea className={`${inputClass} py-3 min-h-[96px]`} value={data.reasonOther} onChange={(e) => set({ reasonOther: e.target.value })} />
          </Field>
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
  (d) => d.reason !== '' && (d.reason !== 'Other' || d.reasonOther.trim() !== ''),
]
