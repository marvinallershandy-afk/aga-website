import { useEffect, useRef, useState } from 'react'
import { ruhigeBewegung } from '../karten/medien'

// v20-K: Zähler mit befriedigender Mikroanimation — steigt die Zahl, rollt
// sie hoch (Ziffer gleitet von unten nach), kurz aufgehellt. Nur transform.
export function Zaehler({ wert, className }: { wert: number; className?: string }) {
  const [alt, setAlt] = useState(wert)
  const [roll, setRoll] = useState(0)
  const vorher = useRef(wert)
  useEffect(() => {
    if (wert === vorher.current) return
    const hoch = wert > vorher.current
    const a = vorher.current
    vorher.current = wert
    if (!hoch || ruhigeBewegung()) {
      setAlt(wert)
      return
    }
    setAlt(a)
    setRoll((r) => r + 1)
    const t = window.setTimeout(() => setAlt(wert), 520)
    return () => window.clearTimeout(t)
  }, [wert])
  const rollt = alt !== wert
  return (
    <span className={`zr${rollt ? ' is-roll' : ''}${className ? ` ${className}` : ''}`} key={roll} aria-label={String(wert)}>
      <span className="zr__alt" aria-hidden="true">
        {alt}
      </span>
      {rollt && (
        <span className="zr__neu" aria-hidden="true">
          {wert}
        </span>
      )}
    </span>
  )
}

/** Balken mit Glanz, wenn er wächst; Meilenstein-Kerben (Prozent). */
export function Balken({ prozent, kerben, className }: { prozent: number; kerben?: number[]; className?: string }) {
  const [glanz, setGlanz] = useState(0)
  const vorher = useRef(prozent)
  useEffect(() => {
    if (prozent > vorher.current && !ruhigeBewegung()) setGlanz((g) => g + 1)
    vorher.current = prozent
  }, [prozent])
  return (
    <div className={`bk${className ? ` ${className}` : ''}`} role="presentation">
      <i className="bk__fuell" style={{ transform: `scaleX(${Math.max(0, Math.min(1, prozent / 100))})` }} />
      {glanz > 0 && <i className="bk__glanz" key={glanz} />}
      {kerben?.map((k) => (
        <b key={k} className={`bk__kerbe${prozent >= k ? ' is-da' : ''}`} style={{ left: `${k}%` }} />
      ))}
    </div>
  )
}
