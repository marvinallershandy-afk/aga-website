// v17-G: web_live()-Varianten für die TV-Aufstellung (scripts/aufstellung-audit.mjs).
// Basis: scripts/live-fixtures.mjs (echte Kader-slugs + Fotos aus public/players/).
import { liveFixture, PLAYERS } from './live-fixtures.mjs'

const LOGO = 'data:image/svg+xml;utf8,' + encodeURIComponent(
  '<svg xmlns="http://www.w3.org/2000/svg" width="220" height="60"><rect width="220" height="60" rx="8" fill="#fff"/><text x="110" y="40" font-family="Arial" font-weight="700" font-size="26" text-anchor="middle" fill="#1a1a1a">MUSTER GmbH</text></svg>',
)
export const PARTNER = { name: 'Muster GmbH (Test)', logoUrl: LOGO, url: 'https://example.org' }

const EXTRA = [
  // nummernlos (wie Isaak Warkehr im Kader)
  { id: 'p-warkehr-i', name: 'Isaak Warkehr', number: null, position: 'ABW', photoUrl: '/players/isaak-warkehr.webp', cutoutUrl: '/players/cutout/isaak-warkehr.webp' },
  { id: 'p-matthes', name: 'Paul Matthes', number: 44, position: 'MIT', photoUrl: '/players/paul-matthes.webp', cutoutUrl: '/players/cutout/paul-matthes.webp' },
  { id: 'p-hause-x', name: 'Ohne Bild', number: 19, position: 'MIT', photoUrl: null, cutoutUrl: null },
]
const STAFF = [
  { id: 's-junge', name: 'Carsten Junge', role: 'trainer', photoUrl: '/players/carsten-junge.webp', cutoutUrl: '/players/cutout/carsten-junge.webp' },
  { id: 's-ebeling-a', name: 'Adolf Ebeling', role: 'co-trainer', photoUrl: '/players/adolf-ebeling.webp', cutoutUrl: '/players/cutout/adolf-ebeling.webp' },
  { id: 's-hause', name: 'Niko Hause', role: 'teammanager', photoUrl: '/players/niko-hause.webp', cutoutUrl: '/players/cutout/niko-hause.webp' },
]

/**
 * variante:
 *  442-live     4-4-2, live, Wechsel + 2 Tore + Gelb, ohne Partner
 *  433-bug      4-3-3 wie der echte Testdatensatz: Wechsel „Pejas rein für Kalwa“,
 *               obwohl Pejas schon in der Startelf steht (→ früher nur 10 Spieler),
 *               dazu nummernloser Spieler + gelöschter Spieler, mit Partner
 *  352-ende     3-5-2, beendet, 2 Wechsel, 3 Tore (Doppelpack), Rot, mit Partner
 *  433-vorher   4-3-3 vor dem Spiel (nicht bestätigt), ohne Ereignisse
 */
export function aufstellungFixture(variante) {
  if (variante === '442-live') {
    const d = liveFixture('live')
    return { ...d, staff: STAFF, partner: null }
  }
  if (variante === '433-bug') {
    const d = liveFixture('live')
    return {
      ...d,
      players: [...PLAYERS, ...EXTRA],
      staff: STAFF,
      partner: PARTNER,
      lineup: {
        formation: '4-3-3',
        startelf: ['p-pils', 'p-kalwa', 'p-brettschneider', 'p-neuber-m', 'p-warkehr-i', 'p-paruzel', 'p-matthes', 'p-becker', 'p-pejas-n', 'p-biedermann', 'p-geloescht'],
        bank: ['p-ebeling-t', 'p-huettry', 'p-elsen', 'p-sladek', 'p-pejas-e', 'p-warkehr-a', 'p-helck'],
        forMatch: false, matchLabel: null, updatedAt: new Date().toISOString(),
      },
    }
  }
  if (variante === '352-ende') {
    const d = liveFixture('beendet')
    const events = d.events.filter((e) => e.type !== 'wechsel')
    const at = (m) => new Date(Date.now() - (90 - m) * 60000).toISOString()
    events.push(
      { id: 'w1', type: 'wechsel', minute: 61, at: at(61), player: 'p-pejas-e', player2: 'p-paruzel' },
      { id: 'w2', type: 'wechsel', minute: 70, at: at(70), player: 'p-bruenjes', player2: 'p-warkehr-a' },
      { id: 'r1', type: 'rot', minute: 78, at: at(78), player: 'p-neuber-m', text: 'Notbremse.' },
    )
    return {
      ...d,
      players: [...PLAYERS, ...EXTRA],
      staff: STAFF,
      partner: PARTNER,
      events: events.sort((a, b) => +new Date(b.at) - +new Date(a.at)),
      lineup: {
        formation: '3-5-2',
        startelf: ['p-pils', 'p-brettschneider', 'p-neuber-m', 'p-huettry', 'p-sladek', 'p-kalwa', 'p-helck', 'p-becker', 'p-paruzel', 'p-warkehr-a', 'p-biedermann'],
        bank: ['p-ebeling-t', 'p-nauerz', 'p-elsen', 'p-pejas-n', 'p-pejas-e', 'p-bruenjes', 'p-hause-x'],
        forMatch: true, matchLabel: 'vs TuS Fischbek', updatedAt: new Date().toISOString(),
      },
    }
  }
  // 433-vorher
  const d = liveFixture('vorher')
  return {
    ...d,
    players: [...PLAYERS, ...EXTRA],
    staff: STAFF,
    partner: PARTNER,
    lineup: {
      formation: '4-3-3',
      startelf: ['p-pils', 'p-sladek', 'p-brettschneider', 'p-neuber-m', 'p-huettry', 'p-kalwa', 'p-helck', 'p-becker', 'p-paruzel', 'p-biedermann', 'p-warkehr-a'],
      bank: ['p-ebeling-t', 'p-nauerz', 'p-pejas-n', 'p-matthes'],
      forMatch: false, matchLabel: null, updatedAt: new Date().toISOString(),
    },
  }
}
