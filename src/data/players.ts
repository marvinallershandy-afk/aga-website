// ─────────────────────────────────────────────────────────────
// Seed-Daten Kader. v2-ready: dieses Interface ist bewusst so
// getypt, dass ein Umzug nach Supabase ein reines Mapping ist
// (id als string/uuid, alle Felder flach, optionale Foto-URL).
// PLATZHALTER — echte Namen/Fotos trägt Marvin nach.
// ─────────────────────────────────────────────────────────────

export type Position = 'TW' | 'ABW' | 'MIT' | 'ANG'

export interface Player {
  id: string
  name: string
  number: number
  position: Position
  /** Foto-URL (v2). null → generische Silhouette. */
  photoUrl: string | null
  stats: {
    games: number
    goals: number
    assists: number
  }
  /** UT-Style Gesamtrating 0–99 (aus Stats abgeleitet oder gepflegt). */
  rating: number
  /** Optional: Nationalitäts-/Herkunfts-Flag (v2). */
  since: number // Jahr im Verein seit
  /** Team-des-Monats: hebt die Karte auf das Spezial-Level. */
  isPlayerOfMonth?: boolean
}

export const POSITION_LABEL: Record<Position, string> = {
  TW: 'Torwart',
  ABW: 'Abwehr',
  MIT: 'Mittelfeld',
  ANG: 'Angriff',
}

// ── Trainerstab (v10-E2) ─────────────────────────────────────
// Eigene Kategorie — KEINE Spieler-Stats (Rating/Tore/Assists), sondern
// Rolle + „seit im Verein". Carsten ist TRAINER (im Foto Trainer-Polo),
// war fälschlich als Angreifer im Kader. Co-Trainer/Teammanager als Slots
// vorbereitet (Marvin trägt echte Namen/Fotos nach, s. README).
export type StaffRole = 'trainer' | 'co-trainer' | 'teammanager'

export interface Staff {
  id: string
  name: string
  role: StaffRole
  since: number
  photoUrl: string | null
  /** Nur Teammanager: vorformulierte WhatsApp-Nachricht für „Schreib mir". */
  contactMessage?: string
}

export const ROLE_LABEL: Record<StaffRole, string> = {
  trainer: 'Trainer',
  'co-trainer': 'Co-Trainer',
  teammanager: 'Teammanager',
}

export const STAFF: Staff[] = [
  { id: 's1', name: 'Carsten', role: 'trainer', since: 2016, photoUrl: '/players/carsten.webp' },
  { id: 's2', name: 'Name folgt', role: 'co-trainer', since: 2020, photoUrl: null },
  {
    id: 's3',
    name: 'Name folgt',
    role: 'teammanager',
    since: 2018,
    photoUrl: null,
    contactMessage: 'Hallo! Ich habe eine Frage zum SV Agathenburg-Dollern.',
  },
]

// 16 Kader-Slots. FOTO-PIPELINE (v5): Datei nach Schema
// public/players/<vorname-klein>.webp (Hochformat, Kopf im oberen
// Drittel — Rest macht die Duotone-CSS-Behandlung + Focal oben).
// 5 echte Beispiel-Spieler (Vorname = Dateiname aus
// REFERENZ/Spielerfotos/); Nachnamen bewusst weggelassen, bis
// Marvin sie freigibt. Rest: generische Platzhalter.
export const PLAYERS: Player[] = [
  { id: 'p01', name: 'Tino', number: 1, position: 'TW', photoUrl: '/players/tino.webp', stats: { games: 22, goals: 0, assists: 1 }, rating: 82, since: 2016 },
  { id: 'p02', name: 'Jonas Berger', number: 2, position: 'ABW', photoUrl: null, stats: { games: 20, goals: 1, assists: 3 }, rating: 74, since: 2019 },
  { id: 'p03', name: 'Lukas Vogt', number: 3, position: 'ABW', photoUrl: null, stats: { games: 24, goals: 0, assists: 2 }, rating: 76, since: 2018 },
  { id: 'p04', name: 'Lennard', number: 4, position: 'ABW', photoUrl: '/players/lennard.webp', stats: { games: 23, goals: 3, assists: 1 }, rating: 78, since: 2017 },
  { id: 'p05', name: 'Erik Hansen', number: 5, position: 'ABW', photoUrl: null, stats: { games: 21, goals: 2, assists: 0 }, rating: 75, since: 2020 },
  { id: 'p06', name: 'Nico Wolff', number: 6, position: 'MIT', photoUrl: null, stats: { games: 25, goals: 4, assists: 7 }, rating: 83, since: 2015 },
  { id: 'p07', name: 'Julio', number: 7, position: 'MIT', photoUrl: '/players/julio.webp', stats: { games: 24, goals: 6, assists: 9 }, rating: 85, since: 2018 },
  { id: 'p08', name: 'Felix Braun', number: 8, position: 'MIT', photoUrl: null, stats: { games: 22, goals: 5, assists: 6 }, rating: 81, since: 2019 },
  // Carsten (ehem. #9) ist Trainer → jetzt im Trainerstab (STAFF), nicht im Kader.
  { id: 'p10', name: 'Eli', number: 10, position: 'ANG', photoUrl: '/players/eli.webp', stats: { games: 24, goals: 14, assists: 11 }, rating: 89, since: 2014, isPlayerOfMonth: true },
  { id: 'p11', name: 'Paul Neumann', number: 11, position: 'ANG', photoUrl: null, stats: { games: 23, goals: 12, assists: 5 }, rating: 84, since: 2021 },
  { id: 'p12', name: 'Jan Köhler', number: 12, position: 'TW', photoUrl: null, stats: { games: 6, goals: 0, assists: 0 }, rating: 70, since: 2022 },
  { id: 'p13', name: 'Moritz Lang', number: 13, position: 'MIT', photoUrl: null, stats: { games: 18, goals: 2, assists: 4 }, rating: 73, since: 2020 },
  { id: 'p14', name: 'Simon Weber', number: 14, position: 'ABW', photoUrl: null, stats: { games: 19, goals: 1, assists: 2 }, rating: 72, since: 2021 },
  { id: 'p15', name: 'Tom Hartmann', number: 15, position: 'ANG', photoUrl: null, stats: { games: 20, goals: 9, assists: 3 }, rating: 79, since: 2019 },
  { id: 'p16', name: 'Kevin Sommer', number: 16, position: 'MIT', photoUrl: null, stats: { games: 21, goals: 3, assists: 8 }, rating: 80, since: 2017 },
]
