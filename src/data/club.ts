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
    body: 'Sechzehn Typen, die montags humpeln und sonntags fliegen. Jeder von ihnen als Sammelkarte — mit Holo-Glanz, echten Zahlen und genug Stolz für ein ganzes Album. Tipp eine Karte an und teil deinen Spieler in der Story.',
  },
  {
    id: 'musik',
    label: 'Musik',
    kicker: 'Vereinsheim · Partyraum',
    title: 'AGA\nUrknall',
    body: 'Willkommen im Partyraum — hier läuft unsere eigene Musik. Zehn Songs über Anpfiff, Abpfiff und alles, was dazwischen knallt, geschrieben von einem von uns. Drück Play, dreh auf — und wenn du mitgrölen kannst, bist du schon fast Mitglied.',
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

export const CONTACT = {
  address: 'Sportplatz Agathenburg, Am Sportplatz 1, 21684 Agathenburg',
  email: 'info@sv-agathenburg-dollern.de',
  training: 'Di & Do, ab 19:00 Uhr',
  instagram: '@sva_fussball',
} as const
