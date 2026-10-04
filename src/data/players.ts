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
  /** v14: Freisteller (Alpha-WebP, macOS-Vision aus photoUrl). Für Karten 2.0. */
  cutoutUrl?: string | null
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
  /** v14: Freisteller (Alpha-WebP). */
  cutoutUrl?: string | null
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
  { id: 's-junge', name: 'Carsten Junge', role: 'trainer', since: 2016, photoUrl: '/players/carsten-junge.webp', cutoutUrl: '/players/cutout/carsten-junge.webp' },
  { id: 's-ebeling-a', name: 'Adolf Ebeling', role: 'co-trainer', since: null, photoUrl: '/players/adolf-ebeling.webp', cutoutUrl: '/players/cutout/adolf-ebeling.webp' },
  {
    id: 's-hause',
    name: 'Niko Hause',
    role: 'teammanager',
    since: 2018,
    photoUrl: '/players/niko-hause.webp', cutoutUrl: '/players/cutout/niko-hause.webp',
    contactMessage: 'Hallo Niko! Ich habe eine Frage zum SV Agathenburg-Dollern.',
    isNewSigning: true,
  },
]

// ── Anzeige-Schalter ─────────────────────────────────────────
/**
 * v14-M5: Die Rating-Anzeige ist ausgeblendet, solange es keine echten Werte
 * gibt — sonst stünde auf allen 24 Karten dieselbe 70. Das FELD und die Daten
 * bleiben unverändert, nur die Darstellung entfällt (Kartentextur, Holo-Karte,
 * Detail-Modal, Story-Export). Sobald die Mannschaftsabstimmung echte Werte
 * liefert: hier auf true — mehr ist nicht nötig.
 */
export const SHOW_RATING = false

// ── Platzhalter-Werte ────────────────────────────────────────
// EIN neutraler Rating-Wert für alle. Bewusst kein je Spieler erfundener
// Wert: das wäre eine öffentlich sichtbare Leistungsbewertung realer,
// namentlich genannter Personen. Marvins Rating-Entscheidung steht aus.
const RATING_TBD = 70
// Keine Saisonzahlen vorhanden → alles 0 statt geschätzt. Wirkt sich auf den
// Top-Torschützen-Block im Saison-Cockpit aus (FussballWidget.tsx:92).
const STATS_TBD = { games: 0, goals: 0, assists: 0 }

// FOTOS: public/players/<vorname-nachname>.webp aus AGA_FOTOS_FERTIG.zip
// (11.08.2026). Die Zuordnung stammt ausschließlich aus der mitgelieferten
// zuordnung.json und wurde über den NAMEN abgeglichen, nicht über Dateinamen
// abgeleitet — die alten Kurznamen-Dateien waren teils falsch zugeordnet.
// 21 Spieler haben ein Foto, drei bewusst nicht (Litwitz, Jochim, Viedts);
// dort ist der Wappen-Fallback richtig.
export const PLAYERS: Player[] = [
  // ── Torwart ────────────────────────────────────────────────
  { id: 'p-pils', name: 'Malte Pils', number: 1, position: 'TW', photoUrl: '/players/malte-pils.webp', cutoutUrl: '/players/cutout/malte-pils.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-ebeling-t', name: 'Tino Ebeling', number: 38, position: 'TW', photoUrl: '/players/tino-ebeling.webp', cutoutUrl: '/players/cutout/tino-ebeling.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },

  // ── Abwehr ─────────────────────────────────────────────────
  { id: 'p-huettry', name: 'Justin Hüttry', number: 3, position: 'ABW', photoUrl: '/players/justin-huettry.webp', cutoutUrl: '/players/cutout/justin-huettry.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-brettschneider', name: 'Lennard Brettschneider', number: 4, position: 'ABW', photoUrl: '/players/lennard-brettschneider.webp', cutoutUrl: '/players/cutout/lennard-brettschneider.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-sladek', name: 'Justin Sladek', number: 11, position: 'ABW', photoUrl: '/players/justin-sladek.webp', cutoutUrl: '/players/cutout/justin-sladek.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-neuber-m', name: 'Marcel Neuber', number: 14, position: 'ABW', photoUrl: '/players/marcel-neuber.webp', cutoutUrl: '/players/cutout/marcel-neuber.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-nauerz', name: 'Noel Nauerz', number: 15, position: 'ABW', photoUrl: '/players/noel-nauerz.webp', cutoutUrl: '/players/cutout/noel-nauerz.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-neuber-d', name: 'Dawid Neuber', number: 21, position: 'ABW', photoUrl: '/players/dawid-neuber.webp', cutoutUrl: '/players/cutout/dawid-neuber.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-marchel', name: 'Oliver Marchel', number: 29, position: 'ABW', photoUrl: '/players/oliver-marchel.webp', cutoutUrl: '/players/cutout/oliver-marchel.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-elsen', name: 'Joshua Elsen', number: 32, position: 'ABW', photoUrl: '/players/joshua-elsen.webp', cutoutUrl: '/players/cutout/joshua-elsen.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  // Im Kader ohne feste Rückennummer geführt.
  { id: 'p-warkehr-i', name: 'Isaak Warkehr', number: null, position: 'ABW', photoUrl: '/players/isaak-warkehr.webp', cutoutUrl: '/players/cutout/isaak-warkehr.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },

  // ── Mittelfeld ─────────────────────────────────────────────
  { id: 'p-litwitz', name: 'Lukas-Alexander Litwitz', number: 5, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },
  { id: 'p-paruzel', name: 'Julio Paruzel', number: 7, position: 'MIT', photoUrl: '/players/julio-paruzel.webp', cutoutUrl: '/players/cutout/julio-paruzel.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-becker', name: 'Niclas Becker', number: 8, position: 'MIT', photoUrl: '/players/niclas-becker.webp', cutoutUrl: '/players/cutout/niclas-becker.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-kalwa', name: 'Justin Kalwa', number: 13, position: 'MIT', photoUrl: '/players/justin-kalwa.webp', cutoutUrl: '/players/cutout/justin-kalwa.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-jochim', name: 'Sam Luca Jochim', number: 17, position: 'MIT', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },
  { id: 'p-pejas-n', name: 'Noah Pejas', number: 20, position: 'MIT', photoUrl: '/players/noah-pejas.webp', cutoutUrl: '/players/cutout/noah-pejas.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-pejas-e', name: 'Elias Pejas', number: 22, position: 'MIT', photoUrl: '/players/elias-pejas.webp', cutoutUrl: '/players/cutout/elias-pejas.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-helck', name: 'Tobias Helck', number: 24, position: 'MIT', photoUrl: '/players/tobias-helck.webp', cutoutUrl: '/players/cutout/tobias-helck.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isCaptain: true },
  { id: 'p-bruenjes', name: 'Janek Brünjes', number: 33, position: 'MIT', photoUrl: '/players/janek-bruenjes.webp', cutoutUrl: '/players/cutout/janek-bruenjes.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-matthes', name: 'Paul Matthes', number: 44, position: 'MIT', photoUrl: '/players/paul-matthes.webp', cutoutUrl: '/players/cutout/paul-matthes.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },

  // ── Angriff ────────────────────────────────────────────────
  { id: 'p-warkehr-a', name: 'Aaron Warkehr', number: 6, position: 'ANG', photoUrl: '/players/aaron-warkehr.webp', cutoutUrl: '/players/cutout/aaron-warkehr.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-viedts', name: 'Lennox Viedts', number: 10, position: 'ANG', photoUrl: null, stats: { ...STATS_TBD }, rating: RATING_TBD, since: null },
  { id: 'p-biedermann', name: 'Marc Kevin Biedermann', number: 37, position: 'ANG', photoUrl: '/players/marc-kevin-biedermann.webp', cutoutUrl: '/players/cutout/marc-kevin-biedermann.webp', stats: { ...STATS_TBD }, rating: RATING_TBD, since: null, isNewSigning: true },
]
