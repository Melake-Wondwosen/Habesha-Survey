import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { getUser } from '../storage'
import { homeFor } from '../roles'
import { MovingPattern, WatchingLogo } from '../components/ui'
import SignInForm from '../components/SignInForm'

export default function Login() {
  const navigate = useNavigate()
  const current = getUser()
  // The logo watches you type, then looks puzzled once you stop
  const [face, setFace] = useState({ mood: 'idle', field: null, progress: 0 })
  const idle = useRef(null)
  useEffect(() => () => clearTimeout(idle.current), [])
  function watch(field, value, both) {
    setFace({ mood: 'watch', field, progress: value.length / 16 })
    clearTimeout(idle.current)
    idle.current = setTimeout(() => setFace((f) => ({ ...f, mood: both.username || both.password ? 'confused' : 'idle' })), 1300)
  }

  // Pressing Sign in: she looks at you; a failed sign-in puzzles her again
  function status(st) {
    clearTimeout(idle.current)
    setFace((f) => ({ ...f, mood: st === 'signing' ? 'idle' : 'confused' }))
  }

  if (current?.token) return <Navigate to={homeFor(current)} replace />

  return (
    <main className="login-glass min-h-full flex flex-col safe-top safe-bottom relative overflow-hidden bg-ink text-paper">
      {/* Backdrop: drifting gold glows, a soft vignette and fine grain */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <span className="glow glow-a" />
        <span className="glow glow-b" />
        <span className="glow glow-c" />
        <span className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.75)_100%)]" />
        <span className="grain absolute inset-0" />
      </div>

      <div className="relative flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto stagger">
        <div className="relative mx-auto" style={{ '--i': 0 }}>
          <span aria-hidden="true" className="absolute inset-0 -m-10 rounded-full bg-gold/35 blur-3xl" />
          <WatchingLogo className="relative w-32" glow mood={face.mood} field={face.field} progress={face.progress} />
        </div>
        <MovingPattern className="mt-5 -mx-6" style={{ '--i': 1 }} />
        <div style={{ '--i': 2 }} className="text-center mt-6">
          <h1 className="text-[30px] leading-tight font-bold tracking-tight">Outlet Survey</h1>
          <p className="text-paper/60 mt-1.5 text-[15px]">Sign in to start your outlet visits</p>
        </div>
        <div className="mt-7" style={{ '--i': 3 }}>
          <SignInForm onWatch={watch} onStatus={status} onDone={(u) => navigate(homeFor(u), { replace: true })} />
        </div>
      </div>
    </main>
  )
}
