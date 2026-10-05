import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { sampleFlightG, cameraState, STATION_COUNT } from './CameraPath'
import { scrollToG, gToU, gToTeam } from './anchors'
import { teamState } from './teamLayout'
import { PITCH } from '../utils/constants'
import {
  PARTY_HOP,
  samplePartyApproach,
  samplePartyInside,
  partySettle,
} from './partyPath'
import {
  OVERVIEW,
  PLACE_SPECS,
  U_OVERVIEW,
  coverFov,
  easeInOut,
  mapClass,
  placeShot,
  type Shot,
} from './mapCamera'
import { mapWorld } from '../map/mapWorld'
import { INTRO_S, endIntro } from '../map/intro'
import { mapPanelRect } from '../map/layout'
import type { PlaceId } from '../map/places'
import { BANDE_PANELE, BANDE_SLOTS } from '../data/bandeLayout'

// Scroll-getriebene Kamerafahrt. Der Ziel-Fortschritt kommt aus dem
// Store (DOM-Scroll). Wir dämpfen ihn zeitbasiert → cinematisches
// Nachziehen statt 1:1-Ruckeln, Nutzer bleibt aber jederzeit Herr
// über die Richtung (kein Scroll-Hijacking).
// v16-K: Zweiter Modus „Karte": die Kamera steht in der Diorama-Totale
// und fliegt per Klick auf einen Marker zu einem Ort (ease, ~1,2 s).
// Der Bildausschnitt neben/über dem Panel wird per View-Offset zum
// Kamerabild — der Ort sitzt mittig im freien Bereich.
// DEV: feste Kamera via ?cam=x,y,z,lx,ly,lz (für Referenz-Vergleichspaare)
const devCam = (() => {
  if (!import.meta.env.DEV || typeof window === 'undefined') return null
  const raw = new URLSearchParams(window.location.search).get('cam')
  if (!raw) return null
  const v = raw.split(',').map(Number)
  return v.length === 6 && v.every((n) => !isNaN(n)) ? v : null
})()

// v12-E6: Geometrie der Süd-Bande (muss zu Barrier.tsx passen):
// [Verein, Slot0..N-1, CTA]. Das Karussell fokussiert die Slot-Tafeln.
// v18-P: Tafelzahl aus src/data/bandeLayout.ts (Hook für die Bandenansicht).
const SP_BOARD_W = PITCH.width * 0.86
const SP_PANELS = BANDE_PANELE
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
const TEAM_VIEW_SHIFT = 0.17 // Anteil der Bildbreite
// v14-M: Telefon hochkant — dort trägt das DOM-Taktik-Board die Aufstellung.
// Dahinter steht die Kamera RUHIG in einer hohen Draufsicht auf den Platz
// (keine Fahrt unter dem Board), weich ein-/ausgeblendet mit der Präsenz.
const PHONE_TEAM_POS = new THREE.Vector3(-0.3, 12.5, 1.9)
const PHONE_TEAM_LOOK = new THREE.Vector3(-0.3, 0, 0.1)
function sponsorBoardX(focus: number): number {
  const panelW = SP_BOARD_W / SP_PANELS
  const boardIndex = 1 + THREE.MathUtils.clamp(focus, 0, BANDE_SLOTS - 1) // Slot-Tafeln = Board 1..N
  return -SP_BOARD_W / 2 + (boardIndex + 0.5) * panelW
}
function smoothstep(a: number, b: number, x: number) {
  const t = THREE.MathUtils.clamp((x - a) / (b - a), 0, 1)
  return t * t * (3 - 2 * t)
}

/** Partyraum-Pose bei Durchfahrts-Fortschritt pp (≥ HOP: Pocket-Welt). */
function partyInsidePose(pp: number, aspect: number, t: number, pos: THREE.Vector3, look: THREE.Vector3) {
  samplePartyInside(pp, pos, look)
  // Portrait: erst in der Raum-Totale zurückziehen (nicht im Flur);
  // Clamp hält die Kamera vor der Nordwest-Ecke (Wände bei −1.6).
  if (aspect < 1) {
    const k = 1 + (1 - aspect) * 0.55 * partySettle(pp)
    pos.sub(look).multiplyScalar(k).add(look)
    pos.y += (1 - aspect) * 0.08 * partySettle(pp)
    pos.x = Math.max(pos.x, -1.42)
    pos.z = Math.max(pos.z, -1.42)
  }
  // dezentes Atmen in der Totale
  pos.x += Math.sin(t * 0.22) * 0.04 * partySettle(pp)
}

// ── v16-K: Karten-Modus ─────────────────────────────────────
const FLIGHT_S = 1.2 // Marker → Ort
const RIDE_S = 2.8 // Tür-Durchfahrt in den Partyraum
const CUT_S = 0.22 // Schleier-Schnitt beim Verlassen des Raums
type Key = 'tour' | 'overview' | 'intro' | PlaceId
// v17-D Intro: Hero (g 0) → über den Platz (g 1.5) in INTRO_A s, dann
// in die Karten-Totale (bis INTRO_S).
const INTRO_G = 1.5
const INTRO_A = 5

interface FrameState {
  size: { width: number; height: number }
  clock: THREE.Clock
}

/** Der gesamte Laufzeitzustand der Kamera (kein React-State). */
interface Rig {
  camera: THREE.PerspectiveCamera
  // Rundgang
  smoothed: number // g (Stations-Einheiten inkl. Flyover)
  smoothedParty: number
  smoothedSponsorX: number
  pos: THREE.Vector3
  look: THREE.Vector3
  flightPos: THREE.Vector3
  flightLook: THREE.Vector3
  currentLook: THREE.Vector3
  // Karte
  key: Key | ''
  t: number
  dur: number
  fromPos: THREE.Vector3
  fromLook: THREE.Vector3
  fromFov: number
  uA: number
  uB: number
  uEnd: number
  teamFrom: number
  teamTo: number
  ovFrom: number
  ovTo: number
  /** Partyraum im Karten-Modus: Durchfahrt pp und Phase. */
  pp: number
  ride: number
  phase: 'none' | 'fly' | 'ride'
  /** Schnitt raus aus dem Partyraum: 0..1 Schleier-Aufbau, −1 = keiner. */
  cut: number
  rect: { x: number; y: number; w: number; h: number }
  shot: Shot
  /** v17-D: verstrichene Intro-Zeit (s). */
  introT: number
}

function createRig(camera: THREE.PerspectiveCamera): Rig {
  return {
    camera,
    smoothed: 0,
    smoothedParty: 0,
    smoothedSponsorX: sponsorBoardX(0),
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
    flightPos: new THREE.Vector3(),
    flightLook: new THREE.Vector3(),
    currentLook: new THREE.Vector3(0, 0.4, 0),
    key: '',
    t: 1,
    dur: FLIGHT_S,
    fromPos: new THREE.Vector3(),
    fromLook: new THREE.Vector3(),
    fromFov: 46,
    uA: U_OVERVIEW,
    uB: U_OVERVIEW,
    uEnd: U_OVERVIEW,
    teamFrom: 0,
    teamTo: 0,
    ovFrom: 1,
    ovTo: 1,
    pp: 0,
    ride: 0,
    phase: 'none',
    cut: -1,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    shot: { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46 },
    introT: 0,
  }
}

/** Near-Plane im Tür-Fenster absenken (Windfang 0.3 tief / 0.2 breit). */
function setNearFor(r: Rig, pp: number) {
  const wantNear = pp > 0.3 && pp < 0.55 ? 0.045 : 0.1
  if (r.camera.near !== wantNear) {
    r.camera.near = wantNear
    r.camera.updateProjectionMatrix()
  }
}

function dampLook(r: Rig, rate: number, delta: number) {
  r.currentLook.set(
    THREE.MathUtils.damp(r.currentLook.x, r.look.x, rate, delta),
    THREE.MathUtils.damp(r.currentLook.y, r.look.y, rate, delta),
    THREE.MathUtils.damp(r.currentLook.z, r.look.z, rate, delta),
  )
}

// ── Scroll-Rundgang (bestehende Fahrt, unverändert) ─────────
function tourFrame(r: Rig, state: FrameState, delta: number) {
  const camera = r.camera
  const target = scrollToG(useStore.getState().scrollProgress)
  // zeitbasierte Dämpfung (frameratenunabhängig) — läuft auch im
  // Partyraum weiter, damit die Fahrt beim Austritt schon stimmt.
  // v14-D: gedämpft wird g (Stations-Einheiten inkl. Flyover-Strecke);
  // u bleibt für alle anderen Leser exakt das alte 8-Stationen-Raster.
  r.smoothed = THREE.MathUtils.damp(r.smoothed, target, 4, delta)
  const g = r.smoothed
  const uNow = gToU(g)
  cameraState.u = uNow // für Flutlicht/Ball/Staub (Anstoß)
  teamState.s = gToTeam(g)
  teamState.w = teamPresence(g)

  // Partyraum-DURCHFAHRT (v5): gedämpfter Fortschritt — die Kamera
  // fährt kontinuierlich zur Tür, der Welt-Hop passiert genau beim
  // Durchgang durch PARTY_HOP (Türöffnung füllt das Bild).
  const ppTarget = useStore.getState().partyProgress
  // v11-E3: sanftere Dämpfung (5→3.8) → der Schwenk zieht weicher nach.
  r.smoothedParty = THREE.MathUtils.damp(r.smoothedParty, ppTarget, 3.8, delta)
  const pp = r.smoothedParty
  // v14-E4: Der Windfang ist nur 0.3 tief / 0.2 breit — im Tür-Fenster
  // senken wir die Near-Plane ab, sonst clippen Laibung/Decke beim
  // Durchtritt. Außerhalb sofort zurück (Tiefen-Präzision).
  setNearFor(r, pp)
  if (pp > 0.005) {
    if (camera.view && camera.view.enabled) camera.clearViewOffset()
    const aspect = state.size.width / state.size.height
    if (pp < PARTY_HOP) {
      // Anflug außen: weich aus der laufenden Fahrt in die Tür-Kurve
      sampleFlightG(g, r.flightPos, r.flightLook)
      samplePartyApproach(pp, r.pos, r.look)
      const w = THREE.MathUtils.clamp(pp / 0.1, 0, 1) // Einblendung
      r.pos.lerpVectors(r.flightPos, r.pos, w)
      r.look.lerpVectors(r.flightLook, r.look, w)
    } else {
      partyInsidePose(pp, aspect, state.clock.elapsedTime, r.pos, r.look)
    }
    camera.position.copy(r.pos)
    dampLook(r, 9, delta)
    // Beim Hop springt auch der Blick hart mit (kein Nachziehen quer
    // durch die Welten): Distanz-Heuristik erkennt den Teleport.
    if (r.currentLook.distanceToSquared(r.look) > 100) r.currentLook.copy(r.look)
    camera.lookAt(r.currentLook)
    return
  }

  sampleFlightG(g, r.pos, r.look)

  const aspect = state.size.width / state.size.height

  // v14-D: Mannschafts-Station — Präsenz 1 auf der Flyover-Strecke.
  // v15-P: EIN ruhiger Kameraweg bis zur Totale — kein Blick-Zug mehr
  // von Karte zu Karte, die Keyframe-Blickkurve allein führt.
  const wMann = teamState.w

  // Portrait-Anpassung (v4-Audit): die Stationen sind für 16:9
  // komponiert — auf schmalen Viewports zieht die Kamera vom
  // Blickpunkt zurück, damit die Komposition erhalten bleibt.
  if (aspect < 1) {
    // v14-D: Im Flyover nur ein milder Rückzug — die Karten sollen groß
    // bleiben (Tablet hochkant). Am Telefon trägt ohnehin das DOM-Deck.
    const kFull = Math.min(1.75, 1 + (1 - aspect) * 1.1)
    const k = THREE.MathUtils.lerp(kFull, 1 + (1 - aspect) * 0.45, wMann)
    r.pos.sub(r.look).multiplyScalar(k).add(r.look)
    r.pos.y += (1 - aspect) * 0.5 * (1 - wMann * 0.6) // leicht höher für mehr Kontext
  }

  // v14-M: Telefon hochkant → ruhige Draufsicht hinter dem Taktik-Board.
  const phone = aspect < 0.8 && state.size.width <= 640
  if (phone && wMann > 0.001) {
    const e = wMann * wMann * (3 - 2 * wMann)
    r.pos.lerp(PHONE_TEAM_POS, e)
    r.look.lerp(PHONE_TEAM_LOOK, e)
  }

  // v14-D: Bildverschiebung für die Textspalte (nur Landscape, weich ein/aus)
  // Hochformat (Tablet): Text steht oben → Bild nach unten verschieben.
  const wantShift = aspect >= 1 ? TEAM_VIEW_SHIFT * wMann : 0
  const wantShiftY = aspect < 1 && !phone ? 0.13 * wMann : 0
  if (wantShift + wantShiftY > 0.0005) {
    const w = state.size.width
    const h = state.size.height
    camera.setViewOffset(w, h, -wantShift * w, -wantShiftY * h, w, h)
  } else if (camera.view && camera.view.enabled) {
    camera.clearViewOffset()
  }

  // dezenter Idle-Sway für Lebendigkeit
  const t = state.clock.elapsedTime
  // v14-D: im Flyover ruhiger (die Fahrt selbst ist die Bewegung)
  // v14-M: in der Mannschaft praktisch still (ruhig, klar)
  const sway = (1 - uNow * 0.6) * (1 - 0.85 * wMann) // oben mehr, unten ruhiger
  r.pos.x += Math.sin(t * 0.18) * 0.14 * sway
  r.pos.y += Math.sin(t * 0.23 + 1.3) * 0.08 * sway

  // v12-E6: Sponsoren-Karussell — nahe der Sponsoren-Station fährt die Kamera
  // seitlich an der Bande entlang auf die fokussierte Tafel (Pfeile im DOM).
  // Der Fokus-x wird gedämpft → sanftes „von Bande zu Bande fahren".
  const wSp = smoothstep(0.11, 0.03, Math.abs(uNow - SP_U)) // 1 an der Station, 0 weg
  if (wSp > 0.001) {
    const targetBx = sponsorBoardX(useStore.getState().sponsorFocus)
    r.smoothedSponsorX = THREE.MathUtils.damp(r.smoothedSponsorX, targetBx, 3.5, delta)
    const bx = r.smoothedSponsorX
    r.pos.x = THREE.MathUtils.lerp(r.pos.x, bx + 0.1, wSp)
    r.look.x = THREE.MathUtils.lerp(r.look.x, bx, wSp)
  }

  camera.position.copy(r.pos)
  // zeitbasiert (nicht pro Frame): konvergiert auch bei niedriger FPS
  dampLook(r, 7.5, delta)
  camera.lookAt(r.currentLook)
}

// ── Karten-Modus ────────────────────────────────────────────
/** Neues Ziel: Startpose festhalten, Weltparameter-Rampen setzen. */
function beginFlight(r: Rig, prev: Key | '', next: Key) {
  r.fromPos.copy(r.camera.position)
  r.fromLook.copy(r.currentLook)
  r.fromFov = r.camera.fov
  r.t = 0
  r.dur = FLIGHT_S
  r.ovFrom = mapWorld.overview
  r.ovTo = next === 'overview' ? 1 : 0
  r.teamFrom = teamState.w
  const nextSpec = next !== 'overview' && next !== 'tour' && next !== 'intro' ? PLACE_SPECS[next] : null
  const prevSpec = prev && prev !== 'overview' && prev !== 'tour' && prev !== 'intro' ? PLACE_SPECS[prev] : null
  r.teamTo = nextSpec?.team ? 1 : 0
  if (nextSpec) {
    r.uA = nextSpec.uFrom ?? nextSpec.u
    r.uB = nextSpec.u
    r.uEnd = nextSpec.u
  } else if (prevSpec?.uFrom != null) {
    // zurück: z. B. Karten tauchen in den Rasen, Wald wächst wieder
    r.uA = prevSpec.u
    r.uB = prevSpec.uFrom
    r.uEnd = U_OVERVIEW
  } else {
    r.uA = r.uB = r.uEnd = U_OVERVIEW
  }
  r.phase = nextSpec?.party ? 'fly' : 'none'
  r.ride = 0
}

function leaveParty(r: Rig) {
  r.pp = 0
  r.phase = 'none'
  useStore.getState().setPartyProgress(0)
}

/** Bildausschnitt + Brennweite: der freie Bereich (rect) ist das
 *  Kamerabild, der Rest (hinter dem Panel) läuft außerhalb weiter. */
function applyLens(r: Rig, W: number, H: number, ra: number, fov: number) {
  const camera = r.camera
  let dirty = false
  if (Math.abs(camera.aspect - ra) > 1e-4) {
    camera.aspect = ra
    dirty = true
  }
  if (Math.abs(camera.fov - fov) > 1e-4) {
    camera.fov = fov
    dirty = true
  }
  const v = camera.view
  const ox = -r.rect.x
  const oy = -r.rect.y
  if (
    dirty ||
    !v ||
    !v.enabled ||
    Math.abs(v.fullWidth - r.rect.w) > 0.01 ||
    Math.abs(v.fullHeight - r.rect.h) > 0.01 ||
    Math.abs(v.offsetX - ox) > 0.01 ||
    Math.abs(v.offsetY - oy) > 0.01 ||
    v.width !== W ||
    v.height !== H
  ) {
    camera.setViewOffset(r.rect.w, r.rect.h, ox, oy, W, H) // ruft updateProjectionMatrix
  }
}

function mapFrame(r: Rig, state: FrameState, delta: number, key: Key) {
  const camera = r.camera
  const W = state.size.width
  const H = state.size.height
  const t = state.clock.elapsedTime
  const cls = mapClass(W / H)

  // Sichtbarer Bereich neben/über dem Panel → Kamerabild (gedämpft)
  const want = mapPanelRect(W, H, key !== 'overview')
  const k = 1 - Math.exp(-6 * delta)
  r.rect.x += (want.x - r.rect.x) * k
  r.rect.y += (want.y - r.rect.y) * k
  r.rect.w += (want.w - r.rect.w) * k
  r.rect.h += (want.h - r.rect.h) * k
  const ra = r.rect.w / r.rect.h

  // Schnitt raus aus dem Partyraum (warmer Schleier, dann Flug)
  if (r.cut >= 0) {
    r.cut += delta / CUT_S
    mapWorld.veil = Math.min(1, r.cut)
    if (r.cut < 1) {
      applyLens(r, W, H, ra, camera.fov)
      return // Kamera bleibt im Raum, bis der Schleier deckt
    }
    r.cut = -1
    leaveParty(r)
    setNearFor(r, 0)
    samplePartyApproach(0, r.pos, r.look)
    camera.position.copy(r.pos)
    r.currentLook.copy(r.look)
    camera.lookAt(r.currentLook)
    beginFlight(r, 'musik', key)
  } else if (mapWorld.veil > 0) {
    mapWorld.veil = Math.max(0, mapWorld.veil - delta / 0.5)
  }

  // Ziel-Pose
  const shot = r.shot
  if (key === 'overview') {
    const o = OVERVIEW[cls]
    shot.pos.copy(o.pos)
    shot.look.copy(o.look)
    shot.fov = coverFov(cls, ra)
  } else if (key !== 'tour' && key !== 'intro') {
    placeShot(key, ra, cls, shot)
    if (PLACE_SPECS[key].sponsor) {
      const targetBx = sponsorBoardX(useStore.getState().sponsorFocus)
      r.smoothedSponsorX = THREE.MathUtils.damp(r.smoothedSponsorX, targetBx, 3.5, delta)
      shot.pos.x = r.smoothedSponsorX + 0.1
      shot.look.x = r.smoothedSponsorX
    }
  }

  // Flug-Fortschritt
  if (r.t < 1) r.t = Math.min(1, r.t + delta / r.dur)
  const e = easeInOut(r.t)

  // Weltparameter (Flutlicht, Karten, Fans, Karte/Wald)
  cameraState.u = r.t < 1 ? THREE.MathUtils.lerp(r.uA, r.uB, e) : r.uEnd
  teamState.s = 1
  teamState.w = THREE.MathUtils.lerp(r.teamFrom, r.teamTo, e)
  const ov = THREE.MathUtils.lerp(r.ovFrom, r.ovTo, e)
  mapWorld.overview = ov
  mapWorld.tilt = ov
  mapWorld.fansIdle = ov

  // Partyraum: nach dem Anflug an die Tür die Durchfahrt
  if (r.phase === 'fly' && r.t >= 1) {
    r.phase = 'ride'
    r.ride = 0
  }
  if (r.phase === 'ride') {
    r.ride = Math.min(1, r.ride + delta / RIDE_S)
    // ruhig rein, im Raum sanft ankommen
    r.pp = r.ride * r.ride * (3 - 2 * r.ride)
    useStore.getState().setPartyProgress(r.pp)
    setNearFor(r, r.pp)
    if (r.pp < PARTY_HOP) samplePartyApproach(r.pp, r.pos, r.look)
    else partyInsidePose(r.pp, ra, t, r.pos, r.look)
    camera.position.copy(r.pos)
    dampLook(r, 9, delta)
    if (r.currentLook.distanceToSquared(r.look) > 100) r.currentLook.copy(r.look)
    camera.lookAt(r.currentLook)
    applyLens(r, W, H, ra, 46)
    return
  }
  setNearFor(r, 0)

  // Flug: Startpose → Ziel, mit leichtem Bogen nach oben
  r.pos.lerpVectors(r.fromPos, shot.pos, e)
  r.look.lerpVectors(r.fromLook, shot.look, e)
  if (r.t < 1) {
    const dist = r.fromPos.distanceTo(shot.pos)
    r.pos.y += Math.sin(Math.PI * e) * Math.min(1.6, dist * 0.08)
  }
  // ruhiges Atmen in der Totale (Marker folgen der Projektion)
  if (!mapWorld.still) {
    r.pos.x += Math.sin(t * 0.13) * 0.1 * ov
    r.pos.y += Math.sin(t * 0.17 + 1.1) * 0.06 * ov
  }
  camera.position.copy(r.pos)
  r.currentLook.copy(r.look)
  camera.lookAt(r.currentLook)
  applyLens(r, W, H, ra, THREE.MathUtils.lerp(r.fromFov, shot.fov, e))
}

// ── v17-D: Intro-Fahrt (erster Besuch) ──────────────────────
// Wartet im Hero-Bild (Flutlicht noch aus), bis die Live-3D steht; dann
// über den Anstoß-Dive (Flutlicht geht an) über den Platz und weich hinauf
// in die Karten-Totale (Poster-deckungsgleich → Marker landen exakt).
function introFrame(r: Rig, state: FrameState, delta: number, play: boolean) {
  const camera = r.camera
  const W = state.size.width
  const H = state.size.height
  const aspect = W / H
  r.rect.x = 0
  r.rect.y = 0
  r.rect.w = W
  r.rect.h = H
  if (play) r.introT = Math.min(INTRO_S, r.introT + delta)
  const t = r.introT
  teamState.s = 0
  teamState.w = 0
  const g = easeInOut(Math.min(1, t / INTRO_A)) * INTRO_G
  sampleFlightG(g, r.pos, r.look)
  // Portrait wie im Rundgang: vom Blickpunkt zurückziehen
  if (aspect < 1) {
    const k = Math.min(1.75, 1 + (1 - aspect) * 1.1)
    r.pos.sub(r.look).multiplyScalar(k).add(r.look)
    r.pos.y += (1 - aspect) * 0.5
  }
  let fov = 46
  let u = gToU(g)
  const b = easeInOut(THREE.MathUtils.clamp((t - INTRO_A) / (INTRO_S - INTRO_A), 0, 1))
  if (b > 0) {
    const cls = mapClass(aspect)
    const o = OVERVIEW[cls]
    r.pos.lerp(o.pos, b)
    r.look.lerp(o.look, b)
    fov = THREE.MathUtils.lerp(46, coverFov(cls, aspect), b)
    u = THREE.MathUtils.lerp(u, U_OVERVIEW, b)
  }
  cameraState.u = u
  mapWorld.overview = b
  mapWorld.tilt = b
  mapWorld.fansIdle = b
  setNearFor(r, 0)
  camera.position.copy(r.pos)
  r.currentLook.copy(r.look)
  camera.lookAt(r.currentLook)
  applyLens(r, W, H, aspect, fov)
  if (play && t >= INTRO_S) {
    // gelandet: ab jetzt ist das die Totale (kein zweiter Flug)
    r.key = 'overview'
    r.t = 1
    r.ovFrom = r.ovTo = 1
    endIntro()
  }
}

function rigFrame(r: Rig, state: FrameState, delta: number) {
  const camera = r.camera
  const st = useStore.getState()
  const W = state.size.width
  const H = state.size.height
  // Deep-Link: erst in der (Poster-gleichen) Totale stehen, bis die Live-
  // Karte übernommen hat — dann fliegt die Kamera zum Ort.
  const key: Key =
    st.mode === 'tour' ? 'tour' : st.intro !== 'off' ? 'intro' : st.place && st.stageLive ? st.place : 'overview'

  // Erster Frame: in der Totale (Poster-deckungsgleich) bzw. im
  // Rundgang direkt starten.
  if (r.key === '') {
    r.rect = { x: 0, y: 0, w: W, h: H }
    if (key === 'tour') {
      r.key = 'tour'
      r.t = 1
    } else if (key === 'intro') {
      r.key = 'intro'
      r.t = 1
      r.introT = 0
    } else {
      const o = OVERVIEW[mapClass(W / H)]
      camera.position.copy(o.pos)
      r.currentLook.copy(o.look)
      camera.lookAt(o.look)
      r.key = 'overview'
      r.t = 1
      r.ovFrom = r.ovTo = 1
    }
  }

  if (key !== r.key) {
    const prev = r.key
    if (prev === 'tour') r.rect = { x: 0, y: 0, w: W, h: H }
    // Raus aus dem Partyraum: drinnen → Schleier-Schnitt, sonst sofort
    if (prev === 'musik' && r.pp > 0) {
      if (r.pp >= PARTY_HOP && key !== 'tour') r.cut = 0
      else leaveParty(r)
    }
    if (key === 'tour') {
      r.cut = -1
      if (r.pp > 0) leaveParty(r)
    }
    if (r.cut < 0) {
      beginFlight(r, prev, key)
      // aus der Pocket-Welt nie quer durch den Boden blenden → Schnitt
      if (camera.position.y < -10) r.t = 1
    }
    r.key = key
  }

  if (key === 'intro') {
    introFrame(r, state, delta, st.intro === 'play')
    return
  }
  if (key !== 'tour') {
    mapFrame(r, state, delta, key)
    return
  }

  // Linsenwerte des Rundgangs zurückholen (volles Bild, 46°)
  if (Math.abs(camera.aspect - W / H) > 1e-4) {
    camera.aspect = W / H
    camera.updateProjectionMatrix()
  }
  tourFrame(r, state, delta)
  mapWorld.overview = 0
  mapWorld.tilt = 0
  mapWorld.fansIdle = 0
  if (mapWorld.veil > 0) mapWorld.veil = Math.max(0, mapWorld.veil - delta / 0.5)
  // Übergabe Karte → Rundgang: weich aus der Kartenpose einblenden
  let fov = 46
  if (r.t < 1) {
    r.t = Math.min(1, r.t + delta / FLIGHT_S)
    const e = easeInOut(r.t)
    r.pos.copy(camera.position)
    camera.position.lerpVectors(r.fromPos, r.pos, e)
    r.look.lerpVectors(r.fromLook, r.currentLook, e)
    camera.lookAt(r.look)
    fov = THREE.MathUtils.lerp(r.fromFov, 46, e)
  }
  if (Math.abs(camera.fov - fov) > 1e-4) {
    camera.fov = fov
    camera.updateProjectionMatrix()
  }
}

export function CameraRig() {
  const rig = useRef<Rig | null>(null)

  useFrame((state, delta) => {
    const camera = state.camera as THREE.PerspectiveCamera
    if (devCam) {
      camera.position.set(devCam[0], devCam[1], devCam[2])
      camera.lookAt(devCam[3], devCam[4], devCam[5])
      cameraState.u = 1 // Flutlicht voll an für Vergleichsbilder
      return
    }
    if (!rig.current) rig.current = createRig(camera)
    rig.current.camera = camera
    rigFrame(rig.current, state, delta)
  })

  return null
}
