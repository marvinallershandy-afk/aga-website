import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

// Baumreihen-Silhouetten nach REFERENZ_MODELL: der Wald umschließt
// SÜD (+z), WEST (−x) und OST (+x) dicht und hoch; NORDEN (−z) ist
// zum Dorf hin offen (dort stehen die Village-Silhouetten).
// Szene-Kompass: +x = Ost, +z = Süd.

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

interface RingOpts {
  seed: number
  radius: number
  hMin: number
  hMax: number
  /** Nord-Sektor (z < −gapZ·r) überspringen bzw. absenken */
  gapZ: number
  gapScale: number // 0 = Lücke ganz offen, 0.3 = niedrige Resthecke
}

function buildRing({ seed, radius, hMin, hMax, gapZ, gapScale }: RingOpts): THREE.BufferGeometry {
  const rng = mulberry32(seed)
  const N = 200
  const raw = Array.from({ length: N }, () => hMin + rng() * (hMax - hMin))
  const s1 = raw.map((_, i) => (raw[(i + N - 1) % N] + raw[i] * 2 + raw[(i + 1) % N]) / 4)
  const h = s1.map((_, i) => (s1[(i + N - 1) % N] + s1[i] * 2 + s1[(i + 1) % N]) / 4)

  const pos: number[] = []
  const uv: number[] = []
  const idx: number[] = []
  for (let i = 0; i < N; i++) {
    const a = (i / N) * Math.PI * 2
    const r = radius + (rng() - 0.5) * 1.6
    const x = Math.cos(a) * r
    const z = Math.sin(a) * r
    // Nord-Lücke: sanft auf gapScale absenken
    const northness = THREE.MathUtils.clamp((-z / radius - gapZ) / 0.25, 0, 1)
    const hh = h[i] * (1 - northness * (1 - gapScale))
    pos.push(x, -0.3, z)
    pos.push(x, Math.max(hh, 0.05), z)
    // UVs (v5.5): u läuft mehrfach um den Ring (nahtlose Wald-Textur),
    // v 0 unten → 1 an der Kronen-Kante
    const u = (i / N) * 10
    uv.push(u, 0, u, 1)
  }
  for (let i = 0; i < N; i++) {
    const a = i * 2
    const b = ((i + 1) % N) * 2
    idx.push(a, b, a + 1, b, b + 1, a + 1)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  g.setIndex(idx)
  return g
}

export function Treeline() {
  // innerer Saum: dicht an Süd-Reling/Ost hinterm Vereinsheim, Nord offen
  const inner = useMemo(
    () => buildRing({ seed: 11, radius: 12.5, hMin: 1.3, hMax: 2.2, gapZ: 0.25, gapScale: 0.12 }),
    [],
  )
  // äußerer Wald: hoch, Nord nur abgesenkt (ferne Bäume hinterm Dorf)
  const outer = useMemo(
    () => buildRing({ seed: 23, radius: 18, hMin: 2.0, hMax: 3.4, gapZ: 0.3, gapScale: 0.35 }),
    [],
  )
  // v5.5 („Fotomaterial"): der innere Saum trägt eine echte Wald-
  // Textur (Band aus dem Higgsfield-Kino-Referenzframe, nahtlos
  // gespiegelt, Alpha läuft oben aus — die Geometrie-Kante bleibt
  // die Silhouette). Der äußere Ring bleibt tiefschwarze Kulisse.
  const wald = useTexture('/textures/waldrand.webp')
  wald.wrapS = THREE.RepeatWrapping
  wald.colorSpace = THREE.SRGBColorSpace
  wald.anisotropy = 4

  return (
    <group>
      {/* opak (v5.5-Perf): Grundton ist in die Textur gebaked —
          kein transparenter Fullring-Pass, kein Backing-Mesh */}
      <mesh geometry={inner}>
        <meshBasicMaterial map={wald} color="#3a4a3c" side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={outer}>
        <meshBasicMaterial color="#0c110d" side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}
