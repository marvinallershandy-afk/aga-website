import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { PITCH, COLORS } from '../utils/constants'
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

// Kleines Dummy-Logo (v9-E4): Icon + Wortmarke — beispielhafte lokale
// Sponsoren als VORBILD an der Bande (macht die freien Slots begehrt).
// Bewusst generische Muster-Betriebe, KEINE echten Marken.
function drawDummyLogo(ctx: CanvasRenderingContext2D, cx: number, cy: number, kind: 'sonne' | 'stern', name: string, accent: string) {
  ctx.save()
  ctx.translate(cx, cy)
  ctx.fillStyle = accent
  if (kind === 'sonne') {
    ctx.beginPath(); ctx.arc(-88, 0, 12, 0, Math.PI * 2); ctx.fill()
    ctx.strokeStyle = accent; ctx.lineWidth = 3
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
      ctx.beginPath(); ctx.moveTo(-88 + Math.cos(a) * 16, Math.sin(a) * 16); ctx.lineTo(-88 + Math.cos(a) * 22, Math.sin(a) * 22); ctx.stroke()
    }
  } else {
    ctx.beginPath()
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5
      ctx[i ? 'lineTo' : 'moveTo'](-88 + Math.cos(a) * 15, Math.sin(a) * 15)
    }
    ctx.closePath(); ctx.fill()
  }
  ctx.fillStyle = '#1a1718'
  ctx.font = '800 20px Archivo, system-ui, sans-serif'
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(name, -62, 1)
  ctx.restore()
}

function makeBoardsTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 2048
  cv.height = 64
  const ctx = cv.getContext('2d')!
  // Reihenfolge: die begehrten Boards (Platzhalter + Beispiel-Logos)
  // liegen MITTIG — dort zoomt die Sponsoren-Station drauf.
  const boards: { text?: string; bg: string; fg?: string; logo?: 'sonne' | 'stern'; name?: string; accent?: string }[] = [
    { text: 'SV AGATHENBURG-DOLLERN 1949', bg: '#1a1718', fg: '#e8e4da' },
    { bg: '#f2efe8', logo: 'sonne', name: 'BÄCKEREI SONNE', accent: '#e0a020' },
    { text: 'HIER KÖNNTE DEIN LOGO STEHEN', bg: '#f2efe8', fg: '#8a2530' },
    { text: 'HIER KÖNNTE DEIN LOGO STEHEN', bg: '#e8e4da', fg: '#8a2530' },
    { bg: '#eef1f4', logo: 'stern', name: 'AUTOHAUS NORDLICHT', accent: '#2f6e9e' },
    { text: 'WERDE SPONSOR · WA', bg: COLORS.red, fg: '#ffffff' },
  ]
  const w = cv.width / boards.length
  boards.forEach((b, i) => {
    ctx.fillStyle = b.bg
    ctx.fillRect(i * w + 3, 4, w - 6, 56)
    if (b.logo) {
      drawDummyLogo(ctx, i * w + w / 2, 34, b.logo, b.name!, b.accent!)
    } else if (b.text) {
      ctx.fillStyle = b.fg!
      ctx.font = '700 22px Archivo, system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(b.text, i * w + w / 2, 34)
    }
  })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
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

      {/* Sponsor-Tafeln nur SÜD (vor dem Wald), hängen an der Reling */}
      <mesh position={[0, RAIL_H - 0.02, HH + 0.035]}>
        <boxGeometry args={[PITCH.width * 0.86, 0.24, 0.03]} />
        <meshStandardMaterial map={boardsTex} roughness={0.6} emissive="#20180f" emissiveIntensity={0.3} />
      </mesh>
      <AOBlob position={[0, 0.004, HH + 0.05]} scale={[PITCH.width * 0.9, 0.5]} opacity={0.35} />
    </group>
  )
}
