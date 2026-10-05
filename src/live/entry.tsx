import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'
import { mountLive } from './mountLive'

// v15-L: Einstieg von live.html (Netlify: /live → /live.html). Eigene HTML-
// Seite = eigene OG-Meta + kein vorgerenderter Onepager-DOM im #root.
mountLive(document.getElementById('root')!)
