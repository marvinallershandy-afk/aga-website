// v20-T: Beispiel-Antworten der Tipp-Liga-RPCs für Screenshots/Prüfungen
// (scripts/tippen-audit.mjs, scripts/tippliga-admin-audit.mjs).
// Echter Kader (slugs + Fotos aus public/players/), erfundene Fans.
const KADER_ROH = [
  ['p-pils', 'Malte Pils', 1, 'TW', 'malte-pils', 11, 0], ['p-ebeling-t', 'Tino Ebeling', 38, 'TW', 'tino-ebeling', 1, 0],
  ['p-huettry', 'Justin Hüttry', 3, 'ABW', 'justin-huettry', 10, 1], ['p-brettschneider', 'Lennard Brettschneider', 4, 'ABW', 'lennard-brettschneider', 11, 0],
  ['p-sladek', 'Justin Sladek', 11, 'ABW', 'justin-sladek', 9, 0], ['p-neuber-m', 'Marcel Neuber', 14, 'ABW', 'marcel-neuber', 11, 2],
  ['p-nauerz', 'Noel Nauerz', 15, 'ABW', 'noel-nauerz', 4, 0], ['p-elsen', 'Joshua Elsen', 32, 'ABW', 'joshua-elsen', 6, 0],
  ['p-paruzel', 'Julio Paruzel', 7, 'MIT', 'julio-paruzel', 11, 3], ['p-becker', 'Niclas Becker', 8, 'MIT', 'niclas-becker', 10, 1],
  ['p-kalwa', 'Justin Kalwa', 13, 'MIT', 'justin-kalwa', 8, 1], ['p-pejas-n', 'Noah Pejas', 20, 'MIT', 'noah-pejas', 7, 0],
  ['p-pejas-e', 'Elias Pejas', 22, 'MIT', 'elias-pejas', 5, 0], ['p-helck', 'Tobias Helck', 24, 'MIT', 'tobias-helck', 11, 4],
  ['p-bruenjes', 'Janek Brünjes', 33, 'MIT', 'janek-bruenjes', 3, 0], ['p-warkehr-a', 'Aaron Warkehr', 6, 'ANG', 'aaron-warkehr', 11, 7],
  ['p-biedermann', 'Marc Kevin Biedermann', 37, 'ANG', 'marc-kevin-biedermann', 10, 9],
]
export const KADER = KADER_ROH.map(([id, name, nummer, position, foto, spiele, tore]) => ({
  id, name, nummer, position, fotoUrl: `/players/${foto}.webp`, cutoutUrl: `/players/cutout/${foto}.webp`, spiele, tore, ...(id === 'p-helck' ? { kapitaen: true } : {}),
}))

const LOGO = `data:image/svg+xml;utf8,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="420" height="120" viewBox="0 0 420 120"><rect x="6" y="10" width="100" height="100" rx="18" fill="#c2410c"/><text x="56" y="82" font-family="Arial" font-size="58" font-weight="900" fill="#fff" text-anchor="middle">D</text><text x="124" y="80" font-family="Arial" font-size="50" font-weight="900" fill="#f4f2ef">Mr. Döner</text></svg>')}`
const iso = (stundenAbJetzt) => new Date(Date.now() + stundenAbJetzt * 3600e3).toISOString()
const ELF = { spieler: ['p-pils', 'p-helck', 'p-paruzel', 'p-warkehr-a', 'p-biedermann'], kapitaen: 'p-biedermann', frei: false }

export function spielOffen(extra = {}) {
  const anstoss = iso(2 * 24 + 3.2)
  return {
    id: 'sp-offen', gegner: 'TuS Fischbek', heim: true, anstoss, schluss: anstoss, offen: true, wettbewerb: 'Kreisliga Stade', spieltag: 10,
    status: 'geplant', wertung: 'saison', anzahlTipps: 37,
    fragen: [{ key: 'gelb' }, { key: 'tor20' }, { key: 'zuschauer', linie: 60 }],
    ...extra,
  }
}

export function spielLive(extra = {}) {
  const anstoss = iso(-1.1)
  return {
    id: 'sp-live', gegner: 'TSV Apensen', heim: false, anstoss, schluss: anstoss, offen: false, wettbewerb: 'Kreisliga Stade', spieltag: 9,
    status: 'live', wertung: 'saison', toreSva: 2, toreGegner: 1, anzahlTipps: 52,
    fragen: [{ key: 'rot' }, { key: 'erstes_tor' }, { key: 'tore_hz1' }],
    meinTipp: { toreSva: 2, toreGegner: 1, ersterTorschuetze: 'p-biedermann', joker: true, bonus: { rot: 'nein', erstes_tor: 'sva', tore_hz1: '1' } },
    meineElf: ELF,
    ...extra,
  }
}

export function spielGewertet(tageHer = 1, extra = {}) {
  const anstoss = iso(-24 * tageHer)
  return {
    id: 'sp-gewertet', gegner: 'VfL Horneburg', heim: true, anstoss, schluss: anstoss, offen: false, wettbewerb: 'Kreisliga Stade', spieltag: 8,
    status: 'beendet', wertung: 'saison', toreSva: 3, toreGegner: 1, anzahlTipps: 48, gewertetAt: iso(-24 * tageHer + 3),
    fragen: [{ key: 'gelb' }, { key: 'elfmeter' }, { key: 'zuschauer', linie: 55 }],
    aufloesung: { gelb: '1-2', elfmeter: 'nein', zuschauer: 'ueber' },
    motm: 'p-warkehr-a', ersterTorschuetze: 'p-warkehr-a',
    meinTipp: { toreSva: 2, toreGegner: 0, ersterTorschuetze: 'p-warkehr-a', motm: 'p-helck', joker: false, bonus: { gelb: '1-2', elfmeter: 'ja', zuschauer: 'ueber' } },
    meineElf: ELF,
    meinePunkte: {
      tipp: 8, elf: 30, joker: false, gesamt: 38, exakt: false,
      details: {
        tipp: { ergebnis: 3, art: 'differenz', torschuetze: 3, motm: 0, bonus: { gelb: 1, elfmeter: 0, zuschauer: 1 }, bonusSumme: 2, bonusRichtig: 2, summe: 8, joker: false, gesamt: 8 },
        elf: [
          { id: 'p-pils', punkte: 3, gesamt: 3, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }, { k: 'sieg', p: 2 }] },
          { id: 'p-helck', punkte: 6, gesamt: 6, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }, { k: 'vorlage', n: 1, p: 3 }, { k: 'sieg', p: 2 }] },
          { id: 'p-paruzel', punkte: 2, gesamt: 2, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }, { k: 'sieg', p: 2 }, { k: 'gelb', p: -1 }] },
          { id: 'p-warkehr-a', punkte: 13, gesamt: 13, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }, { k: 'tor', n: 1, p: 5 }, { k: 'motm', p: 5 }, { k: 'sieg', p: 2 }] },
          { id: 'p-biedermann', punkte: 3, gesamt: 6, kapitaen: true, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }, { k: 'sieg', p: 2 }] },
        ],
        kapitaenPunkte: 6, hatTipp: true, hatElf: true,
      },
    },
    ...extra,
  }
}

const EINST = (winter = false) => ({
  aktiv: true, elfFrei: true,
  partner: { name: 'Mr. Döner', logoUrl: LOGO },
  preise: 'Spieltagssieger: Döner bei Mr. Döner · Monatssieger: 20-€-Gutschein',
  winterpause: { aktiv: winter, bis: '2027-03-14', von: '11-15' },
})

const ICH = (extra = {}) => ({
  email: 'lena@fan.example',
  profil: { vorname: 'Lena', initial: 'K', anzeigename: 'Lena K.' },
  teilnehmer: { sichtbar: true, kabine: false, seit: iso(-24 * 40) },
  jokerFrei: true,
  abzeichen: [{ key: 'erster_tipp', at: iso(-24 * 40) }, { key: 'hellseher', at: iso(-24 * 10) }, { key: 'kapitaensgriff', at: iso(-24 * 8) }, { key: 'torriecher', at: iso(-24) }],
  statistik: { punkte: 214, spieltage: 8, exakt: 3, beste: 41 },
  tippsGesamt: 8,
  letzteElf: ELF,
  ligen: 2,
  ...extra,
})

/** zustand: gast | neu | getippt | live | aufloesung | winter | frisch-gast */
export function lageFixture(zustand) {
  const base = { version: 1, serverNow: new Date().toISOString(), saison: '2026/27', einstellungen: EINST(zustand === 'winter'), kader: KADER }
  switch (zustand) {
    case 'gast':
      return { ...base, offen: spielOffen(), gewertet: spielGewertet(6, { meinTipp: undefined, meineElf: undefined, meinePunkte: undefined }) }
    case 'neu':
      return { ...base, offen: spielOffen(), gewertet: spielGewertet(6), ich: ICH() }
    case 'getippt':
      return {
        ...base,
        offen: spielOffen({ meinTipp: { toreSva: 2, toreGegner: 1, ersterTorschuetze: 'p-biedermann', motm: 'p-helck', joker: false, bonus: { gelb: '1-2', tor20: 'ja', zuschauer: 'ueber' } }, meineElf: ELF }),
        gewertet: spielGewertet(6),
        ich: ICH(),
      }
    case 'live':
      return { ...base, gesperrt: spielLive(), offen: spielOffen({ anstoss: iso(24 * 7 + 2), schluss: iso(24 * 7 + 2), anzahlTipps: 3, id: 'sp-naechstes', gegner: 'SG Lühe' }), gewertet: spielGewertet(8), ich: ICH() }
    case 'aufloesung':
      return { ...base, offen: spielOffen({ anstoss: iso(24 * 6), schluss: iso(24 * 6), anzahlTipps: 4, gegner: 'FC Mulsum/Kutenholz' }), gewertet: spielGewertet(0.8), ich: ICH() }
    case 'nachspiel':
      // wie live am 06.10.: letztes Spiel beendet, noch nicht gewertet; nächstes offen + schon getippt
      return {
        ...base,
        gesperrt: spielLive({ status: 'beendet', toreSva: 2, toreGegner: 2, anstoss: iso(-44), schluss: iso(-44), meinTipp: undefined, meineElf: undefined, anzahlTipps: 0 }),
        offen: spielOffen({ meinTipp: { toreSva: 2, toreGegner: 1, ersterTorschuetze: 'p-biedermann', joker: false, bonus: { gelb: '1-2', tor20: 'ja', zuschauer: 'ueber' } }, meineElf: ELF, anzahlTipps: 1 }),
        ich: ICH(),
      }
    case 'winter':
      return { ...base, gewertet: spielGewertet(20), ich: ICH() }
    case 'frisch-gast':
      return { ...base, offen: spielOffen() }
    default:
      throw new Error('unbekannter Zustand ' + zustand)
  }
}

const NAMEN = ['Lena K.', 'Tobias H.', 'Ole M.', 'Dodo R.', 'Jannik S.', 'Mia B.', 'Paul W.', 'Finn T.', 'Svenja L.', 'Kai P.', 'Henrik D.', 'Lara F.', 'Ben O.', 'Nele G.', 'Tim A.']
export function ranglisteFixture(art, liga = false) {
  const anzahl = liga ? 7 : NAMEN.length
  const eintraege = NAMEN.slice(0, anzahl).map((name, i) => ({
    platz: i + 1,
    name,
    punkte: Math.round((art === 'spieltag' ? 52 : art === 'monat' ? 140 : 260) * (1 - i * 0.055)),
    exakt: Math.max(0, 4 - Math.floor(i / 3)),
    spiele: art === 'spieltag' ? 1 : 8 - (i % 3),
    trend: art === 'spieltag' ? undefined : [2, 0, -1, 3, -2, 0, 1, -3, 0, 4, -1, 0, 2, -2, 0][i],
    ...(name === 'Tobias H.' || name === 'Jannik S.' ? { kabine: true } : {}),
    ...(name === 'Ole M.' ? { ich: true } : {}),
  }))
  const r = { art, saison: '2026/27', eintraege, ich: eintraege.find((e) => e.ich), teilnehmer: liga ? 7 : 63, schnitt: art === 'spieltag' ? 21.4 : 148.2 }
  if (art === 'spieltag') return { ...r, spielId: 'sp-gewertet', spiel: { gegner: 'VfL Horneburg', heim: true, anstoss: iso(-24), toreSva: 3, toreGegner: 1 } }
  if (art === 'monat') return { ...r, monat: new Date().toISOString().slice(0, 7) }
  return r
}

export const DUELL = {
  spieltag: { spielId: 'sp-gewertet', gegner: 'VfL Horneburg', heim: true, anstoss: iso(-24), fans: 21.4, kabine: 24.8, nFans: 46, nKabine: 9 },
  saison: { saison: '2026/27', fans: 18.6, kabine: 20.1, nFans: 54, nKabine: 11 },
  kabineBester: { name: 'Tobias H.', punkte: 247 },
}

export const VERTEILUNG = {
  n: 52,
  ergebnisse: [{ toreSva: 2, toreGegner: 1, anteil: 31 }, { toreSva: 1, toreGegner: 1, anteil: 17 }, { toreSva: 3, toreGegner: 1, anteil: 12 }],
  tendenz: { sieg: 69, remis: 21, niederlage: 10 },
  elf: [{ spieler: 'p-biedermann', anteil: 84 }, { spieler: 'p-warkehr-a', anteil: 77 }],
  kapitaen: { spieler: 'p-biedermann', anteil: 46 },
  joker: 11,
}

export const LIGEN = [
  { id: 'liga-1', name: 'Dodos Raum', code: 'DODO26', gruender: true, mitglieder: 7, meinPlatz: 3, fuehrender: 'Lena K.' },
  { id: 'liga-2', name: 'Feuerwehr Agathenburg', code: 'FW112X', gruender: false, mitglieder: 14, meinPlatz: 6, fuehrender: 'Henrik D.' },
]

export const LIGA_TIPPS = [
  { name: 'Lena K.', toreSva: 2, toreGegner: 1, joker: true, kapitaen: 'p-biedermann', punkte: 41 },
  { name: 'Dodo R.', toreSva: 3, toreGegner: 0, kapitaen: 'p-warkehr-a', punkte: 33 },
  { name: 'Ole M.', ich: true, toreSva: 1, toreGegner: 1, kapitaen: 'p-helck', punkte: 22 },
  { name: 'Mia B.', toreSva: 2, toreGegner: 2, kapitaen: 'p-biedermann', punkte: 17 },
]

// ── Admin ──────────────────────────────────────────────────
export function berichtFixture() {
  const z = (id, extra) => {
    const k = KADER.find((x) => x.id === id)
    return { id, name: k.name, nummer: k.nummer, position: k.position, eingesetzt: true, minuten: 90, tore: 0, vorlagen: 0, zuNull: false, start: true, ...extra }
  }
  return {
    spiel: { id: 'sp-live', gegner: 'TSV Apensen', heim: false, anstoss: iso(-2.2), status: 'beendet', toreSva: 2, toreGegner: 1, liveSva: 2, liveGegner: 1, motm: null },
    wertung: 'saison', offen: false, gespeichert: false, mitTicker: true, mitAufstellung: true,
    zeilen: [
      z('p-pils'), z('p-huettry'), z('p-brettschneider', { karte: 'gelb' }), z('p-neuber-m'), z('p-sladek', { minuten: 70 }),
      z('p-helck', { vorlagen: 1 }), z('p-paruzel'), z('p-becker', { minuten: 60 }), z('p-kalwa'),
      z('p-warkehr-a', { tore: 1 }), z('p-biedermann', { tore: 1, vorlagen: 1 }),
      z('p-pejas-n', { minuten: 30, start: false }), z('p-nauerz', { minuten: 20, start: false }),
      { ...z('p-elsen'), eingesetzt: false, minuten: null, start: false }, { ...z('p-ebeling-t'), eingesetzt: false, minuten: null, start: false },
    ],
    fragen: [{ key: 'rot' }, { key: 'erstes_tor' }, { key: 'tore_hz1' }],
    aufloesungAuto: { rot: 'nein', erstes_tor: 'sva', tore_hz1: '1', gelb: '1-2', tor20: 'nein', elfmeter: 'nein' },
    aufloesung: { rot: 'nein', erstes_tor: 'sva', tore_hz1: '1', gelb: '1-2', tor20: 'nein', elfmeter: 'nein' },
    ersterTorschuetze: 'p-warkehr-a', ersterAuto: 'p-warkehr-a',
    anzahlTipps: 52, anzahlElf: 47, albumMotm: false,
  }
}

export function adminSpieltage() {
  const s = (id, gegner, heim, h, extra = {}) => ({ id, gegner, heim, anstoss: iso(h), wettbewerb: 'Kreisliga Stade', status: 'geplant', pflichtspiel: true, wertung: 'saison', offen: h > 0, fragen: ['gelb', 'tor20', heim ? 'zuschauer' : 'rot'], fragenAuto: true, linie: heim ? 60 : undefined, linieAuto: true, anzahlTipps: 0, anzahlElf: 0, ...extra })
  return [
    s('sp-gewertet', 'VfL Horneburg', true, -24 * 8, { status: 'beendet', toreSva: 3, toreGegner: 1, gewertetAt: iso(-24 * 8 + 3), berichtAt: iso(-24 * 8 + 2), anzahlTipps: 48, anzahlElf: 44, offen: false }),
    s('sp-live', 'TSV Apensen', false, -2.2, { status: 'beendet', toreSva: 2, toreGegner: 1, anzahlTipps: 52, anzahlElf: 47, offen: false }),
    s('sp-test', 'Blau-Weiß Buxtehude (TEST)', true, 24 * 4, { pflichtspiel: false, wertung: undefined, wettbewerb: 'Testspiel' }),
    s('sp-offen', 'TuS Fischbek', true, 24 * 6, { anzahlTipps: 37, anzahlElf: 30, fragenAuto: false, fragen: ['gelb', 'tor20', 'zuschauer'] }),
    s('sp-naechstes', 'SG Lühe', false, 24 * 13),
  ]
}

export const STORY = {
  partner: { name: 'Mr. Döner', logoUrl: LOGO },
  storyCode: 'AGA-SA7',
  preise: 'Spieltagssieger: Döner bei Mr. Döner',
  offen: { id: 'sp-offen', gegner: 'TuS Fischbek', heim: true, anstoss: iso(24 * 2 + 3), schluss: iso(24 * 2 + 3), anzahlTipps: 37 },
  spieltag: { id: 'sp-gewertet', gegner: 'TSV Apensen', heim: false, anstoss: iso(-24), toreSva: 2, toreGegner: 1, sieger: [{ platz: 1, name: 'Lena K.', punkte: 52 }], teilnehmer: 52, schnitt: 21.4 },
  top5: ranglisteFixture('saison').eintraege.slice(0, 5),
  duell: DUELL,
  teilnehmerGesamt: 63,
}

export const TEILNEHMER = {
  gesamt: 63, kabine: 11,
  liste: [
    { userId: 'u1', name: 'Tobias H.', email: 'tobi@kabine.example', kabine: true, sichtbar: true, seit: iso(-24 * 30), tipps: 8, punkte: 247 },
    { userId: 'u2', name: 'Jannik S.', email: 'jannik@kabine.example', kabine: true, sichtbar: true, seit: iso(-24 * 30), tipps: 7, punkte: 190 },
    { userId: 'u3', name: 'Lena K.', email: 'lena@fan.example', kabine: false, sichtbar: true, seit: iso(-24 * 40), tipps: 8, punkte: 260 },
    { userId: 'u4', name: 'Ole M.', email: 'ole@fan.example', kabine: false, sichtbar: false, seit: iso(-24 * 12), tipps: 5, punkte: 120 },
  ],
}
