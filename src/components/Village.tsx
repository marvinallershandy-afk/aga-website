import { useMemo } from 'react'
import * as THREE from 'three'

// Dorf-Silhouette an der offenen NORD-Seite (Agathenburg liegt hinterm
// Platz Richtung Schulstraße) — v19-3D (§2.4.1): weiche, gerundete
// Hügel-/Baumband-Silhouetten in zwei, drei Graustufen statt gezackter
// schwarzer Giebel-Polygone (die aus der Finale-Vogelperspektive wie
// Geometrie-Fehler aussahen). Vereinzelt warm erleuchtete Fenster
// bleiben, im Fog halb versunken.
// Beleg: dji_…142306_0154…/f001, Satellit.

// Weiche Massen: gestreckte, geglättete Kuppen (Low-Poly-Kugel-Kappen) in
// drei Tönen + ein paar warme Fensterpunkte.
const MOUNDS: { x: number; z: number; w: number; d: number; h: number; tone: number }[] = [
  { x: -6.8, z: -7.6, w: 2.6, d: 1.6, h: 0.62, tone: 0 },
  { x: -4.2, z: -8.3, w: 3.0, d: 1.8, h: 0.78, tone: 1 },
  { x: -1.3, z: -7.8, w: 2.4, d: 1.5, h: 0.56, tone: 2 },
  { x: 1.4, z: -8.5, w: 3.2, d: 1.9, h: 0.72, tone: 0 },
  { x: 4.3, z: -7.7, w: 2.8, d: 1.6, h: 0.6, tone: 1 },
  { x: 7.0, z: -8.2, w: 2.4, d: 1.5, h: 0.5, tone: 2 },
]
const TONES = ['#141210', '#1a1714', '#211c18']

// Warme Fensterlichter (bleiben als Lebenszeichen im Dorf)
const WINDOWS: [number, number, number][] = [
  [-6.4, 0.3, -6.9],
  [-3.6, 0.42, -7.5],
  [-3.9, 0.22, -7.5],
  [1.9, 0.36, -7.7],
  [4.1, 0.26, -7.0],
]

function Mound({ x, z, w, d, h, tone }: (typeof MOUNDS)[number]) {
  // obere Halbkugel, flach gedrückt und gestreckt → weiche Kuppe ohne Zacken
  const geo = useMemo(() => {
    const g = new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)
    return g
  }, [])
  return (
    <mesh geometry={geo} position={[x, 0, z]} scale={[w / 2, h, d / 2]}>
      <meshStandardMaterial color={TONES[tone]} roughness={1} />
    </mesh>
  )
}

export function Village() {
  return (
    <group>
      {MOUNDS.map((m, i) => (
        <Mound key={i} {...m} />
      ))}
      {WINDOWS.map((p, i) => (
        <mesh key={i} position={p}>
          <planeGeometry args={[0.1, 0.08]} />
          <meshStandardMaterial color="#ffb765" emissive="#ff9d3f" emissiveIntensity={1.1} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}
