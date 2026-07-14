import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { COLORS } from '../utils/constants'
import { AOBlob, LightPool } from './AOBlob'
import { getVestibuleWallTexture } from './doorGlow'

// Fassaden-Textur für die Platzseite: Putz mit feiner Struktur,
// gezeichnetes EG-Fensterband mit Rahmen, OG-Band, Klinker-Sockel —
// Material-Tiefe statt glatter Fläche (v4-Audit).
function makeFacadeTexture(len: number, h: number): THREE.CanvasTexture {
  const S = 220
  const W = Math.round(len * S)
  const H = Math.round(h * S)
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = H
  const ctx = cv.getContext('2d')!

  ctx.fillStyle = '#d8d4c8'
  ctx.fillRect(0, 0, W, H)
  const img = ctx.getImageData(0, 0, W, H)
  for (let i = 0; i < img.data.length; i += 4) {
    const n = ((Math.sin(i * 91.7) * 43758.5453) % 1) * 16 - 8
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  ctx.putImageData(img, 0, 0)
  const g = ctx.createLinearGradient(0, 0, 0, H * 0.25)
  g.addColorStop(0, 'rgba(90,86,78,0.35)')
  g.addColorStop(1, 'rgba(90,86,78,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, H * 0.25)

  // Klinker-Sockel (Referenz: Boden-Foto)
  ctx.fillStyle = '#6e4436'
  ctx.fillRect(0, H * 0.88, W, H * 0.12)
  ctx.strokeStyle = 'rgba(40,22,18,0.5)'
  ctx.lineWidth = 1
  for (let y = H * 0.88; y < H; y += 5) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke()
  }

  // EG-Fensterreihe: helle Rahmen, dunkle Scheiben, Fensterbänke
  const winW = S * 0.42
  const gap = S * 0.55
  for (let x = S * 0.35; x + winW < W - S * 0.3; x += winW + gap) {
    const y = H * 0.42
    const wh = H * 0.34
    ctx.fillStyle = '#e6e2d6'
    ctx.fillRect(x - 4, y - 4, winW + 8, wh + 8)
    ctx.fillStyle = '#1e242c'
    ctx.fillRect(x, y, winW, wh)
    ctx.strokeStyle = '#e6e2d6'
    ctx.lineWidth = 3
    ctx.beginPath(); ctx.moveTo(x + winW / 2, y); ctx.lineTo(x + winW / 2, y + wh); ctx.stroke()
    if (Math.sin(x * 12.9898) > 0.45) {
      const lg = ctx.createLinearGradient(x, y, x, y + wh)
      lg.addColorStop(0, 'rgba(255,170,90,0.5)')
      lg.addColorStop(1, 'rgba(255,140,60,0.18)')
      ctx.fillStyle = lg
      ctx.fillRect(x, y, winW, wh)
    }
    ctx.fillStyle = '#c9c5b8'
    ctx.fillRect(x - 6, y + wh + 4, winW + 12, 5)
  }
  // schmales OG-Fensterband unterm Dach
  ctx.fillStyle = '#20262e'
  ctx.fillRect(S * 0.3, H * 0.16, W - S * 0.6, H * 0.09)
  ctx.strokeStyle = '#b9b5a8'
  ctx.lineWidth = 2
  for (let x = S * 0.3; x < W - S * 0.3; x += S * 0.36) {
    ctx.beginPath(); ctx.moveTo(x, H * 0.16); ctx.lineTo(x, H * 0.25); ctx.stroke()
  }

  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// ─────────────────────────────────────────────────────────────
// Das echte Vereinsheim (Mehrzweckhalle) nach REFERENZ_MODELL:
// langgestreckt HINTER dem Ost-Tor, weiße Fassade, flaches dunkles
// Satteldach mit Ziegel-Schornstein, flacher Anbau zur Platzseite
// mit blauem Fascia-Band, blauer Tür und warmen Fenstern, davor
// Terrasse mit Biertisch-Andeutung. Maßstabsgetreu (~42 m lang).
// Beleg: dji_…0155…/f020.jpg, Bildschirmfoto…13.24.16.png
// ─────────────────────────────────────────────────────────────

// v11-E3: Nach dem Audit (#19) war der Hauptkorpus zu kurz und die Tür saß
// zu weit vorn. Das echte Vereinsheim ist ein LANGER Riegel (~42 m). Der
// Korpus ist jetzt real länger (LEN) und die ganze Gruppe ein Stück nach
// NORDEN (−z, „hinten") gerückt — dadurch wandert auch die Tür nach hinten
// (Welt z ≈ −2.5). DOOR in camera/partyPath.ts ist synchron nachgezogen.
export const CLUBHOUSE_POS = { x: 7.15, z: -0.85 } as const

const LEN = 5.6      // Länge entlang z (Nord-Süd) — v11-E3: real länger (war 4.2)
const DEPTH = 0.85
const EAVES = 0.34   // Traufhöhe
const RISE = 0.24    // Firstanhebung
const ANNEX_H = 0.24
const ANNEX_D = 0.3
// v11-E3: lange überdachte Terrasse über die ganze Gebäudelänge (Referenzfoto),
// zentriert bei clubhouse-lokal z=−0.15. Der Eingang sitzt an der hinteren
// (nördlichen) Hälfte (annex-lokal z=−1.5 → Welt z≈−2.5).
const ANNEX_LEN = 4.8

// v13-K1: 16 träge treibende Staub-Motten im warmen Türlicht (instanziert,
// additiv). Sie geben dem Tür-Transit physische Tiefe — man fliegt durch
// Raumluft, nicht durch eine Fläche.
let moteTex: THREE.CanvasTexture | null = null
function getMoteTexture(): THREE.CanvasTexture {
  if (moteTex) return moteTex
  const cv = document.createElement('canvas')
  cv.width = 16
  cv.height = 16
  const ctx = cv.getContext('2d')!
  const g = ctx.createRadialGradient(8, 8, 0, 8, 8, 8)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.5, 'rgba(255,255,255,0.5)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, 16, 16)
  moteTex = new THREE.CanvasTexture(cv)
  return moteTex
}

function DoorDust() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const dummy = useMemo(() => new THREE.Object3D(), [])
  const seeds = useMemo(
    () =>
      Array.from({ length: 16 }, (_, i) => ({
        ph: i * 0.61,
        r: 0.02 + ((i * 37) % 10) * 0.006,
        sp: 0.3 + ((i * 17) % 10) * 0.05,
        z: -1.5 + (((i * 23) % 10) / 10 - 0.5) * 0.14,
      })),
    [],
  )
  useFrame((state) => {
    const m = ref.current
    if (!m) return
    const t = state.clock.elapsedTime
    seeds.forEach((s, i) => {
      const y = 0.04 + ((t * 0.012 * s.sp + s.ph) % 0.2)
      const x = -ANNEX_D / 2 - 0.035 - s.r * (0.4 + 0.6 * Math.sin(t * 0.4 + s.ph))
      dummy.position.set(x, y, s.z + Math.sin(t * 0.5 + s.ph) * 0.02)
      dummy.rotation.y = -Math.PI / 2
      dummy.scale.setScalar(0.6 + 0.4 * Math.sin(t * 0.9 + s.ph * 2))
      dummy.updateMatrix()
      m.setMatrixAt(i, dummy.matrix)
    })
    m.instanceMatrix.needsUpdate = true
  })
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, 16]} frustumCulled={false}>
      <planeGeometry args={[0.008, 0.008]} />
      <meshBasicMaterial
        map={getMoteTexture()}
        color="#ffc37a"
        transparent
        opacity={0.55}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </instancedMesh>
  )
}

function GableEnds() {
  const geo = useMemo(() => {
    const half = DEPTH / 2 + 0.01
    const shape = new THREE.Shape()
    shape.moveTo(-half, 0)
    shape.lineTo(half, 0)
    shape.lineTo(0, RISE)
    shape.closePath()
    return new THREE.ShapeGeometry(shape)
  }, [])
  return (
    <>
      <mesh geometry={geo} position={[0, EAVES, LEN / 2]} rotation-y={Math.PI / 2}>
        <meshStandardMaterial color="#c9c5ba" roughness={0.95} />
      </mesh>
      <mesh geometry={geo} position={[0, EAVES, -LEN / 2]} rotation-y={-Math.PI / 2}>
        <meshStandardMaterial color="#b5b1a6" roughness={0.95} />
      </mesh>
    </>
  )
}

export function Clubhouse() {
  const slabLen = Math.hypot(DEPTH / 2 + 0.12, RISE + 0.04)
  const roofA = Math.atan2(RISE, DEPTH / 2)
  const facade = useMemo(() => makeFacadeTexture(LEN, EAVES), [])

  return (
    <group position={[CLUBHOUSE_POS.x, 0, CLUBHOUSE_POS.z]}>
      {/* Hauptkorpus — weiße Fassade */}
      <mesh position={[0, EAVES / 2, 0]}>
        <boxGeometry args={[DEPTH, EAVES, LEN]} />
        <meshStandardMaterial color="#d6d2c6" roughness={0.92} />
      </mesh>
      <GableEnds />
      {/* Flaches Satteldach (First entlang z) */}
      {[-1, 1].map((s) => (
        <mesh
          key={s}
          position={[s * (DEPTH / 4 + 0.03), EAVES + RISE / 2 + 0.015, 0]}
          rotation-z={s * roofA}
        >
          <boxGeometry args={[slabLen, 0.05, LEN + 0.25]} />
          <meshStandardMaterial color="#26262a" roughness={0.8} metalness={0.1} />
        </mesh>
      ))}
      {/* Ziegel-Schornstein */}
      <mesh position={[0, EAVES + RISE + 0.1, 0.55]}>
        <boxGeometry args={[0.16, 0.28, 0.2]} />
        <meshStandardMaterial color="#7a4030" roughness={0.95} />
      </mesh>
      {/* Fassade mit Material-Tiefe (Fenster, Sockel, Putz) — Platzseite */}
      <mesh position={[-DEPTH / 2 - 0.004, EAVES / 2, 0]} rotation-y={-Math.PI / 2}>
        <planeGeometry args={[LEN, EAVES]} />
        <meshStandardMaterial map={facade} roughness={0.9} />
      </mesh>
      {/* Regenrinne an der Traufe + Fallrohr */}
      <mesh position={[-DEPTH / 2 - 0.02, EAVES + 0.01, 0]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.014, 0.014, LEN + 0.2, 6]} />
        <meshStandardMaterial color="#8a8d94" metalness={0.7} roughness={0.35} />
      </mesh>
      <mesh position={[-DEPTH / 2 - 0.02, EAVES / 2, -LEN / 2 + 0.12]}>
        <cylinderGeometry args={[0.011, 0.011, EAVES, 6]} />
        <meshStandardMaterial color="#8a8d94" metalness={0.7} roughness={0.35} />
      </mesh>

      {/* v9-E3: Lange ÜBERDACHTE TERRASSE zur Platzseite (Referenzfoto):
          nach Norden verlängert, echter Eingang an der LINKEN/hinteren
          Ecke (annex-lokal z=−1.5 → Welt z≈−1.95, „um die Ecke", nördlich
          des durchgehenden Zaun-Endes). Blaues Fascia + Vordach auf
          Pfosten. Anbau-Gruppe steht bei Welt z=−0.45. */}
      <group position={[-DEPTH / 2 - ANNEX_D / 2, 0, -0.15]}>
        {/* v14-E4: Der Anbau ist KEIN geschlossener Riegel mehr — die Tür
            ist eine echte Öffnung (Lücke zwischen zwei Korpus-Teilen bei
            annex-lokal z=−1.5±0.1). Die Kamera fliegt KÖRPERLICH hindurch
            in einen kleinen Windfang; der Welt-Hop passiert erst drinnen,
            wenn echte Geometrie das Bild rahmt — nicht mehr auf einem
            bemalten Glow-Quad („durch die Wand"-Gefühl, Marvins Kritik). */}
        <mesh position={[0, ANNEX_H / 2, (-2.4 + -1.6) / 2]}>
          <boxGeometry args={[ANNEX_D, ANNEX_H, 0.8]} />
          <meshStandardMaterial color="#ccc8bd" roughness={0.92} />
        </mesh>
        <mesh position={[0, ANNEX_H / 2, (-1.4 + 2.4) / 2]}>
          <boxGeometry args={[ANNEX_D, ANNEX_H, 3.8]} />
          <meshStandardMaterial color="#ccc8bd" roughness={0.92} />
        </mesh>
        {/* Windfang-Interieur: Holzboden, Decke, warm glühende Rückwand
            (die Glow-Textur ist jetzt eine LICHTQUELLE im Raum, kein
            Bildfüller), kleine Deckenlampe. Wände = Schnittflächen der
            beiden Korpus-Teile. */}
        <group position={[0, 0, -1.5]}>
          <mesh position={[0.01, 0.006, 0]}>
            <boxGeometry args={[ANNEX_D + 0.05, 0.012, 0.2]} />
            <meshStandardMaterial color="#6e5137" roughness={0.85} />
          </mesh>
          <mesh position={[0, ANNEX_H - 0.008, 0]}>
            <boxGeometry args={[ANNEX_D, 0.014, 0.2]} />
            <meshStandardMaterial color="#b8b2a4" roughness={0.9} />
          </mesh>
          <mesh position={[ANNEX_D / 2 - 0.006, 0.125, 0]} rotation-y={-Math.PI / 2}>
            <planeGeometry args={[0.2, 0.245]} />
            <meshBasicMaterial map={getVestibuleWallTexture()} color={[1.35, 1.3, 1.2]} toneMapped={false} />
          </mesh>
          {/* Licht-Spill der inneren Türöffnung auf dem Holzboden */}
          <mesh position={[ANNEX_D / 2 - 0.045, 0.014, 0.035]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.08, 0.07]} />
            <meshBasicMaterial
              color="#ffc478"
              transparent
              opacity={0.4}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              toneMapped={false}
            />
          </mesh>
          {/* Deckenlampen-Punkt (liest als Quelle des warmen Lichts) */}
          <mesh position={[0.02, ANNEX_H - 0.02, 0]} rotation-x={Math.PI / 2}>
            <circleGeometry args={[0.016, 10]} />
            <meshBasicMaterial color={[2.2, 1.9, 1.3]} toneMapped={false} side={THREE.DoubleSide} />
          </mesh>
          {/* Laibungs-Streifen an der Außenkante — die Öffnung bekommt
              sichtbare Tiefe, bevor man eintritt */}
          {[-1, 1].map((s) => (
            <mesh key={s} position={[-ANNEX_D / 2 + 0.012, ANNEX_H / 2, s * 0.105]}>
              <boxGeometry args={[0.03, ANNEX_H, 0.018]} />
              <meshStandardMaterial color="#2b2119" roughness={0.9} />
            </mesh>
          ))}
        </group>
        {/* blaues Fascia-Band (Dachkante des Anbaus) — Realität vor CI */}
        <mesh position={[0, ANNEX_H + 0.015, 0]}>
          <boxGeometry args={[ANNEX_D + 0.03, 0.035, ANNEX_LEN + 0.03]} />
          <meshStandardMaterial color="#3d6e9e" roughness={0.6} />
        </mesh>
        {/* Vordach: flache, WANDNAHE Dachplatte über der Terrasse auf
            schlanken Pfosten (Referenzfoto: Kantine mit Vordach). Bewusst
            knapp (ragt nur wenig aus), damit sie den Tür-Anflug/Glow nicht
            als dunkler Slab verdeckt. Hellgrau statt fast-schwarz. */}
        <mesh position={[-0.17, ANNEX_H + 0.028, 0]}>
          <boxGeometry args={[0.28, 0.024, ANNEX_LEN]} />
          <meshStandardMaterial color="#6f7178" roughness={0.85} metalness={0.05} />
        </mesh>
        {[-2.35, -1.35, -0.3, 0.75, 1.5, 2.25].map((z) => (
          <mesh key={z} position={[-0.29, (ANNEX_H + 0.03) / 2, z]}>
            <cylinderGeometry args={[0.012, 0.012, ANNEX_H + 0.03, 6]} />
            <meshStandardMaterial color="#4a4d52" metalness={0.5} roughness={0.5} />
          </mesh>
        ))}
        {/* warme Fenster entlang der Terrasse (Original) — südlich der Tür */}
        {[-0.9, -0.15, 0.6, 1.3, 2.0].map((z) => (
          <mesh key={z} position={[-ANNEX_D / 2 - 0.004, 0.13, z]} rotation-y={-Math.PI / 2}>
            <planeGeometry args={[0.22, 0.12]} />
            <meshStandardMaterial
              color="#ffb765" emissive="#ff9d3f" emissiveIntensity={1.6}
              toneMapped={false} roughness={1}
            />
          </mesh>
        ))}
        {/* offenes Türblatt (~105° aufgeschwungen) */}
        <group position={[-ANNEX_D / 2 - 0.01, 0, -1.58]} rotation-y={1.83}>
          <mesh position={[0.08, 0.13, 0]}>
            <boxGeometry args={[0.16, 0.26, 0.014]} />
            <meshStandardMaterial color="#2f5d8a" roughness={0.75} />
          </mesh>
        </group>
        {/* v13-K1: Staub-Motten im Türlicht — die Licht-Schleuse wirkt wie
            ein Ort mit Atmosphäre, nicht wie eine Textur (1 Draw-Call). */}
        <DoorDust />
      </group>

      {/* Terrasse: Biertisch-Andeutungen entlang der langen Terrasse */}
      {[-0.1, 0.9, 1.95].map((z) => (
        <group key={z} position={[-DEPTH / 2 - ANNEX_D - 0.25, 0, z]}>
          <mesh position={[0, 0.075, 0]}>
            <boxGeometry args={[0.14, 0.02, 0.5]} />
            <meshStandardMaterial color="#8a6a42" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.035, 0]}>
            <boxGeometry args={[0.04, 0.07, 0.44]} />
            <meshStandardMaterial color="#5a4630" roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* warmes Licht vor dem Anbau (gebakene Lache) + Erdung */}
      <LightPool position={[-DEPTH / 2 - 0.55, -0.011, -0.3]} scale={[2, 3.4]} color="#ff9d4a" opacity={0.24} />
      {/* Lichtschein aus der offenen Tür — v9-E3 an die linke/hintere Ecke
          (Welt z≈−1.95 → clubhouse-rel z=−1.65) */}
      <LightPool position={[-DEPTH / 2 - ANNEX_D - 0.35, -0.009, -1.65]} scale={[0.9, 0.6]} color="#ffb26a" opacity={0.55} />
      <AOBlob position={[-0.05, -0.012, 0]} scale={[DEPTH + 1.4, LEN + 1]} opacity={0.6} />

      {/* Fahnenmasten (SVA rot-schwarz + gedimmte zweite) — v9-E3 flankieren
          jetzt die Eingangs-Ecke (Tür bei clubhouse-rel z≈−1.65) */}
      {[{ z: -1.35, flag: COLORS.red }, { z: -2.05, flag: '#2c2c30' }].map(({ z, flag }, i) => (
        <group key={i} position={[-DEPTH / 2 - 0.5, 0, z]}>
          <mesh position={[0, 0.42, 0]}>
            <cylinderGeometry args={[0.012, 0.016, 0.84, 6]} />
            <meshStandardMaterial color="#c8ccd2" metalness={0.6} roughness={0.4} />
          </mesh>
          <mesh position={[0.07, 0.76, 0]}>
            <planeGeometry args={[0.14, 0.09]} />
            <meshStandardMaterial color={flag} side={THREE.DoubleSide} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  )
}
