import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './album.css'
import { AlbumApp } from './AlbumApp'

// v17-A: Einstieg von album.html (Netlify: /album → /album.html).
// Eigenes schlankes Bundle: kein three.js, keine Onepager-CSS.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AlbumApp />
  </StrictMode>,
)
