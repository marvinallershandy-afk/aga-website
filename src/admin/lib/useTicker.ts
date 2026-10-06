import { useEffect, useMemo, useSyncExternalStore } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchTicker, liveQueue, type QueueItem, type TickerRow } from './live'
import {
  statusAusEreignissen,
  toreAusEreignissen,
  type LiveStatus,
  type TickerTyp,
} from '../../live/model'
import type { SpielRow } from './db'

// v15-L: Server-Ereignisse + Warteschlange → eine optimistische Sicht.

export type Sync = 'gesendet' | 'ausstehend' | 'fehler'

export interface AdminEvent {
  id: string
  type: TickerTyp
  at: string
  minute: number | null
  extra: number | null
  player: string | null
  player2: string | null
  text: string | null
  sync: Sync
  fehler?: string
  opId?: string
  // v23-L: Herkunft/Status (FuPa-Bot)
  quelle?: string
  gesperrt?: boolean
  versteckt?: boolean
  platzhalter?: boolean
  team?: string | null
  fupaName?: string | null
  fupaName2?: string | null
}

export const tickerKey = (spielId: string | null) => ['sva_ticker', spielId] as const

function ausRow(r: TickerRow, sync: Sync = 'gesendet'): AdminEvent {
  return {
    id: r.id,
    type: r.typ as TickerTyp,
    at: r.zeitpunkt,
    minute: r.minute,
    extra: r.nachspielzeit,
    player: r.roster_id,
    player2: r.roster_id_2,
    text: r.text,
    sync,
    quelle: r.quelle,
    gesperrt: r.gesperrt,
    versteckt: r.versteckt,
    platzhalter: r.platzhalter,
    team: r.team,
    fupaName: r.fupa_name,
    fupaName2: r.fupa_name_2,
  }
}

export function mergeEvents(server: TickerRow[], queue: QueueItem[], spielId: string): AdminEvent[] {
  const map = new Map<string, AdminEvent>(server.map((r) => [r.id, ausRow(r)]))
  for (const q of queue) {
    const op = q.op
    const sync: Sync = q.fehler ? 'fehler' : 'ausstehend'
    if (op.kind === 'insert') {
      if (op.row.spiel_id !== spielId) continue
      if (!map.has(op.row.id)) {
        map.set(op.row.id, { ...ausRow({ created_at: '', created_by: null, minute: null, nachspielzeit: null, roster_id: null, roster_id_2: null, text: null, ...op.row } as TickerRow, sync), fehler: q.fehler, opId: q.opId })
      }
    } else if (op.spielId === spielId) {
      const e = map.get(op.id)
      if (!e) continue
      if (op.kind === 'delete') {
        if (q.fehler) map.set(op.id, { ...e, sync, fehler: `Löschen: ${q.fehler}`, opId: q.opId })
        else map.delete(op.id)
      } else {
        map.set(op.id, {
          ...e,
          at: op.patch.zeitpunkt ?? e.at,
          minute: op.patch.minute !== undefined ? op.patch.minute : e.minute,
          extra: op.patch.nachspielzeit !== undefined ? op.patch.nachspielzeit : e.extra,
          text: op.patch.text !== undefined ? op.patch.text : e.text,
          sync,
          fehler: q.fehler,
          opId: q.opId,
        })
      }
    }
  }
  return [...map.values()].sort((a, b) => +new Date(a.at) - +new Date(b.at) || a.id.localeCompare(b.id))
}

export function useLiveQueue() {
  useEffect(() => liveQueue.start(), [])
  return useSyncExternalStore(liveQueue.subscribe, liveQueue.getSnapshot)
}

export interface SpielLage {
  status: LiveStatus
  anpfiffAt: string | null
  wiederanpfiffAt: string | null
  tore: [number, number]
  /** Spiel wird über den Ticker geführt (es gibt Status-Ereignisse) */
  getickert: boolean
}

export function spielLage(spiel: SpielRow | null, events: AdminEvent[]): SpielLage {
  const st = statusAusEreignissen(events)
  if (st.hatStatus) return { status: st.status, anpfiffAt: st.anpfiffAt, wiederanpfiffAt: st.wiederanpfiffAt, tore: toreAusEreignissen(events), getickert: true }
  const hatErgebnis = spiel?.tore_sva != null && spiel?.tore_gegner != null
  return {
    status: hatErgebnis ? 'beendet' : 'geplant',
    anpfiffAt: null,
    wiederanpfiffAt: null,
    tore: hatErgebnis ? [spiel!.tore_sva!, spiel!.tore_gegner!] : toreAusEreignissen(events),
    getickert: false,
  }
}

export function useTicker(spielId: string | null) {
  const qc = useQueryClient()
  const queue = useLiveQueue()
  const q = useQuery({
    queryKey: tickerKey(spielId),
    queryFn: () => fetchTicker(spielId!),
    enabled: !!spielId,
    retry: false,
    refetchInterval: 20_000,
  })
  useEffect(() => {
    liveQueue.onGesendet = (sid) => {
      void qc.invalidateQueries({ queryKey: tickerKey(sid) })
      void qc.invalidateQueries({ queryKey: ['sm_spiele'] })
    }
    return () => {
      liveQueue.onGesendet = null
    }
  }, [qc])
  const events = useMemo(() => (spielId ? mergeEvents(q.data ?? [], queue.items, spielId) : []), [q.data, queue.items, spielId])
  return { query: q, queue, events }
}
