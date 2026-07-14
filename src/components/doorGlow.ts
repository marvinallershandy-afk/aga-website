import * as THREE from 'three'

// Warmes Tür-Glow-Gradient (v5 Jury-Loop 1): statt flacher HDR-
// Fläche (clippte zu einer weißen Platte) ein Lichtverlauf wie aus
// einem warm beleuchteten Raum — hell oben-mittig, tiefes Bernstein
// an den Rändern. Der HDR-Anteil kommt über den Material-Farbboost
// (color > 1) NUR dort, wo die Textur hell ist → Bloom greift weich.
let tex: THREE.CanvasTexture | null = null

export function getDoorGlowTexture(): THREE.CanvasTexture {
  if (tex) return tex
  // v13-K1: 64×96 wurde beim Tür-Transit bildschirmfüllend → formlose
  // Amber-Wand („Kamera geht durch eine Wand"). Jetzt 256×384 mit
  // INNENRAUM-Struktur: Deckenlampe, Regal-/Tresenlinien, Wimpel-
  // Silhouetten — selbst im Vollbild liest sich der Moment als „Blick
  // in einen warmen Raum". Der HDR-Boost (color>1) bleibt.
  const W = 256
  const H = 384
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  // Grundton: tiefes warmes Amber
  ctx.fillStyle = '#7a3c14'
  ctx.fillRect(0, 0, W, H)
  // Lichtkern oben-mittig (Deckenlampe im Raum dahinter)
  const g = ctx.createRadialGradient(W / 2, H * 0.27, 16, W / 2, H * 0.31, W * 1.1)
  g.addColorStop(0, '#ffe2b0')
  g.addColorStop(0.35, '#ffb265')
  g.addColorStop(0.75, 'rgba(190,90,30,0.5)')
  g.addColorStop(1, 'rgba(120,60,20,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  // Lampen-Silhouette (hängende Schirmlampe) im Lichtkern
  ctx.strokeStyle = 'rgba(60,28,10,0.55)'
  ctx.lineWidth = 3
  ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, H * 0.16); ctx.stroke()
  ctx.fillStyle = 'rgba(60,28,10,0.5)'
  ctx.beginPath()
  ctx.moveTo(W / 2 - 26, H * 0.22); ctx.lineTo(W / 2 + 26, H * 0.22)
  ctx.lineTo(W / 2 + 14, H * 0.16); ctx.lineTo(W / 2 - 14, H * 0.16)
  ctx.closePath(); ctx.fill()
  // Wimpelkette als weiche Silhouette
  ctx.fillStyle = 'rgba(70,25,12,0.4)'
  for (let i = 0; i < 7; i++) {
    const x = W * 0.08 + i * (W * 0.13)
    const y = H * 0.3 + Math.sin((i / 6) * Math.PI) * H * 0.045
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14, y); ctx.lineTo(x + 7, y + 18); ctx.closePath(); ctx.fill()
  }
  // Tresen-/Regallinien (dunkle Bänder) + Flaschen-Glints
  ctx.fillStyle = 'rgba(80,35,14,0.45)'
  ctx.fillRect(0, H * 0.56, W, 7)
  ctx.fillRect(W * 0.08, H * 0.47, W * 0.5, 5)
  for (let i = 0; i < 6; i++) {
    const x = W * 0.12 + i * (W * 0.075)
    ctx.fillStyle = 'rgba(90,40,16,0.5)'
    ctx.fillRect(x, H * 0.425, 6, H * 0.045)
    ctx.fillStyle = 'rgba(255,220,160,0.65)'
    ctx.fillRect(x + 1.5, H * 0.43, 1.6, 5)
  }
  // sanfter Boden-Schein (Reflexion) + Dielen-Andeutung
  const g2 = ctx.createLinearGradient(0, H * 0.62, 0, H)
  g2.addColorStop(0, 'rgba(255,170,90,0)')
  g2.addColorStop(1, 'rgba(255,170,90,0.35)')
  ctx.fillStyle = g2
  ctx.fillRect(0, 0, W, H)
  ctx.strokeStyle = 'rgba(120,55,22,0.35)'
  ctx.lineWidth = 2
  for (let i = 1; i < 4; i++) {
    const y0 = H * 0.66 + i * (H * 0.08)
    ctx.beginPath()
    ctx.moveTo(W * (0.5 - 0.12 * i), y0); ctx.lineTo(W * (0.5 + 0.12 * i), y0); ctx.stroke()
  }
  // Vignette zur Laibung hin — verkauft die Tiefe des Durchgangs
  const vg = ctx.createLinearGradient(0, 0, W, 0)
  vg.addColorStop(0, 'rgba(30,12,6,0.55)')
  vg.addColorStop(0.14, 'rgba(30,12,6,0)')
  vg.addColorStop(0.86, 'rgba(30,12,6,0)')
  vg.addColorStop(1, 'rgba(30,12,6,0.55)')
  ctx.fillStyle = vg
  ctx.fillRect(0, 0, W, H)
  tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// ─────────────────────────────────────────────────────────────
// v14-E4: Windfang-Rückwand. Die K1-Mural-Textur (Wimpel/Regal)
// liest im Vollbild als Poster — die Rückwand des ECHTEN Windfangs
// ist deshalb eine ruhige, warm angestrahlte Putzwand mit einer
// inneren Türöffnung als Licht-Rechteck (dorthin geht die Reise
// weiter → der Welt-Hop setzt genau diese Bewegung fort).
// ─────────────────────────────────────────────────────────────
let wallTex: THREE.CanvasTexture | null = null

export function getVestibuleWallTexture(): THREE.CanvasTexture {
  if (wallTex) return wallTex
  const W = 160
  const H = 200
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  // warmer Putz, oben von der Deckenlampe angestrahlt
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0, '#e8c896')
  g.addColorStop(0.4, '#c9a06e')
  g.addColorStop(1, '#8a6544')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)
  const rg = ctx.createRadialGradient(W * 0.5, H * 0.08, 6, W * 0.5, H * 0.12, W * 0.9)
  rg.addColorStop(0, 'rgba(255,238,200,0.55)')
  rg.addColorStop(1, 'rgba(255,238,200,0)')
  ctx.fillStyle = rg
  ctx.fillRect(0, 0, W, H)
  // feines Putz-Korn
  const img = ctx.getImageData(0, 0, W, H)
  for (let p = 0; p < img.data.length; p += 4) {
    const n = ((Math.sin(p * 12.9898) * 43758.5453) % 1) * 10 - 5
    img.data[p] += n
    img.data[p + 1] += n
    img.data[p + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  // innere Türöffnung rechts (Süd): dunkle Laibung + warmes Lichtrechteck
  const dx = W * 0.56, dw = W * 0.3, dy = H * 0.3, dh = H * 0.62
  ctx.fillStyle = '#241708'
  ctx.fillRect(dx - 5, dy - 5, dw + 10, dh + 5)
  const dg = ctx.createLinearGradient(0, dy, 0, dy + dh)
  dg.addColorStop(0, '#ffe6b8')
  dg.addColorStop(0.5, '#ffc270')
  dg.addColorStop(1, '#d98f3e')
  ctx.fillStyle = dg
  ctx.fillRect(dx, dy, dw, dh)
  // Licht-Halo um die Öffnung
  const hg = ctx.createRadialGradient(dx + dw / 2, dy + dh * 0.5, 8, dx + dw / 2, dy + dh * 0.5, W * 0.5)
  hg.addColorStop(0, 'rgba(255,205,130,0.25)')
  hg.addColorStop(1, 'rgba(255,205,130,0)')
  ctx.fillStyle = hg
  ctx.fillRect(0, 0, W, H)
  // Sockelleiste
  ctx.fillStyle = 'rgba(50,32,20,0.8)'
  ctx.fillRect(0, H - 7, W, 7)
  wallTex = new THREE.CanvasTexture(cv)
  wallTex.colorSpace = THREE.SRGBColorSpace
  return wallTex
}
