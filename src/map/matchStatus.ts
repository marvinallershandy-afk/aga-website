import { useEffect, useState } from 'react'
import { NEXT_MATCH, nextKickoff } from '../data/content'

// v19-K (Audit B §2.1.2): Ist das nächste Spiel ein Heimspiel innerhalb der
// nächsten 72 h (und noch nicht vorbei), liefert dies den Anstoß — sonst null.
// Grundlage für den ruhigen Heimspiel-Hinweis auf der Karten-Totale.
export function heimspielFenster(now: number): Date | null {
  const k = nextKickoff()
  if (!k || NEXT_MATCH.isPlaceholder || !NEXT_MATCH.home) return null
  const t = k.getTime()
  if (t > now + 72 * 3600_000) return null // noch zu früh
  if (t < now - 3 * 3600_000) return null // vorbei
  return k
}
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
// v19-K (Audit B §2.1.1): kompakt für den Marker (Wochentag + Uhrzeit, ohne
// Datum — das volle Datum bleibt in `long`/Panel).
function fmtWd(d: Date) {
  return d.toLocaleDateString('de-DE', { weekday: 'short', timeZone: TZ })
}
// Heim/Auswärts in die Marker-Zeile: Heim „Heimspiel · So. 15:00",
// Auswärts „So. 15:00 · auswärts" — verhindert Fehlfahrten, bewirbt Heimspiele.
function tagHA(core: string): string {
  return NEXT_MATCH.home ? `Heimspiel · ${core}` : `${core} · auswärts`
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
    const core = `Heute ${fmtTime(k)}`
    return { line: tagHA(core), state: 'today', long: `${core} Uhr ${vs}` }
  }
  return {
    line: tagHA(`${fmtWd(k)} ${fmtTime(k)}`),
    state: imSpieltagsfenster(t, now) ? 'today' : 'soon',
    long: `Nächstes Spiel: ${fmtDay(k)} · ${fmtTime(k)} Uhr ${vs}`,
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
