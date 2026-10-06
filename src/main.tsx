import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'

// v18-A: cookiefreie Zählung — Modul früh laden (merkt utm_*/Referrer, bevor
// das Karten-Routing die Adresse normalisiert); gezählt wird erst im Leerlauf.
import { starteZaehlung } from './statistik/zaehlen'

const rootEl = document.getElementById('root')!

// Routen-Weiche, ohne den öffentlichen 3D-Onepager anzufassen:
//   /admin* → Admin-Sub-App (Supabase/Tailwind, eigenes Bundle)
//   /live   → v15-L Live-Seite (React + fetch, eigenes schlankes Bundle).
//             In Produktion liefert Netlify /live direkt als live.html aus
//             (eigene OG-Meta, kein vorgerenderter Onepager); dieser Zweig
//             greift im Dev-Server und als Rückfallebene.
//   sonst   → bestehender Onepager (three/R3F, eigenes Bundle)
// Beide Zweige laden dynamisch → getrennte Chunks. Der Onepager lädt niemals
// Supabase/Tailwind, der Admin niemals three.js. Wichtig: index.css/cards.css
// (u. a. `scroll-snap-type` auf <html>) werden NUR im Onepager-Zweig geladen,
// damit sie das Admin-Scrolling nicht kapern.
const isAdmin = window.location.pathname.startsWith('/admin')
const isLive = /^\/live(\/|\.html)?$/.test(window.location.pathname)

// v14: Magic-Link-Rückkehr abfangen. Ist die Ziel-URL nicht in Supabases
// Redirect-Allowlist, schickt Supabase auf die Site-URL (Startseite) — die
// Tokens hängen dann an der Startseite, wo der Onepager sie ignoriert.
// Auth-Parameter außerhalb von /admin → mit Parametern nach /admin umleiten.
const authReturn =
  /(^|[#&])(access_token|refresh_token|error_description)=/.test(window.location.hash) ||
  /[?&](code|token_hash)=/.test(window.location.search)

// v21-A: Fan-Logins (Album/Tipp-Liga) NICHT ins Admin schicken — sonst landet
// die Fan-Sitzung im Admin-Speicher und der Fan ist im Album nicht angemeldet.
// Erkennung: Merker aus dem Album (gleicher Browser) oder user_metadata.app im
// Zugangs-Token (Link in einem anderen Browser geöffnet).
function authZiel(): string {
  try {
    const m = JSON.parse(localStorage.getItem('sva-login-ziel') || 'null') as { pfad?: string; t?: number } | null
    if (m?.pfad && /^\/(album|tippen|admin)$/.test(m.pfad) && Date.now() - (m.t ?? 0) < 24 * 3600_000) return m.pfad
  } catch {
    /* egal */
  }
  try {
    const at = /(?:^|[#&])access_token=([^&]+)/.exec(window.location.hash)?.[1]
    const teil = at?.split('.')[1]
    if (teil) {
      const claims = JSON.parse(atob(teil.replace(/-/g, '+').replace(/_/g, '/'))) as { user_metadata?: { app?: string } }
      if (claims.user_metadata?.app === 'sva-album') return '/album'
    }
  } catch {
    /* kein JWT → Admin */
  }
  return '/admin'
}

if (!isAdmin && authReturn) {
  window.location.replace(authZiel() + window.location.search + window.location.hash)
} else if (isAdmin) {
  import('./admin/mountAdmin').then(({ mountAdmin }) => mountAdmin(rootEl))
} else if (isLive) {
  rootEl.innerHTML = '' // vorgerenderten Onepager-DOM nicht aufblitzen lassen
  import('./live/mountLive').then(({ mountLive }) => mountLive(rootEl))
} else {
  Promise.all([
    import('./index.css'),
    import('./ui/cards.css'), // v17-D: Designsystem-Schicht steht am Ende von cards.css
    import('react'),
    import('react-dom/client'),
    import('./App'),
    import('./store/useStore'),
  ]).then(([, , { StrictMode }, { createRoot }, { default: App }, { useStore }]) => {
    if (import.meta.env.DEV) {
      ;(window as unknown as { useStore: typeof useStore }).useStore = useStore
    }
    createRoot(rootEl).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
    starteZaehlung()
  })
}
