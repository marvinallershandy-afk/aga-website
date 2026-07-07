import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { AudioManager } from '../audio/AudioManager'

// ─────────────────────────────────────────────────────────────
// Fangesang-Toggle (v9-E2). Bewusst DEFAULT AUS — der Nutzer holt
// sich die Kurve dazu. Schaltet die prozedurale Fangesang-Ambience
// (AudioManager.setFanChant). Ist der Ton global aus, merkt sich der
// Manager den Wunsch und zieht ihn nach, sobald der Ton an ist.
// ─────────────────────────────────────────────────────────────

export function FanChantToggle() {
  const on = useStore((s) => s.fanChantOn)
  const soundOn = useStore((s) => s.soundOn)
  const setFanChant = useStore((s) => s.setFanChant)

  const toggle = () => {
    const next = !on
    setFanChant(next)
    AudioManager.setFanChant(next)
  }

  return (
    <motion.div
      className="fanchant"
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.5 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <button
        type="button"
        className={`fanchant__btn${on ? ' is-on' : ''}`}
        onClick={toggle}
        aria-pressed={on}
      >
        <span className="fanchant__dot" aria-hidden="true" />
        {on ? 'Fangesang läuft' : 'Fangesang an'}
      </button>
      <span className="fanchant__hint">
        {on && !soundOn
          ? 'Ton ist aus — oben rechts einschalten, dann grölt die Kurve.'
          : 'Leise Südkurve, dezent im Hintergrund. Jederzeit wieder aus.'}
      </span>
    </motion.div>
  )
}
