import { Buffer } from 'buffer'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Polyfill Buffer for libraries that depend on it
if (typeof window !== 'undefined') {
  window.Buffer = Buffer
  window.global = window
}

import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
