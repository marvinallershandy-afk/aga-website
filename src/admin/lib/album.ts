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
  // v20-K
  variante?: boolean
  limitiert?: boolean
  ziehbar_von?: string | null
  ziehbar_bis?: string | null
  nur_spiel_id?: string | null
  praesentiert_von?: string | null
  credit?: string | null
  bild_fokus?: string | null
  rueckseite?: string | null
  serie?: string | null
  motm_spiel_id?: string | null
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
  // v20-K
  karten_starter?: number
  starter_min_silber?: boolean
  karten_heimsieg?: number
  karten_tipp?: number
  karten_story?: number
  karten_freund?: number
  karten_kapitel?: number
  smart_pack?: boolean
  smart_pack_belohnung?: boolean
  schwelle_3?: number | null
  belohnung_3?: string
  partner_3_id?: string | null
  tausch_min_tage?: number
  tausch_pro_woche?: number
  wunsch_kosten?: number
  code_fehler_limit?: number
  lose_checkin?: number
  lose_komplett?: number
  teilnahme_text?: string
  /** v22: Shiny-Chance 1 : N je Spieler-/Trainer-Karte (0 = aus) */
  shiny_chance?: number
  /** v22: Gründungstag (YYYY-MM-DD; Tag + Monat zählen) */
  vereins_geburtstag?: string | null
  /** v24-P: Smart-Pack erst ab so vielen Karten je Pack (Einzelkarten = reiner Zufall) */
  smart_ab_karten?: number
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
  { value: 'bronze', label: 'Kader (Basis)', chance: '70 %' },
  { value: 'silber', label: 'Silber', chance: '22 %' },
  { value: 'gold', label: 'Gold', chance: '7 %' },
  { value: 'spezial', label: 'Spezial', chance: '1 %' },
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
        .select('*')
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

// ── v22: Shiny-Funde + Geheimkarten ─────────────────────────
export interface ShinyFundRow {
  karteId: string
  gezogen?: string
  person: string
  fan: string
  at: string
  anzahl: number
  erstfund: boolean
}
export interface ShinyUebersicht {
  saison: string
  chance: number
  gesamt: number
  personen: number
  fans: number
  funde: ShinyFundRow[]
  erstfunde: { person: string; name: string; at: string; karteId: string }[]
}
export interface GeheimEi {
  schluessel: string
  aktiv: boolean
  raetsel: string
  sortierung: number
  karte?: { id: string; titel: string; untertitel?: string; typ: KartenTyp; seltenheit: Seltenheit; bildUrl?: string; serie?: string; rueckseite?: string; bildFokus?: string; limitiert?: boolean; geheim?: boolean }
  kartenAktiv?: boolean
  gefunden: number
}
export const v22Keys = { shiny: ['album', 'v22', 'shiny'] as const, geheim: ['album', 'v22', 'geheim'] as const, katalog: ['album', 'v22', 'katalog'] as const }
export function useShinyUebersicht() {
  return useQuery({
    queryKey: v22Keys.shiny,
    queryFn: async (): Promise<ShinyUebersicht> => {
      const { data, error } = await db.rpc('album_admin_shiny')
      if (error) throw error
      return data as ShinyUebersicht
    },
    retry: false,
  })
}
export function useGeheimEier() {
  return useQuery({
    queryKey: v22Keys.geheim,
    queryFn: async (): Promise<{ vereinsGeburtstag: string | null; eier: GeheimEi[] }> => {
      const { data, error } = await db.rpc('album_admin_geheim')
      if (error) throw error
      return data as { vereinsGeburtstag: string | null; eier: GeheimEi[] }
    },
    retry: false,
  })
}
export function useGeheimSetzen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ schluessel, ...p }: { schluessel: string; aktiv?: boolean; raetsel?: string }) => {
      const { error } = await db.from('sva_album_geheim').update(p).eq('schluessel', schluessel)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: v22Keys.geheim }),
  })
}
export function useGeheimStandard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await db.rpc('album_admin_geheim_standard')
      if (error) throw error
      return data as { karten: number; eier: number }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: v22Keys.geheim }),
  })
}
/** Öffentlicher Katalog (nur lesen) — Kartenlabor + Story-Grafiken. */
export function useOeffentlicherKatalog(an = true) {
  return useQuery({
    queryKey: v22Keys.katalog,
    enabled: an,
    queryFn: async () => {
      const { data, error } = await db.rpc('album_katalog')
      if (error) throw error
      return data as import('../../album/api').Katalog
    },
    retry: false,
  })
}

// ── v24-P: Pack-Typen + Pack-Kontrolle ──────────────────────
export type PackTypSchluessel = 'tipp' | 'spieltag' | 'sieg' | 'starter' | 'ziel' | 'event'
export interface PackTypRow {
  typ: PackTypSchluessel
  titel: string
  karten: number
  min_seltenheit: 'silber' | 'gold' | 'spezial' | null
  optik: 'klein' | 'gross' | 'gold' | 'starter' | 'ziel' | 'event'
  reveal: 1 | 2 | 3
  limitiert_chance: number
  smart: boolean
  beschreibung: string | null
  sortierung: number
  updated_at: string
}
export type PackTypInput = Partial<Omit<PackTypRow, 'typ' | 'updated_at'>>
export const packKeys = { typen: ['sva_album_pack_typen'] as const, kontrolle: ['sva_admin_pack_kontrolle'] as const }
export function usePackTypen() {
  return useQuery({
    queryKey: packKeys.typen,
    queryFn: async (): Promise<PackTypRow[]> => {
      const { data, error } = await db.from('sva_album_pack_typen').select('*').order('sortierung')
      if (error) throw error
      return (data ?? []) as PackTypRow[]
    },
    retry: false,
  })
}
export function useSavePackTyp() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ typ, ...p }: PackTypInput & { typ: PackTypSchluessel }) => {
      const { error } = await db.from('sva_album_pack_typen').update({ ...p, updated_at: new Date().toISOString() }).eq('typ', typ)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: packKeys.typen }),
  })
}
export interface PackAnlass {
  anlass: string
  art: string
  titel: string
  soll: number
  ist: number
  fehlend: number
  doppelt: number
  fans: string[]
}
export interface PackKontrolle {
  saison: string
  ok: boolean
  soll: number
  ist: number
  fehlend: number
  doppelt: number
  anlaesse: PackAnlass[]
}
export function usePackKontrolle() {
  return useQuery({
    queryKey: packKeys.kontrolle,
    queryFn: async (): Promise<PackKontrolle | null> => {
      const { data, error } = await db.rpc('sva_admin_pack_kontrolle')
      if (error) throw error
      return data as PackKontrolle | null
    },
    retry: false,
    refetchInterval: 60_000,
  })
}
export function usePackNachliefern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (anlass: string) => {
      const { data, error } = await db.rpc('album_admin_pack_nachliefern', { p_anlass: anlass })
      if (error) throw error
      return data as { nachgeliefert: number; offen: number }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: packKeys.kontrolle }),
  })
}
