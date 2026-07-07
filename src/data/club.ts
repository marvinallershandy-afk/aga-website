// ─────────────────────────────────────────────────────────────
// Vereins-Inhalte als Seed. Alles Platzhalter-tauglich, v2 → CMS.
// ─────────────────────────────────────────────────────────────

export const CLUB = {
  name: 'SV Agathenburg-Dollern',
  shortName: 'SVA',
  claim: 'Ein Dorf. Ein Verein. Ein Platz.',
  founded: 1949,
  // fussball.de Team-Permanent-ID (v11-E5: echte ID von Marvin eingetragen).
  fussballDeTeamId: '00ES8GN7SS00004CVV0AG08LVUPGND5I',
} as const

// Deep-Link auf die fussball.de-Mannschaftsseite (Tabelle/Spiele/Team).
export const fussballDeTeamUrl = `https://www.fussball.de/mannschaft/-/team-id/${CLUB.fussballDeTeamId}#!/`

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
    body: 'Ein Dorf, Flutlicht an vier Masten, elf Mann — und eine Bande, hinter der man jeden kennt. Der SV Agathenburg-Dollern, seit 1949 mitten in Agathenburg. Scroll dich einmal quer über unseren Platz und schau, ob du bleibst. Spoiler: Du bleibst.',
  },
  {
    id: 'mannschaft',
    label: 'Mannschaft',
    kicker: '1. Herren',
    title: 'Unsere\nMannschaft',
    body: 'Eine Truppe, die montags humpelt und sonntags fliegt. Jeder als Sammelkarte — Metall-Foil, echte Zahlen und genug Stolz für ein ganzes Album. Tipp eine Karte an und teil deinen Spieler in der Story. Der Trainerstab steht darunter — die, die den Laden zusammenhalten.',
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
  // v11-E5: Reihenfolge getauscht — erst die TABELLE/Saison (Ergebnis-Beat),
  // dann die SPONSOREN (Geld-Beat direkt vor „Mitmachen").
  {
    id: 'tabelle',
    label: 'Tabelle',
    kicker: 'Saison-Cockpit',
    title: 'Die Wahrheit\nvom Wochenende',
    body: 'Manchmal Tabellenführer der Herzen, manchmal einfach Tabellenführer. Tabelle, Form der letzten Spiele, Top-Torschützen und das nächste Spiel — live von fussball.de, ungefiltert und gelegentlich glorreich.',
  },
  {
    id: 'sponsoren',
    label: 'Sponsoren',
    kicker: 'Für Unternehmen',
    title: 'Deine Bande\nwartet',
    body: 'Jeden Sonntag stehen hier Leute an der Bande, im Dorf und in der Story. Dein Logo direkt am Spielfeld — plus Reichweite auf Instagram, echtes lokales Herz und ein Verein, hinter dem das ganze Dorf steht. Wir haben eine Bande extra für dich freigelassen.',
  },
  {
    id: 'kontakt',
    label: 'Mitmachen',
    kicker: 'Mitmachen',
    title: 'Komm\nvorbei',
    body: 'Probetraining ist bei uns ein kompliziertes Verfahren: hinkommen, Schuhe an, fertig. Dienstag & Donnerstag ab 19 Uhr, kein Anruf nötig, keine Ausrede möglich.',
  },
]

// ── Sponsoren (v8-E5 · v10-E1 Slot-System) ───────────────────
// Echte lokale Sponsoren hier eintragen. `logoUrl` = Pfad zum Logo
// (public/sponsors/<name>.png, transparent/weiß, quer). Ist logoUrl
// gesetzt → Logo erscheint scharf auf der 3D-Bande UND im DOM-Strip.
// Ist es leer (oder das Array leer) → „HIER KÖNNTE DEIN LOGO STEHEN".
// Namensschema + Ablage siehe README (Abschnitt „Assets nachliefern").
export interface Sponsor {
  name: string
  /** Pfad zum Logo, z. B. '/sponsors/baeckerei-sonne.png'. Leer → Platzhalter. */
  logoUrl?: string
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

// ── Saison-Cockpit (v11-E5) ──────────────────────────────────
// Alles PLATZHALTER bis fussball.de-Anbindung / Marvins Pflege.
// FORM = die letzten 5 Ergebnisse, ÄLTESTES zuerst → NEUESTES zuletzt.
export type FormResult = 'W' | 'U' | 'N' // Win / Unentschieden / Niederlage
export const FORM: FormResult[] = ['N', 'U', 'W', 'W', 'W']

// Letztes Spiel (Ergebnis). isPlaceholder → als „zuletzt"-Karte mit Hinweis.
export interface PlayedMatch {
  opponent: string
  date: string
  home: boolean
  goalsFor: number
  goalsAgainst: number
  isPlaceholder?: boolean
}
export const LAST_MATCH: PlayedMatch = {
  opponent: 'SV Musterdorf',
  date: 'So · Ergebnis folgt live',
  home: false,
  goalsFor: 2,
  goalsAgainst: 1,
  isPlaceholder: true,
}

// Tabelle (Vorschau bis Live-Anbindung). self = wir.
export interface TableRow {
  pos: number
  team: string
  sp: number
  pkt: number
  self?: boolean
}
export const TABLE_PREVIEW: TableRow[] = [
  { pos: 1, team: 'TuS Beispielstadt', sp: 18, pkt: 44 },
  { pos: 2, team: 'SV Musterdorf', sp: 18, pkt: 40 },
  { pos: 3, team: 'SV Agathenburg-Dollern', sp: 18, pkt: 37, self: true },
  { pos: 4, team: 'FC Nachbarort', sp: 18, pkt: 33 },
  { pos: 5, team: 'SG Beispieltal', sp: 18, pkt: 29 },
]

// ── Vereins-/Mannschaftsfoto-Slot (v8-E5) ────────────────────
// undefined → kein leerer Rahmen. Marvin liefert echtes Stimmungsbild.
export const TEAM_PHOTO: string | undefined = undefined

// ── Fanblock: Meisterfeier-Foto-Kacheln (v11-E7) ─────────────
// Echte Fotos nach public/fanblock/<name>.webp legen und `src` setzen.
// src leer → gestaltete „Foto folgt"-Kachel (kein leerer Rahmen), damit
// die Galerie schon jetzt vollständig & gewollt wirkt. Caption bleibt.
export interface FanPhoto {
  src?: string
  caption: string
  tag: string // Rahmung, z. B. „Meister 2024"
}
export const FAN_PHOTOS: FanPhoto[] = [
  { caption: 'Aufstieg gefeiert, Platz gestürmt', tag: 'Meister 2024' },
  { caption: 'Der Schlusspfiff, der alles verändert hat', tag: 'Das letzte Tor' },
  { caption: 'Dritte Halbzeit im Vereinsheim', tag: 'Nach dem Spiel' },
  { caption: 'Die Kurve bei Flutlicht', tag: 'Südkurve' },
  { caption: 'Pokal in der Luft', tag: 'Meister 2024' },
  { caption: 'Schals hoch, Stimme kaputt', tag: 'Heimspiel' },
]

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
  // PLATZHALTER (Marvin trägt die echte Vereins-/Ansprechpartner-Nummer
  // ein, internationales Format ohne + und ohne führende 0).
  whatsapp: '491700000000',
} as const

// wa.me-Deeplink mit vorformulierter Nachricht (v9-E4, Sponsoren-CTA).
export function whatsappUrl(text: string): string {
  return `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`
}
