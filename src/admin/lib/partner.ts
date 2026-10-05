// ─────────────────────────────────────────────────────────────
// v16-S: Datenzugriff Partner-Bereich (Admin → Partner).
// Tabellen: sva_partner_pakete, sva_partner_info (1 Zeile), sva_partner_anfragen
// (+ sm_sponsoren.stufe/partner_paket_id über db.ts). Alles hinter RLS
// is_sm_admin(). retry:false → fehlt die Migration, erscheint sofort der
// ruhige Hinweis statt eines langen Ladezustands.
// ─────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from './supabase'
import type { Tables, TablesInsert } from './database.types'
import { keys } from './queries'

export type PaketRow = Tables<'sva_partner_pakete'>
export type PaketInput = Partial<Omit<TablesInsert<'sva_partner_pakete'>, 'id' | 'created_at'>>
export type PartnerInfoRow = Tables<'sva_partner_info'>
export type PartnerInfoInput = Partial<Omit<TablesInsert<'sva_partner_info'>, 'id' | 'updated_at' | 'updated_by'>>
export type AnfrageRow = Tables<'sva_partner_anfragen'>

export const STUFEN = [
  { value: 'hauptpartner', label: 'Hauptpartner', hint: 'groß oben auf der Partner-Wand' },
  { value: 'partner', label: 'Partner', hint: 'normale Kachel' },
  { value: 'unterstuetzer', label: 'Unterstützer', hint: 'kleine Kachel' },
] as const
export const stufeLabel = (v: string | null | undefined) => STUFEN.find((s) => s.value === v)?.label ?? 'Partner'

export const EINHEITEN = ['Saison', 'Spieltag', 'Monat', 'einmalig'] as const

export const ANFRAGE_STATUS = [
  { value: 'neu', label: 'Neu', dot: '#E91D29' },
  { value: 'in_kontakt', label: 'In Kontakt', dot: '#E8C15A' },
  { value: 'gewonnen', label: 'Gewonnen', dot: '#22c55e' },
  { value: 'abgelehnt', label: 'Abgelehnt', dot: '#6b7280' },
] as const
export type AnfrageStatus = (typeof ANFRAGE_STATUS)[number]['value']

export const partnerKeys = {
  pakete: ['sva_partner_pakete'] as const,
  info: ['sva_partner_info'] as const,
  anfragen: ['sva_partner_anfragen'] as const,
}

// ── Pakete ──────────────────────────────────────────────────
async function fetchPakete(): Promise<PaketRow[]> {
  const { data, error } = await supabase.from('sva_partner_pakete').select('*').order('sortierung').order('name')
  if (error) throw error
  return data ?? []
}
export function usePakete() {
  return useQuery({ queryKey: partnerKeys.pakete, queryFn: fetchPakete, retry: false })
}
export function usePaketeMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: partnerKeys.pakete })
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: PaketInput }) => {
      const patch = { ...input, updated_at: new Date().toISOString() }
      const q = id
        ? supabase.from('sva_partner_pakete').update(patch).eq('id', id)
        : supabase.from('sva_partner_pakete').insert(patch as TablesInsert<'sva_partner_pakete'>)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sva_partner_pakete').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      void invalidate()
      // Sponsoren verlieren das Paket (on delete set null)
      void qc.invalidateQueries({ queryKey: keys.sponsoren })
    },
  })
  return { save, remove }
}

// ── Mediadaten + „Live-Ticker präsentiert von“ ──────────────
async function fetchInfo(): Promise<PartnerInfoRow | null> {
  const { data, error } = await supabase.from('sva_partner_info').select('*').eq('id', 1).maybeSingle()
  if (error) throw error
  return data
}
export function usePartnerInfo() {
  return useQuery({ queryKey: partnerKeys.info, queryFn: fetchInfo, retry: false })
}
export function useSavePartnerInfo() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: PartnerInfoInput) => {
      const { data: u } = await supabase.auth.getUser()
      const { data, error } = await supabase
        .from('sva_partner_info')
        .upsert({ ...input, id: 1, updated_at: new Date().toISOString(), updated_by: u?.user?.email ?? null }, { onConflict: 'id' })
        .select('*')
        .single()
      if (error) throw error
      return data
    },
    onSuccess: (row) => qc.setQueryData(partnerKeys.info, row),
  })
}

// ── Anfragen ────────────────────────────────────────────────
async function fetchAnfragen(): Promise<AnfrageRow[]> {
  const { data, error } = await supabase.from('sva_partner_anfragen').select('*').order('created_at', { ascending: false }).limit(200)
  if (error) throw error
  return data ?? []
}
export function useAnfragen() {
  return useQuery({ queryKey: partnerKeys.anfragen, queryFn: fetchAnfragen, retry: false, refetchInterval: 5 * 60_000 })
}
export function useAnfragenMutations() {
  const qc = useQueryClient()
  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: { status?: AnfrageStatus; notiz?: string | null } }) => {
      const { error } = await supabase
        .from('sva_partner_anfragen')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: partnerKeys.anfragen })
      const prev = qc.getQueryData<AnfrageRow[]>(partnerKeys.anfragen)
      qc.setQueryData<AnfrageRow[]>(partnerKeys.anfragen, (rows) => rows?.map((r) => (r.id === id ? { ...r, ...patch } : r)))
      return { prev }
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(partnerKeys.anfragen, ctx.prev)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: partnerKeys.anfragen }),
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sva_partner_anfragen').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: partnerKeys.anfragen }),
  })
  return { update, remove }
}

/** Anzahl „neu“ — für Badge in Übersicht und Tab. 0 bei fehlender Migration. */
export function useNeueAnfragen(): number {
  const q = useAnfragen()
  return (q.data ?? []).filter((a) => a.status === 'neu').length
}

// ── Live-Partner für die Story-Grafik (Team + Admin) ────────
// Über die öffentliche RPC web_live(): der Team-Zugang darf sva_partner_info
// nicht lesen, braucht für die Endstand-Grafik aber Name + Logo.
export async function fetchLivePartner(): Promise<{ name: string; logoUrl?: string } | null> {
  try {
    const { data, error } = await supabase.rpc('web_live')
    if (error || !data || typeof data !== 'object') return null
    const p = (data as { partner?: { name?: string; logoUrl?: string } | null }).partner
    return p?.name ? { name: p.name, logoUrl: p.logoUrl } : null
  } catch {
    return null
  }
}
