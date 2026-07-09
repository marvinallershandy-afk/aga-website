import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { AdminApp } from './AdminApp'

// Eigener Mount-Pfad für den Admin-Bereich (getrennt vom 3D-Onepager).
// Wird von main.tsx nur geladen, wenn die URL mit /admin beginnt →
// der Onepager lädt niemals Supabase/Tailwind, der Admin niemals three.js.
export function mountAdmin(rootEl: HTMLElement) {
  createRoot(rootEl).render(
    <StrictMode>
      <AdminApp />
    </StrictMode>,
  )
}
