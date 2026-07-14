import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// v14-E3 „Himmel mit Tiefe": Der 2px-Verlauf (Banding, null Struktur)
// wird eine echte Dome-Textur — geditherter Verlauf, ein zarter
// Milchstraßen-Schleier, leichte Horizont-Variation. Dazu ein
// instanziertes Sternenfeld (ein Points-Draw-Call) mit per-Stern-
// Twinkle im Shader. Stilisierz bleibt: Nachtblau → warmer Horizont.
// ─────────────────────────────────────────────────────────────

function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function makeSkyTexture(): THREE.CanvasTexture {
  const W = 512
  const H = 256
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  const g = ctx.createLinearGradient(0, 0, 0, H)
  // v13-F1-Stops beibehalten (Zenit bewusst geöffnet)
  g.addColorStop(0.0, '#0e1224')
  g.addColorStop(0.35, '#1a2038')
  g.addColorStop(0.6, '#2c2340')
  g.addColorStop(0.8, '#5a3a3a')
  g.addColorStop(0.92, '#3a2622')
  g.addColorStop(1.0, '#181018')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H)

  const rng = mulberry32(1949)

  // Milchstraßen-Schleier: eine flache Diagonale aus weichen, fast
  // unsichtbaren Nebel-Blobs im oberen Drittel (liest als Tiefe, nicht
  // als Motiv). Zwei Knoten etwas heller.
  for (let i = 0; i < 90; i++) {
    const t = i / 90
    const x = t * W
    const y = H * (0.1 + 0.14 * Math.sin(t * Math.PI * 1.15 + 0.4)) + (rng() - 0.5) * 16
    const r = 12 + rng() * 26
    const a = 0.012 + rng() * 0.02 + (i % 23 === 0 ? 0.02 : 0)
    const bg = ctx.createRadialGradient(x, y, 0, x, y, r)
    bg.addColorStop(0, `rgba(196,206,236,${a})`)
    bg.addColorStop(1, 'rgba(196,206,236,0)')
    ctx.fillStyle = bg
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  // Horizont-Leben: zwei sehr zurückhaltende warme Aufhellungen
  // (Dorf-Restlicht) statt eines perfekt gleichmäßigen Bands
  for (const [tx, s] of [[0.22, 1], [0.71, 0.8]] as const) {
    const hg = ctx.createRadialGradient(tx * W, H * 0.9, 4, tx * W, H * 0.9, 70 * s)
    hg.addColorStop(0, 'rgba(255,166,96,0.05)')
    hg.addColorStop(1, 'rgba(255,166,96,0)')
    ctx.fillStyle = hg
    ctx.fillRect(0, 0, W, H)
  }

  // Dithering gegen Banding: ±2 Zufallsrauschen auf jedem Pixel
  const img = ctx.getImageData(0, 0, W, H)
  const d = img.data
  for (let p = 0; p < d.length; p += 4) {
    const n = (rng() - 0.5) * 4.5
    d[p] += n
    d[p + 1] += n
    d[p + 2] += n
  }
  ctx.putImageData(img, 0, 0)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Sternenfeld: obere Halbkugel, per-Stern Größe/Phase, Twinkle im
// Shader — 1 Draw-Call, kein CPU-Update pro Frame.
const STAR_VERT = /* glsl */ `
  attribute float aSize;
  attribute float aPhase;
  uniform float uTime;
  uniform float uPx;
  varying float vAlpha;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    float tw = 0.65 + 0.35 * sin(uTime * (0.4 + fract(aPhase * 7.13) * 1.4) + aPhase * 40.0);
    vAlpha = tw;
    // uPx: gl_PointSize ist in Geräte-Pixeln — ohne DPR-Skalierung
    // schrumpfen die Sterne auf Retina-Handys auf Subpixel.
    gl_PointSize = aSize * tw * uPx;
    gl_Position = projectionMatrix * mv;
  }
`
const STAR_FRAG = /* glsl */ `
  varying float vAlpha;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    float a = smoothstep(0.5, 0.12, d) * vAlpha;
    gl_FragColor = vec4(vec3(0.82, 0.87, 1.0) * a, a);
  }
`

function Stars() {
  const matRef = useRef<THREE.ShaderMaterial>(null)
  const geo = useMemo(() => {
    const N = 380
    const rng = mulberry32(20260714)
    const pos = new Float32Array(N * 3)
    const size = new Float32Array(N)
    const phase = new Float32Array(N)
    for (let i = 0; i < N; i++) {
      // obere Kalotte: Elevation 12°–88° (unten bleibt der warme Horizont frei)
      const el = (12 + rng() * 76) * (Math.PI / 180)
      const az = rng() * Math.PI * 2
      const r = 86
      pos[i * 3] = Math.cos(el) * Math.cos(az) * r
      pos[i * 3 + 1] = Math.sin(el) * r
      pos[i * 3 + 2] = Math.cos(el) * Math.sin(az) * r
      size[i] = 1.4 + rng() * 2.6 + (rng() > 0.94 ? 1.8 : 0)
      phase[i] = rng()
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    g.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    g.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1))
    return g
  }, [])
  useFrame((state) => {
    if (!matRef.current) return
    matRef.current.uniforms.uTime.value = state.clock.elapsedTime
    matRef.current.uniforms.uPx.value = state.gl.getPixelRatio()
  })
  return (
    <points geometry={geo} frustumCulled={false}>
      <shaderMaterial
        ref={matRef}
        vertexShader={STAR_VERT}
        fragmentShader={STAR_FRAG}
        uniforms={{ uTime: { value: 0 }, uPx: { value: 1 } }}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export function SkyGradient() {
  const texture = useMemo(() => makeSkyTexture(), [])
  return (
    <group>
      <mesh>
        <sphereGeometry args={[90, 32, 20]} />
        <meshBasicMaterial map={texture} side={THREE.BackSide} depthWrite={false} fog={false} />
      </mesh>
      <Stars />
    </group>
  )
}
