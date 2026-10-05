import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { whatsappUrl, whatsappReady } from '../data/content'
import { useStore } from '../store/useStore'
import { cameraState } from '../camera/CameraPath'
import { TEAM_CARDS, TEAM_CENTER, TEAM_PLAYERS, DUGOUT, teamState, type TeamCard } from '../camera/teamLayout'
import { makePlayerCardTexture, makeStaffCardTexture, CARD_TEX_ASPECT } from '../three/playerCardTexture'

// ─────────────────────────────────────────────────────────────
// v14-D „Startelf-Flyover": Die Startelf steht in echter Formation
// (LINEUP + FORMATION_SLOTS) als GROSSE, AUFRECHTE Karten in der
// eigenen Hälfte, die Bank als Reihe kleinerer Karten an der Süd-
// Seitenlinie (Coaching-Zone), der Trainerstab daneben.
//  · Karten drehen sich leicht zur Kamera: gemeinsamer Team-Yaw
//    (Blick vom Formations-Schwerpunkt zur Kamera) + begrenzter
//    Einzel-Yaw je Karte (±0.45 rad), weich gedämpft
//  · v15-P: kein Person-für-Person-Fokus mehr (Heben/Glanz/Licht-Teller
//    entfallen) — alle Karten gleichwertig, nur ein dezenter Glanz-Lauf
//  · Kontaktschatten (instanziert) erden jede Karte
// Klick → Tap-Launch (Karte fliegt zur Kamera) → Flip-Detail-Modal.
// Mobil (≤640px) gibt es KEIN 3D-Kartenfeld — dort trägt das DOM-
// Taktik-Board (v14-M).
// v14-M „Ganzer Platz": Elf über die volle Feldlänge, Bank in einem
// schlichten Unterstand AUSSERHALB der Südlinie auf Höhe der Mittellinie
// (wächst mit der Bank-Reihe aus dem Rasen).
// ─────────────────────────────────────────────────────────────

const MANN_U = 2 / 7
const NARROW_QUERY = '(max-width: 640px)'
const START_YAW_LIMIT = 0.45
const BENCH_YAW_LIMIT = 0.9
const LEAN = -0.07 // leichte Rücklage → Karte „schaut" zur erhöhten Kamera

function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}
function wrapAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function makeBlobTexture(inner: string, outer: string): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 62)
  g.addColorStop(0, inner)
  g.addColorStop(0.55, outer)
  g.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 128, 128)
  return new THREE.CanvasTexture(cv)
}

// ─── Unterstand (Ersatzbank) ─────────────────────────────────
// Schlicht: Rückwand, zwei Seitenscheiben, Dach mit roter Kante, rote
// Sitzschale. Ursprung am Boden → scale.y lässt ihn aus dem Rasen wachsen.
function Dugout({ groupRef }: { groupRef: React.RefObject<THREE.Group | null> }) {
  const len = DUGOUT.x1 - DUGOUT.x0
  const cx = (DUGOUT.x0 + DUGOUT.x1) / 2
  const d = DUGOUT.depth
  const h = DUGOUT.height
  return (
    <group ref={groupRef} position={[cx, 0, DUGOUT.z]} scale={[1, 0.001, 1]} visible={false}>
      {/* Rückwand */}
      <mesh position={[0, h / 2, d / 2 - 0.01]}>
        <boxGeometry args={[len, h, 0.02]} />
        <meshStandardMaterial color="#1b1c22" roughness={0.8} />
      </mesh>
      {/* Seitenscheiben */}
      {[-1, 1].map((sx) => (
        <mesh key={sx} position={[(sx * len) / 2, h / 2, 0]}>
          <boxGeometry args={[0.02, h, d]} />
          <meshStandardMaterial color="#3a4250" roughness={0.3} metalness={0.2} />
        </mesh>
      ))}
      {/* Dach, leicht zur Spielfeldseite geneigt */}
      <mesh position={[0, h + 0.008, -0.01]} rotation-x={0.08}>
        <boxGeometry args={[len + 0.06, 0.016, d + 0.08]} />
        <meshStandardMaterial color="#2a2d35" roughness={0.6} />
      </mesh>
      <mesh position={[0, h - 0.004, -d / 2 - 0.045]}>
        <boxGeometry args={[len + 0.06, 0.03, 0.012]} />
        <meshStandardMaterial color="#c8102e" roughness={0.5} emissive="#5a0612" emissiveIntensity={0.6} />
      </mesh>
      {/* Sitzschale */}
      <mesh position={[0, 0.1, d / 2 - 0.07]}>
        <boxGeometry args={[len - 0.08, 0.035, 0.09]} />
        <meshStandardMaterial color="#b3122a" roughness={0.55} />
      </mesh>
      <mesh position={[0, 0.17, d / 2 - 0.025]}>
        <boxGeometry args={[len - 0.08, 0.12, 0.02]} />
        <meshStandardMaterial color="#b3122a" roughness={0.55} />
      </mesh>
    </group>
  )
}

interface Placed extends TeamCard {
  tex: THREE.CanvasTexture
}

const _launchTarget = new THREE.Vector3()
const _camDir = new THREE.Vector3()
const _euler = new THREE.Euler(0, 0, 0, 'YXZ')
const _dummy = new THREE.Object3D()

export function PlayerCards3D() {
  const narrow = useNarrow()
  if (narrow) return null
  return <CardField />
}

function CardField() {
  const { camera, gl } = useThree()
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const aniso = Math.min(8, gl.capabilities.getMaxAnisotropy())
  const layout: Placed[] = useMemo(
    () =>
      TEAM_CARDS.map((c) => ({
        ...c,
        tex: c.player
          ? makePlayerCardTexture(c.player, c.kind === 'start' ? 640 : 384, aniso).texture
          : makeStaffCardTexture(c.staff!, 384, aniso).texture,
      })),
    [aniso],
  )
  // Geometrie mit Ursprung an der Unterkante → Karte steht auf dem Rasen.
  const geom = useMemo(() => {
    const g = new THREE.PlaneGeometry(1, CARD_TEX_ASPECT)
    g.translate(0, CARD_TEX_ASPECT / 2, 0)
    return g
  }, [])
  const groupRef = useRef<THREE.Group>(null)
  const dugoutRef = useRef<THREE.Group>(null)
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const shadowRef = useRef<THREE.InstancedMesh>(null)
  const shadowTex = useMemo(() => makeBlobTexture('rgba(0,0,0,0.62)', 'rgba(0,0,0,0.25)'), [])
  const yaw = useRef<number[]>(layout.map(() => 0))
  const glintT = useRef({ value: 0 })
  // v13-K4: Tap-Launch — die angetippte Karte fliegt der Kamera entgegen,
  // DANN öffnet das Flip-Modal.
  const launch = useRef<{ i: number; t0: number } | null>(null)

  // Dezenter Glanz-Lauf in die Basic-Materialien injizieren (einmalig).
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
#ifdef USE_MAP
  float glintBand = abs(fract(vMapUv.x * 0.8 - vMapUv.y * 0.42 + uGlintT * 0.035) - 0.5) - 0.05;
  float glint = smoothstep(0.05, 0.0, glintBand);
  diffuseColor.rgb += glint * vec3(1.0, 0.92, 0.8) * 0.06 * diffuseColor.a;
#endif`,
          )
      }
      mat.customProgramCacheKey = () => 'sva-card-v15p'
      mat.needsUpdate = true
    })
  }, [layout])

  useFrame((state, delta) => {
    const g = groupRef.current
    if (!g) return
    const u = cameraState.u
    // Ankunft aus dem Anstoß: Reihen wachsen nacheinander aus dem Rasen
    // (Sturm zuerst — die Kamera kommt von dort). Ausflug Richtung Fanblock:
    // die Karten tauchen zurück in den Rasen, bevor die Kamera sie kreuzt.
    const rp = smoothstep(0.19, MANN_U, u)
    const fo = 1 - smoothstep(MANN_U + 0.006, MANN_U + 0.05, u)
    if (rp <= 0 || fo <= 0) {
      g.visible = false
      return
    }
    g.visible = true
    // v14-M: Bank + Stab (line 4) kommen erst dazu, wenn die Kamera über
    // die Nordseite schwenkt und die Südlinie quer im Bild hat — im
    // Establishing-Shot stünden sie sonst unter der Textspalte. Der
    // Unterstand wächst mit ihnen aus dem Rasen.
    const benchR = smoothstep(0.2, 0.42, teamState.s)
    const dg = dugoutRef.current
    if (dg) {
      const de = benchR * fo
      dg.scale.y = Math.max(0.001, de)
      dg.visible = de > 0.01
    }
    const t = state.clock.elapsedTime
    glintT.current.value = t
    const camX = camera.position.x
    const camZ = camera.position.z
    const teamYaw = Math.atan2(camX - TEAM_CENTER.x, camZ - TEAM_CENTER.z)
    const shadows = shadowRef.current
    const k = 1 - Math.exp(-8 * delta)

    for (let i = 0; i < layout.length; i++) {
      const m = meshes.current[i]
      if (!m) continue
      const item = layout[i]
      const lineReveal = item.line >= 4 ? benchR : THREE.MathUtils.clamp((rp - item.line * 0.12) / 0.4, 0, 1)
      const ease = lineReveal * lineReveal * (3 - 2 * lineReveal)
      const alpha = ease * fo
      const mat = m.material as THREE.MeshBasicMaterial
      mat.opacity = alpha
      mat.depthWrite = alpha > 0.9
      m.visible = alpha > 0.01

      // Yaw: Team-Yaw + begrenzter Einzel-Yaw (Startelf) bzw. Blick
      // Richtung Platz mit Spielraum (Bank/Stab an der Südlinie).
      const az = Math.atan2(camX - item.x, camZ - item.z)
      const base = item.kind === 'start' ? teamYaw : Math.PI
      const lim = item.kind === 'start' ? START_YAW_LIMIT : BENCH_YAW_LIMIT
      const target = base + THREE.MathUtils.clamp(wrapAngle(az - base), -lim, lim)
      if (!m.userData.yawInit) {
        yaw.current[i] = target
        m.userData.yawInit = true
      }
      yaw.current[i] += wrapAngle(target - yaw.current[i]) * k

      const sc = item.w * (0.7 + 0.3 * ease)
      m.position.set(item.x, -(1 - ease) * 0.25, item.z)
      m.scale.set(sc, sc, sc)
      _euler.set(LEAN, yaw.current[i], 0)
      m.quaternion.setFromEuler(_euler)

      // Tap-Launch überlagert die Pose
      const L = launch.current
      if (L && L.i === i) {
        const lk = Math.min(1, (performance.now() - L.t0) / 240)
        const e2 = lk * lk * (3 - 2 * lk)
        camera.getWorldDirection(_camDir)
        _launchTarget.copy(camera.position).addScaledVector(_camDir, 1.4)
        _launchTarget.y -= 0.5
        m.position.lerp(_launchTarget, e2)
        m.quaternion.slerp(camera.quaternion, e2)
        m.visible = true
        if (lk >= 1) launch.current = null
      }

      if (shadows) {
        const sh = ease * fo
        _dummy.position.set(item.x, 0.012, item.z)
        _dummy.rotation.set(-Math.PI / 2, 0, -yaw.current[i])
        _dummy.scale.set(item.w * 1.35 * sh, item.w * 0.5 * sh, 1)
        _dummy.updateMatrix()
        shadows.setMatrixAt(i, _dummy.matrix)
      }
    }
    if (shadows) shadows.instanceMatrix.needsUpdate = true
  })

  return (
    <group ref={groupRef} visible={false}>
      {layout.map((item, i) => (
        <mesh
          key={item.player?.id ?? item.staff?.id ?? i}
          ref={(el) => (meshes.current[i] = el)}
          geometry={geom}
          position={[item.x, 0, item.z]}
          visible={false}
          onClick={(e) => {
            e.stopPropagation()
            if (item.player) {
              launch.current = { i, t0: performance.now() }
              const p = item.player
              setTimeout(() => setSelected(p, TEAM_PLAYERS), 230)
            } else if (item.staff?.contactMessage) {
              // v13-E4: mailto-Fallback darf nicht in einen Blank-Tab
              const url = whatsappUrl(item.staff.contactMessage)
              if (whatsappReady) window.open(url, '_blank')
              else window.location.href = url
            }
          }}
          onPointerOver={() => {
            if (item.player || item.staff?.contactMessage) document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => (document.body.style.cursor = '')}
        >
          {/* fog=false → Karten bleiben auch in der Tiefe scharf lesbar. */}
          <meshBasicMaterial
            map={item.tex}
            transparent
            alphaTest={0.04}
            opacity={0}
            side={THREE.DoubleSide}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>
      ))}
      <Dugout groupRef={dugoutRef} />
      <instancedMesh ref={shadowRef} args={[undefined, undefined, layout.length]} frustumCulled={false} renderOrder={0}>
        <planeGeometry args={[1, 1]} />
        <meshBasicMaterial map={shadowTex} transparent depthWrite={false} toneMapped={false} />
      </instancedMesh>
    </group>
  )
}
