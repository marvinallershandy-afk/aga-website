// ─────────────────────────────────────────────────────────────
// v15-L: Liveticker im Admin — Datenzugriff + Offline-Warteschlange.
//
// Am Spielfeldrand ist das Netz schlecht. Deshalb geht JEDE Ticker-Änderung
// (neues Ereignis, Rückgängig, Uhr stellen) zuerst in eine Warteschlange im
// localStorage und wird von dort der Reihe nach gesendet:
//   · optimistisch: die UI zeigt das Ereignis sofort (Status „ausstehend")
//   · Netzfehler → erneuter Versuch mit wachsender Pause (2 s … 30 s) und
//     sofort, wenn der Browser wieder „online" meldet
//   · die Ereignis-ID entsteht auf dem Gerät → doppeltes Senden ist harmlos
//     (Primärschlüssel; 23505 zählt als „schon da")
//   · der Zeitpunkt ist der Moment des Tippens, nicht des Nachsendens →
//     Anpfiffzeit und Minute stimmen auch nach einem Funkloch
//   · Rechte-/Prüffehler (z. B. abgemeldet) bleiben als „Fehler" stehen und
//     lassen sich erneut senden oder verwerfen
// Spielstand, Status und Endergebnis rechnet die Datenbank (Trigger) aus den
// Ereignissen; die UI rechnet bis zur Bestätigung mit derselben Regel
// (src/live/model.ts).
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import type { Tables, TablesInsert } from './database.types'
import type { TickerTyp } from '../../live/model'

export type TickerRow = Tables<'sva_ticker'>
export type TickerInsert = TablesInsert<'sva_ticker'> & { id: string; spiel_id: string; typ: TickerTyp; zeitpunkt: string }

export async function fetchTicker(spielId: string): Promise<TickerRow[]> {
  const { data, error } = await supabase
    .from('sva_ticker')
    .select('*')
    .eq('spiel_id', spielId)
    .order('zeitpunkt', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

/** Aufstellung zu einem Spiel (jüngste mit spiel_id), sonst die aktuelle. */
export async function fetchLineupFuerSpiel(spielId: string | null) {
  if (spielId) {
    const { data, error } = await supabase
      .from('sva_lineup')
      .select('*')
      .eq('spiel_id', spielId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    if (data) return { lineup: data, fuerSpiel: true }
  }
  const { data, error } = await supabase.from('sva_lineup').select('*').order('created_at', { ascending: false }).limit(1).maybeSingle()
  if (error) throw error
  return { lineup: data, fuerSpiel: false }
}

export async function setMotm(spielId: string, rosterId: string | null) {
  const { error } = await supabase
    .from('sm_spiele')
    .update({ motm_roster_id: rosterId, updated_at: new Date().toISOString() })
    .eq('id', spielId)
  if (error) throw error
}

// ── Warteschlange ───────────────────────────────────────────────────────────
export type TickerOp =
  | { kind: 'insert'; row: TickerInsert }
  | { kind: 'delete'; id: string; spielId: string }
  | { kind: 'update'; id: string; spielId: string; patch: Partial<Pick<TickerRow, 'zeitpunkt' | 'minute' | 'nachspielzeit' | 'text'>> }

export interface QueueItem {
  opId: string
  op: TickerOp
  versuche: number
  /** Fehlertext, wenn der Server dauerhaft abgelehnt hat */
  fehler?: string
  erstellt: number
}

export interface QueueState {
  items: QueueItem[]
  sendet: boolean
  /** nächster automatischer Versuch (ms seit Epoch) */
  naechsterVersuch: number | null
  online: boolean
}

const KEY = 'sva_live_queue_v1'

function laden(): QueueItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const v = raw ? (JSON.parse(raw) as QueueItem[]) : []
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}
export const neueId = uuid

/** Netz- oder vorübergehender Serverfehler? (→ erneut versuchen) */
function istVoruebergehend(err: { code?: string; message?: string; status?: number } | null): boolean {
  if (!err) return false
  const code = err.code ?? ''
  const msg = err.message ?? ''
  if (!code || /failed to fetch|networkerror|load failed|network request failed|fetch/i.test(msg)) return true
  if (code === 'PGRST301' || /jwt expired/i.test(msg)) return true // Token wird von supabase-js erneuert
  if (/^(08|53|57)/.test(code)) return true // Verbindung / Ressourcen / Admin-Shutdown
  return false
}

function lesbar(err: { code?: string; message?: string }): string {
  const msg = err.message ?? ''
  if (err.code === '42501' || /row-level security|permission denied/i.test(msg)) return 'Keine Berechtigung — bitte neu anmelden.'
  if (/sva_team_nur_live_felder/.test(msg)) return 'Team-Zugang darf das nicht ändern.'
  if (err.code === '23503') return 'Spiel oder Spieler gibt es nicht mehr.'
  if (err.code === '23514') return 'Ungültige Angabe (Minute/Text zu lang?).'
  if (err.code === '42P01' || err.code === 'PGRST205') return 'Ticker ist in der Datenbank noch nicht eingerichtet (Migration fehlt).'
  return msg || 'Unbekannter Fehler'
}

class LiveQueue {
  private state: QueueState = {
    items: laden(),
    sendet: false,
    naechsterVersuch: null,
    online: typeof navigator === 'undefined' ? true : navigator.onLine,
  }
  private listeners = new Set<() => void>()
  private timer: number | null = null
  private backoff = 2000
  private gestartet = false
  /** Wird nach jeder erfolgreichen Operation aufgerufen (Cache auffrischen). */
  onGesendet: ((spielId: string) => void) | null = null

  start() {
    if (this.gestartet || typeof window === 'undefined') return
    this.gestartet = true
    window.addEventListener('online', () => {
      this.set({ online: true })
      this.backoff = 2000
      void this.verarbeiten()
    })
    window.addEventListener('offline', () => this.set({ online: false }))
    window.addEventListener('storage', (e) => {
      if (e.key === KEY) this.set({ items: laden() })
    })
    void this.verarbeiten()
  }

  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
  getSnapshot = () => this.state

  private set(p: Partial<QueueState>) {
    this.state = { ...this.state, ...p }
    if ('items' in p) {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state.items))
      } catch {
        /* Speicher voll/privat: Warteschlange lebt dann nur im Speicher */
      }
    }
    this.listeners.forEach((l) => l())
  }

  einreihen(op: TickerOp) {
    // Rückgängig eines noch nicht gesendeten Ereignisses: einfach aus der
    // Schlange nehmen (nie gesendet → nichts zu löschen).
    if (op.kind === 'delete') {
      const idx = this.state.items.findIndex((i) => i.op.kind === 'insert' && i.op.row.id === op.id)
      if (idx >= 0 && !(this.state.sendet && idx === 0)) {
        const items = this.state.items.filter((i) => !((i.op.kind === 'insert' && i.op.row.id === op.id) || (i.op.kind === 'update' && i.op.id === op.id)))
        this.set({ items })
        return
      }
    }
    // Update auf ein noch wartendes Insert: direkt ins Insert einrechnen.
    if (op.kind === 'update') {
      const idx = this.state.items.findIndex((i) => i.op.kind === 'insert' && i.op.row.id === op.id)
      if (idx >= 0 && !(this.state.sendet && idx === 0)) {
        const items = this.state.items.map((i, k) =>
          k === idx && i.op.kind === 'insert' ? { ...i, op: { kind: 'insert' as const, row: { ...i.op.row, ...op.patch } as TickerInsert } } : i,
        )
        this.set({ items })
        return
      }
    }
    this.set({ items: [...this.state.items, { opId: uuid(), op, versuche: 0, erstellt: Date.now() }] })
    this.backoff = 2000
    void this.verarbeiten()
  }

  /** Fehler-Eintrag erneut senden */
  erneut(opId: string) {
    this.set({ items: this.state.items.map((i) => (i.opId === opId ? { ...i, fehler: undefined, versuche: 0 } : i)) })
    this.jetzt()
  }
  verwerfen(opId: string) {
    this.set({ items: this.state.items.filter((i) => i.opId !== opId) })
  }
  jetzt() {
    this.backoff = 2000
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = null
    void this.verarbeiten()
  }

  private async verarbeiten() {
    if (this.state.sendet) return
    const item = this.state.items.find((i) => !i.fehler)
    if (!item) {
      this.set({ naechsterVersuch: null })
      return
    }
    this.set({ sendet: true, naechsterVersuch: null })
    let res: { error: { code?: string; message?: string } | null }
    try {
      res = await this.senden(item.op)
    } catch (e) {
      res = { error: { code: '', message: e instanceof Error ? e.message : String(e) } }
    }
    const err = res.error
    if (!err || (item.op.kind === 'insert' && err.code === '23505')) {
      this.set({ items: this.state.items.filter((i) => i.opId !== item.opId), sendet: false })
      this.backoff = 2000
      this.onGesendet?.(item.op.kind === 'insert' ? item.op.row.spiel_id : item.op.spielId)
      void this.verarbeiten()
      return
    }
    if (istVoruebergehend(err)) {
      const wann = Date.now() + this.backoff
      this.set({
        items: this.state.items.map((i) => (i.opId === item.opId ? { ...i, versuche: i.versuche + 1 } : i)),
        sendet: false,
        naechsterVersuch: wann,
      })
      this.timer = window.setTimeout(() => {
        this.timer = null
        void this.verarbeiten()
      }, this.backoff)
      this.backoff = Math.min(this.backoff * 2, 30_000)
      return
    }
    this.set({
      items: this.state.items.map((i) => (i.opId === item.opId ? { ...i, fehler: lesbar(err), versuche: i.versuche + 1 } : i)),
      sendet: false,
    })
    void this.verarbeiten()
  }

  private async senden(op: TickerOp): Promise<{ error: { code?: string; message?: string } | null }> {
    if (op.kind === 'insert') {
      const { error } = await supabase.from('sva_ticker').insert(op.row)
      return { error }
    }
    if (op.kind === 'delete') {
      const { error } = await supabase.from('sva_ticker').delete().eq('id', op.id)
      return { error }
    }
    const { error } = await supabase.from('sva_ticker').update(op.patch).eq('id', op.id)
    return { error }
  }
}

export const liveQueue = new LiveQueue()
