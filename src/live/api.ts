// ─────────────────────────────────────────────────────────────
// v15-L: Lesezugriff auf web_live() — reines fetch, KEIN Supabase-SDK.
// anon-Key aus der Vite-Env (öffentlicher Client-Key, RLS/SECURITY DEFINER
// schützen die Daten). Keine Cookies, keine Credentials.
// ─────────────────────────────────────────────────────────────
import type { LiveData } from './model'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const liveKonfiguriert = !!(URL_BASE && KEY)

function pruefe(data: unknown): LiveData {
  if (!data || typeof data !== 'object' || !Array.isArray((data as LiveData).events)) throw new Error('Unerwartete Antwort')
  return data as LiveData
}

/** Direkter RPC gegen Supabase (Anon-Key). Fallback bzw. Vorführung. */
async function fetchLiveRpc(signal?: AbortSignal, demo = false): Promise<LiveData> {
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
  return pruefe(await r.json())
}

/** demo = true → web_live_demo() (v18-T: NUR das Vorführ-Spiel, /live?vorfuehrung=1).
 *
 * v25-C5: Das öffentliche Polling (nicht die Vorführung) geht über die Netlify-
 * Function /api/live — sie cacht web_live() 10 s im CDN und entlastet die DB am
 * Spieltag. Schlägt der Edge-Endpunkt fehl (lokaler Dev, Netz, 5xx), fällt der
 * Abruf still auf den direkten RPC zurück. Die Vorführung bleibt direkt. */
export async function fetchLive(signal?: AbortSignal, demo = false): Promise<LiveData> {
  if (demo) return fetchLiveRpc(signal, true)
  try {
    const r = await fetch('/api/live', { method: 'GET', credentials: 'omit', signal })
    if (!r.ok) throw new Error(`api/live ${r.status}`)
    return pruefe(await r.json())
  } catch (e) {
    // Abbruch (Komponente weg) nicht als Fehler „verschlucken“ → weiterreichen.
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    return fetchLiveRpc(signal, false)
  }
}
