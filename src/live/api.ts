// ─────────────────────────────────────────────────────────────
// v15-L: Lesezugriff auf web_live() — reines fetch, KEIN Supabase-SDK.
// anon-Key aus der Vite-Env (öffentlicher Client-Key, RLS/SECURITY DEFINER
// schützen die Daten). Keine Cookies, keine Credentials.
// ─────────────────────────────────────────────────────────────
import type { LiveData } from './model'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const liveKonfiguriert = !!(URL_BASE && KEY)

/** demo = true → web_live_demo() (v18-T: NUR das Vorführ-Spiel, /live?vorfuehrung=1). */
export async function fetchLive(signal?: AbortSignal, demo = false): Promise<LiveData> {
  if (!URL_BASE || !KEY) throw new Error('Live-Daten sind nicht eingerichtet.')
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/${demo ? 'web_live_demo' : 'web_live'}`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: '{}',
    credentials: 'omit',
    cache: 'no-store',
    signal,
  })
  if (!r.ok) throw new Error(`Live-Daten nicht erreichbar (${r.status})`)
  const data = (await r.json()) as LiveData
  if (!data || typeof data !== 'object' || !Array.isArray(data.events)) throw new Error('Unerwartete Antwort')
  return data
}
