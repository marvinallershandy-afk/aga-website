import { useEffect, useMemo, useRef, useState } from 'react'
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

const SIZE = 62 // v11-E8: größere flache Karte → Platz wird zum Solitär
const FADE_START = 0.84
const FADE_SPAN = 0.12

// v13-K7: Straßen, Parkplatz, Platz-Umriss, Labels + Pin-Ring — geteilt
// zwischen gezeichneter Fallback-Karte und dem Luftbild-Layer (die Labels
// und die Zufahrt sind die Verortungs-Anker der Karte).
function drawMapOverlays(ctx: CanvasRenderingContext2D, c: number) {
  const road = (pts: number[][], w: number) => {
    ctx.strokeStyle = '#33343a'; ctx.lineWidth = w
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1])
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1])
    ctx.stroke()
    ctx.strokeStyle = '#54555c'; ctx.lineWidth = Math.max(1, w * 0.12)
    ctx.setLineDash([10, 12]); ctx.stroke(); ctx.setLineDash([])
  }
  // Zufahrt „Zur Mehrzweckhalle" → Parkplatz SO; Platz bleibt frei.
  road([[40, 980], [220, 880], [430, 760], [610, 690], [700, 662]], 20)
  road([[700, 662], [760, 560], [850, 470]], 12)
  ctx.fillStyle = '#2a2b30'
  roundRect(ctx, 660, 636, 96, 60, 6)
  ctx.fill()

  // Platz-Fußabdruck (der echte 3D-Platz deckt das — sauberer Fade-in)
  ctx.fillStyle = '#1e3a20'
  ctx.strokeStyle = 'rgba(242,245,248,0.5)'
  ctx.lineWidth = 3
  const pw = 244, ph = 158
  roundRect(ctx, c - pw / 2, c - ph / 2, pw, ph, 8)
  ctx.fill(); ctx.stroke()

  ctx.fillStyle = 'rgba(230,230,228,0.9)'
  ctx.textAlign = 'center'
  ctx.shadowColor = 'rgba(0,0,0,0.9)'
  ctx.shadowBlur = 8
  ctx.font = '800 42px Archivo, system-ui, sans-serif'
  ctx.fillText('AGATHENBURG', c, 104)
  ctx.fillStyle = 'rgba(238,240,242,0.92)'
  ctx.font = '800 30px Archivo, system-ui, sans-serif'
  ctx.fillText('Waldsportplatz', c, c + ph / 2 + 42)
  ctx.save()
  ctx.translate(250, 820); ctx.rotate(-0.55)
  ctx.fillStyle = 'rgba(190,195,200,0.7)'
  ctx.font = '700 20px Archivo, system-ui, sans-serif'
  ctx.fillText('Zur Mehrzweckhalle', 0, 0)
  ctx.restore()
  ctx.shadowBlur = 0

  ctx.strokeStyle = COLORS.red; ctx.lineWidth = 4
  ctx.beginPath(); ctx.arc(c, c, 20, 0, Math.PI * 2); ctx.stroke()
}

function makeMapTexture(): THREE.CanvasTexture {
  // v11-E8: doppelte Canvas-Auflösung (2048), Zeichnung bleibt im 1024-Logik-
  // raum (ctx.scale) → „Waldsportplatz" & Co. gestochen scharf beim Rauszoom.
  const L = 1024 // Logik-Raum
  const N = 2048 // echte Pixel
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const ctx = cv.getContext('2d')!
  ctx.scale(N / L, N / L)
  const c = L / 2

  // Nacht-Basis
  ctx.fillStyle = '#0d130e'
  ctx.fillRect(0, 0, L, L)

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

  drawMapOverlays(ctx, c)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16
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

// v13-K7: Das Finale bekommt ein ECHTES Nacht-Luftbild (Higgsfield-Generat
// nach Referenz-Layout: Platz-Lichtung im Wald, Dorf im Norden, Bahnlinie
// NO — public/map-aerial.webp). Das Bild wird zur Karten-Textur:
// Pitch-Zentrum weich mit Waldton überdeckt (dort steht das echte 3D-Feld),
// Außenkanten zu Transparent ausgeblendet, dezente Labels obendrauf.
// Die gezeichnete Karte bleibt Fallback, bis das Bild geladen ist.
function makeAerialTexture(img: HTMLImageElement): THREE.CanvasTexture {
  const N = 1024
  const cv = document.createElement('canvas')
  cv.width = cv.height = N
  const ctx = cv.getContext('2d')!
  ctx.drawImage(img, 0, 0, N, N)
  // Aufhellen: gegen den schwarzen Seitenhintergrund war das Nacht-Bild
  // zu leise — ein kühler Screen-Lift macht Wald/Dorf lesbar.
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = 'rgba(64,84,104,0.22)'
  ctx.fillRect(0, 0, N, N)
  ctx.globalCompositeOperation = 'source-over'
  // Zentrum abdecken: das generierte Flutlicht-Feld ist ~2× so groß wie
  // das echte 3D-Feld darüber → weicher Wald-Verlauf statt Doppel-Platz.
  const g = ctx.createRadialGradient(N / 2, N / 2, 60, N / 2, N / 2, 265)
  g.addColorStop(0, 'rgba(18,26,21,1)')
  g.addColorStop(0.78, 'rgba(18,26,21,0.96)')
  g.addColorStop(1, 'rgba(18,26,21,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, N, N)
  // Außenkanten auflösen (kein harter Karten-Rand im Rauszoom)
  const edge = 70
  ctx.globalCompositeOperation = 'destination-out'
  for (const dir of ['top', 'bottom', 'left', 'right'] as const) {
    const lg =
      dir === 'top' ? ctx.createLinearGradient(0, 0, 0, edge)
      : dir === 'bottom' ? ctx.createLinearGradient(0, N, 0, N - edge)
      : dir === 'left' ? ctx.createLinearGradient(0, 0, edge, 0)
      : ctx.createLinearGradient(N, 0, N - edge, 0)
    lg.addColorStop(0, 'rgba(0,0,0,1)')
    lg.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = lg
    if (dir === 'top') ctx.fillRect(0, 0, N, edge)
    else if (dir === 'bottom') ctx.fillRect(0, N - edge, N, edge)
    else if (dir === 'left') ctx.fillRect(0, 0, edge, N)
    else ctx.fillRect(N - edge, 0, edge, N)
  }
  ctx.globalCompositeOperation = 'source-over'
  // Verortungs-Anker (Straßen + Labels + Pin) über das Luftbild
  drawMapOverlays(ctx, N / 2)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function MapGround() {
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  const group = useRef<THREE.Group>(null)
  const fallbackTex = useMemo(() => makeMapTexture(), [])
  const [aerialTex, setAerialTex] = useState<THREE.CanvasTexture | null>(null)
  useEffect(() => {
    const img = new Image()
    img.onload = () => setAerialTex(makeAerialTexture(img))
    img.src = '/map-aerial.webp'
  }, [])
  const tex = aerialTex ?? fallbackTex

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
