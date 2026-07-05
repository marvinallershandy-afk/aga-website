// Scroll-Anker der Kamera-Stationen — bewusst OHNE three-Import,
// damit der Fallback-Pfad (useScrollProgress) three nie lädt.

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

// Defaults nur als Fallback; zur Laufzeit aus DOM-Zentren gemessen.
const ANCHORS = [0.12, 0.3, 0.5, 0.83, 1.0]

export function setAnchors(values: number[]) {
  if (values.length !== ANCHORS.length) return
  for (let i = 0; i < values.length; i++) ANCHORS[i] = values[i]
}

/** Bildet den Scroll-Fortschritt auf den Kurven-Parameter u∈[0,1] ab. */
export function scrollToU(p: number): number {
  const n = ANCHORS.length
  const c = clamp01(p)
  if (c <= ANCHORS[0]) return 0
  for (let i = 1; i < n; i++) {
    if (c <= ANCHORS[i]) {
      const seg = (c - ANCHORS[i - 1]) / (ANCHORS[i] - ANCHORS[i - 1])
      return (i - 1 + seg) / (n - 1)
    }
  }
  return 1
}
