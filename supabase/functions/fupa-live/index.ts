// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: fupa-live (v23-L)
// „FuPa-Live-Bot" — holt WÄHREND eines SVA-Spiels Spielkopf + Ticker-Stream von
// der öffentlichen FuPa-API und spiegelt die FAKTEN nach sva_ticker (Vorlagen,
// keine KI, Reportertexte nur mit Freigabe). Außerdem: Spieltags-Konferenz +
// Live-Tabelle. Schreibt ausschließlich mit der service_role.
//
// HARTE REGEL: Ruft FuPa NUR ab, wenn sva_settings.fupa_live_modus = 'an'.
// Steht der Modus auf 'aus', liefert die Function sofort {uebersprungen:'modus_aus'}
// OHNE jeden FuPa-Abruf. Scharf schaltet nur Marvin nach FuPa-Zustimmung (G-FUPA).
//
// Aufruf-Wege:
//   · pg_cron (alle 30 s) → Header x-cron-secret: <FUPA_LIVE_CRON_SECRET>
//   · Admin „Jetzt abrufen" → Authorization: Bearer <User-JWT> (is_sva_team),
//     Rate-Limit 1 pro 20 s und Spiel.
//
// DEPLOY: supabase functions deploy fupa-live --no-verify-jwt
//   Secrets: FUPA_LIVE_CRON_SECRET. SUPABASE_URL / SUPABASE_ANON_KEY /
//   SUPABASE_SERVICE_ROLE_KEY stellt die Plattform bereit.
// ─────────────────────────────────────────────────────────────────────────────
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { configAusFupaUrl, ligaCompetitionSlug } from '../fupa-sync/map.mjs'
import { kopfAusMatch, ereignisseAusStream, mitZeitpunkten, aufstellungAusLineup } from './live_map.mjs'
import { abgleichen } from './abgleich.mjs'
import { tabelleBerechnen, stimmtMitFupa } from './tabelle_live.mjs'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const V1 = 'https://api.fupa.net/v1'
const V2 = 'https://api.fupa.net/v2'
const UA = 'SVA-Liveticker/1.0 (+https://aga-erste.de/impressum)'
const TIMEOUT = 8_000

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

async function fupa(pfad: string): Promise<unknown> {
  const r = await fetch(pfad, { headers: { Accept: 'application/json', 'User-Agent': UA }, signal: AbortSignal.timeout(TIMEOUT) })
  if (!r.ok) { const e = new Error(`FuPa ${pfad} → HTTP ${r.status}`); (e as { status?: number }).status = r.status; throw e }
  return await r.json()
}

/** Effektive Quelle (wie sva_live_quelle in SQL). */
function effektiveQuelle(s: Record<string, unknown>, modus: string): 'fupa' | 'pult' {
  if (s.live_quelle === 'pult' || modus !== 'an' || s.fupa_id == null || s.demo === true) return 'pult'
  if (s.live_quelle === 'fupa') return 'fupa'
  return s.fupa_ticker_typ === 'live' || s.fupa_ticker_typ === 'soft' ? 'fupa' : 'pult'
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin: SupabaseClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

  // ── Berechtigung: Cron-Secret ODER Admin-JWT ──────────────────────────────
  let manuell = false
  const cronSecret = Deno.env.get('FUPA_LIVE_CRON_SECRET')?.trim()
  const reqSecret = req.headers.get('x-cron-secret')?.trim()
  if (cronSecret && reqSecret && reqSecret === cronSecret) {
    manuell = false
  } else {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'not_authenticated' }, 401)
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: authHeader } } })
    const { data: u } = await asUser.auth.getUser()
    if (!u?.user) return json({ error: 'not_authenticated' }, 401)
    const rpc = await asUser.rpc('is_sva_team')
    if (rpc.error || rpc.data !== true) return json({ error: 'not_team' }, 403)
    manuell = true
  }

  // ── Modus-aus-Guard ZUERST (kein FuPa-Abruf bei 'aus') ────────────────────
  const { data: settings } = await admin.from('sva_settings')
    .select('fupa_live_modus, fupa_url, fupa_texte_autoren, konferenz_an').eq('id', 1).maybeSingle()
  const modus = settings?.fupa_live_modus ?? 'aus'
  if (modus !== 'an') return json({ ok: true, uebersprungen: 'modus_aus' })

  const cfg = configAusFupaUrl(settings?.fupa_url ?? '')
  if (!cfg) return json({ ok: false, grund: 'fupa_url fehlt' })

  const body = await req.json().catch(() => ({})) as { aufgabe?: string; spiel_id?: string; datum?: string }
  const log = async (quelle: string, status: string, geaendert: number, details: Record<string, unknown>, fehler: string | null = null) => {
    if (status === 'ok' && geaendert === 0 && !fehler) return // nur Änderungen/Fehler loggen
    await admin.from('sva_sync_log').insert({ quelle, ausloeser: manuell ? 'manuell' : 'auto', status, geaendert, details, fehler })
  }

  try {
    if (body.aufgabe === 'konferenz') return await konferenz(admin, cfg, settings, body.datum ?? null, log)
    return await spiel(admin, cfg, settings, body.spiel_id ?? null, manuell, modus, log)
  } catch (e) {
    const fehler = e instanceof Error ? e.message : String(e)
    await log(body.aufgabe === 'konferenz' ? 'fupa_konferenz' : 'fupa_live', 'fehler', 0, {}, fehler)
    return json({ ok: false, error: 'fupa_live_failed', detail: fehler }, 500)
  }
})

// ── Aufgabe: Spiel ────────────────────────────────────────────────────────────
async function spiel(admin: SupabaseClient, cfg: { teamSlug: string; clubSlug: string; seasonSlug: string | null }, settings: Record<string, unknown>, spielId: string | null, manuell: boolean, modus: string, log: (q: string, s: string, g: number, d: Record<string, unknown>, f?: string | null) => Promise<void>) {
  const { data: s } = await admin.from('sm_spiele')
    .select('id, fupa_id, heim, anstoss, anpfiff_at, demo, status, live_quelle, fupa_ticker_typ, fupa_stream_ts, fupa_tore_heim, fupa_tore_gast, fupa_post_at, fupa_abruf_at, fupa_pause_bis')
    .eq('id', spielId).maybeSingle()
  if (!s || !s.fupa_id || s.demo) return json({ ok: true, uebersprungen: 'kein_fupa_spiel' })
  if (manuell && s.fupa_abruf_at && Date.now() - new Date(s.fupa_abruf_at as string).getTime() < 20_000) {
    return json({ ok: true, uebersprungen: 'rate_limit_20s' })
  }
  if (s.fupa_pause_bis && new Date(s.fupa_pause_bis as string) > new Date()) {
    return json({ ok: true, uebersprungen: 'pause', bis: s.fupa_pause_bis })
  }

  // Kopf
  let kopfRaw: Record<string, unknown>
  try {
    kopfRaw = await fupa(`${V1}/matches/${s.fupa_id}`) as Record<string, unknown>
  } catch (e) {
    return await fupaFehler(admin, s.id as string, e, 'fupa_live', log)
  }
  const k = kopfAusMatch(kopfRaw, cfg)
  const autoren = (settings.fupa_texte_autoren as string[] | null) ?? []
  const autorFrei = k.autorId != null && autoren.includes(String(k.autorId))
  const istPost = k.section === 'POST'
  const patch: Record<string, unknown> = {
    fupa_section: k.section, fupa_minute: k.minute, fupa_nachspielzeit: k.nachspielzeit,
    fupa_minute_at: new Date().toISOString(), fupa_tore_heim: k.toreHeim, fupa_tore_gast: k.toreGast,
    fupa_ticker_typ: k.tickerTyp, fupa_autor_id: k.autorId,
    fupa_autor_name: autorFrei ? k.autorName : null,
    fupa_abruf_at: new Date().toISOString(), fupa_fehler: null, fupa_fehler_serie: 0,
  }
  if (istPost && !s.fupa_post_at) patch.fupa_post_at = new Date().toISOString()
  await admin.from('sm_spiele').update(patch).eq('id', s.id)

  // Effektive Quelle: bei 'pult' nur Kopf aktualisieren (für „FuPa sagt")
  const sNeu = { ...s, fupa_ticker_typ: k.tickerTyp }
  if (effektiveQuelle(sNeu, modus) === 'pult') {
    return json({ ok: true, quelle: 'pult', nurKopf: true })
  }

  // Stream nur holen, wenn streamTs oder Stand neu
  const standNeu = k.toreHeim !== s.fupa_tore_heim || k.toreGast !== s.fupa_tore_gast
  const streamNeu = k.streamTs != null && Number(k.streamTs) !== Number(s.fupa_stream_ts ?? 0)
  let zaehl = { neu: 0, geaendert: 0, geloescht: 0, versteckt: 0 }
  if (streamNeu || standNeu) {
    let streamRaw: unknown
    try {
      streamRaw = await fupa(`${V2}/matches/${s.fupa_id}/stream${k.streamTs ? `?ts=${k.streamTs}` : ''}`)
    } catch (e) {
      return await fupaFehler(admin, s.id as string, e, 'fupa_live', log)
    }
    // Kader-Zuordnung
    const { data: roster } = await admin.from('sm_roster').select('id, fupa_spieler_id').not('fupa_spieler_id', 'is', null)
    const rosterByFupaId = new Map<number, string>((roster ?? []).map((r) => [Number(r.fupa_spieler_id), r.id as string]))
    const ctx = { heimIstSva: !!s.heim, svaTeamSlug: cfg.teamSlug, rosterByFupaId, textAutorErlaubt: autorFrei, anstoss: new Date(s.anstoss as string), anpfiffAt: s.anpfiff_at ? new Date(s.anpfiff_at as string) : null, fupaMatchId: Number(s.fupa_id) }
    const sollRoh = ereignisseAusStream(streamRaw, ctx)
    const soll = mitZeitpunkten(sollRoh, ctx)
    const { data: istRows } = await admin.from('sva_ticker').select('id, fupa_event_id, typ, minute, nachspielzeit, roster_id, roster_id_2, text, text_quelle, fupa_name, fupa_name_2, team, platzhalter, gesperrt, versteckt, duplikat_von').eq('spiel_id', s.id).eq('quelle', 'fupa')
    const { data: pultRows } = await admin.from('sva_ticker').select('id, typ, minute, roster_id').eq('spiel_id', s.id).eq('quelle', 'pult').eq('versteckt', false)
    const ops = abgleichen({ soll, ist: istRows ?? [], pultZeilen: pultRows ?? [], kopf: k, heimIstSva: !!s.heim, fupaMatchId: Number(s.fupa_id) })
    const { data: res } = await admin.rpc('sva_fupa_ticker_anwenden', { p_spiel: s.id, p_ops: { ...ops, stream_ts: k.streamTs } })
    zaehl = (res as typeof zaehl) ?? zaehl
  }

  // Aufstellung nach Abpfiff (einmal, ≥ 5 min nach POST)
  if (istPost && s.fupa_post_at && Date.now() - new Date(s.fupa_post_at as string).getTime() >= 5 * 60_000) {
    const { data: vorhanden } = await admin.from('sva_fupa_aufstellung').select('spiel_id').eq('spiel_id', s.id).maybeSingle()
    if (!vorhanden) {
      try {
        const lineupRaw = await fupa(`${V1}/matches/${s.fupa_id}/lineup`)
        const spieler = aufstellungAusLineup(lineupRaw, !!s.heim)
        if (spieler.length) await admin.from('sva_fupa_aufstellung').upsert({ spiel_id: s.id, spieler, abgerufen_at: new Date().toISOString() })
      } catch { /* Aufstellung ist best effort */ }
    }
  }

  const geaendert = zaehl.neu + zaehl.geaendert + zaehl.geloescht + zaehl.versteckt
  await log('fupa_live', 'ok', geaendert, { ...zaehl, section: k.section, stand: `${k.toreHeim}:${k.toreGast}` })
  return json({ ok: true, quelle: 'fupa', ...zaehl, section: k.section })
}

// ── Aufgabe: Konferenz ──────────────────────────────────────────────────────
async function konferenz(admin: SupabaseClient, cfg: { teamSlug: string; clubSlug: string; seasonSlug: string | null }, settings: Record<string, unknown>, datum: string | null, log: (q: string, s: string, g: number, d: Record<string, unknown>, f?: string | null) => Promise<void>) {
  if (settings.konferenz_an === false) return json({ ok: true, uebersprungen: 'konferenz_aus' })
  const tag = datum ?? new Date().toISOString().slice(0, 10)

  // comp-Slug aus einem Liga-Spiel bestimmen
  const { data: ligaSpiel } = await admin.from('sm_spiele').select('fupa_id').not('fupa_id', 'is', null)
    .not('spieltag_nr', 'is', null).order('anstoss', { ascending: false }).limit(1).maybeSingle()
  if (!ligaSpiel || !cfg.seasonSlug) return json({ ok: true, uebersprungen: 'keine_liga' })
  // comp-Slug über die Team-Matches (wie fupa-sync): ein Abruf
  let compSlug: string | null = null
  try {
    const current = await fupa(`${V1}/teams/${cfg.teamSlug}/matches?flavor=current&limit=60`)
    compSlug = ligaCompetitionSlug([current])
  } catch (e) { return await fupaFehler(admin, null, e, 'fupa_konferenz', log) }
  if (!compSlug) return json({ ok: true, uebersprungen: 'kein_wettbewerb' })

  let matches: unknown
  try {
    matches = await fupa(`${V1}/competitions/${compSlug}/seasons/${cfg.seasonSlug}/matches?from=${tag}`)
  } catch (e) { return await fupaFehler(admin, null, e, 'fupa_konferenz', log) }
  const arr = Array.isArray(matches) ? matches as Record<string, unknown>[] : []
  const heute = arr.filter((m) => typeof m.kickoff === 'string' && (m.kickoff as string).slice(0, 10) === tag && m.category === 'league')
  const spiele = heute.map((m) => {
    const h = m.homeTeam as Record<string, unknown>
    const a = m.awayTeam as Record<string, unknown>
    const live = m.live as Record<string, unknown> | undefined
    return {
      fupaId: m.id, heim: (h?.name as Record<string, unknown>)?.middle ?? (h?.name as Record<string, unknown>)?.full, gast: (a?.name as Record<string, unknown>)?.middle ?? (a?.name as Record<string, unknown>)?.full,
      heimSlug: h?.slug, gastSlug: a?.slug,
      toreHeim: m.homeGoal ?? null, toreGast: m.awayGoal ?? null, section: m.section ?? null,
      minute: live?.minute ?? null, nachspielzeit: live?.additionalMinute ?? null, tickerTyp: m.tickerType ?? null,
      anstoss: m.kickoff, url: `https://www.fupa.net/match/${m.id}`,
      sva: (h?.slug === cfg.teamSlug || a?.slug === cfg.teamSlug || (h?.clubSlug === cfg.clubSlug) || (a?.clubSlug === cfg.clubSlug)),
    }
  })

  // Basis + Standings einmal pro Spieltag (erster Tick des Tages)
  const { data: vorhanden } = await admin.from('sva_konferenz').select('datum, basis, standings').eq('datum', tag).maybeSingle()
  let basis = vorhanden?.basis ?? null
  let standings = vorhanden?.standings ?? null
  if (!basis) {
    try {
      const alle = await fupa(`${V1}/competitions/${compSlug}/seasons/${cfg.seasonSlug}/matches?limit=300`)
      basis = alle
      const st = await fupa(`${V1}/standings?competition=${compSlug}&season=${cfg.seasonSlug}&type=total`)
      standings = st
    } catch { /* best effort */ }
  }

  // Live-Tabelle rechnen (Function, nicht Client)
  let tabelle: Record<string, unknown> | null = null
  if (Array.isArray(basis)) {
    const alle = (basis as Record<string, unknown>[]).map((m) => {
      const h = m.homeTeam as Record<string, unknown>
      const a = m.awayTeam as Record<string, unknown>
      // Heutige Spiele mit frischem Stand überschreiben
      const heutig = spiele.find((x) => x.fupaId === m.id)
      return {
        home: { slug: h?.slug, name: (h?.name as Record<string, unknown>)?.full }, away: { slug: a?.slug, name: (a?.name as Record<string, unknown>)?.full },
        toreHeim: heutig ? heutig.toreHeim : (m.homeGoal ?? null), toreGast: heutig ? heutig.toreGast : (m.awayGoal ?? null),
        section: heutig ? heutig.section : (m.section ?? null), kickoff: m.kickoff,
      }
    })
    const abzug: Record<string, number> = {}
    const stRows = (standings as Record<string, unknown>)?.standings as Record<string, unknown>[] | undefined
    if (Array.isArray(stRows)) for (const r of stRows) { const sl = (r.team as Record<string, unknown>)?.slug as string; if (sl && Number(r.penaltyPoints)) abzug[sl] = Number(r.penaltyPoints) }
    const vorSpieltag = tabelleBerechnen(alle.filter((x) => x.section === 'POST' && x.kickoff && new Date(x.kickoff as string) < new Date(tag)), { abzug })
    const jetzt = tabelleBerechnen(alle, { abzug, svaSlug: cfg.teamSlug, datum: tag })
    const stimmt = stRows ? stimmtMitFupa(vorSpieltag, stRows) : false
    tabelle = { zeilen: jetzt, stimmt }
  }

  const spieltag = heute.length ? (heute[0].round as Record<string, unknown>)?.number ?? null : null
  await admin.from('sva_konferenz').upsert({
    datum: tag, saison: cfg.seasonSlug?.replace('-', '/') ?? '', spieltag,
    spiele, basis, standings, tabelle, aktualisiert_at: new Date().toISOString(),
  })
  await log('fupa_konferenz', 'ok', spiele.length, { spiele: spiele.length, live: spiele.filter((x) => x.section === 'LIVE').length, tabelleStimmt: (tabelle as Record<string, unknown>)?.stimmt ?? null })
  return json({ ok: true, spiele: spiele.length })
}

// ── FuPa-Fehler: 403/429 → 15 min Pause; sonst Fehlerserie ─────────────────
async function fupaFehler(admin: SupabaseClient, spielId: string | null, e: unknown, quelle: string, log: (q: string, s: string, g: number, d: Record<string, unknown>, f?: string | null) => Promise<void>) {
  const status = (e as { status?: number })?.status
  const msg = e instanceof Error ? e.message : String(e)
  if (spielId) {
    if (status === 403 || status === 429) {
      await admin.from('sm_spiele').update({ fupa_pause_bis: new Date(Date.now() + 15 * 60_000).toISOString(), fupa_fehler: msg }).eq('id', spielId)
    } else {
      const { data } = await admin.from('sm_spiele').select('fupa_fehler_serie').eq('id', spielId).maybeSingle()
      await admin.from('sm_spiele').update({ fupa_fehler_serie: (data?.fupa_fehler_serie ?? 0) + 1, fupa_fehler: msg }).eq('id', spielId)
    }
  }
  await log(quelle, 'fehler', 0, { status: status ?? null }, msg)
  return json({ ok: false, error: 'fupa_unreachable', status: status ?? null })
}
