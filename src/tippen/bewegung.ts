// ─────────────────────────────────────────────────────────────
// v21-T: EIN Bewegungssystem für /tippen (aus docs/DESIGN.md „Bewegung“):
// --ease = cubic-bezier(.22, 1, .36, 1) (ease-out, kein Nachfedern),
// --d-1 200 ms (Farbe/Druck) · --d-2 300 ms (Ein-/Ausblenden) ·
// --d-3 400 ms (Bereiche, Karten). Federn nur kritisch gedämpft (kein
// Überschwingen). prefers-reduced-motion: MotionConfig reducedMotion="user".
// ─────────────────────────────────────────────────────────────
import type { Transition } from 'framer-motion'

export const EASE = [0.22, 1, 0.36, 1] as const
export const D1 = 0.2
export const D2 = 0.3
export const D3 = 0.4

export const T_KURZ: Transition = { duration: D1, ease: EASE }
export const T_MITTEL: Transition = { duration: D2, ease: EASE }
export const T_LANG: Transition = { duration: D3, ease: EASE }
/** gedämpfte Feder für Positionswechsel (Ranglisten, Marken) — ohne Überschwingen */
export const FEDER: Transition = { type: 'spring', stiffness: 380, damping: 40, mass: 1 }

/** Bereichswechsel: gerichtet (rechts = weiter in der Leiste). */
export const bereichVarianten = {
  rein: (r: number) => ({ opacity: 0, x: r * 28 }),
  da: { opacity: 1, x: 0 },
}
