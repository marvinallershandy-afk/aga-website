// ─────────────────────────────────────────────────────────────
// v20-T: DÜNNER ADAPTER Tipp-Liga ↔ Kartensystem (ohne React, damit auch
// der Admin ihn für Story-Grafiken nutzen kann). Die Tipp-Liga fragt
// Spielerbilder/-karten NUR hier (bzw. in SpielerKarte.tsx) an.
// Heute: playerMedia (Greenscreen → Freisteller → Foto) + cardArt.
// Später: Umstieg auf das neue Sammelkarten-System (src/karten/*) —
// dann ändern sich nur diese Datei und SpielerKarte.tsx.
// Keine Bewertungen/Ratings (nur Name, Nummer, Position).
// ─────────────────────────────────────────────────────────────
import type { Player } from '../data/players'
import { playerMedia } from '../data/playerMedia'
import { hdCutout } from '../ui/hdCutout'
import { drawPlayerCard, loadCardAssets, CARD_RATIO } from '../ui/cardArt'
import type { KaderSpieler } from './api'

export { CARD_RATIO }

/** Kader-Eintrag → Player (Form, die HoloCard/cardArt erwarten). */
export function alsPlayer(k: KaderSpieler, kapitaen = false): Player {
  return {
    id: k.id,
    name: k.name,
    number: k.nummer ?? null,
    position: k.position,
    photoUrl: k.fotoUrl ?? null,
    cutoutUrl: k.cutoutUrl ?? null,
    stats: { games: k.spiele, goals: k.tore, assists: 0 },
    rating: 0,
    since: null,
    // Gold-Stufe + „C“ = Kapitän DEINER Elf (nicht der Mannschaftskapitän)
    isCaptain: kapitaen,
  }
}

/** Brustbild/Avatar (Freisteller, wenn vorhanden). */
export function spielerBild(k: Pick<KaderSpieler, 'id' | 'cutoutUrl' | 'fotoUrl'> | undefined): { src: string | null; freigestellt: boolean } {
  if (!k) return { src: null, freigestellt: false }
  const m = playerMedia(k.id, { cutoutUrl: k.cutoutUrl, photoUrl: k.fotoUrl })
  return { src: m.bild, freigestellt: m.cutout }
}

/** Sammelkarte auf ein Canvas zeichnen (Story-Bilder). */
export async function zeichneKarte(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, k: KaderSpieler, kapitaen = false) {
  const figur = hdCutout(playerMedia(k.id, { cutoutUrl: k.cutoutUrl, photoUrl: k.fotoUrl }).figure)
  const assets = await loadCardAssets(figur)
  drawPlayerCard(ctx, x, y, w, alsPlayer(k, kapitaen), assets, { hero: true })
}
