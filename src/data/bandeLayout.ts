// ─────────────────────────────────────────────────────────────
// v18-P: Aufteilung der Süd-Bande (3D) — gemeinsam für Barrier (Tafeln),
// CameraRig (Fahrt von Tafel zu Tafel) und die Banden-Navigation im DOM.
//
//   Lesereihenfolge vom Platz aus (links → rechts):
//   [Verein] [Slot 0] [Slot 1] … [Slot N-1] [Werde Partner]
//
// Slots = Sponsoren mit „Auf der Bande" + immer mindestens EINE freie Tafel
// (mind. 4). Die erste freie Tafel trägt den Entwurf aus dem Konfigurator.
// Ohne three/React.
// ─────────────────────────────────────────────────────────────
import { BANDEN_SPONSOREN, SPONSOR_PLACEHOLDER_SLOTS, type Sponsor } from './content'

export const BANDE_SPONSOREN: Sponsor[] = BANDEN_SPONSOREN
export const BANDE_SLOTS = Math.max(SPONSOR_PLACEHOLDER_SLOTS, BANDEN_SPONSOREN.length + 1)
/** Tafeln insgesamt: Verein + Slots + CTA */
export const BANDE_PANELE = BANDE_SLOTS + 2
/** erste freie Tafel (Slot-Index in Lesereihenfolge) — hier landet der Entwurf */
export const FREIER_SLOT = BANDEN_SPONSOREN.length

// Die Kamera zählt ihren Fokus historisch von der anderen Seite (Welt-x):
// Fokus 0 = rechte Slot-Tafel. Diese beiden Helfer übersetzen.
export function slotZuFokus(slot: number): number {
  return BANDE_SLOTS - 1 - slot
}
export function fokusZuSlot(fokus: number): number {
  return BANDE_SLOTS - 1 - fokus
}
