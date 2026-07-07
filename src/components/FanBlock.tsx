import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { AOBlob } from './AOBlob'

// ─────────────────────────────────────────────────────────────
// Der Fanblock in der SÜDOST-Ecke (Marvins v5-Review: Süd-Seite
// stimmt, aber am Tor-Ende beim Vereinsheim — REFERENZ_MODELL
// entsprechend korrigiert): stilisierte Low-Poly-Figuren in
// SVA-Farben hinter der Reling, nachgebautes AGA-URKNALL-Banner,
// rot-schwarze Fahne, Bierkiste. Bewusst abstrahiert — KEINE
// Gesichter. Der emotionale Schlusspunkt: Verein = Menschen.
// ─────────────────────────────────────────────────────────────

const HH = PITCH.height / 2 + 0.55 // Reling-Linie Süd
const CX = 3.6                      // Block-Zentrum x (nahe SO-Ecke)

function makeBannerTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 640
  cv.height = 220
  const ctx = cv.getContext('2d')!

  // Rotes Tuch mit leichter Fleckigkeit
  ctx.fillStyle = '#b3141f'
  ctx.fillRect(0, 0, 640, 220)
  for (let i = 0; i < 40; i++) {
    ctx.fillStyle = `rgba(60,0,8,${0.05 + Math.random() * 0.08})`
    const x = Math.random() * 640
    const y = Math.random() * 220
    ctx.beginPath()
    ctx.arc(x, y, 20 + Math.random() * 50, 0, Math.PI * 2)
    ctx.fill()
  }
  // Stoffgefühl (v5 Mikro-Detail): weiche vertikale Falten —
  // Schattenflanke + Lichtkante, wie hochgehaltenes Tuch
  for (let i = 0; i < 6; i++) {
    const x = 55 + i * 98 + Math.sin(i * 2.7) * 22
    const g = ctx.createLinearGradient(x - 20, 0, x + 20, 0)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(0.45, 'rgba(40,0,6,0.22)')
    g.addColorStop(0.7, 'rgba(255,235,220,0.07)')
    g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - 20, 0, 40, 220)
  }

  // Schwarzes Diagonalband
  ctx.save()
  ctx.translate(320, 110)
  ctx.rotate(-0.16)
  ctx.fillStyle = '#141114'
  ctx.fillRect(-360, -46, 720, 92)
  // Weiße Schrift auf dem Band
  ctx.fillStyle = '#f2eee6'
  ctx.font = '400 58px Anton, system-ui, sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('AGA URKNALL', 0, -2)
  ctx.font = '600 20px Archivo, system-ui, sans-serif'
  ctx.fillText('est. 2024', 210, 30)
  ctx.restore()

  // Lorbeer-Andeutung links/rechts (dunkle Blätter-Bögen)
  ctx.strokeStyle = 'rgba(20,12,14,0.85)'
  ctx.lineWidth = 5
  for (const sx of [70, 570]) {
    for (let a = -1.1; a <= 1.1; a += 0.28) {
      ctx.beginPath()
      ctx.ellipse(sx + Math.sin(a) * 26 * (sx > 300 ? -1 : 1), 110 + a * 70, 13, 5, a * 0.9, 0, Math.PI * 2)
      ctx.stroke()
    }
  }
  // Spinnennetz-Ecke (oben links)
  ctx.strokeStyle = 'rgba(20,12,14,0.7)'
  ctx.lineWidth = 2
  for (let i = 0; i < 5; i++) {
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(Math.cos(i * 0.28) * 110, Math.sin(i * 0.28) * 110)
    ctx.stroke()
  }
  for (let r = 30; r <= 100; r += 32) {
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI / 2)
    ctx.stroke()
  }
  // Bierkrug-Kritzelei unten rechts (weiße Linie)
  ctx.strokeStyle = 'rgba(240,236,228,0.9)'
  ctx.lineWidth = 3.5
  ctx.strokeRect(560, 168, 30, 36)
  ctx.beginPath()
  ctx.arc(594, 186, 9, -Math.PI / 2, Math.PI / 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.moveTo(560, 178)
  ctx.lineTo(590, 178)
  ctx.stroke()

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// v11-E7: Sponsoren ans Geländer — schmale CI-Werbetafeln auf der Reling
// direkt vor der Kurve (Schwarz/Rot, „DEIN LOGO HIER" / „WERDE SPONSOR").
function makeRailSponsorTex(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 2048
  cv.height = 128
  const ctx = cv.getContext('2d')!
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  const cells = ['DEIN LOGO HIER', 'WERDE SPONSOR', 'DEINE BANDE?']
  const w = cv.width / cells.length
  cells.forEach((t, i) => {
    const x0 = i * w
    ctx.fillStyle = '#0f0c0d'
    ctx.fillRect(x0 + 6, 6, w - 12, cv.height - 12)
    ctx.fillStyle = '#e91d29'
    ctx.fillRect(x0 + 6, 6, 10, cv.height - 12)
    ctx.strokeStyle = 'rgba(233,29,41,0.6)'
    ctx.lineWidth = 3
    ctx.setLineDash([14, 10])
    ctx.strokeRect(x0 + 22, 22, w - 44, cv.height - 44)
    ctx.setLineDash([])
    ctx.fillStyle = '#ffffff'
    ctx.font = '800 46px Archivo, system-ui, sans-serif'
    ctx.fillText(t, x0 + w / 2 + 6, cv.height / 2)
  })
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

// v11-E7 (optional): dezentes Feuerwerk über der Kurve — ein paar aufsteigende,
// verblassende Funken. Bewusst günstig (eine Gruppe, ~14 Punkte, reine
// Sinus/Modulo-Animation, kein State).
function Fireworks() {
  const ref = useRef<THREE.Group>(null)
  const sparks = useMemo(
    () => Array.from({ length: 14 }, (_, i) => ({
      a: (i / 14) * Math.PI * 2,
      r: 0.18 + (i % 3) * 0.12,
      phase: (i % 5) / 5,
      col: i % 2 ? '#ff5560' : '#ffd27a',
    })),
    [],
  )
  useFrame((state) => {
    const g = ref.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.children.forEach((c, i) => {
      const s = sparks[i]
      const p = (t * 0.5 + s.phase) % 1 // 0..1 Lebenszyklus
      const rise = p * 0.9
      c.position.set(Math.cos(s.a) * s.r * p, rise, Math.sin(s.a) * s.r * p)
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial
      m.opacity = Math.max(0, 1 - p) * 0.9
      const sc = 0.6 + p * 0.8
      c.scale.setScalar(sc)
    })
  })
  return (
    <group ref={ref} position={[CX, 1.15, HH + 0.5]}>
      {sparks.map((s, i) => (
        <mesh key={i}>
          <sphereGeometry args={[0.02, 6, 5]} />
          <meshBasicMaterial color={s.col} transparent opacity={0.8} toneMapped={false} />
        </mesh>
      ))}
    </group>
  )
}

// Eine stilisierte Figur: Rumpf + Kopf + Arme (+ optional Fahnen-Arm).
// v9-E6: Arme + Hals ergänzt — vorher las die Figur als kopflastiger
// Kegel. Arme optional (arms=false), damit Lehn-/Schal-Fans mit eigenen
// Armen keine Doppelung bekommen. Kopf minimal kleiner, Hals-Absatz.
function Fan({ x, z, jersey, h, rot, flag, arms = true }: { x: number; z: number; jersey: string; h: number; rot: number; flag?: boolean; arms?: boolean }) {
  return (
    <group position={[x, 0, z]} rotation-y={rot}>
      {/* Beine (dunkel) */}
      <mesh position={[0, h * 0.27, 0]}>
        <cylinderGeometry args={[h * 0.11, h * 0.13, h * 0.54, 6]} />
        <meshStandardMaterial color="#17141a" roughness={0.95} />
      </mesh>
      {/* Trikot-Rumpf */}
      <mesh position={[0, h * 0.68, 0]}>
        <cylinderGeometry args={[h * 0.16, h * 0.13, h * 0.36, 7]} />
        <meshStandardMaterial color={jersey} roughness={0.85} />
      </mesh>
      {/* Arme — v10-E4: mit Schulter-Gelenk am Rumpf angebunden (vorher
          schwebende Zylinder). Schulterkugel überbrückt Rumpf→Arm, der Arm
          hängt von dort natürlich nach unten. Bei flag hält der rechte Arm
          die Stange (eigene Gruppe) → nur links. */}
      {arms && (flag ? [-1] : [-1, 1]).map((s) => (
        <group key={s}>
          <mesh position={[s * h * 0.15, h * 0.79, 0]}>
            <sphereGeometry args={[h * 0.075, 7, 6]} />
            <meshStandardMaterial color={jersey} roughness={0.85} />
          </mesh>
          <mesh position={[s * h * 0.165, h * 0.62, 0]} rotation-z={s * 0.13}>
            <cylinderGeometry args={[h * 0.045, h * 0.052, h * 0.38, 6]} />
            <meshStandardMaterial color={jersey} roughness={0.85} />
          </mesh>
        </group>
      ))}
      {/* Hals-Absatz */}
      <mesh position={[0, h * 0.86, 0]}>
        <cylinderGeometry args={[h * 0.055, h * 0.07, h * 0.06, 6]} />
        <meshStandardMaterial color="#c99a75" roughness={0.9} />
      </mesh>
      {/* Kopf — bewusst ohne Gesicht */}
      <mesh position={[0, h * 0.98, 0]}>
        <sphereGeometry args={[h * 0.108, 8, 7]} />
        <meshStandardMaterial color="#c99a75" roughness={0.9} />
      </mesh>
      {flag && (
        <group position={[h * 0.14, h * 0.75, 0]} rotation-z={-0.5}>
          {/* Fahnen-Arm + Stange */}
          <mesh position={[0, h * 0.3, 0]}>
            <cylinderGeometry args={[0.008, 0.008, h * 0.9, 5]} />
            <meshStandardMaterial color="#3a3d42" roughness={0.6} />
          </mesh>
          <FlagCloth y={h * 0.62} />
        </group>
      )}
    </group>
  )
}

function FlagCloth({ y }: { y: number }) {
  const tex = useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 128
    cv.height = 96
    const ctx = cv.getContext('2d')!
    // rot-schwarz diagonal geteilt (Referenz-Fahne)
    ctx.fillStyle = '#c41824'
    ctx.fillRect(0, 0, 128, 96)
    ctx.fillStyle = '#141114'
    ctx.beginPath()
    ctx.moveTo(128, 0)
    ctx.lineTo(128, 96)
    ctx.lineTo(0, 96)
    ctx.closePath()
    ctx.fill()
    const t = new THREE.CanvasTexture(cv)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
  return (
    <mesh position={[0.09, y, 0]}>
      <planeGeometry args={[0.2, 0.14]} />
      <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.85} />
    </mesh>
  )
}

const FANS: { x: number; z: number; jersey: string; h: number; rot: number; flag?: boolean }[] = [
  // die beiden Banner-Halter
  { x: CX - 0.72, z: HH + 0.24, jersey: '#d02530', h: 0.19, rot: 0.1 },
  { x: CX + 0.72, z: HH + 0.24, jersey: '#1d1a1c', h: 0.185, rot: -0.1 },
  // Kurve drumherum
  { x: CX - 1.15, z: HH + 0.34, jersey: '#d02530', h: 0.18, rot: 0.4, flag: true },
  { x: CX + 1.1, z: HH + 0.38, jersey: '#d8d4c9', h: 0.178, rot: -0.35 },
  { x: CX + 1.45, z: HH + 0.3, jersey: '#d02530', h: 0.172, rot: 0.3 },
  { x: CX - 1.5, z: HH + 0.42, jersey: '#1d1a1c', h: 0.183, rot: 0.55 },
]

export function FanBlock() {
  const bannerTex = useMemo(() => makeBannerTexture(), [])
  const railTex = useMemo(() => makeRailSponsorTex(), [])
  const bannerRef = useRef<THREE.Mesh>(null)
  const bannerGeo = useRef<THREE.PlaneGeometry>(null)
  const bannerBase = useRef<Float32Array | null>(null)
  const scarfRef = useRef<THREE.Group>(null)

  // v9-E2: Banner weht im Wind — echte Tuch-Wellen (Vertex-Ripple auf
  // dem Segment-Plane, günstig). Zwei wandernde Sinus über die Breite,
  // Amplitude an den Halte-Enden (u≈0/1) gedämpft (dort halten die Fans).
  // Dazu leichtes Gesamt-Wogen. Schal wippt weiter.
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const geo = bannerGeo.current
    if (geo) {
      const pos = geo.attributes.position as THREE.BufferAttribute
      if (!bannerBase.current) bannerBase.current = (pos.array as Float32Array).slice()
      const base = bannerBase.current
      const halfW = 1.45 / 2
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3]
        const y = base[i * 3 + 1]
        const u = (x + halfW) / 1.45 // 0..1 über die Breite
        const grip = Math.sin(u * Math.PI) // 0 an den Enden, 1 in der Mitte
        const wave =
          Math.sin(u * 7.5 - t * 3.1) * 0.028 +
          Math.sin(u * 4.0 - t * 2.0 + y * 3.0) * 0.02
        pos.setZ(i, base[i * 3 + 2] + wave * (0.35 + 0.65 * grip))
      }
      pos.needsUpdate = true
      geo.computeVertexNormals()
    }
    if (bannerRef.current) {
      bannerRef.current.rotation.z = Math.sin(t * 1.1) * 0.02
      bannerRef.current.position.y = 0.3 + Math.sin(t * 1.4) * 0.008
    }
    if (scarfRef.current) {
      scarfRef.current.rotation.z = Math.sin(t * 1.8 + 2) * 0.12
      scarfRef.current.position.y = 0.21 + Math.sin(t * 2.3) * 0.006
    }
  })

  return (
    <group>
      {/* Banner wird hochgehalten (Referenz: Team-Foto mit Fahne) —
          Vorderseite zeigt zum Platz */}
      <group position={[CX, 0, HH + 0.22]} rotation-y={Math.PI}>
        <mesh ref={bannerRef} position={[0, 0.3, 0]}>
          <planeGeometry ref={bannerGeo} args={[1.45, 0.3, 20, 4]} />
          <meshStandardMaterial map={bannerTex} side={THREE.DoubleSide} roughness={0.9} />
        </mesh>
        {/* Haltestangen an den Ecken */}
        {[-0.7, 0.7].map((x) => (
          <mesh key={x} position={[x, 0.21, 0]}>
            <cylinderGeometry args={[0.008, 0.008, 0.42, 5]} />
            <meshStandardMaterial color="#3a3d42" roughness={0.6} />
          </mesh>
        ))}
      </group>

      {FANS.map((f, i) => (
        <Fan key={i} {...f} />
      ))}

      {/* Zwei lehnen an der Reling (Arme auf dem Handlauf) */}
      {[{ x: CX - 2.0, j: '#c41824' }, { x: CX + 1.9, j: '#1d1a1c' }].map(({ x, j }, i) => (
        <group key={`lean${i}`} position={[x, 0, HH + 0.16]} rotation-y={i ? -0.2 : 0.25} rotation-x={-0.14}>
          <Fan x={0} z={0} jersey={j} h={0.185} rot={0} arms={false} />
          {/* Arme zum Handlauf */}
          {[-0.045, 0.045].map((ax) => (
            <mesh key={ax} position={[ax, 0.135, -0.05]} rotation-x={0.9}>
              <cylinderGeometry args={[0.009, 0.009, 0.09, 5]} />
              <meshStandardMaterial color={j} roughness={0.85} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Schal wird hochgehalten */}
      <group position={[CX + 1.25, 0, HH + 0.34]} rotation-y={Math.PI}>
        <Fan x={0} z={0} jersey="#c41824" h={0.18} rot={0} arms={false} />
        {[-0.09, 0.09].map((ax) => (
          <mesh key={ax} position={[ax, 0.15, 0]} rotation-z={ax < 0 ? 0.5 : -0.5}>
            <cylinderGeometry args={[0.008, 0.008, 0.09, 5]} />
            <meshStandardMaterial color="#c41824" roughness={0.85} />
          </mesh>
        ))}
        <group ref={scarfRef} position={[0, 0.21, 0]}>
          <mesh>
            <planeGeometry args={[0.24, 0.05]} />
            <meshStandardMaterial color="#c41824" side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
          <mesh position={[0, 0, 0.001]}>
            <planeGeometry args={[0.24, 0.016]} />
            <meshStandardMaterial color="#f2eee6" side={THREE.DoubleSide} roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* Bierkiste */}
      <mesh position={[CX + 0.3, 0.045, HH + 0.62]}>
        <boxGeometry args={[0.16, 0.09, 0.11]} />
        <meshStandardMaterial color="#7a1d14" roughness={0.9} />
      </mesh>

      {/* v11-E7: Sponsoren ans Geländer — schmale CI-Tafel auf der Reling
          direkt vor der Kurve, Vorderseite zum Platz (Kamera-Seite). Leicht
          selbstleuchtend → nachts lesbar. */}
      <mesh position={[CX, 0.115, HH - 0.01]}>
        <boxGeometry args={[3.0, 0.15, 0.02]} />
        <meshStandardMaterial map={railTex} emissiveMap={railTex} emissive="#ffffff" emissiveIntensity={0.22} roughness={0.6} />
      </mesh>

      {/* v11-E7 (optional): dezentes Feuerwerk über der Meister-Kurve */}
      <Fireworks />

      <AOBlob position={[CX, 0.005, HH + 0.35]} scale={[2.6, 1.2]} opacity={0.5} />
    </group>
  )
}
