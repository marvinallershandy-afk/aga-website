// Supabase Edge Function: tabelle-aus-bild
// v15-T: „Tabelle per Screenshot aktualisieren" im Admin.
// Der Trainer lädt 1–3 Screenshots der Ligatabelle hoch (fussball.de, FuPa,
// kicker-App …). Claude liest sie per Bilderkennung ab, diese Function prüft
// die Zahlen (Plätze lückenlos, Punkte = 3·S + U, S+U+N = Spiele, eigene
// Mannschaft) und gibt eine Vorschau zurück. Gespeichert wird NICHTS — erst
// nach Bestätigung schreibt der Admin selbst in sm_tabelle (RLS: is_sm_admin).
//
// Sicherheit:
//  - verify_jwt=true (Gateway-Default) → nur eingeloggte Nutzer.
//  - zusätzlich is_sm_admin() (wie die RLS-Policies der sm_*-Tabellen);
//    Fallback auf den sm_admins-Self-Select wie publish-site.
//  - ANTHROPIC_API_KEY nur als Supabase-Secret — nie im Browser, nie in der DB.
//  - Bilder werden nur an Anthropic weitergereicht, NICHT gespeichert/geloggt.
//
// Deploy:  supabase functions deploy tabelle-aus-bild
// Secret:  supabase secrets set ANTHROPIC_API_KEY=sk-ant-…
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  ANTHROPIC_URL,
  ANTHROPIC_VERSION,
  AuslesenFehler,
  MODELL,
  baueAnfrage,
  fehlerAusApi,
  leseToolAntwort,
  pruefeBilder,
  verarbeite,
} from './logik.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

/** Bilderkennung dauert typischerweise 5–25 s; danach abbrechen. */
const TIMEOUT_MS = 90_000

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}
const fehler = (meldung: string, status: number, code?: string) => json({ error: meldung, ...(code ? { code } : {}) }, status)

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return fehler('Nur POST erlaubt.', 405)

  try {
    // 1) Eingeloggt?
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return fehler('Bitte neu anmelden.', 401, 'not_authenticated')

    // 2) Vereins-Admin? is_sm_admin() ist dieselbe Prüfung wie in den RLS-Policies.
    const { data: istAdmin, error: rpcErr } = await supabase.rpc('is_sm_admin')
    let admin = istAdmin === true
    if (rpcErr) {
      // Fallback (wie publish-site): RLS-Self-Select liefert nur die eigene Zeile.
      const { data: rows } = await supabase.from('sm_admins').select('email').limit(1)
      admin = !!rows && rows.length > 0
    }
    if (!admin) return fehler('Für diese Funktion fehlt die Berechtigung (kein Vereins-Admin).', 403, 'not_admin')

    // 3) Key hinterlegt?
    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')?.trim()
    if (!apiKey) {
      return fehler(
        'Kein API-Key hinterlegt. Die Bilderkennung ist noch nicht eingerichtet — bitte Marvin Bescheid geben (Secret ANTHROPIC_API_KEY).',
        503,
        'kein_key',
      )
    }

    // 4) Bilder prüfen
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return fehler('Die Anfrage war unvollständig. Bitte die Seite neu laden und nochmal versuchen.', 400)
    }
    const geprueft = pruefeBilder(body)
    if (!geprueft.ok) return fehler(geprueft.fehler, 400, 'bild_ungueltig')

    // 5) Claude fragen (Tool-Use erzwingt die JSON-Struktur)
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
    let r: Response
    try {
      r = await fetch(ANTHROPIC_URL, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(baueAnfrage(geprueft.bilder, MODELL)),
        signal: ctrl.signal,
      })
    } catch (e) {
      const abgebrochen = e instanceof DOMException && e.name === 'AbortError'
      return fehler(
        abgebrochen
          ? 'Die Bilderkennung hat zu lange gebraucht. Bitte nochmal versuchen.'
          : 'Anthropic ist gerade nicht erreichbar. Bitte gleich nochmal versuchen.',
        504,
      )
    } finally {
      clearTimeout(timer)
    }

    const antwort = await r.json().catch(() => null)
    if (!r.ok) {
      const f = fehlerAusApi(r.status, antwort)
      // Nur Status + Fehlertyp loggen — niemals Bilddaten.
      console.error('tabelle-aus-bild: Anthropic', r.status, (antwort as { error?: { type?: string } } | null)?.error?.type)
      return fehler(f.message, f.status)
    }

    // 6) Auswerten + Plausibilität
    const ergebnis = verarbeite(leseToolAntwort(antwort))
    if (ergebnis.rows.length === 0) {
      const grund = ergebnis.hinweise[0]
      return fehler(
        `Auf dem Bild wurde keine Ligatabelle erkannt${grund ? ` (${grund})` : ''}. Bitte einen Screenshot der Tabelle nehmen.`,
        422,
        'keine_tabelle',
      )
    }
    const usage = (antwort as { usage?: { input_tokens?: number; output_tokens?: number } }).usage
    console.log('tabelle-aus-bild: ok', {
      bilder: geprueft.bilder.length,
      zeilen: ergebnis.rows.length,
      warnungen: ergebnis.warnungen.length,
      tokens_in: usage?.input_tokens,
      tokens_out: usage?.output_tokens,
    })
    return json(ergebnis)
  } catch (e) {
    if (e instanceof AuslesenFehler) return fehler(e.message, e.status)
    console.error('tabelle-aus-bild: unerwartet', e instanceof Error ? e.message : String(e))
    return fehler('Unerwarteter Fehler beim Auslesen. Bitte nochmal versuchen.', 500)
  }
})
