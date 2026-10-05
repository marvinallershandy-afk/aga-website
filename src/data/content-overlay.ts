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

/** v14-C: Sponsor aus dem Admin. `bande` = Logo auch auf der 3D-Bande
 *  (false = nur im Sponsoren-Streifen). Ist ein Sponsor im Sinne von club.ts. */
export type OverlaySponsor = Sponsor & { bande?: boolean }

/** Textüberschreibung eines Abschnitts (nur Textfelder; id ordnet zu). */
export interface SectionCopyOverride {
  id: string
  label?: string
  kicker?: string
  title?: string
  body?: string
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
}
