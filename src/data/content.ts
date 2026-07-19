// ─────────────────────────────────────────────────────────────
// P1 (Admin-Ausbau): Daten-Fassade der öffentlichen Website.
//
// Warum diese Datei existiert:
//   Die öffentliche 3D-Seite las bisher ausschließlich die statischen Seeds
//   src/data/players.ts und src/data/club.ts. Damit der Admin die Website
//   „steuern" kann, sollen Kader/Spiele/Tabelle/Sponsoren aus der Datenbank
//   kommen — OHNE dass die 3D-Seite zur Laufzeit Supabase kontaktiert
//   (0-externe-Requests-Befund + Bundle-Trennung bleiben erhalten).
//
// Mechanismus (ENV-GATED, build-time):
//   scripts/fetch-content.mjs liest beim Build die kanonischen Tabellen und
//   schreibt sie als statisches Overlay in generated/website-content.generated.ts.
//   Diese Fassade wählt pro Datensatz: Overlay (falls vorhanden & nicht leer)
//   sonst statischer Seed. Aktuell sind die Tabellen leer bzw. keine Build-Env
//   gesetzt → Overlay = null → alles fällt sauber auf die Seeds zurück.
//
// Konsumenten importieren Website-Daten künftig aus DIESER Datei statt direkt
// aus players.ts / club.ts. players.ts / club.ts selbst bleiben unverändert.
// ─────────────────────────────────────────────────────────────

import { PLAYERS as STATIC_PLAYERS, STAFF as STATIC_STAFF } from './players'
import {
  SPONSORS as STATIC_SPONSORS,
  NEXT_MATCH as STATIC_NEXT_MATCH,
  LAST_MATCH as STATIC_LAST_MATCH,
  TABLE_PREVIEW as STATIC_TABLE,
  FORM as STATIC_FORM,
  SECTIONS as STATIC_SECTIONS,
} from './club'
import { WEBSITE_CONTENT_OVERLAY } from './generated/website-content.generated'
import type { Player, Staff } from './players'
import type { Sponsor, Match, PlayedMatch, TableRow, FormResult, Section } from './club'

// ── Unveränderte Durchreiche der Nicht-DB-Inhalte (Fallback-Quellen) ────────
export { POSITION_LABEL, ROLE_LABEL } from './players'
export type { Position, Player, StaffRole, Staff } from './players'
export {
  CLUB,
  fussballDeTeamUrl,
  SPONSOR_PLACEHOLDER_SLOTS,
  nextKickoff,
  TEAM_PHOTO,
  FAN_PHOTOS,
  CONTACT,
  whatsappReady,
  whatsappUrl,
} from './club'
export type { Section, Sponsor, Match, FormResult, PlayedMatch, TableRow, FanPhoto } from './club'

// ── Resolver: Overlay bevorzugen, sonst statischer Seed ─────────────────────
const ov = WEBSITE_CONTENT_OVERLAY

function pick<T>(a: T[] | undefined, fallback: T[]): T[] {
  return a && a.length > 0 ? a : fallback
}

export const PLAYERS: Player[] = pick(ov?.players, STATIC_PLAYERS)
export const STAFF: Staff[] = pick(ov?.staff, STATIC_STAFF)
export const SPONSORS: Sponsor[] = pick(ov?.sponsors, STATIC_SPONSORS)
export const TABLE_PREVIEW: TableRow[] = pick(ov?.table, STATIC_TABLE)
export const FORM: FormResult[] = pick(ov?.form, STATIC_FORM)
export const NEXT_MATCH: Match = ov?.nextMatch ?? STATIC_NEXT_MATCH
export const LAST_MATCH: PlayedMatch = ov?.lastMatch ?? STATIC_LAST_MATCH

// Sektionstexte: konservativ mergen — Reihenfolge und Abschnitts-IDs
// (Kamera-Stationen) bleiben aus dem statischen Seed; das Overlay überschreibt
// pro Abschnitt nur vorhandene Textfelder. Unvollständige Pflege kann die
// 3D-Fahrt so nicht brechen.
export const SECTIONS: Section[] = ov?.sections?.length
  ? STATIC_SECTIONS.map((s) => {
      const o = ov.sections!.find((x) => x.id === s.id)
      if (!o) return s
      return {
        ...s,
        ...(o.label != null ? { label: o.label } : {}),
        ...(o.kicker != null ? { kicker: o.kicker } : {}),
        ...(o.title != null ? { title: o.title } : {}),
        ...(o.body != null ? { body: o.body } : {}),
      }
    })
  : STATIC_SECTIONS

// Herkunfts-Flag (für Build-Log/Debug): 'db', sobald ein Overlay geladen wurde.
export const CONTENT_SOURCE: 'db' | 'static' = ov ? 'db' : 'static'
