import { detectCinemaTier } from '../utils/device'

// v14-A: Qualitätsstufe für die gebackene Welt (Wald, Boden, Gras-Fuzz).
// Bewusst SYNCHRON beim ersten Render ermittelt (nicht über den Store,
// den Stage erst im Effect setzt) — sonst würde ein Handy erst den
// vollen Wald + 2048er-Boden backen und danach die günstige Variante.
let cached: 'full' | 'reduced' | null = null

export function getWorldTier(): 'full' | 'reduced' {
  if (cached) return cached
  try {
    cached = detectCinemaTier()
  } catch {
    cached = 'reduced'
  }
  return cached
}
