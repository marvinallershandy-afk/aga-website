// ─────────────────────────────────────────────────────────────
// Vereins-Inhalte als Seed. Alles Platzhalter-tauglich, v2 → CMS.
// ─────────────────────────────────────────────────────────────

export const CLUB = {
  name: 'SV Agathenburg-Dollern',
  shortName: 'SVA',
  claim: 'Ein Dorf. Ein Verein. Ein Platz.',
  founded: 1948,
  // fussball.de Vereins-/Team-Widget-ID — PLATZHALTER.
  // Marvin trägt die echte Team-Permanent-ID von fussball.de nach.
  fussballDeTeamId: '011MIABCDE000000VS5489B2VVCJ',
} as const

export interface Section {
  id: string
  kicker: string
  title: string
  body: string
}

// Reihenfolge = Reihenfolge der Kamera-Stationen entlang der Fahrt.
export const SECTIONS: Section[] = [
  {
    id: 'verein',
    kicker: 'Seit 1948',
    title: 'Willkommen\nam Platz',
    body: 'Der SV Agathenburg-Dollern ist mehr als ein Fußballverein — er ist das Wohnzimmer des Dorfes. Flutlicht an, Rasen frisch, die Bande voll. Willkommen in unserer Welt.',
  },
  {
    id: 'mannschaft',
    kicker: '1. Herren',
    title: 'Unsere\nMannschaft',
    body: 'Sechzehn Typen, ein Ziel. Jeder Spieler als Sammelkarte — dreh sie, teile sie, sei stolz drauf. Tippe auf eine Karte für die volle Ansicht.',
  },
  {
    id: 'tabelle',
    kicker: 'Kreisliga',
    title: 'Tabelle &\nSpieltag',
    body: 'Wo stehen wir? Live aus der offiziellen fussball.de-Datenbank — Tabelle, Ergebnisse, der nächste Gegner.',
  },
  {
    id: 'kontakt',
    kicker: 'Mach mit',
    title: 'Komm\nvorbei',
    body: 'Training Dienstag & Donnerstag ab 19 Uhr. Neue Spieler, Zuschauer und Sponsoren sind immer willkommen. Meld dich — wir freuen uns auf dich.',
  },
]

export const CONTACT = {
  address: 'Sportplatz Agathenburg, Am Sportplatz 1, 21684 Agathenburg',
  email: 'info@sv-agathenburg-dollern.de',
  training: 'Di & Do, ab 19:00 Uhr',
  instagram: '@sva_fussball',
} as const
