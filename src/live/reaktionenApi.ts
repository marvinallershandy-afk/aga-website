// ─────────────────────────────────────────────────────────────
// v23-U: „Mitjubeln“ auf /live — Zugriff auf sva_reagieren / sva_meine_reaktionen
// per reinem fetch. KEIN Supabase-SDK auf /live (Bundle-Regel). Der Access-Token
// kommt aus dem localStorage-Eintrag, den supabase-js auf /album & /tippen
// schreibt (Schlüssel 'sva-album-auth'). Läuft er ab, wird wie ein Gast behandelt.
// ─────────────────────────────────────────────────────────────
import { REAKTION_EMOJIS, type ReaktionEmoji, type ReactionSummen } from './model'

const STORAGE_KEY = 'sva-album-auth'
const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** Access-Token aus dem Album-Login lesen (nur wenn gültig). Privat-Modus-sicher. */
export function albumToken(): string | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const o = JSON.parse(raw) as { access_token?: string; expires_at?: number } | null
    const tok = o?.access_token
    if (!tok) return null
    // expires_at ist in Sekunden (supabase-js). Abgelaufen → wie Gast.
    if (o?.expires_at && Date.now() / 1000 > o.expires_at - 5) return null
    return tok
  } catch {
    return null
  }
}

export class ReaktionFehler extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

function fehler(status: number, body: string): ReaktionFehler {
  const m = /(reaktion_[a-z_]+|nicht_angemeldet|reaktionen_aus|reaktion_spiel_vorbei)/.exec(body)
  const code = m?.[1] ?? `http_${status}`
  const text =
    code === 'reaktion_limit'
      ? 'Puh, genug gejubelt für dieses Spiel – gönn den Daumen eine Pause.'
      : code === 'reaktion_spiel_vorbei'
        ? 'Das Spiel ist schon eine Weile vorbei.'
        : code === 'nicht_angemeldet'
          ? 'Kurz bei /album vorbeischauen und anmelden.'
          : 'Das hat gerade nicht geklappt.'
  return new ReaktionFehler(code, text)
}

/** Eine Reaktion setzen (p_emoji) oder zurücknehmen (null). Liefert die neuen Summen. */
export async function reagieren(tickerId: string, emoji: ReaktionEmoji | null, token: string): Promise<Partial<Record<ReaktionEmoji, number>>> {
  if (!URL_BASE || !KEY) throw new ReaktionFehler('nicht_eingerichtet', 'Nicht eingerichtet.')
  const r = await fetch(`${URL_BASE}/rest/v1/rpc/sva_reagieren`, {
    method: 'POST',
    headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ p_ticker: tickerId, p_emoji: emoji }),
    credentials: 'omit',
    cache: 'no-store',
  })
  const body = await r.text()
  if (!r.ok) throw fehler(r.status, body)
  try {
    return JSON.parse(body) as Partial<Record<ReaktionEmoji, number>>
  } catch {
    return {}
  }
}

/** Meine bereits gesetzten Reaktionen dieses Spiels laden. */
export async function meineReaktionen(spielId: string, token: string): Promise<Map<string, ReaktionEmoji>> {
  const m = new Map<string, ReaktionEmoji>()
  if (!URL_BASE || !KEY) return m
  try {
    const r = await fetch(`${URL_BASE}/rest/v1/rpc/sva_meine_reaktionen`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_spiel: spielId }),
      credentials: 'omit',
      cache: 'no-store',
    })
    if (!r.ok) return m
    const arr = (await r.json()) as { tickerId: string; emoji: ReaktionEmoji }[]
    for (const e of arr) m.set(e.tickerId, e.emoji)
  } catch {
    /* Gast / Netz */
  }
  return m
}

/** Gesamtzahl aller Reaktionen eines Ereignisses. */
export function summeGesamt(s: Partial<Record<ReaktionEmoji, number>> | undefined): number {
  if (!s) return 0
  let n = 0
  for (const e of REAKTION_EMOJIS) n += s[e] ?? 0
  return n
}

/** Optimistische Summen = Server-Summen + eigener Wechsel (vor/zurück). */
export function mitEigener(
  server: ReactionSummen | null | undefined,
  tickerId: string,
  alt: ReaktionEmoji | null,
  neu: ReaktionEmoji | null,
): Partial<Record<ReaktionEmoji, number>> {
  const s: Partial<Record<ReaktionEmoji, number>> = { ...(server?.[tickerId] ?? {}) }
  if (alt && neu !== alt) s[alt] = Math.max(0, (s[alt] ?? 0) - 1)
  if (neu && neu !== alt) s[neu] = (s[neu] ?? 0) + 1
  return s
}
