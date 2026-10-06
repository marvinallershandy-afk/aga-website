// ─────────────────────────────────────────────────────────────
// v22-A: Easter Eggs → Geheimkarten. Bewusst klein und OHNE Supabase:
// läuft auch auf der Startseite (Wappen) und im Rundgang (Ball).
//
// Ein Ei prüft NICHTS im Klartext und kennt keine Karte. Es rechnet zur
// Laufzeit ein Token aus dem Auslöser („G-“ + 32 Hex von SHA-256), merkt es
// sich (localStorage) und das Album löst es über die normale Code-RPC
// album_code_einloesen ein. Ob das Token etwas bringt, weiß nur der Server
// (dort liegt nur SHA-256(Token)). Die Wisch-Geste wird sogar nur als Hash
// verglichen — die Reihenfolge steht nicht im Bundle.
// ─────────────────────────────────────────────────────────────

export const GEHEIM_EREIGNIS = 'sva-geheim-fund'
const KEY = 'sva-album-geheim'

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Token zu einem Auslöser-Teil (identisch zu sva_album_geheim_hash in der Migration v22). */
export async function geheimToken(teil: string): Promise<string> {
  return 'G-' + (await sha256hex('sva-geheim|' + teil)).slice(0, 32).toUpperCase()
}

export const istGeheimToken = (c: string) => /^G-[0-9A-F]{32}$/i.test(c.trim())

/** Offene Funde (noch nicht im Album eingelöst). */
export function offeneFunde(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || '[]')
    return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && istGeheimToken(x)) : []
  } catch {
    return []
  }
}
function merken(liste: string[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify([...new Set(liste)].slice(-8)))
  } catch {
    /* privat-Modus: Fund gilt nur in dieser Seite */
  }
}
export function fundErledigt(token: string) {
  merken(offeneFunde().filter((t) => t !== token))
}

export interface GeheimFund {
  token: string
  /** kurzer, geheimnisvoller Satz für den Hinweis */
  text: string
}

/** Fund melden: merken + Ereignis (Hinweis „Im Album abholen“). */
export async function fundMelden(teil: string, text = 'Du hast etwas entdeckt.'): Promise<GeheimFund | null> {
  if (!globalThis.crypto?.subtle) return null
  const token = await geheimToken(teil)
  merken([...offeneFunde(), token])
  const f = { token, text }
  window.dispatchEvent(new CustomEvent<GeheimFund>(GEHEIM_EREIGNIS, { detail: f }))
  try {
    navigator.vibrate?.([20, 40, 20, 40, 80])
  } catch {
    /* egal */
  }
  return f
}

// ── (a) Wappen: 7× tippen (Abstand < 1,5 s) ────────────────
let tipps: number[] = []
export function wappenTipp(): boolean {
  const t = Date.now()
  tipps = [...tipps.filter((x) => t - x < 1500 * 7), t].slice(-7)
  const schnell = tipps.length === 7 && tipps.every((x, i) => i === 0 || x - tipps[i - 1] < 1500)
  if (schnell) {
    tipps = []
    void fundMelden('wappen|7', 'Der Platzwart hat dich gehört.')
    return true
  }
  return false
}

// ── (d) Geste: die letzten 8 Richtungen als Hash vergleichen ─
const GESTE_HASH = '2db5da46e94c01d0ad68aab8997ddb2a815830e28bbca039f0accc96311f4bbb'
let richtungen = ''
let pruefe = 0
/** Eine Richtung melden: O (oben), U (unten), L (links), R (rechts). */
export function gesteRichtung(r: 'O' | 'U' | 'L' | 'R') {
  richtungen = (richtungen + r).slice(-8)
  if (richtungen.length < 8 || !globalThis.crypto?.subtle) return
  const folge = richtungen
  const n = ++pruefe
  void sha256hex('sva-geste|' + folge).then((h) => {
    if (h !== GESTE_HASH || n !== pruefe) return
    richtungen = ''
    void fundMelden('geste|' + folge, 'Die Geheimtaktik ist dir zugeflüstert worden.')
  })
}
