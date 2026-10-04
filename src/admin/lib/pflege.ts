// ─────────────────────────────────────────────────────────────
// v14-C: Datenzugriff „Vereins-Pflege“ (Website-Daten).
//
// Kader/Spiele/Sponsoren/Tabelle nutzen weiter db.ts (sm_*-Tabellen, additiv
// erweitert). Neu hier: Aufstellung, Verein & Links, Veröffentlichen und der
// öffentliche Bild-Upload. Alles hinter RLS is_sm_admin().
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import type { Tables, TablesInsert } from './database.types'
import { friendlyError } from './db'

// ── Aufstellung (sva_lineup, append-only) ───────────────────────────────────
export type LineupRow = Tables<'sva_lineup'>
export type LineupInput = Omit<TablesInsert<'sva_lineup'>, 'id' | 'created_at' | 'erstellt_von'>

/** Aktuelle Aufstellung = jüngste Zeile (null, wenn noch keine gespeichert). */
export async function fetchLineup(): Promise<LineupRow | null> {
  const { data, error } = await supabase
    .from('sva_lineup')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data
}

/** Speichern = neue Zeile (Verlauf bleibt erhalten). */
export async function saveLineup(input: LineupInput): Promise<LineupRow> {
  const { data, error } = await supabase.from('sva_lineup').insert(input).select('*').single()
  if (error) throw error
  return data
}

// ── Verein & Links (sva_settings, genau 1 Zeile) ────────────────────────────
export type SettingsRow = Tables<'sva_settings'>
export type SettingsInput = Partial<Omit<TablesInsert<'sva_settings'>, 'id' | 'updated_at'>>

export async function fetchSettings(): Promise<SettingsRow | null> {
  const { data, error } = await supabase.from('sva_settings').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data
}

export async function saveSettings(input: SettingsInput): Promise<SettingsRow> {
  const { data: userData } = await supabase.auth.getUser()
  const { data, error } = await supabase
    .from('sva_settings')
    .upsert(
      { ...input, id: 1, updated_at: new Date().toISOString(), updated_by: userData?.user?.email ?? null },
      { onConflict: 'id' },
    )
    .select('*')
    .single()
  if (error) throw error
  return data
}

// ── Veröffentlichen (Edge Function publish-site + sva_publish_log) ──────────
export type PublishLogRow = Tables<'sva_publish_log'>

export async function fetchPublishLog(limit = 5): Promise<PublishLogRow[]> {
  const { data, error } = await supabase
    .from('sva_publish_log')
    .select('*')
    .order('angefordert_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

export type PublishResult =
  | { kind: 'gestartet'; startedAt: string }
  | { kind: 'warten'; sekunden: number }
  | { kind: 'nicht-eingerichtet'; grund: string }
  | { kind: 'fehler'; meldung: string }

/** Stößt über die Edge Function einen Netlify-Build an. Wirft nie — das
 *  Ergebnis ist immer ein für Menschen erklärbarer Zustand. */
export async function publishSite(): Promise<PublishResult> {
  try {
    const { data, error } = await supabase.functions.invoke('publish-site', { body: {} })
    if (error) {
      // FunctionsHttpError trägt die Response; 404 = Function nicht deployt.
      const ctx = (error as { context?: { status?: number } }).context
      const status = ctx && typeof ctx.status === 'number' ? ctx.status : null
      if (status === 404 || error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
        return { kind: 'nicht-eingerichtet', grund: 'Die Veröffentlichen-Funktion ist auf dem Server noch nicht eingerichtet.' }
      }
      if (status === 401 || status === 403) return { kind: 'fehler', meldung: 'Keine Berechtigung — bitte neu anmelden.' }
      if (status === 502) return { kind: 'fehler', meldung: 'Netlify hat den Auftrag abgelehnt. Bitte später nochmal versuchen.' }
      return { kind: 'fehler', meldung: friendlyError(error, 'Veröffentlichen fehlgeschlagen.') }
    }
    const d = (data ?? {}) as {
      configured?: boolean
      ok?: boolean
      cooldown?: boolean
      retryInSeconds?: number
      startedAt?: string
    }
    if (d.configured === false) {
      return { kind: 'nicht-eingerichtet', grund: 'Der Netlify-Build-Hook ist auf dem Server noch nicht hinterlegt.' }
    }
    if (d.cooldown) return { kind: 'warten', sekunden: d.retryInSeconds ?? 60 }
    if (d.ok) return { kind: 'gestartet', startedAt: d.startedAt ?? new Date().toISOString() }
    return { kind: 'fehler', meldung: 'Veröffentlichen fehlgeschlagen.' }
  } catch (e) {
    return { kind: 'fehler', meldung: friendlyError(e, 'Veröffentlichen fehlgeschlagen.') }
  }
}

// ── Öffentliche Bilder (Storage-Bucket sva_public) ──────────────────────────
export const PUBLIC_BUCKET = 'sva_public'

/** Lädt ein (bereits verkleinertes) Bild hoch und gibt die öffentliche URL zurück.
 *  Jeder Upload bekommt einen neuen Dateinamen → kein Cache-Problem. */
export async function uploadPublicImage(blob: Blob, folder: 'spieler' | 'sponsoren', base: string): Promise<string> {
  const ext = blob.type === 'image/png' ? 'png' : blob.type === 'image/jpeg' ? 'jpg' : 'webp'
  const safe = base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'bild'
  const path = `${folder}/${safe}-${Date.now().toString(36)}.${ext}`
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) {
    if (/bucket not found/i.test(error.message)) {
      throw new Error('Der Foto-Speicher ist noch nicht eingerichtet (Migration fehlt). Bitte Marvin Bescheid geben.')
    }
    throw error
  }
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(path).data.publicUrl
}

/** Aus einem Namen eine stabile, lesbare öffentliche ID: „Jörg Müller“ → „p-joerg-mueller“. */
export function slugFromName(name: string, prefix: 'p' | 's'): string {
  const base = name
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)
  return `${prefix}-${base || Math.random().toString(36).slice(2, 8)}`
}

// ── Kader-Vokabular (Website-Vertrag src/data/players.ts) ───────────────────
export const POSITION_CODES = [
  { value: 'TW', label: 'Torwart', kurz: 'TW' },
  { value: 'ABW', label: 'Abwehr', kurz: 'ABW' },
  { value: 'MIT', label: 'Mittelfeld', kurz: 'MIT' },
  { value: 'ANG', label: 'Angriff', kurz: 'ANG' },
] as const
export type PositionCode = (typeof POSITION_CODES)[number]['value']

/** Alt-Werte („Torwart“, „Sturm“ …) auf die Website-Codes abbilden — wie web_snapshot(). */
export function positionCode(v: string | null | undefined): PositionCode {
  switch ((v ?? '').toUpperCase()) {
    case 'TW':
    case 'TORWART':
      return 'TW'
    case 'ABW':
    case 'ABWEHR':
      return 'ABW'
    case 'ANG':
    case 'STURM':
    case 'ANGRIFF':
      return 'ANG'
    default:
      return 'MIT'
  }
}

export const STAFF_ROLLEN = [
  { value: 'trainer', label: 'Trainer' },
  { value: 'co-trainer', label: 'Co-Trainer' },
  { value: 'torwart-trainer', label: 'Torwart-Trainer' },
  { value: 'teammanager', label: 'Teammanager' },
] as const
export type Rolle = 'spieler' | (typeof STAFF_ROLLEN)[number]['value']
export function rolleLabel(r: string): string {
  return STAFF_ROLLEN.find((x) => x.value === r)?.label ?? 'Spieler'
}

/** fussball.de: Link ODER nackte Team-ID annehmen, Team-ID zurückgeben (oder null). */
export function parseFussballDeTeamId(input: string): string | null {
  const s = input.trim()
  if (!s) return null
  const m = s.match(/team-id\/([A-Za-z0-9]{20,40})/)
  const id = (m ? m[1] : s).toUpperCase()
  return /^[A-Z0-9]{20,40}$/.test(id) ? id : null
}
export const fussballDeUrl = (teamId: string) => `https://www.fussball.de/mannschaft/-/team-id/${teamId}#!/`

/** WhatsApp: „+49 151 / 123 45 678“ oder „0151 12345678“ → „4915112345678“ (oder null). */
export function normalizeWhatsapp(input: string): string | null {
  let d = input.replace(/[^\d+]/g, '')
  if (!d) return null
  if (d.startsWith('+')) d = d.slice(1)
  else if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = '49' + d.slice(1)
  d = d.replace(/\D/g, '')
  return /^[1-9]\d{7,14}$/.test(d) ? d : null
}
