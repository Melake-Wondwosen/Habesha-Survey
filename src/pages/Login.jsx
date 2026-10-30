import { useMemo } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { getUser } from '../storage'
import { homeFor } from '../roles'
import { Logo, MovingPattern } from '../components/ui'
import SignInForm from '../components/SignInForm'

// Amharic and English greeting for the time of day
function greeting(h) {
  if (h >= 5 && h < 12) return ['እንደምን አደሩ', 'Good morning']
  if (h >= 12 && h < 18) return ['እንደምን ዋሉ', 'Good afternoon']
  return ['እንደምን አመሹ', 'Good evening']
}

// Gold flecks drifting up behind the form. Fixed seed, so they don't jump on re-render.
function Flecks({ count = 26 }) {
  const dots = useMemo(() => {
    let seed = 11
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    return Array.from({ length: count }, () => ({
      left: r() * 100,
      size: 2 + r() * 4,
      dur: 14 + r() * 16,
      delay: -r() * 30,
      sway: (r() - 0.5) * 60,
      alpha: 0.35 + r() * 0.5,
    }))
  }, [count])
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      {dots.map((d, i) => (
        <span
          key={i}
          className="fleck"
          style={{ left: `${d.left}%`, width: d.size, height: d.size, animationDuration: `${d.dur}s`, animationDelay: `${d.delay}s`, '--sway': `${d.sway}px`, '--alpha': d.alpha }}
        />
      ))}
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const current = getUser()
  const hour = new Date().getHours()
  // Night look from 6 pm to 6 am
  const night = hour >= 18 || hour < 6
  const [am, en] = greeting(hour)
  if (current?.token) return <Navigate to={homeFor(current)} replace />

  return (
    <main className={`min-h-full flex flex-col safe-top safe-bottom relative overflow-hidden ${night ? 'login-night bg-ink text-paper' : ''}`}>
      <Flecks />
      <div className="relative flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto stagger">
        <div className="relative mx-auto" style={{ '--i': 0 }}>
          {night && <span aria-hidden="true" className="absolute inset-0 -m-10 rounded-full bg-gold/45 blur-3xl" />}
          <Logo className={`relative w-36 ${night ? 'logo-night' : ''}`} />
        </div>
        <MovingPattern className="mt-6 -mx-6" style={{ '--i': 1 }} />
        <div style={{ '--i': 2 }} className="text-center mt-6">
          <h1 className="font-serif text-2xl">Outlet Survey</h1>
          <p className={`mt-1.5 text-sm ${night ? 'text-gold' : 'text-gold-dark'}`}>
            <span className="font-semibold">{am}</span>
            <span className={night ? 'text-paper/40' : 'text-ink/30'}> · </span>
            {en}
          </p>
        </div>
        <div className={`mt-8 ${night ? 'rounded-3xl bg-paper text-ink p-6 shadow-2xl' : ''}`} style={{ '--i': 3 }}>
          <SignInForm onDone={(u) => navigate(homeFor(u), { replace: true })} />
        </div>
      </div>
    </main>
  )
}
