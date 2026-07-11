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
