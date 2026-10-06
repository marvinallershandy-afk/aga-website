// ─────────────────────────────────────────────────────────────
// v14-D → v20-K: Der Karten-Renderer ist ins gemeinsame Kartensystem
// umgezogen (src/karten/zeichnen.ts, <SvaKarte/>). Hier bleiben nur die
// geteilten Helfer der Story-Grafiken (Schriften, Bild-Laden, Format).
// ─────────────────────────────────────────────────────────────
import { KARTE_RATIO } from '../karten/geometrie'
import { ladeBild, ladeSchriften } from '../karten/medien'
import { F_DISPLAY, F_TEXT } from '../karten/zeichnen'

/** Höhe des Kartenkörpers relativ zur Breite (100 : 140). */
export const CARD_RATIO = KARTE_RATIO
export const FONT_DISPLAY = F_DISPLAY
export const FONT_BODY = F_TEXT
export const loadImage = ladeBild
export const ensureCardFonts = ladeSchriften
