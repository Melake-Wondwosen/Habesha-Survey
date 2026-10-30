import { Link, Navigate, useNavigate } from 'react-router'
import { getUser } from '../storage'
import { homeFor } from '../roles'
import { Emblem, Pattern } from '../components/ui'
import SignInForm from '../components/SignInForm'

export default function AdminLogin() {
  const navigate = useNavigate()
  const current = getUser()
  if (current?.token) return <Navigate to={homeFor(current)} replace />

  return (
    <main className="min-h-full bg-ink text-paper flex flex-col safe-top safe-bottom relative overflow-hidden">
      <Pattern className="absolute -top-6 left-1/2 -translate-x-1/2 max-w-none! w-[720px] opacity-[0.07] anim-fade" />
      <div className="flex-1 flex flex-col justify-center px-6 py-10 w-full max-w-md mx-auto relative stagger">
        <div className="flex items-center gap-3" style={{ '--i': 0 }}>
          <Emblem className="w-14 h-14" />
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-gold">Outlet Survey</p>
            <h1 className="font-serif text-3xl">Admin console</h1>
          </div>
        </div>
        <div className="mt-8 rounded-3xl bg-paper text-ink p-6 shadow-2xl" style={{ '--i': 2 }}>
 <SignInForm need="admin" onDone={() => navigate('/admin', { replace: true })} />
        </div>
        <Link to="/login" className="mt-6 mx-auto text-xs text-paper/50 link-hover hover:text-paper/80" style={{ '--i': 3 }}>
          Field sign-in
        </Link>
      </div>
    </main>
  )
}
