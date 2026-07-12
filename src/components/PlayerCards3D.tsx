import { useEffect, useMemo, useRef } from 'react'
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
        // v13-E6: Formation leicht nach Norden (−z) versetzt — die südlichen
        // Ketten-Karten lagen sonst unter der linken Textspalte der Sektion.
        const z = (i - (n - 1) / 2) * spacing - 0.55
        placed.push({ player: p, x: LINE_X[pos], z, line, scale: 1, tex: makePlayerCardTexture(p, !!p.isPlayerOfMonth).texture })
      })
    })
    // Trainerstab an der Seitenlinie (Süd) — v13-E6: ohne Platzhalter-Slots
    // („Name folgt" bleibt nur im DOM-Stab-Block) und weiter östlich, damit
    // die Karten nicht unter der linken Textspalte der Sektion liegen.
    STAFF.filter((m) => !m.isPlaceholder).forEach((m, i) => {
      placed.push({ staff: m, x: 0.9 + i * 1.4, z: 3.85, line: 4, scale: 0.82, tex: makeStaffCardTexture(m).texture })
    })
    return placed
  }, [])
}

const _launchTarget = new THREE.Vector3()
const _launchBase = new THREE.Vector3()
const _camDir = new THREE.Vector3()

export function PlayerCards3D() {
  const layout = useLayout()
  const { camera } = useThree()
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const groupRef = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  // v13-K4: Tap-Launch — die angetippte Karte fliegt der Kamera entgegen,
  // DANN öffnet das Flip-Modal. Verkauft Kontinuität statt DOM-Bruch.
  const launch = useRef<{ i: number; t0: number } | null>(null)
  // v13-K4: gemeinsame Glint-Zeit für den Foil-Sweep aller Karten.
  const glintT = useRef({ value: 0 })

  // Foil-Glint in die Basic-Materialien injizieren (einmalig, dann recompile).
  useEffect(() => {
    meshes.current.forEach((m) => {
      if (!m) return
      const mat = m.material as THREE.MeshBasicMaterial
      mat.onBeforeCompile = (shader) => {
        shader.uniforms.uGlintT = glintT.current
        shader.fragmentShader = shader.fragmentShader
          .replace('void main() {', 'uniform float uGlintT;\nvoid main() {')
          .replace(
            '#include <map_fragment>',
            `#include <map_fragment>
#ifdef USE_UV
  float glintBand = abs(fract(vUv.x * 0.9 - vUv.y * 0.38 + uGlintT * 0.05) - 0.5) - 0.055;
  float glint = smoothstep(0.05, 0.0, glintBand);
  diffuseColor.rgb += glint * vec3(1.0, 0.93, 0.72) * 0.10;
#endif`,
          )
      }
      mat.needsUpdate = true
    })
  }, [layout])

  useFrame((state) => {
    const u = cameraState.u
    const rp = smoothstep(0.20, MANN_U, u)
    const fo = 1 - smoothstep(0.34, 0.42, u)
    const g = groupRef.current
    if (!g) return
    glintT.current.value = state.clock.elapsedTime
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
      // v13-K4: Launch-Animation überlagert Reveal-Pose
      const L = launch.current
      if (L && L.i === i) {
        const k = Math.min(1, (performance.now() - L.t0) / 240)
        const e2 = k * k * (3 - 2 * k)
        camera.getWorldDirection(_camDir)
        _launchTarget.copy(camera.position).addScaledVector(_camDir, 1.15)
        _launchBase.set(item.x, CY, item.z)
        m.position.lerpVectors(_launchBase, _launchTarget, e2)
        const ls = s * (1 + 0.55 * e2)
        m.scale.set(CARD_W * ls, CARD_H * ls, 1)
        m.rotation.y += e2 * 0.35
        m.visible = true
        anyVisible = true
        if (k >= 1) launch.current = null
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
            if (item.player) {
              // v13-K4: erst der 240ms-Flug zur Kamera, dann das Modal
              launch.current = { i, t0: performance.now() }
              const p = item.player
              setTimeout(() => setSelected(p), 230)
            }
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
