import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router'
import { flushQueue, notifications } from '../api'
import { locationMessage, onLocation } from '../location'
import { addLocalNote, clearNotesMemory, setServerNotes } from '../notes'
import { syncOutlets } from '../outlets'
import { setActivity, stopPresence } from '../presence'
import { clearUser, getDoneCounts, getLastSync, getQueue, getQueueWhy, getUser, setLastSync } from '../storage'
import Bell from '../components/Bell'
import { Button, Emblem, Notice, Pattern, SignOutButton } from '../components/ui'

const clock = (ms) => new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function Home() {
  const navigate = useNavigate()
  const user = getUser()
  const [counts] = useState(getDoneCounts)
  const [pending, setPending] = useState(() => getQueue().length)
  const [why, setWhy] = useState(getQueueWhy)
  const [lastSync, setLast] = useState(getLastSync)
  const [syncing, setSyncing] = useState(false)
  const [result, setResult] = useState(null)
  const [locError, setLocError] = useState(null)

  useEffect(() => {
    setActivity('On home screen')
    sync(true)
    return onLocation(({ error }) => setLocError(error))
  }, [])

  // Uploads waiting surveys, then pulls the latest outlet list and notifications
  async function sync(quiet = false) {
    if (syncing) return
    setSyncing(true)
    if (!quiet) setResult(null)
    const flush = await flushQueue()
    setPending(flush.left)
    setWhy(flush.why)
    let online = true
    try {
      await syncOutlets(undefined, true)
      const d = await notifications()
      setServerNotes(d.notes)
    } catch {
      online = false
    }
    if (flush.sent) addLocalNote(`${flush.sent} ${flush.sent === 1 ? 'survey' : 'surveys'} uploaded`)
    if (online && !flush.left) {
      const now = Date.now()
      setLastSync(now)
      setLast(now)
    }
    if (!quiet || flush.sent) {
      setResult(
        flush.left || !online
          ? { tone: 'error', text: flush.why || 'No connection' }
          : { tone: 'ok', text: flush.sent ? `${flush.sent} uploaded` : 'Up to date' },
      )
    }
    setSyncing(false)
  }

  function signOut() {
    stopPresence('Signed out')
    clearNotesMemory()
    clearUser()
    navigate('/login', { replace: true })
  }

  return (
    <main className="min-h-full flex flex-col safe-top safe-bottom">
      <header className="relative z-[1200] bg-ink text-paper px-4 min-[380px]:px-5 pt-4 pb-5">
        <div className="max-w-md mx-auto flex items-center gap-2 min-[380px]:gap-3 anim-fade">
          <Emblem className="w-11 h-11" />
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-wider text-gold">Outlet Survey</p>
            <p className="font-serif text-lg truncate">{user?.name || user?.username}</p>
          </div>
          <Bell />
          <SignOutButton onClick={signOut} />
        </div>
      </header>

      <div className="flex-1 px-4 min-[380px]:px-5 py-6 max-w-md w-full mx-auto stagger">
        <div className="grid grid-cols-2 gap-3" style={{ '--i': 0 }}>
          <Stat label="Today" value={counts.today} />
          <Stat label="All time" value={counts.total} />
        </div>

        {locError && (
          <div style={{ '--i': 1 }}>
            <Notice className="mt-5">{locationMessage(locError)}</Notice>
          </div>
        )}

        <div style={{ '--i': 2 }}>
          <Button variant="gold" className="mt-6 min-h-[64px] text-lg" onClick={() => navigate('/survey')}>
            Start a survey
          </Button>
        </div>

        <section style={{ '--i': 3 }} className={`lift mt-4 rounded-2xl bg-white border p-3 pl-4 flex items-center gap-3 ${pending ? 'border-gold' : 'border-ink/10'}`}>
          <span className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${pending ? 'gold-gradient text-ink' : 'bg-mist text-ink'}`}>
            {pending ? (
              <b key={pending} className="anim-pop">{pending}</b>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12.5l4.5 4.5L19 7.5" />
              </svg>
            )}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block font-semibold">{pending ? 'Waiting to upload' : 'All synced'}</span>
            <span className="block text-xs text-ink/55 truncate">{lastSync ? `Last sync ${clock(lastSync)}` : 'Not synced yet'}</span>
          </span>
          <button
            type="button"
            onClick={() => sync()}
            disabled={syncing}
            className="btn-hover shrink-0 inline-flex items-center gap-2 rounded-full bg-ink text-paper h-11 px-4 font-semibold hover:bg-ink-soft disabled:opacity-70"
          >
            <svg className={syncing ? 'animate-spin' : ''} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 0 1-15.36 6.36L3 16" />
              <path d="M3 12a9 9 0 0 1 15.36-6.36L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M3 21v-5h5" />
            </svg>
            {syncing ? 'Syncing' : 'Sync'}
          </button>
        </section>

        {result && (
          <Notice key={result.text + lastSync} tone={result.tone} className="mt-3">
            {result.text}
          </Notice>
        )}
        {!result && pending > 0 && why && <Notice className="mt-3">{why}</Notice>}
      </div>

      <Pattern className="opacity-60 px-8 pb-2 anim-fade" />
    </main>
  )
}

function Stat({ label, value }) {
  return (
    <div className="lift rounded-2xl bg-white border border-ink/10 px-4 py-4 text-center">
      <p className="font-serif text-4xl text-ink">{value}</p>
      <p className="text-xs uppercase tracking-wider text-gold-dark mt-1">{label}</p>
    </div>
  )
}
