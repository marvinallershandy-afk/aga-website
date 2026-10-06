import { useEffect, useRef, useState } from 'react'
import './tor.css'

// ─────────────────────────────────────────────────────────────
// v22-T: Live-Leiste — während das Spiel läuft IMMER sichtbar (auch beim
// Scrollen und in anderen Bereichen): Minute, Spielstand, optional deine
// Live-Punkte. Neue Zahl springt kurz auf. Gemeinsam für /tippen und /live.
// ─────────────────────────────────────────────────────────────

export interface LiveLeisteDaten {
  status: 'live' | 'halbzeit' | 'beendet'
  minute?: string
  heim: string
  gast: string
  toreHeim: number
  toreGast: number
  /** /tippen: deine Live-Punkte (Hochrechnung) */
  punkte?: number
  /** kurzer Zusatz rechts (z. B. letztes Ereignis auf /live) */
  extra?: string
}

function useNeu(wert: number): boolean {
  const alt = useRef(wert)
  const [neu, setNeu] = useState(false)
  useEffect(() => {
    if (wert === alt.current) return
    const hoch = wert > alt.current
    alt.current = wert
    if (!hoch) return
    const t0 = window.setTimeout(() => setNeu(true), 0)
    const t = window.setTimeout(() => setNeu(false), 900)
    return () => {
      window.clearTimeout(t0)
      window.clearTimeout(t)
    }
  }, [wert])
  return neu
}

export function LiveLeiste({
  daten,
  sichtbar = true,
  unten,
  onTippen,
  label = 'Zum Live-Spiel',
}: {
  daten: LiveLeisteDaten
  sichtbar?: boolean
  /** Abstand zum unteren Rand (CSS), z. B. über einer Tab-Leiste */
  unten?: string
  onTippen?: () => void
  label?: string
}) {
  const nh = useNeu(daten.toreHeim)
  const ng = useNeu(daten.toreGast)
  const np = useNeu(daten.punkte ?? 0)
  const statusText = daten.status === 'halbzeit' ? 'Halbzeit' : daten.status === 'beendet' ? 'Abpfiff' : 'Live'
  return (
    <button
      type="button"
      className="ll"
      data-aus={!sichtbar}
      data-status={daten.status}
      style={unten ? ({ ['--ll-unten' as string]: unten } as React.CSSProperties) : undefined}
      onClick={onTippen}
      aria-label={`${label}: ${statusText} ${daten.minute ?? ''}, ${daten.heim} ${daten.toreHeim} zu ${daten.toreGast} ${daten.gast}${daten.punkte != null ? `, deine Punkte ${daten.punkte}` : ''}`}
      tabIndex={sichtbar ? 0 : -1}
    >
      <span className="ll__live">
        <i aria-hidden="true" />
        {statusText}
      </span>
      {daten.status === 'live' && daten.minute && <span className="ll__min">{daten.minute}</span>}
      <span className="ll__spiel" aria-hidden="true">
        <span className="ll__team">{daten.heim}</span>
        <span className="ll__tore">
          <b className={nh ? 'is-neu' : ''}>{daten.toreHeim}</b>
          <i>:</i>
          <b className={ng ? 'is-neu' : ''}>{daten.toreGast}</b>
        </span>
        <span className="ll__team">{daten.gast}</span>
      </span>
      {daten.punkte != null ? (
        <span className={`ll__pkt${np ? ' is-hoch' : ''}`} aria-hidden="true">
          <b>{daten.punkte}</b>
          <small>Deine Punkte</small>
        </span>
      ) : (
        daten.extra && (
          <span className="ll__extra" aria-hidden="true">
            {daten.extra}
          </span>
        )
      )}
    </button>
  )
}
