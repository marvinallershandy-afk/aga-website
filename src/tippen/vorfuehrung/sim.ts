// ─────────────────────────────────────────────────────────────
// v21-T Vorführung: realistische Daten der Tipp-Liga im Browser.
// Echter Kader (src/data/players.ts, Fotos/Freisteller), erfundene Tipper
// (Vorname + Initial, auch die Kabine-Konten sind erfunden), ein komplettes
// Spiel SVA – TuS Fischbek mit Ereignissen. Punkte nach denselben Regeln wie
// die Datenbank (../punkte.ts). Gleiche Namen wie scripts/tippen-fixtures.mjs.
// ─────────────────────────────────────────────────────────────
import { PLAYERS } from '../../data/players'
import type {
  BonusKey,
  Duell,
  KaderSpieler,
  Lage,
  LiveDaten,
  LiveEreignis,
  Liga,
  LigaTipp,
  MeineElf,
  MeinePunkte,
  MeinTipp,
  Position,
  RangArt,
  RangEintrag,
  Rangliste,
  TippSpiel,
  Verteilung,
} from '../api'
import { ERGEBNIS_ART, bonusStand, ergebnisPunkte, hochrechnen, spielerPunkte, spielerStaende } from '../punkte'
import { ENDE_MINUTE, simLesen, type Phase } from './store'

// ── Kader ────────────────────────────────────────────────────
const ZWEIT: Record<string, Position> = { 'p-pejas-n': 'ANG', 'p-pejas-e': 'ANG', 'p-bruenjes': 'ANG' }
const SAISON_ZAHLEN: Record<string, [number, number]> = {
  'p-pils': [9, 0], 'p-ebeling-t': [1, 0], 'p-huettry': [9, 1], 'p-brettschneider': [8, 0], 'p-sladek': [7, 0],
  'p-neuber-m': [9, 2], 'p-nauerz': [4, 0], 'p-paruzel': [9, 3], 'p-becker': [8, 1], 'p-kalwa': [6, 1],
  'p-pejas-n': [7, 2], 'p-pejas-e': [6, 1], 'p-helck': [9, 4], 'p-bruenjes': [5, 1], 'p-warkehr-a': [9, 7],
  'p-biedermann': [8, 6], 'p-viedts': [3, 2], 'p-matthes': [4, 0], 'p-elsen': [5, 0], 'p-neuber-d': [3, 0],
}
export const KADER: KaderSpieler[] = PLAYERS.map((p) => ({
  id: p.id,
  name: p.name,
  nummer: p.number ?? undefined,
  position: p.position,
  zweitposition: ZWEIT[p.id],
  ...(p.id === 'p-viedts' ? { nichtVerfuegbar: true, hinweis: 'Muskelfaserriss · zurück Ende Oktober' } : {}),
  fotoUrl: p.photoUrl ?? undefined,
  cutoutUrl: p.cutoutUrl ?? undefined,
  kapitaen: p.isCaptain || undefined,
  spiele: SAISON_ZAHLEN[p.id]?.[0] ?? 0,
  tore: SAISON_ZAHLEN[p.id]?.[1] ?? 0,
}))
const POS = new Map(KADER.map((k) => [k.id, k.position]))
const pos = (id: string): Position => POS.get(id) ?? 'MIT'

// ── Das Spiel ────────────────────────────────────────────────
export const SPIEL_ID = 'vf-fischbek'
const VORHER_ID = 'vf-horneburg'
const NAECHSTES_ID = 'vf-luehe'
const FRAGEN: TippSpiel['fragen'] = [{ key: 'gelb' }, { key: 'tor20' }, { key: 'elfmeter' }]
export const STARTELF = ['p-pils', 'p-huettry', 'p-brettschneider', 'p-neuber-m', 'p-sladek', 'p-paruzel', 'p-becker', 'p-helck', 'p-pejas-n', 'p-warkehr-a', 'p-biedermann']

export const EREIGNISSE: LiveEreignis[] = [
  { minute: 0, typ: 'anpfiff', text: 'Anpfiff am Waldsportplatz' },
  { minute: 14, typ: 'gelb', spieler: 'p-paruzel', text: 'Taktisches Foul im Mittelfeld' },
  { minute: 23, typ: 'tor', spieler: 'p-warkehr-a', spieler2: 'p-helck', text: 'Flach ins lange Eck', stand: [1, 0] },
  { minute: 38, typ: 'gegentor', text: 'Kopfball nach Ecke', stand: [1, 1] },
  { minute: 45, typ: 'halbzeit' },
  { minute: 46, typ: 'wiederanpfiff' },
  { minute: 58, typ: 'tor', spieler: 'p-biedermann', spieler2: 'p-pejas-n', text: 'Abstauber nach Steckpass', stand: [2, 1] },
  { minute: 66, typ: 'wechsel', spieler: 'p-pejas-e', spieler2: 'p-becker' },
  { minute: 71, typ: 'gelb', spieler: 'p-huettry' },
  { minute: 75, typ: 'wechsel', spieler: 'p-bruenjes', spieler2: 'p-pejas-n' },
  { minute: 84, typ: 'tor', spieler: 'p-pejas-e', text: 'Elfmeter verwandelt', stand: [3, 1] },
  { minute: ENDE_MINUTE, typ: 'abpfiff' },
]
export const EREIGNIS_MINUTEN = [...new Set(EREIGNISSE.map((e) => e.minute))].filter((m) => m > 0)
const MOTM = 'p-pejas-e'

function standBei(minute: number): [number, number] {
  let s: [number, number] = [0, 0]
  for (const e of EREIGNISSE) if (e.minute <= minute && e.stand) s = e.stand
  return s
}

// ── Tipper (erfunden) ────────────────────────────────────────
interface Tipper {
  name: string
  kabine?: boolean
  ich?: boolean
  liga?: boolean // Stammtisch-Liga
  tipp: MeinTipp
  elf: MeineElf
  /** Punkte der Spieltage 1–9 (null = nicht getippt) */
  historie: (number | null)[]
}
const B = (gelb: string, tor20: string, elfmeter: string): Partial<Record<BonusKey, string>> => ({ gelb, tor20, elfmeter })
const E = (spieler: string[], kapitaen: string): MeineElf => ({ spieler, kapitaen, frei: false })
const T = (a: number, b: number, erster?: string, joker = false, bonus = B('1-2', 'nein', 'nein'), motm?: string): MeinTipp => ({ toreSva: a, toreGegner: b, ersterTorschuetze: erster, joker, bonus, motm })

export const ICH_NAME = 'Lena K.'
const ICH_TIPP_STANDARD = T(2, 1, 'p-warkehr-a', true, B('1-2', 'nein', 'ja'), 'p-pejas-e')
const ICH_ELF_STANDARD = E(['p-pils', 'p-huettry', 'p-helck', 'p-pejas-n', 'p-pejas-e'], 'p-pejas-e')

const TIPPER: Tipper[] = [
  { name: ICH_NAME, ich: true, liga: true, tipp: ICH_TIPP_STANDARD, elf: ICH_ELF_STANDARD, historie: [18, 31, 22, null, 27, 41, 19, 33, 23] },
  { name: 'Svenja L.', liga: true, tipp: T(3, 1, 'p-warkehr-a', true, B('1-2', 'nein', 'ja'), 'p-warkehr-a'), elf: E(['p-pils', 'p-neuber-m', 'p-paruzel', 'p-helck', 'p-warkehr-a'], 'p-warkehr-a'), historie: [24, 19, 35, 28, 22, 17, 30, 26, 21] },
  { name: 'Ole M.', liga: true, tipp: T(1, 0, 'p-biedermann', false, B('1-2', 'nein', 'nein')), elf: E(['p-pils', 'p-huettry', 'p-paruzel', 'p-becker', 'p-biedermann'], 'p-biedermann'), historie: [31, 27, 18, 36, 29, 22, 24, 31, 20] },
  { name: 'Henrik D.', tipp: T(2, 2, 'p-warkehr-a', false, B('3+', 'ja', 'nein')), elf: E(['p-pils', 'p-sladek', 'p-helck', 'p-kalwa', 'p-warkehr-a'], 'p-helck'), historie: [22, 26, 29, 19, 33, 28, 21, 18, 30] },
  { name: 'Mia B.', liga: true, tipp: T(2, 0, 'p-biedermann', false, B('0', 'nein', 'nein')), elf: E(['p-ebeling-t', 'p-neuber-m', 'p-helck', 'p-paruzel', 'p-biedermann'], 'p-biedermann'), historie: [15, 22, 17, 25, null, 30, 26, 22, 18] },
  { name: 'Paul W.', tipp: T(3, 2, 'p-helck', false, B('1-2', 'ja', 'ja')), elf: E(['p-pils', 'p-brettschneider', 'p-helck', 'p-pejas-e', 'p-warkehr-a'], 'p-pejas-e'), historie: [20, 18, 26, 31, 24, 19, 28, 25, 27] },
  { name: 'Finn T.', liga: true, tipp: T(1, 1, undefined, false, B('1-2', 'nein', 'nein')), elf: E(['p-pils', 'p-huettry', 'p-becker', 'p-kalwa', 'p-warkehr-a'], 'p-warkehr-a'), historie: [27, 30, 21, 22, 26, 31, 17, 29, 24] },
  { name: 'Lara F.', tipp: T(4, 1, 'p-biedermann', true, B('3+', 'ja', 'ja')), elf: E(['p-pils', 'p-neuber-m', 'p-pejas-n', 'p-helck', 'p-biedermann'], 'p-biedermann'), historie: [12, 28, 33, 17, 21, 25, 30, null, 22] },
  { name: 'Ben O.', tipp: T(0, 1, undefined, false, B('3+', 'nein', 'ja')), elf: E(['p-pils', 'p-sladek', 'p-paruzel', 'p-kalwa', 'p-biedermann'], 'p-paruzel'), historie: [19, 14, 22, 27, 18, 23, 16, 20, 25] },
  { name: 'Nele G.', liga: true, tipp: T(2, 1, 'p-biedermann', false, B('1-2', 'nein', 'nein')), elf: E(['p-pils', 'p-huettry', 'p-helck', 'p-pejas-n', 'p-warkehr-a'], 'p-helck'), historie: [25, 21, 27, 24, 30, 18, 22, 27, 26] },
  { name: 'Kai P.', tipp: T(3, 0, 'p-warkehr-a', false, B('0', 'ja', 'nein')), elf: E(['p-pils', 'p-brettschneider', 'p-becker', 'p-helck', 'p-warkehr-a'], 'p-warkehr-a'), historie: [null, 24, 19, 28, 25, 22, 31, 19, 23] },
  // Kabine (Spieler-Konten — erfundene Namen)
  { name: 'Jonas R.', kabine: true, tipp: T(3, 1, 'p-biedermann', false, B('1-2', 'nein', 'nein')), elf: E(['p-pils', 'p-neuber-m', 'p-helck', 'p-paruzel', 'p-biedermann'], 'p-helck'), historie: [29, 33, 24, 30, 27, 35, 23, 28, 31] },
  { name: 'Tim A.', kabine: true, tipp: T(2, 0, 'p-warkehr-a', false, B('1-2', 'nein', 'nein')), elf: E(['p-pils', 'p-sladek', 'p-becker', 'p-pejas-n', 'p-warkehr-a'], 'p-warkehr-a'), historie: [26, 22, 31, 27, 20, 29, 25, 30, 24] },
  { name: 'Luca S.', kabine: true, tipp: T(1, 0, 'p-helck', false, B('3+', 'ja', 'nein')), elf: E(['p-pils', 'p-huettry', 'p-helck', 'p-kalwa', 'p-biedermann'], 'p-kalwa'), historie: [21, 27, 20, 23, 31, 24, 28, 22, 19] },
  { name: 'Max E.', kabine: true, tipp: T(2, 1, 'p-warkehr-a', false, B('1-2', 'nein', 'ja')), elf: E(['p-ebeling-t', 'p-brettschneider', 'p-paruzel', 'p-becker', 'p-bruenjes'], 'p-bruenjes'), historie: [23, 25, 28, 21, 24, 20, 27, 26, 28] },
  { name: 'Niklas V.', kabine: true, tipp: T(1, 2, undefined, false, B('3+', 'ja', 'nein')), elf: E(['p-pils', 'p-neuber-m', 'p-becker', 'p-pejas-n', 'p-warkehr-a'], 'p-pejas-n'), historie: [17, 20, 23, 26, 19, 22, 24, 21, 20] },
]

function ich(): Tipper {
  const z = simLesen()
  const basis = TIPPER[0]
  return { ...basis, tipp: z.meinTipp ?? basis.tipp, elf: z.meineElf ?? basis.elf }
}
const alle = (): Tipper[] => [ich(), ...TIPPER.slice(1)]

// ── Zeit ─────────────────────────────────────────────────────
const TAG = 86400_000
const anstoss = () => simLesen().t0 + 72 * 60_000 // Vorführung startet 72 Min. vor dem Anpfiff
function iso(ms: number) {
  return new Date(ms).toISOString()
}
/** „Jetzt“ der Simulation: vor Anpfiff echte Uhr, danach Spielzeit, Montag = +1 Tag. */
function simJetzt(phase: Phase): number {
  const a = anstoss()
  const z = simLesen()
  if (phase === 'vor') return Date.now()
  if (phase === 'live') return a + Math.min(z.minute, ENDE_MINUTE) * 60_000 + (z.minute > 45 ? 15 * 60_000 : 0)
  if (phase === 'abpfiff') return a + 125 * 60_000
  return a + TAG + 10 * 3600_000
}

// ── Punkte je Tipper (Spiel Fischbek) ───────────────────────
function punkteSpiel(t: Tipper, minute: number, ende: boolean, motm?: string) {
  return hochrechnen({
    spiel: { fragen: FRAGEN, heim: true },
    tipp: t.tipp,
    elf: t.elf,
    stand: standBei(minute),
    ereignisse: EREIGNISSE,
    minute,
    ende,
    startelf: STARTELF,
    position: pos,
    motm,
  })
}

function meinePunkte(t: Tipper, motm?: string): MeinePunkte {
  const ende = standBei(ENDE_MINUTE)
  const auf = aufloesung()
  const erg = ergebnisPunkte(t.tipp.toreSva, t.tipp.toreGegner, ende[0], ende[1])
  const erster = EREIGNISSE.find((e) => e.typ === 'tor')?.spieler
  const tor = t.tipp.ersterTorschuetze && t.tipp.ersterTorschuetze === erster ? 3 : 0
  const mo = motm && t.tipp.motm === motm ? 2 : 0
  const bonus: Partial<Record<BonusKey, number>> = {}
  let b = 0
  for (const f of FRAGEN) {
    const r = t.tipp.bonus[f.key] && t.tipp.bonus[f.key] === auf[f.key] ? 1 : 0
    bonus[f.key] = r
    b += r
  }
  const summe = erg + tor + mo + b
  const tipp = t.tipp.joker ? summe * 2 : summe
  const staende = spielerStaende(STARTELF, EREIGNISSE, ENDE_MINUTE, ende, motm)
  const elf = t.elf.spieler.map((id) => {
    const s = staende.get(id)
    const r = s ? spielerPunkte(s, pos(id)) : { punkte: 0, posten: [] }
    const kap = t.elf.kapitaen === id
    return { id, punkte: r.punkte, gesamt: kap ? r.punkte * 2 : r.punkte, kapitaen: kap, eingesetzt: !!s?.eingesetzt, posten: r.posten }
  })
  const elfSumme = elf.reduce((a, e) => a + e.gesamt, 0)
  return {
    tipp: summe,
    elf: elfSumme,
    joker: t.tipp.joker,
    gesamt: tipp + elfSumme,
    exakt: erg === 4,
    details: {
      tipp: { ergebnis: erg, art: ERGEBNIS_ART(erg), torschuetze: tor, motm: mo, bonus, bonusSumme: b, bonusRichtig: b, summe, joker: t.tipp.joker, gesamt: tipp },
      elf,
      kapitaenPunkte: elf.find((e) => e.kapitaen)?.gesamt,
      hatTipp: true,
      hatElf: true,
    },
  }
}

function aufloesung(): Partial<Record<BonusKey, string>> {
  const b = bonusStand(EREIGNISSE, ENDE_MINUTE, true)
  const r: Partial<Record<BonusKey, string>> = {}
  for (const f of FRAGEN) r[f.key] = b[f.key]?.wert
  return r
}

// ── Spiele ───────────────────────────────────────────────────
function spielFischbek(phase: Phase): TippSpiel {
  const a = anstoss()
  const z = simLesen()
  const i = ich()
  const basis: TippSpiel = {
    id: SPIEL_ID,
    gegner: 'TuS Fischbek',
    heim: true,
    anstoss: iso(a),
    schluss: iso(a),
    offen: phase === 'vor',
    wettbewerb: 'Kreisliga Stade',
    spieltag: 10,
    ort: 'Waldsportplatz Agathenburg',
    status: 'geplant',
    wertung: 'saison',
    fragen: FRAGEN,
    anzahlTipps: TIPPER.length - 1 + (z.meinTipp ? 1 : 0),
  }
  if (phase === 'vor') {
    return { ...basis, meinTipp: z.meinTipp, meineElf: z.meineElf }
  }
  const minute = phase === 'live' ? z.minute : ENDE_MINUTE
  const stand = standBei(minute)
  const mit = { ...basis, anzahlTipps: TIPPER.length, toreSva: stand[0], toreGegner: stand[1], meinTipp: i.tipp, meineElf: i.elf }
  if (phase === 'live') {
    const halbzeit = minute >= 45 && minute < 46
    return { ...mit, status: minute >= ENDE_MINUTE ? 'beendet' : halbzeit ? 'halbzeit' : 'live', live: liveDaten(minute) }
  }
  const motm = phase === 'montag' ? MOTM : undefined
  return {
    ...mit,
    status: 'beendet',
    gewertetAt: iso(a + 120 * 60_000),
    aufloesung: aufloesung(),
    ersterTorschuetze: 'p-warkehr-a',
    motm,
    meinePunkte: meinePunkte(i, motm),
  }
}

function liveDaten(minute: number): LiveDaten {
  const ende = minute >= ENDE_MINUTE
  const jetzt = alle().map((t) => ({ t, p: punkteSpiel(t, minute, ende) }))
  // Stand vor dem letzten Ereignis → Trend + Zähler
  const letzte = [...EREIGNIS_MINUTEN].reverse().find((m) => m <= minute && m > 0)
  const vorMin = letzte != null ? letzte - 0.5 : 0
  const vorher = new Map(alle().map((t) => [t.name, punkteSpiel(t, vorMin, false).gesamt]))
  const rangVorher = rangPlaetze([...vorher.entries()].map(([name, p]) => ({ name, p })))
  const rang = rangPlaetze(jetzt.map((x) => ({ name: x.t.name, p: x.p.gesamt })))
  const rangliste: RangEintrag[] = jetzt
    .map((x) => ({
      platz: rang.get(x.t.name)!,
      name: x.t.name,
      punkte: x.p.gesamt,
      vorher: vorher.get(x.t.name),
      exakt: 0,
      spiele: 1,
      trend: (rangVorher.get(x.t.name) ?? 0) - rang.get(x.t.name)!,
      kabine: x.t.kabine,
      ich: x.t.ich,
    }))
    .sort((a, b) => a.platz - b.platz || a.name.localeCompare(b.name))
  const fans = jetzt.filter((x) => !x.t.kabine)
  const kab = jetzt.filter((x) => x.t.kabine)
  const avg = (l: typeof jetzt) => Math.round((10 * l.reduce((a, x) => a + x.p.gesamt, 0)) / Math.max(1, l.length)) / 10
  return {
    minute: Math.min(90, Math.floor(minute)),
    nachspielzeit: minute > 90 ? Math.ceil(minute - 90) : undefined,
    ereignisse: EREIGNISSE.filter((e) => e.minute <= minute),
    ich: jetzt[0].p,
    rangliste,
    duell: { fans: avg(fans), kabine: avg(kab) },
  }
}

function rangPlaetze(l: { name: string; p: number }[]): Map<string, number> {
  const s = [...l].sort((a, b) => b.p - a.p)
  const m = new Map<string, number>()
  s.forEach((x, i) => m.set(x.name, i > 0 && s[i - 1].p === x.p ? m.get(s[i - 1].name)! : i + 1))
  return m
}

function spielHorneburg(): TippSpiel {
  const a = anstoss() - 7 * TAG
  return {
    id: VORHER_ID,
    gegner: 'VfL Horneburg',
    heim: false,
    anstoss: iso(a),
    schluss: iso(a),
    offen: false,
    wettbewerb: 'Kreisliga Stade',
    spieltag: 9,
    status: 'beendet',
    wertung: 'saison',
    toreSva: 2,
    toreGegner: 2,
    fragen: [{ key: 'rot' }, { key: 'erstes_tor' }, { key: 'tore_hz1' }],
    anzahlTipps: 15,
    gewertetAt: iso(a + 3 * 3600_000),
    aufloesung: { rot: 'nein', erstes_tor: 'gegner', tore_hz1: '1' },
    motm: 'p-helck',
    ersterTorschuetze: 'p-helck',
    meinTipp: T(1, 1, 'p-helck', false, { rot: 'nein', erstes_tor: 'gegner', tore_hz1: '2+' }, 'p-helck'),
    meineElf: E(['p-pils', 'p-huettry', 'p-helck', 'p-paruzel', 'p-warkehr-a'], 'p-helck'),
    meinePunkte: {
      tipp: 10, elf: 13, joker: false, gesamt: 23, exakt: false,
      details: {
        tipp: { ergebnis: 3, art: 'differenz', torschuetze: 3, motm: 2, bonus: { rot: 1, erstes_tor: 1, tore_hz1: 0 }, bonusSumme: 2, bonusRichtig: 2, summe: 10, joker: false, gesamt: 10 },
        elf: [
          { id: 'p-pils', punkte: 1, gesamt: 1, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }] },
          { id: 'p-huettry', punkte: 1, gesamt: 1, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }] },
          { id: 'p-helck', punkte: 11, gesamt: 22, kapitaen: true, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }, { k: 'tor', n: 1, p: 5 }, { k: 'motm', p: 5 }] },
          { id: 'p-paruzel', punkte: 0, gesamt: 0, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }, { k: 'gelb', p: -1 }] },
          { id: 'p-warkehr-a', punkte: 1, gesamt: 1, kapitaen: false, eingesetzt: true, posten: [{ k: 'einsatz', p: 1 }] },
        ],
        kapitaenPunkte: 22, hatTipp: true, hatElf: true,
      },
    },
  }
}

function spielLuehe(): TippSpiel {
  const a = anstoss() + 7 * TAG
  return {
    id: NAECHSTES_ID, gegner: 'SG Lühe', heim: false, anstoss: iso(a), schluss: iso(a), offen: true, wettbewerb: 'Kreisliga Stade', spieltag: 11,
    status: 'geplant', wertung: 'saison', fragen: [{ key: 'rot' }, { key: 'erstes_tor' }, { key: 'tore_hz1' }], anzahlTipps: 3,
  }
}

// ── Lage ─────────────────────────────────────────────────────
export function lage(phase: Phase): Lage {
  const i = ich()
  const gewertet = phase === 'abpfiff' || phase === 'montag'
  const fisch = spielFischbek(phase)
  const neu = gewertet ? [{ key: 'torriecher', at: iso(simJetzt(phase) - 3600_000) }, ...(phase === 'montag' && istSpieltagssieger() ? [{ key: 'spieltagssieger', at: iso(simJetzt(phase) - 600_000) }] : [])] : []
  const saison = saisonPunkte(i, phase)
  return {
    version: 1,
    serverNow: iso(simJetzt(phase)),
    saison: '2026/27',
    einstellungen: {
      aktiv: true,
      elfFrei: true,
      preise: 'Spieltagssieger: ein Getränk am Vereinsheim · Monatssieger: Trikot-Verlosung',
      winterpause: { aktiv: false, bis: '2027-03-14', von: '11-15' },
    },
    offen: phase === 'vor' ? fisch : spielLuehe(),
    gesperrt: phase === 'live' ? fisch : undefined,
    gewertet: gewertet ? fisch : spielHorneburg(),
    kader: KADER,
    ich: {
      email: 'vorfuehrung@sva.example',
      profil: { vorname: 'Lena', initial: 'K', anzeigename: ICH_NAME },
      teilnehmer: { sichtbar: true, kabine: false, seit: iso(Date.now() - 60 * TAG) },
      jokerFrei: true,
      abzeichen: [
        { key: 'erster_tipp', at: iso(Date.now() - 60 * TAG) },
        { key: 'hellseher', at: iso(Date.now() - 30 * TAG) },
        { key: 'kapitaensgriff', at: iso(Date.now() - 8 * TAG) },
        { key: 'stammtisch', at: iso(Date.now() - 20 * TAG) },
        ...neu,
      ],
      statistik: { punkte: saison, spieltage: i.historie.filter((x) => x != null).length + (gewertet ? 1 : 0), exakt: 3, beste: Math.max(41, gewertet ? meinePunkte(i, phase === 'montag' ? MOTM : undefined).gesamt : 0) },
      tippsGesamt: 9,
      letzteElf: ICH_ELF_STANDARD,
      ligen: 2 + simLesen().ligen.length,
    },
  }
}

function saisonPunkte(t: Tipper, phase: Phase): number {
  const h = t.historie.reduce<number>((a, x) => a + (x ?? 0), 0)
  if (phase === 'abpfiff' || phase === 'montag') return h + meinePunkteVon(t, phase)
  return h
}
function meinePunkteVon(t: Tipper, phase: Phase): number {
  return meinePunkte(t, phase === 'montag' ? MOTM : undefined).gesamt
}

function istSpieltagssieger(): boolean {
  const r = rangSpieltag('montag')
  return r.eintraege.find((e) => e.ich)?.platz === 1
}

// ── Ranglisten ───────────────────────────────────────────────
interface Zeile {
  t: Tipper
  jetzt: number
  vorher: number
  exakt: number
  spiele: number
  neu?: boolean
}

function ligaFilter(liga?: string | null): ((t: Tipper) => boolean) | null {
  if (!liga) return null
  if (liga === 'vf-feuerwehr') return (t) => !t.kabine
  if (liga.startsWith('vf-neu')) return (t) => !!t.ich
  return (t) => !!t.liga
}

function liste(zeilen: Zeile[], art: RangArt, liga?: string | null): Rangliste {
  const f = ligaFilter(liga)
  const z = f ? zeilen.filter((x) => f(x.t)) : zeilen
  const platzJ = rangPlaetze(z.map((x) => ({ name: x.t.name, p: x.jetzt * 100 + x.exakt })))
  const platzV = rangPlaetze(z.map((x) => ({ name: x.t.name, p: x.vorher * 100 + x.exakt })))
  const eintraege: RangEintrag[] = z
    .map((x) => ({
      platz: platzJ.get(x.t.name)!,
      name: x.t.name,
      punkte: x.jetzt,
      exakt: x.exakt,
      spiele: x.spiele,
      trend: art === 'spieltag' ? undefined : platzV.get(x.t.name)! - platzJ.get(x.t.name)!,
      neu: x.neu || undefined,
      kabine: x.t.kabine,
      ich: x.t.ich,
    }))
    .sort((a, b) => a.platz - b.platz || a.name.localeCompare(b.name))
  const schnitt = Math.round((10 * z.reduce((a, x) => a + x.jetzt, 0)) / Math.max(1, z.length)) / 10
  return { art, saison: '2026/27', eintraege, ich: eintraege.find((e) => e.ich), teilnehmer: z.length, schnitt }
}

function rangSpieltag(phase: Phase): Rangliste {
  const gewertet = phase === 'abpfiff' || phase === 'montag'
  const zeilen: Zeile[] = alle()
    .map((t) => {
      const p = gewertet ? meinePunkteVon(t, phase) : (t.historie[8] ?? null)
      return p == null ? null : { t, jetzt: p, vorher: p, exakt: gewertet && t.tipp.toreSva === 3 && t.tipp.toreGegner === 1 ? 1 : 0, spiele: 1 }
    })
    .filter((x): x is Zeile => !!x)
  const r = liste(zeilen, 'spieltag')
  const s = gewertet ? spielFischbek(phase) : spielHorneburg()
  return { ...r, spielId: s.id, spiel: { gegner: s.gegner, heim: s.heim, anstoss: s.anstoss, toreSva: s.toreSva, toreGegner: s.toreGegner } }
}

export function rangliste(art: RangArt, phase: Phase, liga?: string | null): Rangliste {
  if (liga === 'vf-kabine') {
    const r = rangliste(art, phase)
    const e = r.eintraege.filter((x) => x.kabine).map((x, i) => ({ ...x, platz: i + 1 }))
    return { ...r, eintraege: e, ich: undefined, teilnehmer: e.length }
  }
  if (art === 'spieltag') {
    const r = rangSpieltag(phase)
    return liga ? { ...r, ...liste(r.eintraege.map((e) => ({ t: alle().find((t) => t.name === e.name)!, jetzt: e.punkte, vorher: e.punkte, exakt: e.exakt, spiele: 1 })), 'spieltag', liga) } : r
  }
  const gewertet = phase === 'abpfiff' || phase === 'montag'
  const ab = art === 'monat' ? 7 : 0 // Monat Oktober: Spieltage 8, 9 (+ 10)
  const zeilen: Zeile[] = alle().map((t) => {
    const h = t.historie.slice(ab)
    const alt = h.reduce<number>((a, x) => a + (x ?? 0), 0)
    const dieses = gewertet ? meinePunkteVon(t, phase) : 0
    // „vorher“ = vor dem letzten gewerteten Spieltag
    const vorher = gewertet ? alt : alt - (t.historie[8] ?? 0)
    return {
      t,
      jetzt: alt + dieses,
      vorher,
      exakt: (t.ich ? 3 : (t.name.length % 3)) + (gewertet && t.tipp.toreSva === 3 && t.tipp.toreGegner === 1 ? 1 : 0),
      spiele: h.filter((x) => x != null).length + (gewertet ? 1 : 0),
    }
  })
  const r = liste(zeilen, art, liga)
  return art === 'monat' ? { ...r, monat: new Date(simJetzt(phase)).toISOString().slice(0, 7) } : r
}

export function duell(phase: Phase): Duell {
  const s = rangliste('saison', phase)
  const tag = rangSpieltag(phase)
  const avg = (l: RangEintrag[], spiele: (e: RangEintrag) => number) =>
    Math.round((10 * l.reduce((a, e) => a + e.punkte, 0)) / Math.max(1, l.reduce((a, e) => a + spiele(e), 0))) / 10
  const fans = s.eintraege.filter((e) => !e.kabine)
  const kab = s.eintraege.filter((e) => e.kabine)
  const tf = tag.eintraege.filter((e) => !e.kabine)
  const tk = tag.eintraege.filter((e) => e.kabine)
  const bester = [...kab].sort((a, b) => b.punkte - a.punkte)[0]
  return {
    spieltag: { spielId: tag.spielId!, gegner: tag.spiel!.gegner, heim: tag.spiel!.heim, anstoss: tag.spiel!.anstoss, fans: avg(tf, () => 1), kabine: avg(tk, () => 1), nFans: tf.length, nKabine: tk.length },
    saison: { saison: '2026/27', fans: avg(fans, (e) => e.spiele), kabine: avg(kab, (e) => e.spiele), nFans: fans.length, nKabine: kab.length },
    kabineBester: bester ? { name: bester.name, punkte: bester.punkte } : undefined,
  }
}

export function verteilung(): Verteilung {
  const l = alle()
  const n = l.length
  const zaehl = new Map<string, number>()
  for (const t of l) zaehl.set(`${t.tipp.toreSva}:${t.tipp.toreGegner}`, (zaehl.get(`${t.tipp.toreSva}:${t.tipp.toreGegner}`) ?? 0) + 1)
  const ergebnisse = [...zaehl.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, c]) => ({ toreSva: Number(k.split(':')[0]), toreGegner: Number(k.split(':')[1]), anteil: Math.round((100 * c) / n) }))
  const sieg = l.filter((t) => t.tipp.toreSva > t.tipp.toreGegner).length
  const remis = l.filter((t) => t.tipp.toreSva === t.tipp.toreGegner).length
  const kap = new Map<string, number>()
  for (const t of l) kap.set(t.elf.kapitaen, (kap.get(t.elf.kapitaen) ?? 0) + 1)
  const [kId, kN] = [...kap.entries()].sort((a, b) => b[1] - a[1])[0]
  const elf = new Map<string, number>()
  for (const t of l) for (const s of t.elf.spieler) elf.set(s, (elf.get(s) ?? 0) + 1)
  return {
    n,
    ergebnisse,
    tendenz: { sieg: Math.round((100 * sieg) / n), remis: Math.round((100 * remis) / n), niederlage: 100 - Math.round((100 * sieg) / n) - Math.round((100 * remis) / n) },
    elf: [...elf.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([spieler, c]) => ({ spieler, anteil: Math.round((100 * c) / n) })),
    kapitaen: { spieler: kId, anteil: Math.round((100 * kN) / n) },
    joker: l.filter((t) => t.tipp.joker).length,
  }
}

// ── Ligen ────────────────────────────────────────────────────
export function meineLigen(phase: Phase): Liga[] {
  const st = rangliste('saison', phase, 'vf-stammtisch')
  return [
    { id: 'vf-stammtisch', name: 'Stammtisch-Liga', code: 'STAMM7', gruender: true, mitglieder: st.teilnehmer, meinPlatz: st.ich?.platz, fuehrender: st.eintraege[0]?.name },
    { id: 'vf-feuerwehr', name: 'Feuerwehr Agathenburg', code: 'FWAGA2', gruender: false, mitglieder: 12, meinPlatz: 4, fuehrender: 'Henrik D.' },
    ...simLesen().ligen.map((l) => ({ ...l, gruender: true, mitglieder: 1, meinPlatz: 1, fuehrender: ICH_NAME })),
  ]
}

export function ligaTipps(liga: string, phase: Phase): LigaTipp[] {
  const gewertet = phase === 'abpfiff' || phase === 'montag'
  const l = alle().filter((t) => (liga === 'vf-kabine' ? t.kabine : t.liga))
  if (phase === 'vor') {
    // Tipps zum letzten Spieltag (2:2 in Horneburg) — die neuen sind bis zum Anpfiff geheim
    return l
      .filter((t) => t.historie[8] != null)
      .map((t) => {
        const h = t.historie[8] ?? 0
        return { name: t.name, ich: t.ich || undefined, toreSva: h % 3, toreGegner: (h % 2) + 1, kapitaen: t.elf.kapitaen, punkte: h }
      })
      .sort((a, b) => b.punkte - a.punkte)
  }
  return l
    .map((t) => ({
      name: t.name,
      ich: t.ich || undefined,
      toreSva: t.tipp.toreSva,
      toreGegner: t.tipp.toreGegner,
      joker: t.tipp.joker || undefined,
      kapitaen: t.elf.kapitaen,
      punkte: gewertet ? meinePunkteVon(t, phase) : phase === 'live' ? punkteSpiel(t, simLesen().minute, false).gesamt : undefined,
    }))
    .sort((a, b) => (b.punkte ?? 0) - (a.punkte ?? 0))
}
