import * as THREE from 'three'

// Warmes Tür-Glow-Gradient (v5 Jury-Loop 1): statt flacher HDR-
// Fläche (clippte zu einer weißen Platte) ein Lichtverlauf wie aus
// einem warm beleuchteten Raum — hell oben-mittig, tiefes Bernstein
// an den Rändern. Der HDR-Anteil kommt über den Material-Farbboost
// (color > 1) NUR dort, wo die Textur hell ist → Bloom greift weich.
let tex: THREE.CanvasTexture | null = null

export function getDoorGlowTexture(): THREE.CanvasTexture {
  if (tex) return tex
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 96
  const ctx = cv.getContext('2d')!
  // Grundton: tiefes warmes Amber
  ctx.fillStyle = '#7a3c14'
  ctx.fillRect(0, 0, 64, 96)
  // Lichtkern oben-mittig (Deckenlampe im Raum dahinter)
  const g = ctx.createRadialGradient(32, 26, 4, 32, 30, 70)
  g.addColorStop(0, '#ffe2b0')
  g.addColorStop(0.35, '#ffb265')
  g.addColorStop(0.75, 'rgba(190,90,30,0.5)')
  g.addColorStop(1, 'rgba(120,60,20,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 64, 96)
  // sanfter Boden-Schein (Reflexion)
  const g2 = ctx.createLinearGradient(0, 60, 0, 96)
  g2.addColorStop(0, 'rgba(255,170,90,0)')
  g2.addColorStop(1, 'rgba(255,170,90,0.35)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, 64, 96)
  tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}
