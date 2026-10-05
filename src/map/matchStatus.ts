import { useEffect, useState } from 'react'
import { NEXT_MATCH, nextKickoff } from '../data/content'
import { imSpieltagsfenster } from '../live/model'
import { getLiveSignal, onLiveSignal, type LiveSignal } from '../live/liveSignal'

// ─────────────────────────────────────────────────────────────
// v16-K: Zustand des Spieltag-Markers. Liest NUR Build-Daten (nächstes
// Spiel) und das Live-Signal der Spieltag-Leiste (MatchdayBar pollt im
// Spieltagsfenster) — die Karte selbst macht keinen Request.
// ─────────────────────────────────────────────────────────────

export interface MatchStatus {
  /** Kurzzeile unter dem Marker. */
  line: string
  /** 'live' = rot pulsierend, 'today' = Heute-Badge, sonst ruhig. */
  state: 'live' | 'today' | 'soon' | 'none'
  /** Ausführlich fürs Panel/aria. */
  long: string
}

const TZ = 'Europe/Berlin'

function fmtTime(d: Date) {
  return d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}
function fmtDay(d: Date) {
  return d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TZ })
}
function sameDay(a: Date, b: Date) {
  const f = (d: Date) => d.toLocaleDateString('de-DE', { timeZone: TZ })
  return f(a) === f(b)
}

export function matchStatus(now: number, live: LiveSignal | null): MatchStatus {
  const k = nextKickoff()
  const vs = `${NEXT_MATCH.home ? 'vs' : 'bei'} ${NEXT_MATCH.opponent}`
  if (live && (live.status === 'live' || live.status === 'halbzeit')) {
    const stand = `${live.goalsFor}:${live.goalsAgainst}`
    const line = live.status === 'live' ? `LIVE ${stand}${live.minuteLabel ? ` · ${live.minuteLabel}` : ''}` : `Halbzeit ${stand}`
    // v18-T: Gegner aus dem Live-Signal (gleich NEXT_MATCH; bei der Vorführung das Vorführ-Spiel)
    return { line, state: 'live', long: `${line} ${live.home ? 'vs' : 'bei'} ${live.opponent}` }
  }
  if (!k || NEXT_MATCH.isPlaceholder) {
    return { line: 'Tabelle & Ticker', state: 'none', long: 'Tabelle, Form und Live-Ticker' }
  }
  const t = k.getTime()
  if (t < now - 3 * 3600_000) {
    return { line: 'Tabelle & Ticker', state: 'none', long: 'Tabelle, Form und Live-Ticker' }
  }
  if (live && live.status === 'beendet') {
    const line = `Endstand ${live.goalsFor}:${live.goalsAgainst}`
    return { line, state: 'today', long: `${line} ${vs}` }
  }
  if (sameDay(k, new Date(now))) {
    const line = `Heute ${fmtTime(k)}`
    return { line, state: 'today', long: `${line} Uhr ${vs}` }
  }
  const line = `${fmtDay(k)} · ${fmtTime(k)}`
  return {
    line,
    state: imSpieltagsfenster(t, now) ? 'today' : 'soon',
    long: `Nächstes Spiel: ${line} Uhr ${vs}`,
  }
}

export function useMatchStatus(): MatchStatus {
  const [live, setLive] = useState<LiveSignal | null>(() => getLiveSignal())
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => onLiveSignal(setLive), [])
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  return matchStatus(now, live)
}
