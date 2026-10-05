// ─────────────────────────────────────────────────────────────
// v17-A: Datenzugriff Admin → Album (Sammelalbum / Stickerheft).
// Tabellen sva_album_* (RLS: is_sm_admin()) + Admin-RPCs album_admin_*.
// Die Album-Tabellen stehen (noch) nicht in database.types.ts → eigene,
// schmale Zeilen-Typen und ein untypisierter Client-Zugriff NUR hier.
// retry:false → fehlt die Migration, erscheint sofort der ruhige Hinweis.
// ─────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'

const db = supabase as unknown as SupabaseClient

export type Seltenheit = 'bronze' | 'silber' | 'gold' | 'spezial'
export type KartenTyp = 'spieler' | 'trainer' | 'moment' | 'partner' | 'fan'

export interface KarteRow {
  id: string
  typ: KartenTyp
  roster_id: string | null
  sponsor_id: string | null
  titel: string
  untertitel: string | null
  bild_url: string | null
  walkout_url: string | null
  seltenheit: Seltenheit
  aktiv: boolean
  saison: string | null
  sortierung: number
  created_at: string
  updated_at: string
}
export type KarteInput = Partial<Omit<KarteRow, 'id' | 'created_at' | 'updated_at'>>

export interface EinstellungenRow {
  id: number
  aktiv: boolean
  gewicht_bronze: number
  gewicht_silber: number
  gewicht_gold: number
  gewicht_spezial: number
  karten_pro_pack: number
  doppelte_bremse: number
  fenster_vor_min: number
  fenster_nach_min: number
  bonus_heimsieg: boolean
  schwelle_1: number
  belohnung_1: string
  partner_1_id: string | null
  schwelle_2: number
  belohnung_2: string
  partner_2_id: string | null
  belohnung_komplett: string
  partner_komplett_id: string | null
  updated_at: string
  updated_by: string | null
}
export type EinstellungenInput = Partial<Omit<EinstellungenRow, 'id' | 'updated_at' | 'updated_by'>>

export interface CodeRow {
  spiel_id: string
  token: string
  partner_id: string | null
  erzeugt_at: string
  erzeugt_von: string | null
  bonus_at: string | null
}

export interface GutscheinRow {
  id: string
  fan_user_id: string
  saison: string
  stufe: 'schwelle_1' | 'schwelle_2' | 'komplett'
  titel: string
  partner_id: string | null
  code: string
  status: 'offen' | 'eingeloest'
  eingeloest_at: string | null
  eingeloest_durch: 'stand' | 'admin' | null
  created_at: string
  /** aus sva_album_fans dazugeholt */
  name?: string
}

export interface Statistik {
  saison: string
  fans: number
  fansRangliste: number
  fansErinnerung: number
  checkinsSaison: number
  packsOffen: number
  gutscheineOffen: number
  gutscheineEingeloest: number
  albenKomplett: number
  spiele: { spielId: string; checkins: number }[]
  kontakte: { name: string; email: string }[]
}

export const SELTEN = [
  { value: 'bronze', label: 'Kader (normal)', chance: 'häufig' },
  { value: 'silber', label: 'Silber-Folie', chance: 'selten' },
  { value: 'gold', label: 'Gold-Folie', chance: 'sehr selten' },
  { value: 'spezial', label: 'Glitzer-Spezial', chance: 'extrem selten' },
] as const
export const seltenLabel = (s: string) => SELTEN.find((x) => x.value === s)?.label ?? s

export const TYPEN = [
  { value: 'spieler', label: 'Spieler' },
  { value: 'trainer', label: 'Trainerstab' },
  { value: 'moment', label: 'Moment' },
  { value: 'partner', label: 'Partner' },
  { value: 'fan', label: 'Fans' },
] as const
export const typLabel = (t: string) => TYPEN.find((x) => x.value === t)?.label ?? t

export const albumKeys = {
  karten: ['sva_album_karten'] as const,
  einstellungen: ['sva_album_einstellungen'] as const,
  codes: ['sva_album_spielcodes'] as const,
  gutscheine: ['sva_album_gutscheine'] as const,
  statistik: ['album_admin_statistik'] as const,
}

// ── Katalog ─────────────────────────────────────────────────
export function useKarten() {
  return useQuery({
    queryKey: albumKeys.karten,
    queryFn: async (): Promise<KarteRow[]> => {
      const { data, error } = await db.from('sva_album_karten').select('*').order('typ').order('sortierung').order('titel')
      if (error) throw error
      return (data ?? []) as KarteRow[]
    },
    retry: false,
  })
}
export function useKartenMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: albumKeys.karten })
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: KarteInput }) => {
      const patch = { ...input, updated_at: new Date().toISOString() }
      const q = id ? db.from('sva_album_karten').update(patch).eq('id', id) : db.from('sva_album_karten').insert(patch)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: inv,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('sva_album_karten').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: inv,
  })
  const ausKader = useMutation({
    mutationFn: async (): Promise<{ bronze: number; gold: number; trainer: number; saison: string }> => {
      const { data, error } = await db.rpc('album_admin_spielerkarten')
      if (error) throw error
      return data
    },
    onSuccess: inv,
  })
  return { save, remove, ausKader }
}

/** Walkout-Videos suchen: public/players/walkout/<datei-oder-slug>.(webm|mp4|mov) */
export async function walkoutSuchen(k: KarteRow, rosterSlug?: string): Promise<string | null> {
  const basis = new Set<string>()
  const datei = k.bild_url?.split('/').pop()?.replace(/\.[a-z0-9]+$/i, '')
  if (datei) basis.add(datei)
  if (rosterSlug) basis.add(rosterSlug)
  for (const b of basis) {
    for (const ext of ['webm', 'mp4', 'mov']) {
      const url = `/players/walkout/${b}.${ext}`
      try {
        const r = await fetch(url, { method: 'HEAD', cache: 'no-store' })
        if (r.ok && (r.headers.get('content-type') ?? '').startsWith('video/')) return url
      } catch {
        /* weiter */
      }
    }
  }
  return null
}

/** Foto für Moment-/Fan-Sticker: lange Kante max. 1400 px, WebP. */
export async function renderStickerFoto(img: HTMLImageElement, maxSeite = 1400): Promise<Blob> {
  const s = Math.min(1, maxSeite / Math.max(img.naturalWidth, img.naturalHeight))
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(img.naturalWidth * s))
  c.height = Math.max(1, Math.round(img.naturalHeight * s))
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, c.width, c.height)
  const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/webp', 0.84))
  if (blob && blob.type === 'image/webp') return blob
  const jpg = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.86))
  if (!jpg) throw new Error('Bild konnte nicht umgewandelt werden.')
  return jpg
}

// ── Einstellungen (v17-D: ohne Stand-PIN) ─────────────────────────────────
export function useAlbumEinstellungen() {
  return useQuery({
    queryKey: albumKeys.einstellungen,
    queryFn: async (): Promise<EinstellungenRow | null> => {
      const { data, error } = await db
        .from('sva_album_einstellungen')
        .select(
          'id, aktiv, gewicht_bronze, gewicht_silber, gewicht_gold, gewicht_spezial, karten_pro_pack, doppelte_bremse, fenster_vor_min, fenster_nach_min, bonus_heimsieg, schwelle_1, belohnung_1, partner_1_id, schwelle_2, belohnung_2, partner_2_id, belohnung_komplett, partner_komplett_id, updated_at, updated_by',
        )
        .eq('id', 1)
        .maybeSingle()
      if (error) throw error
      return data as EinstellungenRow | null
    },
    retry: false,
  })
}
export function useSaveAlbumEinstellungen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: EinstellungenInput) => {
      const { data: u } = await supabase.auth.getUser()
      const { error } = await db
        .from('sva_album_einstellungen')
        .update({ ...input, updated_at: new Date().toISOString(), updated_by: u?.user?.email ?? null })
        .eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: albumKeys.einstellungen }),
  })
}
// ── Check-in-Codes ──────────────────────────────────────────
export function useCodes() {
  return useQuery({
    queryKey: albumKeys.codes,
    queryFn: async (): Promise<CodeRow[]> => {
      const { data, error } = await db.from('sva_album_spielcodes').select('*')
      if (error) throw error
      return (data ?? []) as CodeRow[]
    },
    retry: false,
  })
}
export function useCodeErzeugen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ spielId, partnerId, neu }: { spielId: string; partnerId: string | null; neu: boolean }) => {
      const { data, error } = await db.rpc('album_admin_code', { p_spiel: spielId, p_partner: partnerId, p_neu: neu })
      if (error) throw error
      return data as { spielId: string; token: string; partnerId: string | null }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: albumKeys.codes }),
  })
}

// ── Statistik (Live-Zähler) ─────────────────────────────────
export function useAlbumStatistik(live = false) {
  return useQuery({
    queryKey: albumKeys.statistik,
    queryFn: async (): Promise<Statistik> => {
      const { data, error } = await db.rpc('album_admin_statistik')
      if (error) throw error
      return data as Statistik
    },
    retry: false,
    refetchInterval: live ? 15_000 : 5 * 60_000,
  })
}

// ── Gutscheine ──────────────────────────────────────────────
export function useGutscheine() {
  return useQuery({
    queryKey: albumKeys.gutscheine,
    queryFn: async (): Promise<GutscheinRow[]> => {
      const [g, f] = await Promise.all([
        db.from('sva_album_gutscheine').select('*').order('created_at', { ascending: false }).limit(500),
        db.from('sva_album_fans').select('user_id, vorname, initial'),
      ])
      if (g.error) throw g.error
      const namen = new Map(((f.data ?? []) as { user_id: string; vorname: string; initial: string }[]).map((x) => [x.user_id, `${x.vorname} ${x.initial}.`]))
      return ((g.data ?? []) as GutscheinRow[]).map((r) => ({ ...r, name: namen.get(r.fan_user_id) }))
    },
    retry: false,
  })
}
export function useGutscheinEinloesen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from('sva_album_gutscheine')
        .update({ status: 'eingeloest', eingeloest_at: new Date().toISOString(), eingeloest_durch: 'admin' })
        .eq('id', id)
        .eq('status', 'offen')
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: albumKeys.gutscheine })
      void qc.invalidateQueries({ queryKey: albumKeys.statistik })
    },
  })
}
