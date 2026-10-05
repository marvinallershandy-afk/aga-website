import { useMemo } from 'react'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { zeichneLeer } from '../partner/bande/tafel'
import { schriftenBereit } from '../partner/bande/tafel'

// Ballfangzäune hinter beiden Toren (hohe Maschendraht-Wände mit
// dunklen Pfosten) — nach REFERENZ (dji_…0155…/f020, IMG_6082).
// Am Ost-Zaun eine freie CI-Bandentafel (schwarz, rote Kante, Claim in
// Anton — docs/DESIGN.md §8a) statt des alten gestrichelten
// „DEIN BANNER?"-Platzhalters (v19-3D §2.10.3).

const FENCE_X = PITCH.width / 2 + 0.95
const WIDTH = 2.6
const HEIGHT = 0.55

let meshTex: THREE.CanvasTexture | null = null
function getMeshTexture() {
  if (meshTex) return meshTex
  // v14-E5: Moiré-Fix — die alte 64px-Textur (6px-Zellen, 1.2px-Linien,
  // 10× getiled) flimmerte im flachen Winkel als Schachbrett. Jetzt:
  // größere Zellen, DICKERE Stränge (mipmappen sauber), weniger Tiles
  // + Anisotropie. Stilisiert bleibt's — aber ruhig statt glitzernd.
  const cv = document.createElement('canvas')
  cv.width = cv.height = 128
  const ctx = cv.getContext('2d')!
  ctx.strokeStyle = 'rgba(148,156,166,0.55)'
  ctx.lineWidth = 3
  for (let i = 0; i <= 128; i += 16) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 128); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(128, i); ctx.stroke()
  }
  meshTex = new THREE.CanvasTexture(cv)
  meshTex.wrapS = meshTex.wrapT = THREE.RepeatWrapping
  meshTex.repeat.set(6, 1.7)
  meshTex.anisotropy = 8
  return meshTex
}

// v19-3D (§2.10.3): freie CI-Bandentafel statt gestrichelter Platzhalter-
// Box. Gleiche Zeichnung wie die 3D-Bande (tafel.ts zeichneLeer): schwarz,
// rote Kante links, Claim in Anton, Einladung in Archivo. Anton wird
// asynchron nachgeladen und die Textur einmal aktualisiert.
let bannerTex: THREE.CanvasTexture | null = null
function getBannerTexture() {
  if (bannerTex) return bannerTex
  const cv = document.createElement('canvas')
  cv.width = 1280; cv.height = 288
  const ctx = cv.getContext('2d')!
  zeichneLeer(ctx, 0, 0, 1280, 288, 1) // Claim „HIER FEHLT DEIN NAME"
  const t = new THREE.CanvasTexture(cv)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 16
  bannerTex = t
  schriftenBereit().then(() => {
    ctx.clearRect(0, 0, 1280, 288)
    zeichneLeer(ctx, 0, 0, 1280, 288, 1)
    t.needsUpdate = true
  })
  return bannerTex
}

// Ein Zaun-Panel beliebiger Breite an fester x-Ebene, zentriert auf zCenter.
function FencePanel({ x, zCenter, width, banner }: { x: number; zCenter: number; width: number; banner?: boolean }) {
  const tex = useMemo(() => getMeshTexture(), [])
  const bannerTex2 = useMemo(() => getBannerTexture(), [])
  // Pfosten ~0.65 m Abstand
  const n = Math.max(2, Math.round(width / 0.65))
  const posts = Array.from({ length: n + 1 }, (_, i) => -width / 2 + (width * i) / n)
  return (
    <group position={[x, 0, zCenter]}>
      {posts.map((z) => (
        <mesh key={z} position={[0, HEIGHT / 2, z]}>
          <cylinderGeometry args={[0.015, 0.015, HEIGHT, 5]} />
          <meshStandardMaterial color="#2c2f34" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <mesh position={[0, HEIGHT / 2, 0]} rotation-y={Math.PI / 2}>
        <planeGeometry args={[width, HEIGHT]} />
        <meshBasicMaterial map={tex} transparent side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {banner && (
        // v10-E1: klar VOR das Gitter (x=−0.07, Platzseite), größer, leicht
        // selbstleuchtend + renderOrder → Maschendraht verdeckt die Werbung
        // nicht mehr.
        <mesh position={[-0.07, 0.31, 0.1]} rotation-y={-Math.PI / 2} renderOrder={3}>
          <planeGeometry args={[0.92, 0.2]} />
          <meshStandardMaterial map={bannerTex2} emissiveMap={bannerTex2} emissive="#ffffff" emissiveIntensity={0.22} roughness={0.75} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

export function BallStopFence() {
  // v9-E3 (Referenzfoto dji_…0181): der Ost-Ballfangzaun ist DURCHGEHEND,
  // KEINE Öffnung (die v8-Lücke war falsch). Der Kamera-Anflug zur
  // Vereinsheim-Tür führt jetzt NÖRDLICH um das Zaun-Ende herum („um die
  // Ecke", s. camera/partyPath.ts) — die Tür sitzt am linken/hinteren
  // Gebäudeteil, nördlich des Zauns. Beide Seiten wieder EIN Panel.
  return (
    <group>
      <FencePanel x={FENCE_X} zCenter={-0.45} width={WIDTH} banner />
      <FencePanel x={-FENCE_X} zCenter={0} width={WIDTH} />
    </group>
  )
}
