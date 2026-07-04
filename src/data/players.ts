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
}

export const POSITION_LABEL: Record<Position, string> = {
  TW: 'Torwart',
  ABW: 'Abwehr',
  MIT: 'Mittelfeld',
  ANG: 'Angriff',
}

// 16 Platzhalter-Spieler — generische Namen, plausible Amateur-Stats.
export const PLAYERS: Player[] = [
  { id: 'p01', name: 'Max Mustermann', number: 1, position: 'TW', photoUrl: null, stats: { games: 22, goals: 0, assists: 1 }, rating: 82, since: 2016 },
  { id: 'p02', name: 'Jonas Berger', number: 2, position: 'ABW', photoUrl: null, stats: { games: 20, goals: 1, assists: 3 }, rating: 74, since: 2019 },
  { id: 'p03', name: 'Lukas Vogt', number: 3, position: 'ABW', photoUrl: null, stats: { games: 24, goals: 0, assists: 2 }, rating: 76, since: 2018 },
  { id: 'p04', name: 'Timo Kraus', number: 4, position: 'ABW', photoUrl: null, stats: { games: 23, goals: 3, assists: 1 }, rating: 78, since: 2017 },
  { id: 'p05', name: 'Erik Hansen', number: 5, position: 'ABW', photoUrl: null, stats: { games: 21, goals: 2, assists: 0 }, rating: 75, since: 2020 },
  { id: 'p06', name: 'Nico Wolff', number: 6, position: 'MIT', photoUrl: null, stats: { games: 25, goals: 4, assists: 7 }, rating: 83, since: 2015 },
  { id: 'p07', name: 'David Schulz', number: 7, position: 'MIT', photoUrl: null, stats: { games: 24, goals: 6, assists: 9 }, rating: 85, since: 2018 },
  { id: 'p08', name: 'Felix Braun', number: 8, position: 'MIT', photoUrl: null, stats: { games: 22, goals: 5, assists: 6 }, rating: 81, since: 2019 },
  { id: 'p09', name: 'Ben Richter', number: 9, position: 'ANG', photoUrl: null, stats: { games: 25, goals: 18, assists: 4 }, rating: 88, since: 2016 },
  { id: 'p10', name: 'Leon Fischer', number: 10, position: 'ANG', photoUrl: null, stats: { games: 24, goals: 14, assists: 11 }, rating: 89, since: 2014 },
  { id: 'p11', name: 'Paul Neumann', number: 11, position: 'ANG', photoUrl: null, stats: { games: 23, goals: 12, assists: 5 }, rating: 84, since: 2021 },
  { id: 'p12', name: 'Jan Köhler', number: 12, position: 'TW', photoUrl: null, stats: { games: 6, goals: 0, assists: 0 }, rating: 70, since: 2022 },
  { id: 'p13', name: 'Moritz Lang', number: 13, position: 'MIT', photoUrl: null, stats: { games: 18, goals: 2, assists: 4 }, rating: 73, since: 2020 },
  { id: 'p14', name: 'Simon Weber', number: 14, position: 'ABW', photoUrl: null, stats: { games: 19, goals: 1, assists: 2 }, rating: 72, since: 2021 },
  { id: 'p15', name: 'Tom Hartmann', number: 15, position: 'ANG', photoUrl: null, stats: { games: 20, goals: 9, assists: 3 }, rating: 79, since: 2019 },
  { id: 'p16', name: 'Kevin Sommer', number: 16, position: 'MIT', photoUrl: null, stats: { games: 21, goals: 3, assists: 8 }, rating: 80, since: 2017 },
]
