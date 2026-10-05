// P1 (Admin-Ausbau): Typ des build-time erzeugten Website-Overlays.
//
// v14-C: Der Build liest den Stand aus dem Admin über EINE öffentliche
// Funktion (web_snapshot(), Supabase-RPC mit anon-Key) und backt ihn statisch
// ins Bundle (scripts/fetch-content.mjs). Fotos/Logos werden dabei nach
// public/generated/ heruntergeladen — die Website macht zur Laufzeit weiterhin
// 0 externe Requests.
// Diese Datei beschreibt NUR die Form dieses Overlays — sie enthält keine
// Laufzeit-Logik und importiert keinen Supabase-Client (die 3D-Seite bleibt
// Supabase-frei; das Overlay ist reines, zur Build-Zeit erzeugtes Daten-TS).

import type { Player, Staff } from './players'
import type { Lineup } from './lineup'
import type { Sponsor, Match, PlayedMatch, TableRow, FormResult } from './club'

/** v14-C: Kontakt-Felder aus dem Admin (Verein & Links). Alle optional —
 *  fehlende Felder fallen in src/data/content.ts auf club.ts CONTACT zurück. */
export interface ContactOverride {
  address?: string
  mapsQuery?: string
  email?: string
  training?: string
  /** v15-L: Trainingsort (≠ Spielort `address`). */
  trainingOrt?: string
  /** Anzeigeform mit @, z. B. '@sva_fussball'. */
  instagram?: string
  instagramUrl?: string
  /** Internationales Format ohne + und ohne führende 0. */
  whatsapp?: string
}

/** v14-C: Externe Vereins-Links aus dem Admin (Verein & Links). */
export interface LinksOverride {
  /** fussball.de Team-Permanent-ID (ersetzt CLUB.fussballDeTeamId). */
  fussballDeTeamId?: string
  /** FuPa-Teamseite, z. B. https://www.fupa.net/team/… */
  fupaUrl?: string
}

/** v16-S: Stufe auf der Partner-Wand (/partner). */
export type SponsorStufe = 'hauptpartner' | 'partner' | 'unterstuetzer'

/** v14-C: Sponsor aus dem Admin. `bande` = Logo auch auf der 3D-Bande
 *  (false = nur im Sponsoren-Streifen). Ist ein Sponsor im Sinne von club.ts.
 *  v16-S: + `stufe` (fehlt = 'partner'). */
export type OverlaySponsor = Sponsor & { bande?: boolean; stufe?: SponsorStufe }

/** v16-S: verkaufbares Partner-Paket (Admin → Partner → Pakete). */
export interface PartnerPaket {
  /** DB-ID — nur für die Paket-Auswahl im Anfrage-Formular. */
  id: string
  name: string
  beschreibung?: string
  leistungen: string[]
  /** „ab … €" (ganze Euro). Fehlt = „Preis auf Anfrage". */
  preisAb?: number
  preisEinheit: 'Saison' | 'Spieltag' | 'Monat' | 'einmalig'
  /** Gesamtplätze; fehlt = unbegrenzt (keine Anzeige). */
  plaetze?: number
  /** Noch freie Plätze (Plätze − aktive Sponsoren mit diesem Paket). */
  frei?: number
  hervorgehoben?: boolean
}

/** v16-S: Mediadaten — nur gepflegte Felder sind gesetzt. */
export interface PartnerMediadaten {
  instagramFollower?: number
  reichweiteMonat?: number
  zuschauerHeim?: number
  websiteBesucheMonat?: number
  heimspieleSaison?: number
  /** v17-A: Ø gezählte Zuschauer-Check-ins (Sammelalbum) pro Heimspiel der Saison */
  checkinsSchnitt?: number
  /** v17-A: über so viele Heimspiele gezählt */
  checkinsSpiele?: number
  /** ISO-Datum (YYYY-MM-DD) */
  stand?: string
}

/** v16-S: Partner-Bereich aus web_snapshot().partner. */
export interface PartnerOverlay {
  pakete: PartnerPaket[]
  mediadaten: PartnerMediadaten
  /** „Live-Ticker präsentiert von" (Logo lokal unter /generated/sponsors). */
  livePartner?: { name: string; logoUrl?: string; url?: string }
}

/** Textüberschreibung eines Abschnitts (nur Textfelder; id ordnet zu). */
export interface SectionCopyOverride {
  id: string
  label?: string
  kicker?: string
  title?: string
  body?: string
}

/** v17-D: Bild einer Galerie (lokal unter /generated/galerien/… oder /galerie/…). */
export interface GalerieBild {
  /** Vollbild, lange Kante ≤ 2000 px */
  src: string
  /** Vorschau, lange Kante ≤ 800 px */
  preview: string
  w: number
  h: number
  alt: string
  cover?: boolean
}

/** v17-D: „Spieltag in Bildern“ — eine veröffentlichte Galerie. */
export interface Galerie {
  slug: string
  titel: string
  untertitel?: string
  /** ISO-Datum YYYY-MM-DD */
  datum?: string
  fotograf: string
  fotografUrl?: string
  spiel?: { opponent: string; home: boolean; kickoff?: string }
  bilder: GalerieBild[]
}

export interface WebsiteContentOverlay {
  /** Herkunft, für Build-Log/Debug. */
  source: 'db'
  /** Zeitpunkt des Build-Fetches (ISO). */
  generatedAt: string
  players?: Player[]
  /** v14: Startelf + Bank aus dem Admin (Vereins-Pflege → Aufstellung). */
  lineup?: Lineup | null
  staff?: Staff[]
  sponsors?: OverlaySponsor[]
  nextMatch?: Match | null
  lastMatch?: PlayedMatch | null
  table?: TableRow[]
  form?: FormResult[]
  /** Copy-Overrides je Abschnitt (aus sm_website_content). */
  sections?: SectionCopyOverride[]
  /** v14-C: Kontakt aus dem Admin (Verein & Links). */
  contact?: ContactOverride
  /** v14-C: fussball.de/FuPa-Links aus dem Admin (Verein & Links). */
  links?: LinksOverride
  /** v16-S: Partner-Bereich (/partner): Pakete, Mediadaten, Live-Partner. */
  partner?: PartnerOverlay
  /** v17-D: Galerien „Spieltag in Bildern“ (Admin → Galerien). */
  galerien?: Galerie[]
  /** v18-A: Mannschaften im Probetraining-Assistenten (web_mitspielen()). */
  mannschaften?: MannschaftOverlay[]
}

/** v18-A: Mannschaft für „Probetraining“ — whatsapp leer = Haupt-WhatsApp. */
export interface MannschaftOverlay {
  id: string
  name: string
  hinweis?: string
  /** leer = Trainingszeiten/-ort aus Verein & Links */
  training?: string
  /** Vorname für die Anrede */
  kontakt?: string
  whatsapp?: string
}
