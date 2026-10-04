import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PITCH, APRON } from '../utils/constants'
import { forestUniforms } from '../three/forestMaterial'
import { getWorldTier } from '../three/qualityTier'
import { fbm2, mulberry32 } from '../three/proceduralNoise'
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

const MESH_W = PITCH.width + APRON * 2   // 11.3 (113 m inkl. Auslauf)
const MESH_H = PITCH.height + APRON * 2  // 7.6
// v5.5 („Fotomaterial statt nachgebaut"): 2048 statt 1024 — die Kamera
// kommt bis auf ~5 m an den Rasen, 1024px/113m waren das 480p-Gefühl.
const TEX_W = 2048
const S = TEX_W / MESH_W                 // px pro Welt-Einheit
const TEX_H = Math.round(MESH_H * S)

const LINE = 0.022 * S                   // Linienbreite (leicht überzeichnet für Lesbarkeit)
const STRIPE_W = PITCH.width / 18        // 5,8 m Mähbahn, Kante auf der Mittellinie

// Feld-Koordinaten (Ursprung Mitte) → Canvas-Pixel
const px = (x: number) => (x + MESH_W / 2) * S
const py = (z: number) => (z + MESH_H / 2) * S

/** Viele kleine, unregelmäßige Flecken um ein Zentrum (Gauß-verteilt) */
function blotches(
  ctx: CanvasRenderingContext2D,
  rng: () => number,
  cx: number, cz: number, sx: number, sz: number,
  count: number, rMin: number, rMax: number,
  color: (t: number) => string,
) {
  for (let i = 0; i < count; i++) {
    // Box-Muller (grob) → dichter Kern, ausfransender Rand
    const u = Math.max(1e-6, rng())
    const v = rng()
    const m = Math.sqrt(-2 * Math.log(u))
    const gx = m * Math.cos(2 * Math.PI * v)
    const gz = m * Math.sin(2 * Math.PI * v)
    const wx = cx + gx * sx
    const wz = cz + gz * sz
    const t = Math.min(1, Math.hypot(gx, gz) / 2.2) // 0 Kern … 1 Rand
    const r = (rMin + rng() * (rMax - rMin)) * S
    const g = ctx.createRadialGradient(px(wx), py(wz), 0, px(wx), py(wz), r)
    g.addColorStop(0, color(t))
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(px(wx) - r, py(wz) - r, r * 2, r * 2)
  }
}

function paintGrass(ctx: CanvasRenderingContext2D, rough?: CanvasRenderingContext2D) {
  const rng = mulberry32(7)

  // Mähstreifen: Bahnkanten auf Vielfachen von STRIPE_W ab der Mittellinie.
  // Gebackener Kontrast bewusst klein — den Rest macht der Blickwinkel.
  for (let k = -10; k <= 10; k++) {
    const x0 = px(k * STRIPE_W)
    const even = ((k % 2) + 2) % 2 === 0
    ctx.fillStyle = even ? '#2c5f27' : '#285a24'
    ctx.fillRect(x0, 0, STRIPE_W * S + 1, TEX_H)
    if (rough) {
      rough.fillStyle = even ? 'rgb(238,238,238)' : 'rgb(226,226,226)'
      rough.fillRect(x0, 0, STRIPE_W * S + 1, TEX_H)
    }
  }

  // Großflächige Feucht-/Trockenflecken: fbm auf grobem Raster, weich
  // hochskaliert (bilinear) — gelblich-trockene Inseln, satte Mulden.
  {
    const LW = 226
    const LH = 152
    const low = document.createElement('canvas')
    low.width = LW
    low.height = LH
    const lctx = low.getContext('2d')!
    const img = lctx.createImageData(LW, LH)
    for (let j = 0; j < LH; j++) {
      for (let i = 0; i < LW; i++) {
        const wx = (i / LW) * MESH_W - MESH_W / 2
        const wz = (j / LH) * MESH_H - MESH_H / 2
        const f = fbm2(wx * 0.42 + 3.1, wz * 0.42 - 1.7, 4, 11)
        const g = fbm2(wx * 1.3 - 7.0, wz * 1.3 + 2.0, 3, 23)
        const o = (j * LW + i) * 4
        if (f > 0.5) {
          // trocken: Gelb-Oliv
          const a = Math.min(1, Math.max(0, (f - 0.53) / 0.2)) * (0.16 + g * 0.12)
          img.data[o] = 150; img.data[o + 1] = 142; img.data[o + 2] = 62
          img.data[o + 3] = Math.round(a * 255)
        } else {
          // feucht/satt: tiefes Blaugrün
          const a = Math.min(1, Math.max(0, (0.47 - f) / 0.2)) * (0.18 + g * 0.12)
          img.data[o] = 12; img.data[o + 1] = 40; img.data[o + 2] = 22
          img.data[o + 3] = Math.round(a * 255)
        }
      }
    }
    lctx.putImageData(img, 0, 0)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(low, 0, 0, TEX_W, TEX_H)
  }

  // Abnutzung — wo wirklich gespielt wird:
  const hw = PITCH.width / 2
  const soil = (a: number) => (t: number) => 'rgba(' + (96 - t * 10) + ',' + (78 + t * 14) + ',' + (50 + t * 2) + ',' + (a * (1 - t * 0.6)).toFixed(3) + ')'
  const yellowed = (a: number) => (t: number) => 'rgba(120,118,60,' + (a * (1 - t * 0.5)).toFixed(3) + ')'
  for (const s of [-1, 1]) {
    const gx = s * hw
    // Torraum: Torwart-Zone direkt vor der Linie ist fast nackte Erde
    blotches(ctx, rng, gx - s * 0.1, 0, 0.1, 0.22, 140, 0.02, 0.07, soil(0.5))
    blotches(ctx, rng, gx - s * 0.32, 0, 0.22, 0.38, 160, 0.03, 0.1, yellowed(0.22))
    // Elfmeterpunkt: kahler Fleck
    blotches(ctx, rng, gx - s * 1.1, 0, 0.035, 0.035, 26, 0.012, 0.035, soil(0.55))
    // Strafraum-Zentrum: ausgedünnt
    blotches(ctx, rng, gx - s * 0.9, 0, 0.45, 0.6, 90, 0.05, 0.14, yellowed(0.12))
    // Eckstoß-Punkte
    for (const zs of [-1, 1]) blotches(ctx, rng, gx - s * 0.06, zs * (PITCH.height / 2 - 0.06), 0.04, 0.04, 14, 0.015, 0.04, soil(0.35))
  }
  // Anstoßpunkt + Mittelkreis-Zentrum
  blotches(ctx, rng, 0, 0, 0.05, 0.05, 30, 0.012, 0.04, soil(0.5))
  blotches(ctx, rng, 0, 0, 0.5, 0.42, 120, 0.04, 0.12, yellowed(0.12))
  // Linienrichter-Spur außen an der Nord-Seitenlinie (Zuschauerseite)
  for (let i = 0; i < 260; i++) {
    const wx = -hw * 0.95 + rng() * hw * 1.9
    const wz = -PITCH.height / 2 - 0.11 + (rng() - 0.5) * 0.08
    const r = (0.015 + rng() * 0.035) * S
    const g = ctx.createRadialGradient(px(wx), py(wz), 0, px(wx), py(wz), r)
    g.addColorStop(0, 'rgba(110,100,62,0.22)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(px(wx) - r, py(wz) - r, r * 2, r * 2)
  }
  if (rough) {
    // Erde ist matter als Halme
    rough.fillStyle = 'rgba(255,255,255,0.5)'
    for (const s of [-1, 1]) rough.fillRect(px(s * hw - (s > 0 ? 0.3 : 0)), py(-0.4), 0.3 * S, 0.8 * S)
  }

  // Halm-Struktur (v5.5): kurze, leicht schräge Grashalm-Striche in
  // zwei Tönen — bei Kamera-Nähe liest die Fläche als Rasen, nicht
  // als Farbe. ~40k Striche, einmalig beim Baken.
  ctx.lineWidth = 1
  for (let i = 0; i < 40000; i++) {
    const x = rng() * TEX_W
    const y = rng() * TEX_H
    const len = 2 + rng() * 4
    const ang = -Math.PI / 2 + (rng() - 0.5) * 0.7
    const bright = rng() > 0.5
    ctx.strokeStyle = bright
      ? `rgba(${90 + rng() * 40}, ${140 + rng() * 40}, ${60 + rng() * 30}, 0.16)`
      : `rgba(${10 + rng() * 14}, ${34 + rng() * 18}, ${10 + rng() * 12}, 0.2)`
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len)
    ctx.stroke()
  }

  // Tau-Glitzer (Referenzframe-Messlatte): vereinzelte helle Punkte
  for (let i = 0; i < 2600; i++) {
    const x = rng() * TEX_W
    const y = rng() * TEX_H
    ctx.fillStyle = `rgba(220,235,240,${0.05 + rng() * 0.12})`
    ctx.fillRect(x, y, 1, 1)
  }

  // Feine Körnung
  const img = ctx.getImageData(0, 0, TEX_W, TEX_H)
  const d = img.data
  for (let p = 0; p < d.length; p += 4) {
    const n = ((Math.sin(p * 12.9898) * 43758.5453) % 1) * 11 - 5.5
    d[p] += n
    d[p + 1] += n
    d[p + 2] += n
  }
  ctx.putImageData(img, 0, 0)
}

// Rand des Meshes weich in die Umraum-Wiese (Ground) auslaufen lassen
function paintApronFade(ctx: CanvasRenderingContext2D) {
  const w = 0.16 * S
  const col = (a: number) => 'rgba(36,60,30,' + a + ')'
  const edges: [number, number, number, number, number, number, number, number][] = [
    [0, 0, TEX_W, w, 0, 0, 0, w],                // Nord
    [0, TEX_H - w, TEX_W, w, 0, TEX_H, 0, TEX_H - w], // Süd
    [0, 0, w, TEX_H, 0, 0, w, 0],                // West
    [TEX_W - w, 0, w, TEX_H, TEX_W, 0, TEX_W - w, 0], // Ost
  ]
  for (const [x, y, ww, hh, gx0, gy0, gx1, gy1] of edges) {
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1)
    g.addColorStop(0, col(0.75))
    g.addColorStop(1, col(0))
    ctx.fillStyle = g
    ctx.fillRect(x, y, ww, hh)
  }
}

function paintMarkings(ctx: CanvasRenderingContext2D, rough?: CanvasRenderingContext2D) {
  const hw = PITCH.width / 2
  const hh = PITCH.height / 2

  const targets = rough ? [ctx, rough] : [ctx]
  for (const c of targets) {
    c.strokeStyle = c === ctx ? 'rgba(240,244,248,0.92)' : 'rgb(205,205,205)'
    c.fillStyle = c.strokeStyle
    c.lineWidth = LINE
    c.lineJoin = 'round'

    // Außenlinien
    c.strokeRect(px(-hw), py(-hh), PITCH.width * S, PITCH.height * S)
    // Mittellinie
    c.beginPath(); c.moveTo(px(0), py(-hh)); c.lineTo(px(0), py(hh)); c.stroke()
    // Mittelkreis + Anstoßpunkt
    c.beginPath(); c.arc(px(0), py(0), PITCH.centerRadius * S, 0, Math.PI * 2); c.stroke()
    c.beginPath(); c.arc(px(0), py(0), 0.035 * S, 0, Math.PI * 2); c.fill()

    for (const s of [-1, 1]) {
      const gx = s * hw
      const inw = (d: number) => gx - s * d // Distanz von der Torlinie ins Feld

      // Strafraum (16,5 m tief, 40,32 m breit)
      const pw = PITCH.penaltyWidth / 2
      c.strokeRect(
        Math.min(px(gx), px(inw(PITCH.penaltyDepth))), py(-pw),
        PITCH.penaltyDepth * S, PITCH.penaltyWidth * S,
      )
      // Torraum (5,5 m / 18,32 m)
      const gw = PITCH.goalAreaWidth / 2
      c.strokeRect(
        Math.min(px(gx), px(inw(PITCH.goalAreaDepth))), py(-gw),
        PITCH.goalAreaDepth * S, PITCH.goalAreaWidth * S,
      )
      // Elfmeterpunkt (11 m)
      const spotX = inw(1.1)
      c.beginPath(); c.arc(px(spotX), py(0), 0.03 * S, 0, Math.PI * 2); c.fill()
      // Strafraum-Bogen (r 9,15 m um den Punkt, nur außerhalb des Strafraums)
      c.save()
      const clipX = px(inw(PITCH.penaltyDepth))
      c.beginPath()
      if (s > 0) c.rect(0, 0, clipX, TEX_H)
      else c.rect(clipX, 0, TEX_W - clipX, TEX_H)
      c.clip()
      c.beginPath(); c.arc(px(spotX), py(0), PITCH.centerRadius * S, 0, Math.PI * 2); c.stroke()
      c.restore()
      // Eckbögen (1 m)
      for (const zs of [-1, 1]) {
        c.beginPath()
        c.arc(px(gx), py(zs * hh), 0.1 * S, 0, Math.PI * 2)
        c.stroke()
      }
    }
  }
}

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
let pitchTexCache: { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture; bump: THREE.Texture } | null = null
function getPitchTextures() {
  if (pitchTexCache) return pitchTexCache
  pitchTexCache = buildPitchTextures()
  return pitchTexCache
}

function buildPitchTextures() {
  {
    const cv = document.createElement('canvas')
    cv.width = TEX_W; cv.height = TEX_H
    const ctx = cv.getContext('2d')!
    const rcv = document.createElement('canvas')
    rcv.width = TEX_W; rcv.height = TEX_H
    const rctx = rcv.getContext('2d')!

    paintGrass(ctx, rctx)
    paintApronFade(ctx)
    paintMarkings(ctx, rctx)

    const map = new THREE.CanvasTexture(cv)
    map.colorSpace = THREE.SRGBColorSpace
    // v5.5: 4× Anisotropie (8 kostete die vsync-Kante mit voller Kette;
    // 4 behebt den Tiefen-Matsch bereits sichtbar)
    map.anisotropy = 4
    // v14-E3: roughnessMap kommt zurück — aber auf 512px runtergerechnet.
    // Die volle 2048er-Probe pro Fragment war das Frametime-Problem (v5.5);
    // bei 512 ist die Probe cache-freundlich und die Mähstreifen bekommen
    // unter IBL/Mond wieder unterschiedlichen Glanz (Tiefe statt Farbfläche).
    const rSmall = document.createElement('canvas')
    rSmall.width = 512
    rSmall.height = Math.round(512 * (TEX_H / TEX_W))
    rSmall.getContext('2d')!.drawImage(rcv, 0, 0, rSmall.width, rSmall.height)
    const roughnessMap = new THREE.CanvasTexture(rSmall)
    // Bump aus der Detailkachel, in Weltmaßstab über die UVs gelegt
    const bump = getGrassDetailTexture().clone()
    bump.repeat.set(MESH_W * 2.9, MESH_H * 2.9)
    bump.needsUpdate = true
    return { map, roughnessMap, bump }
  }
}

export function Pitch() {
  const { map, roughnessMap, bump } = getPitchTextures()

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
