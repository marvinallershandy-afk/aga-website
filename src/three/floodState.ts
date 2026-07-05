// Zentraler Flutlicht-Zustand: ein Level 0..1 pro Mast.
// Bewusst KEIN React-State — wird pro Frame gelesen/geschrieben
// (Etappe 3: der Anstoß-Director schreibt, die Masten lesen).
export const floodLevels = [1, 1, 1, 1]

/** Aufglüh-Surge 0..1 je Mast (Lampen-Blitz im Flacker-Fenster). */
export const floodSurges = [0, 0, 0, 0]

export function setFloodLevels(a: number, b: number, c: number, d: number) {
  floodLevels[0] = a
  floodLevels[1] = b
  floodLevels[2] = c
  floodLevels[3] = d
}

export function setFloodSurges(a: number, b: number, c: number, d: number) {
  floodSurges[0] = a
  floodSurges[1] = b
  floodSurges[2] = c
  floodSurges[3] = d
}
