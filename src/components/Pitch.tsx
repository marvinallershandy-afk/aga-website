import { use, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { forestUniforms } from '../three/forestMaterial'
import { getWorldTier } from '../three/qualityTier'
import { MESH_W, MESH_H, TEX_W, TEX_H, STRIPE_W, paintPitch, type Ctx2D } from '../three/pitchPaint'
import { getGrassDetailTexture, GRASS_DETAIL_GLSL } from '../three/grassDetail'

// ─────────────────────────────────────────────────────────────
// Der Rasen als EIN Mesh mit prozeduraler Textur: Mähstreifen,
// Körnung, Abnutzung UND alle Spielfeldmarkierungen maßstabsgetreu
// gebacken (105×68 m, Linienbreite ~12 cm skaliert, Mittelkreis
// 9,15 m, Strafraum 16,5 m, Fünfmeterraum, Elfmeterpunkt + Bogen,
// Eckbögen). Ersetzt Pitch + PitchLines aus v1 → −2 Draw-Calls,
// echte Linienbreite, Anti-Aliasing gratis.
//
// v14-A „Rasen, nicht Tapete" (Referenz: Drohnenframes platz_026/036,
// platzk_011 — ein echter Dorfrasen ist fleckig, nicht gleichmäßig):
//  · Mähstreifen exakt an der Mittellinie ausgerichtet (18 Bahnen à
//    5,8 m) und BLICKABHÄNGIG: die Halme liegen je Bahn in Fahrtrichtung
//    des Mähers — aus Süd gesehen ist Bahn A hell, aus Nord Bahn B
//    (Shader, keine Zusatzkosten außer ein paar ALU-Ops).
//  · großflächige Feucht-/Trockenflecken (fbm), abgespielte Torräume
//    mit nackter Erde, Elfmeterpunkt, Anstoßpunkt, Linienrichter-Spur.
//  · Gras-Detailkachel in Weltkoordinaten (Albedo + Bump) → bei der
//    Banden- und Anstoß-Kamera liest man Halme statt Pixelbrei.
//  · Anisotrope Filterung 8× auf der Detailkachel, 4× auf der Platztextur.
//  · Rand des Meshes läuft weich in die Umraum-Wiese aus (keine Kante).
// ─────────────────────────────────────────────────────────────

// ── Shader-Zusätze (onBeforeCompile) ───────────────────────────
const VERT_HEAD = /* glsl */ `
varying vec3 vPW;
`
const VERT_WORLD = /* glsl */ `
#include <worldpos_vertex>
vPW = (modelMatrix * vec4(transformed, 1.0)).xyz;
`
const FRAG_HEAD = /* glsl */ `
uniform sampler2D uGrassDetail;
uniform float uStripeW;
varying vec3 vPW;
${GRASS_DETAIL_GLSL}
`
const FRAG_MAP = /* glsl */ `
#include <map_fragment>
{
  vec3 toCam = cameraPosition - vPW;
  float dist = length(toCam);
  vec3 V = toCam / dist;
  diffuseColor.rgb *= grassDetail(vPW.xz, dist);
  // Mähstreifen-Glanz: Halme je Bahn in Fahrtrichtung (±z) gelegt —
  // Blick in Legerichtung = hell, dagegen = dunkel. Flache Blicke stärker.
  float sid = floor(vPW.x / uStripeW);
  float dir = mod(sid, 2.0) < 0.5 ? 1.0 : -1.0;
  float grazing = 1.0 - smoothstep(0.55, 0.98, V.y);
  diffuseColor.rgb *= 1.0 + 0.15 * dir * V.z * (0.45 + 0.55 * grazing);
}
`

// v14: Modul-Cache statt useMemo. Solange irgendein Geschwister in der
// Haupt-Suspense noch lädt, verwirft React den nicht committeten Baum und
// rendert neu — useMemo zählt dann nicht. paintGrass (~0,6 s) lief so beim
// Laden ~11× (gemessen 5,5 s CPU vor dem Tor). Jetzt genau einmal.
// v16-K: gemalt wird im Web-Worker (OffscreenCanvas) — vorher war das der
// größte Einzelblock im Lade-Task (Mittelklasse-Handy ~1 s, Marker-Klicks
// hingen so lange). Die Szene wartet per Suspense (use) auf das Ergebnis.
type PitchTextures = { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture; bump: THREE.Texture }
let pitchTexPromise: Promise<PitchTextures> | null = null
function getPitchTextures(): Promise<PitchTextures> {
  if (!pitchTexPromise) pitchTexPromise = paintInWorker().catch(() => paintOnMainThread())
  return pitchTexPromise
}

/** ImageBitmap → Canvas (gleiche flipY-Semantik wie die bisherige
 *  CanvasTexture; drawImage ist ein GPU-Blit, kein Malen). */
function toCanvas(src: CanvasImageSource, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = w
  cv.height = h
  cv.getContext('2d')!.drawImage(src, 0, 0)
  return cv
}

function paintInWorker(): Promise<PitchTextures> {
  if (typeof OffscreenCanvas === 'undefined' || typeof Worker === 'undefined') {
    return Promise.reject(new Error('kein OffscreenCanvas'))
  }
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('../three/pitchTexture.worker.ts', import.meta.url), { type: 'module' })
    const fail = () => {
      worker.terminate()
      reject(new Error('Rasen-Worker fehlgeschlagen'))
    }
    worker.onerror = fail
    worker.onmessageerror = fail
    worker.onmessage = (e: MessageEvent<{ map: ImageBitmap; rough: ImageBitmap }>) => {
      worker.terminate()
      const { map, rough } = e.data
      const cv = toCanvas(map, map.width, map.height)
      const small = toCanvas(rough, rough.width, rough.height)
      map.close()
      rough.close()
      resolve(finishTextures(cv, small))
    }
    worker.postMessage(null)
  })
}

function paintOnMainThread(): PitchTextures {
  const cv = document.createElement('canvas')
  cv.width = TEX_W; cv.height = TEX_H
  const ctx = cv.getContext('2d')!
  const rcv = document.createElement('canvas')
  rcv.width = TEX_W; rcv.height = TEX_H
  const rctx = rcv.getContext('2d')!
  paintPitch(ctx, rctx as Ctx2D, (w, h) => {
    const c = document.createElement('canvas')
    c.width = w
    c.height = h
    return c
  })
  // v14-E3: roughnessMap kommt zurück — aber auf 512px runtergerechnet.
  // Die volle 2048er-Probe pro Fragment war das Frametime-Problem (v5.5);
  // bei 512 ist die Probe cache-freundlich und die Mähstreifen bekommen
  // unter IBL/Mond wieder unterschiedlichen Glanz (Tiefe statt Farbfläche).
  const rSmall = document.createElement('canvas')
  rSmall.width = 512
  rSmall.height = Math.round(512 * (TEX_H / TEX_W))
  rSmall.getContext('2d')!.drawImage(rcv, 0, 0, rSmall.width, rSmall.height)
  return finishTextures(cv, rSmall)
}

function finishTextures(cv: HTMLCanvasElement, rSmall: HTMLCanvasElement): PitchTextures {
  const map = new THREE.CanvasTexture(cv)
  map.colorSpace = THREE.SRGBColorSpace
  // v5.5: 4× Anisotropie (8 kostete die vsync-Kante mit voller Kette;
  // 4 behebt den Tiefen-Matsch bereits sichtbar)
  map.anisotropy = 4
  const roughnessMap = new THREE.CanvasTexture(rSmall)
  // Bump aus der Detailkachel, in Weltmaßstab über die UVs gelegt
  const bump = getGrassDetailTexture().clone()
  bump.repeat.set(MESH_W * 2.9, MESH_H * 2.9)
  bump.needsUpdate = true
  return { map, roughnessMap, bump }
}

export function Pitch() {
  const { map, roughnessMap, bump } = use(getPitchTextures())

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uGrassDetail = { value: getGrassDetailTexture() }
      shader.uniforms.uStripeW = { value: STRIPE_W }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + VERT_HEAD)
        .replace('#include <worldpos_vertex>', VERT_WORLD)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + FRAG_HEAD)
        .replace('#include <map_fragment>', FRAG_MAP)
    },
    [],
  )

  return (
    <group>
      {/* v13-X3: der Rasen empfängt die statisch gebackenen Schatten */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[MESH_W, MESH_H]} />
        <meshStandardMaterial
          map={map}
          roughnessMap={roughnessMap}
          roughness={1}
          metalness={0}
          bumpMap={bump}
          bumpScale={0.5}
          onBeforeCompile={onBeforeCompile}
          customProgramCacheKey={() => 'sva-pitch-v14a'}
        />
      </mesh>
      {getWorldTier() === 'full' && <GrassShells map={map} />}
    </group>
  )
}

// ── Rasen-Schalen („Shell-Grass") ──────────────────────────────
// Nur in Kameranähe (Anstoß, Banden-Zoom, Fanblock): 7 dünne Lagen
// über dem Rasen, je Lage weniger Halme (Alpha-Maske aus der Detail-
// kachel) → echtes 3D-Gras mit Parallaxe und Wind statt Textur. Farbe
// kommt aus derselben Platztextur (Streifen, Abnutzung, Linien stimmen),
// unten dunkler (Halm-AO). Ein Instanced-Draw; das Patch (8,4 × 8,4)
// folgt der Kamera und ist ab Kamerahöhe 2,2 ganz aus. Wirft keinen
// Schatten (eigenes Depth-Material verwirft alles).
const SHELLS = 7
const SHELL_H = 0.011 // 11 cm Halmhöhe
const SHELL_R = 4.2

const SHELL_VERT_HEAD = /* glsl */ `
attribute float aLayer;
varying float vLayer;
varying vec3 vSW;
`
const SHELL_VERT_WORLD = /* glsl */ `
#include <worldpos_vertex>
vSW = (modelMatrix * instanceMatrix * vec4(transformed, 1.0)).xyz;
vLayer = aLayer;
`
const SHELL_FRAG_HEAD = /* glsl */ `
uniform sampler2D uGrassDetail;
uniform float uTime;
uniform float uShellR;
varying float vLayer;
varying vec3 vSW;
`
const SHELL_FRAG_MAP = /* glsl */ `
if (abs(vSW.x) > ${(MESH_W / 2 - 0.03).toFixed(3)} || abs(vSW.z) > ${(MESH_H / 2 - 0.03).toFixed(3)}) discard;
float sd = distance(cameraPosition.xz, vSW.xz);
float fadeR = smoothstep(uShellR * 0.95, uShellR * 0.4, sd);
vec2 wob = vec2(sin(uTime * 1.3 + vSW.z * 7.0), cos(uTime * 1.1 + vSW.x * 6.0)) * 0.0022 * vLayer;
vec2 q = vSW.xz + wob;
float m1 = texture2D(uGrassDetail, q * 11.0).r;
float m2 = texture2D(uGrassDetail, vec2(q.y, -q.x) * 6.3 + 0.21).b;
float mask = m1 * 0.6 + m2 * 0.4;
if (mask < mix(0.4, 0.78, vLayer) + (1.0 - fadeR) * 0.7) discard;
vec2 puv = vec2(vSW.x / ${MESH_W.toFixed(3)} + 0.5, 0.5 - vSW.z / ${MESH_H.toFixed(3)});
diffuseColor *= texture2D(map, puv);
diffuseColor.rgb *= mix(0.55, 1.04, vLayer) * (0.82 + mask * 0.3);
`

function GrassShells({ map }: { map: THREE.Texture }) {
  const mesh = useMemo(() => {
    const geo = new THREE.PlaneGeometry(SHELL_R * 2, SHELL_R * 2, 1, 1)
    geo.rotateX(-Math.PI / 2)
    const layers = new Float32Array(SHELLS).map((_, i) => (i + 1) / SHELLS)
    geo.setAttribute('aLayer', new THREE.InstancedBufferAttribute(layers, 1))
    const mat = new THREE.MeshLambertMaterial({ map })
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uGrassDetail = { value: getGrassDetailTexture() }
      shader.uniforms.uTime = forestUniforms.uTime
      shader.uniforms.uShellR = { value: SHELL_R }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\n' + SHELL_VERT_HEAD)
        .replace('#include <worldpos_vertex>', SHELL_VERT_WORLD)
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\n' + SHELL_FRAG_HEAD)
        .replace('#include <map_fragment>', SHELL_FRAG_MAP)
        // Lambert-Hemi wirkt auf den Halmen bläulicher als die IBL des
        // Rasens darunter → indirekt dämpfen, damit beide gleich lesen
        .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.indirectDiffuse *= 0.6;')
    }
    mat.customProgramCacheKey = () => 'sva-grass-shells-v14a'
    const m = new THREE.InstancedMesh(geo, mat, SHELLS)
    const t = new THREE.Matrix4()
    for (let i = 0; i < SHELLS; i++) m.setMatrixAt(i, t.makeTranslation(0, ((i + 1) / SHELLS) * SHELL_H, 0))
    m.instanceMatrix.needsUpdate = true
    m.frustumCulled = false
    // nie in die Schatten-Map (StaticShadows schaltet castShadow pauschal an)
    m.customDepthMaterial = new THREE.MeshDepthMaterial({ alphaTest: 2 })
    m.visible = false
    m.name = 'grassShells'
    return m
  }, [map])

  const ref = useRef<THREE.InstancedMesh>(null)
  const dir = useRef(new THREE.Vector3())
  useFrame(({ camera }) => {
    const m = ref.current
    if (!m) return
    const p = camera.position
    const near = p.y < 2.2 && Math.abs(p.x) < MESH_W / 2 + 3 && Math.abs(p.z) < MESH_H / 2 + 3
    m.visible = near
    if (!near) return
    const d = camera.getWorldDirection(dir.current)
    const h = Math.hypot(d.x, d.z) || 1
    m.position.set(p.x + (d.x / h) * SHELL_R * 0.55, 0, p.z + (d.z / h) * SHELL_R * 0.55)
  })

  return <primitive ref={ref} object={mesh} />
}
