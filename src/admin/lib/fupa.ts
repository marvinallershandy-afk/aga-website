// ─────────────────────────────────────────────────────────────
// v19-B: Datenzugriff Admin → FuPa-Abgleich.
// Tabelle sva_sync_log + Spalte sva_settings.fupa_auto + Edge Function
// fupa-sync. Beides steht (noch) nicht in database.types.ts → eigene,
// schmale Zeilen-Typen und ein untypisierter Client-Zugriff NUR hier
// (gleiches Muster wie album.ts). retry:false → fehlt die Migration,
// erscheint sofort der ruhige Hinweis.
// ─────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { friendlyError } from './db'

const db = supabase as unknown as SupabaseClient

export interface SyncLogRow {
  id: string
  zeit: string
  quelle: string
  ausloeser: 'auto' | 'manuell'
  status: 'ok' | 'fehler' | 'uebersprungen' | 'nicht_konfiguriert'
  geaendert: number
  fehler: string | null
  details: {
    spiele_neu?: number
    spiele_aktualisiert?: number
    spiele_geschuetzt?: number
    spiele_gesamt_fupa?: number
    tabelle_plaetze?: number
    tabelle_geaendert?: boolean
    tabelle_fehler?: string
    publish?: 'ausgeloest' | 'nicht_konfiguriert' | 'nicht_noetig'
    grund?: string
  }
  angefordert_von: string | null
}

/** Jüngster Abgleich-Eintrag (null, wenn noch nie gelaufen). */
export function useLetzterSync() {
  return useQuery({
    queryKey: ['fupa-sync-log'],
    retry: false,
    queryFn: async (): Promise<SyncLogRow | null> => {
      const { data, error } = await db
        .from('sva_sync_log')
        .select('*')
        .order('zeit', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      return (data as SyncLogRow | null) ?? null
    },
  })
}

/** Schalter „Automatischer Abgleich" (sva_settings.fupa_auto, Standard an). */
export function useFupaAuto() {
  return useQuery({
    queryKey: ['fupa-auto'],
    retry: false,
    queryFn: async (): Promise<boolean> => {
      const { data, error } = await db.from('sva_settings').select('fupa_auto').eq('id', 1).maybeSingle()
      if (error) throw error
      const row = data as { fupa_auto?: boolean } | null
      return row?.fupa_auto ?? true
    },
  })
}

export function useSetFupaAuto() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (an: boolean) => {
      const { error } = await db.from('sva_settings').update({ fupa_auto: an }).eq('id', 1)
      if (error) throw new Error(friendlyError(error, 'Schalter konnte nicht gespeichert werden.'))
      return an
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['fupa-auto'] }),
  })
}

export type SyncErgebnis =
  | { kind: 'ok'; geaendert: number; details: SyncLogRow['details'] }
  | { kind: 'uebersprungen'; grund: string }
  | { kind: 'nicht-eingerichtet'; grund: string }
  | { kind: 'fehler'; meldung: string }

/** „Jetzt abgleichen" — ruft die Edge Function fupa-sync (als Admin). Wirft nie. */
export function useJetztAbgleichen() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<SyncErgebnis> => {
      try {
        const { data, error } = await supabase.functions.invoke('fupa-sync', { body: {} })
        if (error) {
          const ctx = (error as { context?: { status?: number } }).context
          const status = ctx && typeof ctx.status === 'number' ? ctx.status : null
          if (status === 404 || error.name === 'FunctionsFetchError' || error.name === 'FunctionsRelayError') {
            return { kind: 'nicht-eingerichtet', grund: 'Die FuPa-Funktion ist auf dem Server noch nicht eingerichtet.' }
          }
          if (status === 401 || status === 403) return { kind: 'fehler', meldung: 'Keine Berechtigung — bitte neu anmelden.' }
          return { kind: 'fehler', meldung: friendlyError(error, 'Abgleich fehlgeschlagen.') }
        }
        const d = (data ?? {}) as {
          ok?: boolean; configured?: boolean; uebersprungen?: boolean; grund?: string
          geaendert?: number; error?: string; detail?: string
        } & SyncLogRow['details']
        if (d.configured === false) return { kind: 'nicht-eingerichtet', grund: d.grund ?? 'In „Verein & Links" fehlt eine gültige FuPa-Teamseite.' }
        if (d.uebersprungen) return { kind: 'uebersprungen', grund: d.grund ?? 'Automatischer Abgleich ist ausgeschaltet.' }
        if (d.ok) return { kind: 'ok', geaendert: d.geaendert ?? 0, details: d }
        return { kind: 'fehler', meldung: d.detail ?? d.error ?? 'Abgleich fehlgeschlagen.' }
      } catch (e) {
        return { kind: 'fehler', meldung: friendlyError(e, 'Abgleich fehlgeschlagen.') }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fupa-sync-log'] })
      qc.invalidateQueries({ queryKey: ['spiele'] })
      qc.invalidateQueries({ queryKey: ['tabelle'] })
    },
  })
}
