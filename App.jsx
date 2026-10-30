import { lazy, Suspense, useEffect, useState } from 'react'
import { BrowserRouter, HashRouter, Navigate, Route, Routes } from 'react-router'
import { DEMO } from './config'
import { getUser } from './storage'
import { isLocked, onLock } from './guard'
import { startPresence } from './presence'
import { homeFor } from './roles'
import Login from './pages/Login'
import Home from './pages/Home'
import Survey from './pages/Survey'
import { Emblem, Spinner } from './components/ui'

// Manager and admin screens only download for those roles
const Manager = lazy(() => import('./manager/Manager'))
const Admin = lazy(() => import('./admin/Admin'))
const AdminLogin = lazy(() => import('./admin/AdminLogin'))

// Demo bundles are opened from arbitrary paths, so they route on the hash.
const Router = DEMO ? HashRouter : BrowserRouter

function RequireRole({ roles, login = '/login', children }) {
  const user = getUser()
  // Sessions from before tokens existed have to sign in again
  if (!user?.token) return <Navigate to={login} replace />
  if (!roles.includes(user.role)) return <Navigate to={homeFor(user)} replace />
  return children
}

function BaShell({ children }) {
  useEffect(() => {
    startPresence()
  }, [])
  return children
}

const Loading = () => (
  <div className="h-full flex items-center justify-center text-ink/60">
    <Spinner />
  </div>
)

function LockScreen() {
  return (
    <div className="anim-fade fixed inset-0 z-[9999] bg-ink text-paper flex flex-col items-center justify-center text-center px-8">
      <Emblem className="w-16 h-16 anim-pop" />
      <h1 className="font-serif text-2xl mt-5 anim-rise">App locked</h1>
      <p className="text-paper/75 mt-2 max-w-xs anim-rise">Close developer tools and reopen the app.</p>
    </div>
  )
}

export default function App() {
  const [locked, setLocked] = useState(isLocked)
  useEffect(() => onLock(setLocked), [])
  if (locked) return <LockScreen />

  return (
    <Router>
      <Suspense fallback={<Loading />}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/" element={<RequireRole roles={['ba']}><BaShell><Home /></BaShell></RequireRole>} />
          <Route path="/survey" element={<RequireRole roles={['ba']}><BaShell><Survey /></BaShell></RequireRole>} />
          <Route path="/manager" element={<RequireRole roles={['manager', 'admin']}><Manager /></RequireRole>} />
          <Route path="/admin" element={<RequireRole roles={['admin']} login="/admin/login"><Admin /></RequireRole>} />
          <Route path="*" element={<Navigate to={homeFor(getUser())} replace />} />
        </Routes>
      </Suspense>
    </Router>
  )
}
