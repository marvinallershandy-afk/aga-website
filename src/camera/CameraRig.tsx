import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useStore } from '../store/useStore'
import { cameraState } from './CameraPath'
import { tourCam } from './rigState'
import { scrollToStop } from './anchors'
import { teamState, teamFocus } from './teamLayout'
import { TEAM_FIRST, TEAM_TOTALE, TEAM_N, TEAM_ORDER, STOP_INDEX } from './tourPlan'
import { sampleRoute, routeDAtStop, createRouteSample, smoothDamp, setRouteStart, keepInClearing, type RouteSample } from './tourRoute'
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
import { mapPanelRect } from '../map/layout'
import type { PlaceId } from '../map/places'

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

// v12-E6: Geometrie der Süd-Bande (muss zu Barrier.tsx passen). 6 Tafeln:
// [Verein, Slot0..3, CTA]. Das Karussell fokussiert die 4 Slot-Tafeln.
const SP_BOARD_W = PITCH.width * 0.86
const SP_PANELS = 6
// v18-R: Mannschafts-Präsenz in Halt-Einheiten s: 1 über die Spieler-Halte
// bis zur Totale, außerhalb weich aus.
function teamPresence(s: number): number {
  if (s >= TEAM_FIRST && s <= TEAM_TOTALE) return 1
  const d = s < TEAM_FIRST ? TEAM_FIRST - s : s - TEAM_TOTALE
  return 1 - smoothstep(0.08, 0.6, d)
}
// Landscape: Die linke Bildseite gehört der Sticky-Textspalte. Statt die
// Kamera quer zu versetzen, verschiebt eine View-Offset-Projektion das Bild
// nach rechts — die Komposition der Halte bleibt erhalten, der Fokus-
// punkt rückt nur aus der Bildmitte in die rechte Bühnenhälfte.
const TEAM_VIEW_SHIFT = 0.17 // Anteil der Bildbreite
// v18-R Fahrt-Feder (Routen-Kosten ≈ Weltmeter): Glättzeit, Grundtempo,
// längste Fahrt bei großen Sprüngen (Tempo wächst mit der Restdistanz).
const TOUR_SMOOTH = 0.34
const TOUR_V0 = 5.2
const TOUR_MAX_S = 1.5
const SPONSOR_STOP = STOP_INDEX.sponsoren
const MAX_BACK = 2.4 // max. Hochformat-Rückzug in Weltmetern
const PHONE_TEAM_FOV = 56
const _off = new THREE.Vector3()
function sponsorBoardX(focus: number): number {
  const panelW = SP_BOARD_W / SP_PANELS
  const boardIndex = 1 + THREE.MathUtils.clamp(focus, 0, 3) // Slot-Tafeln = Board 1..4
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
const RIDE_OUT_S = 2.2 // v18-R: Rückweg Raum → vor die Tür (statt Schleier-Schnitt)
type Key = 'tour' | 'overview' | PlaceId
// v18-R: Übergabe Karten-Totale → Rundgang. Die Route beginnt in exakt
// dieser Pose → nur ein kurzes Angleichen (Atmen/Rundung), kein Flug.
const HANDOFF_S = 0.3

interface FrameState {
  size: { width: number; height: number }
  clock: THREE.Clock
}

/** Der gesamte Laufzeitzustand der Kamera (kein React-State). */
interface Rig {
  camera: THREE.PerspectiveCamera
  // Rundgang (v18-R): Fahrt auf der Kosten-Achse D der Route, Feder-Tempo
  d: number
  dVel: { v: number }
  /** Zielwert D beim letzten Frame (für Sprung-Erkennung) */
  dInit: boolean
  sample: RouteSample
  smoothedSponsorX: number
  pos: THREE.Vector3
  look: THREE.Vector3
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
  /** Rückweg aus dem Partyraum: 0..1 Fortschritt, −1 = keiner. */
  cut: number
  /** Party-Fortschritt beim Start des Rückwegs. */
  cutFrom: number
  rect: { x: number; y: number; w: number; h: number }
  shot: Shot
  /** Dauer der laufenden Übergabe Karte → Rundgang (s). */
  handoff: number
  /** fov des Rundgangs in diesem Frame (Karten-Tele → 46°). */
  tourFov: number
}

function createRig(camera: THREE.PerspectiveCamera): Rig {
  return {
    camera,
    d: 0,
    dVel: { v: 0 },
    dInit: false,
    sample: createRouteSample(),
    smoothedSponsorX: sponsorBoardX(0),
    pos: new THREE.Vector3(),
    look: new THREE.Vector3(),
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
    cutFrom: 0,
    rect: { x: 0, y: 0, w: 1, h: 1 },
    shot: { pos: new THREE.Vector3(), look: new THREE.Vector3(), fov: 46 },
    handoff: FLIGHT_S,
    tourFov: 46,
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

// ── Scroll-Rundgang (v18-R) ─────────────────────────────────
// Ziel = Scroll-Position → Halt-Parameter → Routen-Kosten D. Die Kamera
// folgt D mit einer kritisch gedämpften Feder (stetige Geschwindigkeit,
// weiches An- und Abfahren) und einem Tempo-Deckel, der mit der Rest-
// strecke wächst: kurze Etappen in ~1 s, weite Sprünge höchstens ~TOUR_MAX_S.
// Nutzer bleibt Herr über die Richtung (kein Scroll-Hijacking, keine Sperre).
function tourFrame(r: Rig, state: FrameState, delta: number) {
  const camera = r.camera
  const st = useStore.getState()
  // Start der Route = Karten-Totale dieser Bildklasse (wie Poster/Karte)
  {
    const a0 = state.size.width / state.size.height
    const cls = mapClass(a0)
    setRouteStart(OVERVIEW[cls].pos, OVERVIEW[cls].look, coverFov(cls, a0), cls === 'tall')
  }
  const target = routeDAtStop(scrollToStop(st.scrollProgress))
  if (!r.dInit) {
    r.d = target
    r.dVel.v = 0
    r.dInit = true
  }
  const rem = Math.abs(target - r.d)
  const maxSpeed = Math.max(TOUR_V0, rem / TOUR_MAX_S)
  r.d = smoothDamp(r.d, target, r.dVel, TOUR_SMOOTH, maxSpeed, Math.min(delta, 0.1))
  const sm = sampleRoute(r.d, r.sample)
  const sNow = sm.s
  tourCam.s = sNow
  cameraState.u = sm.u // für Flutlicht/Ball/Staub/Karten/Fans
  r.tourFov = sm.fov
  // Karten-Look (Tilt-Shift, ruhige Fans) blendet auf der ersten Etappe aus
  mapWorld.overview = sm.karte
  mapWorld.tilt = sm.karte
  mapWorld.fansIdle = sm.karte
  // Mannschaft: Fortschritt über Spieler-Halte + Totale, Präsenz, Fokus
  teamState.s = THREE.MathUtils.clamp((sNow - TEAM_FIRST) / (TEAM_TOTALE - TEAM_FIRST), 0, 1)
  teamState.w = teamPresence(sNow)
  const fk = sNow - TEAM_FIRST
  if (fk > -0.6 && fk < TEAM_N - 0.4) {
    teamFocus.k = THREE.MathUtils.clamp(fk, 0, TEAM_N - 1)
    teamFocus.card = TEAM_ORDER[Math.round(teamFocus.k)]
    teamFocus.w = 1 - smoothstep(0.15, 0.6, fk < 0 ? -fk : fk > TEAM_N - 1 ? fk - (TEAM_N - 1) : 0)
  } else {
    teamFocus.k = -1
    teamFocus.card = -1
    teamFocus.w = 0
  }

  const aspect = state.size.width / state.size.height

  // Partyraum (v18-R): eigene Etappen der Route — vor der Tür halten, rein,
  // im Raum verweilen, auf demselben Weg zurück vor die Tür.
  const pp = sm.party
  if (Math.abs(st.partyProgress - pp) > 1e-4 || (pp === 0 && st.partyProgress !== 0)) st.setPartyProgress(pp)
  setNearFor(r, pp)
  if (pp > 0.0005) {
    if (camera.view && camera.view.enabled) camera.clearViewOffset()
    if (pp < PARTY_HOP) samplePartyApproach(pp, r.pos, r.look)
    else partyInsidePose(pp, aspect, state.clock.elapsedTime, r.pos, r.look)
    // Portrait: wie draußen vom Blickpunkt zurück (nur außen, weich zur Tür hin aus)
    if (aspect < 1 && pp < PARTY_HOP) {
      const k = 1 + (1 - aspect) * 0.6 * (1 - smoothstep(0, PARTY_HOP * 0.7, pp))
      r.pos.sub(r.look).multiplyScalar(k).add(r.look)
    }
    camera.position.copy(r.pos)
    dampLook(r, 14, delta)
    // Beim Hop springt auch der Blick hart mit (kein Nachziehen quer
    // durch die Welten): Distanz-Heuristik erkennt den Teleport.
    if (r.currentLook.distanceToSquared(r.look) > 100) r.currentLook.copy(r.look)
    camera.lookAt(r.currentLook)
    return
  }

  r.pos.copy(sm.pos)
  r.look.copy(sm.look)
  const wMann = teamState.w
  // In der Karten-Totale keine Hochformat-/Sway-Korrektur (Pose = Karte)
  const free = 1 - sm.karte

  // Portrait-Anpassung: die Halte sind für 16:9 komponiert — auf schmalen
  // Viewports zieht die Kamera vom Blickpunkt zurück (Komposition bleibt).
  // v18-R: Rückzug absolut gedeckelt (MAX_BACK) — auf langen Blickweiten
  // (Etappen-Mitte) schob der Faktor die Kamera sonst in den Wald.
  // Vor der Tür (Partyraum-Etappen) gleich wie im Party-Anflug (stetig).
  // Handy + Spieler: zusätzlich weiteres fov (horizontaler Bildwinkel),
  // statt die Kamera durch die Reihe dahinter zurückzuziehen.
  const phone = aspect < 0.8 && state.size.width <= 640
  if (aspect < 1) {
    const kFull = Math.min(1.75, 1 + (1 - aspect) * 1.1)
    const kTeam = 1 + (1 - aspect) * (phone ? 1.25 : 1.05)
    const door = 1 - smoothstep(0.0, 0.5, Math.min(Math.abs(sNow - STOP_INDEX['musik-tuer']), Math.abs(sNow - STOP_INDEX['musik-raus'])))
    let k = THREE.MathUtils.lerp(kFull, kTeam, wMann)
    k = THREE.MathUtils.lerp(k, 1 + (1 - aspect) * 0.6, door)
    k = THREE.MathUtils.lerp(1, k, free)
    _off.copy(r.pos).sub(r.look)
    const len = _off.length()
    const back = Math.min((k - 1) * len, MAX_BACK)
    if (len > 1e-4) r.pos.addScaledVector(_off, back / len)
    r.pos.y += (1 - aspect) * 0.5 * (1 - wMann * 0.7) * (1 - door) * free
    keepInClearing(r.pos) // Rückzug nie in den Waldrand
    if (phone) r.tourFov = THREE.MathUtils.lerp(r.tourFov, PHONE_TEAM_FOV, wMann)
  }

  // Bildverschiebung für die Textspalte (nur Landscape, weich ein/aus).
  // Hochformat: Text oben, Spielername unten → Karte ins freie Mittelfeld.
  const wantShift = aspect >= 1 ? TEAM_VIEW_SHIFT * wMann : 0
  const wantShiftY = aspect < 1 ? (phone ? -0.06 : 0.13) * wMann : 0
  if (Math.abs(wantShift) + Math.abs(wantShiftY) > 0.0005) {
    const w = state.size.width
    const h = state.size.height
    camera.setViewOffset(w, h, -wantShift * w, -wantShiftY * h, w, h)
  } else if (camera.view && camera.view.enabled) {
    camera.clearViewOffset()
  }

  // dezenter Idle-Sway — oben mehr, an den Karten und unten ruhig
  const t = state.clock.elapsedTime
  const sway = (1 - sm.u * 0.6) * (1 - 0.9 * wMann) * free
  r.pos.x += Math.sin(t * 0.18) * 0.14 * sway
  r.pos.y += Math.sin(t * 0.23 + 1.3) * 0.08 * sway
  // …und dort genau das Atmen der Karten-Totale (nahtlose Übergabe)
  if (!mapWorld.still) {
    r.pos.x += Math.sin(t * 0.13) * 0.1 * sm.karte
    r.pos.y += Math.sin(t * 0.17 + 1.1) * 0.06 * sm.karte
  }

  // v12-E6: Sponsoren-Karussell — am Banden-Halt fährt die Kamera seitlich
  // an der Bande entlang auf die fokussierte Tafel (Pfeile im DOM).
  const wSp = 1 - smoothstep(0.06, 0.5, Math.abs(sNow - SPONSOR_STOP))
  if (wSp > 0.001) {
    const targetBx = sponsorBoardX(st.sponsorFocus)
    r.smoothedSponsorX = THREE.MathUtils.damp(r.smoothedSponsorX, targetBx, 3.5, delta)
    const bx = r.smoothedSponsorX
    r.pos.x += (bx + 0.1 - r.pos.x) * wSp
    r.look.x += (bx - r.look.x) * wSp
  }

  camera.position.copy(r.pos)
  // Blick ist bereits weich (Slerp auf gedämpfter Fahrt) — nur leichtes
  // Nachziehen gegen Sway-/Karussell-Zittern; Teleport (Party-Hop) hart.
  dampLook(r, 12, delta)
  if (r.currentLook.distanceToSquared(r.look) > 100) r.currentLook.copy(r.look)
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
  const nextSpec = next !== 'overview' && next !== 'tour' ? PLACE_SPECS[next] : null
  const prevSpec = prev && prev !== 'overview' && prev !== 'tour' ? PLACE_SPECS[prev] : null
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

  // v18-R: raus aus dem Partyraum = derselbe Weg rückwärts (Raum → Flur →
  // Tür, der warme Schleier deckt nur den Hop), Halt vor der Tür, DANN Flug.
  // Vorher: harter Schleier-Schnitt aus dem Raum direkt in den Flug.
  if (r.cut >= 0) {
    r.cut = Math.min(1, r.cut + delta / RIDE_OUT_S)
    const e = r.cut * r.cut * (3 - 2 * r.cut)
    r.pp = r.cutFrom * (1 - e)
    useStore.getState().setPartyProgress(r.pp)
    setNearFor(r, r.pp)
    if (r.cut < 1 && r.pp > 0.0005) {
      if (r.pp < PARTY_HOP) samplePartyApproach(r.pp, r.pos, r.look)
      else partyInsidePose(r.pp, ra, t, r.pos, r.look)
      camera.position.copy(r.pos)
      dampLook(r, 14, delta)
      if (r.currentLook.distanceToSquared(r.look) > 100) r.currentLook.copy(r.look)
      camera.lookAt(r.currentLook)
      applyLens(r, W, H, ra, 46)
      return
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
  } else if (key !== 'tour') {
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

function rigFrame(r: Rig, state: FrameState, delta: number) {
  const camera = r.camera
  const st = useStore.getState()
  const W = state.size.width
  const H = state.size.height
  // Deep-Link: erst in der (Poster-gleichen) Totale stehen, bis die Live-
  // Karte übernommen hat — dann fliegt die Kamera zum Ort.
  const key: Key =
    st.mode === 'tour' ? 'tour' : st.place && st.stageLive ? st.place : 'overview'

  // Erster Frame: in der Totale (Poster-deckungsgleich) bzw. im
  // Rundgang direkt starten.
  if (r.key === '') {
    r.rect = { x: 0, y: 0, w: W, h: H }
    if (key === 'tour') {
      r.key = 'tour'
      r.t = 1
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
    // Raus aus dem Partyraum: Rückweg vor die Tür, dann Flug (Rundgang: sofort)
    if (prev === 'musik' && r.pp > 0) {
      if (key !== 'tour') {
        r.cut = 0
        r.cutFrom = r.pp
      } else leaveParty(r)
    }
    if (key === 'tour') {
      r.cut = -1
      if (r.pp > 0) leaveParty(r)
      r.dInit = false // Rundgang setzt an der aktuellen Scroll-Position an
      r.handoff = prev === 'overview' ? HANDOFF_S : FLIGHT_S
    }
    if (key !== 'tour') {
      teamFocus.k = -1
      teamFocus.card = -1
      teamFocus.w = 0
    }
    if (r.cut < 0) {
      beginFlight(r, prev, key)
      // aus der Pocket-Welt nie quer durch den Boden blenden → Schnitt
      if (camera.position.y < -10) r.t = 1
    }
    r.key = key
  }

  if (key !== 'tour') {
    tourCam.s = -1
    mapFrame(r, state, delta, key)
    return
  }

  // Linsenwerte des Rundgangs zurückholen (volles Bild, 46°)
  if (Math.abs(camera.aspect - W / H) > 1e-4) {
    camera.aspect = W / H
    camera.updateProjectionMatrix()
  }
  tourFrame(r, state, delta)
  if (mapWorld.veil > 0) mapWorld.veil = Math.max(0, mapWorld.veil - delta / 0.5)
  // Übergabe Karte → Rundgang. v18-R: aus der Totale nur ein kurzes
  // Angleichen mit Ease-OUT (die Fahrt läuft vom ersten Frame an mit dem
  // Scroll mit — vorher 1,2 s Ease-in-out-Flug, gefühlt ein Stocken).
  // Aus einem offenen Ort (selten) weiter der normale Flug.
  let fov = r.tourFov
  if (r.t < 1) {
    r.t = Math.min(1, r.t + delta / r.handoff)
    const e = r.handoff < FLIGHT_S ? 1 - Math.pow(1 - r.t, 3) : easeInOut(r.t)
    r.pos.copy(camera.position)
    camera.position.lerpVectors(r.fromPos, r.pos, e)
    r.look.lerpVectors(r.fromLook, r.currentLook, e)
    camera.lookAt(r.look)
    fov = THREE.MathUtils.lerp(r.fromFov, r.tourFov, e)
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
