import { supabase } from './supabase'

// ── Datentypen (spiegeln sm_content / sm_ideen_pool) ────────────────────────

export interface ContentRow {
  id: string
  titel: string
  beschreibung: string | null
  kanal: string[]
  status: string
  format: string | null
  kategorie: string | null
  geplant_am: string | null // ISO-Datum (YYYY-MM-DD)
  verantwortlich: string | null
  idee_id: string | null
  notizen: string | null
  created_at: string
  updated_at: string
}

// Beim Anlegen/Bearbeiten schreibbare Felder
export type ContentInput = Partial<
  Pick<
    ContentRow,
    | 'titel'
    | 'beschreibung'
    | 'kanal'
    | 'status'
    | 'format'
    | 'kategorie'
    | 'geplant_am'
    | 'verantwortlich'
    | 'idee_id'
    | 'notizen'
  >
>

export interface IdeeRow {
  id: string
  titel: string
  beschreibung: string | null
  kanal: string[]
  kategorie: string | null
  rhythmus: string | null
  aktiv: boolean
  sortierung: number
  created_at: string
  updated_at: string
}

export type IdeeInput = Partial<
  Pick<IdeeRow, 'titel' | 'beschreibung' | 'kanal' | 'kategorie' | 'rhythmus' | 'aktiv'>
>

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
  const { data, error } = await supabase.from('sm_content').insert(input).select('*').single()
  if (error) throw error
  return data as ContentRow
}

export async function updateContent(id: string, patch: ContentInput): Promise<ContentRow> {
  const { data, error } = await supabase
    .from('sm_content')
    .update(patch)
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
  return (data ?? []) as IdeeRow[]
}

export async function createIdee(input: IdeeInput): Promise<IdeeRow> {
  const { data, error } = await supabase.from('sm_ideen_pool').insert(input).select('*').single()
  if (error) throw error
  return data as IdeeRow
}

export async function updateIdee(id: string, patch: IdeeInput): Promise<IdeeRow> {
  const { data, error } = await supabase
    .from('sm_ideen_pool')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as IdeeRow
}

export async function deleteIdee(id: string): Promise<void> {
  const { error } = await supabase.from('sm_ideen_pool').delete().eq('id', id)
  if (error) throw error
}
