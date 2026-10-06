// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: fupa-sync (v19-B)
// „FuPa-Abgleich" — holt Spiele (current + past) und die Ligatabelle von der
// öffentlichen FuPa-API und schreibt sie idempotent nach sm_spiele/sm_tabelle.
// Danach: Website veröffentlichen (Build-Hook), WENN sich etwas geändert hat.
//
// Aufruf-Wege:
//   · Admin-Knopf „Jetzt abgleichen" → POST mit Authorization (User-JWT).
//     Erlaubt nur, wenn is_sm_admin(). ausloeser='manuell'.
//   · Zeitplan (Netlify Scheduled Function) → POST mit Header
//     x-cron-secret: <FUPA_CRON_SECRET>. ausloeser='auto'.
//     Läuft nur, wenn sva_settings.fupa_auto = true.
//
// DEPLOY: mit --no-verify-jwt (der Cron-Aufruf hat kein JWT; die Berechtigung
// prüfen wir unten selbst). Secrets: FUPA_CRON_SECRET, optional NETLIFY_BUILD_HOOK.
// SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY stellt die
// Plattform bereit.
//
// Schreibt ausschließlich mit der service_role (umgeht RLS). Fasst NUR Zeilen
// mit notizen='fupa:<id>' an — manuell angelegte Spiele bleiben unberührt.
// Spiele im Live-/Halbzeit-Status oder Demo-Spiele werden NIE überschrieben.
// ─────────────────────────────────────────────────────────────────────────────
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { configAusFupaUrl, ligaCompetitionSlug, mapMatches, mapSquad, mapStandings } from './map.mjs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const FUPA_API = 'https://api.fupa.net/v1'
const HOOK_PATTERN = /^https:\/\/api\.netlify\.com\/build_hooks\/[A-Za-z0-9]+$/
const FETCH_TIMEOUT_MS = 12_000

type Ausloeser = 'auto' | 'manuell'
type LogStatus = 'ok' | 'fehler' | 'uebersprungen' | 'nicht_konfiguriert'

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function fupaJson(pfad: string): Promise<unknown> {
  const r = await fetch(`${FUPA_API}${pfad}`, {
    headers: { Accept: 'application/json', 'User-Agent': 'sva-fussball/fupa-sync' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  })
  if (!r.ok) throw new Error(`FuPa ${pfad} → HTTP ${r.status}`)
  return await r.json()
}

const ms = (iso: string | null | undefined): number | null => {
  if (!iso) return null
  const t = new Date(iso).getTime()
  return Number.isNaN(t) ? null : t
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const admin: SupabaseClient = createClient(url, serviceKey, { auth: { persistSession: false } })

  // ── 1. Berechtigung: Cron-Secret ODER Admin-JWT ───────────────────────────
  let ausloeser: Ausloeser
  let angefordertVon: string | null = null
  const cronSecret = Deno.env.get('FUPA_CRON_SECRET')?.trim()
  const reqSecret = req.headers.get('x-cron-secret')?.trim()
  if (cronSecret && reqSecret && reqSecret === cronSecret) {
    ausloeser = 'auto'
  } else {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'not_authenticated' }, 401)
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await asUser.auth.getUser()
    if (!userData?.user) return json({ error: 'not_authenticated' }, 401)
    angefordertVon = userData.user.email ?? null
    const rpc = await asUser.rpc('is_sm_admin')
    if (rpc.error || rpc.data !== true) return json({ error: 'not_admin' }, 403)
    ausloeser = 'manuell'
  }

  const log = async (status: LogStatus, geaendert: number, details: Record<string, unknown>, fehler: string | null = null) => {
    const { error } = await admin.from('sva_sync_log').insert({
      quelle: 'fupa', ausloeser, status, geaendert, details, fehler, angefordert_von: angefordertVon,
    })
    if (error) console.error('fupa-sync: Protokoll fehlgeschlagen:', error.message)
  }

  try {
    // ── 2. Einstellungen lesen ───────────────────────────────────────────────
    const { data: settings, error: setErr } = await admin
      .from('sva_settings').select('fupa_url, fupa_auto').eq('id', 1).maybeSingle()
    if (setErr) throw new Error(`sva_settings nicht lesbar: ${setErr.message}`)

    if (ausloeser === 'auto' && settings?.fupa_auto === false) {
      await log('uebersprungen', 0, { grund: 'fupa_auto=false' })
      return json({ ok: true, uebersprungen: true, grund: 'automatischer Abgleich ist ausgeschaltet' })
    }

    const cfg = configAusFupaUrl(settings?.fupa_url ?? '')
    if (!cfg) {
      await log('nicht_konfiguriert', 0, { grund: 'fupa_url fehlt oder ungültig' })
      return json({ ok: false, configured: false, grund: 'In „Verein & Links" fehlt eine gültige FuPa-Teamseite.' })
    }

    // ── 3. FuPa holen ─────────────────────────────────────────────────────────
    const [current, past] = await Promise.all([
      fupaJson(`/teams/${cfg.teamSlug}/matches?flavor=current&limit=60`),
      fupaJson(`/teams/${cfg.teamSlug}/matches?flavor=past&limit=60`),
    ])
    const listen = [current, past]
    const spieleNeuRoh = mapMatches(listen, cfg)

    // Standings: best effort (Spiele werden auch ohne Tabelle geschrieben)
    let tabelleRows: ReturnType<typeof mapStandings> = []
    let tabelleFehler: string | null = null
    const compSlug = ligaCompetitionSlug(listen)
    if (compSlug && cfg.seasonSlug) {
      try {
        const standings = await fupaJson(`/standings?competition=${compSlug}&season=${cfg.seasonSlug}&type=total`)
        tabelleRows = mapStandings(standings, cfg)
      } catch (e) {
        tabelleFehler = e instanceof Error ? e.message : String(e)
        console.error('fupa-sync: Tabelle übersprungen:', tabelleFehler)
      }
    }

    // ── 3b. FuPa-Kader (Squad) best effort → sva_fupa_kader ───────────────────
    // v23-U: damit der Admin sieht, wer bei FuPa im Kader steht, aber nicht auf
    // der Website. Datenminimal (keine Geburtsdaten/Bilder). Fehler brechen den
    // Spiele-Abgleich NICHT ab.
    let kaderNeu = 0
    let kaderFehler: string | null = null
    try {
      const squad = await fupaJson(`/teams/${cfg.teamSlug}/squad`)
      const zeilen = mapSquad(squad)
      if (zeilen.length) {
        const { error } = await admin
          .from('sva_fupa_kader')
          .upsert(zeilen.map((z) => ({ ...z, abgerufen_at: new Date().toISOString() })), { onConflict: 'fupa_spieler_id' })
        if (error) throw new Error(error.message)
        kaderNeu = zeilen.length
      }
    } catch (e) {
      kaderFehler = e instanceof Error ? e.message : String(e)
      console.error('fupa-sync: Kader übersprungen:', kaderFehler)
    }

    // ── 4. sm_spiele idempotent über notizen='fupa:<id>' ──────────────────────
    const { data: vorhanden, error: exErr } = await admin
      .from('sm_spiele')
      .select('id, gegner, heim, anstoss, ort, wettbewerb, spieltag_nr, tore_sva, tore_gegner, status, demo, notizen')
      .like('notizen', 'fupa:%')
    if (exErr) throw new Error(`sm_spiele nicht lesbar: ${exErr.message}`)
    const byNotiz = new Map<string, NonNullable<typeof vorhanden>[number]>()
    for (const r of vorhanden ?? []) byNotiz.set(r.notizen as string, r)

    let spieleNeu = 0, spieleAktualisiert = 0, spieleGeschuetzt = 0
    for (const row of spieleNeuRoh) {
      const bestand = byNotiz.get(row.notizen)
      if (!bestand) {
        const { error } = await admin.from('sm_spiele').insert({
          gegner: row.gegner, heim: row.heim, anstoss: row.anstoss, ort: row.ort,
          wettbewerb: row.wettbewerb, spieltag_nr: row.spieltag_nr,
          tore_sva: row.tore_sva, tore_gegner: row.tore_gegner, status: row.status, notizen: row.notizen,
        })
        if (error) throw new Error(`sm_spiele insert fehlgeschlagen: ${error.message}`)
        spieleNeu++
        continue
      }
      // Live/Halbzeit läuft über das Ticker-Pult, Demo ist ein Vorführ-Spiel → nie anfassen.
      if (bestand.status === 'live' || bestand.status === 'halbzeit' || bestand.demo === true) {
        spieleGeschuetzt++
        continue
      }
      const unveraendert =
        bestand.gegner === row.gegner &&
        bestand.heim === row.heim &&
        ms(bestand.anstoss) === ms(row.anstoss) &&
        (bestand.ort ?? null) === row.ort &&
        (bestand.wettbewerb ?? null) === row.wettbewerb &&
        (bestand.spieltag_nr ?? null) === row.spieltag_nr &&
        (bestand.tore_sva ?? null) === row.tore_sva &&
        (bestand.tore_gegner ?? null) === row.tore_gegner &&
        bestand.status === row.status
      if (unveraendert) continue
      const { error } = await admin.from('sm_spiele').update({
        gegner: row.gegner, heim: row.heim, anstoss: row.anstoss, ort: row.ort,
        wettbewerb: row.wettbewerb, spieltag_nr: row.spieltag_nr,
        tore_sva: row.tore_sva, tore_gegner: row.tore_gegner, status: row.status,
        updated_at: new Date().toISOString(),
      }).eq('id', bestand.id)
      if (error) throw new Error(`sm_spiele update fehlgeschlagen: ${error.message}`)
      spieleAktualisiert++
    }

    // ── 5. sm_tabelle Saison ersetzen (nur wenn sich der Inhalt ändert) ───────
    let tabelleGeaendert = 0
    if (tabelleRows.length && cfg.saison) {
      const { data: alt, error: tErr } = await admin
        .from('sm_tabelle')
        .select('platz, team, spiele, siege, unentschieden, niederlagen, tore, gegentore, punkte, self')
        .eq('saison', cfg.saison)
        .order('platz')
      if (tErr) throw new Error(`sm_tabelle nicht lesbar: ${tErr.message}`)
      const sig = (r: Record<string, unknown>) =>
        [r.platz, r.team, r.spiele, r.siege, r.unentschieden, r.niederlagen, r.tore, r.gegentore, r.punkte, r.self].join('|')
      const altSig = (alt ?? []).map(sig).join('\n')
      const neuSig = [...tabelleRows].sort((a, b) => a.platz - b.platz).map(sig).join('\n')
      if (altSig !== neuSig) {
        const { error: delErr } = await admin.from('sm_tabelle').delete().eq('saison', cfg.saison)
        if (delErr) throw new Error(`sm_tabelle delete fehlgeschlagen: ${delErr.message}`)
        const { error: insErr } = await admin.from('sm_tabelle').insert(tabelleRows)
        if (insErr) throw new Error(`sm_tabelle insert fehlgeschlagen: ${insErr.message}`)
        tabelleGeaendert = tabelleRows.length
      }
    }

    const geaendert = spieleNeu + spieleAktualisiert + tabelleGeaendert
    const details: Record<string, unknown> = {
      spiele_neu: spieleNeu, spiele_aktualisiert: spieleAktualisiert, spiele_geschuetzt: spieleGeschuetzt,
      spiele_gesamt_fupa: spieleNeuRoh.length, tabelle_plaetze: tabelleRows.length, tabelle_geaendert: tabelleGeaendert > 0,
    }
    if (tabelleFehler) details.tabelle_fehler = tabelleFehler
    details.kader_spieler = kaderNeu
    if (kaderFehler) details.kader_fehler = kaderFehler

    // ── 6. Website veröffentlichen, wenn sich etwas geändert hat ──────────────
    let publish: 'ausgeloest' | 'nicht_konfiguriert' | 'nicht_noetig' = 'nicht_noetig'
    if (geaendert > 0) {
      const hook = Deno.env.get('NETLIFY_BUILD_HOOK')?.trim()
      if (hook && HOOK_PATTERN.test(hook)) {
        const title = encodeURIComponent(`FuPa-Abgleich (${ausloeser}): ${geaendert} Änderung(en)`)
        const r = await fetch(`${hook}?trigger_title=${title}`, { method: 'POST', body: '{}' })
        publish = r.ok ? 'ausgeloest' : 'nicht_konfiguriert'
        if (!r.ok) details.publish_http = r.status
      } else {
        publish = 'nicht_konfiguriert'
      }
    }
    details.publish = publish

    await log('ok', geaendert, details)
    return json({ ok: true, geaendert, ...details })
  } catch (e) {
    const fehler = e instanceof Error ? e.message : String(e)
    await log('fehler', 0, {}, fehler)
    return json({ ok: false, error: 'sync_failed', detail: fehler }, 500)
  }
})
