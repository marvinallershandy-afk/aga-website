import { useMemo } from 'react'
import * as THREE from 'three'
import { GROUND_SIZE } from '../utils/constants'
import { fbm2, mulberry32, smoothstep } from '../three/proceduralNoise'
import { forestDepth } from '../three/forestLayout'
import { getGrassDetailTexture, GRASS_DETAIL_GLSL } from '../three/grassDetail'
import { getWorldTier } from '../three/qualityTier'

// ─────────────────────────────────────────────────────────────
// Umraum rund um den Platz. v14-A: statt einer einfarbigen Fläche
// eine gebackene Boden-Karte (Weltmaßstab, aus derselben Wald-SDF wie
// die Bäume — Stämme und Laubstreu liegen garantiert übereinander):
//  · ungemähte Wiese (olivgrün, fleckig) zwischen Reling und Waldrand
//  · Trampelpfad entlang der Reling (Nord = Zuschauerseite stärker),
//    Sandweg am Ost-Zaun, Kies-Zufahrt/Parkplatz NO, Pfad ins Dorf
//  · Waldboden unter den Bäumen: Laubstreu, Moosinseln, nach innen
//    dunkler — mit weichem Saum-Übergang (Altgras → Streu)
// Dazu die geteilte Gras-Detailkachel (Albedo + Bump) im Shader.
// Mobile: gleiche Karte, halb so groß gebacken. Weiterhin 1 Draw-Call.
// ─────────────────────────────────────────────────────────────

const EXTENT = GROUND_SIZE // gebackener Bereich ±30, dahinter Fog

// v14: Cache je Auflösung — Suspense-Retries beim Laden malten sonst mehrfach.
const groundCache = new Map<number, HTMLCanvasElement>()
function paintGround(res: number): HTMLCanvasElement {
  const hit = groundCache.get(res)
  if (hit) return hit
  const cv = paintGroundUncached(res)
  groundCache.set(res, cv)
  return cv
}

function paintGroundUncached(res: number): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = cv.height = res
  const ctx = cv.getContext('2d')!
  const S = res / EXTENT
  const tx = (x: number) => (x + EXTENT / 2) * S

  // 1) Grundfarben pro Pixel auf grobem Raster, weich hochskaliert
  const LR = 256
  const low = document.createElement('canvas')
  low.width = low.height = LR
  const lctx = low.getContext('2d')!
  const img = lctx.createImageData(LR, LR)
  const ls = LR / EXTENT
  for (let j = 0; j < LR; j++) {
    for (let i = 0; i < LR; i++) {
      const x = i / ls - EXTENT / 2
      const z = j / ls - EXTENT / 2
      const f = fbm2(x * 0.5 + 4.3, z * 0.5 - 2.1, 4, 41)
      const g = fbm2(x * 1.7, z * 1.7, 3, 57)
      // Wiese: Oliv bis sattgrün
      let r = 34 + f * 22 + g * 8
      let gg = 56 + f * 22 + g * 10
      let b = 26 + f * 8
      // Waldboden: Laubstreu (braun), Moosinseln, nach innen dunkler
      const d = forestDepth(x, z)
      const forest = smoothstep(-0.5, 0.9, d + (g - 0.5) * 0.9)
      const deep = smoothstep(0.5, 5, d)
      const moss = smoothstep(0.62, 0.78, g) * 0.6
      const fr = (58 - deep * 26) * (1 - moss) + 40 * moss
      const fg = (44 - deep * 20) * (1 - moss) + 52 * moss
      const fb = (30 - deep * 14) * (1 - moss) + 26 * moss
      r = r + (fr - r) * forest
      gg = gg + (fg - gg) * forest
      b = b + (fb - b) * forest
      const o = (j * LR + i) * 4
      img.data[o] = r
      img.data[o + 1] = gg
      img.data[o + 2] = b
      img.data[o + 3] = 255
    }
  }
  lctx.putImageData(img, 0, 0)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(low, 0, 0, res, res)

  const rng = mulberry32(2026)
  const blot = (x: number, z: number, r: number, color: string) => {
    const g = ctx.createRadialGradient(tx(x), tx(z), 0, tx(x), tx(z), r * S)
    g.addColorStop(0, color)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(tx(x) - r * S, tx(z) - r * S, r * S * 2, r * S * 2)
  }

  // 2) Trampelpfad rund um die Reling (±5.8/±3.95), Nord stärker
  for (let i = 0; i < 900; i++) {
    const side = rng()
    let x: number
    let z: number
    let a = 0.16
    if (side < 0.4) { x = -6 + rng() * 12; z = -4.2 - rng() * 0.35; a = 0.24 }      // Nord
    else if (side < 0.62) { x = -6 + rng() * 12; z = 4.15 + rng() * 0.3 }          // Süd
    else if (side < 0.81) { x = -6.05 - rng() * 0.3; z = -4 + rng() * 8 }         // West
    else { x = 6.05 + rng() * 0.3; z = -4 + rng() * 8 }                            // Ost
    blot(x, z, 0.06 + rng() * 0.14, 'rgba(92,80,56,' + a + ')')
  }
  // Sandweg am Ost-Zaun (zwischen Zaun und Vereinsheim)
  for (let i = 0; i < 260; i++) blot(6.25 + (rng() - 0.5) * 0.35, -3.6 + rng() * 6.2, 0.08 + rng() * 0.16, 'rgba(128,112,80,0.3)')
  // Fanblock-Ecke (SO): plattgetreten
  for (let i = 0; i < 160; i++) blot(2.5 + rng() * 2.8, 4.05 + rng() * 0.8, 0.06 + rng() * 0.16, 'rgba(84,70,48,0.28)')
  // Kies-Zufahrt + Parkplatz NO
  for (let i = 0; i < 380; i++) blot(8.2 + rng() * 4.5, -4.4 - rng() * 3.4, 0.1 + rng() * 0.25, 'rgba(96,94,88,0.3)')
  // Pfad ins Dorf (Nord) + Weg zur Klinker-Hütte
  for (let i = 0; i < 200; i++) blot(-0.4 + (rng() - 0.5) * 0.5, -4.4 - rng() * 4, 0.08 + rng() * 0.14, 'rgba(90,80,58,0.24)')
  for (let i = 0; i < 90; i++) {
    const t = rng()
    blot(-4.6 + t * 3.8 + (rng() - 0.5) * 0.3, -4.5 + t * 0.2, 0.07 + rng() * 0.1, 'rgba(90,80,58,0.22)')
  }

  // 3) Laubstreu-Sprenkel + Zweige im Wald, Altgras-Halme am Saum
  for (let i = 0; i < 26000; i++) {
    const x = -20 + rng() * 40
    const z = -12 + rng() * 30
    const d = forestDepth(x, z)
    if (d < -0.6) continue
    const px = tx(x)
    const pz = tx(z)
    if (d < 0.6) {
      // Saum: helle, lange Altgras-Striche
      const l = 80 + rng() * 60
      ctx.strokeStyle = 'rgba(' + l + ',' + (l + 10) + ',' + (l * 0.55) + ',0.35)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(px, pz)
      ctx.lineTo(px + (rng() - 0.5) * 3, pz - 2 - rng() * 4)
      ctx.stroke()
    } else {
      // Laub: kleine warme/kalte Blattflecken, ab und zu ein Zweig
      const warm = rng() < 0.6
      ctx.fillStyle = warm
        ? 'rgba(' + (90 + rng() * 40) + ',' + (60 + rng() * 25) + ',' + (34 + rng() * 14) + ',0.35)'
        : 'rgba(20,18,14,0.35)'
      ctx.fillRect(px, pz, 1 + rng() * 2, 1 + rng() * 1.5)
      if (rng() < 0.03) {
        ctx.strokeStyle = 'rgba(40,30,22,0.5)'
        ctx.beginPath()
        ctx.moveTo(px, pz)
        ctx.lineTo(px + (rng() - 0.5) * 9, pz + (rng() - 0.5) * 9)
        ctx.stroke()
      }
    }
  }
  return cv
}

const VERT_HEAD = /* glsl */ `
varying vec3 vGW;
`
const VERT_WORLD = /* glsl */ `
#include <worldpos_vertex>
vGW = (modelMatrix * vec4(transformed, 1.0)).xyz;
`
const FRAG_HEAD = /* glsl */ `
uniform sampler2D uGrassDetail;
varying vec3 vGW;
${GRASS_DETAIL_GLSL}
`
const FRAG_MAP = /* glsl */ `
#include <map_fragment>
diffuseColor.rgb *= grassDetail(vGW.xz * 0.8, length(cameraPosition - vGW));
`

export function Ground() {
  const reduced = getWorldTier() === 'reduced'
  const { map, bump } = useMemo(() => {
    const cv = paintGround(reduced ? 1024 : 2048)
    const map = new THREE.CanvasTexture(cv)
    map.colorSpace = THREE.SRGBColorSpace
    map.anisotropy = 4
    const bump = getGrassDetailTexture().clone()
    bump.repeat.set(EXTENT * 2.3, EXTENT * 2.3)
    bump.needsUpdate = true
    return { map, bump }
  }, [reduced])

  const onBeforeCompile = useMemo(
    () => (shader: THREE.WebGLProgramParametersWithUniforms) => {
      shader.uniforms.uGrassDetail = { value: getGrassDetailTexture() }
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
    <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
      <planeGeometry args={[EXTENT, EXTENT]} />
      <meshStandardMaterial
        map={map}
        bumpMap={bump}
        bumpScale={0.7}
        roughness={1}
        metalness={0}
        onBeforeCompile={onBeforeCompile}
        customProgramCacheKey={() => 'sva-ground-v14a'}
      />
    </mesh>
  )
}
