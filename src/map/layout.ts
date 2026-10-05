// v16-K: Panel-Geometrie — EINE Quelle für CSS-Maße (map.css) und den
// Kamera-Ausschnitt (CameraRig): der Ort sitzt mittig im freien Bereich.

/** Bottom-Sheet statt Seiten-Drawer: Telefone und Hochformat. */
export function isSheet(W: number, H: number): boolean {
  return W < 760 || W / H < 1
}
/** Höhe des Bottom-Sheets als Anteil der Fensterhöhe (CSS: 64svh). */
export const SHEET_FRAC = 0.64
/** Breite des Drawers (CSS: clamp(360px, 34vw, 460px)) + 12px Rand. */
export function drawerWidth(W: number): number {
  return Math.min(460, Math.max(360, W * 0.34))
}

export function mapPanelRect(W: number, H: number, open: boolean) {
  if (!open) return { x: 0, y: 0, w: W, h: H }
  if (isSheet(W, H)) return { x: 0, y: 0, w: W, h: Math.max(160, H * (1 - SHEET_FRAC)) }
  return { x: 0, y: 0, w: Math.max(240, W - drawerWidth(W) - 24), h: H }
}
