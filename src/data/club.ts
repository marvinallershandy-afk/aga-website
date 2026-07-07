// ─────────────────────────────────────────────────────────────
// Vereins-Inhalte als Seed. Alles Platzhalter-tauglich, v2 → CMS.
// ─────────────────────────────────────────────────────────────

export const CLUB = {
  name: 'SV Agathenburg-Dollern',
  shortName: 'SVA',
  claim: 'Ein Dorf. Ein Verein. Ein Platz.',
  founded: 1949,
  // fussball.de Vereins-/Team-Widget-ID — PLATZHALTER.
  // Marvin trägt die echte Team-Permanent-ID von fussball.de nach.
  fussballDeTeamId: '011MIABCDE000000VS5489B2VVCJ',
} as const

export interface Section {
  id: string
  /** Nav-Beschriftung (id bleibt stabil für Anker/Kamera). */
  label: string
  kicker: string
  title: string
  body: string
}

// Reihenfolge = Reihenfolge der Kamera-Stationen entlang der Fahrt.
export const SECTIONS: Section[] = [
  {
    id: 'verein',
    label: 'Verein',
    kicker: 'Seit 1949 · Agathenburg',
    title: 'Willkommen\nam Platz',
    body: 'Ein Dorf, ein Flutlicht, elf Mann — und eine Bande, hinter der man jeden kennt. Der SV Agathenburg-Dollern ist seit 1949 das Wohnzimmer von Agathenburg. Scroll dich einmal quer über unseren Platz und schau, ob du bleibst. Spoiler: Du bleibst.',
  },
  {
    id: 'mannschaft',
    label: 'Mannschaft',
    kicker: '1. Herren',
    title: 'Unsere\nMannschaft',
    body: 'Sechzehn Typen, die montags humpeln und sonntags fliegen. Jeder von ihnen als Sammelkarte — Metall-Foil, echte Zahlen und genug Stolz für ein ganzes Album. Tipp eine Karte an und teil deinen Spieler in der Story.',
  },
  {
    id: 'fanblock',
    label: 'Fans',
    kicker: 'Die Südkurve',
    title: 'Der\nFanblock',
    body: 'Elf auf dem Platz, aber gewonnen wird an der Bande. Unsere Kurve steht bei jedem Wetter, hält die Fahne hoch und wird auch bei 0:3 nicht leiser. Banner hoch, Schal um, Stimme kaputt — hier gehörst du dazu, ab dem ersten Sonntag.',
  },
  {
    id: 'musik',
    label: 'Musik',
    kicker: 'Vereinsheim · Partyraum',
    title: 'AGA\nUrknall',
    body: 'Willkommen im Partyraum — hier läuft „Aga Urknall", unsere eigene Musik, benannt nach der Truppe, die 2024 den Riesenkicker holte (Grüße an Dynamo Tresen und die Durstigen Männer). Songs über Anpfiff, Abpfiff und alles, was dazwischen knallt, geschrieben von einem von uns. Drück Play, dreh auf — wer mitgrölt, ist schon fast Mitglied.',
  },
  {
    id: 'tabelle',
    label: 'Tabelle',
    kicker: 'Ergebnisse & Tabelle',
    title: 'Die Wahrheit\nvom Wochenende',
    body: 'Manchmal Tabellenführer der Herzen, manchmal einfach Tabellenführer. Hier steht, was am Wochenende wirklich passiert ist — live von fussball.de, ungefiltert und gelegentlich glorreich.',
  },
  {
    id: 'kontakt',
    label: 'Mitmachen',
    kicker: 'Mitmachen',
    title: 'Komm\nvorbei',
    body: 'Probetraining ist bei uns ein kompliziertes Verfahren: hinkommen, Schuhe an, fertig. Dienstag & Donnerstag ab 19 Uhr, kein Anruf nötig, keine Ausrede möglich.',
  },
]

// ── Sponsoren (v8-E5) ────────────────────────────────────────
// Echte lokale Sponsoren hier eintragen (logo = Pfad in public/sponsors/).
// Solange leer, zeigt die Seite „Hier könnte dein Logo stehen"-Slots —
// zugleich Verkaufsargument (Marvin liefert echte Logos).
export interface Sponsor {
  name: string
  logo?: string
  url?: string
}
export const SPONSORS: Sponsor[] = []
export const SPONSOR_PLACEHOLDER_SLOTS = 4

// ── Nächstes Heimspiel (v8-E5) ───────────────────────────────
// PLATZHALTER bis echte Termine / fussball.de-Anbindung.
export interface Match {
  opponent: string
  date: string
  home: boolean
  isPlaceholder?: boolean
}
export const NEXT_MATCH: Match = {
  opponent: 'Gegner folgt',
  date: 'Sonntag · Termin folgt',
  home: true,
  isPlaceholder: true,
}

// ── Vereins-/Mannschaftsfoto-Slot (v8-E5) ────────────────────
// undefined → kein leerer Rahmen. Marvin liefert echtes Stimmungsbild.
export const TEAM_PHOTO: string | undefined = undefined

export const CONTACT = {
  // v6-E5: echte Vereinsfakten. Platz liegt am Waldrand („Waldsportplatz").
  address: 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg',
  // Route-Ziel (Kurzform reicht Apple/Google Maps als Suchziel)
  mapsQuery: 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg',
  email: 'info@sv-agathenburg-dollern.de',
  // PLATZHALTER (Marvin bestätigen): Trainingszeit gegen die offizielle
  // Vereinsseite prüfen. Aktuell plausibler Herren-Abendslot.
  training: 'Di & Do, ab 19:00 Uhr',
  instagram: '@sva_fussball',
  instagramUrl: 'https://instagram.com/sva_fussball',
} as const
