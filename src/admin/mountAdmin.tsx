import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './AdminApp'

// v15-P: Web-App-Manifest NUR für /admin („SVA Pflege" als App-Symbol auf
// dem Homescreen, Kurzbefehl „Live-Ticker"). index.html ist mit dem Onepager
// geteilt → Link + Apple-Metas werden hier zur Laufzeit gesetzt; iOS/Chrome
// lesen sie beim „Zum Home-Bildschirm".
function installAdminManifest() {
  const head = document.head
  const set = (sel: string, make: () => HTMLElement) => {
    if (!head.querySelector(sel)) head.appendChild(make())
  }
  set('link[rel="manifest"]', () => Object.assign(document.createElement('link'), { rel: 'manifest', href: '/admin.webmanifest' }))
  const meta = (name: string, content: string) =>
    set(`meta[name="${name}"]`, () => Object.assign(document.createElement('meta'), { name, content }))
  meta('apple-mobile-web-app-capable', 'yes')
  meta('mobile-web-app-capable', 'yes')
  meta('apple-mobile-web-app-title', 'SVA Pflege')
  meta('apple-mobile-web-app-status-bar-style', 'black-translucent')
  // Homescreen-Symbol: quadratisches Wappen statt des Onepager-Icons
  const touch = head.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]')
  if (touch) touch.href = '/brand/pflege/apple-touch-icon.png'
  else set('link[rel="apple-touch-icon"]', () => Object.assign(document.createElement('link'), { rel: 'apple-touch-icon', href: '/brand/pflege/apple-touch-icon.png' }))
  document.title = 'SVA Pflege'
}

// Eigener Mount-Pfad für den Admin-Bereich (getrennt vom 3D-Onepager).
// Wird von main.tsx nur geladen, wenn die URL mit /admin beginnt →
// der Onepager lädt niemals Supabase/Tailwind, der Admin niemals three.js.
export function mountAdmin(rootEl: HTMLElement) {
  installAdminManifest()
  createRoot(rootEl).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  )
}
