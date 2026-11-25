import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { melaStart } from './mela'
import { startGuard } from './guard'
import './index.css'

startGuard()

// Opened from MELA: sign in with its ticket first, then show the app.
melaStart().finally(() => {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
})
