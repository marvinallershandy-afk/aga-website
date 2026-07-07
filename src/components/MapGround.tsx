import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { cameraState } from '../camera/CameraPath'
import { COLORS } from '../utils/constants'

// ─────────────────────────────────────────────────────────────
// E5-Finale: Maps-Rauszoom. Am Ende (u→1) legt sich eine flache,
// stilisierte 2D-Karten-Fläche um den Platz — Straßen, Waldflächen,
// die Zufahrt „Zur Mehrzweckhalle", Ortslabel Agathenburg — in
// SVA-Nacht-Optik (Google-Maps-Anmutung, KEIN Live-Tile-Dienst).
// Der 3D-Platz + Vereinsheim bleiben das plastische Zentrum, alles
// drumherum wird zur Karte → „der Verein als Punkt in Agathenburg".
// Reine Funktion von cameraState.u; unter der Rasenkante (y=−0.012),
// also nur AUSSERHALB des Platzes sichtbar. Fallback: kein 3D → egal.
// ─────────────────────────────────────────────────────────────

const SIZE = 46
const FADE_START = 0.84
const FADE_SPAN = 0.12

function makeMapTexture(): THREE.CanvasTexture {
  const N = 1024
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const ctx = cv.getContext('2d')!
  const c = N / 2

  // Nacht-Basis
  ctx.fillStyle = '#0d130e'
  ctx.fillRect(0, 0, N, N)

  // Waldflächen (S/W/O dicht, N offen — wie real). Weiche Blobs.
  ctx.fillStyle = '#16251a'
  const forest = (x: number, y: number, r: number) => {
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  forest(c - 300, c + 260, 240); forest(c + 260, c + 300, 260)
  forest(c + 330, c - 40, 220); forest(c - 330, c - 40, 200)
  forest(c - 120, c + 360, 200); forest(c + 120, c + 360, 200)

  // Felder (gedämpftes Grün) im Norden
  ctx.fillStyle = '#12261a'
  ctx.fillRect(c - 360, 40, 720, 230)

  // Bach (blaugrau) von NW nach SO
  ctx.strokeStyle = '#26424e'
  ctx.lineWidth = 10
  ctx.beginPath()
  ctx.moveTo(60, 120); ctx.bezierCurveTo(300, 300, 260, 520, 520, 640)
  ctx.bezierCurveTo(760, 760, 820, 900, 980, 980)
  ctx.stroke()

  // Straßen: Hauptzufahrt „Zur Mehrzweckhalle" von SW zum Platz + Ortsstraße N
  const road = (pts: number[][], w: number) => {
    ctx.strokeStyle = '#33343a'; ctx.lineWidth = w
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
    // Mittellinie
    ctx.strokeStyle = '#54555c'; ctx.lineWidth = Math.max(1, w * 0.12)
    ctx.setLineDash([10, 12]); ctx.stroke(); ctx.setLineDash([])
  }
  road([[40, 980], [260, 840], [430, 700], [c - 40, c + 120], [c, c + 30]], 20)
  road([[c - 360, 150], [c - 120, 175], [c + 140, 165], [c + 380, 190]], 16)
  road([[c, c + 30], [c + 180, c - 60], [c + 360, c - 120]], 12)

  // Der Platz als leichte Rasenfläche mit Umriss (der echte 3D-Platz
  // deckt das später — sorgt für sauberen Fade-in-Moment).
  ctx.fillStyle = '#1e3a20'
  ctx.strokeStyle = 'rgba(242,245,248,0.5)'
  ctx.lineWidth = 3
  const pw = 244, ph = 158
  roundRect(ctx, c - pw / 2, c - ph / 2, pw, ph, 8)
  ctx.fill(); ctx.stroke()

  // Ortslabel + Straßenname
  ctx.fillStyle = 'rgba(226,226,224,0.82)'
  ctx.textAlign = 'center'
  ctx.font = '700 34px Archivo, system-ui, sans-serif'
  ctx.fillText('AGATHENBURG', c, 110)
  ctx.fillStyle = 'rgba(200,205,210,0.6)'
  ctx.font = '600 20px Archivo, system-ui, sans-serif'
  ctx.fillText('Waldsportplatz', c, c + ph / 2 + 34)
  ctx.save()
  ctx.translate(300, 800); ctx.rotate(-0.6)
  ctx.fillStyle = 'rgba(180,185,190,0.55)'
  ctx.font = '600 16px Archivo, system-ui, sans-serif'
  ctx.fillText('Zur Mehrzweckhalle', 0, 0)
  ctx.restore()

  // SVA-roter Akzent-Ring am Platz-Mittelpunkt (Karten-Pin-Fuß)
  ctx.strokeStyle = COLORS.red; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(c, c, 20, 0, Math.PI * 2); ctx.stroke()

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function MapGround() {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const group = useRef<THREE.Group>(null)
  const tex = useMemo(() => makeMapTexture(), [])

  useFrame(() => {
    const vis = THREE.MathUtils.clamp((cameraState.u - FADE_START) / FADE_SPAN, 0, 1)
    if (group.current) group.current.visible = vis > 0.002
    if (mat.current) mat.current.opacity = vis
  })

  return (
    <group ref={group} visible={false}>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.012, 0]}>
        <planeGeometry args={[SIZE, SIZE]} />
        <meshBasicMaterial ref={mat} map={tex} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}
