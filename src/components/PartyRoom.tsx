import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { ROOM_Y, ROOM } from '../camera/partyPath'

// ─────────────────────────────────────────────────────────────
// Der Partyraum im Vereinsheim — v5 nach Marvins Raumbeschreibung:
// QUADRATISCHER Raum, man kommt durch die Gebäudetür in einen
// kurzen FLUR (Kamera läuft +x), dann RECHTS (Süden) durch die
// Türöffnung in den Raum; aus Eingangssicht steht der TRESEN
// HINTEN AN DER LINKEN SEITE (= Ost-Wand, Süd-Hälfte).
// Lebt weiter als Pocket-Dimension bei y = −40 (lazy geladen);
// die Durchfahrt (camera/partyPath.ts) hoppt im Tür-Glow hinein.
// Look: dunkel, warm, Lichterkette in SVA-Rot, Poster, Neon.
// ─────────────────────────────────────────────────────────────

const H = ROOM.size / 2 // 1.6

function svaNeonTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 96
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, 256, 96)
  ctx.font = '400 64px Anton, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = '#ff2230'
  ctx.shadowBlur = 22
  ctx.fillStyle = '#ff5560'
  ctx.fillText('SVA', 128, 50)
  ctx.shadowBlur = 8
  ctx.fillStyle = '#ffd9dc'
  ctx.fillText('SVA', 128, 50)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// Stilisierte Figur (wie im Fanblock — keine Gesichter).
function Person({ pos, jersey, h = 0.19, rot = 0, seated = false, lean = 0 }: {
  pos: [number, number, number]; jersey: string; h?: number; rot?: number; seated?: boolean; lean?: number
}) {
  const legH = seated ? h * 0.2 : h * 0.54
  const base = seated ? 0.18 : 0
  return (
    <group position={[pos[0], pos[1] + base, pos[2]]} rotation-y={rot} rotation-z={lean}>
      <mesh position={[0, legH / 2, 0]}>
        <cylinderGeometry args={[h * 0.11, h * 0.13, legH, 6]} />
        <meshStandardMaterial color="#17141a" roughness={0.95} />
      </mesh>
      <mesh position={[0, legH + h * 0.18, 0]}>
        <cylinderGeometry args={[h * 0.16, h * 0.13, h * 0.36, 7]} />
        <meshStandardMaterial color={jersey} roughness={0.85} />
      </mesh>
      <mesh position={[0, legH + h * 0.43, 0]}>
        <sphereGeometry args={[h * 0.115, 8, 7]} />
        <meshStandardMaterial color="#c99a75" roughness={0.9} />
      </mesh>
    </group>
  )
}

// Zapf-Loop: der Arm des Barkeepers senkt sich zyklisch zum Hahn.
// (Gruppe nach Westen orientiert — Barkeeper steht ÖSTLICH des
// Tresens und schaut in den Raum.)
function ZapfArm() {
  const ref = useRef<THREE.Mesh>(null)
  useFrame((state) => {
    if (!ref.current) return
    const t = state.clock.elapsedTime
    ref.current.rotation.x = 0.7 + Math.sin(t * 1.6) * 0.18
  })
  return (
    <group position={[1.38, 0, 0.88]} rotation-y={Math.PI / 2}>
      <mesh ref={ref} position={[0.04, 0.135, 0.04]}>
        <cylinderGeometry args={[0.011, 0.011, 0.1, 5]} />
        <meshStandardMaterial color="#1d1a1c" roughness={0.85} />
      </mesh>
    </group>
  )
}

// Prosten: Gast hebt periodisch das Glas
function ProstArm() {
  const ref = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (ref.current) ref.current.rotation.z = -0.5 - Math.max(0, Math.sin(t * 0.9)) * 0.5
  })
  return (
    <group ref={ref} position={[0.62, 0.33, 0.42]}>
      <mesh position={[0, 0.045, 0]}>
        <cylinderGeometry args={[0.009, 0.009, 0.09, 5]} />
        <meshStandardMaterial color="#d8d4c9" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.013, 0.011, 0.045, 6]} />
        <meshStandardMaterial color="#e8a832" emissive="#c8871a" emissiveIntensity={0.7} roughness={0.3} />
      </mesh>
    </group>
  )
}

const WALL_MAT = { roughness: 0.95 } as const

// Tresen-Platte mit Maserung (v5 Mikro-Detail — Kamera kommt nah)
function makeWoodTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 64
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#6a4c30'
  ctx.fillRect(0, 0, 256, 64)
  for (let i = 0; i < 26; i++) {
    const y = Math.random() * 64
    ctx.strokeStyle = `rgba(${30 + Math.random() * 30},${18 + Math.random() * 14},8,${0.12 + Math.random() * 0.18})`
    ctx.lineWidth = 0.8 + Math.random() * 1.6
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.bezierCurveTo(80, y + Math.random() * 6 - 3, 170, y + Math.random() * 6 - 3, 256, y + Math.random() * 4 - 2)
    ctx.stroke()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

export default function PartyRoom() {
  const cover = useTexture('/audio/cover.jpg')
  cover.colorSpace = THREE.SRGBColorSpace
  const neon = useMemo(svaNeonTexture, [])
  const wood = useMemo(makeWoodTexture, [])

  // Lichterkette: zwei durchhängende Bögen — Süd-Wand + Ost-Wand
  const bulbs = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 11; i++) {
      const t = i / 11
      pts.push([-1.5 + t * 3.0, 1.32 - Math.sin(t * Math.PI) * 0.14, H - 0.06])
    }
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      pts.push([H - 0.06, 1.3 - Math.sin(t * Math.PI) * 0.12, 1.35 - t * 2.5])
    }
    return pts
  }, [])

  const { hall, opening } = ROOM

  return (
    <group position={[0, ROOM_Y, 0]}>
      {/* ── Raum-Hülle: QUADRAT 3.2×3.2 ── */}
      <mesh rotation-x={-Math.PI / 2}>
        <planeGeometry args={[ROOM.size, ROOM.size]} />
        <meshStandardMaterial color="#33241a" {...WALL_MAT} roughness={0.9} />
      </mesh>
      {/* Süd-Wand (hinten aus Eingangssicht) */}
      <mesh position={[0, ROOM.height / 2, H]} rotation-y={Math.PI}>
        <planeGeometry args={[ROOM.size, ROOM.height]} />
        <meshStandardMaterial color="#2b2422" {...WALL_MAT} />
      </mesh>
      {/* Ost-Wand (links vom Eingang — hier lebt der Tresen) */}
      <mesh position={[H, ROOM.height / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[ROOM.size, ROOM.height]} />
        <meshStandardMaterial color="#292220" {...WALL_MAT} />
      </mesh>
      {/* West-Wand */}
      <mesh position={[-H, ROOM.height / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ROOM.size, ROOM.height]} />
        <meshStandardMaterial color="#2e2724" {...WALL_MAT} />
      </mesh>
      {/* Nord-Wand mit TÜRÖFFNUNG (x −1.12…−0.5, Höhe 1.05) —
          drei Segmente: links, rechts, Sturz. DoubleSide, weil der
          Flur dahinter liegt. */}
      {(() => {
        const segs: { x: number; w: number; y: number; h: number }[] = [
          { x: (-H + opening.x1) / 2, w: opening.x1 - -H, y: ROOM.height / 2, h: ROOM.height },
          { x: (opening.x2 + H) / 2, w: H - opening.x2, y: ROOM.height / 2, h: ROOM.height },
          {
            x: (opening.x1 + opening.x2) / 2,
            w: opening.x2 - opening.x1,
            y: (opening.height + ROOM.height) / 2,
            h: ROOM.height - opening.height,
          },
        ]
        return segs.map((s, i) => (
          <mesh key={i} position={[s.x, s.y, -H]}>
            <planeGeometry args={[s.w, s.h]} />
            <meshStandardMaterial color="#2b2320" {...WALL_MAT} side={THREE.DoubleSide} />
          </mesh>
        ))
      })()}
      {/* Decke */}
      <mesh rotation-x={Math.PI / 2} position={[0, ROOM.height, 0]}>
        <planeGeometry args={[ROOM.size, ROOM.size]} />
        <meshStandardMaterial color="#1c1715" roughness={1} />
      </mesh>

      {/* ── FLUR nördlich (Kamera kommt in +x durchgelaufen) ── */}
      <mesh rotation-x={-Math.PI / 2} position={[(hall.xMin + hall.xMax) / 2, 0, (hall.zMin + hall.zMax) / 2]}>
        <planeGeometry args={[hall.xMax - hall.xMin, hall.zMax - hall.zMin]} />
        <meshStandardMaterial color="#2d201a" roughness={0.9} />
      </mesh>
      <mesh position={[(hall.xMin + hall.xMax) / 2, hall.height / 2, hall.zMin]}>
        <planeGeometry args={[hall.xMax - hall.xMin, hall.height]} />
        <meshStandardMaterial color="#292320" {...WALL_MAT} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[(hall.xMin + hall.xMax) / 2, hall.height, (hall.zMin + hall.zMax) / 2]}>
        <planeGeometry args={[hall.xMax - hall.xMin, hall.zMax - hall.zMin]} />
        <meshStandardMaterial color="#1c1715" roughness={1} />
      </mesh>
      {/* Flur-Ostende (Sackgasse hinter der Türöffnung) */}
      <mesh position={[hall.xMax, hall.height / 2, (hall.zMin + hall.zMax) / 2]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[hall.zMax - hall.zMin, hall.height]} />
        <meshStandardMaterial color="#241e1b" {...WALL_MAT} />
      </mesh>
      {/* Innenseite der Gebäudetür: warmes Glow-Quad — deckt den
          Hop (rein wie raus) und erzählt „draußen ist der Platz" */}
      <mesh position={[ROOM.innerDoorX - 0.015, hall.height / 2 - 0.06, hall.z]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[hall.zMax - hall.zMin + 0.1, hall.height + 0.12]} />
        <meshBasicMaterial color={[2.3, 1.5, 0.85]} toneMapped={false} />
      </mesh>
      {/* Garderoben-Detail im Flur: Haken + Schal */}
      <mesh position={[-1.6, 0.62, hall.zMin + 0.012]}>
        <boxGeometry args={[0.5, 0.025, 0.02]} />
        <meshStandardMaterial color="#3c2c1e" roughness={0.9} />
      </mesh>
      <mesh position={[-1.72, 0.5, hall.zMin + 0.03]}>
        <planeGeometry args={[0.05, 0.22]} />
        <meshStandardMaterial color="#c41824" side={THREE.DoubleSide} roughness={0.9} />
      </mesh>

      {/* ── TRESEN — hinten links aus Eingangssicht (Ost-Wand,
             Süd-Hälfte), Front zeigt nach Westen in den Raum ── */}
      <group position={[1.22, 0, 0.68]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[1.5, 0.28, 0.34]} />
          <meshStandardMaterial color="#4a3423" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.29, 0]}>
          <boxGeometry args={[1.58, 0.03, 0.42]} />
          <meshStandardMaterial map={wood} roughness={0.5} metalness={0.1} />
        </mesh>
        {/* Zapfhahn */}
        <mesh position={[0.25, 0.37, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.13, 6]} />
          <meshStandardMaterial color="#c9ccd4" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* zwei gezapfte Biere — mit Schaumkrone */}
        {[-0.15, 0.02].map((x) => (
          <group key={x}>
            <mesh position={[x, 0.335, -0.08]}>
              <cylinderGeometry args={[0.014, 0.012, 0.05, 6]} />
              <meshStandardMaterial color="#e8a832" emissive="#c8871a" emissiveIntensity={0.6} roughness={0.3} />
            </mesh>
            <mesh position={[x, 0.363, -0.08]}>
              <cylinderGeometry args={[0.0135, 0.014, 0.012, 6]} />
              <meshStandardMaterial color="#f3ead6" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Bierkiste neben dem Tresen + warmer Teppich davor */}
      <group position={[1.32, 0, 1.42]} rotation-y={0.4}>
        <mesh position={[0, 0.05, 0]}>
          <boxGeometry args={[0.24, 0.1, 0.17]} />
          <meshStandardMaterial color="#8a1d1d" roughness={0.85} />
        </mesh>
        {[-0.07, 0, 0.07].map((x) => (
          <mesh key={x} position={[x, 0.115, 0]}>
            <cylinderGeometry args={[0.006, 0.012, 0.035, 5]} />
            <meshStandardMaterial color="#5a3418" roughness={0.4} />
          </mesh>
        ))}
      </group>
      <mesh rotation-x={-Math.PI / 2} position={[0.72, 0.004, 0.68]}>
        <planeGeometry args={[0.85, 1.5]} />
        <meshStandardMaterial color="#4a1d1a" roughness={1} />
      </mesh>

      {/* Regal mit Flaschen an der Ost-Wand hinterm Tresen */}
      <group position={[1.56, 0.62, 0.68]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 0.1, -0.075]}>
          <planeGeometry args={[1.44, 0.3]} />
          <meshStandardMaterial color="#1e1512" roughness={0.95} />
        </mesh>
        <mesh>
          <boxGeometry args={[1.4, 0.03, 0.16]} />
          <meshStandardMaterial color="#3c2c1e" roughness={0.9} />
        </mesh>
        {[-0.55, -0.35, -0.12, 0.1, 0.32, 0.55].map((x, i) => {
          const c = ['#3a6b35', '#7a3020', '#c8a038', '#3a5a7a', '#6a3a5a', '#4a4a30'][i]
          return (
            <group key={x}>
              <mesh position={[x, 0.055, 0]}>
                <cylinderGeometry args={[0.017, 0.019, 0.08, 6]} />
                <meshStandardMaterial color={c} roughness={0.3} emissive="#181008" emissiveIntensity={0.4} />
              </mesh>
              <mesh position={[x, 0.115, 0]}>
                <cylinderGeometry args={[0.006, 0.014, 0.045, 5]} />
                <meshStandardMaterial color={c} roughness={0.3} emissive="#181008" emissiveIntensity={0.4} />
              </mesh>
            </group>
          )
        })}
      </group>

      {/* Barkeeper hinterm Tresen (östlich, leicht vorgelehnt) */}
      <Person pos={[1.44, 0, 0.88]} jersey="#1d1a1c" h={0.215} rot={Math.PI / 2 + 0.1} lean={0.05} />
      <ZapfArm />
      {/* Gäste: sitzen auf Hockern vor dem Tresen, einer prostet */}
      <Person pos={[0.68, 0, 0.28]} jersey="#c41824" rot={-Math.PI / 2} seated lean={-0.04} />
      <Person pos={[0.66, 0, 0.95]} jersey="#d8d4c9" rot={-Math.PI / 2 + 0.4} seated lean={0.06} />
      <ProstArm />
      {/* Hocker */}
      {[0.28, 0.95].map((z) => (
        <mesh key={z} position={[0.67, 0.09, z]}>
          <cylinderGeometry args={[0.05, 0.05, 0.18, 7]} />
          <meshStandardMaterial color="#2c2320" roughness={0.9} />
        </mesh>
      ))}

      {/* Cover-2-Poster mit Rahmen — Süd-Wand (Blickfang der Totale) */}
      <group position={[-0.75, 0.85, H - 0.03]} rotation-y={Math.PI}>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[0.66, 0.66]} />
          <meshStandardMaterial color="#151110" roughness={0.7} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.6, 0.6]} />
          <meshStandardMaterial map={cover} roughness={0.7} />
        </mesh>
      </group>

      {/* SVA-Neon über dem Tresen (Ost-Wand) */}
      <mesh position={[H - 0.04, 1.05, 0.68]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[0.66, 0.25]} />
        {/* Farb-Boost > 1: Neon glüht im selektiven Bloom */}
        <meshBasicMaterial map={neon} transparent toneMapped={false} color={[1.7, 1.7, 1.7]} />
      </mesh>

      {/* Lichterkette (SVA-Rot + warm im Wechsel) */}
      {bulbs.map((p, i) => (
        <mesh key={i} position={p}>
          <sphereGeometry args={[0.016, 6, 5]} />
          <meshStandardMaterial
            color={i % 2 ? '#ff5560' : '#ffca7a'}
            emissive={i % 2 ? '#e91d29' : '#ff9d3f'}
            emissiveIntensity={2.4}
            toneMapped={false}
          />
        </mesh>
      ))}

      {/* Licht: warm + roter Akzent + West-Fill + Flur-Schein */}
      <pointLight position={[0.2, 1.2, 0.2]} intensity={6.5} distance={7} color="#ffb26a" />
      <pointLight position={[1.0, 1.0, 1.1]} intensity={2.4} distance={5} color="#e91d29" />
      <pointLight position={[-0.7, 0.7, -0.6]} intensity={1.8} distance={4} color="#ffd9a0" />
      <pointLight position={[-1.1, 1.0, 0.5]} intensity={1.2} distance={4} color="#ff9d6a" />
      <pointLight position={[-1.5, 0.65, hall.z]} intensity={2.2} distance={3.5} color="#ffb26a" />
      <pointLight position={[-0.81, 0.75, -1.7]} intensity={1.5} distance={2.5} color="#ffca8a" />
    </group>
  )
}
