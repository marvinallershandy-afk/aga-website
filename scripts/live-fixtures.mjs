// v15-L: Beispiel-Antworten von web_live() für Screenshots/Tests
// (scripts/live-audit.mjs). Echte Kader-slugs + Fotos aus public/players/.
const KADER = [
  ['p-pils', 'Malte Pils', 1, 'TW', 'malte-pils'], ['p-ebeling-t', 'Tino Ebeling', 38, 'TW', 'tino-ebeling'],
  ['p-huettry', 'Justin Hüttry', 3, 'ABW', 'justin-huettry'], ['p-brettschneider', 'Lennard Brettschneider', 4, 'ABW', 'lennard-brettschneider'],
  ['p-sladek', 'Justin Sladek', 11, 'ABW', 'justin-sladek'], ['p-neuber-m', 'Marcel Neuber', 14, 'ABW', 'marcel-neuber'],
  ['p-nauerz', 'Noel Nauerz', 15, 'ABW', 'noel-nauerz'], ['p-elsen', 'Joshua Elsen', 32, 'ABW', 'joshua-elsen'],
  ['p-paruzel', 'Julio Paruzel', 7, 'MIT', 'julio-paruzel'], ['p-becker', 'Niclas Becker', 8, 'MIT', 'niclas-becker'],
  ['p-kalwa', 'Justin Kalwa', 13, 'MIT', 'justin-kalwa'], ['p-pejas-n', 'Noah Pejas', 20, 'MIT', 'noah-pejas'],
  ['p-pejas-e', 'Elias Pejas', 22, 'MIT', 'elias-pejas'], ['p-helck', 'Tobias Helck', 24, 'MIT', 'tobias-helck'],
  ['p-bruenjes', 'Janek Brünjes', 33, 'MIT', 'janek-bruenjes'], ['p-warkehr-a', 'Aaron Warkehr', 6, 'ANG', 'aaron-warkehr'],
  ['p-biedermann', 'Marc Kevin Biedermann', 37, 'ANG', 'marc-kevin-biedermann'],
]
export const PLAYERS = KADER.map(([id, name, number, position, foto]) => ({
  id, name, number, position, photoUrl: `/players/${foto}.webp`, cutoutUrl: `/players/cutout/${foto}.webp`, ...(id === 'p-helck' ? { isCaptain: true } : {}),
}))
const STAFF = [
  { id: 's-junge', name: 'Carsten Junge', role: 'trainer', photoUrl: '/players/carsten-junge.webp', cutoutUrl: '/players/cutout/carsten-junge.webp' },
  { id: 's-ebeling-a', name: 'Adolf Ebeling', role: 'co-trainer', photoUrl: '/players/adolf-ebeling.webp', cutoutUrl: '/players/cutout/adolf-ebeling.webp' },
]
const LINEUP = {
  formation: '4-4-2',
  startelf: ['p-pils', 'p-sladek', 'p-brettschneider', 'p-neuber-m', 'p-huettry', 'p-kalwa', 'p-helck', 'p-becker', 'p-paruzel', 'p-warkehr-a', 'p-biedermann'],
  bank: ['p-ebeling-t', 'p-nauerz', 'p-elsen', 'p-pejas-n', 'p-pejas-e', 'p-bruenjes'],
  forMatch: true, matchLabel: 'vs TuS Fischbek · 05.10.', updatedAt: new Date().toISOString(),
}
const SETTINGS = {
  address: 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg',
  fussballDeTeamId: '02EP29CA1O000000VS5489B2VVP292BR',
  fupaUrl: 'https://www.fupa.net/team/sv-agathenburg-dollern-m1-2026-27',
  widgetTabelle: '02EP29CA1O000000VS5489B2VVP292BR',
}
const PREV = { opponent: 'VfL Horneburg', home: false, kickoff: new Date(Date.now() - 7 * 864e5).toISOString(), goalsFor: 3, goalsAgainst: 1 }

const iso = (minAgo) => new Date(Date.now() - minAgo * 60000).toISOString()
let n = 0
const ev = (type, minute, minAgo, extra = {}) => ({ id: `e${++n}-${type}`, type, minute, at: iso(minAgo), ...extra })

// v23-L: Kreisliga-Konferenz + live gerechnete Tabelle + Tipp-Kurzkennzahl.
const CONFERENCE = {
  spieltag: 9,
  stimmt: true,
  spiele: [
    { fupaId: 901, heim: 'Agathenb./Do', gast: 'Fischbek', heimSlug: 'sva', gastSlug: 'fis', toreHeim: 2, toreGast: 1, section: 'LIVE', minute: 51, nachspielzeit: null, tickerTyp: 'live', anstoss: iso(55), url: 'https://www.fupa.net/match/901', sva: true },
    { fupaId: 902, heim: 'Horneburg', gast: 'Buxtehude', heimSlug: 'hor', gastSlug: 'bux', toreHeim: 1, toreGast: 1, section: 'LIVE', minute: 54, nachspielzeit: null, tickerTyp: 'live', anstoss: iso(58), url: 'https://www.fupa.net/match/902', sva: false },
    { fupaId: 903, heim: 'SG Lühe', gast: 'Dollern II', heimSlug: 'lue', gastSlug: 'do2', toreHeim: 0, toreGast: 3, section: 'LIVE', minute: 49, nachspielzeit: null, tickerTyp: 'live', anstoss: iso(52), url: 'https://www.fupa.net/match/903', sva: false },
    { fupaId: 904, heim: 'Jork', gast: 'Stade', heimSlug: 'jor', gastSlug: 'sta', toreHeim: 2, toreGast: 0, section: 'POST', minute: null, nachspielzeit: null, tickerTyp: 'live', anstoss: iso(120), url: 'https://www.fupa.net/match/904', sva: false },
    { fupaId: 906, heim: 'Ahlerstedt', gast: 'Deinste', heimSlug: 'ahl', gastSlug: 'dei', toreHeim: null, toreGast: null, section: 'PRE', minute: null, nachspielzeit: null, tickerTyp: null, anstoss: new Date(Date.now() + 36e5).toISOString(), url: 'https://www.fupa.net/match/906', sva: false },
  ],
  zeilen: [
    { platz: 1, team: 'TuS Jork', slug: 'jor', sp: 9, s: 8, u: 1, n: 0, tore: 24, gegen: 7, diff: 17, pkt: 25, live: false, trend: 0 },
    { platz: 2, team: 'VfL Horneburg', slug: 'hor', sp: 9, s: 7, u: 1, n: 1, tore: 20, gegen: 10, diff: 10, pkt: 22, live: true, trend: 1 },
    { platz: 3, team: 'SV Agathenburg-Dollern', slug: 'sva', sp: 9, s: 5, u: 2, n: 2, tore: 18, gegen: 12, diff: 6, pkt: 17, live: true, self: true, trend: 2 },
    { platz: 4, team: 'Buxtehuder SV', slug: 'bux', sp: 9, s: 4, u: 3, n: 2, tore: 16, gegen: 13, diff: 3, pkt: 15, live: true, trend: -1 },
    { platz: 5, team: 'TuS Fischbek', slug: 'fis', sp: 9, s: 4, u: 2, n: 3, tore: 14, gegen: 13, diff: 1, pkt: 14, live: true, trend: 0 },
    { platz: 6, team: 'SG Lühe', slug: 'lue', sp: 9, s: 3, u: 1, n: 5, tore: 11, gegen: 17, diff: -6, pkt: 10, live: true, trend: -1 },
  ],
}
const TIPP = { tipps: 312, sieg: 58, remis: 24, niederlage: 18 }

/** state: vorher | live | halbzeit | beendet | keins | fupa */
export function liveFixture(state) {
  n = 0
  const base = {
    version: 2, serverNow: new Date().toISOString(), players: PLAYERS, staff: STAFF, previous: PREV, settings: SETTINGS,
    reactions: null, conference: null, tipp: null,
  }
  const match = {
    id: 'sp2', opponent: 'TuS Fischbek', home: true, venue: 'Waldsportplatz Agathenburg', competition: 'Kreisliga Stade', matchday: 9,
  }
  if (state === 'keins') return { ...base, match: null, events: [], lineup: null, staff: [] }
  if (state === 'vorher') {
    return { ...base, match: { ...match, kickoff: new Date(Date.now() + 26 * 3600e3 + 754e3).toISOString(), status: 'geplant', goalsFor: 0, goalsAgainst: 0 }, events: [], lineup: { ...LINEUP, forMatch: false } }
  }
  const anpfiff = 67
  const events1 = [
    ev('anpfiff', 1, anpfiff),
    ev('kommentar', 4, anpfiff - 4, { text: 'Fischbek mit viel Ballbesitz, wir stehen kompakt.' }),
    ev('tor', 12, anpfiff - 12, { player: 'p-warkehr-a', player2: 'p-paruzel', text: 'Flanke Paruzel, Warkehr köpft ins lange Eck!' }),
    ev('gelb', 23, anpfiff - 24, { player: 'p-neuber-m', text: 'Taktisches Foul im Mittelfeld.' }),
    ev('gegentor', 31, anpfiff - 32, { text: 'Abgefälschter Schuss aus 18 Metern, keine Chance für Pils.' }),
    ev('elfmeter', 40, anpfiff - 41, { text: 'Elfmeter für Fischbek — Pils hält!' }),
  ]
  if (state === 'halbzeit') {
    const ev2 = [...events1, ev('halbzeit', 45, 1, { extra: 2 })]
    return { ...base, match: { ...match, kickoff: iso(48), status: 'halbzeit', half: 1, minute: 45, anpfiffAt: iso(48), goalsFor: 1, goalsAgainst: 1 }, events: ev2.reverse(), lineup: LINEUP }
  }
  const events2 = [
    ...events1,
    ev('halbzeit', 45, 20, { extra: 1, text: 'Leistungsgerechtes 1:1 zur Pause.' }),
    ev('wiederanpfiff', 46, 5),
    ev('wechsel', 46, 5, { player: 'p-pejas-n', player2: 'p-kalwa' }),
  ]
  if (state === 'live') {
    const evs = [...events2, ev('tor', 51, 0.5, { player: 'p-biedermann', player2: 'p-helck', text: 'Biedermann eiskalt ins kurze Eck — 2:1!' })]
    return {
      ...base,
      match: { ...match, kickoff: iso(anpfiff + 2), status: 'live', half: 2, minute: 51, anpfiffAt: iso(anpfiff), wiederanpfiffAt: iso(5.6), goalsFor: 2, goalsAgainst: 1 },
      events: evs.reverse(), lineup: LINEUP,
    }
  }
  if (state === 'fupa') {
    // v23-L: Spiel vom FuPa-Live-Bot getickert — Bot-Zeilen (Quelle FuPa),
    // Gegner-Ereignisse per fupa_name, ein Platzhalter-Tor, Reporter- vs.
    // Vorlagen-Text, Reaktionen, Konferenz, Live-Tabelle, Tipp-Kurz.
    const b = (type, minute, minAgo, extra = {}) => ev(type, minute, minAgo, { source: 'fupa', ...extra })
    const evs = [
      b('anpfiff', 1, anpfiff),
      b('tor', 12, anpfiff - 12, { player: 'p-warkehr-a', player2: 'p-paruzel', team: 'sva', textSource: 'vorlage', zusatz: 'Kopfball' }),
      b('gelb', 23, anpfiff - 24, { team: 'gegner', name: 'M. Rodenburg', textSource: 'vorlage' }),
      b('gegentor', 31, anpfiff - 32, { team: 'gegner', name: 'T. Klein', textSource: 'reporter', text: 'Abgefälschter Schuss aus 18 Metern, keine Chance für Pils.' }),
      b('halbzeit', 45, 20, { extra: 1 }),
      b('wiederanpfiff', 46, 18),
      b('wechsel', 46, 17, { player: 'p-pejas-n', player2: 'p-kalwa', team: 'sva', textSource: 'vorlage' }),
      b('wechsel_gegner', 60, 10, { team: 'gegner', name: 'L. Sommer', name2: 'J. Born', textSource: 'vorlage' }),
      b('tor', 62, 5, { placeholder: true, team: 'sva', textSource: 'vorlage' }),
    ]
    const torId = evs.find((e) => e.type === 'tor' && e.player === 'p-warkehr-a').id
    const gegentorId = evs.find((e) => e.type === 'gegentor').id
    const reactions = { [torId]: { tor: 14, feuer: 9, applaus: 5 }, [gegentorId]: { schock: 7, wut: 3 } }
    return {
      ...base,
      match: {
        ...match, kickoff: iso(anpfiff + 2), status: 'live', half: 2, minute: 62,
        anpfiffAt: iso(anpfiff), wiederanpfiffAt: iso(18), goalsFor: 2, goalsAgainst: 1,
        source: 'fupa', fupaUrl: 'https://www.fupa.net/match/901', fupaAutor: 'Niko Hause',
      },
      events: evs.reverse(), lineup: LINEUP, reactions, conference: CONFERENCE, tipp: TIPP,
    }
  }
  // beendet
  const evs = [
    ...events2,
    ev('tor', 51, -40, { player: 'p-biedermann', player2: 'p-helck', text: 'Biedermann eiskalt ins kurze Eck — 2:1!' }),
    ev('wechsel', 70, -60, { player: 'p-bruenjes', player2: 'p-warkehr-a' }),
    ev('rot', 84, -75, { text: 'Rot für die Nummer 5 von Fischbek nach Notbremse.' }),
    ev('tor', 89, -80, { player: 'p-bruenjes', text: 'Konter, Brünjes macht den Deckel drauf.' }),
    ev('abpfiff', 90, -84, { extra: 4, text: 'Aus, aus, das Spiel ist aus! Drei Punkte bleiben am Waldsportplatz.' }),
  ]
  return {
    ...base,
    serverNow: new Date(Date.now() + 90 * 60000).toISOString(),
    match: { ...match, kickoff: iso(anpfiff + 2), status: 'beendet', anpfiffAt: iso(anpfiff), wiederanpfiffAt: iso(5), goalsFor: 3, goalsAgainst: 1, motm: 'p-biedermann' },
    events: evs.reverse(), lineup: LINEUP, previous: PREV,
  }
}
