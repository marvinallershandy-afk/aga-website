import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { floodLevels } from '../three/floodState'

// ─────────────────────────────────────────────────────────────
// Feine Bodennebel-Schicht in der Tiefe (v5 Kino-Ebene, Punkt
// „Licht in der Luft"): große, weiche Alpha-Quads knapp über dem
// Rasen an Waldrand/Süd und hinterm Ost-Tor. Gebaked, kein Licht,
// depthWrite aus.
//
// v14-A: alle Bahnen in EINER Geometrie (vorher 4 Draw-Calls → 1) und
// dazu Flutlicht-Dunst IN den Baumkronen: senkrechte, warme Schleier
// hinter den Masten und am Südrand, wo der Wald direkt am Licht steht.
// Der Dunst lebt vom Licht → Deckkraft folgt floodLevels (dunkel vor
// dem Anstoß, flackert mit). Bodennebel blendet aus, wenn man steil
// von oben draufschaut (Banden-Zoom: kein Grauschleier überm Gras),
// Kronen-Dunst, wenn man genau auf die Kante blickt.
// ─────────────────────────────────────────────────────────────

function makeMistTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 64
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(128, 32, 4, 128, 32, 120)
  g.addColorStop(0, 'rgba(255,255,255,0.55)')
  g.addColorStop(0.55, 'rgba(255,255,255,0.22)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.save()
  ctx.scale(1, 0.5)
  ctx.translate(0, 32)
  ctx.fillRect(0, 0, 256, 128)
  ctx.restore()
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

const MIST = '#bac7d6' // kühler Bodennebel (wie v5)
const HAZE = '#ffd7a0' // Flutlicht im Laub

// v14-E3: einen Hauch präsenter + eine vierte Bahn an der Nord-Seite —
// die Lichtkegel stehen jetzt „in etwas", nicht über blankem Boden.
const SHEETS: { pos: [number, number, number]; scale: [number, number]; opacity: number }[] = [
  { pos: [-2.5, 0.09, 3.6], scale: [7, 1.6], opacity: 0.46 },  // Süd-Reling / Waldrand
  { pos: [-4.8, 0.12, -2.2], scale: [6, 1.8], opacity: 0.4 },  // Nordwest-Tiefe
  { pos: [5.9, 0.1, -1.6], scale: [5, 1.4], opacity: 0.44 },   // hinterm Ost-Tor
  { pos: [1.6, 0.11, -3.4], scale: [6.5, 1.5], opacity: 0.34 }, // Nord-Tiefe
]

// Kronen-Dunst: senkrecht, zur Platzmitte gedreht (Waldrand-Lage aus forestLayout)
const VEILS: { pos: [number, number, number]; size: [number, number]; opacity: number }[] = [
  { pos: [-7.6, 1.7, 5.6], size: [4.2, 2.6], opacity: 0.2 },  // hinter Mast SW
  { pos: [7.4, 1.7, 5.7], size: [4.2, 2.6], opacity: 0.2 },   // hinter Mast SO (Fanblock)
  { pos: [-7.7, 1.8, -4.4], size: [3.6, 2.4], opacity: 0.16 }, // hinter Mast NW
  { pos: [-1.5, 1.5, 5.9], size: [6.5, 2.2], opacity: 0.12 },  // Südrand
  { pos: [-7.6, 1.5, 0.6], size: [5.5, 2.2], opacity: 0.11 },  // Westrand
  { pos: [8.9, 1.6, 0.0], size: [5.5, 2.2], opacity: 0.1 },    // hinterm Vereinsheim
]

function buildGeometry(): THREE.BufferGeometry {
  const P: number[] = []
  const UV: number[] = []
  const C: number[] = []
  const K: number[] = []
  const IDX: number[] = []
  const mist = new THREE.Color(MIST)
  const haze = new THREE.Color(HAZE)
  const quad = (corners: THREE.Vector3[], col: THREE.Color, a: number, kind: number) => {
    const b = P.length / 3
    const uvs = [0, 0, 1, 0, 1, 1, 0, 1]
    corners.forEach((v, i) => {
      P.push(v.x, v.y, v.z)
      UV.push(uvs[i * 2], uvs[i * 2 + 1])
      C.push(col.r, col.g, col.b, a)
      K.push(kind)
    })
    IDX.push(b, b + 1, b + 2, b, b + 2, b + 3)
  }
  for (const s of SHEETS) {
    const [x, y, z] = s.pos
    const [w, h] = s.scale
    quad(
      [
        new THREE.Vector3(x - w / 2, y, z + h / 2),
        new THREE.Vector3(x + w / 2, y, z + h / 2),
        new THREE.Vector3(x + w / 2, y, z - h / 2),
        new THREE.Vector3(x - w / 2, y, z - h / 2),
      ],
      mist,
      s.opacity,
      0,
    )
  }
  for (const v of VEILS) {
    const [x, y, z] = v.pos
    const [w, h] = v.size
    // Tangente quer zur Blickrichtung Mitte → Schleier
    const toC = new THREE.Vector3(-x, 0, -z).normalize()
    const t = new THREE.Vector3(-toC.z, 0, toC.x)
    const c = new THREE.Vector3(x, y, z)
    quad(
      [
        c.clone().addScaledVector(t, -w / 2).add(new THREE.Vector3(0, -h / 2, 0)),
        c.clone().addScaledVector(t, w / 2).add(new THREE.Vector3(0, -h / 2, 0)),
        c.clone().addScaledVector(t, w / 2).add(new THREE.Vector3(0, h / 2, 0)),
        c.clone().addScaledVector(t, -w / 2).add(new THREE.Vector3(0, h / 2, 0)),
      ],
      haze,
      v.opacity,
      1,
    )
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(C, 4))
  g.setAttribute('aKind', new THREE.Float32BufferAttribute(K, 1))
  g.setIndex(IDX)
  g.computeBoundingSphere()
  return g
}

const VERT_HEAD = /* glsl */ `
attribute float aKind;
varying float vFade;
`
const VERT_END = /* glsl */ `
#include <fog_vertex>
{
  vec3 wp = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vec3 V = normalize(cameraPosition - wp);
  // Boden: steil von oben → aus. Schleier: genau auf die Kante → aus.
  vec3 toC = normalize(vec3(-wp.x, 0.0, -wp.z));
  float ground = 1.0 - smoothstep(0.5, 0.88, V.y);
  float veil = smoothstep(0.12, 0.45, abs(dot(V, toC)));
  vFade = mix(ground, veil, aKind);
}
`
const FRAG_HEAD = /* glsl */ `
varying float vFade;
`
const FRAG_ALPHA = /* glsl */ `
#include <color_fragment>
diffuseColor.a *= vFade;
`

export function GroundMist() {
  const on = useStore((s) => s.cinemaFx.mist)
  const { geo, material } = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({
      map: makeMistTexture(),
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
    })
    m.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
        .replace('#include <fog_vertex>', VERT_END)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
        .replace('#include <color_fragment>', FRAG_ALPHA)
    }
    m.customProgramCacheKey = () => 'sva-mist-v14a'
    return { geo: buildGeometry(), material: m }
  }, [])

  const meshRef = useRef<THREE.Mesh>(null)
  useFrame(() => {
    // Dunst ist sichtbar, weil er angestrahlt wird: folgt dem Flutlicht
    const mat = meshRef.current?.material as THREE.MeshBasicMaterial | undefined
    if (!mat) return
    const lvl = (floodLevels[0] + floodLevels[1] + floodLevels[2] + floodLevels[3]) / 4
    mat.opacity = 0.35 + 0.65 * lvl
  })

  if (!on) return null
  return <mesh ref={meshRef} geometry={geo} material={material} renderOrder={40} frustumCulled={false} />
}
