import { useMemo, useRef, useEffect } from 'react'
import * as THREE from 'three'
import { PITCH, COLORS } from '../utils/constants'
import { SPONSORS, SPONSOR_PLACEHOLDER_SLOTS, type Sponsor } from '../data/club'
import { AOBlob } from './AOBlob'
import { useStore } from '../store/useStore'

// ─────────────────────────────────────────────────────────────
// Die echte Umrandung nach REFERENZ_MODELL: niedrige verzinkte
// Rohr-Reling rundum (statt v2-Tribüne/Bande) + Sponsor-Tafeln
// nur auf der SÜD-Seite (vor dem Wald). Reale Sponsoren werden
// nicht erfunden — Platzhalter-Tafeln + SVA-Slogans.
// Beleg: IMG_6074/f001, dji_…143024_0160…/f001.
// ─────────────────────────────────────────────────────────────

const OFF = 0.55 // Abstand Reling ↔ Außenlinie
const RAIL_H = 0.11
const HW = PITCH.width / 2 + OFF
const HH = PITCH.height / 2 + OFF

// Text mittig in ein Rechteck setzen, Schriftgrad schrumpfen bis er passt
// (mehrzeilig via \n). Sorgt für gestochen scharfe, nie überlaufende Schrift.
function fitText(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number, maxW: number, basePx: number, weight = 800) {
  const lines = text.split('\n')
  let px = basePx
  const font = (p: number) => `${weight} ${p}px Archivo, system-ui, sans-serif`
  for (; px > 8; px -= 2) {
    ctx.font = font(px)
    if (lines.every((l) => ctx.measureText(l).width <= maxW)) break
  }
  const lh = px * 1.12
  const y0 = cy - ((lines.length - 1) * lh) / 2
  lines.forEach((l, i) => ctx.fillText(l, cx, y0 + i * lh))
}

// v10-E1: Banden-Textur HOCHAUFLÖSEND + datengetrieben. Boards lesen aus
// SPONSORS[]: logoUrl gesetzt → echtes Logo (async nachgeladen, scharf),
// sonst „HIER KÖNNTE DEIN LOGO STEHEN". Canvas 4096×256 (vorher 2048×64)
// → Text bleibt beim Sponsoren-Zoom scharf. Erstes Board = Verein, letztes
// = CTA; die begehrten Slots liegen mittig (dort zoomt die Station drauf).
// v13-K5: previewName + focusSlot — der eingetippte Firmenname wird als
// „gedruckte" Bande in den gerade fokussierten leeren Slot gebacken.
function makeBoardsTexture(previewName = '', focusSlot = 0): THREE.CanvasTexture {
  const cv = document.createElement('canvas')
  // Breite an das Banden-Seitenverhältnis gekoppelt (Board ist sehr breit &
  // niedrig) → Schrift wird NICHT horizontal gestreckt (der alte „matschig"-
  // Effekt kam von 16:1-Canvas auf ~37:1-Bande).
  cv.width = 8192
  cv.height = 220
  const ctx = cv.getContext('2d')!
  // v13-K5: dunkle Grundfüllung — die Banden-Box zeigt an Ober-/Unterkante
  // Textur-Randzeilen; vorher schmierte dort heller Slot-Hintergrund lang.
  ctx.fillStyle = '#100d0e'
  ctx.fillRect(0, 0, cv.width, cv.height)
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  type Board = { kind: 'club' | 'cta' | 'empty' | 'logo' | 'name'; sponsor?: Sponsor }
  const slotCount = Math.max(SPONSOR_PLACEHOLDER_SLOTS, SPONSORS.length)
  const boards: Board[] = [{ kind: 'club' }]
  for (let i = 0; i < slotCount; i++) {
    const s = SPONSORS[i]
    boards.push(s ? (s.logoUrl ? { kind: 'logo', sponsor: s } : { kind: 'name', sponsor: s }) : { kind: 'empty' })
  }
  boards.push({ kind: 'cta' })

  const w = cv.width / boards.length
  const H = cv.height
  const pad = 10
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 16

  boards.forEach((b, i) => {
    const x0 = i * w
    const cx = x0 + w / 2
    const maxW = w - pad * 4
    if (b.kind === 'club') {
      ctx.fillStyle = '#17141a'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.fillStyle = COLORS.red; ctx.fillRect(x0 + pad, pad, 14, H - pad * 2)
      ctx.fillStyle = '#f0ece2'
      fitText(ctx, 'SV AGATHENBURG-\nDOLLERN 1949', cx + 7, H / 2, maxW, 62)
    } else if (b.kind === 'cta') {
      // v11-E6: CTA in CI-Rot, WhatsApp UND E-Mail (kein Preis).
      ctx.fillStyle = COLORS.red; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.fillStyle = '#0c0a0b'; ctx.fillRect(x0 + pad, pad, 14, H - pad * 2)
      ctx.fillStyle = '#ffffff'
      fitText(ctx, 'WERDE\nSPONSOR', cx, H / 2 - 18, maxW, 64)
      ctx.fillStyle = 'rgba(255,255,255,0.9)'
      fitText(ctx, 'WhatsApp · E-Mail', cx, H / 2 + 58, maxW, 28, 700)
    } else if (b.kind === 'name') {
      ctx.fillStyle = '#eef1f4'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.fillStyle = '#1a1718'
      fitText(ctx, b.sponsor!.name.toUpperCase(), cx, H / 2, maxW, 52)
    } else if (b.kind === 'logo') {
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      // async: echtes Logo laden und mittig einpassen
      const img = new Image()
      img.onload = () => {
        const bw = w - pad * 4, bh = H - pad * 4
        const r = Math.min(bw / img.width, bh / img.height)
        const dw = img.width * r, dh = img.height * r
        ctx.drawImage(img, cx - dw / 2, H / 2 - dh / 2, dw, dh)
        tex.needsUpdate = true
      }
      img.src = b.sponsor!.logoUrl!
    } else {
      // v13-K5: „Deine Bande"-Moment — der getippte Name erscheint als
      // echte gedruckte Sponsor-Bande im fokussierten Slot.
      const slotIdx = i - 1 // boards[0] = Verein
      // Die Banden-Front läuft in Welt-x GEGEN die Canvas-u-Richtung
      // (empirisch: Fokus 0 zeigt Canvas-Panel 4, Fokus 1 Panel 3) →
      // das angeschaute Canvas-Panel ist slotIdx = 3 − focus.
      if (previewName && slotIdx === 3 - focusSlot) {
        ctx.fillStyle = '#f2efe8'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
        ctx.fillStyle = COLORS.red; ctx.fillRect(x0 + pad, pad, 14, H - pad * 2)
        ctx.fillStyle = '#191416'
        fitText(ctx, previewName.toUpperCase(), cx + 7, H / 2 - 12, maxW, 64)
        ctx.fillStyle = 'rgba(25,20,22,0.55)'
        fitText(ctx, 'STOLZER PARTNER DES SVA', cx + 7, H / 2 + 62, maxW, 22, 800)
        ctx.fillStyle = COLORS.red
        ctx.fillRect(cx - Math.min(maxW, 520) / 2, H / 2 + 30, Math.min(maxW, 520), 6)
        return
      }
      // v11-E6: leerer Slot im CI-Look (Schwarz/Rot) statt weiß-cremiger Tafel.
      // Wechselnder, einladender Claim — kein Preis, klare „du fehlst"-Ansprache.
      const emptyIdx = i // Board-Index für Alternierung
      ctx.fillStyle = '#0f0c0d'; ctx.fillRect(x0 + pad, pad, w - pad * 2, H - pad * 2)
      ctx.fillStyle = COLORS.red; ctx.fillRect(x0 + pad, pad, 14, H - pad * 2)
      ctx.strokeStyle = 'rgba(233,29,41,0.6)'; ctx.lineWidth = 4
      ctx.setLineDash([18, 12]); ctx.strokeRect(x0 + pad * 3, pad * 3, w - pad * 6, H - pad * 6); ctx.setLineDash([])
      ctx.fillStyle = '#ffffff'
      const claim = emptyIdx % 2 ? 'HIER FEHLST\nNOCH DU' : 'DIESE BANDE\nSUCHT DICH'
      fitText(ctx, claim, cx + 7, H / 2 - 8, maxW, 54)
      ctx.fillStyle = 'rgba(233,29,41,0.9)'
      fitText(ctx, 'WERDE SPONSOR', cx + 7, H / 2 + 62, maxW, 24, 800)
    }
  })

  return tex
}

export function Barrier() {
  // v13-K5: Name + Fokus aus dem Store — die Bande wird bei jeder Eingabe
  // neu gebacken (einige ms, per Debounce im Eingabefeld entkoppelt).
  const previewName = useStore((s) => s.sponsorPreviewName)
  const focusSlot = useStore((s) => s.sponsorFocus)
  const boardsTex = useMemo(() => makeBoardsTexture(previewName, focusSlot), [previewName, focusSlot])
  useEffect(() => () => boardsTex.dispose(), [boardsTex])
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

      {/* Sponsor-Tafeln SÜD (vor dem Wald). v10-E1: VOR die Reling gerückt
          (z = HH−0.02, Platzseite), damit das Handlauf-Rohr die Werbung nicht
          mehr quert; leicht selbstleuchtend (emissiveMap) → nachts scharf
          lesbar. Textur 8192×220 ≈ Banden-Proportion → keine gestreckte Schrift.
          v10-E4: leicht angehoben + Standfüße → steht sichtbar, „Füße" werden
          beim Runterscrollen nicht mehr abgeschnitten. */}
      <mesh position={[0, 0.17, HH - 0.02]}>
        <boxGeometry args={[PITCH.width * 0.86, 0.24, 0.03]} />
        <meshStandardMaterial map={boardsTex} emissiveMap={boardsTex} emissive="#ffffff" emissiveIntensity={0.26} roughness={0.55} />
      </mesh>
      {/* Standfüße der Bande */}
      {Array.from({ length: 6 }, (_, i) => -PITCH.width * 0.4 + (i * PITCH.width * 0.8) / 5).map((x) => (
        <mesh key={x} position={[x, 0.03, HH - 0.02]}>
          <boxGeometry args={[0.05, 0.11, 0.05]} />
          <meshStandardMaterial color="#3a3d42" metalness={0.5} roughness={0.5} />
        </mesh>
      ))}
      <AOBlob position={[0, 0.004, HH]} scale={[PITCH.width * 0.9, 0.5]} opacity={0.35} />
    </group>
  )
}
