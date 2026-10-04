import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { getWorldTier } from '../three/qualityTier'
import { buildForest, FOREST_TIERS, type TreePlacement } from '../three/forestLayout'
import { makeLeafTexture, makeTreeGeometry, TREE_SHAPES } from '../three/treeGeometry'
import { forestUniforms, getForestMaterial, getLeafCardMaterial } from '../three/forestMaterial'
import { floodLevels } from '../three/floodState'
import { cameraState } from '../camera/CameraPath'

// wie MapGround (FADE_START/FADE_SPAN), etwas früher fertig
const MAP_FADE_START = 0.84
const MAP_FADE_SPAN = 0.1

// ─────────────────────────────────────────────────────────────
// v14-A „Waldsportplatz": Der Platz liegt in einer Lichtung aus
// alten Buchen und Eichen (20–30 m, doppelt so hoch wie das
// Vereinsheim) — W, S, O dicht, Nord offen zum Dorf. Ersetzt die
// kleinen Kenney-Kiefern (v7-E1) durch einen prozeduralen Laubwald:
//  · 3 Baum-Varianten + 1 Unterholz-Variante = 4 InstancedMeshes
//    (= 4 Draw-Calls, so viele wie vorher Kiefern + AO-Scheiben)
//  · Waldrand dicht + warm vom Flutlicht angestrahlt, dahinter der
//    günstigere Bestand, der ins Dunkel/den Fog abfällt
//  · Wind im Vertex-Shader, Flutlicht-Streulicht im Fragment-Shader
//    (src/three/forestMaterial.ts), Lage aus src/three/forestLayout.ts
//  · Bäume, die aus der aktuellen Kamera den Platz verdecken würden
//    (Hero-Drohne über dem Südwald), ziehen sich auf ihren Fuß zurück.
// Mobile/schwache GPUs (cinemaTier 'reduced'): halber Wald, alles in
// der günstigen Unterteilung, kein Unterholz.
// ─────────────────────────────────────────────────────────────

// Sichtziel für die Verdeckungs-Prüfung: Reling-Rechteck inkl. Fanblock
const OCC = { x0: -5.95, x1: 5.95, z0: -4.1, z1: 4.95 }
const OCC_TARGET_Y = 0.35 // Banner/Fans/Tafeln, nicht nur der Rasen

// Laub-Karten je Blob (Buche, Eiche, Bestand, Unterholz) — nur Desktop
const CARDS_PER_BLOB = [7, 7, 4, 3]

interface Bucket {
  meshes: THREE.InstancedMesh[]
  list: TreePlacement[]
  fade: THREE.InstancedBufferAttribute
}

const FADE_BAND = 0.6

/** Ein Sichtstrahl (xz) Kamera → Kronenpunkt: verdeckt ein Baum der Höhe h
 *  dort etwas vom Platz? → 1 = sichtbar lassen, 0 = wegnehmen */
function rayFade(px: number, pz: number, h: number, cx: number, cy: number, cz: number): number {
  const dx = px - cx
  const dz = pz - cz
  const dist = Math.hypot(dx, dz)
  if (dist < 1e-4) return 1
  const ux = dx / dist
  const uz = dz / dist
  let tmin = -Infinity
  let tmax = Infinity
  // Slab-Test (2D) gegen das Platz-Rechteck
  const slab = (o: number, u: number, a: number, b: number) => {
    if (Math.abs(u) < 1e-6) return o >= a && o <= b
    let t1 = (a - o) / u
    let t2 = (b - o) / u
    if (t1 > t2) [t1, t2] = [t2, t1]
    tmin = Math.max(tmin, t1)
    tmax = Math.min(tmax, t2)
    return true
  }
  if (!slab(cx, ux, OCC.x0, OCC.x1)) return 1
  if (!slab(cz, uz, OCC.z0, OCC.z1)) return 1
  if (tmax < Math.max(tmin, 0)) return 1 // Strahl verfehlt den Platz
  if (tmin < 0) return 1 // Kamera steht auf der Lichtung → Wald ist Kulisse
  if (tmax < dist) return 1 // Baum steht hinter dem Platz
  // Kronenpunkt vor dem Platz (oder überhängend): Sichtlinie zum
  // nächsten Platzrand, Höhe am Baum
  const ySight = tmin > dist ? cy - (cy - OCC_TARGET_Y) * (dist / tmin) : OCC_TARGET_Y
  return Math.min(1, Math.max(0, (ySight + FADE_BAND - h) / FADE_BAND))
}

/** Krone als drei Strahlen (Mitte + beide Flanken quer zur Blickrichtung) */
function visibleFactor(p: TreePlacement, cx: number, cy: number, cz: number, crownR: number): number {
  const dx = p.x - cx
  const dz = p.z - cz
  const dist = Math.hypot(dx, dz) || 1
  const nx = -dz / dist
  const nz = dx / dist
  return Math.min(
    rayFade(p.x, p.z, p.h, cx, cy, cz),
    rayFade(p.x + nx * crownR, p.z + nz * crownR, p.h, cx, cy, cz),
    rayFade(p.x - nx * crownR, p.z - nz * crownR, p.h, cx, cy, cz),
  )
}

export function ForestTrees() {
  const tierName = getWorldTier()
  const tier = FOREST_TIERS[tierName]
  const reduced = tierName === 'reduced'

  const cardMaterial = useMemo(() => (reduced ? null : getLeafCardMaterial(makeLeafTexture())), [reduced])
  const buckets = useMemo<Bucket[]>(() => {
    const { trees, bushes } = buildForest(tier)
    const material = getForestMaterial()
    const lists: TreePlacement[][] = [[], [], [], []]
    for (const t of trees) lists[t.variant].push(t)
    lists[3] = bushes
    const out: Bucket[] = []
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const s = new THREE.Vector3()
    const p = new THREE.Vector3()
    const up = new THREE.Vector3(0, 1, 0)
    const col = new THREE.Color()
    lists.forEach((list, vi) => {
      if (!list.length) return
      const shape = TREE_SHAPES[vi]
      const { core, cards } = makeTreeGeometry(
        reduced ? { ...shape, detail: 1, blobs: Math.max(5, shape.blobs - 3), limbs: Math.min(shape.limbs, 2) } : shape,
        reduced ? 0 : CARDS_PER_BLOB[vi],
      )
      const fade = new THREE.InstancedBufferAttribute(new Float32Array(list.length).fill(1), 1)
      fade.setUsage(THREE.DynamicDrawUsage)
      const shadeArr = new Float32Array(list.length)
      list.forEach((t, i) => {
        // Waldinneres schluckt Licht: Rand 1.0 → tief drin ~0.4
        shadeArr[i] = 0.4 + 0.6 * Math.exp(-Math.max(0, t.depth - 0.4) * 0.42)
      })
      const shade = new THREE.InstancedBufferAttribute(shadeArr, 1)
      const meshes: THREE.InstancedMesh[] = []
      for (const [geo, mat] of [
        [core, material],
        [cards, cardMaterial],
      ] as const) {
        if (!geo || !mat) continue
        geo.setAttribute('aFade', fade) // dieselben Instanz-Puffer für Kern + Karten
        geo.setAttribute('aShade', shade)
        const mesh = new THREE.InstancedMesh(geo, mat, list.length)
        list.forEach((t, i) => {
          q.setFromAxisAngle(up, t.rot)
          s.set(t.h * t.w, t.h, t.h * t.w)
          p.set(t.x, -0.03, t.z)
          mesh.setMatrixAt(i, m.compose(p, q, s))
          mesh.setColorAt(i, col.setRGB(t.tint[0], t.tint[1], t.tint[2]))
        })
        mesh.instanceMatrix.needsUpdate = true
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
        mesh.computeBoundingSphere()
        // Laufzeit-Daten für die Verdeckungs-Prüfung (nur am Kern-Mesh)
        if (!meshes.length) mesh.userData.forest = { list, fade }
        meshes.push(mesh)
      }
      out.push({ meshes, list, fade })
    })
    return out
  }, [tier, reduced, cardMaterial])

  useEffect(
    () => () => {
      buckets.forEach((b) =>
        b.meshes.forEach((mesh) => {
          mesh.geometry.dispose()
          mesh.dispose()
        }),
      )
    },
    [buckets],
  )

  // Laufzeit-Zustand über den Szenengraph (Refs), nicht über Closures
  const groupRef = useRef<THREE.Group>(null)
  const last = useRef(new THREE.Vector3(1e9, 0, 0))
  const lastMap = useRef(1)
  useFrame((state) => {
    const group = groupRef.current
    if (!group) return
    const u = forestUniforms
    u.uTime.value = state.clock.elapsedTime
    u.uFlood.value.set(floodLevels[0], floodLevels[1], floodLevels[2], floodLevels[3])

    const cam = state.camera.position
    // Dev-Hook für die Perf-Messung (shots-atmo/bench*.mjs), im Build entfernt
    if (import.meta.env.DEV) {
      ;(window as unknown as Record<string, unknown>).__forest = { group, gl: state.gl, scene: state.scene, camera: state.camera }
    }
    // Finale (Maps-Rauszoom, MapGround): die Welt wird zur Karte — der Wald
    // zieht sich in den Boden zurück, während die Karte (mit ihren eigenen
    // Waldflächen + „Waldsportplatz"-Label) einblendet.
    const mapFade = 1 - THREE.MathUtils.clamp((cameraState.u - MAP_FADE_START) / MAP_FADE_SPAN, 0, 1)
    if (cam.distanceToSquared(last.current) < 1e-6 && Math.abs(mapFade - lastMap.current) < 1e-4) return
    last.current.copy(cam)
    lastMap.current = mapFade
    for (const obj of group.children) {
      const b = obj.userData.forest as { list: TreePlacement[]; fade: THREE.InstancedBufferAttribute } | undefined
      if (!b) continue
      const arr = b.fade.array as Float32Array
      const shape = TREE_SHAPES[b.list[0].variant] ?? TREE_SHAPES[0]
      let dirty = false
      for (let i = 0; i < b.list.length; i++) {
        const t = b.list[i]
        const v = mapFade * visibleFactor(t, cam.x, cam.y, cam.z, shape.width * t.w * t.h * 1.15)
        if (Math.abs(arr[i] - v) > 1e-3) {
          arr[i] = v
          dirty = true
        }
      }
      if (dirty) b.fade.needsUpdate = true
    }
  })

  return (
    <group ref={groupRef}>
      {buckets.map((b, i) => (
        b.meshes.map((mesh, j) => <primitive key={i + '-' + j} object={mesh} />)
      ))}
    </group>
  )
}
