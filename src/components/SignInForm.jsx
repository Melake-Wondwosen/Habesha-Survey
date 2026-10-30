import { useState } from 'react'
import { login } from '../api'
import { getFix, locationMessage } from '../location'
import { setUser } from '../storage'
import { Button, Field, Notice, Spinner, inputClass } from './ui'

// Shared by the main sign-in page and the admin sign-in page.
// `need` = 'admin' makes the server turn away anyone who isn't an admin.
export default function SignInForm({ need, onDone, submitLabel = 'Sign in' }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')

  async function submit(e) {
    e.preventDefault()
    if (!username.trim() || !password) return
    setError('')

    // Location is captured at every sign-in. The server refuses BAs without it;
    // managers and admins on a PC may not have one, so they get through.
    setBusy('Getting your location…')
    let fix = null
    let fixError = null
    try {
      fix = await getFix()
    } catch (err) {
      fixError = err
    }

    setBusy('Signing in…')
    try {
      const user = await login(username, password, fix, need)
      setUser(user)
      onDone(user)
    } catch (err) {
      setError(/location is required/i.test(err.message) ? locationMessage(fixError) : err.message)
      setBusy('')
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Username">
        <input
          className={inputClass}
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck="false"
          required
        />
      </Field>
      <Field label="Password">
        <input className={inputClass} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
      </Field>

      {error && <Notice>{error}</Notice>}

      <Button type="submit" disabled={!!busy || !username.trim() || !password}>
        {busy ? (
          <span className="inline-flex items-center gap-2">
            <Spinner /> {busy}
          </span>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  )
}
