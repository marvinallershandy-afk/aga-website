// Scroll-Anker der Kamera-Stationen — bewusst OHNE three-Import,
// damit der Fallback-Pfad (useScrollProgress) three nie lädt.

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Defaults nur als Fallback; zur Laufzeit aus DOM-Positionen gemessen.
// v14-D: 9 Anker. Die Mannschaft hat ZWEI — Anfang und Ende ihrer
// Flyover-Strecke (Sektion hält den Bildschirm, Kamera fliegt über die
// Elf). Reihenfolge: hero, anstoss(synth), mannschaft-start,
// mannschaft-ende, fanblock, musik, tabelle, sponsoren, kontakt.
const ANCHORS = [0.09, 0.15, 0.2, 0.32, 0.42, 0.55, 0.68, 0.84, 1.0]

export function setAnchors(values: number[]) {
  if (values.length !== ANCHORS.length) return
  for (let i = 0; i < values.length; i++) ANCHORS[i] = values[i]
}

/**
 * Scroll-Fortschritt → Fahrt-Parameter g ∈ [0, 8] in „Stations-Einheiten":
 *   g 0…2  Hero → Anstoß → Mannschaft (Ankunft)
 *   g 2…3  Mannschafts-Flyover (Station hält, die Kamera fliegt über die Elf)
 *   g 3…8  Mannschaft → Fanblock → … → Kontakt
 * Die Stationen außerhalb der Mannschaft liegen damit exakt dort, wo sie
 * vorher lagen (u = (g − 1) / 7 für g ≥ 3).
 */
export function scrollToG(p: number): number {
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

/** g → klassischer Kurven-Parameter u ∈ [0,1] (8 Stationen, 1/7 je Station).
 *  Während des Flyovers bleibt u auf der Mannschafts-Station (2/7). */
export function gToU(g: number): number {
  if (g <= 2) return g / 7
  if (g < 3) return 2 / 7
  return Math.min(1, (g - 1) / 7)
}

/** g → Flyover-Fortschritt s ∈ [0,1]. */
export function gToTeam(g: number): number {
  return Math.min(1, Math.max(0, g - 2))
}

/** Kompatibilität: Scroll-Fortschritt → u. */
export function scrollToU(p: number): number {
  return gToU(scrollToG(p))
}
