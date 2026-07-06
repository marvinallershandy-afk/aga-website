// Marvins Tracks (Urheber: Marvin — Rechte-Lage in SVA_PLAN_V3.md).
// MP3 144 kbps, gestreamt bei Play (nichts davon im kritischen Ladepfad).
export interface Track {
  slug: string
  title: string
  duration: string
}

export const TRACKS: Track[] = [
  { slug: 'anpfiff', title: 'Anpfiff', duration: '2:13' },
  { slug: 'das-ist-aga', title: 'Das ist AGA!', duration: '3:33' },
  { slug: 'aga-egal-wo', title: 'AGA, egal wo', duration: '2:43' },
  { slug: 'nach-dem-urknall', title: 'Nach dem Urknall', duration: '2:55' },
  { slug: 'dritte-halbzeit', title: 'Dritte Halbzeit', duration: '2:49' },
  { slug: 'kreisklasse-royal', title: 'Kreisklasse Royal', duration: '3:07' },
  { slug: 'bis-alles-knallt', title: 'Bis alles knallt', duration: '2:51' },
  { slug: 'kabine-nach-abpfiff', title: 'Kabine nach Abpfiff', duration: '2:24' },
  { slug: 'noch-nicht-nuechtern', title: 'Noch nicht nüchtern', duration: '1:59' },
  { slug: 'aga-faehrt-nach-malle', title: 'AGA fährt nach Malle', duration: '3:11' },
]

export const trackUrl = (t: Track) => `/audio/tracks/${t.slug}.mp3`
export const COVER_URL = '/audio/cover.jpg'
export const COVER2_URL = '/audio/cover2.jpg' // Cover-2-Artwork (Trackliste im Partyraum)
export const ALBUM_TITLE = 'AGA Urknall — Heimspiel Überall'
