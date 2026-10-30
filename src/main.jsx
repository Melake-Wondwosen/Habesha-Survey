import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { startGuard } from './guard'
import './index.css'

startGuard()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
