import { supabase } from './supabase'
import type { Tables, TablesInsert } from './database.types'
import type { Status } from './constants'

// ── Datentypen: aus dem Supabase-Schema generiert (database.types.ts),
//    Status-Spalten auf die Unions aus constants.ts verengt. ────────────────

export type ContentRow = Omit<Tables<'sm_content'>, 'status'> & { status: Status }

// Beim Anlegen/Bearbeiten schreibbare Felder
export type ContentInput = Partial<Omit<TablesInsert<'sm_content'>, 'id' | 'created_at' | 'updated_at'>>

export type IdeeRow = Tables<'sm_ideen_pool'>
export type IdeeInput = Partial<Omit<TablesInsert<'sm_ideen_pool'>, 'id' | 'created_at' | 'updated_at'>>

export type SpielRow = Tables<'sm_spiele'>
export type SpielInput = Partial<Omit<TablesInsert<'sm_spiele'>, 'id' | 'created_at' | 'updated_at'>>

export type RosterRow = Tables<'sm_roster'>
export type RosterInput = Partial<Omit<TablesInsert<'sm_roster'>, 'id' | 'created_at' | 'updated_at'>>

export type SponsorRow = Tables<'sm_sponsoren'>
export type SponsorInput = Partial<Omit<TablesInsert<'sm_sponsoren'>, 'id' | 'created_at' | 'updated_at'>>

export type InsightRow = Tables<'sm_insights'>
export type InsightInput = Partial<Omit<TablesInsert<'sm_insights'>, 'id' | 'created_at' | 'updated_at'>>

export type EingangStatus = 'offen' | 'geprueft' | 'uebernommen' | 'verworfen'
export type EingangRow = Omit<Tables<'sm_ideen_eingang'>, 'status'> & { status: EingangStatus }
export type EingangInput = Partial<Omit<TablesInsert<'sm_ideen_eingang'>, 'id' | 'created_at' | 'updated_at'>>

// ── sm_content ──────────────────────────────────────────────────────────────

export async function fetchContent(): Promise<ContentRow[]> {
  const { data, error } = await supabase
    .from('sm_content')
    .select('*')
    .order('geplant_am', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: true })
  if (error) throw error
  return (data ?? []) as ContentRow[]
}

export async function createContent(input: ContentInput): Promise<ContentRow> {
  const { data, error } = await supabase.from('sm_content').insert(input as TablesInsert<'sm_content'>).select('*').single()
  if (error) throw error
  return data as ContentRow
}

export async function updateContent(id: string, patch: ContentInput): Promise<ContentRow> {
  const { data, error } = await supabase
    .from('sm_content')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as ContentRow
}

export async function deleteContent(id: string): Promise<void> {
  const { error } = await supabase.from('sm_content').delete().eq('id', id)
  if (error) throw error
}

// ── sm_ideen_pool ───────────────────────────────────────────────────────────

export async function fetchIdeen(): Promise<IdeeRow[]> {
  const { data, error } = await supabase
    .from('sm_ideen_pool')
    .select('*')
    .order('sortierung', { ascending: true })
    .order('titel', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createIdee(input: IdeeInput): Promise<IdeeRow> {
  const { data, error } = await supabase.from('sm_ideen_pool').insert(input as TablesInsert<'sm_ideen_pool'>).select('*').single()
  if (error) throw error
  return data
}

export async function updateIdee(id: string, patch: IdeeInput): Promise<IdeeRow> {
  const { data, error } = await supabase
    .from('sm_ideen_pool')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteIdee(id: string): Promise<void> {
  const { error } = await supabase.from('sm_ideen_pool').delete().eq('id', id)
  if (error) throw error
}

// ── sm_ideen_eingang (Team-Inbox) ───────────────────────────────────────────

export async function fetchEingang(): Promise<EingangRow[]> {
  const { data, error } = await supabase
    .from('sm_ideen_eingang')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as EingangRow[]
}

export async function createEingang(input: EingangInput): Promise<EingangRow> {
  const { data, error } = await supabase.from('sm_ideen_eingang').insert(input as TablesInsert<'sm_ideen_eingang'>).select('*').single()
  if (error) throw error
  return data as EingangRow
}

export async function updateEingang(id: string, patch: EingangInput): Promise<EingangRow> {
  const { data, error } = await supabase
    .from('sm_ideen_eingang')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as EingangRow
}

export async function deleteEingang(id: string): Promise<void> {
  const { error } = await supabase.from('sm_ideen_eingang').delete().eq('id', id)
  if (error) throw error
}

// Eingangs-Idee → Redaktionsplan. Läuft als Postgres-Funktion in EINER
// Transaktion (Migration sm_eingang_into_plan_rpc) — kein verwaister Content
// mehr, wenn der zweite Schritt fehlschlägt.
export async function eingangIntoPlan(row: EingangRow): Promise<ContentRow> {
  const { data, error } = await supabase.rpc('sm_eingang_into_plan', { p_eingang_id: row.id })
  if (error) throw error
  return data as ContentRow
}

// ── sm_spiele ───────────────────────────────────────────────────────────────

export async function fetchSpiele(): Promise<SpielRow[]> {
  const { data, error } = await supabase
    .from('sm_spiele')
    .select('*')
    .order('anstoss', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createSpiel(input: SpielInput): Promise<SpielRow> {
  const { data, error } = await supabase
    .from('sm_spiele')
    .insert(input as TablesInsert<'sm_spiele'>)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateSpiel(id: string, patch: SpielInput): Promise<SpielRow> {
  const { data, error } = await supabase
    .from('sm_spiele')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteSpiel(id: string): Promise<void> {
  const { error } = await supabase.from('sm_spiele').delete().eq('id', id)
  if (error) throw error
}

// Ein Klick → komplettes Spieltagspaket (4 Beiträge, idempotent; RPC läuft in
// einer Transaktion, Migration sm_spiele_roster).
export async function spieltagspaket(spielId: string): Promise<ContentRow[]> {
  const { data, error } = await supabase.rpc('sm_spieltagspaket', { p_spiel_id: spielId })
  if (error) throw error
  return (data ?? []) as ContentRow[]
}

// ── sm_roster (Kader) ───────────────────────────────────────────────────────

export async function fetchRoster(): Promise<RosterRow[]> {
  const { data, error } = await supabase
    .from('sm_roster')
    .select('*')
    .order('sortierung', { ascending: true })
    .order('nummer', { ascending: true, nullsFirst: false })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createSpieler(input: RosterInput): Promise<RosterRow> {
  const { data, error } = await supabase
    .from('sm_roster')
    .insert(input as TablesInsert<'sm_roster'>)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateSpieler(id: string, patch: RosterInput): Promise<RosterRow> {
  const { data, error } = await supabase
    .from('sm_roster')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteSpieler(id: string): Promise<void> {
  const { error } = await supabase.from('sm_roster').delete().eq('id', id)
  if (error) throw error
}

// ── sm_sponsoren (CRM) ──────────────────────────────────────────────────────

export async function fetchSponsoren(): Promise<SponsorRow[]> {
  const { data, error } = await supabase
    .from('sm_sponsoren')
    .select('*')
    .order('aktiv', { ascending: false })
    .order('name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createSponsor(input: SponsorInput): Promise<SponsorRow> {
  const { data, error } = await supabase
    .from('sm_sponsoren')
    .insert(input as TablesInsert<'sm_sponsoren'>)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateSponsor(id: string, patch: SponsorInput): Promise<SponsorRow> {
  const { data, error } = await supabase
    .from('sm_sponsoren')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteSponsor(id: string): Promise<void> {
  const { error } = await supabase.from('sm_sponsoren').delete().eq('id', id)
  if (error) throw error
}

// ── sm_insights (manuelle Kanal-KPIs) ───────────────────────────────────────

export async function fetchInsights(): Promise<InsightRow[]> {
  const { data, error } = await supabase
    .from('sm_insights')
    .select('*')
    .order('datum', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function upsertInsight(input: InsightInput): Promise<InsightRow> {
  // unique(datum, kanal): erneutes Eintragen derselben Woche überschreibt.
  const { data, error } = await supabase
    .from('sm_insights')
    .upsert({ ...(input as TablesInsert<'sm_insights'>), updated_at: new Date().toISOString() }, { onConflict: 'datum,kanal' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteInsight(id: string): Promise<void> {
  const { error } = await supabase.from('sm_insights').delete().eq('id', id)
  if (error) throw error
}

// ── sm_tabelle (P3: Ligatabelle, Cockpit-Hoheit) ────────────────────────────
export type TabelleRow = Tables<'sm_tabelle'>
// diff ist eine generierte Spalte → nicht schreibbar; aus dem Input ausschließen.
export type TabelleInput = Partial<Omit<TablesInsert<'sm_tabelle'>, 'id' | 'created_at' | 'updated_at'>>

export async function fetchTabelle(): Promise<TabelleRow[]> {
  const { data, error } = await supabase
    .from('sm_tabelle')
    .select('*')
    .order('platz', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function createTabelleZeile(input: TabelleInput & { platz: number; team: string }): Promise<TabelleRow> {
  const { data, error } = await supabase
    .from('sm_tabelle')
    .insert(input as TablesInsert<'sm_tabelle'>)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function updateTabelleZeile(id: string, patch: TabelleInput): Promise<TabelleRow> {
  const { data, error } = await supabase
    .from('sm_tabelle')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data
}

export async function deleteTabelleZeile(id: string): Promise<void> {
  const { error } = await supabase.from('sm_tabelle').delete().eq('id', id)
  if (error) throw error
}

// ── sm_webhooks (P2: Automationen produktiv) ────────────────────────────────
export type WebhookRow = Tables<'sm_webhooks'>
export type WebhookInput = Partial<Omit<TablesInsert<'sm_webhooks'>, 'id' | 'created_at' | 'updated_at'>>

export type DeliveryRow = Tables<'sm_webhook_deliveries'>
export type DeliveryInput = Partial<Omit<TablesInsert<'sm_webhook_deliveries'>, 'id' | 'gesendet_at'>>

// Postgres meldet eine fehlende Tabelle mit SQLSTATE 42P01, PostgREST (neuere
// Versionen) mit PGRST205 „Could not find the table … in the schema cache“.
// Solange eine Migration noch nicht angewandt ist, degradiert die UI darauf
// sauber (Hinweis/Fallback) statt hart zu crashen.
export function isMissingTable(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  const msg = (err as { message?: string }).message ?? ''
  return code === '42P01' || code === 'PGRST205' || /could not find the table/i.test(msg)
}

// Fehlende Spalte/Funktion (Migration 20261004* noch nicht angewandt):
// 42703 / PGRST204 (Spalte), 42883 / PGRST202 (Funktion).
export function isMissingSchema(err: unknown): boolean {
  if (isMissingTable(err)) return true
  if (!err || typeof err !== 'object') return false
  const code = (err as { code?: string }).code
  const msg = (err as { message?: string }).message ?? ''
  return (
    code === '42703' || code === 'PGRST204' || code === '42883' || code === 'PGRST202' ||
    /could not find the .* (column|function)/i.test(msg)
  )
}

// v19-S (Audit C): Postgres-/PostgREST-Fehlercodes → deutsche Sätze. Greift,
// wenn keine spezifischere Meldung (Constraint-Name) passt — damit nie ein
// roher englischer DB-Fehler („permission denied for function …") in der
// Ehrenamts-UI landet.
const CODE_TEXTE: Record<string, string> = {
  '42501': 'Dafür fehlt dir die Berechtigung. Mit dem Team-Zugang geht nicht alles — melde dich bei Marvin.',
  '23505': 'Das gibt es schon — doppelter Eintrag.',
  '23503': 'Das hängt noch an anderen Daten. Bitte dort zuerst entfernen.',
  '23502': 'Ein Pflichtfeld fehlt noch.',
  '23514': 'Die Eingabe passt nicht zu den Regeln. Bitte die Werte prüfen.',
  '22P02': 'Ungültige Eingabe (falsches Format).',
  '22001': 'Eingabe zu lang.',
  '40001': 'Gerade hat jemand anderes gespeichert. Bitte noch einmal versuchen.',
  '40P01': 'Gerade hat jemand anderes gespeichert. Bitte noch einmal versuchen.',
  '57014': 'Das hat zu lange gedauert. Bitte noch einmal versuchen.',
  PGRST301: 'Du bist nicht mehr angemeldet. Bitte neu anmelden.',
  '401': 'Du bist nicht mehr angemeldet. Bitte neu anmelden.',
}

/** Verständliche Fehlermeldung für Ehrenamtliche statt Postgres-Jargon. */
export function friendlyError(err: unknown, fallback = 'Das hat nicht geklappt.'): string {
  if (isMissingSchema(err)) {
    return 'Die Datenbank ist noch nicht auf dem neuen Stand (Migration fehlt). Bitte Marvin Bescheid geben.'
  }
  const msg = err instanceof Error ? err.message : (err as { message?: string } | null)?.message
  const code = (err as { code?: string } | null)?.code
  if (msg && /sva_lineup_startelf_check|kein_doppelter/i.test(msg)) {
    return 'Aufstellung ungültig: genau 11 verschiedene Spieler in der Startelf, niemand doppelt auf der Bank.'
  }
  if (msg && /sm_admins_email_key|duplicate key.*sm_admins/i.test(msg)) return 'Diese E-Mail hat schon einen Zugang.'
  if (msg && /sm_admins_email_format/i.test(msg)) return 'E-Mail bitte klein und ohne Leerzeichen, z. B. name@beispiel.de.'
  if (msg && /widget_(tabelle|spielplan)_check/i.test(msg)) return 'fussball.de-Widget-ID: genau 32 Zeichen (Buchstaben/Ziffern).'
  if (msg && /sva_team_nur_live_felder/i.test(msg)) return 'Mit dem Team-Zugang lassen sich nur Ergebnis und Live-Stand ändern.'
  if (msg && /whatsapp_check/i.test(msg)) return 'WhatsApp-Nummer bitte nur mit Ziffern, z. B. 4915112345678.'
  if (msg && /slug/i.test(msg) && /unique|duplicate/i.test(msg)) return 'Diesen Spieler gibt es schon (gleicher Name).'
  if (msg && /failed to fetch|networkerror|load failed/i.test(msg)) return 'Keine Verbindung. Bitte Netz prüfen und nochmal versuchen.'
  // v19-S: eigene DB-Ausnahmen (raise exception) sind bereits deutsch → zeigen.
  if (code === 'P0001' && msg) return msg.replace(/^[a-z_]+:\s*/i, '')
  // Bekannte PG-/PostgREST-Codes übersetzen.
  if (code && CODE_TEXTE[code]) return CODE_TEXTE[code]
  if (msg && /permission denied/i.test(msg)) return CODE_TEXTE['42501']
  if (msg && /JWT|not authenticated|401/i.test(msg)) return CODE_TEXTE['401']
  // Letzter Ausweg: nie einen rohen englischen PG-Satz zeigen.
  if (msg && /^[\x00-\x7F]*$/.test(msg) && /(permission|denied|violates|constraint|function|relation|syntax|invalid input)/i.test(msg)) return fallback
  return msg || fallback
}

export async function fetchWebhooks(): Promise<WebhookRow[]> {
  const { data, error } = await supabase
    .from('sm_webhooks')
    .select('*')
    .order('event', { ascending: true })
  if (error) throw error
  return data ?? []
}

// Upsert je Event (event ist unique). Legt den Andockpunkt an oder aktualisiert URL/aktiv.
export async function upsertWebhook(input: WebhookInput & { event: string }): Promise<WebhookRow> {
  const { data, error } = await supabase
    .from('sm_webhooks')
    .upsert({ ...(input as TablesInsert<'sm_webhooks'>), updated_at: new Date().toISOString() }, { onConflict: 'event' })
    .select('*')
    .single()
  if (error) throw error
  return data
}

// Nach einem Versand: letzten Status/Zeitpunkt an der Registry festhalten
// und eine Zeile ins Zustell-Log schreiben (Grundgerüst der Beobachtbarkeit).
export async function recordDelivery(args: {
  webhookId: string | null
  event: string
  status: 'ok' | 'fehler'
  httpCode?: number | null
  payloadExcerpt?: string | null
}): Promise<void> {
  const now = new Date().toISOString()
  const { error: delErr } = await supabase.from('sm_webhook_deliveries').insert({
    webhook_id: args.webhookId,
    event: args.event,
    status: args.status,
    http_code: args.httpCode ?? null,
    payload_excerpt: args.payloadExcerpt ?? null,
  })
  if (delErr) throw delErr
  if (args.webhookId) {
    const { error: upErr } = await supabase
      .from('sm_webhooks')
      .update({ letzter_versand: now, letzter_status: args.status, updated_at: now })
      .eq('id', args.webhookId)
    if (upErr) throw upErr
  }
}

// Letzte Zustellungen je Event (für die "letzter Versand/Status"-Anzeige).
export async function fetchRecentDeliveries(limit = 20): Promise<DeliveryRow[]> {
  const { data, error } = await supabase
    .from('sm_webhook_deliveries')
    .select('*')
    .order('gesendet_at', { ascending: false })
    .limit(limit)
  if (error) throw error
  return data ?? []
}

// P4-Durchstich: Feuert den n8n-Andockpunkt für ein Event, sofern in
// sm_webhooks eine aktive URL hinterlegt ist, und protokolliert den Versand.
// Fehlt die Tabelle oder die URL, passiert nichts (kein Fehler nach außen) —
// so bleibt der Grafik-Export unabhängig vom Automations-Zustand lauffähig.
export async function fireWebhook(
  event: string,
  payload: Record<string, unknown>,
): Promise<'gesendet' | 'keine-url' | 'nicht-verfuegbar'> {
  const { data: hook, error } = await supabase
    .from('sm_webhooks')
    .select('*')
    .eq('event', event)
    .maybeSingle()
  if (error) {
    if (isMissingTable(error)) return 'nicht-verfuegbar'
    throw error
  }
  if (!hook || !hook.aktiv || !hook.url?.trim()) return 'keine-url'

  let ok = true
  try {
    await fetch(hook.url, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
  } catch {
    ok = false
  }
  try {
    await recordDelivery({
      webhookId: hook.id,
      event,
      status: ok ? 'ok' : 'fehler',
      httpCode: null,
      payloadExcerpt: JSON.stringify(payload).slice(0, 200),
    })
  } catch {
    /* Log-Fehler nicht eskalieren */
  }
  return 'gesendet'
}

// P4-Durchstich: fertige Grafik am zugehörigen Redaktionsplan-Beitrag
// verankern (drive_asset_url) und den Beitrag auf „fertig“ setzen.
export async function linkContentAsset(contentId: string, assetUrl: string): Promise<ContentRow> {
  const { data, error } = await supabase
    .from('sm_content')
    .update({ drive_asset_url: assetUrl, status: 'fertig', updated_at: new Date().toISOString() })
    .eq('id', contentId)
    .select('*')
    .single()
  if (error) throw error
  return data as ContentRow
}
