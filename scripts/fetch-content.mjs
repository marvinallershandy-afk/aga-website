// ─────────────────────────────────────────────────────────────
// P1 (Admin-Ausbau): Build-time Website-Content-Fetch (ENV-GATED).
//
// Läuft als ERSTER Schritt von `pnpm build` (vor tsc). Liest — NUR wenn die
// Build-Env gesetzt ist — Kader/Spiele/Sponsoren/Tabelle aus der Datenbank und
// schreibt sie als statisches Overlay nach
//   src/data/generated/website-content.generated.ts
// Die 3D-Seite konsumiert dieses Overlay zur Laufzeit rein statisch (kein
// Supabase im Browser-Bundle → 0-externe-Requests-Befund bleibt erhalten).
//
// Fallback-Verhalten (bewusst großzügig):
//   - keine Env gesetzt              → Overlay = null (Stub)
//   - Tabellen leer / Fehler / kein Zugriff → betroffene Felder weggelassen,
//     im Extremfall Overlay = null → Resolver nutzt die statischen Seeds.
//
// Quelle der Kanonik: players / matches / sponsors (SME Stage 1) + sm_tabelle
// (Cockpit, P3). Die exakte Spalten-Zuordnung wird beim SME-Backfill final
// bestätigt — die Mapper unten sind defensiv (optionale Felder, Defaults).
//
// Env (Node-seitig, NICHT VITE_-prefixed → landet nicht im Client-Bundle):
//   SUPABASE_URL, SUPABASE_READ_KEY   (Fallback: VITE_SUPABASE_URL / _ANON_KEY)
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'src', 'data', 'generated', 'website-content.generated.ts')

const HEADER = `// ─────────────────────────────────────────────────────────────
// AUTO-GENERIERT von scripts/fetch-content.mjs beim Build.
// NICHT von Hand pflegen / nicht committen (Build-Artefakt).
// ─────────────────────────────────────────────────────────────
import type { WebsiteContentOverlay } from '../content-overlay'
`

function writeOverlay(value) {
  mkdirSync(dirname(OUT), { recursive: true })
  const body =
    value === null
      ? 'export const WEBSITE_CONTENT_OVERLAY: WebsiteContentOverlay | null = null\n'
      : `export const WEBSITE_CONTENT_OVERLAY: WebsiteContentOverlay | null = ${JSON.stringify(value, null, 2)}\n`
  writeFileSync(OUT, HEADER + '\n' + body)
}

const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL
const key = process.env.SUPABASE_READ_KEY || process.env.VITE_SUPABASE_ANON_KEY

if (!url || !key) {
  writeOverlay(null)
  console.log('fetch-content: keine Build-Env → Overlay=null (statischer Fallback greift).')
  process.exit(0)
}

// ── Defensive Mapper (Spaltennamen beim SME-Backfill final bestätigen) ──────
const POS_MAP = { TW: 'TW', GK: 'TW', torwart: 'TW', ABW: 'ABW', DEF: 'ABW', abwehr: 'ABW', MIT: 'MIT', MID: 'MIT', mittelfeld: 'MIT', ANG: 'ANG', FW: 'ANG', sturm: 'ANG', angriff: 'ANG' }
function mapPos(v) {
  if (!v) return 'MIT'
  return POS_MAP[String(v)] || POS_MAP[String(v).toLowerCase()] || 'MIT'
}
function num(v, d = 0) {
  const n = Number(v)
  return Number.isFinite(n) ? n : d
}
function mapPlayer(r) {
  const stats = r.stats && typeof r.stats === 'object' ? r.stats : {}
  return {
    id: String(r.id),
    name: r.name ?? '',
    number: num(r.number ?? r.nummer, 0),
    position: mapPos(r.position),
    photoUrl: r.photo_url ?? r.foto_url ?? null,
    stats: {
      games: num(r.games ?? stats.games, 0),
      goals: num(r.goals ?? stats.goals, 0),
      assists: num(r.assists ?? stats.assists, 0),
    },
    rating: num(r.rating, 0),
    since: num(r.since ?? r.im_verein_seit, new Date().getFullYear()),
    ...(r.is_player_of_month ? { isPlayerOfMonth: true } : {}),
  }
}
function mapSponsor(r) {
  return {
    name: r.name ?? '',
    ...(r.logo_url ? { logoUrl: r.logo_url } : {}),
    ...(r.url ? { url: r.url } : {}),
  }
}
function mapTableRow(r) {
  return {
    pos: num(r.platz ?? r.pos, 0),
    team: r.team ?? '',
    sp: num(r.spiele ?? r.sp, 0),
    pkt: num(r.punkte ?? r.pkt, 0),
    ...(r.self ? { self: true } : {}),
  }
}

async function main() {
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(url, key, { auth: { persistSession: false } })

  // Jede Abfrage einzeln absichern — eine fehlende Tabelle darf den Build nicht kippen.
  const safe = async (fn) => {
    try {
      return await fn()
    } catch (e) {
      console.warn('fetch-content: Teil-Fehler ignoriert →', e?.message || e)
      return []
    }
  }

  const players = await safe(async () => {
    const { data, error } = await supabase.from('players').select('*')
    if (error) throw error
    return (data || []).map(mapPlayer)
  })
  const sponsors = await safe(async () => {
    const { data, error } = await supabase.from('sponsors').select('*')
    if (error) throw error
    return (data || []).map(mapSponsor)
  })
  const tabelle = await safe(async () => {
    const { data, error } = await supabase.from('sm_tabelle').select('*').order('platz', { ascending: true })
    if (error) throw error
    return (data || []).map(mapTableRow)
  })
  const matches = await safe(async () => {
    const { data, error } = await supabase.from('matches').select('*')
    if (error) throw error
    return data || []
  })

  // matches → nächstes (ohne Ergebnis, frühestes künftiges) & letztes (mit Ergebnis).
  let nextMatch = null
  let lastMatch = null
  if (matches.length > 0) {
    const withKick = matches
      .map((m) => ({ ...m, _k: m.kickoff ? new Date(m.kickoff).getTime() : NaN }))
      .filter((m) => Number.isFinite(m._k))
    const now = Date.now()
    const upcoming = withKick.filter((m) => m._k >= now).sort((a, b) => a._k - b._k)[0]
    const played = withKick.filter((m) => m._k < now).sort((a, b) => b._k - a._k)[0]
    if (upcoming) {
      nextMatch = {
        opponent: upcoming.opponent ?? upcoming.gegner ?? 'Gegner folgt',
        date: upcoming.date ?? '',
        home: !!(upcoming.home ?? upcoming.heim),
        ...(upcoming.kickoff ? { kickoff: upcoming.kickoff } : {}),
      }
    }
    if (played) {
      lastMatch = {
        opponent: played.opponent ?? played.gegner ?? '',
        date: played.date ?? '',
        home: !!(played.home ?? played.heim),
        goalsFor: num(played.goals_for ?? played.tore_sva, 0),
        goalsAgainst: num(played.goals_against ?? played.tore_gegner, 0),
      }
    }
  }

  const overlay = { source: 'db', generatedAt: new Date().toISOString() }
  if (players.length) overlay.players = players
  if (sponsors.length) overlay.sponsors = sponsors
  if (tabelle.length) overlay.table = tabelle
  if (nextMatch) overlay.nextMatch = nextMatch
  if (lastMatch) overlay.lastMatch = lastMatch

  // Nur wenn tatsächlich Daten vorliegen, ein Overlay schreiben — sonst Fallback.
  const hasData = players.length || sponsors.length || tabelle.length || nextMatch || lastMatch
  if (!hasData) {
    writeOverlay(null)
    console.log('fetch-content: Tabellen leer → Overlay=null (statischer Fallback greift).')
    return
  }
  writeOverlay(overlay)
  console.log(
    `fetch-content: Overlay geschrieben (players=${players.length}, sponsors=${sponsors.length}, table=${tabelle.length}, nextMatch=${!!nextMatch}, lastMatch=${!!lastMatch}).`,
  )
}

main().catch((e) => {
  // Harte Regel: Der Build darf NIE am Content-Fetch scheitern → Fallback.
  console.warn('fetch-content: Fehler → Overlay=null (statischer Fallback).', e?.message || e)
  writeOverlay(null)
  process.exit(0)
})
