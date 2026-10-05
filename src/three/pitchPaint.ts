// ─────────────────────────────────────────────────────────────
// v16-K: Die Rasen-Textur (Mähstreifen, Flecken, Halme, Linien) als
// reine Mal-Funktion — OHNE three/React. So kann sie im Web-Worker auf
// einer OffscreenCanvas laufen (pitchTexture.worker.ts) und blockiert
// den Hauptthread nicht mehr (Mittelklasse-Handy: ~1 s langer Task beim
// Laden der Karte, in dem Klicks auf die Marker hingen). Ohne
// OffscreenCanvas malt Pitch.tsx wie bisher auf dem Hauptthread.
// Inhalt unverändert aus Pitch.tsx (v14-A „Rasen, nicht Tapete").
// ─────────────────────────────────────────────────────────────

import { PITCH, APRON } from '../utils/constants'
import { fbm2, mulberry32 } from './proceduralNoise'

export type Ctx2D = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D
export type MakeCanvas = (w: number, h: number) => HTMLCanvasElement | OffscreenCanvas

export const MESH_W = PITCH.width + APRON * 2   // 11.3 (113 m inkl. Auslauf)
export const MESH_H = PITCH.height + APRON * 2  // 7.6
// v5.5 („Fotomaterial statt nachgebaut"): 2048 statt 1024 — die Kamera
// kommt bis auf ~5 m an den Rasen, 1024px/113m waren das 480p-Gefühl.
export const TEX_W = 2048
export const S = TEX_W / MESH_W                 // px pro Welt-Einheit
export const TEX_H = Math.round(MESH_H * S)

const LINE = 0.022 * S                   // Linienbreite (leicht überzeichnet für Lesbarkeit)
export const STRIPE_W = PITCH.width / 18        // 5,8 m Mähbahn, Kante auf der Mittellinie

// Feld-Koordinaten (Ursprung Mitte) → Canvas-Pixel
const px = (x: number) => (x + MESH_W / 2) * S
const py = (z: number) => (z + MESH_H / 2) * S

/** Viele kleine, unregelmäßige Flecken um ein Zentrum (Gauß-verteilt) */
function blotches(
  ctx: Ctx2D,
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

function paintGrass(ctx: Ctx2D, rough: Ctx2D | undefined, makeCanvas: MakeCanvas) {
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
    const low = makeCanvas(LW, LH)
    const lctx = low.getContext('2d') as Ctx2D
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
function paintApronFade(ctx: Ctx2D) {
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

function paintMarkings(ctx: Ctx2D, rough?: Ctx2D) {
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


/** Malt Farb- und Rauheits-Textur des Rasens (beide TEX_W × TEX_H). */
export function paintPitch(ctx: Ctx2D, rough: Ctx2D, makeCanvas: MakeCanvas) {
  paintGrass(ctx, rough, makeCanvas)
  paintApronFade(ctx)
  paintMarkings(ctx, rough)
}
