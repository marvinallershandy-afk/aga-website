import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'
import { ROOM_Y, ROOM } from '../camera/partyPath'
import { SKIN_TONES, HAIR_TONES } from '../three/humanGeometry'
import { getDoorGlowTexture } from './doorGlow'

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

const HX = ROOM.width / 2 // 1.6 (Ost-West-Halbbreite)
const ZN = ROOM.zNorth // -1.6 (Eingangswand)
const ZS = ROOM.zSouth // 4.8 (Südwand, hinten)
const ZC = ROOM.zCenter // 1.6 (Mitte, für Boden/Decke/Seitenwände)

// Stilisierte Figur (wie im Fanblock — keine Gesichter).
function Person({ pos, jersey, h = 0.19, rot = 0, seated = false, lean = 0 }: {
  pos: [number, number, number]; jersey: string; h?: number; rot?: number; seated?: boolean; lean?: number
}) {
  const legH = seated ? h * 0.2 : h * 0.54
  const base = seated ? 0.18 : 0
  // v14-E2: deterministische Haut-/Haar-Varianz aus der Position — auch das
  // Partyraum-Personal ist Publikum, keine Schaufensterpuppen.
  const seed = Math.abs(Math.sin(pos[0] * 12.9898 + pos[2] * 78.233)) * 43758.5453
  const skin = SKIN_TONES[Math.floor((seed % 1) * SKIN_TONES.length)]
  const hairPick = (seed * 7.13) % 1
  const hair = hairPick < 0.78 ? HAIR_TONES[Math.floor(((seed * 3.7) % 1) * HAIR_TONES.length)] : null
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
      {/* v13-K2: Arme mit Schulterkugel — vorher armlose Litfaßsäulen.
          Sitzend winkeln die Arme nach vorn Richtung Tisch. */}
      {[-1, 1].map((s) => (
        <group key={s}>
          <mesh position={[s * h * 0.15, legH + h * 0.29, 0]}>
            <sphereGeometry args={[h * 0.07, 7, 6]} />
            <meshStandardMaterial color={jersey} roughness={0.85} />
          </mesh>
          <mesh
            position={[s * h * 0.17, legH + h * (seated ? 0.2 : 0.12), seated ? h * 0.1 : 0]}
            rotation-z={s * 0.14}
            rotation-x={seated ? -0.7 : 0}
          >
            <cylinderGeometry args={[h * 0.042, h * 0.05, h * 0.34, 6]} />
            <meshStandardMaterial color={jersey} roughness={0.85} />
          </mesh>
        </group>
      ))}
      <mesh position={[0, legH + h * 0.43, 0]} scale={[1, 1.14, 0.94]}>
        <sphereGeometry args={[h * 0.111, 8, 7]} />
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
      {hair && (
        <mesh position={[0, legH + h * 0.47, -h * 0.008]} scale={[1, 0.82, 0.98]}>
          <sphereGeometry args={[h * 0.118, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={hair} roughness={0.96} />
        </mesh>
      )}
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

// v11-E4 (Audit #26): Biertisch-Garnitur (Tisch + zwei Bänke) — die
// Klassiker für Vereinsfeiern. Länge entlang z, Bänke links/rechts.
function BierGarnitur({ pos, rot = 0 }: { pos: [number, number, number]; rot?: number }) {
  const bench = (x: number) => (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[0.12, 0.02, 0.92]} />
        <meshStandardMaterial color="#6f5330" roughness={0.9} />
      </mesh>
      {[-0.4, 0.4].map((z) => (
        <mesh key={z} position={[0, 0.055, z]}>
          <boxGeometry args={[0.1, 0.11, 0.03]} />
          <meshStandardMaterial color="#4a3a22" roughness={0.9} />
        </mesh>
      ))}
    </group>
  )
  return (
    <group position={pos} rotation-y={rot}>
      {/* Tischplatte */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[0.34, 0.02, 1.0]} />
        <meshStandardMaterial color="#8a6a40" roughness={0.85} />
      </mesh>
      {[-0.35, 0.35].map((z) => (
        <mesh key={z} position={[0, 0.1, z]}>
          <boxGeometry args={[0.3, 0.11, 0.03]} />
          <meshStandardMaterial color="#5a4630" roughness={0.9} />
        </mesh>
      ))}
      {bench(-0.28)}
      {bench(0.28)}
    </group>
  )
}

const WALL_MAT = { roughness: 0.95 } as const

// v13-K3: Wimpelketten-Textur — durchhängende Schnur mit CI-Wimpeln.
// Als 2 Alpha-Planes quer durch den Saal statt 22 Einzel-Meshes.
function makePennantTexture(): THREE.CanvasTexture {
  const W = 512
  const H = 96
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!
  ctx.clearRect(0, 0, W, H)
  const sag = (t: number) => 14 + Math.sin(t * Math.PI) * 26
  ctx.strokeStyle = 'rgba(30,22,18,0.9)'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  for (let i = 0; i <= 40; i++) {
    const x = (i / 40) * W
    const y = sag(i / 40)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
  const cols = ['#e91d29', '#f2eee6', '#231F20']
  for (let i = 0; i < 11; i++) {
    const t = (i + 0.5) / 11
    const x = t * W
    const y = sag(t)
    ctx.fillStyle = cols[i % 3]
    ctx.beginPath()
    ctx.moveTo(x - 13, y)
    ctx.lineTo(x + 13, y)
    ctx.lineTo(x, y + 34)
    ctx.closePath()
    ctx.fill()
  }
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 4
  return t
}

// v13-K3: kleines Messing-Schild „MEISTER 2026" für die Pokal-Vitrine.
function makeTrophyLabelTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 256
  cv.height = 64
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#171210'
  ctx.fillRect(0, 0, 256, 64)
  ctx.strokeStyle = 'rgba(232,193,90,0.8)'
  ctx.lineWidth = 3
  ctx.strokeRect(4, 4, 248, 56)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e8c15a'
  ctx.font = '400 30px Anton, system-ui, sans-serif'
  ctx.fillText('MEISTER 2026', 128, 22)
  ctx.fillStyle = 'rgba(242,238,230,0.85)'
  ctx.font = '700 15px Archivo, system-ui, sans-serif'
  ctx.fillText('1. KREISKLASSE · STADE', 128, 46)
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

// v13-K3: Die Pokal-Vitrine an der Südwand — der Story-Payoff des Raums
// („Meister 2026") und zugleich der Blickfang am Ende des langen Saals,
// der vorher als leere Wand auslief.
function TrophyCase() {
  const label = useMemo(makeTrophyLabelTexture, [])
  return (
    <group position={[0, 0, ZS - 0.055]} rotation-y={Math.PI}>
      {/* dunkler Vitrinen-Korpus */}
      <mesh position={[0, 0.66, -0.02]}>
        <boxGeometry args={[0.92, 0.78, 0.04]} />
        <meshStandardMaterial color="#191311" roughness={0.85} />
      </mesh>
      {/* warme Innen-Rückwand */}
      <mesh position={[0, 0.66, -0.003]}>
        <planeGeometry args={[0.84, 0.7]} />
        <meshStandardMaterial color="#2a1d14" roughness={0.9} emissive="#57351a" emissiveIntensity={0.35} />
      </mesh>
      {/* Regalboden */}
      <mesh position={[0, 0.44, 0.03]}>
        <boxGeometry args={[0.84, 0.025, 0.12]} />
        <meshStandardMaterial color="#3c2c1e" roughness={0.8} />
      </mesh>
      {/* Pokal: Sockel, Kelch, Deckel — Gold mit Glanz */}
      <group position={[0, 0.455, 0.03]}>
        <mesh position={[0, 0.025, 0]}>
          <cylinderGeometry args={[0.045, 0.055, 0.05, 10]} />
          <meshStandardMaterial color="#2a2018" roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.075, 0]}>
          <cylinderGeometry args={[0.012, 0.02, 0.05, 8]} />
          <meshStandardMaterial color="#e8c15a" metalness={0.85} roughness={0.25} emissive="#8a6a1c" emissiveIntensity={0.4} />
        </mesh>
        <mesh position={[0, 0.145, 0]}>
          <cylinderGeometry args={[0.055, 0.028, 0.09, 12]} />
          <meshStandardMaterial color="#f2cf6a" metalness={0.9} roughness={0.2} emissive="#9a7620" emissiveIntensity={0.5} />
        </mesh>
        <mesh position={[0, 0.2, 0]}>
          <sphereGeometry args={[0.02, 8, 6]} />
          <meshStandardMaterial color="#f2cf6a" metalness={0.9} roughness={0.2} emissive="#9a7620" emissiveIntensity={0.5} />
        </mesh>
        {/* Henkel */}
        {[-1, 1].map((s) => (
          <mesh key={s} position={[s * 0.062, 0.15, 0]} rotation-z={s * 0.5}>
            <torusGeometry args={[0.022, 0.005, 6, 10, Math.PI * 1.3]} />
            <meshStandardMaterial color="#e8c15a" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
      </group>
      {/* Messing-Schild */}
      <mesh position={[0, 0.33, 0.012]}>
        <planeGeometry args={[0.34, 0.085]} />
        <meshStandardMaterial map={label} roughness={0.6} emissiveMap={label} emissive="#ffffff" emissiveIntensity={0.25} />
      </mesh>
      {/* Glas-Andeutung */}
      <mesh position={[0, 0.66, 0.055]}>
        <planeGeometry args={[0.86, 0.72]} />
        <meshStandardMaterial color="#aac4d4" transparent opacity={0.07} roughness={0.1} metalness={0.4} />
      </mesh>
      {/* warmes Vitrinen-Spot */}
      <pointLight position={[0, 0.95, 0.35]} intensity={1.6} distance={1.6} color="#ffd98a" />
    </group>
  )
}

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
  // Wand-Art (Higgsfield, REFERENZ/higgsfield/partyraum-poster-…):
  // DIY-Siebdruck-Poster im AGA-URKNALL-Vibe, mit Tape an der Wand
  const urknallPoster = useTexture('/audio/poster-urknall.webp')
  urknallPoster.colorSpace = THREE.SRGBColorSpace
  // v11-E4: echtes Vereins-Wappen (AGA-Logo) an der Wand statt „SVA"-Neon (Audit #27)
  const agaLogo = useTexture('/brand/aga-logo.png')
  agaLogo.colorSpace = THREE.SRGBColorSpace
  const wood = useMemo(makeWoodTexture, [])

  // Lichterkette: durchhängende Bögen entlang der langen Ost-Wand + über der Bar
  const bulbs = useMemo(() => {
    const pts: [number, number, number][] = []
    // über der Bar (Ost-Wand, Nord-Hälfte)
    for (let i = 0; i <= 9; i++) {
      const t = i / 9
      pts.push([HX - 0.06, 1.4 - Math.sin(t * Math.PI) * 0.12, -0.4 + t * 2.6])
    }
    // quer über den langen Saal (West→Ost), zwei Girlanden nach Süden
    for (const zBase of [1.9, 3.4]) {
      for (let i = 0; i <= 9; i++) {
        const t = i / 9
        pts.push([-1.45 + t * 2.9, 1.42 - Math.sin(t * Math.PI) * 0.16, zBase])
      }
    }
    return pts
  }, [])

  const { hall, opening } = ROOM
  // v13-K3: Dielenboden statt flacher Farbfläche
  const floorWood = useMemo(() => {
    const t = makeWoodTexture()
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(2.5, 5)
    return t
  }, [])
  const pennants = useMemo(makePennantTexture, [])

  return (
    <group position={[0, ROOM_Y, 0]}>
      {/* ── Raum-Hülle: LANGER SAAL 3.2 (x) × 6.4 (z), Mitte bei z=1.6 ── */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, ZC]}>
        <planeGeometry args={[ROOM.width, ROOM.length]} />
        <meshStandardMaterial map={floorWood} color="#8a6a4a" {...WALL_MAT} roughness={0.85} />
      </mesh>
      {/* Süd-Wand (hinten aus Eingangssicht, weit weg) */}
      <mesh position={[0, ROOM.height / 2, ZS]} rotation-y={Math.PI}>
        <planeGeometry args={[ROOM.width, ROOM.height]} />
        <meshStandardMaterial color="#2b2422" {...WALL_MAT} />
      </mesh>
      {/* Ost-Wand (links vom Eingang — hier lebt der Tresen) */}
      <mesh position={[HX, ROOM.height / 2, ZC]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[ROOM.length, ROOM.height]} />
        <meshStandardMaterial color="#292220" {...WALL_MAT} />
      </mesh>
      {/* West-Wand (mit Seitentür, s. u.) */}
      <mesh position={[-HX, ROOM.height / 2, ZC]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[ROOM.length, ROOM.height]} />
        <meshStandardMaterial color="#2e2724" {...WALL_MAT} />
      </mesh>
      {/* Nord-Wand mit TÜRÖFFNUNG (x −1.12…−0.5) — drei Segmente:
          links, rechts, Sturz. DoubleSide, weil der Flur dahinter liegt. */}
      {(() => {
        const segs: { x: number; w: number; y: number; h: number }[] = [
          { x: (-HX + opening.x1) / 2, w: opening.x1 - -HX, y: ROOM.height / 2, h: ROOM.height },
          { x: (opening.x2 + HX) / 2, w: HX - opening.x2, y: ROOM.height / 2, h: ROOM.height },
          {
            x: (opening.x1 + opening.x2) / 2,
            w: opening.x2 - opening.x1,
            y: (opening.height + ROOM.height) / 2,
            h: ROOM.height - opening.height,
          },
        ]
        return segs.map((s, i) => (
          <mesh key={i} position={[s.x, s.y, ZN]}>
            <planeGeometry args={[s.w, s.h]} />
            <meshStandardMaterial color="#2b2320" {...WALL_MAT} side={THREE.DoubleSide} />
          </mesh>
        ))
      })()}
      {/* Decke — v13-K3: wärmer + Balken, damit oben kein schwarzes Loch klafft */}
      <mesh rotation-x={Math.PI / 2} position={[0, ROOM.height, ZC]}>
        <planeGeometry args={[ROOM.width, ROOM.length]} />
        <meshStandardMaterial color="#292019" roughness={1} />
      </mesh>
      {[0.2, 1.9, 3.6].map((z) => (
        <mesh key={z} position={[0, ROOM.height - 0.035, z]}>
          <boxGeometry args={[ROOM.width, 0.07, 0.09]} />
          <meshStandardMaterial color="#241a13" roughness={0.9} />
        </mesh>
      ))}

      {/* v13-K3: Wimpelketten quer durch den Saal (2 Alpha-Planes) */}
      {[1.15, 2.75].map((z, i) => (
        <mesh key={z} position={[0, ROOM.height - 0.22, z]} rotation-y={i ? 0.06 : -0.05}>
          <planeGeometry args={[ROOM.width - 0.2, 0.28]} />
          <meshStandardMaterial map={pennants} transparent side={THREE.DoubleSide} roughness={0.9} alphaTest={0.15} />
        </mesh>
      ))}

      {/* v13-K3: Pokal-Vitrine als Blickfang am Ende des Saals */}
      <TrophyCase />

      {/* ── SEITENTÜR (Audit #25): angedeutete Tür in der West-Wand,
             links neben der Bar. Flache Laibung + Türblatt + „NOTAUSGANG"-
             Schimmer, damit sie klar als Tür liest. ── */}
      <group position={[-HX + 0.012, 0, 0.35]} rotation-y={Math.PI / 2}>
        <mesh position={[0, 0.5, 0]}>
          <planeGeometry args={[0.44, 0.94]} />
          <meshStandardMaterial color="#181413" roughness={0.9} />
        </mesh>
        <mesh position={[0, 0.5, 0.006]}>
          <planeGeometry args={[0.36, 0.86]} />
          <meshStandardMaterial color="#274a34" roughness={0.7} />
        </mesh>
        {/* schmaler warmer Spalt unter der Tür */}
        <mesh position={[0, 0.03, 0.008]}>
          <planeGeometry args={[0.36, 0.03]} />
          <meshBasicMaterial color="#ffcf8a" toneMapped={false} />
        </mesh>
        {/* Klinke */}
        <mesh position={[0.13, 0.5, 0.02]}>
          <boxGeometry args={[0.05, 0.02, 0.02]} />
          <meshStandardMaterial color="#c9ccd4" metalness={0.7} roughness={0.3} />
        </mesh>
      </group>

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
        <meshBasicMaterial map={getDoorGlowTexture()} color={[1.55, 1.5, 1.4]} toneMapped={false} />
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

      {/* Personal HINTER dem Tresen (östlich): Zapfer links am Hahn +
          zweite Bedienung, die Richtung Gäste schaut (v11-E4). */}
      <Person pos={[1.44, 0, 0.42]} jersey="#1d1a1c" h={0.215} rot={Math.PI / 2 + 0.1} lean={0.05} />
      <Person pos={[1.46, 0, 1.15]} jersey="#7a1016" h={0.208} rot={Math.PI / 2 - 0.15} />
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

      {/* ── TISCHE + BÄNKE (Audit #26): Biertisch-Garnituren im langen Saal,
             auf der West-Seite (rechts beim Reinkommen) + eine Reihe mittig.
             Ein paar sitzende Gäste beleben die Feier. ── */}
      <BierGarnitur pos={[-0.95, 0, 1.9]} rot={0.05} />
      <BierGarnitur pos={[-0.95, 0, 3.2]} rot={-0.04} />
      <BierGarnitur pos={[0.35, 0, 3.5]} rot={0.9} />
      {/* v13-K3: der lange Saal war ab z≈3.5 leer — eine Garnitur mehr
          und Gäste bis fast zur Vitrine, der Raum wirkt bewohnt. */}
      <BierGarnitur pos={[0.75, 0, 2.35]} rot={-0.85} />
      <Person pos={[-0.62, 0, 1.75]} jersey="#c41824" rot={-1.2} seated lean={0.04} />
      <Person pos={[-0.62, 0, 2.2]} jersey="#d8d4c9" rot={-1.9} seated lean={-0.05} />
      <Person pos={[-1.28, 0, 3.1]} jersey="#2f5d8a" rot={1.4} seated lean={0.05} />
      <Person pos={[-1.28, 0, 3.45]} jersey="#3a6b35" rot={1.6} seated lean={-0.03} />
      <Person pos={[0.5, 0, 2.05]} jersey="#c41824" rot={2.4} seated lean={0.03} />
      <Person pos={[1.02, 0, 2.6]} jersey="#231F20" rot={-0.7} seated lean={-0.04} />
      {/* zwei stehen an der Vitrine und schauen auf den Pokal */}
      <Person pos={[-0.28, 0, 4.35]} jersey="#c41824" h={0.21} rot={0.25} lean={0.05} />
      <Person pos={[0.24, 0, 4.42]} jersey="#d8d4c9" h={0.2} rot={-0.3} lean={-0.04} />

      {/* AGA-URKNALL-Siebdruck (Wand-Art, leicht schief getaped) — Ost-Wand,
          südlich der Bar entlang des langen Saals */}
      <mesh position={[HX - 0.02, 0.86, 2.15]} rotation-y={-Math.PI / 2} rotation-z={0.03}>
        <planeGeometry args={[0.44, 0.62]} />
        <meshStandardMaterial map={urknallPoster} roughness={0.85} />
      </mesh>
      {/* Cover-2-Poster mit Rahmen — Ost-Wand weiter südlich */}
      <group position={[HX - 0.02, 0.82, 3.15]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[0.66, 0.66]} />
          <meshStandardMaterial color="#151110" roughness={0.7} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.6, 0.6]} />
          <meshStandardMaterial map={cover} roughness={0.7} />
        </mesh>
      </group>

      {/* v11-E4: echtes AGA-Wappen als beleuchtetes Wandschild über der Bar
          (Ost-Wand), statt „SVA"-Neon (Audit #27). Dunkles Schild + Wappen,
          leicht selbstleuchtend, damit es im dunklen Saal trägt. */}
      <group position={[HX - 0.03, 1.06, 0.5]} rotation-y={-Math.PI / 2}>
        <mesh position={[0, 0, -0.01]}>
          <planeGeometry args={[0.62, 0.62]} />
          <meshStandardMaterial color="#141013" roughness={0.85} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.5, 0.5]} />
          <meshBasicMaterial map={agaLogo} transparent toneMapped={false} color={[1.18, 1.18, 1.18]} />
        </mesh>
      </group>

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
      {/* v11-E4: warmes Fill für den langen Süd-Teil (Tische/Bänke) */}
      <pointLight position={[-0.3, 1.3, 2.3]} intensity={3.2} distance={6} color="#ffb87a" />
      <pointLight position={[0.2, 1.3, 3.6]} intensity={2.6} distance={6} color="#ff9d5a" />
      <pointLight position={[0.9, 0.9, 3.2]} intensity={1.4} distance={5} color="#e91d29" />
      {/* v13-K3: Süd-Ende + Vitrine aufhellen — der Saal läuft nicht mehr
          ins Schwarze aus, der Raum wirkt größer statt erdrückend */}
      <pointLight position={[0, 1.25, 4.3]} intensity={2.2} distance={4} color="#ffc98a" />
    </group>
  )
}
