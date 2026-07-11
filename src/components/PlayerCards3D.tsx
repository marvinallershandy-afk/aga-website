import { useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYERS, STAFF, type Player, type Staff } from '../data/players'
import { useStore } from '../store/useStore'
import { whatsappUrl, whatsappReady } from '../data/club'
import { cameraState } from '../camera/CameraPath'
import { makePlayerCardTexture, makeStaffCardTexture } from '../three/playerCardTexture'

// ─────────────────────────────────────────────────────────────
// v11-E1: Die Spielerkarten LEBEN in 3D auf dem Platz — an ihren
// Aufstellungspositionen (TW→ABW→MIT→ANG über die x-Achse), als
// billboardende Karten-Planes. Gestaffelter Reveal an cameraState.u
// (Mannschaft-Beat u≈2/7), Klick → bestehendes Flip-Detail-Modal.
// Trainerstab separat an der Seitenlinie. Nur im 3D-Pfad (Scene).
// ─────────────────────────────────────────────────────────────

const MANN_U = 2 / 7 // ≈0.286 (Kamera-Station Mannschaft)
const CARD_W = 0.92
const CARD_H = 1.29
const CY = 0.86 // Karten-Mittenhöhe (stehen knapp über dem Rasen)

const LINE_X: Record<Player['position'], number> = { TW: -4.4, ABW: -2.4, MIT: -0.3, ANG: 1.9 }
const LINE_ORDER: Player['position'][] = ['TW', 'ABW', 'MIT', 'ANG']

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

interface Placed {
  player?: Player
  staff?: Staff
  x: number
  z: number
  line: number
  tex: THREE.CanvasTexture
  scale: number
}

function useLayout(): Placed[] {
  return useMemo(() => {
    const placed: Placed[] = []
    LINE_ORDER.forEach((pos, line) => {
      const inLine = PLAYERS.filter((p) => p.position === pos)
      const n = inLine.length
      const spacing = Math.min(1.4, n > 1 ? 5.7 / (n - 1) : 0)
      inLine.forEach((p, i) => {
        const z = (i - (n - 1) / 2) * spacing
        placed.push({ player: p, x: LINE_X[pos], z, line, scale: 1, tex: makePlayerCardTexture(p, !!p.isPlayerOfMonth).texture })
      })
    })
    // Trainerstab an der Seitenlinie (Süd, West-Ecke = nah an der Bank)
    STAFF.forEach((m, i) => {
      placed.push({ staff: m, x: -4.0 + i * 1.35, z: 4.35, line: 4, scale: 0.82, tex: makeStaffCardTexture(m).texture })
    })
    return placed
  }, [])
}

export function PlayerCards3D() {
  const layout = useLayout()
  const { camera } = useThree()
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const groupRef = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])

  useFrame(() => {
    const u = cameraState.u
    const rp = smoothstep(0.20, MANN_U, u)
    const fo = 1 - smoothstep(0.34, 0.42, u)
    const g = groupRef.current
    if (!g) return
    let anyVisible = false
    for (let i = 0; i < layout.length; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const item = layout[i]
      const lineReveal = THREE.MathUtils.clamp((rp - item.line * 0.12) / 0.3, 0, 1)
      const alpha = lineReveal * fo
      const mat = m.material as THREE.MeshBasicMaterial
      mat.opacity = alpha
      const ease = lineReveal * lineReveal * (3 - 2 * lineReveal)
      const s = (0.72 + 0.28 * ease) * item.scale
      m.scale.set(CARD_W * s, CARD_H * s, 1)
      m.visible = alpha > 0.02
      if (m.visible) {
        anyVisible = true
        // Billboard: nur Yaw zur Kamera (Karten bleiben aufrecht)
        m.rotation.y = Math.atan2(camera.position.x - item.x, camera.position.z - item.z)
        // beim Reveal leicht aufsteigen
        m.position.y = CY - (1 - ease) * 0.25
      }
    }
    g.visible = anyVisible
  })

  return (
    <group ref={groupRef}>
      {layout.map((item, i) => (
        <mesh
          key={item.player?.id ?? item.staff?.id ?? i}
          ref={(el) => (meshes.current[i] = el)}
          position={[item.x, CY, item.z]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation()
            if (item.player) setSelected(item.player)
            // v13-E4: mailto-Fallback darf nicht in einen Blank-Tab
            // (window.open(mailto,'_blank') öffnet in Chromium einen leeren Tab)
            else if (item.staff?.contactMessage) {
              const url = whatsappUrl(item.staff.contactMessage)
              if (whatsappReady) window.open(url, '_blank')
              else window.location.href = url
            }
          }}
          onPointerOver={() => { if (item.player || item.staff?.contactMessage) document.body.style.cursor = 'pointer' }}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          <planeGeometry args={[1, 1]} />
          {/* fog=false → Karten bleiben auch in der Tiefe scharf lesbar (kein Absaufen). */}
          <meshBasicMaterial map={item.tex} transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} toneMapped={false} fog={false} />
        </mesh>
      ))}
    </group>
  )
}
