import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH, APRON } from '../utils/constants'

// ─────────────────────────────────────────────────────────────
// Der Rasen als EIN Mesh mit prozeduraler Textur: Mähstreifen,
// Körnung, Abnutzung UND alle Spielfeldmarkierungen maßstabsgetreu
// gebacken (105×68 m, Linienbreite ~12 cm skaliert, Mittelkreis
// 9,15 m, Strafraum 16,5 m, Fünfmeterraum, Elfmeterpunkt + Bogen,
// Eckbögen). Ersetzt Pitch + PitchLines aus v1 → −2 Draw-Calls,
// echte Linienbreite, Anti-Aliasing gratis.
// ─────────────────────────────────────────────────────────────

const MESH_W = PITCH.width + APRON * 2   // 11.3 (113 m inkl. Auslauf)
const MESH_H = PITCH.height + APRON * 2  // 7.6
// v5.5 („Fotomaterial statt nachgebaut"): 2048 statt 1024 — die Kamera
// kommt bis auf ~5 m an den Rasen, 1024px/113m waren das 480p-Gefühl.
const TEX_W = 2048
const S = TEX_W / MESH_W                 // px pro Welt-Einheit
const TEX_H = Math.round(MESH_H * S)

const LINE = 0.022 * S                   // Linienbreite (leicht überzeichnet für Lesbarkeit)

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// Feld-Koordinaten (Ursprung Mitte) → Canvas-Pixel
const px = (x: number) => (x + MESH_W / 2) * S
const py = (z: number) => (z + MESH_H / 2) * S

function paintGrass(ctx: CanvasRenderingContext2D, rough?: CanvasRenderingContext2D) {
  const rng = mulberry32(7)

  // Mähstreifen quer über die ganze Fläche (satt, nicht giftig)
  const stripes = 16
  const stripeW = TEX_W / stripes
  for (let i = 0; i < stripes; i++) {
    ctx.fillStyle = i % 2 === 0 ? '#2c6127' : '#255722'
    ctx.fillRect(i * stripeW, 0, stripeW + 1, TEX_H)
    if (rough) {
      rough.fillStyle = i % 2 === 0 ? 'rgb(238,238,238)' : 'rgb(228,228,228)'
      rough.fillRect(i * stripeW, 0, stripeW + 1, TEX_H)
    }
  }

  // Niederfrequente Flecken — organische Unruhe
  for (let i = 0; i < 70; i++) {
    const x = rng() * TEX_W
    const y = rng() * TEX_H
    const r = 60 + rng() * 220
    const dark = rng() > 0.5
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, dark ? 'rgba(14,30,12,0.13)' : 'rgba(120,150,70,0.10)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, r * 2, r * 2)
  }

  // Abnutzung: Anstoßkreis + beide Elfmeter-/Torraum-Zonen
  const wear = (wx: number, wz: number, r: number, a: number) => {
    const g = ctx.createRadialGradient(px(wx), py(wz), 0, px(wx), py(wz), r * S)
    g.addColorStop(0, `rgba(96,84,48,${a})`)
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(px(wx) - r * S, py(wz) - r * S, r * S * 2, r * S * 2)
  }
  wear(0, 0, 0.75, 0.16)
  const hw = PITCH.width / 2
  wear(hw - 0.55, 0, 0.85, 0.14)
  wear(-(hw - 0.55), 0, 0.85, 0.14)

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

export function Pitch() {
  const { map, roughnessMap } = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = TEX_W; cv.height = TEX_H
    const ctx = cv.getContext('2d')!
    const rcv = document.createElement('canvas')
    rcv.width = TEX_W; rcv.height = TEX_H
    const rctx = rcv.getContext('2d')!

    paintGrass(ctx, rctx)
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
    return { map, roughnessMap }
  }, [])

  return (
    // v13-X3: der Rasen empfängt die statisch gebackenen Schatten
    <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[MESH_W, MESH_H]} />
      <meshStandardMaterial map={map} roughnessMap={roughnessMap} roughness={1} metalness={0} />
    </mesh>
  )
}
