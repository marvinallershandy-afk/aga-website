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
