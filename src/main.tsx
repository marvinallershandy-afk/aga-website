import '@fontsource/anton/400.css'
import '@fontsource-variable/archivo/index.css'

const rootEl = document.getElementById('root')!

// Routen-Weiche, ohne den öffentlichen 3D-Onepager anzufassen:
//   /admin* → Admin-Sub-App (Supabase/Tailwind, eigenes Bundle)
//   sonst   → bestehender Onepager (three/R3F, eigenes Bundle)
// Beide Zweige laden dynamisch → getrennte Chunks. Der Onepager lädt niemals
// Supabase/Tailwind, der Admin niemals three.js. Wichtig: index.css/cards.css
// (u. a. `scroll-snap-type` auf <html>) werden NUR im Onepager-Zweig geladen,
// damit sie das Admin-Scrolling nicht kapern.
const isAdmin = window.location.pathname.startsWith('/admin')

if (isAdmin) {
  import('./admin/mountAdmin').then(({ mountAdmin }) => mountAdmin(rootEl))
} else {
  Promise.all([
    import('./index.css'),
    import('./ui/cards.css'),
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
