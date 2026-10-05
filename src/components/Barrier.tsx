import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { PITCH } from '../utils/constants'
import { AOBlob } from './AOBlob'
import { BANDE_H, BANDE_W, TAFEL_FUGE, bandeTafeln, entwurfAufBande } from './bandeTextur'
import { BANDE_PANELE } from '../data/bandeLayout'
import { abonniere } from '../partner/bande/entwurf'

// ─────────────────────────────────────────────────────────────
// Die echte Umrandung nach REFERENZ_MODELL: niedrige verzinkte
// Rohr-Reling rundum (statt v2-Tribüne/Bande) + Sponsor-Tafeln
// nur auf der SÜD-Seite (vor dem Wald). Reale Sponsoren werden
// nicht erfunden — Platzhalter-Tafeln + SVA-Slogans.
// Beleg: IMG_6074/f001, dji_…143024_0160…/f001.
//
// v18-P: Die Bande besteht aus EINZELNEN Tafeln (je eigene Textur, auf
// Modulebene gecacht — bandeTextur.ts) vor einem dunklen Träger. Logos
// werden getrimmt, nach Fläche normiert und auf hellem/dunklem Grund nach
// Kontrast gesetzt (src/partner/bande/). Nur die Platzseite trägt Werbung;
// Ober-/Rückseite sind schlicht (vorher lief die Textur verzerrt über die
// Oberkante).
// ─────────────────────────────────────────────────────────────

const OFF = 0.55 // Abstand Reling ↔ Außenlinie
const RAIL_H = 0.11
const HW = PITCH.width / 2 + OFF
const HH = PITCH.height / 2 + OFF

const BOARD_Y = 0.17
const BOARD_Z = HH - 0.02
const BOARD_D = 0.03
const PANEL_W = BANDE_W / BANDE_PANELE

export function Barrier() {
  // Tafeln aus dem Modul-Cache (einmalig erzeugt, nie neu gebacken)
  const tafeln = useMemo(() => bandeTafeln(), [])
  // Konfigurator-Entwurf → nur die freie Tafel neu zeichnen
  // (entprellt: Tippen lädt nicht bei jedem Zeichen eine Textur hoch)
  useEffect(() => {
    entwurfAufBande()
    let t: number | undefined
    const ab = abonniere(() => {
      window.clearTimeout(t)
      t = window.setTimeout(entwurfAufBande, 90)
    })
    return () => {
      ab()
      window.clearTimeout(t)
    }
  }, [])
  const postsRef = useRef<THREE.InstancedMesh>(null)

  // Pfosten instanziert (1 Draw-Call)
  const postTransforms = useMemo(() => {
    const items: [number, number][] = []
    const step = 1.15
    for (let x = -HW; x <= HW + 0.01; x += step) {
      items.push([x, -HH], [x, HH])
    }
    for (let z = -HH + step; z < HH; z += step) {
      items.push([-HW, z], [HW, z])
    }
    return items
  }, [])

  useEffect(() => {
    const m = postsRef.current
    if (!m) return
    const mat = new THREE.Matrix4()
    postTransforms.forEach(([x, z], i) => {
      mat.makeTranslation(x, RAIL_H / 2, z)
      m.setMatrixAt(i, mat)
    })
    m.instanceMatrix.needsUpdate = true
  }, [postTransforms])

  return (
    <group>
      {/* Pfosten */}
      <instancedMesh ref={postsRef} args={[undefined, undefined, postTransforms.length]}>
        <cylinderGeometry args={[0.012, 0.012, RAIL_H, 5]} />
        <meshStandardMaterial color="#3a3d42" metalness={0.5} roughness={0.5} />
      </instancedMesh>
      {/* Handlauf (verzinkt, 4 Seiten) */}
      {[-1, 1].map((s) => (
        <mesh key={`z${s}`} position={[0, RAIL_H, s * HH]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.016, 0.016, HW * 2, 6]} />
          <meshStandardMaterial color="#9aa2ac" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}
      {[-1, 1].map((s) => (
        <mesh key={`x${s}`} position={[s * HW, RAIL_H, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.016, 0.016, HH * 2, 6]} />
          <meshStandardMaterial color="#9aa2ac" metalness={0.75} roughness={0.3} />
        </mesh>
      ))}

      {/* Sponsor-Bande SÜD (vor dem Wald), VOR der Reling (Platzseite).
          Träger dunkel; die Tafeln sitzen als eigene Flächen davor und
          blicken zum Platz (−z). Leicht selbstleuchtend → nachts lesbar. */}
      <mesh position={[0, BOARD_Y, BOARD_Z]}>
        <boxGeometry args={[BANDE_W + 0.02, BANDE_H + 0.012, BOARD_D]} />
        <meshStandardMaterial color="#141213" roughness={0.8} />
      </mesh>
      {tafeln.map((t, p) => (
        <mesh
          key={p}
          // Lesereihenfolge vom Platz aus: Tafel 0 (Verein) liegt bei +x
          position={[BANDE_W / 2 - (p + 0.5) * PANEL_W, BOARD_Y, BOARD_Z - BOARD_D / 2 - 0.002]}
          rotation-y={Math.PI}
        >
          <planeGeometry args={[PANEL_W - TAFEL_FUGE, BANDE_H]} />
          <meshStandardMaterial map={t.tex} emissiveMap={t.tex} emissive="#ffffff" emissiveIntensity={0.2} roughness={0.6} />
        </mesh>
      ))}
      {/* Standfüße der Bande */}
      {Array.from({ length: 6 }, (_, i) => -PITCH.width * 0.4 + (i * PITCH.width * 0.8) / 5).map((x) => (
        <mesh key={x} position={[x, 0.03, BOARD_Z]}>
          <boxGeometry args={[0.05, 0.11, 0.05]} />
          <meshStandardMaterial color="#3a3d42" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <AOBlob position={[0, 0.004, HH]} scale={[PITCH.width * 0.9, 0.5]} opacity={0.35} />
    </group>
  )
}
