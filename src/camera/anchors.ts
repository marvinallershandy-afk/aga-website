// Scroll-Anker der Rundgang-Halte — bewusst OHNE three-Import,
// damit der Fallback-Pfad (useScrollProgress) three nie lädt.
// v18-R: ein Anker je Halt aus tourPlan.STOP_IDS (statt 9 fester Anker).

import { STOP_COUNT } from './tourPlan'

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Defaults nur als Fallback (gleichmäßig); zur Laufzeit aus dem DOM gemessen.
const ANCHORS: number[] = Array.from({ length: STOP_COUNT }, (_, i) => i / (STOP_COUNT - 1))

export function setAnchors(values: number[]) {
  if (values.length !== ANCHORS.length) return
  for (let i = 0; i < values.length; i++) ANCHORS[i] = values[i]
}

/** Scroll-Fortschritt 0…1 → Halt-Parameter s ∈ [0, STOP_COUNT−1]
 *  (ganzzahlig = genau an einem Halt, dazwischen linear im Scroll). */
export function scrollToStop(p: number): number {
  const n = ANCHORS.length
  const c = clamp01(p)
  if (c <= ANCHORS[0]) return 0
  for (let i = 1; i < n; i++) {
    if (c <= ANCHORS[i]) {
      const span = ANCHORS[i] - ANCHORS[i - 1]
      const seg = span > 1e-6 ? (c - ANCHORS[i - 1]) / span : 1
      return i - 1 + seg
    }
  }
  return n - 1
}
