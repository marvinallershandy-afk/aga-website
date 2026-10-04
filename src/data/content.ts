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
  CONTACT as STATIC_CONTACT,
  CLUB as STATIC_CLUB,
} from './club'
import { LINEUP as STATIC_LINEUP } from './lineup'
import type { Lineup } from './lineup'
import { WEBSITE_CONTENT_OVERLAY } from './generated/website-content.generated'
import type { Player, Staff } from './players'
import type { Sponsor, Match, PlayedMatch, TableRow, FormResult, Section } from './club'

// ── Unveränderte Durchreiche der Nicht-DB-Inhalte (Fallback-Quellen) ────────
export { POSITION_LABEL, ROLE_LABEL } from './players'
export type { Position, Player, StaffRole, Staff } from './players'
// v14-C: CONTACT, whatsappReady, whatsappUrl, fussballDeTeamUrl und
// nextKickoff werden unten overlay-bewusst aufgelöst (Admin → Verein & Links /
// Spiele) — gleiche Namen und Signaturen wie in club.ts, Fallback = club.ts.
export {
  CLUB,
  SPONSOR_PLACEHOLDER_SLOTS,
  TEAM_PHOTO,
  FAN_PHOTOS,
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
export const LAST_MATCH: PlayedMatch | null = ov?.lastMatch ?? STATIC_LAST_MATCH
// v14: Aufstellung — Overlay nur, wenn es eine vollständige Elf trägt.
export const LINEUP: Lineup = ov?.lineup && ov.lineup.startelf.length === 11 ? ov.lineup : STATIC_LINEUP
export { FORMATION_SLOTS } from './lineup'
export type { Lineup, Formation, Slot } from './lineup'

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

// ── v14-C: Kontakt & Links aus dem Admin (Verein & Links) ───────────────────
// Feldweise Overlay vor Seed: ein leeres/fehlendes Feld im Admin lässt den
// club.ts-Wert stehen. Die Dummy-WhatsApp-Nummer bleibt der Seed-Wert, bis im
// Admin eine echte eingetragen ist (whatsappReady regelt den Rest).
type Contact = { -readonly [K in keyof typeof STATIC_CONTACT]: string }
function nonEmpty<T extends object>(o: T | undefined): Partial<T> {
  if (!o) return {}
  return Object.fromEntries(
    Object.entries(o).filter(([, v]) => typeof v === 'string' && v.trim() !== ''),
  ) as Partial<T>
}
export const CONTACT: Contact = { ...STATIC_CONTACT, ...nonEmpty(ov?.contact) }

const DUMMY_WHATSAPP = '491700000000'
export const whatsappReady: boolean =
  CONTACT.whatsapp !== DUMMY_WHATSAPP && /^[1-9]\d{7,14}$/.test(CONTACT.whatsapp)

/** wa.me-Deeplink mit vorformulierter Nachricht; ohne echte Nummer → mailto. */
export function whatsappUrl(text: string): string {
  if (!whatsappReady) {
    return `mailto:${CONTACT.email}?subject=${encodeURIComponent('Anfrage über die Website')}&body=${encodeURIComponent(text)}`
  }
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
}

const fussballDeTeamId: string = ov?.links?.fussballDeTeamId?.trim() || STATIC_CLUB.fussballDeTeamId
/** Deep-Link auf die fussball.de-Mannschaftsseite (Team-ID aus dem Admin, sonst club.ts). */
export const fussballDeTeamUrl = `https://www.fussball.de/mannschaft/-/team-id/${fussballDeTeamId}#!/`

/** v14-C: Externe Links gesammelt. fupaUrl = null, solange im Admin nichts steht. */
export const LINKS: { fussballDeUrl: string; fupaUrl: string | null; instagramUrl: string } = {
  fussballDeUrl: fussballDeTeamUrl,
  fupaUrl: ov?.links?.fupaUrl?.trim() || null,
  instagramUrl: CONTACT.instagramUrl,
}

/** Echter Anstoß des nächsten Spiels (Overlay vor Seed); ohne kickoff → null
 *  (kein Countdown, kein Kalender-Export — Vertrag aus club.ts). */
export function nextKickoff(): Date | null {
  if (!NEXT_MATCH.kickoff) return null
  const d = new Date(NEXT_MATCH.kickoff)
  return Number.isNaN(d.getTime()) ? null : d
}
