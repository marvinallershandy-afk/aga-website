import { useEffect, useRef, useState } from 'react'
import { PartyPopper, Users } from 'lucide-react'
import type { Barometer as BarometerDaten } from './api'
import { ruhigeBewegung } from '../karten/medien'
import './barometer.css'

// v26-B: Fan-Barometer — Gemeinschaftsziel je Heimspiel. Füllt animiert, bei
// Erreichen dezentes Konfetti + „Pack wartet im Album". Nur Aggregate, keine PII.
export function Barometer({ b, kompakt = false }: { b?: BarometerDaten | null; kompakt?: boolean }) {
  const [sichtbar, setSichtbar] = useState(false)
  const gefeiert = useRef(false)
  useEffect(() => {
    const t = setTimeout(() => setSichtbar(true), 60)
    return () => clearTimeout(t)
  }, [])
  const [konfetti, setKonfetti] = useState(false)
  useEffect(() => {
    if (b?.erreicht && !gefeiert.current && !ruhigeBewegung()) {
      gefeiert.current = true
      setKonfetti(true)
      const t = setTimeout(() => setKonfetti(false), 2600)
      return () => clearTimeout(t)
    }
  }, [b?.erreicht])
  if (!b) return null

  const stand = b.stand ?? null
  const anteil = stand != null ? Math.min(1, stand / Math.max(1, b.ziel)) : 0
  const rest = stand != null ? Math.max(0, b.ziel - stand) : null

  return (
    <div className={`bm${b.erreicht ? ' is-voll' : ''}${kompakt ? ' bm--kompakt' : ''}`} role="status" aria-live="polite">
      <div className="bm__kopf">
        <span className="bm__label">
          <Users size={15} strokeWidth={1.6} aria-hidden="true" /> Fan-Barometer
        </span>
        {stand != null && (
          <b className="bm__zahl">
            {stand} <small>/ {b.ziel}</small>
          </b>
        )}
      </div>
      <div className="bm__balken" aria-hidden="true">
        <i style={{ transform: `scaleX(${sichtbar ? anteil : 0})` }} />
        {b.erreicht && <span className="bm__voll-glanz" />}
      </div>
      <p className="bm__text">
        {b.erreicht ? (
          <>
            <PartyPopper size={14} strokeWidth={1.6} aria-hidden="true" /> Geschafft — das Event-Pack wartet im Album!
          </>
        ) : stand == null ? (
          <>{b.text ?? 'Es geht los …'} — zusammen schalten wir das Event-Pack für alle frei.</>
        ) : (
          <>
            Noch <b>{rest}</b> {rest === 1 ? 'Check-in' : 'Check-ins'} bis zum Event-Pack für alle.
          </>
        )}
      </p>
      {konfetti && (
        <div className="bm__konfetti" aria-hidden="true">
          {Array.from({ length: 14 }).map((_, i) => (
            <i key={i} style={{ ['--k' as string]: i }} />
          ))}
        </div>
      )}
    </div>
  )
}
