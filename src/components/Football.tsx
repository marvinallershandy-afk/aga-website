import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cameraState, ballRollAt } from '../camera/CameraPath'

// Der Ball auf dem Anstoßpunkt. Beim Anstoß (Signature-Beat) rollt er
// scroll-getrieben vom Punkt an der Kamera vorbei — Position/Rotation
// sind reine Funktionen des Fahrt-Parameters u (rückwärts identisch).
//
// v14-R: prozedural statt GLB. Das Draco-Modell kostete beim Laden ~560 KB
// (251 KB GLB + Decoder-JS/WASM) für einen Ball, der ~40 px groß im Bild
// ist. Jetzt: Kugel mit klassischem Pentagon-Muster als Vertex-Farben.

const RADIUS = 0.05

const START = new THREE.Vector3(0, RADIUS + 0.02, 0)
const END = new THREE.Vector3(1.05, RADIUS + 0.02, 3.4) // rollt rechts an der Kamera vorbei

const _pos = new THREE.Vector3()

function makeBallGeometry(): THREE.BufferGeometry {
  // Die 12 Ecken eines Ikosaeders = Mittelpunkte der 12 schwarzen Fünfecke
  const ico = new THREE.IcosahedronGeometry(1, 0)
  const ip = ico.attributes.position
  const centers: THREE.Vector3[] = []
  for (let i = 0; i < ip.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(ip, i).normalize()
    if (!centers.some((c) => c.distanceToSquared(v) < 1e-4)) centers.push(v)
  }
  ico.dispose()

  const geo = new THREE.IcosahedronGeometry(RADIUS, 5)
  const pos = geo.attributes.position
  const colors = new Float32Array(pos.count * 3)
  const v = new THREE.Vector3()
  const PENTA = Math.cos(0.33) // Winkelradius eines Fünfecks
  const SEAM = Math.cos(0.355)
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize()
    let best = -1
    let second = -1
    for (const c of centers) {
      const d = v.dot(c)
      if (d > best) { second = best; best = d } else if (d > second) second = d
    }
    // schwarzes Fünfeck, schmale Naht drumherum, sonst weißes Leder;
    // Nähte zwischen den Sechsecken dort, wo zwei Zentren fast gleich nah sind
    let c = 0.93
    if (best > PENTA) c = 0.05
    else if (best > SEAM) c = 0.55
    else if (best - second < 0.012) c = 0.72
    colors[i * 3] = c
    colors[i * 3 + 1] = c
    colors[i * 3 + 2] = c * 0.98
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

export function Football() {
  const ref = useRef<THREE.Mesh>(null)
  const idleSpin = useRef(0)
  const geometry = useMemo(makeBallGeometry, [])

  useFrame((_, delta) => {
    const g = ref.current
    if (!g) return
    const r = ballRollAt(cameraState.u)
    if (r <= 0) {
      // Ruhe auf dem Punkt: dezente Dauerdrehung
      idleSpin.current += delta * 0.3
      g.position.copy(START)
      g.rotation.set(0, idleSpin.current, 0)
      return
    }
    // Anstoß: Ease-In-Roll, Abrollwinkel aus zurückgelegter Distanz
    const e = r * r * (3 - 2 * r)
    _pos.lerpVectors(START, END, e)
    g.position.copy(_pos)
    const dist = START.distanceTo(_pos)
    const dir = Math.atan2(END.x - START.x, END.z - START.z)
    g.rotation.set(0, dir, 0)
    g.rotateX(dist / RADIUS)
  })

  return (
    <mesh ref={ref} geometry={geometry} position={[0, RADIUS + 0.02, 0]} castShadow>
      <meshStandardMaterial vertexColors roughness={0.42} metalness={0} envMapIntensity={0.9} />
    </mesh>
  )
}
