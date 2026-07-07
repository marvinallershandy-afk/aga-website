import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { PITCH, COLORS } from '../utils/constants'
import { SPONSORS, SPONSOR_PLACEHOLDER_SLOTS, type Sponsor } from '../data/club'
import { AOBlob } from './AOBlob'

// ─────────────────────────────────────────────────────────────
// Die echte Umrandung nach REFERENZ_MODELL: niedrige verzinkte
// Rohr-Reling rundum (statt v2-Tribüne/Bande) + Sponsor-Tafeln
// nur auf der SÜD-Seite (vor dem Wald). Reale Sponsoren werden
// nicht erfunden — Platzhalter-Tafeln + SVA-Slogans.
// Beleg: IMG_6074/f001, dji_…143024_0160…/f001.
// ─────────────────────────────────────────────────────────────

const OFF = 0.55 // Abstand Reling ↔ Außenlinie
const RAIL_H = 0.11
const HW = PITCH.width / 2 + OFF
const HH = PITCH.height / 2 + OFF

// Text mittig in ein Rechteck setzen, Schriftgrad schrumpfen bis er passt
// (mehrzeilig via \n). Sorgt für gestochen scharfe, nie überlaufende Schrift.
function fitText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, basePx: number, weight = 800) {
  const lines = text.split('\n')
  let px = basePx
  const font = (p: number) => `${weight} ${p}px Archivo, system-ui, sans-serif`
  for (; px > 8; px -= 2) {
    ctx.font = font(px)
    if (lines.every((l) => ctx.measureText(l).width <= maxW)) break
  }
  const lh = px * 1.12
  const y0 = cy - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh))
}

// v10-E1: Banden-Textur HOCHAUFLÖSEND + datengetrieben. Boards lesen aus
// SPONSORS[]: logoUrl gesetzt → echtes Logo (async nachgeladen, scharf),
// sonst „HIER KÖNNTE DEIN LOGO STEHEN". Canvas 4096×256 (vorher 2048×64)
// → Text bleibt beim Sponsoren-Zoom scharf. Erstes Board = Verein, letztes
// = CTA; die begehrten Slots liegen mittig (dort zoomt die Station drauf).
function makeBoardsTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  // Breite an das Banden-Seitenverhältnis gekoppelt (Board ist sehr breit &
  // niedrig) → Schrift wird NICHT horizontal gestreckt (der alte „matschig"-
  // Effekt kam von 16:1-Canvas auf ~37:1-Bande).
  cv.width = 8192
  cv.height = 220
  const ctx = cv.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  type Board = { kind: 'club' | 'cta' | 'empty' | 'logo' | 'name'; sponsor?: Sponsor }
  const slotCount = Math.max(SPONSOR_PLACEHOLDER_SLOTS, SPONSORS.length)
  const boards: Board[] = [{ kind: 'club' }]
  for (let i = 0; i < slotCount; i++) {
    const s = SPONSORS[i]
    boards.push(s ? (s.logoUrl ? { kind: 'logo', sponsor: s } : { kind: 'name', sponsor: s }) : { kind: 'empty' })
  }
  boards.push({ kind: 'cta' })

  const w = cv.width / boards.length
  const H = cv.height
  const pad = 10
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16

  boards.forEach((b, i) => {
    const x0 = i * w
    const cx = x0 + w / 2
    const maxW = w - pad * 4
    if (b.kind === 'club') {
      ctx.fillStyle = '#17141a'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.fillStyle = COLORS.red; ctx.fillRect(x0 + pad, pad, 14, H - pad * 2)
      ctx.fillStyle = '#f0ece2'
      fitText(ctx, 'SV AGATHENBURG-\nDOLLERN 1949', cx + 7, H / 2, maxW, 62)
    } else if (b.kind === 'cta') {
      ctx.fillStyle = COLORS.red; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.fillStyle = '#ffffff'
      fitText(ctx, 'WERDE\nSPONSOR', cx, H / 2 - 18, maxW, 66)
      ctx.fillStyle = 'rgba(255,255,255,0.85)'
      fitText(ctx, 'per WhatsApp', cx, H / 2 + 58, maxW, 28, 700)
    } else if (b.kind === 'name') {
      ctx.fillStyle = '#eef1f4'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.fillStyle = '#1a1718'
      fitText(ctx, b.sponsor!.name.toUpperCase(), cx, H / 2, maxW, 52)
    } else if (b.kind === 'logo') {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      // async: echtes Logo laden und mittig einpassen
      const img = new Image()
      img.onload = () => {
        const bw = w - pad * 4, bh = H - pad * 4
        const r = Math.min(bw / img.width, bh / img.height)
        const dw = img.width * r, dh = img.height * r
        ctx.drawImage(img, cx - dw / 2, H / 2 - dh / 2, dw, dh)
        tex.needsUpdate = true
      }
      img.src = b.sponsor!.logoUrl!
    } else {
      // empty → begehrter Platzhalter
      ctx.fillStyle = i % 2 ? '#f2efe8' : '#e8e4da'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.strokeStyle = 'rgba(138,37,48,0.45)'; ctx.lineWidth = 4
      ctx.setLineDash([16, 12]); ctx.strokeRect(x0 + pad * 3, pad * 3, w - pad * 6, H - pad * 6); ctx.setLineDash([])
      ctx.fillStyle = '#8a2530'
      fitText(ctx, 'HIER KÖNNTE\nDEIN LOGO STEHEN', cx, H / 2, maxW, 48)
    }
  })

  return tex
}

export function Barrier() {
  const boardsTex = useMemo(() => makeBoardsTexture(), [])
  const postsRef = useRef<THREE.InstancedMesh>(null)

  // Pfosten instanziert (1 Draw-Call)
  const postTransforms = useMemo(() => {
    const items: [number, number][] = []
    const step = 1.15
    for (let x = -HW; x <= HW + 0.01; x += step) {
      items.push([x, -HH], [x, HH])
    }
    for (let z = -HH + step; z < HH; z += step) {
      items.push([-HW, z], [HW, z])
    }
    return items
  }, [])

  useEffect(() => {
    const m = postsRef.current
    if (!m) return
    const mat = new THREE.Matrix4()
    postTransforms.forEach(([x, z], i) => {
      mat.makeTranslation(x, RAIL_H / 2, z)
      m.setMatrixAt(i, mat)
    })
    m.instanceMatrix.needsUpdate = true
  }, [postTransforms])

  return (
    <group>
      {/* Pfosten */}
      <instancedMesh ref={postsRef} args={[undefined, undefined, postTransforms.length]}>
        <cylinderGeometry args={[0.012, 0.012, RAIL_H, 5]} />
        <meshStandardMaterial color="#3a3d42" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      {/* Handlauf (verzinkt, 4 Seiten) */}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, RAIL_H, s * HH]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.016, 0.016, HW * 2, 6]} />
          <meshStandardMaterial color="#9aa2ac" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[s * HW, RAIL_H, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.016, 0.016, HH * 2, 6]} />
          <meshStandardMaterial color="#9aa2ac" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}

      {/* Sponsor-Tafeln SÜD (vor dem Wald). v10-E1: VOR die Reling gerückt
          (z = HH−0.02, Platzseite), damit das Handlauf-Rohr die Werbung nicht
          mehr quert; leicht selbstleuchtend (emissiveMap) → nachts scharf
          lesbar. Textur 8192×220 ≈ Banden-Proportion → keine gestreckte Schrift. */}
      <mesh position={[0, RAIL_H - 0.02, HH - 0.02]}>
        <boxGeometry args={[PITCH.width * 0.86, 0.24, 0.03]} />
        <meshStandardMaterial map={boardsTex} emissiveMap={boardsTex} emissive="#ffffff" emissiveIntensity={0.26} roughness={0.55} />
      </mesh>
      <AOBlob position={[0, 0.004, HH]} scale={[PITCH.width * 0.9, 0.5]} opacity={0.35} />
    </group>
  )
}
