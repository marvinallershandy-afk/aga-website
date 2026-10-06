// ─────────────────────────────────────────────────────────────
// v20-T: Datenzugriff Admin → Tipp-Liga. Alles über RPCs
// (supabase/migrations/20261012100000_sva_tippliga.sql), nur die
// Einstellungen (1 Zeile) direkt per Tabelle (RLS: is_sm_admin()).
// retry:false → fehlt die Migration, erscheint sofort der ruhige Hinweis.
// ─────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { BonusKey, Duell, PartnerInfo, RangEintrag } from '../../tippen/api'

const db = supabase as unknown as SupabaseClient

export interface BerichtZeile {
  id: string
  name: string
  nummer?: number
  position: 'TW' | 'ABW' | 'MIT' | 'ANG'
  eingesetzt: boolean
  minuten?: number | null
  tore: number
  vorlagen: number
  karte?: 'gelb' | 'gelbrot' | 'rot' | null
  zuNull: boolean
  start?: boolean
}

export interface Bericht {
  spiel: { id: string; gegner: string; heim: boolean; anstoss: string; status: string; toreSva?: number; toreGegner?: number; liveSva?: number; liveGegner?: number; demo?: boolean; motm?: string | null }
  wertung?: 'saison' | 'winter'
  offen: boolean
  gespeichert: boolean
  berichtAt?: string
  gewertetAt?: string
  mitTicker: boolean
  mitAufstellung: boolean
  zeilen: BerichtZeile[]
  fragen: { key: BonusKey; linie?: number }[]
  aufloesungAuto: Partial<Record<BonusKey, string>>
  aufloesung: Partial<Record<BonusKey, string>>
  ersterTorschuetze?: string
  ersterAuto?: string
  checkins?: number
  anzahlTipps: number
  anzahlElf: number
  albumMotm: boolean
}

export interface AdminSpieltag {
  id: string
  gegner: string
  heim: boolean
  anstoss: string
  wettbewerb?: string
  status: string
  toreSva?: number
  toreGegner?: number
  pflichtspiel: boolean
  tippbarSchalter?: boolean | null
  wertung?: 'saison' | 'winter'
  offen: boolean
  fragen: BonusKey[]
  fragenAuto: boolean
  linie?: number
  linieAuto?: boolean
  berichtAt?: string
  gewertetAt?: string
  anzahlTipps: number
  anzahlElf: number
}

export interface StoryDaten {
  partner?: PartnerInfo
  storyCode?: string
  preise?: string
  offen?: { id: string; gegner: string; heim: boolean; anstoss: string; schluss: string; anzahlTipps: number }
  spieltag?: { id: string; gegner: string; heim: boolean; anstoss: string; toreSva?: number; toreGegner?: number; sieger: RangEintrag[]; teilnehmer: number; schnitt?: number }
  top5?: RangEintrag[]
  duell?: Duell
  teilnehmerGesamt: number
}

export interface Teilnehmer {
  userId: string
  name: string
  email?: string
  kabine: boolean
  sichtbar: boolean
  seit: string
  tipps: number
  punkte: number
}

export interface TippEinstellungen {
  id: number
  aktiv: boolean
  partner_id: string | null
  preise: string | null
  story_code: string | null
  elf_frei: boolean
  winter_von: string
  winter_bis: string
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(fn, args)
  if (error) throw error
  return data as T
}

export const tippKeys = {
  spieltage: ['tipp_admin_spieltage'] as const,
  bericht: (id: string) => ['tipp_admin_bericht', id] as const,
  story: ['tipp_admin_story'] as const,
  teilnehmer: (q: string) => ['tipp_admin_teilnehmer', q] as const,
  einstellungen: ['sva_tipp_einstellungen'] as const,
}

export function useTippSpieltage() {
  return useQuery({ queryKey: tippKeys.spieltage, queryFn: () => rpc<AdminSpieltag[]>('tipp_admin_spieltage'), retry: false })
}

export function useBericht(spiel: string | null) {
  return useQuery({
    queryKey: tippKeys.bericht(spiel ?? '-'),
    queryFn: () => rpc<Bericht>('tipp_admin_bericht', { p_spiel: spiel }),
    enabled: !!spiel,
    retry: false,
  })
}

export function useBerichtAktionen() {
  const qc = useQueryClient()
  const inv = (id: string) => {
    void qc.invalidateQueries({ queryKey: tippKeys.bericht(id) })
    void qc.invalidateQueries({ queryKey: tippKeys.spieltage })
    void qc.invalidateQueries({ queryKey: tippKeys.story })
  }
  const speichern = useMutation({
    mutationFn: (v: { spiel: string; zeilen: BerichtZeile[]; aufloesung: Partial<Record<BonusKey, string>>; erster?: string | null; motm?: string | null; ergebnis?: { toreSva: number; toreGegner: number } | null }) =>
      rpc<{ ok: true; zeilen: number }>('tipp_admin_bericht_speichern', {
        p_spiel: v.spiel,
        p_zeilen: v.zeilen,
        p_aufloesung: v.aufloesung,
        p_erster: v.erster ?? null,
        p_motm: v.motm ?? null,
        p_ergebnis: v.ergebnis ?? null,
      }),
    onSuccess: (_d, v) => inv(v.spiel),
  })
  const werten = useMutation({
    mutationFn: (spiel: string) => rpc<{ ok: true; teilnehmer: number; schnitt?: number; max?: number; exakt: number }>('tipp_admin_werten', { p_spiel: spiel }),
    onSuccess: (_d, spiel) => inv(spiel),
  })
  // Album-Modul (Paket v20-karten): MOTM-Spezialkarte veröffentlichen
  const motmKarte = useMutation({
    mutationFn: (spiel: string) => rpc<unknown>('album_motm_karte_veroeffentlichen', { p_spiel: spiel }),
  })
  return { speichern, werten, motmKarte }
}

export function useSpieltagSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { spiel: string; tippbar: boolean | null; fragen: BonusKey[] | null; linie: number | null }) =>
      rpc<{ ok: true }>('tipp_admin_spieltag_speichern', { p_spiel: v.spiel, p_tippbar: v.tippbar, p_fragen: v.fragen, p_linie: v.linie }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: tippKeys.spieltage }),
  })
}

export function useStoryDaten(an = true) {
  return useQuery({ queryKey: tippKeys.story, queryFn: () => rpc<StoryDaten>('tipp_admin_story'), enabled: an, retry: false })
}

export function useTeilnehmer(q: string) {
  return useQuery({
    queryKey: tippKeys.teilnehmer(q),
    queryFn: () => rpc<{ gesamt: number; kabine: number; liste: Teilnehmer[] }>('tipp_admin_teilnehmer', { p_suche: q || null }),
    retry: false,
  })
}

export function useKabine() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { user: string; kabine: boolean }) => rpc<{ ok: true }>('tipp_admin_kabine', { p_user: v.user, p_kabine: v.kabine }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tipp_admin_teilnehmer'] }),
  })
}

export function useTippEinstellungen() {
  return useQuery({
    queryKey: tippKeys.einstellungen,
    queryFn: async (): Promise<TippEinstellungen | null> => {
      const { data, error } = await db.from('sva_tipp_einstellungen').select('*').eq('id', 1).maybeSingle()
      if (error) throw error
      return data as TippEinstellungen | null
    },
    retry: false,
  })
}

export function useTippEinstellungenSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (patch: Partial<Omit<TippEinstellungen, 'id'>>) => {
      const { error } = await db.from('sva_tipp_einstellungen').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
      if (error) throw error
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: tippKeys.einstellungen })
      void qc.invalidateQueries({ queryKey: tippKeys.story })
    },
  })
}

// ── v21-T: Kader für „Deine Elf“ (Zweitposition, nicht verfügbar) ──
export interface TippKaderZeile {
  id: string
  name: string
  nummer?: number
  position: 'TW' | 'ABW' | 'MIT' | 'ANG'
  fotoUrl?: string
  cutoutUrl?: string
  zweitposition?: 'TW' | 'ABW' | 'MIT' | 'ANG' | null
  nichtVerfuegbar: boolean
  hinweis?: string | null
}

export function useTippKader() {
  return useQuery({ queryKey: ['tipp_admin_kader'], queryFn: () => rpc<TippKaderZeile[]>('tipp_admin_kader'), retry: false })
}

export function useTippSpielerSpeichern() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: { spieler: string; zweitposition: string | null; nichtVerfuegbar: boolean; hinweis?: string | null }) =>
      rpc<{ ok: true }>('tipp_admin_spieler_speichern', {
        p_spieler: v.spieler,
        p_zweitposition: v.zweitposition,
        p_nicht_verfuegbar: v.nichtVerfuegbar,
        p_hinweis: v.hinweis ?? null,
      }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['tipp_admin_kader'] }),
  })
}

// ── v22-T: Preise (Tabelle sva_tipp_preise, RLS: nur Admin) ──
export interface TippPreis {
  id: string
  wertung: 'saison' | 'monat'
  platz: number
  titel: string
  beschreibung: string | null
  partner_id: string | null
  ab_alter: 16 | 18 | null
  alternative: string | null
  aktiv: boolean
}

export function useTippPreise() {
  return useQuery({
    queryKey: ['sva_tipp_preise'],
    queryFn: async (): Promise<TippPreis[]> => {
      const { data, error } = await db.from('sva_tipp_preise').select('*').order('wertung').order('platz')
      if (error) throw error
      return (data ?? []) as TippPreis[]
    },
    retry: false,
  })
}

export function useTippPreisAktionen() {
  const qc = useQueryClient()
  const neu = () => void qc.invalidateQueries({ queryKey: ['sva_tipp_preise'] })
  const speichern = useMutation({
    mutationFn: async (p: Omit<TippPreis, 'id' | 'aktiv'> & { id?: string }) => {
      const zeile = { wertung: p.wertung, platz: p.platz, titel: p.titel, beschreibung: p.beschreibung, partner_id: p.partner_id, ab_alter: p.ab_alter, alternative: p.alternative, aktiv: true }
      const { error } = p.id ? await db.from('sva_tipp_preise').update(zeile).eq('id', p.id) : await db.from('sva_tipp_preise').insert(zeile)
      if (error) throw error
    },
    onSuccess: neu,
  })
  const loeschen = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from('sva_tipp_preise').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: neu,
  })
  return { speichern, loeschen }
}
