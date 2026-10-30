import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { addSurvey } from '../api'
import { getFix, latestFix, locationError, locationMessage } from '../location'
import { setActivity } from '../presence'
import { RETURN_HOME_MS } from '../config'
import { countDone, getUser, pushQueue, setQueueWhy } from '../storage'
import { Button, Sheet, Spinner } from '../components/ui'
import { StepCrates, StepOutlet, StepRank, StepReason, stepReady } from '../components/steps'

const EMPTY = { outletName: '', outletId: '', area: '', picked: false, order: [], otherBrand: '', crates: {}, reason: '', reasonOther: '' }
const STEPS = [StepOutlet, StepRank, StepCrates, StepReason]

function makeId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let tail = ''
  for (let i = 0; i < 6; i++) tail += chars[Math.floor(Math.random() * chars.length)]
  return `SRV-${Date.now()}-${tail}`
}

function buildRecord(d, user, location) {
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
    ranks,
    crates,
    otherBrandName: otherRanked ? d.otherBrand.trim() : '',
    reason: d.reason,
    reasonOther: d.reason === 'Other' ? d.reasonOther.trim() : '',
  }
}

export default function Survey() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [dir, setDir] = useState(1)
  const [data, setData] = useState(EMPTY)
  const [status, setStatus] = useState('idle') // idle | sending | saved | queued
  const scroller = useRef(null)

  const set = (patch) => setData((d) => ({ ...d, ...patch }))
  const ready = stepReady[step](data)
  const Step = STEPS[step]
  const last = step === STEPS.length - 1

  const [error, setError] = useState('')

  useEffect(() => {
    scroller.current?.scrollTo(0, 0)
    const where = data.outletName.trim() ? `${data.outletName.trim()} (${data.outletId.trim()})` : ''
    setActivity(step === 0 ? 'Starting a survey' : `Surveying ${where}, step ${step + 1} of 4`, step === 1)
  }, [step])

  // In-app dialog, since some browsers and embedded views block window.confirm
  const [discarding, setDiscarding] = useState(false)
  function abandon() {
    const touched = JSON.stringify(data) !== JSON.stringify(EMPTY)
    if (touched) setDiscarding(true)
    else navigate('/', { replace: true })
  }

  function go(to) {
    setDir(to > step ? 1 : -1)
    setStep(to)
  }

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
    const record = buildRecord(data, getUser(), fix)
    setActivity(`Submitted survey at ${record.outletName} (${record.outletId})`, true)
    try {
      if (!navigator.onLine) throw new Error('No connection. Could not reach the server.')
      await addSurvey(record)
      setStatus('saved')
    } catch (err) {
      pushQueue(record)
      setQueueWhy(err.message)
      setStatus('queued')
    }
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
          <div className="grid grid-cols-4 gap-1.5 mt-1">
            {STEPS.map((_, i) => (
              <span key={i} className="h-1.5 rounded-full bg-paper/20 overflow-hidden">
                <span className="block h-full rounded-full bg-gold transition-[width] duration-500 ease-[cubic-bezier(.22,1,.36,1)]" style={{ width: i <= step ? '100%' : '0%' }} />
              </span>
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
      {discarding && (
        <Sheet
          title="Discard survey?"
          onClose={() => setDiscarding(false)}
          footer={
            <div className="grid grid-cols-2 gap-3">
              <Button variant="ghost" onClick={() => setDiscarding(false)}>
                Keep
              </Button>
              <Button onClick={() => navigate('/', { replace: true })}>Discard</Button>
            </div>
          }
        />
      )}
    </main>
  )
}
