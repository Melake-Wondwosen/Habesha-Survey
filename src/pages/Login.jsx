import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { getUser } from '../storage'
import { homeFor } from '../roles'
import { MovingPattern, WatchingLogo } from '../components/ui'
import SignInForm from '../components/SignInForm'

export default function Login() {
  const navigate = useNavigate()
  const current = getUser()
  const hour = new Date().getHours()
  // Night look from 6 pm to 6 am
  const night = hour >= 18 || hour < 6
  // The logo watches you type, then looks puzzled once you stop
  const [face, setFace] = useState({ mood: 'idle', field: null, progress: 0 })
  const idle = useRef(null)
  useEffect(() => () => clearTimeout(idle.current), [])
  function watch(field, value, both) {
    setFace({ mood: 'watch', field, progress: value.length / 16 })
    clearTimeout(idle.current)
    idle.current = setTimeout(() => setFace((f) => ({ ...f, mood: both.username || both.password ? 'confused' : 'idle' })), 1300)
  }

  // Pressing Sign in makes her smile; a failed sign-in puzzles her again
  function status(st) {
    clearTimeout(idle.current)
    setFace((f) => ({ ...f, mood: st === 'signing' ? 'happy' : 'confused' }))
  }

  if (current?.token) return <Navigate to={homeFor(current)} replace />

  return (
    <main className={`min-h-full flex flex-col safe-top safe-bottom relative overflow-hidden ${night ? 'login-night bg-ink text-paper' : ''}`}>
      <div className="relative flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto stagger">
        <div className="relative mx-auto" style={{ '--i': 0 }}>
          {night && <span aria-hidden="true" className="absolute inset-0 -m-10 rounded-full bg-gold/45 blur-3xl" />}
          <WatchingLogo className="relative w-36" glow={night} mood={face.mood} field={face.field} progress={face.progress} />
        </div>
        <MovingPattern className="mt-6 -mx-6" style={{ '--i': 1 }} />
        <div style={{ '--i': 2 }} className="text-center mt-6">
          <h1 className="font-serif text-2xl">Outlet Survey</h1>
        </div>
        <div className={`mt-8 ${night ? 'rounded-3xl bg-paper text-ink p-6 shadow-2xl' : ''}`} style={{ '--i': 3 }}>
          <SignInForm onWatch={watch} onStatus={status} onDone={(u) => navigate(homeFor(u), { replace: true })} />
        </div>
      </div>
    </main>
  )
}
