import { WEBSITE_CONTENT_OVERLAY } from './generated/website-content.generated'
import type { Galerie, GalerieBild } from './content-overlay'
import { NELE } from './club'

export type { Galerie, GalerieBild }

// ─────────────────────────────────────────────────────────────
// v17-D „Spieltag in Bildern“: Galerien der offiziellen Vereinsfotografin.
// Quelle: Admin → Galerien (web_snapshot().galerien, beim Build lokal
// gespeichert). Solange dort nichts veröffentlicht ist, zeigt die Website
// den statischen Seed unten (kuratiert aus ~/Desktop/Urknall Pokal,
// 12 von 218 Fotos, im Repo optimiert: 2000 px + 800 px Vorschau, WebP).
// Bewusst klein und three-frei: wird auch von /galerie geladen.
// ─────────────────────────────────────────────────────────────

const U = '/galerie/urknall-pokal-2026/'

const SEED: Galerie[] = [
  {
    slug: 'urknall-pokal-2026',
    titel: 'AGA Urknall — Sieger Aspe-Haie-Pokal 2026',
    untertitel: 'Turniertag am 12. September: Spiele, Pokal, Jubel.',
    datum: '2026-09-12',
    fotograf: NELE.name,
    fotografUrl: NELE.instagramUrl,
    bilder: [
      { src: U + '01-pokal-jubel.webp', preview: U + '01-pokal-jubel-800.webp', w: 2000, h: 1333, alt: 'Der Pokal geht hoch: Jubel mit Fahne nach dem Finale', cover: true },
      { src: U + '02-siegerfoto.webp', preview: U + '02-siegerfoto-800.webp', w: 2000, h: 1333, alt: 'Siegerfoto vor dem Tor mit Urknall-Fahne und Pokal' },
      { src: U + '03-pokal.webp', preview: U + '03-pokal-800.webp', w: 1333, h: 2000, alt: 'Der Aspe-Haie-Pokal in die Höhe gestemmt' },
      { src: U + '04-abpfiff.webp', preview: U + '04-abpfiff-800.webp', w: 2000, h: 1333, alt: 'Abpfiff: Die Mannschaft feiert vor dem Maisfeld' },
      { src: U + '05-kreis.webp', preview: U + '05-kreis-800.webp', w: 2000, h: 1333, alt: 'Mannschaftskreis vor dem Spiel, dahinter die Fahne' },
      { src: U + '06-parade.webp', preview: U + '06-parade-800.webp', w: 2000, h: 1333, alt: 'Torschuss und Parade im Turnier' },
      { src: U + '07-gefangen.webp', preview: U + '07-gefangen-800.webp', w: 2000, h: 1334, alt: 'Der Torwart pflückt den Ball aus der Luft' },
      { src: U + '08-am-ball.webp', preview: U + '08-am-ball-800.webp', w: 2000, h: 1333, alt: 'Am Ball: Dribbling vor dem Tor' },
      { src: U + '09-fahne.webp', preview: U + '09-fahne-800.webp', w: 2000, h: 1333, alt: 'Die AGA-Urknall-Fahne am Tornetz' },
      { src: U + '10-trikot.webp', preview: U + '10-trikot-800.webp', w: 2000, h: 1333, alt: 'Aga Urknall auf dem Rücken: Trikot Nummer 7' },
      { src: U + '11-hochwerfen.webp', preview: U + '11-hochwerfen-800.webp', w: 2000, h: 1333, alt: 'Einer fliegt: Die Mannschaft wirft einen Spieler in die Luft' },
      { src: U + '12-pokalkuss.webp', preview: U + '12-pokalkuss-800.webp', w: 2000, h: 1333, alt: 'Mit dem Pokal mitten in der Feier' },
    ],
  },
]

const ov = WEBSITE_CONTENT_OVERLAY?.galerien
export const GALERIEN: Galerie[] = ov && ov.length > 0 ? ov : SEED

export function coverOf(g: Galerie): GalerieBild {
  return g.bilder.find((b) => b.cover) ?? g.bilder[0]
}

/** „12. September 2026“ */
export function galerieDatum(g: Galerie): string {
  if (!g.datum) return ''
  const d = new Date(g.datum + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric' })
}
