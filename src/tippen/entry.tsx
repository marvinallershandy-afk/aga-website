import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './tippen.css'
import { TippApp } from './TippApp'
import { starteZaehlung } from '../statistik/zaehlen'

// v20-T: Einstieg von tippen.html (Netlify: /tippen → /tippen.html).
// Eigenes schlankes Bundle: kein three.js. Der statische Inhalt in
// tippen.html (für Crawler/OG/ohne JS) wird beim Mount ersetzt.
const root = document.getElementById('root')!
root.innerHTML = ''
createRoot(root).render(
  <StrictMode>
    <TippApp />
  </StrictMode>,
)
starteZaehlung()
