// ─────────────────────────────────────────────────────────────
// v16-K: geteilte Fahrt-Konstanten OHNE three-Import. Der DOM-Pfad
// (PartyDirector, Letterbox) liest sie — vorher zogen sie über
// CameraPath/partyPath three.js (≈100 kB gz) auf den kritischen Pfad der
// Startseite, noch bevor die Karte klickbar war.
// ─────────────────────────────────────────────────────────────

// Geteilter Fahrt-Zustand (pro Frame von CameraRig geschrieben,
// von Flutlicht/Ball/Staub gelesen — kein React-State).
export const cameraState = { u: 0 }

/** Kurven-Parameter der Anstoß-Station (Station 1 von 8 → 1/7). */
export const KICKOFF_U = 1 / 7

/** Partyraum-Durchfahrt: Fortschritt, bei dem die Türöffnung das Bild
 *  füllt → Welt-Hop (s. partyPath.ts). */
export const PARTY_HOP = 0.48

/** v18-R: Lage der Rundgang-Kamera in Halt-Einheiten (gedämpft), −1 = kein
 *  3D-Rundgang aktiv. Der DOM-Pfad blendet Stationstexte danach ein. */
export const tourCam = { s: -1 }
