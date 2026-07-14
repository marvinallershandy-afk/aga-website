import { useMemo, useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { AOBlob } from './AOBlob'
import {
  getHumanBodyGeometry,
  getHumanHeadGeometry,
  getHairCapGeometry,
  SKIN_TONES,
  HAIR_TONES,
  BEANIE_TONES,
} from '../three/humanGeometry'
import { useStore } from '../store/useStore'
import { FAN_PHOTOS } from '../data/club'

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
  // v14-E2: deterministische Haut-/Haar-Varianz aus der Position — die
  // handplatzierten Fans bekommen dieselbe Menschlichkeit wie die Menge.
  const seed = Math.abs(Math.sin(x * 12.9898 + z * 78.233)) * 43758.5453
  const skin = SKIN_TONES[Math.floor((seed % 1) * SKIN_TONES.length)]
  const hairPick = (seed * 7.13) % 1
  const hair = hairPick < 0.62
    ? HAIR_TONES[Math.floor(((seed * 3.7) % 1) * HAIR_TONES.length)]
    : hairPick < 0.85
      ? BEANIE_TONES[Math.floor(((seed * 5.1) % 1) * BEANIE_TONES.length)]
      : null
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
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
      {/* Kopf — bewusst ohne Gesicht, leicht ellipsoid */}
      <mesh position={[0, h * 0.98, 0]} scale={[1, 1.14, 0.94]}>
        <sphereGeometry args={[h * 0.104, 8, 7]} />
        <meshStandardMaterial color={skin} roughness={0.9} />
      </mesh>
      {/* Haar/Beanie-Kappe (v14-E2) — nimmt dem Kopf die Murmel-Optik */}
      {hair && (
        <mesh position={[0, h * 1.02, -h * 0.008]} scale={[1, 0.82, 0.98]}>
          <sphereGeometry args={[h * 0.111, 8, 5, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
          <meshStandardMaterial color={hair} roughness={0.96} />
        </mesh>
      )}
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

// ─────────────────────────────────────────────────────────────
// v-website-polish: die Kurve wird VOLLER + emotionaler.
// Kunst-Richtung bleibt: stilisierte Low-Poly-Figuren, KEINE Gesichter,
// kein Fotoreal. Nur „reicher + echt".
// ─────────────────────────────────────────────────────────────

// Deterministischer PRNG → stabile, schöne Verteilung (kein Flackern
// zwischen Renders, prerender-sicher).
function mulberry32(seed: number) {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const JERSEYS = ['#c9202b', '#d02530', '#b3141f', '#8f1620', '#1a1719', '#1d1a1c', '#d8d4c9', '#c7c2b6']

// Instanzierte Zuschauer-Menge HINTER den handplatzierten Detail-Fans.
// v14-E2 „Menschen 3.0": drei Posen-Silhouetten (idle/point/cheer) mit
// Vertex-Color-Hosen, Hautton-Varianz auf ellipsoiden Köpfen und ein
// Haar-/Beanie-Layer — 5 Draw-Calls für die ganze Kurve.
function InstancedCrowd() {
  const bodyRefs = useRef<(THREE.InstancedMesh | null)[]>([null, null, null])
  const headRef = useRef<THREE.InstancedMesh>(null)
  const hairRef = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const crowd = useMemo(() => {
    const rand = mulberry32(20260626)
    const out: {
      x: number; z: number; h: number; jersey: string; phase: number; speed: number
      sway: number; lean0: number; yaw: number
      pose: number; slot: number; skin: string; hair: string; hairScale: number
    }[] = []
    const slots = [0, 0, 0]
    const ROWS = 7
    // Abstandsbasierte DICHTE Packung (Schulter an Schulter, leicht überlappend)
    // → die Silhouetten verschmelzen zur Masse. Reihen versetzt, hintere
    // minimal höher gestaffelt (h wächst).
    const STEP = 0.11
    for (let r = 0; r < ROWS; r++) {
      const z = HH + 0.36 + r * 0.17
      const spanHalf = 2.35 - r * 0.08
      const rowShift = (r % 2) * (STEP / 2) // halbe Lücke versetzt
      for (let x = CX - spanHalf + rowShift; x <= CX + spanHalf; x += STEP) {
        // Posen-Mix: 55% stehen, 25% eine Faust hoch, 20% beide Arme im V
        const pr = rand()
        const pose = pr < 0.55 ? 0 : pr < 0.8 ? 1 : 2
        // Kopfbedeckung: 62% Haare, 20% CI-Beanie, 18% Glatze/frei
        const hr = rand()
        const hair = hr < 0.62
          ? HAIR_TONES[Math.floor(rand() * HAIR_TONES.length)]
          : hr < 0.82
            ? BEANIE_TONES[Math.floor(rand() * BEANIE_TONES.length)]
            : '#000000'
        out.push({
          x: x + (rand() - 0.5) * 0.05,
          z: z + (rand() - 0.5) * 0.08,
          h: 0.17 + r * 0.012 + rand() * 0.05,
          jersey: JERSEYS[Math.floor(rand() * JERSEYS.length)],
          phase: rand() * Math.PI * 2,
          speed: 1.3 + rand() * 1.3,
          sway: 0.025 + rand() * 0.05,
          lean0: -0.05 - rand() * 0.06, // Grund-Vorlage Richtung Platz/Kamera
          yaw: (rand() - 0.5) * 0.5, // leichte Blickrichtungs-Streuung
          pose,
          slot: slots[pose]++,
          skin: SKIN_TONES[Math.floor(rand() * SKIN_TONES.length)],
          hair,
          hairScale: hr < 0.82 ? 1 : 0,
        })
      }
    }
    return { out, counts: slots }
  }, [])

  const N = crowd.out.length
  const bodyGeos = useMemo(
    () => [getHumanBodyGeometry('idle'), getHumanBodyGeometry('point'), getHumanBodyGeometry('cheer')],
    [],
  )
  const headGeo = useMemo(() => getHumanHeadGeometry(), [])
  const hairGeo = useMemo(() => getHairCapGeometry(), [])

  // Farben einmalig setzen (Trikot je Pose-Mesh, Haut + Haar global).
  useEffect(() => {
    const head = headRef.current
    const hair = hairRef.current
    if (!head || !hair) return
    const col = new THREE.Color()
    for (let i = 0; i < N; i++) {
      const f = crowd.out[i]
      bodyRefs.current[f.pose]?.setColorAt(f.slot, col.set(f.jersey))
      head.setColorAt(i, col.set(f.skin))
      hair.setColorAt(i, col.set(f.hair === '#000000' ? f.skin : f.hair))
    }
    bodyRefs.current.forEach((b) => { if (b?.instanceColor) b.instanceColor.needsUpdate = true })
    if (head.instanceColor) head.instanceColor.needsUpdate = true
    if (hair.instanceColor) hair.instanceColor.needsUpdate = true
  }, [crowd, N])

  useFrame((state) => {
    const head = headRef.current
    const hair = hairRef.current
    if (!head || !hair) return
    const t = state.clock.elapsedTime
    for (let i = 0; i < N; i++) {
      const f = crowd.out[i]
      // Jubel-Posen leben stärker (mehr Wippen), Idle bleibt ruhig
      const amp = f.pose === 2 ? 1.7 : f.pose === 1 ? 1.3 : 1
      const sway = Math.sin(t * f.speed + f.phase) * f.sway * amp
      const bob = Math.sin(t * f.speed * 1.3 + f.phase) * 0.006 * amp
      dummy.position.set(f.x, bob, f.z)
      // x: Grund-Vorlage zur Kamera + leichtes Nicken; y: Blickstreuung; z: Schunkeln
      dummy.rotation.set(f.lean0 + Math.sin(t * f.speed * 0.9 + f.phase) * 0.02, f.yaw, sway)
      dummy.scale.setScalar(f.h)
      dummy.updateMatrix()
      bodyRefs.current[f.pose]?.setMatrixAt(f.slot, dummy.matrix)
      head.setMatrixAt(i, dummy.matrix)
      if (f.hairScale === 0) {
        dummy.scale.setScalar(0.0001)
        dummy.updateMatrix()
      }
      hair.setMatrixAt(i, dummy.matrix)
    }
    bodyRefs.current.forEach((b) => { if (b) b.instanceMatrix.needsUpdate = true })
    head.instanceMatrix.needsUpdate = true
    hair.instanceMatrix.needsUpdate = true
  })

  return (
    <group>
      {/* v13-X4: Stoff/Haut matt halten — envMapIntensity gedrosselt,
          sonst glänzt die Menge wie Plastikfiguren. (castShadow wird vom
          StaticShadows-Traversal bewusst aktiviert — statischer Bake.)
          vertexColors: Hose dunkel, Trikot-Zone × Instanzfarbe. */}
      {bodyGeos.map((geo, p) => (
        <instancedMesh
          key={p}
          ref={(el) => { bodyRefs.current[p] = el }}
          args={[geo, undefined, Math.max(1, crowd.counts[p])]}
          castShadow={false}
        >
          <meshStandardMaterial roughness={0.92} envMapIntensity={0.35} vertexColors />
        </instancedMesh>
      ))}
      <instancedMesh ref={headRef} args={[headGeo, undefined, N]} castShadow={false}>
        <meshStandardMaterial roughness={0.9} envMapIntensity={0.35} />
      </instancedMesh>
      <instancedMesh ref={hairRef} args={[hairGeo, undefined, N]} castShadow={false}>
        <meshStandardMaterial roughness={0.96} envMapIntensity={0.25} />
      </instancedMesh>
    </group>
  )
}

// v13-K2: Sporadische Handy-Blitzer in der Menge — kurze weiße Aufblitzer
// wie Fotos bei der Meisterfeier. Ein instanziertes Quad-Set, „aus" =
// Scale 0 (Material bleibt eins, 1 Draw-Call).
function PhoneFlashes() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const spots = useMemo(() => {
    const rand = mulberry32(4711)
    return Array.from({ length: 6 }, () => ({
      x: CX + (rand() - 0.5) * 4.2,
      z: HH + 0.45 + rand() * 1.1,
      y: 0.17 + rand() * 0.06,
      period: 2.8 + rand() * 4.5,
      offset: rand() * 8,
    }))
  }, [])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const t = state.clock.elapsedTime
    spots.forEach((s, i) => {
      const local = (t + s.offset) % s.period
      const on = local < 0.13 ? 1 - local / 0.13 : 0
      dummy.position.set(s.x, s.y, s.z)
      dummy.rotation.y = Math.PI
      dummy.scale.setScalar(on > 0 ? 0.05 + on * 0.06 : 0.0001)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 6]} frustumCulled={false}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial color="#eaf2ff" transparent opacity={0.9} blending={THREE.AdditiveBlending} depthWrite={false} toneMapped={false} />
    </instancedMesh>
  )
}

// Rot-schwarz geteilte Fahne (Referenz-Look).
function makeFlagTex(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 160
  cv.height = 112
  const ctx = cv.getContext('2d')!
  ctx.fillStyle = '#c41824'
  ctx.fillRect(0, 0, 160, 112)
  ctx.fillStyle = '#141114'
  ctx.beginPath()
  ctx.moveTo(160, 0)
  ctx.lineTo(160, 112)
  ctx.lineTo(0, 112)
  ctx.closePath()
  ctx.fill()
  // dünner Diagonal-Saum
  ctx.strokeStyle = 'rgba(240,236,228,0.5)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(160, 0)
  ctx.lineTo(0, 112)
  ctx.stroke()
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  return tex
}

// Größere, im Wind wehende Fahne an einer Stange (Vertex-Ripple).
function WindFlag({ x, z, poleH, tex, phase = 0 }: { x: number; z: number; poleH: number; tex: THREE.Texture; phase?: number }) {
  const geoRef = useRef<THREE.PlaneGeometry>(null)
  const base = useRef<Float32Array | null>(null)
  const W = 0.26
  const H = 0.17
  useFrame((state) => {
    const geo = geoRef.current
    if (!geo) return
    const pos = geo.attributes.position as THREE.BufferAttribute
    if (!base.current) base.current = (pos.array as Float32Array).slice()
    const b = base.current
    const t = state.clock.elapsedTime
    for (let i = 0; i < pos.count; i++) {
      const x0 = b[i * 3]
      const u = (x0 + W / 2) / W // 0 an Stange … 1 am freien Ende
      const wave = Math.sin(u * 6 - t * 4 + phase) * 0.03 + Math.sin(u * 3 - t * 2.4 + phase) * 0.02
      pos.setZ(i, b[i * 3 + 2] + wave * u) // Stangen-Ende fest, Flatterende frei
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, poleH / 2, 0]}>
        <cylinderGeometry args={[0.008, 0.008, poleH, 5]} />
        <meshStandardMaterial color="#3a3d42" roughness={0.6} />
      </mesh>
      <mesh position={[W / 2, poleH - H / 2 - 0.02, 0]}>
        <planeGeometry ref={geoRef} args={[W, H, 12, 3]} />
        <meshStandardMaterial map={tex} side={THREE.DoubleSide} roughness={0.85} />
      </mesh>
    </group>
  )
}

// Großes Kurven-Banner „MEISTER 2026" am Zaun (der Vereinsname steht bereits
// auf der Bande, s. Barrier.tsx — hier feiert die Kurve stattdessen den Titel,
// passend zu Neles Aufstiegs-Fotos: emotional statt doppelt).
function makeClubBannerTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  cv.width = 1024
  cv.height = 220
  const ctx = cv.getContext('2d')!
  // schwarzes Tuch mit rotem Rahmen + Stoff-Fleckigkeit
  ctx.fillStyle = '#141114'
  ctx.fillRect(0, 0, 1024, 220)
  for (let i = 0; i < 34; i++) {
    ctx.fillStyle = `rgba(0,0,0,${0.05 + Math.random() * 0.08})`
    ctx.beginPath()
    ctx.arc(Math.random() * 1024, Math.random() * 220, 15 + Math.random() * 45, 0, Math.PI * 2)
    ctx.fill()
  }
  ctx.strokeStyle = '#c41824'
  ctx.lineWidth = 12
  ctx.strokeRect(16, 16, 1024 - 32, 220 - 32)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = '#e8c15a'
  ctx.font = '400 104px Anton, system-ui, sans-serif'
  ctx.fillText('MEISTER 2026', 512, 88)
  ctx.fillStyle = '#f2eee6'
  ctx.font = '700 40px Archivo, system-ui, sans-serif'
  ctx.fillText('★  SÜDKURVE · 1. KREISKLASSE  ★', 512, 162)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// Sanft driftendes Konfetti über der Kurve (instanziert, günstig).
function Confetti() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const N = 46
  const bits = useMemo(() => {
    const rand = mulberry32(4242)
    return Array.from({ length: N }, () => ({
      x: CX + (rand() - 0.5) * 4.6,
      z: HH + 0.3 + rand() * 1.6,
      y0: 1.2 + rand() * 1.4,
      speed: 0.12 + rand() * 0.14,
      spin: (rand() - 0.5) * 3,
      drift: (rand() - 0.5) * 0.4,
      phase: rand() * 10,
      col: rand() > 0.5 ? '#e91d29' : rand() > 0.5 ? '#e8c15a' : '#f2eee6',
    }))
  }, [])
  useEffect(() => {
    const m = ref.current
    if (!m) return
    const col = new THREE.Color()
    bits.forEach((b, i) => m.setColorAt(i, col.set(b.col)))
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  }, [bits])
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const t = state.clock.elapsedTime
    bits.forEach((b, i) => {
      const fall = ((t * b.speed + b.phase) % 1.6)
      const y = b.y0 - fall
      dummy.position.set(b.x + Math.sin(t * 0.8 + b.phase) * b.drift, y, b.z)
      dummy.rotation.set(t * b.spin, t * b.spin * 0.7, 0)
      dummy.scale.setScalar(0.02)
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, N]}>
      <planeGeometry args={[1, 0.6]} />
      <meshBasicMaterial side={THREE.DoubleSide} toneMapped={false} />
    </instancedMesh>
  )
}

// Ein Fan hält ein SCHILD mit einem echten Foto hoch → Klick öffnet die
// Lightbox mit genau diesem Foto (mobil wie Desktop; DOM-Kacheln als
// zuverlässiger Zweitzugang). Schild zeigt zur Kamera (−z, rotation-y=π).
function PhotoSign({ index, x, z, y, jersey, yaw = 0 }: { index: number; x: number; z: number; y: number; jersey: string; yaw?: number }) {
  const setFanPhoto = useStore((s) => s.setFanPhoto)
  const photo = FAN_PHOTOS[index]
  const tex = useTexture(photo.sign as string)
  const grpRef = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  useMemo(() => {
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    // v13-E8: KEIN repeat-Flip mehr. Die Fanblock-Kamera (Station 3) sieht
    // die Schilder von der Kurven-Seite — mit dem alten Flip stand die
    // Shirt-Schrift genau dort spiegelverkehrt. Jetzt liest sich das Foto
    // an der Station korrekt (die Pitch-Fernsicht zeigt Schilder nur als
    // winzige Punkte).
    tex.needsUpdate = true
  }, [tex])
  useFrame((state) => {
    const g = grpRef.current
    if (!g) return
    const t = state.clock.elapsedTime
    g.rotation.z = Math.sin(t * 1.1 + index * 1.7) * 0.04
    g.position.y = y + Math.sin(t * 1.5 + index) * 0.006
  })
  const W = 0.4
  const H = 0.3
  return (
    <group position={[x, 0, z]}>
      {/* Halter-Fan (Arme hoch) */}
      <Fan x={0} z={0} jersey={jersey} h={0.19} rot={0} arms={false} />
      {[-0.05, 0.05].map((ax) => (
        <mesh key={ax} position={[ax, 0.16, 0.01]} rotation-z={ax < 0 ? 0.35 : -0.35}>
          <cylinderGeometry args={[0.008, 0.008, 0.12, 5]} />
          <meshStandardMaterial color={jersey} roughness={0.85} />
        </mesh>
      ))}
      {/* Halte-Stangen zum Schild */}
      {[-W * 0.36, W * 0.36].map((px) => (
        <mesh key={px} position={[px, y - H * 0.5 - 0.09, 0.02]}>
          <cylinderGeometry args={[0.007, 0.007, 0.26, 5]} />
          <meshStandardMaterial color="#2f3236" roughness={0.6} />
        </mesh>
      ))}
      {/* Schild-Gruppe: zeigt zur Kamera */}
      <group ref={grpRef} position={[0, y, 0.03]} rotation-y={Math.PI + yaw}>
        {/* Gold-Rahmen (Signal: anklickbar) */}
        <mesh position={[0, 0, -0.008]}>
          <planeGeometry args={[W + 0.05, H + 0.05]} />
          <meshStandardMaterial color={hover ? '#ffe08a' : '#e8c15a'} roughness={0.45} metalness={0.35} emissive="#e8c15a" emissiveIntensity={hover ? 0.5 : 0.22} />
        </mesh>
        <mesh position={[0, 0, -0.004]}>
          <planeGeometry args={[W + 0.014, H + 0.014]} />
          <meshStandardMaterial color="#0f0c0d" roughness={0.8} />
        </mesh>
        {/* Foto — anklickbar, leicht selbstleuchtend → nachts lesbar */}
        <mesh
          scale={hover ? 1.05 : 1}
          onClick={(e) => {
            e.stopPropagation()
            setFanPhoto(index)
          }}
          onPointerOver={(e) => {
            e.stopPropagation()
            setHover(true)
            document.body.style.cursor = 'pointer'
          }}
          onPointerOut={() => {
            setHover(false)
            document.body.style.cursor = ''
          }}
        >
          <planeGeometry args={[W, H]} />
          <meshStandardMaterial map={tex} emissiveMap={tex} emissive="#ffffff" emissiveIntensity={0.5} roughness={0.7} toneMapped />
        </mesh>
      </group>
    </group>
  )
}

// Die 3 Foto-Schilder (unter Suspense — Texturen laden per useTexture).
const SIGN_SPOTS = [
  { x: CX - 1.5, z: HH + 0.6, y: 0.66, jersey: '#c9202b', yaw: 0.14 },
  { x: CX + 0.15, z: HH + 0.72, y: 0.74, jersey: '#1d1a1c', yaw: 0 },
  { x: CX + 1.65, z: HH + 0.6, y: 0.66, jersey: '#d8d4c9', yaw: -0.14 },
]
function PhotoSigns() {
  // nur Fotos mit sign-Textur (die ersten 3 FAN_PHOTOS).
  const signs = FAN_PHOTOS.map((p, i) => ({ p, i })).filter((e) => !!e.p.sign).slice(0, 3)
  return (
    <>
      {signs.map((e, k) => {
        const spot = SIGN_SPOTS[k]
        return <PhotoSign key={e.i} index={e.i} {...spot} />
      })}
    </>
  )
}

export function FanBlock() {
  const bannerTex = useMemo(() => makeBannerTexture(), [])
  const clubBannerTex = useMemo(() => makeClubBannerTexture(), [])
  const flagTex = useMemo(() => makeFlagTex(), [])
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
      {/* v-website-polish: instanzierte Menge füllt die Kurve (hinter den
          Detail-Fans) + großes Vereins-Banner am Zaun im Rücken. */}
      <InstancedCrowd />
      <PhoneFlashes />

      {/* Großes Kurven-Banner „MEISTER 2026" am Zaun hinten. v13-E8: statt
          DoubleSide (Rückseite = spiegelverkehrt, prominent in Hero-/Finale-
          Ansicht von Süden) zwei FrontSide-Planes Rücken an Rücken — wie ein
          doppelt bedrucktes Banner, beide Seiten lesbar. */}
      <mesh position={[CX - 0.1, 0.82, HH + 1.42]} rotation-y={Math.PI}>
        <planeGeometry args={[2.9, 0.56]} />
        <meshStandardMaterial map={clubBannerTex} roughness={0.9} emissiveMap={clubBannerTex} emissive="#ffffff" emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[CX - 0.1, 0.82, HH + 1.425]}>
        <planeGeometry args={[2.9, 0.56]} />
        <meshStandardMaterial map={clubBannerTex} roughness={0.9} emissiveMap={clubBannerTex} emissive="#ffffff" emissiveIntensity={0.12} />
      </mesh>

      {/* Wehende Fahnen in der Menge */}
      <WindFlag x={CX - 2.15} z={HH + 0.7} poleH={0.62} tex={flagTex} phase={0.4} />
      <WindFlag x={CX + 2.1} z={HH + 0.62} poleH={0.7} tex={flagTex} phase={2.1} />
      <WindFlag x={CX + 0.9} z={HH + 1.05} poleH={0.82} tex={flagTex} phase={3.3} />

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

      {/* v-website-polish: driftendes Konfetti + die 3 klickbaren Foto-Schilder */}
      <Confetti />
      <PhotoSigns />

      <AOBlob position={[CX, 0.005, HH + 0.35]} scale={[2.6, 1.2]} opacity={0.5} />
      {/* breiter, dunkler Boden unter der dichten Menge → erdet die Kurve,
          nimmt den hellen Rasen unter den Figuren zurück (kein „Kegel auf
          Wiese"-Eindruck). */}
      <AOBlob position={[CX, 0.004, HH + 1.05]} scale={[6.4, 3.2]} opacity={0.62} />
    </group>
  )
}
