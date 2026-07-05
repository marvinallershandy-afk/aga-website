import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH, COLORS } from '../utils/constants'
import { AOBlob } from './AOBlob'

// Bande mit dezenten SVA-Schriftzügen (durchgehende Banner-Strips,
// Canvas-Textur) + gestufte Tribüne hinter der Nord-Längsseite.

function makeBannerTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 2048
  cv.height = 64
  const ctx = cv.getContext('2d')!
  const segs = [
    { text: 'SV AGATHENBURG-DOLLERN', bg: COLORS.red, fg: '#ffffff' },
    { text: 'SEIT 1948', bg: '#1a1718', fg: '#8a8588' },
    { text: 'SVA', bg: '#1a1718', fg: COLORS.red },
    { text: 'EIN DORF. EIN VEREIN. EIN PLATZ.', bg: COLORS.red, fg: '#ffffff' },
    { text: 'SVA', bg: '#1a1718', fg: '#8a8588' },
  ]
  const w = cv.width / segs.length
  segs.forEach((s, i) => {
    ctx.fillStyle = s.bg
    ctx.fillRect(i * w, 0, w, 64)
    ctx.fillStyle = s.fg
    ctx.font = '700 26px Archivo, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s.text, i * w + w / 2, 34)
  })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

export function Stands() {
  const hw = PITCH.width / 2
  const hh = PITCH.height / 2
  const bannerTex = useMemo(makeBannerTexture, [])

  const tiers = 5
  const standZ = -hh - 2.2

  return (
    <group>
      {/* Bande: 4 durchgehende Strips statt 60 Einzel-Boxen */}
      {[-1, 1].map((s) => (
        <mesh key={`l${s}`} position={[0, 0.15, s * (hh + 0.55)]}>
          <boxGeometry args={[PITCH.width + 1.1, 0.3, 0.06]} />
          <meshStandardMaterial map={bannerTex} roughness={0.55} emissive="#3a0d10" emissiveIntensity={0.35} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`s${s}`} position={[s * (hw + 0.55), 0.15, 0]} rotation-y={Math.PI / 2}>
          <boxGeometry args={[PITCH.height + 1.1, 0.3, 0.06]} />
          <meshStandardMaterial map={bannerTex} roughness={0.55} emissive="#3a0d10" emissiveIntensity={0.35} />
        </mesh>
      ))}

      {/* Gestufte Tribüne (Nordseite) */}
      <group position={[0, 0, standZ]}>
        {Array.from({ length: tiers }).map((_, t) => (
          <mesh key={t} position={[0, 0.18 + t * 0.28, -t * 0.42]}>
            <boxGeometry args={[PITCH.width + 2, 0.28, 0.5]} />
            <meshStandardMaterial color={t % 2 ? '#26262b' : '#1f1f24'} roughness={0.95} />
          </mesh>
        ))}
        <mesh position={[0, 1.1, -tiers * 0.42 - 0.2]}>
          <boxGeometry args={[PITCH.width + 2.4, 2.2, 0.15]} />
          <meshStandardMaterial color="#141216" roughness={1} />
        </mesh>
        <mesh position={[0, 2.15, -tiers * 0.21]} rotation={[0.18, 0, 0]}>
          <boxGeometry args={[PITCH.width + 2.6, 0.08, tiers * 0.55]} />
          <meshStandardMaterial color="#191619" metalness={0.3} roughness={0.7} />
        </mesh>
        <mesh position={[0, 1.98, tiers * 0.21 - 0.02]}>
          <boxGeometry args={[PITCH.width + 2.6, 0.1, 0.06]} />
          <meshStandardMaterial color={COLORS.red} emissive={COLORS.red} emissiveIntensity={0.35} />
        </mesh>
        <AOBlob position={[0, 0.005 - 0.02, -1]} scale={[PITCH.width + 4, 4.5]} opacity={0.5} />
      </group>
    </group>
  )
}
