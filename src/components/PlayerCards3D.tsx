import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { PLAYERS, STAFF, type Player, type Staff } from '../data/players'
import { useStore } from '../store/useStore'
import { whatsappUrl, whatsappReady } from '../data/club'
import { cameraState } from '../camera/CameraPath'
import { makePlayerCardTexture, makeStaffCardTexture } from '../three/playerCardTexture'

// ─────────────────────────────────────────────────────────────
// v14-E1 „Karten-Wand": Die Karten stehen weiter in Formation auf
// dem Platz (TW→ABW→MIT→ANG über x), aber die PRÄSENTATION ist im
// Bildraum komponiert:
//  · hintere Reihen SCHWEBEN gestaffelt höher → im Bild stapeln
//    sich die Reihen ÜBEREINANDER statt sich zu verdecken
//  · EINE gemeinsame Orientierung für alle Karten (Wand-Yaw zur
//    Kamera + leichte Rücklage) statt 16 zufälliger Einzelwinkel
//  · saubere Verdeckung: depthWrite an, sobald eine Karte deckend
//    ist (Fade nur während des Reveals)
//  · instanzierte Schatten-Blobs erden jede Karte auf dem Rasen
// Klick → Tap-Launch → Flip-Detail-Modal (unverändert).
// ─────────────────────────────────────────────────────────────

const MANN_U = 2 / 7 // ≈0.286 (Kamera-Station Mannschaft)
const CARD_W = 0.92
const CARD_H = 1.29
const CY = 0.86 // Karten-Mittenhöhe der VORDEREN Reihe (knapp überm Rasen)

const LINE_X: Record<Player['position'], number> = { TW: -4.0, ABW: -2.3, MIT: -0.4, ANG: 1.6 }
const LINE_ORDER: Player['position'][] = ['TW', 'ABW', 'MIT', 'ANG']
// Staffel-Lift pro Reihe (TW hinten am höchsten): die Kamera schaut von
// Ost-oben — der Lift übersetzt Feld-Tiefe in Bild-HÖHE statt Verdeckung.
const LINE_LIFT = [1.55, 1.0, 0.48, 0]

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

interface Placed {
  player?: Player
  staff?: Staff
  x: number
  y: number
  z: number
  line: number
  tex: THREE.CanvasTexture
  scale: number
  phase: number
}

function useLayout(): Placed[] {
  return useMemo(() => {
    // Portrait: engere z-Spreizung, damit die Reihen in den schmalen
    // Bildausschnitt passen (der Rig zieht zusätzlich zurück).
    const portrait = typeof window !== 'undefined' && window.innerHeight > window.innerWidth
    const zk = portrait ? 0.72 : 1
    // Wand-Zentrum nach NORDEN (−z) gerückt: die linke Bildhälfte gehört
    // der DOM-Textspalte — die Karten leben in der rechten.
    const zC = portrait ? -0.7 : -1.0
    const yLift = portrait ? 0.7 : 0
    const placed: Placed[] = []
    LINE_ORDER.forEach((pos, line) => {
      const inLine = PLAYERS.filter((p) => p.position === pos)
      const n = inLine.length
      const spacing = Math.min(1.45, n > 1 ? 5.3 / (n - 1) : 0) * zk
      inLine.forEach((p, i) => {
        // TW/ABW-Reihen einen Tick weiter nach Norden — sie ragen sonst
        // links in Headline bzw. Textspalte
        const z = (i - (n - 1) / 2) * spacing + zC + (line === 0 ? -0.35 : line === 1 ? -0.55 : 0)
        placed.push({
          player: p,
          x: LINE_X[pos],
          y: CY + LINE_LIFT[line] + yLift,
          z,
          line,
          scale: 1,
          phase: (line * 2.1 + i) * 1.37,
          tex: makePlayerCardTexture(p, !!p.isPlayerOfMonth).texture,
        })
      })
    })
    // Trainerstab an der Süd-Seitenlinie, bodennah und klar VOR der Wand —
    // eigene kleine Reihe, verdeckt nichts.
    STAFF.filter((m) => !m.isPlaceholder).forEach((m, i) => {
      placed.push({
        staff: m,
        x: 1.15 + i * 1.5,
        y: 1.12 + yLift * 0.5,
        z: 2.6 * zk,
        line: 4,
        scale: 0.75,
        phase: 9.1 + i * 1.7,
        tex: makeStaffCardTexture(m).texture,
      })
    })
    return placed
  }, [])
}

function makeShadowTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 62)
  g.addColorStop(0, 'rgba(0,0,0,0.55)')
  g.addColorStop(0.6, 'rgba(0,0,0,0.22)')
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(cv)
}

const _launchTarget = new THREE.Vector3()
const _launchBase = new THREE.Vector3()
const _camDir = new THREE.Vector3()
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')
const _dummy = new THREE.Object3D()

export function PlayerCards3D() {
  const layout = useLayout()
  const { camera } = useThree()
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const groupRef = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const shadowRef = useRef<THREE.InstancedMesh>(null)
  const shadowTex = useMemo(() => makeShadowTexture(), [])
  // v13-K4: Tap-Launch — die angetippte Karte fliegt der Kamera entgegen,
  // DANN öffnet das Flip-Modal. Verkauft Kontinuität statt DOM-Bruch.
  const launch = useRef<{ i: number; t0: number } | null>(null)
  // v13-K4: gemeinsame Glint-Zeit für den Foil-Sweep aller Karten.
  const glintT = useRef({ value: 0 })
  // Wand-Zentrum (für den gemeinsamen Yaw)
  const wallCenter = useMemo(() => {
    const c = new THREE.Vector3()
    layout.forEach((p) => c.add(_dummy.position.set(p.x, p.y, p.z)))
    return c.divideScalar(layout.length)
  }, [layout])

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
    const t = state.clock.elapsedTime
    // EIN Wand-Yaw für alle Karten (koherente Wand statt Fächer) + Rücklage
    const wallYaw = Math.atan2(camera.position.x - wallCenter.x, camera.position.z - wallCenter.z)
    const shadows = shadowRef.current
    let anyVisible = false
    for (let i = 0; i < layout.length; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const item = layout[i]
      const lineReveal = THREE.MathUtils.clamp((rp - item.line * 0.1) / 0.3, 0, 1)
      const alpha = lineReveal * fo
      const mat = m.material as THREE.MeshBasicMaterial
      mat.opacity = alpha
      // Fade nur solange nötig — deckende Karten schreiben Tiefe → saubere
      // Verdeckung ohne Geister-Durchschein.
      mat.depthWrite = alpha > 0.55
      const ease = lineReveal * lineReveal * (3 - 2 * lineReveal)
      const s = (0.72 + 0.28 * ease) * item.scale
      m.scale.set(CARD_W * s, CARD_H * s, 1)
      m.visible = alpha > 0.02
      if (m.visible) {
        anyVisible = true
        // dezentes Schweben (individuelle Phase) + gemeinsame Orientierung
        const bob = Math.sin(t * 0.65 + item.phase) * 0.02
        m.position.set(item.x, item.y + bob - (1 - ease) * 0.3, item.z)
        _euler.set(-0.1, wallYaw, Math.sin(t * 0.4 + item.phase) * 0.014)
        m.quaternion.setFromEuler(_euler)
      }
      // v13-K4: Launch-Animation überlagert Reveal-Pose
      const L = launch.current
      if (L && L.i === i) {
        const k = Math.min(1, (performance.now() - L.t0) / 240)
        const e2 = k * k * (3 - 2 * k)
        camera.getWorldDirection(_camDir)
        _launchTarget.copy(camera.position).addScaledVector(_camDir, 1.15)
        _launchBase.set(item.x, item.y, item.z)
        m.position.lerpVectors(_launchBase, _launchTarget, e2)
        const ls = s * (1 + 0.55 * e2)
        m.scale.set(CARD_W * ls, CARD_H * ls, 1)
        m.rotation.y += e2 * 0.35
        m.visible = true
        anyVisible = true
        if (k >= 1) launch.current = null
      }
      // Schatten-Blob: skaliert mit dem Reveal (Scale 0 = aus)
      if (shadows) {
        const sh = ease * fo * item.scale
        _dummy.position.set(item.x, 0.012, item.z)
        _dummy.rotation.set(-Math.PI / 2, 0, 0)
        // höhere Karten → größerer, weicherer (per Scale) Schatten
        const spread = 0.62 + LINE_LIFT[Math.min(item.line, 3)] * 0.1
        _dummy.scale.set(sh * spread * 1.5, sh * spread, 1)
        _dummy.updateMatrix()
        shadows.setMatrixAt(i, _dummy.matrix)
      }
    }
    if (shadows) shadows.instanceMatrix.needsUpdate = true
    g.visible = anyVisible
  })

  return (
    <group ref={groupRef}>
      {layout.map((item, i) => (
        <mesh
          key={item.player?.id ?? item.staff?.id ?? i}
          ref={(el) => (meshes.current[i] = el)}
          position={[item.x, item.y, item.z]}
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
      {/* Erdung: EIN instanzierter Schatten-Blob-Satz für alle Karten */}
      <instancedMesh ref={shadowRef} args={[undefined, undefined, layout.length]} frustumCulled={false} renderOrder={1}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
