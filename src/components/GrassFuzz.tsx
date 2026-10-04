import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH, APRON } from '../utils/constants'
import { mulberry32 } from '../three/proceduralNoise'
import { forestDepth } from '../three/forestLayout'
import { forestUniforms } from '../three/forestMaterial'
import { getWorldTier } from '../three/qualityTier'

// ─────────────────────────────────────────────────────────────
// v14-A: Gras-„Fuzz" — echte Halme (je 1 Dreieck) dort, wo der
// Mäher nicht hinkommt: an der Rasenkante, unter der Reling, am Fuß
// der Ballfangzäune und als hohes Altgras/Farn-Saum am Waldrand.
// Bricht die harten Kanten (Platz-Mesh ↔ Umraum, Pfosten ↔ Boden),
// die bei tiefen Kameras (Anstoß, Banden-Zoom, Fanblock) sofort als
// „Modell" lesen. EIN Draw-Call (~25k Dreiecke), Lambert, leichter
// Wind über dieselbe Zeit-Uniform wie der Wald. Mobile: aus.
// ─────────────────────────────────────────────────────────────

const PW = PITCH.width / 2 + APRON // Mesh-Kante Rasen 5.65
const PH = PITCH.height / 2 + APRON // 3.8
const RW = PITCH.width / 2 + 0.55 // Reling 5.8
const RH = PITCH.height / 2 + 0.55 // 3.95

const VERT_HEAD = /* glsl */ `
attribute float aWind;
uniform float uTime;
`
const VERT_BEGIN = /* glsl */ `
#include <begin_vertex>
{
  float ph = position.x * 3.1 + position.z * 2.3;
  float s = sin(uTime * 1.3 + ph) * 0.5 + sin(uTime * 2.9 + ph * 1.7) * 0.25;
  transformed.x += s * 0.004 * aWind;
  transformed.z += cos(uTime * 1.1 + ph) * 0.003 * aWind;
}
`

function buildBlades(): THREE.BufferGeometry {
  const rng = mulberry32(3141)
  const P: number[] = []
  const N: number[] = []
  const C: number[] = []
  const W: number[] = []
  const base = new THREE.Color()
  const tip = new THREE.Color()

  const onPitch = (x: number, z: number) => Math.abs(x) < PW && Math.abs(z) < PH
  const blade = (x: number, z: number, h: number, wild: number) => {
    const y = onPitch(x, z) ? 0.0 : -0.02
    const a = rng() * Math.PI * 2
    const w = 0.0035 + rng() * 0.003
    const lean = (0.25 + rng() * 0.45) * h
    const la = rng() * Math.PI * 2
    const bx = Math.cos(a) * w
    const bz = Math.sin(a) * w
    P.push(x - bx, y, z - bz, x + bx, y, z + bz, x + Math.cos(la) * lean, y + h, z + Math.sin(la) * lean)
    // Normalen überwiegend nach oben → schattiert wie der Boden darunter
    const nx = Math.cos(a + Math.PI / 2) * 0.35
    const nz = Math.sin(a + Math.PI / 2) * 0.35
    for (let k = 0; k < 3; k++) N.push(nx, 0.93, nz)
    // Halmfarbe: satt bis strohig (ungemähte Ränder sind trockener)
    const dry = rng() < 0.18 + wild * 0.3
    // (linear; Rasen-Albedo liegt bei ~0.025/0.11/0.02)
    const v = 0.8 + rng() * 0.5
    tip.setRGB(dry ? 0.11 * v : 0.035 * v, dry ? 0.11 * v : 0.13 * v, dry ? 0.04 * v : 0.025 * v)
    base.setRGB(0.014, 0.05, 0.012)
    C.push(base.r, base.g, base.b, base.r, base.g, base.b, tip.r, tip.g, tip.b)
    W.push(0, 0, 1)
  }

  // Büschel: 3–5 Halme um einen Punkt, ähnliche Höhe/Farbe
  const tuft = (x: number, z: number, h: number, wild: number) => {
    const n = 3 + Math.floor(rng() * 3)
    for (let i = 0; i < n; i++) blade(x + (rng() - 0.5) * 0.012, z + (rng() - 0.5) * 0.012, h * (0.6 + rng() * 0.5), wild)
  }

  // 1) Rasenkante + Reling-Streifen: dichter Saum, nach außen höher
  const ring = (count: number, hx: number, hz: number, spread: number, hMin: number, hMax: number, wild: number) => {
    const per = 2 * (hx + hz)
    for (let i = 0; i < count; i++) {
      let t = rng() * per * 2
      let x: number
      let z: number
      if (t < hx * 2) { x = -hx + t; z = -hz }
      else if ((t -= hx * 2) < hz * 2) { x = hx; z = -hz + t }
      else if ((t -= hz * 2) < hx * 2) { x = hx - t; z = hz }
      else { t -= hx * 2; x = -hx; z = hz - t }
      const off = (rng() - 0.3) * spread
      // nach außen versetzen (Normale der Kante)
      if (Math.abs(z) >= hz - 1e-6) z += Math.sign(z) * off
      else x += Math.sign(x) * off
      tuft(x, z, hMin + rng() * (hMax - hMin), wild)
    }
  }
  ring(2600, PW, PH, 0.08, 0.008, 0.018, 0)
  ring(2200, RW, RH, 0.12, 0.012, 0.028, 0.35)

  // 2) Fuß der Ballfangzäune (x = ±6.2, z ±1.3)
  for (const s of [-1, 1]) {
    for (let i = 0; i < 420; i++) {
      blade(s * (PITCH.width / 2 + 0.95) + (rng() - 0.5) * 0.08, -1.3 + rng() * 2.6, 0.012 + rng() * 0.025, 0.5)
    }
  }

  // 3) Waldsaum: hohes Altgras/Farn-Andeutung auf der Übergangszone
  let placed = 0
  for (let k = 0; k < 60000 && placed < 2600; k++) {
    const x = -14 + rng() * 28
    const z = -8 + rng() * 22
    const d = forestDepth(x, z)
    if (d < -0.35 || d > 0.4) continue
    blade(x, z, 0.025 + rng() * 0.045, 0.7)
    placed++
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3))
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3))
  g.setAttribute('aWind', new THREE.Float32BufferAttribute(W, 1))
  g.computeBoundingSphere()
  return g
}

export function GrassFuzz() {
  const enabled = getWorldTier() === 'full'
  const geo = useMemo(() => (enabled ? buildBlades() : null), [enabled])
  const material = useMemo(() => {
    const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })
    m.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = forestUniforms.uTime
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
        .replace('#include <begin_vertex>', VERT_BEGIN)
      // Rückseiten NICHT spiegeln: Halme tragen Boden-Normalen
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_begin>',
        '#include <normal_fragment_begin>\n#ifdef DOUBLE_SIDED\nnormal *= faceDirection;\n#endif',
      )
    }
    m.customProgramCacheKey = () => 'sva-grassfuzz-v14a'
    return m
  }, [])
  if (!geo) return null
  return <mesh name="grassFuzz" geometry={geo} material={material} frustumCulled={false} />
}
