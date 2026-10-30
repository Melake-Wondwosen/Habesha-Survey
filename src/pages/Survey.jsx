import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { addSurvey } from '../api'
import { getFix, latestFix, locationError, locationMessage } from '../location'
import { setActivity } from '../presence'
import { RETURN_HOME_MS } from '../config'
import { clearDraft, countDone, getDraft, getUser, pushQueue, setDraft, setQueueWhy } from '../storage'
import { Button, Sheet, Spinner } from '../components/ui'
import { StepCrates, StepOutlet, StepRank, StepReason, stepReady } from '../components/steps'

const EMPTY = { outletName: '', outletId: '', division: '', agent: '', parentTerritory: '', territory: '', area: '', picked: false, offline: false, order: [], otherBrand: '', crates: {}, reason: '', reasonOther: '' }
const STEPS = [StepOutlet, StepRank, StepCrates, StepReason]

function makeId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let tail = ''
  for (let i = 0; i < 6; i++) tail += chars[Math.floor(Math.random() * chars.length)]
  return `SRV-${Date.now()}-${tail}`
}

function buildRecord(d, user, location, start) {
  const ranks = {}
  const crates = {}
  d.order.forEach((key, i) => {
    ranks[key] = i + 1
    const c = d.crates[key]
    if (c !== '' && c != null) crates[key] = Number(c)
  })
  const otherRanked = d.order.includes('Other')
  return {
    id: makeId(),
    date: new Date().toISOString(),
    baId: user.id,
    baName: user.name,
    token: user.token,
    location: location ? { lat: location.lat, lng: location.lng, accuracy: location.accuracy } : null,
    outletId: d.outletId.trim().toUpperCase(),
    outletName: d.outletName.trim(),
    division: d.division,
    agent: d.agent,
    parentTerritory: d.parentTerritory,
    territory: d.territory,
    startedAt: start.at,
    startLocation: start.fix ? { lat: start.fix.lat, lng: start.fix.lng, accuracy: start.fix.accuracy } : null,
    ranks,
    crates,
    otherBrandName: otherRanked ? d.otherBrand.trim() : '',
    reason: d.reason,
    reasonOther: d.reason === 'Other' ? d.reasonOther.trim() : '',
  }
}

export default function Survey() {
  const navigate = useNavigate()
  // Pick up a survey that was left part-way
  const [draft] = useState(getDraft)
  const [step, setStep] = useState(draft?.step ?? 0)
  const [maxStep, setMaxStep] = useState(draft?.maxStep ?? draft?.step ?? 0)
  const [dir, setDir] = useState(1)
  const [data, setData] = useState(() => (draft ? { ...EMPTY, ...draft.data } : EMPTY))
  const [status, setStatus] = useState('idle') // idle | sending | saved | queued
  const scroller = useRef(null)

  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const ready = stepReady[step](data)
  const Step = STEPS[step]
  const last = step === STEPS.length - 1

  const [error, setError] = useState('')

  // Start time and location are taken the moment the survey opens
  // A resumed survey keeps its original start time and location.
  const start = useRef(draft?.start || { at: new Date().toISOString(), fix: null })
  const [startFix, setStartFix] = useState(start.current.fix)
  const [startLoc, setStartLoc] = useState(start.current.fix ? 'ok' : 'finding') // finding | ok | off
  useEffect(() => {
    if (start.current.fix) return
    let live = true
    getFix()
      .then((f) => {
        start.current.fix = f
        if (live) {
          setStartFix(f)
          setStartLoc('ok')
        }
      })
      .catch((err) => {
        // Weak signal: use the last fix if it's under two minutes old
        const f = latestFix()
        if (err?.code !== 1 && f && Date.now() - f.at < 120000) {
          start.current.fix = f
          if (live) {
            setStartFix(f)
            setStartLoc('ok')
          }
        } else if (live) setStartLoc('off')
      })
    return () => {
      live = false
    }
  }, [])
  const startTime = new Date(start.current.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

  // Save progress after every change
  const touched = step > 0 || JSON.stringify(data) !== JSON.stringify(EMPTY)
  const finished = useRef(false)
  useEffect(() => {
    if (finished.current || !touched) return
    setDraft({ baId: getUser()?.id, data, step, maxStep, start: start.current, savedAt: Date.now() })
  }, [data, step, maxStep, startFix])

  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
    const where = data.outletId.trim() ? `${data.outletName.trim() || 'outlet'} (${data.outletId.trim()})` : ''
    setActivity(step === 0 ? 'Starting a survey' : `Surveying ${where}, step ${step + 1} of 4`, step === 1)
  }, [step])

  // In-app dialog, since some browsers and embedded views block window.confirm
  const [leaving, setLeaving] = useState(false)
  function abandon() {
    if (touched) setLeaving(true)
    else navigate('/', { replace: true })
  }
  function discard() {
    finished.current = true
    clearDraft()
    navigate('/', { replace: true })
  }

  function go(to) {
    setDir(to > step ? 1 : -1)
    setStep(to)
    setMaxStep((m) => Math.max(m, to))
  }
  // A step can be opened from the progress bar once it was reached and every
  // step before it is still answered
  const canJump = (i) => i !== step && i <= maxStep && STEPS.slice(0, i).every((_, j) => stepReady[j](data))

  function skipCrates() {
    set({ crates: {} })
    go(3)
  }

  async function submit() {
    setStatus('sending')
    setError('')
    // Every survey carries the phone's location. Blocked location stops the submit;
    // a weak signal falls back to the last fix rather than losing the survey.
    let fix = latestFix()
    try {
      if (locationError()?.code === 1) throw locationError()
      if (!fix || Date.now() - fix.at > 120000) fix = await getFix()
    } catch (err) {
      if (err?.code === 1) {
        setError(locationMessage(err))
        setStatus('idle')
        return
      }
      fix = latestFix()
    }
    const record = buildRecord(data, getUser(), fix, start.current)
    finished.current = true
    setActivity(`Submitted survey at ${record.outletName || 'outlet'} (${record.outletId})`, true)
    try {
      if (!navigator.onLine) throw new Error('No connection. Could not reach the server.')
      await addSurvey(record)
      setStatus('saved')
    } catch (err) {
      pushQueue(record)
      setQueueWhy(err.message)
      setStatus('queued')
    }
    clearDraft()
    countDone()
    setTimeout(() => navigate('/', { replace: true }), RETURN_HOME_MS)
  }

  if (status === 'saved' || status === 'queued') {
    const saved = status === 'saved'
    return (
      <main className="min-h-full flex flex-col items-center justify-center px-8 text-center safe-top safe-bottom">
        <div className={`anim-pop w-24 h-24 rounded-full flex items-center justify-center shadow-lg ${saved ? 'gold-gradient text-ink' : 'bg-mist text-ink'}`}>
          {saved ? (
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path className="anim-draw" d="M5 12.5l4.5 4.5L19 7.5" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12" /><path className="anim-draw" d="M7 10l5 5 5-5" /><path d="M5 20h14" />
            </svg>
          )}
        </div>
        <h2 className="anim-rise font-serif text-2xl mt-6" style={{ animationDelay: '120ms' }}>{saved ? 'Survey saved. Thank you.' : 'Saved on the phone'}</h2>
        {!saved && <p className="anim-rise text-ink/65 mt-2" style={{ animationDelay: '200ms' }}>Uploads when online</p>}
      </main>
    )
  }

  return (
    <main className="h-full flex flex-col safe-top anim-fade">
      <header className="bg-ink text-paper px-4 pt-3 pb-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-wider text-gold font-semibold">Outlet Survey</p>
            <button type="button" onClick={abandon} className="w-10 h-10 -mr-2 rounded-full text-2xl text-paper/80" aria-label="Abandon survey">
              ×
            </button>
          </div>
          <p className="text-xs text-paper/60 -mt-1 mb-2">
            Started {startTime}
            <span className="text-paper/30"> · </span>
            {startLoc === 'ok' ? <span className="text-gold">Location ±{startFix.accuracy} m</span> : startLoc === 'finding' ? 'Getting location…' : 'No location'}
          </p>
          <div className="grid grid-cols-4 gap-1.5 mt-1">
            {STEPS.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => canJump(i) && go(i)}
                disabled={!canJump(i) || status === 'sending'}
                aria-label={`Go to step ${i + 1}`}
                className="py-2 -my-2 disabled:cursor-default"
              >
                <span className="block h-1.5 rounded-full bg-paper/20 overflow-hidden">
                  <span className={`block h-full rounded-full transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)] ${i <= step ? 'bg-gold' : i <= maxStep ? 'bg-gold/40' : ''}`} style={{ width: i <= maxStep ? '100%' : '0%' }} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </header>

      <div ref={scroller} className="flex-1 overflow-y-auto">
        <div className="max-w-md mx-auto px-5 py-6">
          <div key={step} className={dir > 0 ? 'anim-slide-r' : 'anim-slide-l'}>
            <Step data={data} set={set} />
          </div>
        </div>
      </div>

      <footer className="border-t border-ink/10 bg-paper px-5 pt-3 safe-bottom">
        <div className="max-w-md mx-auto space-y-2">
          {error && <p className="rounded-xl bg-paper border border-ink/15 border-l-4 border-l-gold text-ink text-sm px-4 py-3">{error}</p>}
          <div className="flex gap-3">
            {step > 0 && (
              <Button variant="ghost" className="w-auto! flex-[0_0_32%]" onClick={() => go(step - 1)} disabled={status === 'sending'}>
                Back
              </Button>
            )}
            {last ? (
              <Button variant="gold" onClick={submit} disabled={!ready || status === 'sending'}>
                {status === 'sending' ? <Spinner /> : 'Submit'}
              </Button>
            ) : (
              <Button onClick={() => go(step + 1)} disabled={!ready}>
                Continue
              </Button>
            )}
          </div>
          {step === 2 && (
            <Button variant="quiet" onClick={skipCrates}>
              Skip
            </Button>
          )}
        </div>
      </footer>
      {leaving && (
        <Sheet
          title="Leave this survey?"
          onClose={() => setLeaving(false)}
          footer={
            <div className="space-y-2">
              <Button variant="gold" onClick={() => navigate('/', { replace: true })}>
                Save and continue later
              </Button>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="ghost" onClick={() => setLeaving(false)}>
                  Stay
                </Button>
                <Button onClick={discard}>Discard</Button>
              </div>
            </div>
          }
        >
          <p className="text-sm text-ink/70">Your answers are saved on the phone. You can carry on from the home screen.</p>
        </Sheet>
      )}
    </main>
  )
}
