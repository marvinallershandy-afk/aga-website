// Supabase Edge Function: kalender (v18-A)
// „Alle Heimspiele in deinen Kalender“ — liefert den Spielplan als ICS-Abo.
//   GET /functions/v1/kalender          → Heimspiele
//   GET /functions/v1/kalender?alle=1   → Heim + Auswärts
//   GET /functions/v1/kalender?spiel=<id> bzw. ?anstoss=<ISO>
//                                       → EIN Spiel zum Hinzufügen (iPhone/Mac:
//                                         Safari bietet direkt „Hinzufügen“ an).
//                                         Nur echte Spiele aus der DB — keine
//                                         frei wählbaren Texte (kein Missbrauch
//                                         als ICS-Generator).
// Öffentlich erreichbar über Netlify: /kalender.ics und /kalender-alle.ics
// (netlify.toml, Proxy-Rewrite) → später https://aga-erste.de/kalender.ics
//
// Sicherheit / Datenschutz:
//  - verify_jwt=false (Kalender-Apps schicken keinen Login) — deploy mit --no-verify-jwt
//  - liest NUR die öffentliche RPC web_kalender() mit dem anon-Key
//    (keine Notizen, keine Personen, Testspiele mit „(TEST)“ ausgeblendet)
//  - speichert nichts, protokolliert nichts
//  - bei DB-Fehler 503 statt leerem Kalender (sonst löschen Kalender-Apps alle Termine)
import { baueEinzeltermin, baueKalender, findeSpiel, type KalenderDaten } from './ics.ts'

// Website-Adresse für Links in den Terminen. Netlify reicht beim Proxy den
// Original-Host weiter; nur bekannte Hosts werden übernommen.
const SITE_URL = (Deno.env.get('SITE_URL') || 'https://sva-agathenburg-dollern.netlify.app').replace(/\/+$/, '')
const ERLAUBTE_HOSTS = /^(www\.)?aga-erste\.de$|^[a-z0-9-]+\.netlify\.app$/

function seiteAus(req: Request): string {
  const host = (req.headers.get('x-forwarded-host') || '').split(',')[0].trim().toLowerCase()
  return ERLAUBTE_HOSTS.test(host) ? `https://${host}` : SITE_URL
}

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
}

async function etag(text: string): Promise<string> {
  const h = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text))
  return `"${[...new Uint8Array(h)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 20)}"`
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    return new Response('Nur GET', { status: 405, headers: { ...CORS, Allow: 'GET, HEAD, OPTIONS' } })
  }

  const url = new URL(req.url)
  const spielId = url.searchParams.get('spiel')
  const anstoss = url.searchParams.get('anstoss')
  const einzel = !!(spielId || anstoss)
  // Einzelspiel: auch Auswärtsspiele suchen
  const alle = einzel || ['1', 'true', 'ja'].includes((url.searchParams.get('alle') || '').toLowerCase())
  const seite = seiteAus(req)

  let daten: KalenderDaten
  try {
    const base = Deno.env.get('SUPABASE_URL')!
    const key = Deno.env.get('SUPABASE_ANON_KEY')!
    const r = await fetch(`${base}/rest/v1/rpc/web_kalender`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ p_alle: alle }),
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) throw new Error(`web_kalender HTTP ${r.status}`)
    daten = (await r.json()) as KalenderDaten
    if (!daten || !Array.isArray(daten.spiele)) throw new Error('unerwartete Antwort')
  } catch (e) {
    console.error('kalender:', e instanceof Error ? e.message : e)
    return new Response('Kalender gerade nicht erreichbar – bitte später erneut versuchen.', {
      status: 503,
      headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Retry-After': '3600', 'Cache-Control': 'no-store' },
    })
  }

  let ics: string
  let datei = alle ? 'sva-alle-spiele' : 'sva-heimspiele'
  if (einzel) {
    const spiel = findeSpiel(daten, { spiel: spielId, anstoss })
    const einzelIcs = spiel ? baueEinzeltermin(spiel, daten, seite) : null
    if (!spiel || !einzelIcs) {
      return new Response('Spiel nicht gefunden.', {
        status: 404,
        headers: { ...CORS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=300' },
      })
    }
    ics = einzelIcs
    datei = 'sva-spiel'
  } else {
    ics = baueKalender(daten, { alle, seite })
  }
  const tag = await etag(ics)
  const headers = {
    ...CORS,
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="${datei}.ics"`,
    // Kalender-Apps fragen selbst nur alle paar Stunden; kurzer CDN-Cache genügt
    'Cache-Control': 'public, max-age=900, s-maxage=900',
    ETag: tag,
    'X-Content-Type-Options': 'nosniff',
  }
  if (req.headers.get('if-none-match') === tag) return new Response(null, { status: 304, headers })
  return new Response(req.method === 'HEAD' ? null : ics, { status: 200, headers })
})
