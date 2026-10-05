import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './partner.css'
import { PartnerApp } from './PartnerApp'

// v16-S: Einstieg von partner.html (Netlify: /partner → /partner.html).
// Eigenes schlankes Bundle: kein three.js, kein Supabase-SDK, keine
// Onepager-CSS. Inhalte sind zur Build-Zeit eingebacken (Overlay); nur das
// Absenden der Anfrage spricht Supabase an (src/partner/api.ts).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PartnerApp />
  </StrictMode>,
)
