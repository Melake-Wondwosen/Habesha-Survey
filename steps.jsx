import { BRANDS, OUTLET_RANGE_M, REASONS, REASON_QUESTION } from '../config'
import { useEffect, useMemo, useState } from 'react'
import { requestOutlet } from '../api'
import { getFix, latestFix, locationMessage, onLocation } from '../location'
import { matches, nearbyOutlets, onOutlets, outletList, searchUnlocated, unlocatedCount } from '../outlets'
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

// Step 1: pick the outlet from the list so name and ID are always correct.
// Free typing is only allowed until the admin loads an outlet list.
export function StepOutlet({ data, set }) {
  const [query, setQuery] = useState('')
  const [asking, setAsking] = useState(false)
  const [fix, setFix] = useState(latestFix)
  const [locError, setLocError] = useState(null)
  const [locating, setLocating] = useState(false)
  const [listVersion, setListVersion] = useState(0)
  const hasList = outletList().length > 0

  async function locate() {
    setLocating(true)
    try {
      setFix(await getFix())
      setLocError(null)
    } catch (err) {
      setLocError(err)
    } finally {
      setLocating(false)
    }
  }

  // The list follows the BA as they walk: every new GPS fix re-checks the range
  useEffect(() => {
    const off = onLocation(({ fix: f, error }) => {
      if (f) setFix(f)
      setLocError(error)
    })
    const offList = onOutlets(() => setListVersion((v) => v + 1))
    const f = latestFix()
    if (!f || Date.now() - f.at > 60000) locate()
    return () => {
      off()
      offList()
    }
  }, [])

  const near = useMemo(() => nearbyOutlets(fix, OUTLET_RANGE_M), [fix, listVersion])
  const results = useMemo(() => [...near.filter((o) => matches(o, query)), ...searchUnlocated(query)], [near, query, listVersion])

  if (!hasList) {
    return (
      <>
        <Title n={1}>Which outlet are you in?</Title>
        <div className="space-y-4 stagger">
          <div style={{ '--i': 0 }}>
            <Field label="Outlet name">
              <input className={inputClass} value={data.outletName} onChange={(e) => set({ outletName: e.target.value })} autoComplete="off" placeholder="e.g. Abebe Bar" />
            </Field>
          </div>
          <div style={{ '--i': 1 }}>
            <Field label="Outlet ID">
              <input
                className={`${inputClass} uppercase tracking-wide`}
                value={data.outletId}
                onChange={(e) => set({ outletId: e.target.value.toUpperCase() })}
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck="false"
              />
            </Field>
          </div>
        </div>
      </>
    )
  }

  if (data.picked) {
    return (
      <>
        <Title n={1}>Which outlet are you in?</Title>
        <div className="anim-pop rounded-2xl bg-ink text-paper p-5 shadow-lg">
          <div className="flex items-start gap-3">
            <span className="w-9 h-9 rounded-full gold-gradient text-ink flex items-center justify-center shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5L20 7" /></svg>
            </span>
            <div className="min-w-0">
              <p className="font-serif text-xl leading-tight">{data.outletName}</p>
              <p className="text-gold font-semibold tracking-wide mt-1">{data.outletId}</p>
            </div>
          </div>
        </div>
        <Button variant="ghost" className="mt-4 btn-hover" onClick={() => set({ picked: false, outletId: '', outletName: '' })}>
          Change outlet
        </Button>
      </>
    )
  }

  return (
    <>
      <Title n={1}>Which outlet are you in?</Title>

      <div className="flex items-center gap-2 rounded-2xl bg-ink text-paper pl-4 pr-1.5 py-1.5 mb-3 anim-rise">
        <svg className="text-gold shrink-0" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 21s-7-6.2-7-12a7 7 0 1 1 14 0c0 5.8-7 12-7 12z" />
          <circle cx="12" cy="9" r="2.5" />
        </svg>
        <span className="flex-1 min-w-0 text-sm truncate">
          {fix ? (
            <>
              <b className="text-gold">{near.length}</b> within {OUTLET_RANGE_M} m <span className="text-paper/50">· ±{fix.accuracy} m</span>
            </>
          ) : locating ? (
            'Finding you…'
          ) : (
            'No location'
          )}
        </span>
        <button
          type="button"
          onClick={locate}
          disabled={locating}
          aria-label="Refresh location"
          className="btn-hover w-10 h-10 rounded-full flex items-center justify-center text-paper hover:bg-gold hover:text-ink disabled:opacity-60"
        >
          <svg className={locating ? 'animate-spin' : ''} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-2.64-6.36" />
            <path d="M21 3v6h-6" />
          </svg>
        </button>
      </div>

      {locError?.code === 1 && <Notice className="mb-3">{locationMessage(locError)}</Notice>}

      {(near.length > 4 || unlocatedCount() > 0) && (
        <div className="relative mb-3">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 text-ink/40" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
          <input
            className={`${inputClass} pl-12`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Outlet name or ID"
            autoComplete="off"
            autoCorrect="off"
            spellCheck="false"
          />
        </div>
      )}

      <ul className="space-y-2 stagger">
        {results.map((o, i) => (
          <li key={o.outletId} style={{ '--i': i }}>
            <button
              type="button"
              onClick={() => set({ picked: true, outletId: o.outletId, outletName: o.outletName })}
              className="pick w-full min-h-[56px] text-left rounded-2xl bg-white border border-ink/12 px-4 py-2.5 active:scale-[0.98] flex items-center gap-3"
            >
              <span className="flex-1 min-w-0">
                <span className="block font-semibold text-[17px] truncate">{o.outletName}</span>
                <span className="block text-sm font-semibold text-gold-dark tracking-wide">{o.outletId}</span>
              </span>
              <span className={`shrink-0 text-sm font-semibold rounded-full px-2.5 py-1 ${o.distance == null ? 'bg-mist text-ink/50' : 'bg-gold/15 text-ink'}`}>
                {o.distance == null ? 'No location' : `${o.distance} m`}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {fix && !results.length && (
        <div className="anim-fade text-center py-8">
          <p className="font-semibold">No outlets within {OUTLET_RANGE_M} m</p>
          <Button variant="ghost" className="mt-4 w-auto! px-6 min-h-[44px] text-[15px]" onClick={locate} disabled={locating}>
            {locating ? <Spinner /> : 'Refresh location'}
          </Button>
        </div>
      )}

      <Button variant="quiet" className="mt-4" onClick={() => setAsking(true)}>
        Not on the list?
      </Button>
      {asking && <RequestOutlet initial={query} onClose={() => setAsking(false)} />}
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

// Step 3: crates per brand. Blank means unknown, not zero.
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
      <Title n={3}>
        Crate volume
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
  (d) => d.outletName.trim() !== '' && d.outletId.trim() !== '' && (d.picked || outletList().length === 0),
  (d) => d.order.length > 0 && (!d.order.includes('Other') || d.otherBrand.trim() !== ''),
  () => true,
  (d) => d.reason !== '' && (d.reason !== 'Other' || d.reasonOther.trim() !== ''),
]
