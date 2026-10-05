import * as THREE from 'three'
import { STATION_COUNT } from './CameraPath'
import { stopPose } from './tourRoute'
import type { StopId } from './tourPlan'
import { samplePartyApproach } from './partyPath'
import { PLACE_BY_ID, type PlaceId } from '../map/places'
import { MAP_POSTER } from '../map/posterData'

// ─────────────────────────────────────────────────────────────
// v16-K „Vereinsgelände-Karte": Kamera-Ziele der Karte.
//   · Totale (Diorama): hohe, schräge Tele-Kamera aufs ganze Gelände —
//     je Bildklasse (quer/hoch) EINE feste Pose, deckungsgleich mit dem
//     Poster-Standbild (public/map/poster-*.webp), damit die DOM-Marker
//     beim Überblenden Poster → Live-3D nicht springen.
//   · Orte: die Halte des Scroll-Rundgangs (tourRoute.stopPose),
//     plus der Weltparameter u, den Flutlicht/Karten/Fans lesen.
// ─────────────────────────────────────────────────────────────

export type MapClass = 'wide' | 'tall'
export function mapClass(aspect: number): MapClass {
  return aspect <= 1 ? 'tall' : 'wide'
}

export interface Shot {
  pos: THREE.Vector3
  look: THREE.Vector3
  fov: number
}

/** Kamera der Totale je Bildklasse (gleiche Zahlen wie das Poster). */
export const OVERVIEW: Record<MapClass, Shot> = {
  wide: {
    pos: new THREE.Vector3(...MAP_POSTER.wide.cam.pos),
    look: new THREE.Vector3(...MAP_POSTER.wide.cam.look),
    fov: MAP_POSTER.wide.cam.fov,
  },
  tall: {
    pos: new THREE.Vector3(...MAP_POSTER.tall.cam.pos),
    look: new THREE.Vector3(...MAP_POSTER.tall.cam.look),
    fov: MAP_POSTER.tall.cam.fov,
  },
}

const D2R = Math.PI / 180
/** Vertikales fov der Totale, das genau `object-fit: cover` des Posters
 *  nachbildet: schmaler als das Poster → gleiche Höhe (seitlich
 *  beschnitten); breiter → gleiche Breite (oben/unten beschnitten). */
export function coverFov(cls: MapClass, aspect: number): number {
  const fov = OVERVIEW[cls].fov
  const ap = MAP_POSTER[cls].aspect
  if (aspect <= ap) return fov
  const halfH = Math.tan((fov * D2R) / 2) * ap // tan(hfov/2)
  return (2 * Math.atan(halfH / aspect)) / D2R
}

/** Welt-Parameter u der Totale: Flutlicht voll an (nach dem Anstoß),
 *  noch keine Karten auf dem Rasen, Fan-Feuerwerk aus, Wald steht. */
export const U_OVERVIEW = 0.185

const ST = (i: number) => i / (STATION_COUNT - 1)

export interface PlaceSpec {
  /** Halt des Rundgangs (tourPlan.STOP_IDS) oder null = eigene Pose. */
  stop: StopId | null
  /** Eigene Pose (statt Station). */
  pose?: { pos: [number, number, number]; look: [number, number, number] }
  /** Weltparameter am Ort und beim Anflug (Rampe uFrom → u). */
  u: number
  uFrom?: number
  team?: boolean
  sponsor?: boolean
  party?: boolean
}

export const PLACE_SPECS: Record<PlaceId, PlaceSpec> = {
  // Anzeigetafel am Vereinsheim-Giebel (Tabelle-Station)
  spieltag: { stop: 'tabelle', u: ST(5), uFrom: 0.7 },
  // Wegweiser am Kartenrand: eigene Pose (Schwenk zum Schild)
  training: { stop: null, u: U_OVERVIEW },
  // Totale der Elf hinter dem eigenen Tor; Karten wachsen beim Anflug
  mannschaft: { stop: 'team-totale', u: ST(2), uFrom: 0.19, team: true },
  // Kurve: Fackeln/Rauch blenden beim Anflug ein
  fans: { stop: 'fanblock', u: ST(3), uFrom: 0.3 },
  // Partyraum: Anflug an die Tür, dann die bestehende Durchfahrt
  musik: { stop: 'musik-tuer', u: ST(4), uFrom: 0.565, party: true },
  // Banden-Zoom inkl. Karussell (sponsorFocus)
  partner: { stop: 'sponsoren', u: ST(6), uFrom: 0.8, sponsor: true },
  // Finale-Rauszoom: Karte mit Zufahrt, Ortslabel + „Hier sind wir"-Pin —
  // höher als die Finale-Station, damit Straße und Parkplatz ins Bild passen
  anfahrt: { stop: null, pose: { pos: [5.2, 30, 15.5], look: [4.4, 0, 1.6] }, u: 1, uFrom: 0.84 },
}

const _v = new THREE.Vector3()

/** Ziel-Pose eines Ortes für einen Bildausschnitt mit Seitenverhältnis
 *  `aspect` (sichtbarer Bereich neben/über dem Panel). */
export function placeShot(id: PlaceId, aspect: number, cls: MapClass, out: Shot) {
  const spec = PLACE_SPECS[id]
  out.fov = 46
  if (spec.party) {
    samplePartyApproach(0, out.pos, out.look)
  } else if (spec.pose) {
    out.pos.set(...spec.pose.pos)
    out.look.set(...spec.pose.look)
    out.fov = 40
  } else if (spec.stop != null) {
    stopPose(spec.stop, out.pos, out.look)
  } else {
    // Trainings-Wegweiser: aus der Totale ein Stück Richtung Schild
    // schwenken und leicht ranfahren — das Schild rückt in die Bildmitte.
    const a = PLACE_BY_ID.training.anchor
    const o = OVERVIEW[cls]
    out.look.set(a[0] * 0.55, 0, a[2] * 0.55)
    out.pos.copy(o.pos).sub(o.look).multiplyScalar(0.62).add(out.look)
    out.fov = o.fov
  }
  // Hochformat-Ausschnitt (selten: Panel offen + schmales Fenster):
  // vom Blickpunkt zurückziehen, wie die Scroll-Fahrt es tut.
  if (aspect < 1 && (spec.stop != null || spec.pose)) {
    const k = Math.min(1.75, 1 + (1 - aspect) * (spec.team ? 0.45 : 1.1))
    _v.copy(out.pos).sub(out.look).multiplyScalar(k)
    out.pos.copy(out.look).add(_v)
    out.pos.y += (1 - aspect) * 0.5
  }
}

export function easeInOut(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  return c < 0.5 ? 4 * c * c * c : 1 - Math.pow(-2 * c + 2, 3) / 2
}
