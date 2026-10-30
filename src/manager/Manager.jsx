import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { managerData } from '../api'
import { MANAGER_REFRESH_MS } from '../config'
import { clearUser, getUser } from '../storage'
import { Emblem, SignOutButton, Spinner } from '../components/ui'
import Bell from '../components/Bell'
import { clearNotesMemory, setServerNotes } from '../notes'
import MapView from './MapView'
import { ago, marketShare, pct, teamStatus, text, topBrand, num } from './calc'

const PERIODS = [
  { key: 'today', label: 'Today' },
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: 'all', label: 'All' },
]

function dayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function periodFrom(key) {
  if (key === 'today') return dayStart().toISOString()
  if (key === '7d') return new Date(dayStart().getTime() - 6 * 864e5).toISOString()
  if (key === '30d') return new Date(dayStart().getTime() - 29 * 864e5).toISOString()
  return ''
}

const FLAG_LABEL = { devtools: 'Dev tools', 'location-off': 'Location off', jump: 'GPS jump', 'out-of-range': 'Away from outlet' }
const time = (iso) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
const dateTime = (iso) => new Date(iso).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function Manager() {
  const navigate = useNavigate()
  const user = getUser()
  const [period, setPeriod] = useState('today')
  const [data, setData] = useState(null)
  const [fetchedAt, setFetchedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)

  const load = useCallback(async () => {
    setBusy(true)
    try {
      const d = await managerData(periodFrom(period), dayStart().toISOString())
      setData(d)
      setServerNotes(d.notes)
      setFetchedAt(Date.now())
      setError('')
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }, [period])

  useEffect(() => {
    load()
    const t = setInterval(load, MANAGER_REFRESH_MS)
    return () => clearInterval(t)
  }, [load])

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000)
    return () => clearInterval(t)
  }, [])

  // Use the server clock so a manager's phone with the wrong time doesn't mark everyone offline
  const serverNow = data?.serverTime ? new Date(data.serverTime).getTime() + (now - fetchedAt) : now

  const team = useMemo(
    () => (data ? teamStatus({ bas: data.bas, presence: data.presence, surveys: data.surveys, track: data.track, flags: data.flags }, serverNow, dayStart().getTime()) : []),
    [data, serverNow],
  )
  const share = useMemo(() => (data ? marketShare(data.surveys) : null), [data])
  const recent = useMemo(() => (data ? [...data.surveys].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 15) : []), [data])

  function signOut() {
    clearNotesMemory()
    clearUser()
    navigate('/login', { replace: true })
  }

  const online = team.filter((b) => b.online).length
  const activeToday = team.filter((b) => b.seenToday).length
  const outlets = share?.outlets ?? 0

  return (
    <main className="min-h-full safe-bottom anim-fade">
      <header className="relative z-[1200] bg-ink text-paper safe-top">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-4 pb-4">
          <div className="flex items-center gap-2 min-[380px]:gap-3">
            <Emblem className="w-11 h-11 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs uppercase tracking-wider text-gold truncate">Manager</p>
              <p className="font-serif text-lg truncate">{user.name}</p>
            </div>
            {user.role === 'admin' && (
              <Link to="/admin" className="btn-hover hidden sm:inline-flex items-center text-sm text-gold border border-gold/40 rounded-full px-4 min-h-[40px] hover:bg-gold hover:text-ink">
                Admin console
              </Link>
            )}
            <Bell onOpenItem={(n) => n.kind === 'flag' && setSelected(team.find((b) => n.title.startsWith(b.name + ':'))?.id ?? null)} />
            <SignOutButton onClick={signOut} />
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <div className="flex rounded-full bg-paper/10 p-1">
              {PERIODS.map((p) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setPeriod(p.key)}
                  className={`px-3 sm:px-4 min-h-[34px] rounded-full text-sm font-semibold ${period === p.key ? 'gold-gradient text-ink' : 'text-paper/75'}`}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <button type="button" onClick={load} disabled={busy} className="ml-auto text-xs text-paper/70 min-h-[34px] px-2 inline-flex items-center gap-2">
              {busy ? <Spinner /> : '↻'} {fetchedAt ? `Updated ${new Date(fetchedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Loading'}
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 space-y-5">
        {error && <p className="rounded-xl bg-paper border border-ink/15 border-l-4 border-l-gold text-ink text-sm px-4 py-3">{error}</p>}
        {!data && !error && (
          <div className="py-20 text-center text-ink/60">
            <Spinner />
          </div>
        )}

        {data && (
          <>
            <MarketShare share={share} />

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 stagger">
              <Tile i={0} label="Online now" value={online} sub={`of ${team.length} BAs`} live />
              <Tile i={1} label="Active today" value={activeToday} />
              <Tile i={2} label="Surveys" value={data.surveys.length} />
              <Tile i={3} label="Outlets" value={outlets} />
            </div>

            <div className="grid lg:grid-cols-5 gap-4 anim-rise" style={{ animationDelay: '160ms' }}>
              <section className="lg:col-span-3 h-[360px] sm:h-[440px] lg:h-[600px] rounded-2xl bg-white border border-ink/10 p-1.5">
                <MapView team={team} surveys={data.surveys} selectedId={selected} onSelect={setSelected} now={fetchedAt} />
              </section>
              <section className="lg:col-span-2 rounded-2xl bg-white border border-ink/10 flex flex-col lg:h-[600px] min-w-0">
                <div className="px-4 pt-4 pb-2 flex items-baseline justify-between">
                  <h2 className="font-serif text-xl">Team</h2>
                </div>
                <ul className="flex-1 overflow-y-auto divide-y divide-ink/10 max-h-[560px] lg:max-h-none">
                  {team.map((ba) => (
                    <TeamRow key={ba.id} ba={ba} now={serverNow} selected={selected === ba.id} onClick={() => setSelected(selected === ba.id ? null : ba.id)} />
                  ))}
                  {!team.length && <li className="px-4 py-6 text-sm text-ink/60">No BAs yet.</li>}
                </ul>
              </section>
            </div>


            <section className="rounded-2xl bg-white border border-ink/10 p-4">
              <h2 className="font-serif text-xl">Latest surveys</h2>
              {!recent.length && <p className="text-sm text-ink/60 mt-2">No surveys.</p>}
              <ul className="mt-2 divide-y divide-ink/10">
                {recent.map((s) => (
                  <li key={text(s.id)} className="row-hover px-2 -mx-2 rounded-lg py-2.5 grid grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[110px_minmax(0,1fr)_minmax(0,1fr)_110px] gap-x-3 gap-y-0.5 text-sm">
                    <span className="text-ink/55 order-3 sm:order-none">{dateTime(s.date)}</span>
                    <span className="font-semibold truncate">
                      {text(s.outletName)} <span className="font-normal text-ink/50">{text(s.outletId)}</span>
                    </span>
                    <span className="text-ink/70 truncate order-4 sm:order-none">{text(s.baName)}</span>
                    <span className="text-right">
                      #1 <b>{topBrand(s)}</b>
                      {num(s.rankHabesha) != null && num(s.rankHabesha) !== 1 && <span className="text-ink/55"> · Habesha #{num(s.rankHabesha)}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </main>
  )
}

function Tile({ i, label, value, sub, live }) {
  return (
    <div className="lift rounded-2xl bg-white border border-ink/10 px-4 py-3.5" style={{ '--i': i }}>
      <p className="text-xs uppercase tracking-wider text-gold-dark flex items-center gap-1.5">
        {live && <span className="w-2 h-2 rounded-full bg-gold animate-pulse" />}
        {label}
      </p>
      <p className="font-serif text-3xl mt-1">{value}</p>
      {sub && <p className="text-xs text-ink/50">{sub}</p>}
    </div>
  )
}

function TeamRow({ ba, now, selected, onClick }) {
  const status = ba.online ? `Online · ${ago(ba.lastSeen, now)}` : ba.lastSeen ? `Last seen ${ago(ba.lastSeen, now)}` : 'Not seen yet'
  const flags = [...new Map(ba.flags.map((f) => [f.type, f])).values()]
  return (
    <li>
      <button type="button" onClick={onClick} className={`row-hover w-full text-left px-4 py-3 ${selected ? 'bg-gold/10' : ''}`}>
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${ba.online ? 'bg-gold' : ba.seenToday ? 'bg-ink/50' : 'bg-ink/15'}`} />
          <span className="font-semibold truncate">{ba.name}</span>
          <span className="ml-auto text-xs text-ink/55 shrink-0">{status}</span>
        </div>
        {ba.activity && <p className="text-sm text-ink/75 mt-0.5 pl-[18px] truncate">{ba.activity}</p>}
        <p className="text-xs text-ink/55 mt-1 pl-[18px]">
          Today {ba.surveysToday} · Period {ba.surveysPeriod}
          {ba.lastSurvey && ` · Last ${text(ba.lastSurvey.outletName)} ${time(ba.lastSurvey.date)}`}
        </p>
        {(flags.length > 0 || ba.lat != null) && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 pl-[18px]">
            {flags.map((f) => (
              <span key={f.type} title={`${f.detail} · ${dateTime(f.at)}`} className="text-[11px] font-semibold rounded-full bg-ink text-gold px-2 py-0.5">
                {FLAG_LABEL[f.type] || f.type}
              </span>
            ))}
            {ba.lat != null && (
              <a
                href={`https://maps.google.com/?q=${ba.lat},${ba.lng}`}
                target="_blank"
                rel="noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-[11px] text-gold-dark link-hover"
              >
                ±{ba.accuracy ?? '?'} m · fix {ago(ba.locTime, now)}
              </a>
            )}
          </div>
        )}
      </button>
    </li>
  )
}

function MarketShare({ share }) {
  const rows = [...share.rows].sort((a, b) => (b.volumeShare ?? -1) - (a.volumeShare ?? -1) || (b.sellingIn ?? 0) - (a.sellingIn ?? 0))
  const max = Math.max(0.0001, ...rows.map((r) => r.volumeShare || 0))
  // Bars grow in from zero after the first paint
  const [grow, setGrow] = useState(false)
  useEffect(() => {
    const t = requestAnimationFrame(() => requestAnimationFrame(() => setGrow(true)))
    return () => cancelAnimationFrame(t)
  }, [])
  return (
    <section className="rounded-2xl bg-white border border-ink/10 p-4 anim-rise">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-serif text-xl">Market share</h2>
        <p className="text-xs text-ink/55">
          {share.outlets} outlets · {share.totalCrates.toLocaleString()} crates a week
        </p>
      </div>

      <div className="hidden md:grid grid-cols-[130px_minmax(0,1fr)_95px_95px_80px] gap-3 mt-4 text-[11px] uppercase tracking-wider text-gold-dark">
        <span>Brand</span>
        <span>Volume share</span>
        <span className="text-right">Selling in</span>
        <span className="text-right">Ranked #1</span>
        <span className="text-right">Avg rank</span>
      </div>
      <ul className="mt-2 md:mt-1 divide-y divide-ink/10">
        {rows.map((r) => (
          <li key={r.key} className="row-hover px-2 -mx-2 rounded-lg py-2.5 grid grid-cols-[minmax(0,1fr)_auto] md:grid-cols-[130px_minmax(0,1fr)_95px_95px_80px] gap-x-3 gap-y-1 items-center">
            <span className="font-semibold flex items-center gap-1.5">
              {r.label}
              {r.ours && <span className="text-[9px] font-bold tracking-widest rounded-full px-1.5 py-0.5 gold-gradient text-ink">OURS</span>}
            </span>
            <span className="md:hidden text-right font-serif text-lg">{pct(r.volumeShare)}</span>
            <span className="col-span-2 md:col-span-1 flex items-center gap-2">
              <span className="flex-1 h-3 rounded-full bg-mist overflow-hidden">
                <span className={`block h-full rounded-full transition-[width] duration-700 ease-[cubic-bezier(.22,1,.36,1)] ${r.ours ? 'gold-gradient' : 'bg-ink-soft'}`} style={{ width: `${grow ? ((r.volumeShare || 0) / max) * 100 : 0}%` }} />
              </span>
              <span className="hidden md:inline w-14 text-right font-semibold tabular-nums">{pct(r.volumeShare)}</span>
            </span>
            <span className="col-span-2 md:col-span-3 grid grid-cols-3 md:contents text-xs md:text-sm text-ink/70">
              <span className="md:text-right tabular-nums"><span className="md:hidden text-ink/45">Selling in </span>{pct(r.sellingIn)}</span>
              <span className="text-center md:text-right tabular-nums"><span className="md:hidden text-ink/45">#1 in </span>{pct(r.topIn)}</span>
              <span className="text-right tabular-nums"><span className="md:hidden text-ink/45">Avg rank </span>{r.avgRank == null ? '–' : r.avgRank.toFixed(1)}</span>
            </span>
          </li>
        ))}
      </ul>


    </section>
  )
}
