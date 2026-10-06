import { useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { FastForward, Pause, Play, SkipForward } from 'lucide-react'
import { ENDE_MINUTE, PHASEN, naechstesEreignis, phaseSetzen, simAbo, simLesen, simSetzen } from './store'
import { EREIGNIS_MINUTEN } from './sim'
import { haptik } from '../model'

// ─────────────────────────────────────────────────────────────
// v21-T: Steuerleiste der Vorführung — deutlich als „Vorführung“
// markiert. Phasen durchschalten; live: Pause/Weiter, nächstes Ereignis,
// Tempo. Alles nur im Browser.
// ─────────────────────────────────────────────────────────────

export default function Steuerleiste() {
  const z = useSyncExternalStore(simAbo, simLesen)
  const minute = Math.min(90, Math.floor(z.minute))
  const nachspiel = z.minute > 90 ? Math.ceil(z.minute - 90) : 0
  return (
    <section className="tp-steuer" aria-label="Vorführung steuern">
      <div className="tp-steuer__kopf">
        <span className="tp-steuer__marke">
          <i aria-hidden="true" /> Vorführung
        </span>
        <span className="tp-steuer__info">Simulierte Daten · nichts wird gespeichert</span>
      </div>
      <div className="tp-steuer__phasen" role="tablist" aria-label="Phase">
        {PHASEN.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={z.phase === p.id}
            onClick={() => {
              haptik(10)
              phaseSetzen(p.id)
            }}
          >
            {z.phase === p.id && <motion.i className="tp-steuer__mark" layoutId="tp-steuer-mark" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      {z.phase === 'live' && (
        <div className="tp-steuer__live">
          <button type="button" className="tp-steuer__knopf" onClick={() => simSetzen({ laeuft: !z.laeuft })} aria-label={z.laeuft ? 'Anhalten' : 'Weiterlaufen lassen'} disabled={z.minute >= ENDE_MINUTE}>
            {z.laeuft ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <button type="button" className="tp-steuer__knopf tp-steuer__knopf--text" onClick={() => naechstesEreignis(EREIGNIS_MINUTEN)}>
            <SkipForward size={16} strokeWidth={1.75} aria-hidden="true" /> Nächstes Ereignis
          </button>
          <button type="button" className={`tp-steuer__knopf${z.tempo === 3 ? ' is-an' : ''}`} onClick={() => simSetzen({ tempo: z.tempo === 3 ? 1 : 3 })} aria-label="Tempo" aria-pressed={z.tempo === 3}>
            <FastForward size={16} strokeWidth={1.75} aria-hidden="true" />
            <small>{z.tempo}×</small>
          </button>
          <span className="tp-steuer__uhr" aria-live="off">
            {minute}
            {nachspiel ? `+${nachspiel}` : ''}′
          </span>
          <span className="tp-steuer__balken" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.min(1, z.minute / ENDE_MINUTE)})` }} />
          </span>
        </div>
      )}
    </section>
  )
}
