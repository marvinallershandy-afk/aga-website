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

function makeBoardsTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 2048
  cv.height = 64
  const ctx = cv.getContext('2d')!
  const boards = [
    { text: 'HIER KÖNNTE DEIN LOGO STEHEN', bg: '#f2efe8', fg: '#8a2530' },
    { text: 'SVA', bg: COLORS.red, fg: '#ffffff' },
    { text: 'EIN DORF. EIN VEREIN. EIN PLATZ.', bg: '#f2efe8', fg: '#1a1718' },
    { text: 'DEIN VEREIN. DEINE BANDE.', bg: '#e8e4da', fg: '#8f1620' },
    { text: 'SV AGATHENBURG-DOLLERN 1949', bg: '#1a1718', fg: '#e8e4da' },
    { text: 'WERDE SPONSOR', bg: '#f2efe8', fg: '#b8912F' },
  ]
  const w = cv.width / boards.length
  boards.forEach((b, i) => {
    ctx.fillStyle = b.bg
    ctx.fillRect(i * w + 3, 4, w - 6, 56)
    ctx.fillStyle = b.fg
    ctx.font = '700 22px Archivo, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(b.text, i * w + w / 2, 34)
  })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function Barrier() {
  const boardsTex = useMemo(makeBoardsTexture, [])
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
