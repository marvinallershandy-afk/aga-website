// ─────────────────────────────────────────────────────────────
// v16-S: Daten-Fassade des Partner-Bereichs (/partner, Onepager-Leiste).
//
// Quelle = build-time Overlay (web_snapshot().partner + sponsors[].stufe,
// geschrieben von scripts/fetch-content.mjs). Ohne Overlay greifen ruhige
// Seeds: Paket-NAMEN und Leistungen ohne Preise/Plätze (nichts Erfundenes
// öffentlich), keine Mediadaten, leere Partner-Wand.
// Bewusst ohne React/three.js/Supabase → nutzbar im schlanken /partner-Bundle.
// ─────────────────────────────────────────────────────────────
import { WEBSITE_CONTENT_OVERLAY } from './generated/website-content.generated'
import { SPONSORS as STATIC_SPONSORS } from './club'
import type { OverlaySponsor, PartnerMediadaten, PartnerPaket, SponsorStufe } from './content-overlay'

export type { PartnerPaket, PartnerMediadaten, SponsorStufe } from './content-overlay'

const ov = WEBSITE_CONTENT_OVERLAY

/** Ohne Datenbank: dieselben Pakete wie der Migrations-Seed, aber „auf Anfrage". */
const SEED_PAKETE: PartnerPaket[] = [
  { id: 'seed-bande', name: 'Bande am Spielfeld', preisEinheit: 'Saison', hervorgehoben: true, beschreibung: 'Dein Banner direkt am Waldsportplatz — bei jedem Heimspiel, auf jedem Spielfoto.', leistungen: ['Bandenplatz am Waldsportplatz (ganze Saison)', 'Logo auf der 3D-Bande der Website', 'Logo auf der Partner-Wand', 'Dankes-Post auf Instagram'] },
  { id: 'seed-trikot', name: 'Trikot / Ärmel', preisEinheit: 'Saison', beschreibung: 'Die sichtbarste Fläche im Verein: auf jedem Trikot, in jedem Spielfoto und Reel.', leistungen: ['Logo auf Brust oder Ärmel der 1. Herren', 'In allen Spielfotos und Reels sichtbar', 'Hauptpartner auf der Partner-Wand'] },
  { id: 'seed-social', name: 'Social-Media-Paket', preisEinheit: 'Saison', beschreibung: 'Reichweite in der Region: Wir stellen dich in Stories und einem Reel vor.', leistungen: ['2 Story-Features mit Markierung', '1 Reel mit deinem Unternehmen', 'Logo auf der Partner-Wand'] },
  { id: 'seed-spieltag', name: '„Spieltag präsentiert von"', preisEinheit: 'Spieltag', beschreibung: 'Ein Heimspiel gehört dir: Ankündigung, Durchsage und Spieltagsgrafik mit deinem Namen.', leistungen: ['Nennung in Spieltags-Post und Story', 'Durchsage am Platz', 'Logo auf der Spieltagsgrafik'] },
  { id: 'seed-live', name: '„Live-Ticker präsentiert von"', preisEinheit: 'Saison', beschreibung: 'Dein Logo im Kopf des Live-Tickers und auf jeder Endstand-Grafik der Saison.', leistungen: ['Logo im Kopf von /live bei jedem Spiel', 'Logo auf jeder Endstand-Story-Grafik'] },
  { id: 'seed-unterstuetzer', name: 'Unterstützer', preisEinheit: 'Saison', beschreibung: 'Kleiner Betrag, große Wirkung: Du hilfst dem Verein und stehst auf der Partner-Wand.', leistungen: ['Name bzw. Logo auf der Partner-Wand', 'Dank im Saison-Abschluss-Post'] },
]

/** Pakete aus dem Admin (nur sichtbare), sonst Seed ohne Preise. */
export const PARTNER_PAKETE: PartnerPaket[] = ov?.partner ? ov.partner.pakete : SEED_PAKETE
/** true = Pakete kommen aus dem Admin (IDs gehen mit der Anfrage mit). */
export const PAKETE_AUS_ADMIN = !!ov?.partner

export const MEDIADATEN: PartnerMediadaten = ov?.partner?.mediadaten ?? {}
export const LIVE_PARTNER = ov?.partner?.livePartner ?? null

/** Alle aktiven Sponsoren mit Stufe (fehlend = 'partner'). Hauptpartner zuerst. */
const RANG: Record<SponsorStufe, number> = { hauptpartner: 0, partner: 1, unterstuetzer: 2 }
export const PARTNER_SPONSOREN: (OverlaySponsor & { stufe: SponsorStufe })[] = (ov?.sponsors?.length ? ov.sponsors : STATIC_SPONSORS)
  .map((s) => ({ ...s, stufe: (s as OverlaySponsor).stufe ?? 'partner' }))
  .sort((a, b) => RANG[a.stufe] - RANG[b.stufe])

export const STUFE_LABEL: Record<SponsorStufe, string> = {
  hauptpartner: 'Hauptpartner',
  partner: 'Partner',
  unterstuetzer: 'Unterstützer',
}

// ── Formatierung ────────────────────────────────────────────
const nf = new Intl.NumberFormat('de-DE')
/** 41000 → „41.000"; ab 100.000 → „120 Tsd." */
export function zahl(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString('de-DE', { maximumFractionDigits: 1 })} Mio.`
  if (n >= 100_000) return `${Math.round(n / 1000)} Tsd.`
  return nf.format(n)
}

export function preisText(p: PartnerPaket): string {
  if (p.preisAb == null) return 'Preis auf Anfrage'
  const einheit = p.preisEinheit === 'einmalig' ? 'einmalig' : `/ ${p.preisEinheit}`
  return `ab ${nf.format(p.preisAb)} € ${einheit}`
}

export function plaetzeText(p: PartnerPaket): string | null {
  if (p.plaetze == null || p.frei == null) return null
  if (p.frei <= 0) return 'ausgebucht · Warteliste'
  if (p.frei === 1) return p.plaetze === 1 ? 'exklusiv · noch frei' : 'nur noch 1 frei'
  return `noch ${p.frei} von ${p.plaetze} frei`
}

/** „Oktober 2026" */
export function standText(iso: string | undefined): string | null {
  if (!iso) return null
  const d = new Date(`${iso}T12:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' })
}
