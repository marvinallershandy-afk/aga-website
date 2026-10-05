// ─────────────────────────────────────────────────────────────
// v18-A: Admin → Verein & Links → „Mannschaften (Probetraining)“.
// Tabelle sva_mannschaften (RLS: is_sm_admin(), Migration 20261009090000).
// Untypisierter Client nur hier (Tabelle noch nicht in database.types.ts).
// ─────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const db = supabase as unknown as SupabaseClient

export interface MannschaftRow {
  id: string
  schluessel: string
  name: string
  hinweis: string | null
  training: string | null
  ansprechpartner: string | null
  whatsapp: string | null
  sichtbar: boolean
  sortierung: number
  created_at: string
  updated_at: string
}
export type MannschaftInput = Partial<Omit<MannschaftRow, 'id' | 'created_at' | 'updated_at'>>

const KEY = ['sva_mannschaften'] as const

export function useMannschaften() {
  return useQuery({
    queryKey: KEY,
    queryFn: async (): Promise<MannschaftRow[]> => {
      const { data, error } = await db.from('sva_mannschaften').select('*').order('sortierung').order('name')
      if (error) throw error
      return (data ?? []) as MannschaftRow[]
    },
    retry: false,
  })
}

export function useMannschaftSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: MannschaftInput }) => {
      const patch = { ...input, updated_at: new Date().toISOString() }
      const q = id ? db.from('sva_mannschaften').update(patch).eq('id', id) : db.from('sva_mannschaften').insert(patch)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

export function useMannschaftLoeschen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('sva_mannschaften').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
}

/** „2. Herren“ → „2-herren“ (eindeutiger Schlüssel, nur a-z 0-9 -) */
export function schluesselAus(name: string, vorhandene: string[]): string {
  const basis =
    name
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 34) || 'team'
  let k = basis
  for (let i = 2; vorhandene.includes(k); i++) k = `${basis}-${i}`
  return k
}
