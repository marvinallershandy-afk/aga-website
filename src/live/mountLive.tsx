import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './live.css'
import { LiveApp } from './LiveApp'
import { starteZaehlung } from '../statistik/zaehlen'

// v15-L: Eigener Mount der Live-Seite (/live). Lädt weder three.js noch
// Supabase-SDK noch Onepager-CSS — nur React + dieses Modul.
export function mountLive(rootEl: HTMLElement) {
  createRoot(rootEl).render(
    <StrictMode>
      <LiveApp />
    </StrictMode>,
  )
  starteZaehlung() // v18-A: cookiefreie Tageszählung (nach dem ersten Bild)
}
