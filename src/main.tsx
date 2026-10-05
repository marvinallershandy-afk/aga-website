import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'

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

if (!isAdmin && authReturn) {
  window.location.replace('/admin' + window.location.search + window.location.hash)
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
  })
}
