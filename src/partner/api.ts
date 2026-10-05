// ─────────────────────────────────────────────────────────────
// v16-S: Anfrage absenden — RPC partner_anfrage() per fetch, KEIN Supabase-SDK.
// anon-Key aus der Vite-Env (öffentlicher Client-Key). Keine Cookies.
// Die RPC validiert, bremst (Rate-Limit) und speichert serverseitig.
// ─────────────────────────────────────────────────────────────
import { zaehleEreignis } from '../statistik/zaehlen'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const anfrageKonfiguriert = !!(URL_BASE && KEY)

export interface AnfrageDaten {
  firma: string
  name: string
  email: string
  telefon: string
  /** DB-Paket-ID (uuid) oder null */
  paketId: string | null
  nachricht: string
  datenschutz: boolean
  /** Honeypot (Menschen lassen es leer) */
  website: string
  dauerMs: number
  quelle: string | null
}

export type Feld = 'firma' | 'name' | 'email' | 'telefon' | 'nachricht' | 'datenschutz'

export class AnfrageFehler extends Error {
  art: 'feld' | 'limit' | 'nicht-verfuegbar' | 'netz'
  feld?: Feld
  constructor(art: AnfrageFehler['art'], message: string, feld?: Feld) {
    super(message)
    this.art = art
    this.feld = feld
  }
}

const FELD_TEXT: Record<Feld, string> = {
  firma: 'Bitte den Namen deines Unternehmens eintragen.',
  name: 'Bitte deinen Namen eintragen.',
  email: 'Diese E-Mail-Adresse sieht nicht richtig aus.',
  telefon: 'Telefon bitte nur mit Ziffern, Leerzeichen, + oder /.',
  nachricht: 'Die Nachricht ist zu lang (max. 2000 Zeichen).',
  datenschutz: 'Bitte bestätige den Datenschutz-Hinweis.',
}
export const feldText = (f: Feld) => FELD_TEXT[f]

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function sendeAnfrage(d: AnfrageDaten, signal?: AbortSignal): Promise<void> {
  if (!URL_BASE || !KEY) throw new AnfrageFehler('nicht-verfuegbar', 'Das Formular ist auf dieser Seite noch nicht verbunden.')
  let r: Response
  try {
    r = await fetch(`${URL_BASE}/rest/v1/rpc/partner_anfrage`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        p_firma: d.firma,
        p_name: d.name,
        p_email: d.email,
        p_telefon: d.telefon || null,
        p_paket_id: d.paketId && UUID.test(d.paketId) ? d.paketId : null,
        p_nachricht: d.nachricht || null,
        p_datenschutz: d.datenschutz,
        p_website: d.website || null,
        p_dauer_ms: Math.round(d.dauerMs),
        p_quelle: d.quelle,
      }),
      credentials: 'omit',
      cache: 'no-store',
      signal,
    })
  } catch {
    throw new AnfrageFehler('netz', 'Keine Verbindung. Bitte prüf dein Netz und versuch es noch mal.')
  }
  if (r.ok) {
    zaehleEreignis('partner-anfrage') // v18-A: Ziel „Sponsoren“
    return
  }
  let msg = ''
  let code = ''
  try {
    const j = (await r.json()) as { message?: string; code?: string }
    msg = j.message ?? ''
    code = j.code ?? ''
  } catch {
    /* leer */
  }
  const feld = /partner_anfrage_ungueltig:(\w+)/.exec(msg)?.[1] as Feld | undefined
  if (feld && feld in FELD_TEXT) throw new AnfrageFehler('feld', FELD_TEXT[feld], feld)
  if (/partner_anfrage_limit/.test(msg)) {
    throw new AnfrageFehler('limit', 'Gerade kamen sehr viele Anfragen an. Bitte versuch es in einer Stunde noch einmal — oder schreib uns direkt.')
  }
  if (r.status === 404 || code === 'PGRST202' || code === '42883') {
    throw new AnfrageFehler('nicht-verfuegbar', 'Das Formular ist gerade nicht erreichbar.')
  }
  throw new AnfrageFehler('netz', `Das hat nicht geklappt (${r.status}). Bitte versuch es noch einmal — oder schreib uns direkt.`)
}

/** utm_source/ref aus der URL → Kanal („instagram"), sonst null. */
export function quelleAusUrl(): string | null {
  try {
    const q = new URLSearchParams(window.location.search)
    const v = (q.get('utm_source') || q.get('ref') || '').toLowerCase().trim()
    return /^[a-z0-9_.-]{1,40}$/.test(v) ? v : null
  } catch {
    return null
  }
}
