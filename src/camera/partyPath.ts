import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// Die Partyraum-DURCHFAHRT (v5, Marvins Raumbeschreibung):
// Statt Dip-to-Black fliegt die Kamera kontinuierlich zur offen
// stehenden Tür des Vereinsheims (warmer Lichtschein), durch die
// Tür, einen kurzen Flur entlang, dann RECHTS in den quadratischen
// Raum — Endbild: Raum-Totale, Tresen hinten links.
// Der Innenraum bleibt die Pocket-Dimension bei y=−40; der Welt-
// Wechsel passiert exakt in dem Moment, in dem die glühende
// Türöffnung das Bild komplett füllt (versteckter Schnitt, Kino-
// Technik). Alles ist eine pure Funktion des Fortschritts p —
// rückwärts scrollen = denselben Weg zurück.
// ─────────────────────────────────────────────────────────────

/** Fortschritt, bei dem die Türöffnung das Bild füllt → Welt-Hop. */
export const PARTY_HOP = 0.48

/** Tür des Vereinsheim-Anbaus (Weltkoordinaten, s. Clubhouse.tsx).
 *  v9-E3 (Marvins Gebäudewissen, nach Referenzfotos): Der echte Eingang
 *  liegt deutlich weiter LINKS und HINTEN — an der Nordwest-Ecke des
 *  langen Terrassen-Anbaus („Dodos Raum", bei den Fahnenmasten). Der
 *  Ballfangzaun ist DURCHGEHEND (kein Loch): der Anflug führt NÖRDLICH
 *  um das Zaun-Ende herum („um die Ecke") zur Tür. */
export const DOOR = {
  x: 6.421, // Türebene (Anbau-Westseite, zum Platz)
  z: -2.5, // v11-E3: Gebäude ist länger & nach hinten gerückt → Tür weiter
           //  hinten (Welt z≈−2.5), synchron mit Clubhouse.tsx CLUBHOUSE_POS.z
  w: 0.16,
  h: 0.26,
  cy: 0.13, // Zentrum der Öffnung
} as const

// ─── Raum-Layout (Pocket-Dimension) ──────────────────────────
// Vom Flur aus gedacht: man kommt in +x-Richtung rein (wie durch
// die echte Gebäudetür), der Raum liegt rechts (Süden, +z).
// Quadratisch; Tresen hinten links = Ost-Wand, Süd-Hälfte.
export const ROOM_Y = -40
// v11-E4: Der Partyraum ist jetzt ein LANGER Saal (doppelte Länge). Breite
// (x, Ost-West) bleibt; die Länge (z, Nord-Süd) verdoppelt sich nach SÜDEN.
// Die Nordwand/Eingang (zNorth) + Flur bleiben unverändert → die Tür-Durchfahrt-
// Transition ist unberührt; der Saal wächst nur hinter dem Eingang weiter.
export const ROOM = {
  width: 3.2, // x (Ost-West): Wände bei ±1.6
  length: 6.4, // z (Nord-Süd): doppelt so lang (war 3.2)
  zNorth: -1.6, // Eingangswand (Flur liegt nördlich) — FIX
  zSouth: 4.8, // = zNorth + length
  zCenter: 1.6, // (zNorth + zSouth) / 2
  height: 1.6,
  // Flur nördlich des Raums, Kamera läuft +x
  hall: { z: -1.87, zMin: -2.14, zMax: -1.6, xMin: -2.3, xMax: -0.42, height: 0.95 },
  // Türöffnung Flur→Raum in der Nordwand (rechts vom Flur)
  opening: { x1: -1.12, x2: -0.5, height: 1.05 },
  // Innenseite der Gebäudetür (West-Ende des Flurs) — Glow-Quad
  innerDoorX: -2.28,
} as const

const HALF = ROOM.width / 2

// ─── Anflug außen (Weltkoordinaten) ──────────────────────────
// Startet in der MUSIK-Stationspose und senkt sich zur Tür.
// (Bewusste zweite Ausnahme von MIN_FLIGHT_Y — wie der Sturzflug
// ein komponierter Beat, dokumentiert in SVA_PLAN_V5.md.)
// v9-E3: Der Zaun ist wieder durchgehend (Ende bei z≈−1.75). Der Anflug
// bleibt daher WEST des Zauns (x<6.2) und zieht erst nach NORDEN, bis er
// nördlich am Zaun-Ende vorbei ist (z<−1.8), und dreht dann nach OSTEN in
// die Tür an der Ecke (z=−1.95). So schneidet er weder Tor (z=±0.37) noch
// Zaun — der Bogen liest sich als bewusstes „um die Ecke"-Manöver.
// v11-E3: Tür sitzt weiter hinten (z=−2.5) → der „um-die-Ecke"-Bogen zieht
// entsprechend weiter nach Norden, bevor er nach Osten in die Tür dreht.
// v14-E4: Die Kurve endet nicht mehr VOR der Türebene (x=6.42), sondern
// IM Windfang (x≈6.58) — die Kamera fliegt körperlich durch die Öffnung,
// der Türrahmen streift den Bildrand (Parallaxe verkauft den Durchtritt),
// und der Welt-Hop bei p=PARTY_HOP passiert erst, wenn echte Geometrie
// (Windfang-Wände + Glow-Rückwand) das Bild komplett rahmt.
const approachPos = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(4.6, 0.9, 1.5),
    new THREE.Vector3(5.25, 0.62, -0.7),
    new THREE.Vector3(5.8, 0.34, -2.55),
    new THREE.Vector3(6.3, DOOR.cy + 0.01, DOOR.z),
    new THREE.Vector3(6.58, DOOR.cy, DOOR.z),
  ],
  false,
  'centripetal',
  0.5,
)

// ─── Innen: Flur → Rechtskurve → Raum-Totale (Pocket-Koord.) ──
const insidePos = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-2.26, 0.55, ROOM.hall.z),
    new THREE.Vector3(-1.5, 0.55, ROOM.hall.z),
    new THREE.Vector3(-0.84, 0.55, -1.72),
    new THREE.Vector3(-0.85, 0.6, -1.2),
    // v11-E4: End-Totale etwas höher & weiter in den langen Saal gezogen,
    // damit die neue Länge nach Süden sichtbar wird (Flur→Turn unverändert).
    new THREE.Vector3(-1.02, 0.86, -0.55),
  ],
  false,
  'centripetal',
  0.5,
)

// Blickziele innen: erst den Flur entlang, dann rechts in den Raum
// schwenken (Poster blitzt mittig auf), dann zieht der Blick nach
// links zum Tresen — Endbild: Totale, Tresen rechts der DOM-Spalte,
// im RAUM aus Eingangssicht hinten links (Ost-Wand, Süd-Hälfte).
const insideLook = new THREE.CatmullRomCurve3(
  [
    new THREE.Vector3(-0.9, 0.5, ROOM.hall.z),
    new THREE.Vector3(-0.65, 0.48, -1.5),
    new THREE.Vector3(-0.35, 0.42, 0.3),
    new THREE.Vector3(0.6, 0.36, 0.9),
    // v11-E4: Endblick zeigt Tresen (Ost) UND die Länge nach Süden.
    new THREE.Vector3(0.9, 0.36, 1.5),
  ],
  false,
  'centripetal',
  0.5,
)

const _p = new THREE.Vector3()
const _l = new THREE.Vector3()
// Blick zieht bis auf die Glow-Rückwand des Windfangs (x≈6.72)
const DOOR_LOOK = new THREE.Vector3(DOOR.x + 0.3, DOOR.cy, DOOR.z)
const MUSIK_LOOK = new THREE.Vector3(7.1, 0.5, -0.35)

function smooth01(t: number): number {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}

/** Anflug außen: p∈[0,HOP). Schreibt Welt-Pose.
 *  Beschleunigendes Easing (k^2.2): lange in schöner Distanz zum
 *  Gebäude bleiben, erst auf den letzten Metern schnell zur Tür
 *  tauchen — die Fassaden-Nahaufnahme fällt exakt in das Fenster,
 *  das Tür-Glow und warmer Schleier ohnehin decken. */
export function samplePartyApproach(p: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  const k = THREE.MathUtils.clamp(p / PARTY_HOP, 0, 1)
  // v12-E4: Exponent 1.7 → 1.35 — weniger End-Rush direkt vor der Tür. Zusammen
  // mit dem breiteren Scroll-Fenster (PartyDirector) fließt der Anflug gleichmäßig
  // und ruhig statt am Ende schnell in die Tür zu tauchen.
  const t = Math.pow(k, 1.35)
  approachPos.getPoint(t, _p)
  outPos.copy(_p)
  // Blick: von der Stations-Blickrichtung weich auf die Türöffnung
  _l.copy(MUSIK_LOOK).lerp(DOOR_LOOK, smooth01(t / 0.55))
  outLook.copy(_l)
}

/** Durchfahrt innen: p∈[HOP,1]. Schreibt Pocket-Pose (y absolut). */
export function samplePartyInside(p: number, outPos: THREE.Vector3, outLook: THREE.Vector3) {
  // v12-E4: Die Raum-Totale ist schon bei p≈0.82 erreicht (statt erst bei 1.0) —
  // der letzte Scroll-Abschnitt der Musik-Sektion (bis zur Snap-Mitte) ist damit
  // ein ruhiges „angekommen im Raum" statt weiterer Bewegung. So landet der
  // Snap-Punkt zuverlässig TIEF im Saal (Tresen + Tracklist im Bild).
  const t = smooth01((p - PARTY_HOP) / (0.82 - PARTY_HOP))
  insidePos.getPoint(t, _p)
  insideLook.getPoint(t, _l)
  outPos.copy(_p)
  outPos.y += ROOM_Y
  outLook.copy(_l)
  outLook.y += ROOM_Y
}

/** Wie „gesettelt" die Raum-Totale ist (für Portrait-Pullback etc.). */
export function partySettle(p: number): number {
  return smooth01((p - 0.85) / 0.15)
}

export { HALF as ROOM_HALF }
