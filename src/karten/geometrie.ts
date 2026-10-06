// ─────────────────────────────────────────────────────────────
// v20-K: Kartengeometrie — EINE Quelle für DOM (SvaKarte, cqw-Einheiten)
// und Canvas (zeichnen.ts, Pixel). Einheit u = Kartenbreite / 100,
// Karte = 100 × 140 u.
//
// Form: Wappen-Schild — oben angeschrägte Ecken (wie das Vereinswappen),
// unten eine flache Spitze. Die Form trägt den Verein, ohne Deko.
// ─────────────────────────────────────────────────────────────

export const KARTE_B = 100
export const KARTE_H = 140
export const KARTE_RATIO = KARTE_H / KARTE_B

export type Punkt = readonly [number, number]

/** Außenkontur (im Uhrzeigersinn). */
export const UMRISS: Punkt[] = [
  [6, 0],
  [94, 0],
  [100, 6],
  [100, 131],
  [50, 140],
  [0, 131],
  [0, 6],
]

/** Konvexes Polygon um d nach innen versetzen (Kanten parallel verschieben,
 *  Nachbarkanten schneiden). Für Rahmenlinien und Foto-Fenster. */
export function einruecken(poly: readonly Punkt[], d: number): Punkt[] {
  const n = poly.length
  const linien = poly.map((p, i) => {
    const q = poly[(i + 1) % n]
    const dx = q[0] - p[0]
    const dy = q[1] - p[1]
    const len = Math.hypot(dx, dy) || 1
    // Innen = rechts der Laufrichtung (Uhrzeigersinn, y nach unten)
    const nx = -dy / len
    const ny = dx / len
    return { p: [p[0] + nx * d, p[1] + ny * d] as Punkt, v: [dx, dy] as Punkt }
  })
  return linien.map((l, i) => {
    const a = linien[(i - 1 + n) % n]
    const b = l
    const det = a.v[0] * b.v[1] - a.v[1] * b.v[0]
    if (Math.abs(det) < 1e-9) return b.p
    const t = ((b.p[0] - a.p[0]) * b.v[1] - (b.p[1] - a.p[1]) * b.v[0]) / det
    return [a.p[0] + a.v[0] * t, a.p[1] + a.v[1] * t] as Punkt
  })
}

export const RAHMEN_INNEN = 3.4
export const INNEN: Punkt[] = einruecken(UMRISS, RAHMEN_INNEN)
export const FENSTER: Punkt[] = einruecken(UMRISS, RAHMEN_INNEN + 0.9)

const r = (n: number) => Math.round(n * 100) / 100
/** CSS clip-path: polygon(…) in Prozent der Box. */
export function clipPolygon(poly: readonly Punkt[]): string {
  return `polygon(${poly.map(([x, y]) => `${r(x)}% ${r((y / KARTE_H) * 100)}%`).join(', ')})`
}
export const CLIP_UMRISS = clipPolygon(UMRISS)
/** SVG-Punktliste (viewBox 0 0 100 140). */
export function svgPunkte(poly: readonly Punkt[]): string {
  return poly.map(([x, y]) => `${r(x)},${r(y)}`).join(' ')
}
/** Canvas-Pfad (skaliert auf W). */
export function canvasPfad(ctx: CanvasRenderingContext2D, poly: readonly Punkt[], x: number, y: number, W: number) {
  const u = W / KARTE_B
  ctx.beginPath()
  poly.forEach(([px, py], i) => (i ? ctx.lineTo(x + px * u, y + py * u) : ctx.moveTo(x + px * u, y + py * u)))
  ctx.closePath()
}

/** Lage der Elemente (u). Gespiegelt in karten.css. */
export const LAYOUT = {
  /** Freisteller: Breite, Scheitel (darf über die Rahmenlinie ragen) */
  figurBreite: 112,
  figurKopf: 1.6,
  figurKopfStab: 5,
  /** Spieler leicht rechts der Mitte (links steht die Nummer) */
  figurVersatz: 6,
  /** Auslauf des Freistellers in die Namensplatte (Anteil der Kartenhöhe) */
  figurAusVon: 0.6,
  figurAusBis: 0.75,
  /** linke Spalte: Nummer / Position / Wappen */
  spalteX: 15.5,
  nummerY: 25,
  nummerGroesse: 19,
  /** Namensplatte */
  vornameY: 104.5,
  nachnameY: 119,
  nachnameMax: 15,
  linieY: 123.2,
  infoY: 128.6,
  /** Foto-Fenster der Moment-/Kurve-Karten endet hier (dann Titel) */
  fotoBis: 100,
} as const

/** Schriftgröße (u) des Nachnamens: so groß wie möglich, einzeilig.
 *  Anton ≈ 0.46 em je Zeichen. */
export function nachnameGroesse(text: string, max: number = LAYOUT.nachnameMax, raum = 82): number {
  return Math.min(max, raum / Math.max(1, text.length * 0.47))
}

/** Freisteller-Konvention (macOS-Vision / Greenscreen card.webp):
 *  Scheitel bei ≈ 18,5 % der Bildhöhe, Bild 2 : 3. */
export const FIGUR_KONVENTION = { kopf: 0.185, ratio: 1.5 } as const
