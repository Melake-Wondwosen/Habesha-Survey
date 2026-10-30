import { Navigate, useNavigate } from 'react-router'
import { getUser } from '../storage'
import { homeFor } from '../roles'
import { Logo, MovingPattern } from '../components/ui'
import SignInForm from '../components/SignInForm'

export default function Login() {
  const navigate = useNavigate()
  const current = getUser()
  const hour = new Date().getHours()
  // Night look from 6 pm to 6 am
  const night = hour >= 18 || hour < 6
  if (current?.token) return <Navigate to={homeFor(current)} replace />

  return (
    <main className={`min-h-full flex flex-col safe-top safe-bottom relative overflow-hidden ${night ? 'login-night bg-ink text-paper' : ''}`}>
      <div className="relative flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto stagger">
        <div className="relative mx-auto" style={{ '--i': 0 }}>
          {night && <span aria-hidden="true" className="absolute inset-0 -m-10 rounded-full bg-gold/45 blur-3xl" />}
          <Logo className={`relative w-36 ${night ? 'logo-night' : ''}`} />
        </div>
        <MovingPattern className="mt-6 -mx-6" style={{ '--i': 1 }} />
        <div style={{ '--i': 2 }} className="text-center mt-6">
          <h1 className="font-serif text-2xl">Outlet Survey</h1>
        </div>
        <div className={`mt-8 ${night ? 'rounded-3xl bg-paper text-ink p-6 shadow-2xl' : ''}`} style={{ '--i': 3 }}>
          <SignInForm onDone={(u) => navigate(homeFor(u), { replace: true })} />
        </div>
      </div>
    </main>
  )
}
