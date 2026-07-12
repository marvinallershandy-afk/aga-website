import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TABLE_PREVIEW, NEXT_MATCH } from '../data/club'
import { PITCH } from '../utils/constants'

// ─────────────────────────────────────────────────────────────
// v13-K6: Die LED-ANZEIGETAFEL am Vereinsheim — „Die Wahrheit vom
// Wochenende" wird ein ORT in der Welt statt eines aufgesetzten
// DOM-Widgets. Die Tabelle-Kamerastation blickt genau auf diese
// Giebelwand; die Tafel zeigt dieselben Cockpit-Daten (Top 3 +
// nächstes Spiel) als Amber-LED-Matrix mit dezentem Flackern.
// Live-Anbindung später = nur diese Datenquelle tauschen.
// ─────────────────────────────────────────────────────────────

function makeLedTexture(): THREE.CanvasTexture {
  const W = 640
  const H = 384
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!

  ctx.fillStyle = '#0a0806'
  ctx.fillRect(0, 0, W, H)

  const amber = '#ffb428'
  const dim = 'rgba(255,180,40,0.55)'
  const red = '#ff4b55'

  ctx.textBaseline = 'middle'
  ctx.font = '700 30px Archivo, system-ui, sans-serif'
  ctx.fillStyle = dim
  ctx.textAlign = 'center'
  ctx.fillText('· KREISLIGA · SAISON 26/27 ·', W / 2, 34)

  const rows = TABLE_PREVIEW.slice(0, 4)
  ctx.font = '800 34px Archivo, system-ui, sans-serif'
  rows.forEach((r, i) => {
    const y = 92 + i * 54
    const self = !!r.self
    ctx.fillStyle = self ? red : amber
    ctx.textAlign = 'left'
    ctx.fillText(String(r.pos), 28, y)
    ctx.fillText(self ? '▶ SVA' : r.team.toUpperCase().slice(0, 16), 76, y)
    ctx.textAlign = 'right'
    ctx.fillText(String(r.pkt), W - 30, y)
  })

  ctx.strokeStyle = 'rgba(255,180,40,0.35)'
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(24, 316)
  ctx.lineTo(W - 24, 316)
  ctx.stroke()

  ctx.textAlign = 'center'
  ctx.font = '700 28px Archivo, system-ui, sans-serif'
  ctx.fillStyle = amber
  const next = NEXT_MATCH.isPlaceholder ? 'NÄCHSTES HEIMSPIEL · SO 15:00' : `SVA – ${NEXT_MATCH.opponent.toUpperCase()} · ${NEXT_MATCH.date.toUpperCase()}`
  ctx.fillText(next, W / 2, 350)

  // LED-Matrix-Effekt: dunkles Linienraster (KEINE Alpha-Maske —
  // destination-in nullte die RGB-Werte und die Tafel wurde schwarz).
  ctx.fillStyle = 'rgba(0,0,0,0.42)'
  for (let y = 0; y < H; y += 4) ctx.fillRect(0, y, W, 1.4)
  for (let x = 0; x < W; x += 4) ctx.fillRect(x, 0, 1.4, H)

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

export function Scoreboard() {
  const tex = useMemo(makeLedTexture, [])
  const matRef = useRef<THREE.MeshBasicMaterial>(null)

  useFrame((state) => {
    const m = matRef.current
    if (!m) return
    const t = state.clock.elapsedTime
    // dezentes LED-Flackern (Netzbrumm + gelegentlicher Dip)
    const flicker = 1.12 + Math.sin(t * 9.3) * 0.03 + (Math.sin(t * 0.7) > 0.96 ? -0.12 : 0)
    m.color.setScalar(flicker)
  })

  // Auf dem OST-Ballfangzaun, direkt über dem Banner-Slot — dieser
  // Zaunabschnitt ist an der Tabelle-Station nachweislich im freien
  // 3D-Streifen sichtbar (und begleitet die Ausfahrt aus dem Partyraum).
  // Klassische Platz-Anzeigetafel: über dem Zaun, Front zum Spielfeld.
  return (
    <group
      position={[PITCH.width / 2 + 0.88, 0.52, -0.35]}
      rotation-y={-Math.PI / 2}
      scale={0.34}
    >
      {/* Gehäuse */}
      <mesh position={[0, 0, -0.025]}>
        <boxGeometry args={[1.7, 1.06, 0.05]} />
        <meshStandardMaterial color="#15120f" roughness={0.75} metalness={0.25} />
      </mesh>
      {/* Rahmen-Lippe */}
      <mesh position={[0, 0, -0.002]}>
        <planeGeometry args={[1.62, 0.98]} />
        <meshStandardMaterial color="#060504" roughness={0.9} />
      </mesh>
      {/* LED-Fläche (Basic + Farb-Boost → Bloom greift) */}
      <mesh position={[0, 0, 0.004]}>
        <planeGeometry args={[1.54, 0.9]} />
        <meshBasicMaterial ref={matRef} map={tex} toneMapped={false} />
      </mesh>
      {/* freistehend: zwei Pfosten bis zum Boden (klassische Platz-Tafel) */}
      {[-0.6, 0.6].map((x) => (
        <mesh key={x} position={[x, -1.25, -0.03]}>
          <boxGeometry args={[0.07, 1.6, 0.07]} />
          <meshStandardMaterial color="#2a2724" roughness={0.7} metalness={0.4} />
        </mesh>
      ))}
      {/* schwacher Lichtschein der Tafel auf die Umgebung */}
      <pointLight position={[0, 0, 0.5]} intensity={0.9} distance={2.2} color="#ffb428" />
    </group>
  )
}
