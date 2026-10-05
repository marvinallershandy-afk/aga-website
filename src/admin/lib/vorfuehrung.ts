// ─────────────────────────────────────────────────────────────
// v18-T „Vorführ-Spiel“: Admin-Aktionen über die RPCs der Migration
// 20261010100000_sva_demo_spiel.sql (nur is_sm_admin()):
//   sva_demo_starten(p_gegner, p_beispiele, p_anpfiff) · sva_demo_beenden() ·
//   sva_demo_loeschen()
// Das Vorführ-Spiel selbst ist eine normale Zeile in sm_spiele mit demo = true
// (höchstens eine). useSpiele() blendet sie überall aus; nur das Ticker-Pult
// und die Vorführ-Karte lesen sie über useSpieleMitVorfuehrung().
// Untypisierter Client nur hier (RPCs stehen nicht in database.types.ts).
// ─────────────────────────────────────────────────────────────
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { keys } from './queries'
import type { SpielRow } from './db'

const db = supabase as unknown as SupabaseClient

export const VORSCHLAG_GEGNER = 'FC Vorführung'

/** Ist diese Zeile das Vorführ-Spiel? (ohne Migration: Feld fehlt → nein) */
export const istVorfuehrSpiel = (s: Pick<SpielRow, 'demo'> | null | undefined): boolean => !!s?.demo

export interface StartOptionen {
  gegner: string
  beispiele: boolean
  /** false = vor dem Anpfiff (Countdown, ANPFIFF im Ticker-Pult drücken) */
  anpfiff: boolean
}

export interface DemoAntwort {
  id: string
  gegner?: string
  status: string
}

function lesbar(e: unknown): Error {
  const msg = (e as { message?: string } | null)?.message ?? String(e)
  if (/nicht_erlaubt/.test(msg)) return new Error('Nur Admins dürfen das Vorführ-Spiel steuern.')
  if (/sva_demo_gegner/.test(msg)) return new Error('Gegnername bitte höchstens 60 Zeichen.')
  if (/sva_demo_fehlt/.test(msg)) return new Error('Es gibt gerade kein Vorführ-Spiel.')
  if (/function .*sva_demo|could not find the function|PGRST202/i.test(msg))
    return new Error('Die Datenbank kennt das Vorführ-Spiel noch nicht (Migration 20261010100000 fehlt). Bitte Marvin Bescheid geben.')
  return e instanceof Error ? e : new Error(msg)
}

async function rpc<T>(name: string, args?: Record<string, unknown>): Promise<T> {
  const { data, error } = await db.rpc(name, args)
  if (error) throw lesbar(error)
  return data as T
}

export function useVorfuehrungAktionen() {
  const qc = useQueryClient()
  const auffrischen = (id?: string) => {
    void qc.invalidateQueries({ queryKey: keys.spiele })
    if (id) void qc.invalidateQueries({ queryKey: ['sva_ticker', id] })
    void qc.invalidateQueries({ queryKey: ['sva_lineup_spiel'] })
  }
  const starten = useMutation({
    mutationFn: (o: StartOptionen) =>
      rpc<DemoAntwort>('sva_demo_starten', { p_gegner: o.gegner.trim() || VORSCHLAG_GEGNER, p_beispiele: o.beispiele, p_anpfiff: o.anpfiff }),
    onSuccess: (d) => auffrischen(d.id),
  })
  const beenden = useMutation({
    mutationFn: () => rpc<DemoAntwort>('sva_demo_beenden'),
    onSuccess: (d) => auffrischen(d.id),
  })
  const loeschen = useMutation({
    mutationFn: () => rpc<{ geloescht: number }>('sva_demo_loeschen'),
    onSuccess: () => auffrischen(),
  })
  return { starten, beenden, loeschen }
}
