import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { sampleFlightG, cameraState, STATION_COUNT } from './CameraPath'
import { scrollToG, gToU, gToTeam } from './anchors'
import { teamState, focusLookAt } from './teamLayout'
import { PITCH } from '../utils/constants'
import {
  PARTY_HOP,
  samplePartyApproach,
  samplePartyInside,
  partySettle,
} from './partyPath'

// Scroll-getriebene Kamerafahrt. Der Ziel-Fortschritt kommt aus dem
// Store (DOM-Scroll). Wir dämpfen ihn zeitbasiert → cinematisches
// Nachziehen statt 1:1-Ruckeln, Nutzer bleibt aber jederzeit Herr
// über die Richtung (kein Scroll-Hijacking).
// DEV: feste Kamera via ?cam=x,y,z,lx,ly,lz (für Referenz-Vergleichspaare)
const devCam = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('cam')
  if (!raw) return null
  const v = raw.split(',').map(Number)
  return v.length === 6 && v.every((n) => !isNaN(n)) ? v : null
})()

// v12-E6: Geometrie der Süd-Bande (muss zu Barrier.tsx passen). 6 Tafeln:
// [Verein, Slot0..3, CTA]. Das Karussell fokussiert die 4 Slot-Tafeln.
const SP_BOARD_W = PITCH.width * 0.86
const SP_PANELS = 6
const SP_U = 6 / (STATION_COUNT - 1) // Scroll-Param der Sponsoren-Station
// v14-D: Mannschafts-Flyover. Präsenz der Station in Stations-Einheiten g
// (anchors.ts): Ankunft g 1.55→2, Flyover g 2→3, Ausflug g 3→3.45.
function teamPresence(g: number): number {
  if (g >= 2 && g <= 3) return 1
  const d = g < 2 ? 2 - g : g - 3
  return 1 - smoothstep(0.08, 0.45, d)
}
// Landscape: Die linke Bildseite gehört der Sticky-Textspalte. Statt die
// Kamera quer zu versetzen, verschiebt eine View-Offset-Projektion das Bild
// nach rechts — die Komposition der Keyframes bleibt erhalten, der Fokus-
// punkt rückt nur aus der Bildmitte in die rechte Bühnenhälfte.
const TEAM_VIEW_SHIFT = 0.15 // Anteil der Bildbreite
function sponsorBoardX(focus: number): number {
  const panelW = SP_BOARD_W / SP_PANELS
  const boardIndex = 1 + THREE.MathUtils.clamp(focus, 0, 3) // Slot-Tafeln = Board 1..4
  return -SP_BOARD_W / 2 + (boardIndex + 0.5) * panelW
}
function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

export function CameraRig() {
  const camera = useThree((s) => s.camera)
  const smoothed = useRef(0) // g (Stations-Einheiten inkl. Flyover)
  const viewShift = useRef(0)
  const focusPt = useRef({ x: 0, y: 0, z: 0 })
  const smoothedParty = useRef(0)
  const smoothedSponsorX = useRef(sponsorBoardX(0))
  const pos = useRef(new THREE.Vector3())
  const look = useRef(new THREE.Vector3())
  const flightPos = useRef(new THREE.Vector3())
  const flightLook = useRef(new THREE.Vector3())
  const currentLook = useRef(new THREE.Vector3(0, 0.4, 0))

  useFrame((state, delta) => {
    if (devCam) {
      camera.position.set(devCam[0], devCam[1], devCam[2])
      camera.lookAt(devCam[3], devCam[4], devCam[5])
      cameraState.u = 1 // Flutlicht voll an für Vergleichsbilder
      return
    }
    const target = scrollToG(useStore.getState().scrollProgress)
    // zeitbasierte Dämpfung (frameratenunabhängig) — läuft auch im
    // Partyraum weiter, damit die Fahrt beim Austritt schon stimmt.
    // v14-D: gedämpft wird g (Stations-Einheiten inkl. Flyover-Strecke);
    // u bleibt für alle anderen Leser exakt das alte 8-Stationen-Raster.
    smoothed.current = THREE.MathUtils.damp(smoothed.current, target, 4, delta)
    const g = smoothed.current
    const uNow = gToU(g)
    cameraState.u = uNow // für Flutlicht/Ball/Staub (Anstoß)
    teamState.s = gToTeam(g)
    teamState.w = teamPresence(g)

    // Partyraum-DURCHFAHRT (v5): gedämpfter Fortschritt — die Kamera
    // fährt kontinuierlich zur Tür, der Welt-Hop passiert genau beim
    // Durchgang durch PARTY_HOP (Türöffnung füllt das Bild).
    const ppTarget = useStore.getState().partyProgress
    // v11-E3: sanftere Dämpfung (5→3.8) → der Schwenk zieht weicher nach.
    smoothedParty.current = THREE.MathUtils.damp(smoothedParty.current, ppTarget, 3.8, delta)
    const pp = smoothedParty.current
    // v14-E4: Der Windfang ist nur 0.3 tief / 0.2 breit — im Tür-Fenster
    // senken wir die Near-Plane ab, sonst clippen Laibung/Decke beim
    // Durchtritt. Außerhalb sofort zurück (Tiefen-Präzision).
    const persp = camera as THREE.PerspectiveCamera
    const wantNear = pp > 0.3 && pp < 0.55 ? 0.045 : 0.1
    if (persp.near !== wantNear) {
      persp.near = wantNear
      persp.updateProjectionMatrix()
    }
    if (pp > 0.005) {
      if (persp.view && persp.view.enabled) persp.clearViewOffset()
      const aspect = state.size.width / state.size.height
      if (pp < PARTY_HOP) {
        // Anflug außen: weich aus der laufenden Fahrt in die Tür-Kurve
        sampleFlightG(g, flightPos.current, flightLook.current)
        samplePartyApproach(pp, pos.current, look.current)
        const w = THREE.MathUtils.clamp(pp / 0.1, 0, 1) // Einblendung
        pos.current.lerpVectors(flightPos.current, pos.current, w)
        look.current.lerpVectors(flightLook.current, look.current, w)
      } else {
        samplePartyInside(pp, pos.current, look.current)
        // Portrait: erst in der Raum-Totale zurückziehen (nicht im Flur);
        // Clamp hält die Kamera vor der Nordwest-Ecke (Wände bei −1.6).
        if (aspect < 1) {
          const k = 1 + (1 - aspect) * 0.55 * partySettle(pp)
          pos.current.sub(look.current).multiplyScalar(k).add(look.current)
          pos.current.y += (1 - aspect) * 0.08 * partySettle(pp)
          pos.current.x = Math.max(pos.current.x, -1.42)
          pos.current.z = Math.max(pos.current.z, -1.42)
        }
        // dezentes Atmen in der Totale
        const t = state.clock.elapsedTime
        pos.current.x += Math.sin(t * 0.22) * 0.04 * partySettle(pp)
      }
      camera.position.copy(pos.current)
      currentLook.current.set(
        THREE.MathUtils.damp(currentLook.current.x, look.current.x, 9, delta),
        THREE.MathUtils.damp(currentLook.current.y, look.current.y, 9, delta),
        THREE.MathUtils.damp(currentLook.current.z, look.current.z, 9, delta),
      )
      // Beim Hop springt auch der Blick hart mit (kein Nachziehen quer
      // durch die Welten): Distanz-Heuristik erkennt den Teleport.
      if (currentLook.current.distanceToSquared(look.current) > 100) {
        currentLook.current.copy(look.current)
      }
      camera.lookAt(currentLook.current)
      return
    }

    sampleFlightG(g, pos.current, look.current)

    const aspect = state.size.width / state.size.height

    // v14-D: Mannschafts-Station — Präsenz 1 auf der Flyover-Strecke.
    const wMann = teamState.w
    if (wMann > 0.001) {
      // Der Blick ruht nacheinander auf jeder Fokus-Karte (Plateaus) und
      // gleitet dann weiter — die Keyframe-Blickkurve liefert die grobe
      // Richtung, die Fokus-Karte zieht den Blick zu sich.
      const wf = focusLookAt(teamState.s, focusPt.current) * 0.5 * wMann
      if (wf > 0.001) {
        look.current.x += (focusPt.current.x - look.current.x) * wf
        look.current.y += (focusPt.current.y - look.current.y) * wf
        look.current.z += (focusPt.current.z - look.current.z) * wf
      }
    }

    // Portrait-Anpassung (v4-Audit): die Stationen sind für 16:9
    // komponiert — auf schmalen Viewports zieht die Kamera vom
    // Blickpunkt zurück, damit die Komposition erhalten bleibt.
    if (aspect < 1) {
      // v14-D: Im Flyover nur ein milder Rückzug — die Karten sollen groß
      // bleiben (Tablet hochkant). Am Telefon trägt ohnehin das DOM-Deck.
      const kFull = Math.min(1.75, 1 + (1 - aspect) * 1.1)
      const k = THREE.MathUtils.lerp(kFull, 1 + (1 - aspect) * 0.45, wMann)
      pos.current.sub(look.current).multiplyScalar(k).add(look.current)
      pos.current.y += (1 - aspect) * 0.5 * (1 - wMann * 0.6) // leicht höher für mehr Kontext
    }

    // v14-D: Bildverschiebung für die Textspalte (nur Landscape, weich ein/aus)
    const persp2 = camera as THREE.PerspectiveCamera
    // Hochformat (Tablet): Text steht oben → Bild nach unten verschieben.
    const wantShift = aspect >= 1 ? TEAM_VIEW_SHIFT * wMann : 0
    const wantShiftY = aspect < 1 ? 0.13 * wMann : 0
    viewShift.current = wantShift + wantShiftY
    if (viewShift.current > 0.0005) {
      const w = state.size.width
      const h = state.size.height
      persp2.setViewOffset(w, h, -wantShift * w, -wantShiftY * h, w, h)
    } else if (persp2.view && persp2.view.enabled) {
      persp2.clearViewOffset()
    }

    // dezenter Idle-Sway für Lebendigkeit
    const t = state.clock.elapsedTime
    // v14-D: im Flyover ruhiger (die Fahrt selbst ist die Bewegung)
    const sway = (1 - uNow * 0.6) * (1 - 0.65 * wMann) // oben mehr, unten ruhiger
    pos.current.x += Math.sin(t * 0.18) * 0.14 * sway
    pos.current.y += Math.sin(t * 0.23 + 1.3) * 0.08 * sway

    // v12-E6: Sponsoren-Karussell — nahe der Sponsoren-Station fährt die Kamera
    // seitlich an der Bande entlang auf die fokussierte Tafel (Pfeile im DOM).
    // Der Fokus-x wird gedämpft → sanftes „von Bande zu Bande fahren".
    const wSp = smoothstep(0.11, 0.03, Math.abs(uNow - SP_U)) // 1 an der Station, 0 weg
    if (wSp > 0.001) {
      const targetBx = sponsorBoardX(useStore.getState().sponsorFocus)
      smoothedSponsorX.current = THREE.MathUtils.damp(smoothedSponsorX.current, targetBx, 3.5, delta)
      const bx = smoothedSponsorX.current
      pos.current.x = THREE.MathUtils.lerp(pos.current.x, bx + 0.1, wSp)
      look.current.x = THREE.MathUtils.lerp(look.current.x, bx, wSp)
    }

    camera.position.copy(pos.current)
    // zeitbasiert (nicht pro Frame): konvergiert auch bei niedriger FPS
    currentLook.current.set(
      THREE.MathUtils.damp(currentLook.current.x, look.current.x, 7.5, delta),
      THREE.MathUtils.damp(currentLook.current.y, look.current.y, 7.5, delta),
      THREE.MathUtils.damp(currentLook.current.z, look.current.z, 7.5, delta),
    )
    camera.lookAt(currentLook.current)
  })

  return null
}
