import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

// Supabase-Client für den Admin-Bereich. Öffentliche Client-Keys (RLS schützt
// die Daten). Projekt: SVA-Tabellen mit Prefix sm_ im Default-Projekt.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

if (!url || !anonKey) {
  // Früh & deutlich scheitern, wenn die Env-Variablen fehlen (Netlify/lokal).
  throw new Error(
    'Supabase-Env fehlt: VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY setzen (.env bzw. Netlify).',
  )
}

export const supabase = createClient<Database>(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true, // Magic-Link-Callback aus der URL verarbeiten
  },
})
