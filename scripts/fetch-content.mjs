// ─────────────────────────────────────────────────────────────
// v14-C: Build-time Website-Content-Fetch („Vereins-Pflege" → Website).
//
// Läuft als ERSTER Schritt von `pnpm build` (vor tsc). Holt den im Admin
// gepflegten Stand über EINE öffentliche Supabase-Funktion
//   POST {SUPABASE_URL}/rest/v1/rpc/web_snapshot   (anon-Key reicht)
// und schreibt ihn als statisches Overlay nach
//   src/data/generated/website-content.generated.ts
// Fotos/Logos aus dem Storage werden dabei nach public/generated/ geladen,
// damit die Website zur Laufzeit 0 externe Requests behält.
//
// Fallback (hart): Der Build scheitert NIE an diesem Schritt. Bei fehlender
// Env, Timeout (10 s), Fehler oder leerem Snapshot → laute Warnung und
// Overlay = null → src/data/content.ts nutzt die statischen Seeds.
//
// Env (Node-seitig; NICHT VITE_-prefixed → landet nicht im Client-Bundle):
//   SUPABASE_URL, SUPABASE_READ_KEY   (Fallback: VITE_SUPABASE_URL / _ANON_KEY)
// Der Read-Key ist der öffentliche anon-Key — web_snapshot() gibt nur
// veröffentlichbare Felder heraus, alle Tabellen bleiben admin-only.
// ─────────────────────────────────────────────────────────────
import { writeFileSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const OUT = join(ROOT, 'src', 'data', 'generated', 'website-content.generated.ts')
const PUBLIC_GEN = join(ROOT, 'public', 'generated')
const TIMEOUT_MS = 10_000
const MAX_IMAGE_BYTES = 8 * 1024 * 1024

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

// Laut und unübersehbar im Netlify-Build-Log.
function loud(...lines) {
  const bar = '!'.repeat(72)
  console.warn(`\n${bar}\n!! fetch-content: WARNUNG — Website wird mit STATISCHEN Seeds gebaut\n${lines.map((l) => `!! ${l}`).join('\n')}\n${bar}\n`)
}

const isCI = process.env.NETLIFY === 'true' || process.env.CI === 'true'
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '')
const key = process.env.SUPABASE_READ_KEY || process.env.VITE_SUPABASE_ANON_KEY

// ── Hilfen ──────────────────────────────────────────────────────────────────
const POSITIONS = new Set(['TW', 'ABW', 'MIT', 'ANG'])
const STAFF_ROLES = new Set(['trainer', 'co-trainer', 'torwart-trainer', 'teammanager'])
const FORMATIONS = new Set(['4-4-2', '4-3-3', '4-2-3-1', '3-5-2'])
const str = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null)
const int = (v) => (Number.isInteger(v) ? v : null)

const TZ = 'Europe/Berlin'
function partsOf(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const f = (o) => new Intl.DateTimeFormat('de-DE', { timeZone: TZ, ...o }).format(d)
  return {
    wd: f({ weekday: 'short' }).replace('.', ''),
    dm: f({ day: '2-digit', month: '2-digit' }).replace(/\.?$/, '.'),
    hm: f({ hour: '2-digit', minute: '2-digit' }),
  }
}
/** „So · 12.10. · 15:00 Uhr" */
const formatKickoff = (iso) => {
  const p = partsOf(iso)
  return p ? `${p.wd} · ${p.dm} · ${p.hm} Uhr` : ''
}
/** „So · 12.10." */
const formatPlayed = (iso) => {
  const p = partsOf(iso)
  return p ? `${p.wd} · ${p.dm}` : ''
}

async function fetchWithTimeout(target, init = {}) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    return await fetch(target, { ...init, signal: ctrl.signal })
  } finally {
    clearTimeout(t)
  }
}

// Bilder lokalisieren: '/players/x.webp' (liegt in public/) bleibt; Storage-
// URLs vom eigenen Supabase-Host werden heruntergeladen. Fremde Hosts werden
// nicht geladen (die Website soll keine Drittanbieter-Bilder ziehen).
const ALLOWED_HOST = url ? new URL(url).host : null
const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/svg+xml': 'svg' }
let downloads = 0
async function localize(src, folder, base) {
  const s = str(src)
  if (!s) return null
  if (s.startsWith('/')) {
    if (!existsSync(join(ROOT, 'public', s))) console.warn(`fetch-content: Bild fehlt in public/: ${s}`)
    return s
  }
  let u
  try {
    u = new URL(s)
  } catch {
    console.warn(`fetch-content: ungültige Bild-URL ignoriert: ${s}`)
    return null
  }
  if (u.protocol !== 'https:' || u.host !== ALLOWED_HOST) {
    console.warn(`fetch-content: Bild von fremdem Host ignoriert: ${u.host}`)
    return null
  }
  try {
    const r = await fetchWithTimeout(s)
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const type = (r.headers.get('content-type') || '').split(';')[0].trim()
    const ext = EXT[type]
    if (!ext) throw new Error(`kein Bild (${type || 'ohne content-type'})`)
    const buf = Buffer.from(await r.arrayBuffer())
    if (buf.length > MAX_IMAGE_BYTES) throw new Error(`zu groß (${buf.length} Bytes)`)
    const hash = createHash('sha1').update(buf).digest('hex').slice(0, 10)
    const safe = String(base).replace(/[^a-z0-9-]/gi, '-').toLowerCase().slice(0, 48) || 'bild'
    const name = `${safe}-${hash}.${ext}`
    mkdirSync(join(PUBLIC_GEN, folder), { recursive: true })
    writeFileSync(join(PUBLIC_GEN, folder, name), buf)
    downloads++
    return `/generated/${folder}/${name}`
  } catch (e) {
    console.warn(`fetch-content: Bild-Download fehlgeschlagen (${s}): ${e?.message || e}`)
    return null
  }
}

// ── Mapper: Snapshot → Overlay (Typen siehe src/data/content-overlay.ts) ────
async function mapPlayer(p) {
  const id = str(p.id)
  const name = str(p.name)
  if (!id || !name) return null
  const photoUrl = await localize(p.photoUrl, 'players', id)
  // Freisteller nur, wenn es wirklich einen gibt — sonst würde die Karte ein
  // rechteckiges Foto wie einen Freisteller behandeln.
  const cutoutUrl = photoUrl ? await localize(p.cutoutUrl, 'players', `${id}-cutout`) : null
  return {
    id,
    name,
    number: int(p.number),
    position: POSITIONS.has(p.position) ? p.position : 'MIT',
    photoUrl,
    ...(cutoutUrl ? { cutoutUrl } : {}),
    // Keine Saisonzahlen/Ratings im Admin → neutrale Werte wie im Seed
    // (players.ts: STATS_TBD / RATING_TBD, Anzeige ist ausgeblendet).
    stats: { games: 0, goals: 0, assists: 0 },
    rating: 70,
    since: int(p.since),
    ...(p.isCaptain ? { isCaptain: true } : {}),
    ...(p.isNewSigning ? { isNewSigning: true } : {}),
  }
}

async function mapStaff(s) {
  const id = str(s.id)
  const name = str(s.name)
  if (!id || !name || !STAFF_ROLES.has(s.role)) return null
  const photoUrl = await localize(s.photoUrl, 'players', id)
  const cutoutUrl = photoUrl ? await localize(s.cutoutUrl, 'players', `${id}-cutout`) : null
  return {
    id,
    name,
    role: s.role,
    since: int(s.since),
    photoUrl,
    ...(cutoutUrl ? { cutoutUrl } : {}),
    ...(str(s.contactMessage) ? { contactMessage: str(s.contactMessage) } : {}),
    ...(s.isNewSigning ? { isNewSigning: true } : {}),
  }
}

// Aufstellung exakt im Vertrag von src/data/lineup.ts — oder gar nicht.
function mapLineup(l, playerIds) {
  if (!l) return { lineup: null, problem: null }
  if (!FORMATIONS.has(l.formation)) return { lineup: null, problem: `unbekannte Formation „${l.formation}"` }
  const startelf = Array.isArray(l.startelf) ? l.startelf.filter((x) => typeof x === 'string') : []
  const missing = startelf.filter((id) => !playerIds.has(id))
  if (startelf.length !== 11 || missing.length || new Set(startelf).size !== 11) {
    return {
      lineup: null,
      problem: `Startelf ungültig (${startelf.length} Spieler, ${missing.length} unbekannt/inaktiv: ${missing.join(', ') || '—'})`,
    }
  }
  const inElf = new Set(startelf)
  const bank = [...new Set((Array.isArray(l.bank) ? l.bank : []).filter((id) => playerIds.has(id) && !inElf.has(id)))]
  return {
    lineup: {
      formation: l.formation,
      startelf,
      bank,
      matchLabel: str(l.matchLabel),
      updatedAt: str(l.updatedAt),
    },
    problem: null,
  }
}

function mapContact(st) {
  if (!st) return null
  const c = {}
  if (str(st.address)) {
    c.address = str(st.address)
    c.mapsQuery = str(st.address)
  }
  if (str(st.email)) c.email = str(st.email)
  if (str(st.training)) c.training = str(st.training)
  // v15-L: Trainingsort ≠ Spielort (address = Waldsportplatz, Anfahrt/Karte)
  if (str(st.trainingOrt)) c.trainingOrt = str(st.trainingOrt)
  if (str(st.instagram)) {
    const h = str(st.instagram).replace(/^@/, '')
    c.instagram = `@${h}`
    c.instagramUrl = `https://instagram.com/${h}`
  }
  if (str(st.whatsapp) && /^[1-9]\d{7,14}$/.test(str(st.whatsapp))) c.whatsapp = str(st.whatsapp)
  return Object.keys(c).length ? c : null
}

function mapLinks(st) {
  if (!st) return null
  const l = {}
  if (str(st.fussballDeTeamId) && /^[A-Z0-9]{20,40}$/.test(str(st.fussballDeTeamId))) l.fussballDeTeamId = str(st.fussballDeTeamId)
  if (str(st.fupaUrl) && /^https:\/\/(www\.)?fupa\.net\//.test(str(st.fupaUrl))) l.fupaUrl = str(st.fupaUrl)
  return Object.keys(l).length ? l : null
}

// ── Ablauf ──────────────────────────────────────────────────────────────────
async function main() {
  if (!url || !key) {
    writeOverlay(null)
    if (isCI) {
      loud(
        'SUPABASE_URL / SUPABASE_READ_KEY sind im Netlify-Build nicht gesetzt.',
        'Admin-Änderungen erreichen die Website erst, wenn beide Env-Variablen gesetzt sind.',
        'Anleitung: docs/VEREINSPFLEGE.md',
      )
    } else {
      console.log('fetch-content: keine Build-Env → Overlay=null (statischer Fallback greift).')
    }
    return
  }

  let snap
  try {
    const r = await fetchWithTimeout(`${url}/rest/v1/rpc/web_snapshot`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
    const text = await r.text()
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 300)}`)
    snap = JSON.parse(text)
  } catch (e) {
    writeOverlay(null)
    loud(
      `web_snapshot() nicht erreichbar: ${e?.name === 'AbortError' ? `Timeout nach ${TIMEOUT_MS / 1000} s` : e?.message || e}`,
      'Mögliche Ursachen: Supabase-Projekt pausiert, Migration 20261004101000 nicht angewandt, falscher Key.',
    )
    return
  }
  if (!snap || typeof snap !== 'object') {
    writeOverlay(null)
    loud('web_snapshot() lieferte kein Objekt.')
    return
  }

  // Generierte Bilder bei jedem Build frisch (alte Fotos fliegen raus).
  rmSync(PUBLIC_GEN, { recursive: true, force: true })
  mkdirSync(PUBLIC_GEN, { recursive: true })
  writeFileSync(join(PUBLIC_GEN, '.gitignore'), '# Build-Artefakt von scripts/fetch-content.mjs\n*\n')

  const players = (await Promise.all((snap.players ?? []).map(mapPlayer))).filter(Boolean)
  const staff = (await Promise.all((snap.staff ?? []).map(mapStaff))).filter(Boolean)
  const playerIds = new Set(players.map((p) => p.id))
  const { lineup, problem: lineupProblem } = players.length ? mapLineup(snap.lineup, playerIds) : { lineup: null, problem: null }

  const sponsors = []
  for (const s of snap.sponsors ?? []) {
    const name = str(s.name)
    if (!name) continue
    const logoUrl = await localize(s.logoUrl, 'sponsors', name)
    const link = str(s.url)
    sponsors.push({
      name,
      ...(logoUrl ? { logoUrl } : {}),
      ...(link && /^https?:\/\//.test(link) ? { url: link } : {}),
      bande: s.bande !== false,
    })
  }

  const table = (snap.table ?? [])
    .filter((r) => str(r.team) && Number.isInteger(r.pos))
    .map((r) => {
      // v15-T: Tore/Gegentore mitnehmen → Website zeigt die Tordifferenz.
      const goals = int(r.goals)
      const against = int(r.against)
      return {
        pos: r.pos, team: str(r.team), sp: int(r.sp) ?? 0, pkt: int(r.pkt) ?? 0,
        ...(goals != null && against != null ? { goals, against } : {}),
        ...(r.self ? { self: true } : {}),
      }
    })

  const n = snap.nextMatch
  const nextMatch =
    n && str(n.opponent) && str(n.kickoff)
      ? { opponent: str(n.opponent), date: formatKickoff(n.kickoff), home: !!n.home, kickoff: str(n.kickoff) }
      : null
  const l = snap.lastMatch
  const lastMatch =
    l && str(l.opponent) && Number.isInteger(l.goalsFor) && Number.isInteger(l.goalsAgainst)
      ? { opponent: str(l.opponent), date: formatPlayed(l.kickoff), home: !!l.home, goalsFor: l.goalsFor, goalsAgainst: l.goalsAgainst }
      : null
  const form = (snap.form ?? []).filter((x) => x === 'W' || x === 'U' || x === 'N').slice(-5)

  const sections = (snap.sections ?? [])
    .filter((s) => str(s.id))
    .map((s) => {
      const o = { id: str(s.id) }
      for (const k of ['label', 'kicker', 'title', 'body']) if (typeof s[k] === 'string') o[k] = s[k]
      return o
    })

  const contact = mapContact(snap.settings)
  const links = mapLinks(snap.settings)

  const overlay = { source: 'db', generatedAt: new Date().toISOString() }
  if (players.length) overlay.players = players
  if (staff.length) overlay.staff = staff
  if (lineup) overlay.lineup = lineup
  if (sponsors.length) overlay.sponsors = sponsors
  if (table.length) overlay.table = table
  if (form.length) overlay.form = form
  if (nextMatch) overlay.nextMatch = nextMatch
  if (lastMatch) overlay.lastMatch = lastMatch
  if (sections.length) overlay.sections = sections
  if (contact) overlay.contact = contact
  if (links) overlay.links = links

  const hasData = Object.keys(overlay).length > 2
  if (!hasData) {
    writeOverlay(null)
    loud('web_snapshot() lieferte 0 verwertbare Zeilen (Kader, Spiele, Sponsoren, Links leer).', 'Seeds bleiben aktiv.')
    return
  }
  if (!players.length) loud('Kader im Snapshot leer → Website zeigt den statischen Kader (players.ts).')
  if (lineupProblem) loud(`Aufstellung NICHT übernommen: ${lineupProblem}`, 'Website zeigt die Seed-Elf (lineup.ts). Im Admin unter „Aufstellung" korrigieren.')

  writeOverlay(overlay)
  console.log(
    `fetch-content: Overlay geschrieben (players=${players.length}, staff=${staff.length}, lineup=${lineup ? lineup.formation : '—'}, ` +
      `sponsors=${sponsors.length}, table=${table.length}, form=${form.length}, nextMatch=${!!nextMatch}, lastMatch=${!!lastMatch}, ` +
      `sections=${sections.length}, contact=${!!contact}, links=${!!links}, bilder=${downloads}).`,
  )
}

// Selbsttest-Hook für lokale Prüfung: SNAPSHOT_FILE=pfad.json mappt eine
// gespeicherte Antwort ohne Netzwerk (nur Entwicklung).
if (process.env.SNAPSHOT_FILE) {
  const snapFile = process.env.SNAPSHOT_FILE
  globalThis.fetch = async (target) => {
    if (String(target).includes('/rpc/web_snapshot')) return new Response(readFileSync(snapFile, 'utf8'), { status: 200 })
    return new Response('nope', { status: 404 })
  }
}

main().catch((e) => {
  // Harte Regel: Der Build darf NIE am Content-Fetch scheitern → Fallback.
  writeOverlay(null)
  loud(`Unerwarteter Fehler: ${e?.message || e}`)
  process.exit(0)
})
