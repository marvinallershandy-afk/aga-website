import * as THREE from 'three'
import { mergeBufferGeometries } from 'three-stdlib'
import { CLOTH, type ClothItem } from '../three/clothMaterial'
import {
  CX, HH, ROWS, ROW_Z0, ROW_D, STEP_H, TERRACE_BACK, TERRACE_HALF_W,
  WIND_FLAGS, DOUBLE_HOLDERS, SIGN_SPOTS, SIGN_W, SIGN_H, terraceY,
  type CurveLayout,
} from './curveLayout'

// ─────────────────────────────────────────────────────────────
// v14-B: Ausstattung der Südkurve — Stoff-Atlas (alle Banner,
// Fahnen, Doppelhalter in EINER Textur) und die statischen
// Requisiten (Stehtraverse, Wellenbrecher, Zaun, Stangen) als
// EIN vertex-gefärbtes Mesh.
// ─────────────────────────────────────────────────────────────

// ─── Zeichnungen (Original-Koordinatenräume) ─────────────────

/** „AGA URKNALL"-Banner, 640×220 */
function drawUrknall(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#b3141f'
  ctx.fillRect(0, 0, 640, 220)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(60,0,8,${0.05 + Math.random() * 0.08})`
    ctx.beginPath()
    ctx.arc(Math.random() * 640, Math.random() * 220, 20 + Math.random() * 50, 0, Math.PI * 2)
    ctx.fill()
  }
  for (let i = 0; i < 6; i++) {
    const x = 55 + i * 98 + Math.sin(i * 2.7) * 22
    const g = ctx.createLinearGradient(x - 20, 0, x + 20, 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.45, 'rgba(40,0,6,0.22)')
    g.addColorStop(0.7, 'rgba(255,235,220,0.07)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 20, 0, 40, 220)
  }
  ctx.save()
  ctx.translate(320, 110)
  ctx.rotate(-0.16)
  ctx.fillStyle = '#141114'
  ctx.fillRect(-360, -46, 720, 92)
  ctx.fillStyle = '#f2eee6'
  ctx.font = '400 58px Anton, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('AGA URKNALL', 0, -2)
  ctx.font = '600 20px Archivo, system-ui, sans-serif'
  ctx.fillText('est. 2024', 210, 30)
  ctx.restore()
  ctx.strokeStyle = 'rgba(20,12,14,0.85)'
  ctx.lineWidth = 5
  for (const sx of [70, 570]) {
    for (let a = -1.1; a <= 1.1; a += 0.28) {
      ctx.beginPath()
      ctx.ellipse(sx + Math.sin(a) * 26 * (sx > 300 ? -1 : 1), 110 + a * 70, 13, 5, a * 0.9, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  ctx.strokeStyle = 'rgba(20,12,14,0.7)'
  ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(i * 0.28) * 110, Math.sin(i * 0.28) * 110)
    ctx.stroke()
  }
  for (let r = 30; r <= 100; r += 32) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI / 2)
    ctx.stroke()
  }
  ctx.strokeStyle = 'rgba(240,236,228,0.9)'
  ctx.lineWidth = 3.5
  ctx.strokeRect(560, 168, 30, 36)
  ctx.beginPath()
  ctx.arc(594, 186, 9, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(560, 178)
  ctx.lineTo(590, 178)
  ctx.stroke()
}

/** „MEISTER 2026"-Kurvenbanner, 1024×220 */
function drawMeister(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#141114'
  ctx.fillRect(0, 0, 1024, 220)
  for (let i = 0; i < 34; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`
    ctx.beginPath()
    ctx.arc(Math.random() * 1024, Math.random() * 220, 15 + Math.random() * 45, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#c41824'
  ctx.lineWidth = 12
  ctx.strokeRect(16, 16, 1024 - 32, 220 - 32)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e8c15a'
  ctx.font = '400 104px Anton, system-ui, sans-serif'
  ctx.fillText('MEISTER 2026', 512, 88)
  ctx.fillStyle = '#f2eee6'
  ctx.font = '700 40px Archivo, system-ui, sans-serif'
  ctx.fillText('★  SÜDKURVE · 1. KREISKLASSE  ★', 512, 162)
}

/** Rot-schwarz diagonal geteilte Fahne, 160×112 */
function drawFlag(ctx: CanvasRenderingContext2D) {
  ctx.fillStyle = '#c41824'
  ctx.fillRect(0, 0, 160, 112)
  ctx.fillStyle = '#141114'
  ctx.beginPath()
  ctx.moveTo(160, 0)
  ctx.lineTo(160, 112)
  ctx.lineTo(0, 112)
  ctx.closePath()
  ctx.fill()
  ctx.strokeStyle = 'rgba(240,236,228,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(160, 0)
  ctx.lineTo(0, 112)
  ctx.stroke()
}

/** v11-E7: Sponsoren-Tafel auf der Reling, 2048×128 */
function drawRail(ctx: CanvasRenderingContext2D) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cells = ['DEIN LOGO HIER', 'WERDE SPONSOR', 'DEINE BANDE?']
  const w = 2048 / cells.length
  cells.forEach((t, i) => {
    const x0 = i * w
    ctx.fillStyle = '#0f0c0d'
    ctx.fillRect(x0 + 6, 6, w - 12, 128 - 12)
    ctx.fillStyle = '#e91d29'
    ctx.fillRect(x0 + 6, 6, 10, 128 - 12)
    ctx.strokeStyle = 'rgba(233,29,41,0.6)'
    ctx.lineWidth = 3
    ctx.setLineDash([14, 10])
    ctx.strokeRect(x0 + 22, 22, w - 44, 128 - 44)
    ctx.setLineDash([])
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 46px Archivo, system-ui, sans-serif'
    ctx.fillText(t, x0 + w / 2 + 6, 128 / 2)
  })
}

/** Doppelhalter, 300×190 — drei Motive */
function drawDouble(ctx: CanvasRenderingContext2D, kind: number) {
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  if (kind === 0) {
    ctx.fillStyle = '#c41824'
    ctx.fillRect(0, 0, 300, 190)
    ctx.strokeStyle = '#141114'
    ctx.lineWidth = 14
    ctx.strokeRect(7, 7, 286, 176)
    ctx.fillStyle = '#f2eee6'
    ctx.font = '400 112px Anton, system-ui, sans-serif'
    ctx.fillText('SVA', 150, 100)
  } else if (kind === 1) {
    ctx.fillStyle = '#141114'
    ctx.fillRect(0, 0, 300, 190)
    ctx.fillStyle = '#c41824'
    ctx.fillRect(0, 150, 300, 40)
    ctx.fillStyle = '#e8c15a'
    ctx.font = '400 30px Anton, system-ui, sans-serif'
    ctx.fillText('★ ★ ★', 150, 34)
    ctx.fillStyle = '#f2eee6'
    ctx.font = '400 62px Anton, system-ui, sans-serif'
    ctx.fillText('AUFSTIEG', 150, 92)
    ctx.font = '700 24px Archivo, system-ui, sans-serif'
    ctx.fillText('2026', 150, 170)
  } else {
    // rot-weiß gestreift mit schwarzem Schriftband
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = i % 2 ? '#f2eee6' : '#c41824'
      ctx.fillRect(i * 50, 0, 50, 190)
    }
    ctx.fillStyle = '#141114'
    ctx.fillRect(0, 62, 300, 66)
    ctx.fillStyle = '#f2eee6'
    ctx.font = '400 50px Anton, system-ui, sans-serif'
    ctx.fillText('DOLLERN', 150, 96)
  }
}

// ─── Atlas ────────────────────────────────────────────────────
export const ATLAS_W = 2048
export const ATLAS_H = 1152
type Rect = [number, number, number, number]
const R_MEISTER: Rect = [0, 0, 2048, 440]
const R_URKNALL: Rect = [0, 440, 1280, 440]
const R_FLAG: Rect = [1280, 440, 384, 270]
const R_DOUBLE: Rect[] = [[1664, 440, 384, 240], [1280, 710, 384, 240], [1664, 710, 384, 240]]
const R_RAIL: Rect = [0, 1024, 2048, 128]
const inset = (r: Rect, p = 4): Rect => [r[0] + p, r[1] + p, r[2] - 2 * p, r[3] - 2 * p]

export function makeClothAtlas(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = ATLAS_W
  cv.height = ATLAS_H
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#141114'
  ctx.fillRect(0, 0, ATLAS_W, ATLAS_H)
  const region = (r: Rect, w0: number, h0: number, draw: (c: CanvasRenderingContext2D) => void) => {
    ctx.save()
    ctx.beginPath()
    ctx.rect(r[0], r[1], r[2], r[3])
    ctx.clip()
    ctx.translate(r[0], r[1])
    ctx.scale(r[2] / w0, r[3] / h0)
    draw(ctx)
    ctx.restore()
  }
  region(R_MEISTER, 1024, 220, drawMeister)
  region(R_URKNALL, 640, 220, drawUrknall)
  region(R_FLAG, 160, 112, drawFlag)
  R_DOUBLE.forEach((r, k) => region(r, 300, 190, (c) => drawDouble(c, k)))
  region(R_RAIL, 2048, 128, drawRail)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

const tmpQ = new THREE.Quaternion()
const tmpE = new THREE.Euler()
const mtx = (x: number, y: number, z: number, ry = 0, rz = 0) =>
  new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), tmpQ.setFromEuler(tmpE.set(0, ry, rz)), new THREE.Vector3(1, 1, 1))

// ─── Stoffe ───────────────────────────────────────────────────
export function buildClothItems(layout: CurveLayout): ClothItem[] {
  const items: ClothItem[] = []
  // MEISTER 2026 am Zaun hinten — doppelt bedruckt (beide Seiten lesbar)
  items.push({
    rect: inset(R_MEISTER), w: 2.9, h: 0.56, segX: 1, segY: 1, mode: CLOTH.STATIC, amp: 0, phase: 0,
    emissive: 0.12, matrix: mtx(CX - 0.1, 0.82, TERRACE_BACK - 0.06, Math.PI), back: 'readable',
  })
  // AGA URKNALL, von zwei Fans an Stangen hochgehalten (Vorderseite zum Platz)
  items.push({
    rect: inset(R_URKNALL), w: 1.45, h: 0.3, segX: 22, segY: 4, mode: CLOTH.BANNER, amp: 0.048, phase: 0,
    matrix: mtx(CX, 0.3, HH + 0.22, Math.PI), back: true,
  })
  // Wehende Fahnen an Masten in der Menge (Tuch hängt rechts am Mast)
  for (const f of WIND_FLAGS) {
    const y0 = terraceY(f.z)
    items.push({
      rect: inset(R_FLAG), w: f.w, h: f.h, segX: 12, segY: 3, mode: CLOTH.FLAG, amp: 0.05, phase: f.phase,
      matrix: mtx(f.x + f.w / 2 + 0.006, y0 + f.poleH - f.h / 2 - 0.02, f.z), back: true,
    })
  }
  // Fahne des Fahnenträgers vorne (Mast aus seiner Faust)
  const fh = layout.flagHand
  const top = flagPoleTop(fh)
  items.push({
    rect: inset(R_FLAG), w: 0.2, h: 0.14, segX: 10, segY: 2, mode: CLOTH.FLAG, amp: 0.035, phase: 1.3,
    matrix: mtx(top.x + 0.1 + 0.004, top.y - 0.08, top.z), back: true,
  })
  // Sponsoren-Tafel auf der Reling (Vorderseite zum Platz, leicht selbstleuchtend)
  items.push({
    rect: inset(R_RAIL, 2), w: 3.0, h: 0.15, segX: 1, segY: 1, mode: CLOTH.STATIC, amp: 0, phase: 0,
    emissive: 0.22, matrix: mtx(CX, 0.115, HH - 0.021, Math.PI),
  })
  // Doppelhalter
  for (const d of DOUBLE_HOLDERS) {
    items.push({
      rect: inset(R_DOUBLE[d.kind]), w: d.w, h: d.h, segX: 10, segY: 3, mode: CLOTH.DOUBLE, amp: 0.02, phase: d.phase,
      emissive: 0.05, matrix: mtx(d.x, terraceY(d.z) + d.y, d.z, Math.PI), back: true,
    })
  }
  return items
}

export function flagPoleTop(hand: THREE.Vector3) {
  return hand.clone().add(new THREE.Vector3(0.05, 0.24, 0))
}

// ─── Statische Requisiten (ein Mesh, Vertex-Farben) ──────────
export function buildPropsGeometry(layout: CurveLayout): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const col = new THREE.Color()
  const add = (g: THREE.BufferGeometry, hex: string) => {
    g.deleteAttribute('uv')
    col.set(hex)
    const n = g.getAttribute('position').count
    const c = new Float32Array(n * 3)
    for (let i = 0; i < n; i++) c.set([col.r, col.g, col.b], i * 3)
    g.setAttribute('color', new THREE.BufferAttribute(c, 3))
    parts.push(g.index ? g.toNonIndexed() : g)
  }
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, hex: string) => {
    const g = new THREE.BoxGeometry(w, h, d)
    g.translate(x, y, z)
    add(g, hex)
  }
  const rod = (a: THREE.Vector3, b: THREE.Vector3, r: number, hex: string, seg = 5) => {
    const dir = b.clone().sub(a)
    const len = dir.length()
    const g = new THREE.CylinderGeometry(r, r, len, seg)
    g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()))
    g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
    add(g, hex)
  }
  const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)

  // Stehtraverse: Stufen aus Beton + helle, abgetretene Stufenkanten
  for (let r = 1; r < ROWS; r++) {
    const zf = ROW_Z0 + (r - 0.5) * ROW_D
    const h = r * STEP_H
    box(TERRACE_HALF_W * 2, h, TERRACE_BACK - zf, CX, h / 2, (zf + TERRACE_BACK) / 2, '#2d2c31')
    box(TERRACE_HALF_W * 2, 0.004, 0.012, CX, h + 0.0015, zf + 0.006, '#9a9484')
  }
  // Wellenbrecher (verzinkt) zwischen Reihe 2/3 und 4/5 — mit Lücken
  for (const rr of [3.5, 6.5]) {
    const z = ROW_Z0 + rr * ROW_D
    const y0 = Math.floor(rr) * STEP_H
    for (const [x0, x1] of [[CX - 2.2, CX - 0.95], [CX - 0.5, CX + 0.62], [CX + 1.3, CX + 2.2]]) {
      rod(V(x0, y0 + 0.1, z), V(x1, y0 + 0.1, z), 0.0055, '#7f868f', 6)
      for (const x of [x0 + 0.02, x1 - 0.02]) rod(V(x, y0, z), V(x, y0 + 0.1, z), 0.0045, '#6d737b')
    }
  }
  // Zaun hinter der Kurve (trägt das MEISTER-Banner)
  const zf = TERRACE_BACK - 0.03
  const yb = (ROWS - 1) * STEP_H
  for (let x = CX - TERRACE_HALF_W; x <= CX + TERRACE_HALF_W + 0.001; x += 0.5) rod(V(x, yb, zf), V(x, yb + 1.18, zf), 0.007, '#2f3236')
  rod(V(CX - TERRACE_HALF_W, yb + 1.16, zf), V(CX + TERRACE_HALF_W, yb + 1.16, zf), 0.006, '#3a3d42')
  rod(V(CX - TERRACE_HALF_W, yb + 0.5, zf), V(CX + TERRACE_HALF_W, yb + 0.5, zf), 0.005, '#3a3d42')

  // Banner-Stangen (AGA URKNALL)
  for (const x of [CX - 0.7, CX + 0.7]) rod(V(x, 0, HH + 0.22), V(x, 0.45, HH + 0.22), 0.008, '#3a3d42')
  // Fahnenmasten
  for (const f of WIND_FLAGS) {
    const y0 = terraceY(f.z)
    rod(V(f.x, y0 + 0.12, f.z), V(f.x, y0 + f.poleH, f.z), 0.0075, '#3a3d42')
  }
  // Mast des Fahnenträgers (aus der Faust schräg nach oben)
  const fh = layout.flagHand
  rod(fh.clone().add(V(-0.01, -0.05, 0)), flagPoleTop(fh), 0.0065, '#3a3d42')
  // Doppelhalter-Stangen
  for (const d of DOUBLE_HOLDERS) {
    const y = terraceY(d.z) + d.y
    for (const s of [-1, 1]) rod(V(d.x + s * d.w / 2, y - 0.2, d.z - 0.004), V(d.x + s * d.w / 2, y + d.h / 2 + 0.012, d.z - 0.004), 0.0055, '#2f3236')
  }
  // Schild-Stangen
  for (const s of SIGN_SPOTS) {
    for (const px of [-SIGN_W * 0.36, SIGN_W * 0.36]) {
      const yTop = s.y - SIGN_H * 0.5 + 0.03
      rod(V(s.x + px, yTop - 0.28, s.z + 0.02), V(s.x + px, yTop, s.z + 0.02), 0.0065, '#2f3236')
    }
  }
  // Träger der Sponsoren-Tafel (Rückseite/Kanten)
  box(3.0, 0.15, 0.016, CX, 0.115, HH - 0.01, '#141114')
  // Bierkiste
  box(0.16, 0.09, 0.11, CX + 0.3, terraceY(HH + 0.62) + 0.045, HH + 0.62, '#7a1d14')

  const merged = mergeBufferGeometries(parts)!
  parts.forEach((p) => p.dispose())
  return merged
}
