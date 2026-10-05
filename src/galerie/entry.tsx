import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './galerie-page.css'
import { GalerieApp } from './GalerieApp'

// v17-D: Einstieg von galerie.html (Netlify: /galerie → /galerie.html).
// Eigenes schlankes Bundle: kein three.js, kein Supabase-SDK, keine
// Onepager-CSS. Galerien sind zur Build-Zeit eingebacken (Overlay/Seed).
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GalerieApp />
  </StrictMode>,
)
