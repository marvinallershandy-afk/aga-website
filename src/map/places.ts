// ─────────────────────────────────────────────────────────────
// v16-K „Vereinsgelände-Karte": die Orte der Karte.
// Bewusst OHNE three-Import — die Karte (DOM-Marker, Panels, Routing)
// lebt auch im Poster-/Fallback-Pfad, der three nie lädt.
//
// Reihenfolge = Priorität der Vereinsziele (SVA_ZIELE_CHECK.md):
// Zuschauer (Spieltag) → Spieler (Training) → Identität (Mannschaft,
// Fans, Musik) → Sponsoren (Partner) → Anfahrt/Kontakt.
// ─────────────────────────────────────────────────────────────

export type PlaceId = 'spieltag' | 'training' | 'mannschaft' | 'fans' | 'musik' | 'partner' | 'anfahrt'

export interface Place {
  id: PlaceId
  /** Marker-Beschriftung (kurz, Game-Map-Pin). */
  label: string
  /** Panel-Kopf. */
  kicker: string
  title: string
  /** Ankerpunkt des Markers in Weltkoordinaten (+x Ost, +z Süd). */
  anchor: [number, number, number]
  /** Weitere Hash-/Pfad-Namen, die diesen Ort öffnen (alte Anker, IG-Links). */
  aliases: string[]
  /** Pin-Farbe: 'red' = Ziel-Orte, 'dark' = Story-Orte, 'sign' = Wegweiser. */
  tone: 'red' | 'dark' | 'sign'
}

export const PLACES: Place[] = [
  {
    id: 'spieltag',
    label: 'Spieltag & Live',
    kicker: 'Anzeigetafel',
    title: 'Spieltag & Live',
    anchor: [6.15, 0.82, -0.35],
    aliases: ['live', 'spieltag', 'tabelle', 'spielplan'],
    tone: 'red',
  },
  {
    id: 'training',
    label: 'Mitspielen',
    kicker: 'Trainingsplatz B73',
    title: 'Mitspielen & Training',
    anchor: [-7.6, 0.3, 3.4],
    aliases: ['training', 'mitspielen', 'mitmachen', 'probetraining'],
    tone: 'sign',
  },
  {
    id: 'mannschaft',
    label: 'Mannschaft',
    kicker: '1. Herren',
    title: 'Unsere Mannschaft',
    anchor: [-1.6, 0.15, -0.6],
    aliases: ['mannschaft', 'team', 'kader'],
    tone: 'dark',
  },
  {
    id: 'fans',
    label: 'Fans',
    kicker: 'Die Kurve · Meister 2026',
    title: 'Fans & Meisterfeier',
    anchor: [3.6, 0.45, 4.7],
    aliases: ['fans', 'fanblock', 'meisterfeier'],
    tone: 'dark',
  },
  {
    id: 'musik',
    label: 'Vereinsheim',
    kicker: 'Partyraum · AGA Urknall',
    title: 'Vereinsheim & Musik',
    anchor: [7.5, 1.05, -3.0],
    aliases: ['musik', 'vereinsheim', 'partyraum'],
    tone: 'dark',
  },
  {
    id: 'partner',
    label: 'Partner',
    kicker: 'Für Unternehmen',
    title: 'Partner & Bande',
    anchor: [-2.2, 0.3, 4.05],
    aliases: ['partner', 'sponsoren', 'sponsor', 'bande'],
    tone: 'dark',
  },
  {
    id: 'anfahrt',
    label: 'Anfahrt',
    kicker: 'Waldsportplatz Agathenburg',
    title: 'Anfahrt & Kontakt',
    anchor: [9.4, 0.2, 3.6],
    aliases: ['anfahrt', 'kontakt', 'route'],
    tone: 'dark',
  },
]

export const PLACE_BY_ID = Object.fromEntries(PLACES.map((p) => [p.id, p])) as Record<PlaceId, Place>

/** Hash-/Pfad-Segment → Ort (inkl. Aliasse). */
export function placeFromSlug(slug: string): PlaceId | null {
  const s = slug.toLowerCase().replace(/^[#/]+|\/+$/g, '')
  if (!s) return null
  const hit = PLACES.find((p) => p.id === s || p.aliases.includes(s))
  return hit ? hit.id : null
}

/** Rundgang-Slugs (alter Onepager-Modus). */
export const TOUR_SLUGS = ['rundgang', 'tour']
