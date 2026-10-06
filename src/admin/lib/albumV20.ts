// ─────────────────────────────────────────────────────────────
// v20-K: Admin-Datenzugriff für das Kartensystem: Standard-Katalog,
// Codes (Story/Partner/Advent), Ziele/Missionen, Verlosungen, MOTM.
// Tabellen/RPCs aus 20261012110000_sva_karten.sql (RLS: is_sm_admin()).
// ─────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { albumKeys, type KarteRow } from './album'
import type { RosterRow, SponsorRow } from './db'
import { vonAlbumKarte, type AlbumKarteQuelle } from '../../karten/adapter'
import type { KartenDaten, Position } from '../../karten/typen'

const db = supabase as unknown as SupabaseClient

export const v20Keys = {
  codes: ['sva_album_codes'] as const,
  ziele: ['sva_album_ziele'] as const,
  zielStatus: ['album_admin_ziel_status'] as const,
  verlosungen: ['sva_album_verlosungen'] as const,
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw error
  return data as T
}

// ── Karte (Admin-Zeile) → KartenDaten für Vorschau/Export ───
const POS: Record<string, Position> = { TW: 'TW', TORWART: 'TW', ABW: 'ABW', ABWEHR: 'ABW', ANG: 'ANG', STURM: 'ANG', ANGRIFF: 'ANG' }
export function adminKartenDaten(
  k: KarteRow,
  roster: RosterRow[],
  sponsoren: SponsorRow[],
  opts: { nr?: number; gesamt?: number; saison?: string } = {},
): KartenDaten {
  const r = k.roster_id ? roster.find((x) => x.id === k.roster_id) : undefined
  const sp = k.sponsor_id ? sponsoren.find((x) => x.id === k.sponsor_id) : undefined
  const pv = k.praesentiert_von ? sponsoren.find((x) => x.id === k.praesentiert_von) : undefined
  const q: AlbumKarteQuelle = {
    id: k.id,
    typ: k.typ,
    titel: k.titel,
    untertitel: k.untertitel ?? undefined,
    bildUrl: k.bild_url ?? undefined,
    seltenheit: k.seltenheit,
    variante: k.variante,
    limitiert: k.limitiert,
    serie: k.serie ?? undefined,
    credit: k.credit ?? undefined,
    bildFokus: k.bild_fokus ?? undefined,
    rueckseite: k.rueckseite ?? undefined,
    praesentiertVon: pv ? { name: pv.name, logoUrl: pv.logo_url ?? undefined } : undefined,
    spieler: r
      ? {
          slug: r.slug,
          name: r.name,
          nummer: r.nummer ?? undefined,
          position: POS[(r.position ?? '').toUpperCase()] ?? 'MIT',
          fotoUrl: r.foto_url ?? undefined,
          cutoutUrl: r.freisteller_url ?? undefined,
          kapitaen: r.kapitaen || undefined,
          rolle: r.rolle !== 'spieler' ? r.rolle : undefined,
          seit: r.im_verein_seit ?? undefined,
          neuzugang: r.neuzugang || undefined,
        }
      : undefined,
    partner: sp ? { name: sp.name, logoUrl: sp.logo_url ?? undefined, url: sp.website_url ?? undefined, seit: sp.laufzeit_von ? Number(sp.laufzeit_von.slice(0, 4)) : undefined } : undefined,
  }
  return vonAlbumKarte(q, opts)
}

// ── Standard-Katalog + MOTM ─────────────────────────────────
export function useKatalogStandard() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => rpc<{ saison: string; spielerBasis: number; varianten: number; trainer: number; momente: number; kurve: number; partner: number; albumPlaetze: number }>('album_admin_katalog_standard'),
    onSuccess: () => qc.invalidateQueries({ queryKey: albumKeys.karten }),
  })
}
export function useMotm() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (a: { roster: string; spiel?: string | null; bild?: string | null }) =>
      rpc<{ id: string; neu: boolean; ziehbarVon: string; ziehbarBis: string }>('album_admin_motm', { p_roster: a.roster, p_spiel: a.spiel ?? null, p_bild: a.bild ?? null }),
    onSuccess: () => qc.invalidateQueries({ queryKey: albumKeys.karten }),
  })
}

// ── Codes ───────────────────────────────────────────────────
export interface KartenCodeRow {
  id: string
  code: string
  art: 'story' | 'partner' | 'advent'
  titel: string
  karte_id: string | null
  karten: number
  gueltig_von: string
  gueltig_bis: string
  max_einloesungen: number | null
  aktiv: boolean
  advent_jahr: number | null
  advent_tag: number | null
  created_at: string
  einloesungen?: number
}
export function useKartenCodes() {
  return useQuery({
    queryKey: v20Keys.codes,
    queryFn: async (): Promise<KartenCodeRow[]> => {
      const [c, e] = await Promise.all([
        db.from('sva_album_codes').select('*').order('gueltig_von', { ascending: false }).limit(300),
        db.from('sva_album_code_einloesungen').select('code_id'),
      ])
      if (c.error) throw c.error
      const n = new Map<string, number>()
      for (const x of (e.data ?? []) as { code_id: string }[]) n.set(x.code_id, (n.get(x.code_id) ?? 0) + 1)
      return ((c.data ?? []) as KartenCodeRow[]).map((r) => ({ ...r, einloesungen: n.get(r.id) ?? 0 }))
    },
    retry: false,
  })
}
export function useCodeMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: v20Keys.codes })
  const einzel = useMutation({
    mutationFn: (a: { art: KartenCodeRow['art']; titel: string; karte?: string | null; karten?: number | null; stunden?: number; code?: string | null }) =>
      rpc<{ id: string; code: string; gueltigBis: string }>('album_admin_story_code', {
        p_art: a.art,
        p_titel: a.titel,
        p_karte: a.karte ?? null,
        p_karten: a.karten ?? null,
        p_stunden: a.stunden ?? 24,
        p_code: a.code ?? null,
      }),
    onSuccess: inv,
  })
  const massen = useMutation({
    mutationFn: (a: { start: string; tage: number; titel: string; karten?: number }) =>
      rpc<{ id: string; datum: string; code: string; gueltigVon: string; gueltigBis: string }[]>('album_admin_story_codes_massen', { p_start: a.start, p_tage: a.tage, p_titel: a.titel, p_karten: a.karten ?? 1 }),
    onSuccess: inv,
  })
  const advent = useMutation({
    mutationFn: (a: { jahr: number; karte?: string | null }) => rpc<{ tag: number; code: string }[]>('album_admin_advent', { p_jahr: a.jahr, p_karte: a.karte ?? null }),
    onSuccess: inv,
  })
  const aktiv = useMutation({
    mutationFn: async ({ id, aktiv }: { id: string; aktiv: boolean }) => {
      const { error } = await db.from('sva_album_codes').update({ aktiv }).eq('id', id)
      if (error) throw error
    },
    onSuccess: inv,
  })
  return { einzel, massen, advent, aktiv }
}

// ── Ziele / Missionen ───────────────────────────────────────
export type ZielTyp = 'set' | 'kapitel' | 'meilenstein' | 'serie_checkin' | 'serie_tipp' | 'sozial_tausch' | 'sozial_freund' | 'extern'
export interface ZielRow {
  id: string
  schluessel: string
  typ: ZielTyp
  vorlage: string | null
  titel: string
  beschreibung: string | null
  karten: string[] | null
  roster_ids: string[] | null
  kapitel: string | null
  anzahl: number | null
  belohnung_karten: number
  belohnung_min_seltenheit: string | null
  belohnung_lose: number
  geheim: boolean
  wiederholbar: boolean
  gueltig_von: string | null
  gueltig_bis: string | null
  aktiv: boolean
  sortierung: number
  saison: string | null
}
export type ZielInput = Partial<Omit<ZielRow, 'id'>>
export function useZiele() {
  return useQuery({
    queryKey: v20Keys.ziele,
    queryFn: async (): Promise<ZielRow[]> => {
      const { data, error } = await db.from('sva_album_ziele').select('*').order('sortierung').order('titel')
      if (error) throw error
      return (data ?? []) as ZielRow[]
    },
    retry: false,
  })
}
export interface ZielStatus {
  saison: string
  ziele: { id: string; schluessel: string; typ: string; titel: string; aktiv: boolean; geheim: boolean; erreicht: number; fans: number }[]
  erreicht: { ziel: string; titel: string; name: string; at: string; bezug: string; lose: number; pack: boolean }[]
}
export function useZielStatus() {
  return useQuery({ queryKey: v20Keys.zielStatus, queryFn: () => rpc<ZielStatus>('album_admin_ziel_status', { p_ziel: null }), retry: false })
}
export function useZielMutations() {
  const qc = useQueryClient()
  const inv = () => {
    void qc.invalidateQueries({ queryKey: v20Keys.ziele })
    void qc.invalidateQueries({ queryKey: v20Keys.zielStatus })
  }
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ZielInput }) => {
      const q = id ? db.from('sva_album_ziele').update(input).eq('id', id) : db.from('sva_album_ziele').insert(input)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: inv,
  })
  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('sva_album_ziele').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: inv,
  })
  const standard = useMutation({ mutationFn: () => rpc<{ angelegt: number; gesamt: number }>('album_admin_ziele_standard'), onSuccess: inv })
  return { save, remove, standard }
}

// ── Verlosungen ─────────────────────────────────────────────
export interface VerlosungRow {
  id: string
  titel: string
  preis: string | null
  bild_url: string | null
  partner_id: string | null
  stichtag: string | null
  min_lose: number
  saison: string
  status: 'offen' | 'gezogen'
  seed: string | null
  gezogen_at: string | null
  teilnehmer: number | null
  lose_gesamt: number | null
  gewinner_name: string | null
  protokoll: Record<string, unknown> | null
  created_at: string
}
export type VerlosungInput = Partial<Pick<VerlosungRow, 'titel' | 'preis' | 'bild_url' | 'partner_id' | 'stichtag' | 'min_lose' | 'saison'>>
export interface Ziehung {
  gewinner: { name: string; lose: number }
  teilnehmer: { name: string; lose: number }[]
  gewinnerIndex: number
  seed: string
  loseGesamt: number
  losNummer: number
}
export function useVerlosungen() {
  return useQuery({
    queryKey: v20Keys.verlosungen,
    queryFn: async (): Promise<VerlosungRow[]> => {
      const { data, error } = await db.from('sva_album_verlosungen').select('*').order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []) as VerlosungRow[]
    },
    retry: false,
  })
}
export function useVerlosungMutations() {
  const qc = useQueryClient()
  const inv = () => qc.invalidateQueries({ queryKey: v20Keys.verlosungen })
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: VerlosungInput }) => {
      const q = id ? db.from('sva_album_verlosungen').update(input).eq('id', id) : db.from('sva_album_verlosungen').insert(input)
      const { error } = await q
      if (error) throw error
    },
    onSuccess: inv,
  })
  const ziehen = useMutation({
    mutationFn: (a: { id: string; seed?: string | null }) => rpc<Ziehung>('album_admin_verlosung_ziehen', { p_id: a.id, p_seed: a.seed ?? null }),
    onSuccess: inv,
  })
  return { save, ziehen }
}

/** Preis-Vorlagen (nur Texte — nichts versprechen, mit dem Team abstimmen). */
export const PREIS_VORLAGEN = [
  { titel: 'Deine eigene Sammelkarte', preis: 'Fotoshooting mit picture by Nele — deine Karte im Album' },
  { titel: 'Ehrenanstoß', preis: 'Den Anstoß bei einem Heimspiel ausführen' },
  { titel: 'Mit dem Team unterwegs', preis: 'Mitfahrt im Mannschaftsbus oder Kabinenbesuch' },
  { titel: 'Grillabend mit dem Team', preis: 'Ein Abend mit der 1. Herren am Vereinsheim' },
  { titel: 'Dein Torjubel-Song', preis: 'Dein Song beim nächsten SVA-Tor oder einmal Halbzeit-Stadionsprecher' },
  { titel: 'Signiertes Trikot', preis: 'Original-Trikot mit allen Unterschriften' },
  { titel: 'Partner-Gutschein', preis: 'Gutschein eines SVA-Partners' },
] as const
