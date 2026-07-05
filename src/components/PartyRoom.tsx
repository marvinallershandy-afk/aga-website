import { useMemo } from 'react'
import * as THREE from 'three'
import { useTexture } from '@react-three/drei'

// ─────────────────────────────────────────────────────────────
// Der Partyraum im Vereinsheim (Bonus-Beat). Lazy geladen — wer
// nie reingeht, lädt ihn nie. Liegt als „Pocket-Dimension" bei
// y = −40 (Übergang: Dip-to-Black in PartyUI).
// KEINE Innenraum-Fotos in REFERENZ → Interpretation aus Cover-
// Vibe: dunkel, warm, Lichterkette in SVA-Rot, Tresen, Poster.
// ─────────────────────────────────────────────────────────────

export const ROOM_Y = -40

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

// Stilisierte Figur (wie im Fanblock — keine Gesichter)
function Person({ pos, jersey, h = 0.19, rot = 0 }: { pos: [number, number, number]; jersey: string; h?: number; rot?: number }) {
  return (
    <group position={pos} rotation-y={rot}>
      <mesh position={[0, h * 0.27, 0]}>
        <cylinderGeometry args={[h * 0.11, h * 0.13, h * 0.54, 6]} />
        <meshStandardMaterial color="#17141a" roughness={0.95} />
      </mesh>
      <mesh position={[0, h * 0.68, 0]}>
        <cylinderGeometry args={[h * 0.16, h * 0.13, h * 0.36, 7]} />
        <meshStandardMaterial color={jersey} roughness={0.85} />
      </mesh>
      <mesh position={[0, h * 0.97, 0]}>
        <sphereGeometry args={[h * 0.115, 8, 7]} />
        <meshStandardMaterial color="#c99a75" roughness={0.9} />
      </mesh>
    </group>
  )
}

export default function PartyRoom() {
  const cover = useTexture('/audio/cover.jpg')
  cover.colorSpace = THREE.SRGBColorSpace
  const neon = useMemo(svaNeonTexture, [])

  // Lichterkette: zwei durchhängende Bögen
  const bulbs = useMemo(() => {
    const pts: [number, number, number][] = []
    for (let i = 0; i <= 11; i++) {
      const t = i / 11
      pts.push([-1.7 + t * 3.4, 1.32 - Math.sin(t * Math.PI) * 0.14, -1.38])
    }
    for (let i = 0; i <= 8; i++) {
      const t = i / 8
      pts.push([-1.78, 1.3 - Math.sin(t * Math.PI) * 0.12, -1.3 + t * 2.5])
    }
    return pts
  }, [])

  return (
    <group position={[0, ROOM_Y, 0]}>
      {/* Hülle */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0, 0]}>
        <planeGeometry args={[3.8, 3]} />
        <meshStandardMaterial color="#33241a" roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.5, -1.45]}>
        <planeGeometry args={[3.8, 3]} />
        <meshStandardMaterial color="#2b2422" roughness={0.95} />
      </mesh>
      {[-1, 1].map((s) => (
        <mesh key={s} position={[s * 1.85, 1.5, 0]} rotation-y={-s * Math.PI / 2}>
          <planeGeometry args={[3, 3]} />
          <meshStandardMaterial color={s < 0 ? '#2e2724' : '#292220'} roughness={0.95} />
        </mesh>
      ))}
      <mesh rotation-x={Math.PI / 2} position={[0, 1.5, 0]}>
        <planeGeometry args={[3.8, 3]} />
        <meshStandardMaterial color="#1c1715" roughness={1} />
      </mesh>

      {/* Tresen */}
      <group position={[0.4, 0, -0.95]}>
        <mesh position={[0, 0.14, 0]}>
          <boxGeometry args={[1.5, 0.28, 0.34]} />
          <meshStandardMaterial color="#4a3423" roughness={0.85} />
        </mesh>
        <mesh position={[0, 0.29, 0]}>
          <boxGeometry args={[1.58, 0.03, 0.42]} />
          <meshStandardMaterial color="#6a4c30" roughness={0.5} metalness={0.1} />
        </mesh>
        {/* Zapfhahn */}
        <mesh position={[0.25, 0.37, 0]}>
          <cylinderGeometry args={[0.012, 0.016, 0.13, 6]} />
          <meshStandardMaterial color="#c9ccd4" metalness={0.8} roughness={0.25} />
        </mesh>
        {/* zwei gezapfte Biere */}
        {[-0.15, 0.02].map((x) => (
          <mesh key={x} position={[x, 0.335, 0.08]}>
            <cylinderGeometry args={[0.014, 0.012, 0.05, 6]} />
            <meshStandardMaterial color="#e8a832" emissive="#c8871a" emissiveIntensity={0.6} roughness={0.3} />
          </mesh>
        ))}
      </group>

      {/* Regal mit Flaschen */}
      <group position={[0.4, 0.62, -1.36]}>
        <mesh>
          <boxGeometry args={[1.4, 0.03, 0.16]} />
          <meshStandardMaterial color="#3c2c1e" roughness={0.9} />
        </mesh>
        {[-0.55, -0.35, -0.12, 0.1, 0.32, 0.55].map((x, i) => (
          <mesh key={x} position={[x, 0.07, 0]}>
            <cylinderGeometry args={[0.016, 0.02, 0.12, 6]} />
            <meshStandardMaterial
              color={['#3a6b35', '#7a3020', '#c8a038', '#3a5a7a', '#6a3a5a', '#4a4a30'][i]}
              roughness={0.3}
              emissive="#181008"
              emissiveIntensity={0.4}
            />
          </mesh>
        ))}
      </group>

      {/* Barkeeper + Gäste */}
      <Person pos={[0.4, 0, -1.2]} jersey="#1d1a1c" rot={0} />
      <Person pos={[0.05, 0, -0.62]} jersey="#c41824" rot={Math.PI} />
      <Person pos={[0.78, 0, -0.58]} jersey="#d8d4c9" rot={Math.PI - 0.4} />
      {/* Hocker */}
      {[0.05, 0.78].map((x) => (
        <mesh key={x} position={[x, 0.09, -0.45]}>
          <cylinderGeometry args={[0.05, 0.05, 0.18, 7]} />
          <meshStandardMaterial color="#2c2320" roughness={0.9} />
        </mesh>
      ))}

      {/* Cover-2-Poster mit Rahmen */}
      <group position={[-1.2, 0.85, -1.43]}>
        <mesh position={[0, 0, -0.005]}>
          <planeGeometry args={[0.66, 0.66]} />
          <meshStandardMaterial color="#151110" roughness={0.7} />
        </mesh>
        <mesh>
          <planeGeometry args={[0.6, 0.6]} />
          <meshStandardMaterial map={cover} roughness={0.7} />
        </mesh>
      </group>

      {/* SVA-Neon über dem Tresen */}
      <mesh position={[0.4, 1.05, -1.42]}>
        <planeGeometry args={[0.66, 0.25]} />
        <meshBasicMaterial map={neon} transparent toneMapped={false} />
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

      {/* Licht: warm + roter Akzent */}
      <pointLight position={[0.2, 1.2, -0.2]} intensity={5} distance={6} color="#ffb26a" />
      <pointLight position={[-1.1, 1.0, -1.0]} intensity={2.2} distance={5} color="#e91d29" />
      <pointLight position={[0.6, 0.7, 0.9]} intensity={1.6} distance={4} color="#ffd9a0" />
    </group>
  )
}
