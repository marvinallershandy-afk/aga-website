// v21-A: Sitzungs-Anker für Album + Tipp-Liga (gemeinsames Fan-Konto).
//
// Problem: Die Supabase-Sitzung der Fans liegt in localStorage ('sva-album-auth').
// Safari/iOS (ITP) löscht „per Skript geschriebenen“ Speicher einer Seite nach
// 7 Tagen Safari-Nutzung ohne Besuch — zwischen zwei Heimspielen liegen oft
// 14 Tage → Fan ist abgemeldet. Cookies, die der SERVER der eigenen Domain
// setzt (HttpOnly), fallen nicht unter diese 7-Tage-Grenze.
//
// Lösung: Der Browser hinterlegt nach jedem Login/Token-Wechsel den aktuellen
// Refresh-Token hier als HttpOnly-Cookie (nur für diesen Pfad). Ist localStorage
// leer, fragt das Album den Anker und stellt die Sitzung per refreshSession()
// wieder her. Abmelden/Konto löschen löscht den Anker.
//
// Schutz: nur gleiche Herkunft (Origin/Sec-Fetch-Site), eigener Header
// (erzwingt CORS-Preflight → fremde Seiten können weder lesen noch setzen),
// SameSite=Strict, Secure, HttpOnly, Pfad nur /api/album-sitzung, no-store.
import type { Config } from '@netlify/functions'

const NAME = 'sva_album_rt'
const PFAD = '/api/album-sitzung'
const TAGE = 400 // Höchstwert, den Browser für Cookies akzeptieren

const antwort = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex', ...headers },
  })

const cookie = (wert: string, maxAge: number) =>
  `${NAME}=${wert}; Path=${PFAD}; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`

export default async (req: Request) => {
  const url = new URL(req.url)
  const origin = req.headers.get('origin')
  const site = req.headers.get('sec-fetch-site')
  if (req.headers.get('x-sva-album') !== '1') return antwort(403, { fehler: 'header' })
  if (site && site !== 'same-origin') return antwort(403, { fehler: 'herkunft' })
  if (req.method !== 'GET' && origin !== url.origin) return antwort(403, { fehler: 'herkunft' })

  if (req.method === 'GET') {
    const m = /(?:^|;\s*)sva_album_rt=([A-Za-z0-9_-]{8,256})(?:;|$)/.exec(req.headers.get('cookie') ?? '')
    return antwort(200, { rt: m ? m[1] : null })
  }
  if (req.method === 'POST') {
    let rt = ''
    try {
      rt = String(((await req.json()) as { rt?: unknown }).rt ?? '')
    } catch {
      return antwort(400, { fehler: 'json' })
    }
    if (!/^[A-Za-z0-9_-]{8,256}$/.test(rt)) return antwort(400, { fehler: 'token' })
    return antwort(200, { ok: true }, { 'Set-Cookie': cookie(rt, TAGE * 86400) })
  }
  if (req.method === 'DELETE') {
    return antwort(200, { ok: true }, { 'Set-Cookie': cookie('', 0) })
  }
  return antwort(405, { fehler: 'methode' }, { Allow: 'GET, POST, DELETE' })
}

export const config: Config = { path: PFAD }
