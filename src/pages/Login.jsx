import { Navigate, useNavigate } from 'react-router'
import { getUser } from '../storage'
import { homeFor } from '../roles'
import { Logo, Pattern } from '../components/ui'
import SignInForm from '../components/SignInForm'

export default function Login() {
  const navigate = useNavigate()
  const current = getUser()
  if (current?.token) return <Navigate to={homeFor(current)} replace />

  return (
    <main className="min-h-full flex flex-col safe-top safe-bottom">
      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md w-full mx-auto stagger">
        <Logo className="w-36 mx-auto" style={{ '--i': 0 }} />
        <Pattern className="mt-6 opacity-90" style={{ '--i': 1 }} />
        <div style={{ '--i': 2 }}>
          <h1 className="font-serif text-2xl text-center mt-6">Outlet Survey</h1>
        </div>
        <div className="mt-8" style={{ '--i': 3 }}>
          <SignInForm onDone={(u) => navigate(homeFor(u), { replace: true })} />
        </div>
      </div>
    </main>
  )
}
