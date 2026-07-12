import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// v13-X2: Nacht-IBL. Vorher hatten die MeshStandardMaterials KEIN
// Environment — Speculars tot, Metall wie Plastik, alles kreidig
// („PBR im Vakuum", der Kern des 2007-Eindrucks). Hier: eine kleine
// prozedurale Equirect-Nachtkuppel (kühles Mondblau oben, dunkler
// Horizont, warme Flutlicht-Lobes knapp über dem Horizont an vier
// Azimuten) → einmalig per PMREM vorgefiltert → scene.environment.
// Kostet einen Bake beim Start, null pro Frame.
// ─────────────────────────────────────────────────────────────

function makeNightEquirect(): THREE.CanvasTexture {
  const W = 512
  const H = 256
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!

  // Vertikaler Himmel-Verlauf (equirect: y=0 Zenit, y=H Nadir)
  const g = ctx.createLinearGradient(0, 0, 0, H)
  g.addColorStop(0.0, '#2c3866') // Zenit: Mondblau
  g.addColorStop(0.42, '#1b2140') // Nachthimmel
  g.addColorStop(0.55, '#241f28') // Horizontdunst
  g.addColorStop(0.62, '#191419') // Baumlinie
  g.addColorStop(1.0, '#171310') // Boden-Bounce (warm-dunkel)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  // Mond-Glow (NW, passend zur moon-Directional bei [-6,9,-4])
  const moon = ctx.createRadialGradient(W * 0.68, H * 0.2, 4, W * 0.68, H * 0.2, 46)
  moon.addColorStop(0, 'rgba(190,205,255,0.9)')
  moon.addColorStop(0.4, 'rgba(140,160,230,0.35)')
  moon.addColorStop(1, 'rgba(120,140,210,0)')
  ctx.fillStyle = moon
  ctx.fillRect(0, 0, W, H)

  // Warme Flutlicht-Lobes knapp über dem Horizont — vier Masten rund
  // um den Platz. Sie geben Metall/Karten die warmen Glints.
  for (const az of [0.1, 0.35, 0.6, 0.85]) {
    const x = W * az
    const y = H * 0.55
    const lobe = ctx.createRadialGradient(x, y, 2, x, y, 34)
    lobe.addColorStop(0, 'rgba(255,214,150,0.85)')
    lobe.addColorStop(0.5, 'rgba(255,180,100,0.28)')
    lobe.addColorStop(1, 'rgba(255,160,80,0)')
    ctx.fillStyle = lobe
    ctx.fillRect(x - 40, y - 40, 80, 80)
  }
  // Rasen-Bounce: schwacher grünlicher Schein im unteren Bereich
  const grass = ctx.createLinearGradient(0, H * 0.62, 0, H * 0.8)
  grass.addColorStop(0, 'rgba(70,110,60,0.16)')
  grass.addColorStop(1, 'rgba(40,70,40,0)')
  ctx.fillStyle = grass
  ctx.fillRect(0, H * 0.62, W, H * 0.2)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

export function NightEnvironment() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  useEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl)
    const equirect = makeNightEquirect()
    equirect.mapping = THREE.EquirectangularReflectionMapping
    const rt = pmrem.fromEquirectangular(equirect)
    scene.environment = rt.texture
    scene.environmentIntensity = 0.55
    equirect.dispose()
    pmrem.dispose()
    return () => {
      scene.environment = null
      rt.dispose()
    }
  }, [gl, scene])
  return null
}
