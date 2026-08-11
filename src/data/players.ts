// ─────────────────────────────────────────────────────────────
// Kader SV Agathenburg-Dollern, 1. Herren.
// Stand: Kreisliga Stade, Saison 26/27. Quelle: fupa.net (von Marvin
// übermittelt, 11.08.2026). Namen und Rückennummern sind ECHT.
//
// Was hier bewusst NICHT steht (siehe Kommentare an den Feldern):
// Spielstatistiken, Ratings und Vereinszugehörigkeit. Für diese Angaben
// liegen keine Daten vor. Sie werden NICHT geschätzt, weil sie öffentlich
// sichtbar an namentlich genannten realen Personen hängen.
//
// v2-ready: das Interface ist so getypt, dass ein Umzug nach Supabase ein
// reines Mapping ist (id als string/uuid, alle Felder flach).
// ─────────────────────────────────────────────────────────────

export type Position = 'TW' | 'ABW' | 'MIT' | 'ANG'

export interface Player {
  id: string
  name: string
  /** Rückennummer. null = im Kader ohne feste Nummer geführt. */
  number: number | null
  position: Position
  /** Foto-URL. null → Fallback: Wappen-Wasserzeichen + große Nummer. */
  photoUrl: string | null
  stats: {
    games: number
    goals: number
    assists: number
  }
  /** UT-Style Gesamtrating 0–99. */
  rating: number
  /** Jahr im Verein seit. null = nicht bekannt. */
  since: number | null
  /** Team-des-Monats: hebt die Karte auf das Spezial-Level. */
  isPlayerOfMonth?: boolean
  /** Mannschaftskapitän. */
  isCaptain?: boolean
  /** Neuzugang zur laufenden Saison — für spätere visuelle Hervorhebung. */
  isNewSigning?: boolean
}

export const POSITION_LABEL: Record<Position, string> = {
  TW: 'Torwart',
  ABW: 'Abwehr',
  MIT: 'Mittelfeld',
  ANG: 'Angriff',
}

// ── Trainerstab ──────────────────────────────────────────────
// Eigene Kategorie — KEINE Spieler-Stats (Rating/Tore/Assists), sondern
// Rolle + „seit im Verein".
export type StaffRole = 'trainer' | 'co-trainer' | 'torwart-trainer' | 'teammanager'

export interface Staff {
  id: string
  name: string
  role: StaffRole
  since: number | null
  photoUrl: string | null
  /** Nur Teammanager: vorformulierte WhatsApp-Nachricht für „Schreib mir". */
  contactMessage?: string
  /** v13-E6: true → Slot ohne echten Namen. Bleibt im DOM-Stab-Block
   *  (ehrlich markiert), fliegt aber von der prominenten 3D-Seitenlinie. */
  isPlaceholder?: boolean
  /** Neu im Amt zur laufenden Saison. */
  isNewSigning?: boolean
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  trainer: 'Trainer',
  'co-trainer': 'Co-Trainer',
  'torwart-trainer': 'Torwart-Trainer',
  teammanager: 'Teammanager',
}

export const STAFF: Staff[] = [
  { id: 's-junge', name: 'Carsten Junge', role: 'trainer', since: 2016, photoUrl: '/players/carsten.webp' },
  { id: 's-ebeling-a', name: 'Adolf Ebeling', role: 'co-trainer', since: null, photoUrl: null },
  { id: 's-duda', name: 'Torsten Duda', role: 'torwart-trainer', since: null, photoUrl: null },
  {
    id: 's-hause',
    // Foto ist Marvins CI-Porträt (rot, Wappen, #30); ein freigestelltes
    // Cutout kann es später ersetzen.
    name: 'Niko Hause',
    role: 'teammanager',
    since: 2018,
    photoUrl: '/players/nico-hause.webp',
    contactMessage: 'Hallo Niko! Ich habe eine Frage zum SV Agathenburg-Dollern.',
    isNewSigning: true,
  },
]

// ── Platzhalter-Werte ────────────────────────────────────────
// EIN neutraler Rating-Wert für alle. Bewusst kein je Spieler erfundener
// Wert: das wäre eine öffentlich sichtbare Leistungsbewertung realer,
// namentlich genannter Personen. Marvins Rating-Entscheidung steht aus.
const RATING_TBD = 70
// Keine Saisonzahlen vorhanden → alles 0 statt geschätzt. Wirkt sich auf den
// Top-Torschützen-Block im Saison-Cockpit aus (FussballWidget.tsx:92).
const STATS_TBD = { games: 0, goals: 0, assists: 0 }

// FOTO-PIPELINE: Datei nach Schema public/players/<vorname-klein>.webp
// (Hochformat, Kopf im oberen Drittel). Vorhanden sind bisher 4 Spielerfotos
// aus der Zuordnung der alten Kurznamen — die restlichen Karten laufen auf
// den Wappen+Nummer-Fallback.
export const PLAYERS: Player[] = [
  // ── Torwart ────────────────────────────────────────────────
  { id: 'p-pils', name: 'Malte Pils', number: 1, position: 'TW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-ebeling-t', name: 'Tino Ebeling', number: 38, position: 'TW', photoUrl: '/players/tino.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },

  // ── Abwehr ─────────────────────────────────────────────────
  { id: 'p-huettry', name: 'Justin Hüttry', number: 3, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-brettschneider', name: 'Lennard Brettschneider', number: 4, position: 'ABW', photoUrl: '/players/lennard.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-sladek', name: 'Justin Sladek', number: 11, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-neuber-m', name: 'Marcel Neuber', number: 14, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-nauerz', name: 'Noel Nauerz', number: 15, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-neuber-d', name: 'Dawid Neuber', number: 21, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-marchel', name: 'Oliver Marchel', number: 29, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-elsen', name: 'Joshua Elsen', number: 32, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  // Im Kader ohne feste Rückennummer geführt.
  { id: 'p-warkehr-i', name: 'Isaak Warkehr', number: null, position: 'ABW', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },

  // ── Mittelfeld ─────────────────────────────────────────────
  { id: 'p-litwitz', name: 'Lukas-Alexander Litwitz', number: 5, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },
  { id: 'p-paruzel', name: 'Julio Paruzel', number: 7, position: 'MIT', photoUrl: '/players/julio.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-becker', name: 'Niclas Becker', number: 8, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-kalwa', name: 'Justin Kalwa', number: 13, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-jochim', name: 'Sam Luca Jochim', number: 17, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },
  { id: 'p-pejas-n', name: 'Noah Pejas', number: 20, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  // Foto-Zuordnung aus dem alten Kurznamen „Eli" — bitte bestätigen.
  { id: 'p-pejas-e', name: 'Elias Pejas', number: 22, position: 'MIT', photoUrl: '/players/eli.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-helck', name: 'Tobias Helck', number: 24, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isCaptain: true },
  { id: 'p-bruenjes', name: 'Janek Brünjes', number: 33, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-matthes', name: 'Paul Matthes', number: 44, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },

  // ── Angriff ────────────────────────────────────────────────
  { id: 'p-warkehr-a', name: 'Aaron Warkehr', number: 6, position: 'ANG', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-viedts', name: 'Lennox Viedts', number: 10, position: 'ANG', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-biedermann', name: 'Marc Kevin Biedermann', number: 37, position: 'ANG', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },
]
