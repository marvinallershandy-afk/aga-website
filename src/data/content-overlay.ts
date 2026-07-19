// P1 (Admin-Ausbau): Typ des build-time erzeugten Website-Overlays.
//
// Der Prerender/Build kann Kader, Spiele, Tabelle und Sponsoren aus den
// kanonischen SME-Tabellen (players/matches/sponsors + Cockpit-Tabelle
// sm_tabelle) lesen und statisch ins Bundle backen (scripts/fetch-content.mjs).
// Diese Datei beschreibt NUR die Form dieses Overlays — sie enthält keine
// Laufzeit-Logik und importiert keinen Supabase-Client (die 3D-Seite bleibt
// Supabase-frei; das Overlay ist reines, zur Build-Zeit erzeugtes Daten-TS).

import type { Player, Staff } from './players'
import type { Sponsor, Match, PlayedMatch, TableRow, FormResult } from './club'

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
  staff?: Staff[]
  sponsors?: Sponsor[]
  nextMatch?: Match | null
  lastMatch?: PlayedMatch | null
  table?: TableRow[]
  form?: FormResult[]
  /** Copy-Overrides je Abschnitt (aus sm_website_content). */
  sections?: SectionCopyOverride[]
}
