import { AnimatePresence, motion } from 'framer-motion'
import { Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { kuerzel } from './model'

// ─────────────────────────────────────────────────────────────
// v20-T: Ergebnis-Stepper. Zwei große Zahlen (Anton), runde ±-Knöpfe in
// Daumenreichweite; die Zahl rollt beim Ändern nach oben/unten.
// ─────────────────────────────────────────────────────────────

function Zahl({ wert, label, onChange }: { wert: number; label: string; onChange: (n: number) => void }) {
  const [richtung, setRichtung] = useState(1)
  const setzen = (n: number) => {
    const v = Math.max(0, Math.min(20, n))
    if (v === wert) return
    setRichtung(v > wert ? 1 : -1)
    onChange(v)
    try {
      navigator.vibrate?.(8)
    } catch {
      /* egal */
    }
  }
  return (
    <div className="tp-stepper__spalte">
      <span className="tp-stepper__label">{label}</span>
      <button type="button" className="tp-rund" onClick={() => setzen(wert + 1)} aria-label={`${label}: ein Tor mehr`}>
        <Plus size={22} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="tp-stepper__zahl" aria-live="polite" aria-label={`${label}: ${wert} Tore`}>
        <AnimatePresence initial={false} custom={richtung} mode="popLayout">
          <motion.b
            key={wert}
            custom={richtung}
            variants={{
              rein: (r: number) => ({ y: r > 0 ? '60%' : '-60%', opacity: 0 }),
              da: { y: '0%', opacity: 1 },
              raus: (r: number) => ({ y: r > 0 ? '-60%' : '60%', opacity: 0 }),
            }}
            initial="rein"
            animate="da"
            exit="raus"
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          >
            {wert}
          </motion.b>
        </AnimatePresence>
      </div>
      <button type="button" className="tp-rund" onClick={() => setzen(wert - 1)} disabled={wert === 0} aria-label={`${label}: ein Tor weniger`}>
        <Minus size={22} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}

export function ErgebnisStepper({
  heim,
  gegner,
  toreSva,
  toreGegner,
  onChange,
}: {
  heim: boolean
  gegner: string
  toreSva: number
  toreGegner: number
  onChange: (sva: number, geg: number) => void
}) {
  const sva = <Zahl key="sva" wert={toreSva} label="SVA" onChange={(n) => onChange(n, toreGegner)} />
  const geg = <Zahl key="geg" wert={toreGegner} label={kuerzel(gegner)} onChange={(n) => onChange(toreSva, n)} />
  return (
    <div className="tp-stepper" role="group" aria-label="Dein Ergebnis-Tipp">
      {heim ? sva : geg}
      <span className="tp-stepper__dp" aria-hidden="true">
        :
      </span>
      {heim ? geg : sva}
    </div>
  )
}
