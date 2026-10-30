import { useCallback, useEffect, useMemo, useState } from 'react'
import { managerData } from '../api'
import { BRANDS, REASONS, VISIBILITY_ITEMS } from '../config'
import { latestPerOutlet, marketShare, num, pct, text } from '../manager/calc'
import { Notice, Spinner } from '../components/ui'

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All' },
]
const GROUPS = [
  { key: 'division', label: 'Division' },
  { key: 'agent', label: 'Agent' },
  { key: 'territory', label: 'Territory' },
  { key: 'baName', label: 'BA' },
]
const OURS = BRANDS.find((b) => b.ours)

function dayStart(offsetDays = 0) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - offsetDays)
  return d
}
function periodFrom(key) {
  if (key === 'today') return dayStart().toISOString()
  if (key === '7d') return dayStart(6).toISOString()
  if (key === '30d') return dayStart(29).toISOString()
  return ''
}
const label = (v) => text(v).trim() || 'Not set'
const fmt = (n) => (n == null ? '–' : Math.round(n).toLocaleString())

// Habesha POSM across the latest survey per outlet. Older surveys without the
// question are left out of the base.
function posmStats(outlets) {
  const asked = outlets.filter((s) => s.posm === 'Yes' || s.posm === 'No')
  const yes = asked.filter((s) => s.posm === 'Yes')
  const n = asked.length
  return {
    asked: n,
    rate: n ? yes.length / n : null,
    items: VISIBILITY_ITEMS.map((it) => {
      const c = asked.filter((s) => Number(s['posm' + it.key]) === 1).length
      return { ...it, count: c, rate: n ? c / n : null }
    }),
  }
}

// Volume share for one brand inside a group, using the same rule as the
// market share table: only outlets where every brand sold has a crate count.
function brandStats(surveys) {
  const share = marketShare(surveys)
  const ours = share.rows.find((r) => r.ours)
  const top = [...share.rows].sort((a, b) => (b.volumeShare ?? -1) - (a.volumeShare ?? -1) || b.topCount - a.topCount)[0]
  return { share, ours, top: top && (top.volumeShare || top.topCount) ? top : null }
}

export default function Analysis() {
  const [period, setPeriod] = useState('7d')
  const [division, setDivision] = useState('')
  const [group, setGroup] = useState('division')
  const [surveys, setSurveys] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      // trackFrom = now keeps the GPS trail out of the reply; this screen doesn't use it
      const d = await managerData(periodFrom(period), new Date().toISOString())
      setSurveys(d.surveys || [])
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [period])

  useEffect(() => {
    load()
  }, [load])

  const divisions = useMemo(() => [...new Set((surveys || []).map((s) => label(s.division)))].sort(), [surveys])
  const rows = useMemo(() => (surveys || []).filter((s) => !division || label(s.division) === division), [surveys, division])
  const outlets = useMemo(() => latestPerOutlet(rows), [rows])
  const stats = useMemo(() => brandStats(rows), [rows])
  const bas = useMemo(() => new Set(rows.map((s) => text(s.baId))).size, [rows])
  const posm = useMemo(() => posmStats(outlets), [outlets])

  const groups = useMemo(() => {
    const by = new Map()
    for (const s of rows) {
      const k = label(s[group])
      if (!by.has(k)) by.set(k, [])
      by.get(k).push(s)
    }
    return [...by.entries()]
      .map(([name, list]) => {
        const st = brandStats(list)
        return { name, surveys: list.length, outlets: st.share.outlets, crates: st.share.totalCrates, ours: st.ours, top: st.top, posm: posmStats(latestPerOutlet(list)).rate }
      })
      .sort((a, b) => b.outlets - a.outlets || b.surveys - a.surveys)
  }, [rows, group])

  // Main reason, split by whether our brand or a competitor is #1
  const reasons = useMemo(() => {
    const count = (list) => {
      const m = Object.fromEntries(REASONS.map((r) => [r, 0]))
      for (const s of list) if (s.reason) m[s.reason] = (m[s.reason] || 0) + 1
      return m
    }
    const oursTop = outlets.filter((s) => num(s['rank' + OURS.key]) === 1)
    const otherTop = outlets.filter((s) => num(s['rank' + OURS.key]) !== 1 && s.reason)
    return { oursTop: count(oursTop), otherTop: count(otherTop), nOurs: oursTop.length, nOther: otherTop.length }
  }, [outlets])

  // Surveys per day across the period (max 30 bars)
  const daily = useMemo(() => {
    const days = period === 'today' ? 1 : period === '7d' ? 7 : 30
    const out = []
    for (let i = days - 1; i >= 0; i--) {
      const d0 = dayStart(i).getTime()
      const d1 = d0 + 864e5
      out.push({ day: new Date(d0), n: rows.filter((s) => { const t = new Date(s.date).getTime(); return t >= d0 && t < d1 }).length })
    }
    return out
  }, [rows, period])
  const maxDay = Math.max(1, ...daily.map((d) => d.n))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-full bg-white border border-ink/10 p-1">
          {PERIODS.map((p) => (
            <button
              key={p.key}
              type="button"
              onClick={() => setPeriod(p.key)}
              className={`px-3.5 h-9 rounded-full text-sm font-semibold transition-colors ${period === p.key ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'}`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <select
          value={division}
          onChange={(e) => setDivision(e.target.value)}
          className="h-11 rounded-full bg-white border border-ink/10 px-4 text-sm font-semibold outline-none focus:border-gold"
        >
          <option value="">All divisions</option>
          {divisions.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={load}
          disabled={busy}
          className="btn-hover ml-auto h-11 px-4 rounded-full border border-ink/15 text-sm font-semibold hover:border-gold disabled:opacity-60"
        >
          {busy ? <Spinner /> : 'Refresh'}
        </button>
      </div>

      {error && <Notice>{error}</Notice>}
      {!surveys && !error && <div className="skeleton h-40 rounded-2xl" />}

      {surveys && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <Tile label="Surveys" value={fmt(rows.length)} />
            <Tile label="Outlets" value={fmt(outlets.length)} />
            <Tile label="Active BAs" value={fmt(bas)} />
            <Tile label={`${OURS.label} selling in`} value={pct(stats.ours?.sellingIn)} gold />
            <Tile label={`${OURS.label} ranked #1`} value={pct(stats.ours?.topIn)} gold />
            <Tile label={`${OURS.label} volume share`} value={pct(stats.ours?.volumeShare)} gold />
          </div>

          {!rows.length ? (
            <p className="rounded-2xl bg-white border border-ink/10 p-8 text-center text-ink/60">No surveys in this period.</p>
          ) : (
            <>
              <Card title="Market share" sub={`${stats.share.outlets} outlets · ${fmt(stats.share.totalCrates)} crates a week from ${stats.share.volumeOutlets} outlets with full counts`}>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-[11px] uppercase tracking-wider text-gold-dark text-left">
                        <th className="py-2 px-1 font-semibold">Brand</th>
                        <th className="py-2 px-1 font-semibold w-[38%]">Volume share</th>
                        <th className="py-2 px-1 font-semibold text-right">Crates/week</th>
                        <th className="py-2 px-1 font-semibold text-right">Selling in</th>
                        <th className="py-2 px-1 font-semibold text-right">Ranked #1</th>
                        <th className="py-2 px-1 font-semibold text-right">Avg rank</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...stats.share.rows].sort((a, b) => (b.volumeShare ?? -1) - (a.volumeShare ?? -1)).map((r) => (
                        <tr key={r.key} className="border-t border-ink/8">
                          <td className="py-2.5 px-1 font-semibold whitespace-nowrap">
                            {r.label}
                            {r.ours && <span className="ml-2 text-[9px] font-bold tracking-widest rounded-full px-1.5 py-0.5 gold-gradient text-ink align-middle">OURS</span>}
                          </td>
                          <td className="py-2.5 px-1">
                            <div className="flex items-center gap-2">
                              <span className="flex-1 h-2.5 rounded-full bg-mist overflow-hidden">
                                <span className={`block h-full rounded-full ${r.ours ? 'gold-gradient' : 'bg-ink-soft'}`} style={{ width: `${(r.volumeShare || 0) * 100}%` }} />
                              </span>
                              <span className="w-14 text-right tabular-nums font-semibold">{pct(r.volumeShare)}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{fmt(r.crates)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{pct(r.sellingIn)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{pct(r.topIn)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{r.avgRank == null ? '–' : r.avgRank.toFixed(1)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card
                title={`By ${GROUPS.find((g) => g.key === group).label.toLowerCase()}`}
                right={
                  <div className="inline-flex rounded-full bg-mist p-1">
                    {GROUPS.map((g) => (
                      <button
                        key={g.key}
                        type="button"
                        onClick={() => setGroup(g.key)}
                        className={`px-3 h-8 rounded-full text-xs font-semibold transition-colors ${group === g.key ? 'bg-ink text-paper' : 'text-ink/60 hover:text-ink'}`}
                      >
                        {g.label}
                      </button>
                    ))}
                  </div>
                }
              >
                <div className="overflow-x-auto -mx-1 max-h-[480px] overflow-y-auto">
                  <table className="w-full text-sm min-w-[680px]">
                    <thead className="sticky top-0 bg-white">
                      <tr className="text-[11px] uppercase tracking-wider text-gold-dark text-left">
                        <th className="py-2 px-1 font-semibold">{GROUPS.find((g) => g.key === group).label}</th>
                        <th className="py-2 px-1 font-semibold text-right">Surveys</th>
                        <th className="py-2 px-1 font-semibold text-right">Outlets</th>
                        <th className="py-2 px-1 font-semibold text-right">Crates/week</th>
                        <th className="py-2 px-1 font-semibold text-right">{OURS.label} share</th>
                        <th className="py-2 px-1 font-semibold text-right">{OURS.label} #1</th>
                        <th className="py-2 px-1 font-semibold text-right">POSM</th>
                        <th className="py-2 px-1 font-semibold">Leading brand</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((g) => (
                        <tr key={g.name} className="border-t border-ink/8">
                          <td className="py-2.5 px-1 font-semibold max-w-[220px] truncate" title={g.name}>{g.name}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{fmt(g.surveys)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{fmt(g.outlets)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{fmt(g.crates)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums font-semibold">{pct(g.ours?.volumeShare)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{pct(g.ours?.topIn)}</td>
                          <td className="py-2.5 px-1 text-right tabular-nums">{pct(g.posm)}</td>
                          <td className="py-2.5 px-1">
                            {g.top ? (
                              <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${g.top.ours ? 'gold-gradient text-ink' : 'bg-ink text-paper'}`}>{g.top.label}</span>
                            ) : (
                              '–'
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              <Card
                title={`${OURS.label} visibility`}
                sub={posm.asked ? `${posm.asked} outlets answered` : 'No answers yet'}
                right={
                  <div className="text-right">
                    <p className="font-serif text-3xl text-gold-dark tabular-nums leading-none">{pct(posm.rate)}</p>
                    <p className="text-[11px] uppercase tracking-wider text-ink/55 mt-1">outlets with POSM</p>
                  </div>
                }
              >
                <div className="grid sm:grid-cols-2 gap-x-8 gap-y-2">
                  {[...posm.items].sort((a, b) => b.count - a.count).map((it) => (
                    <div key={it.key} className="flex items-center gap-2 text-sm">
                      <span className="w-28 shrink-0 text-ink/75">{it.label}</span>
                      <span className="flex-1 h-2.5 rounded-full bg-mist overflow-hidden">
                        <span className="block h-full rounded-full gold-gradient" style={{ width: `${(it.rate || 0) * 100}%` }} />
                      </span>
                      <span className="w-12 text-right tabular-nums">{pct(it.rate).replace('.0%', '%')}</span>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="grid lg:grid-cols-2 gap-4">
                <Card title="Why the top brand sells most" sub="Latest survey per outlet">
                  <ReasonBars title={`Where ${OURS.label} is #1`} counts={reasons.oursTop} n={reasons.nOurs} gold />
                  <ReasonBars title="Where a competitor is #1" counts={reasons.otherTop} n={reasons.nOther} />
                </Card>

                {period !== 'all' && (
                  <Card title="Surveys per day">
                    <div className="flex items-end gap-1 h-40 pt-4">
                      {daily.map((d) => (
                        <div key={d.day.toISOString()} className="flex-1 min-w-0 flex flex-col items-center justify-end h-full gap-1" title={`${d.day.toLocaleDateString([], { day: 'numeric', month: 'short' })}: ${d.n}`}>
                          {daily.length <= 14 && <span className="text-[10px] tabular-nums text-ink/60">{d.n || ''}</span>}
                          <span className="w-full rounded-t-md gold-gradient" style={{ height: `${(d.n / maxDay) * 100}%`, minHeight: d.n ? 3 : 0 }} />
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-between text-[11px] text-ink/50 mt-1.5">
                      <span>{daily[0].day.toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                      <span>{daily[daily.length - 1].day.toLocaleDateString([], { day: 'numeric', month: 'short' })}</span>
                    </div>
                  </Card>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function Tile({ label, value, gold }) {
  return (
    <div className={`rounded-2xl p-4 border ${gold ? 'bg-ink text-paper border-ink' : 'bg-white border-ink/10'}`}>
      <p className={`font-serif text-2xl tabular-nums ${gold ? 'text-gold' : ''}`}>{value}</p>
      <p className={`text-[11px] uppercase tracking-wider mt-1 ${gold ? 'text-paper/60' : 'text-gold-dark'}`}>{label}</p>
    </div>
  )
}

function Card({ title, sub, right, children }) {
  return (
    <section className="rounded-2xl bg-white border border-ink/10 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <div className="min-w-0">
          <h2 className="font-serif text-xl">{title}</h2>
          {sub && <p className="text-xs text-ink/55 mt-0.5">{sub}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  )
}

function ReasonBars({ title, counts, n, gold }) {
  const list = Object.entries(counts).filter(([, c]) => c > 0).sort((a, b) => b[1] - a[1])
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-sm font-semibold mb-2">
        {title} <span className="text-ink/50 font-normal">· {n} outlets</span>
      </p>
      {!list.length && <p className="text-sm text-ink/50">No answers yet</p>}
      <div className="space-y-1.5">
        {list.map(([reason, c]) => (
          <div key={reason} className="flex items-center gap-2 text-sm">
            <span className="w-36 sm:w-52 shrink-0 truncate text-ink/75" title={reason}>{reason}</span>
            <span className="flex-1 h-2.5 rounded-full bg-mist overflow-hidden">
              <span className={`block h-full rounded-full ${gold ? 'gold-gradient' : 'bg-ink-soft'}`} style={{ width: `${(c / n) * 100}%` }} />
            </span>
            <span className="w-12 text-right tabular-nums">{Math.round((c / n) * 100)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
