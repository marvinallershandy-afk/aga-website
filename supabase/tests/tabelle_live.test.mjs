// Node-Test der Live-Tabellen-Rechnung (tabelle_live.mjs).
// node supabase/tests/tabelle_live.test.mjs
import { tabelleBerechnen, stimmtMitFupa } from '../functions/fupa-live/tabelle_live.mjs'
let fails = 0
const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fails++ }

const T = (slug) => ({ slug, name: slug })
const sp = (h, a, th, tg, section, kickoff) => ({ home: T(h), away: T(a), toreHeim: th, toreGast: tg, section, kickoff })

// Spieltag-Beginn: zwei abgeschlossene Spieltage vor dem 18.10.
const vor = [
  sp('sva', 'b', 2, 0, 'POST', '2026-10-04T15:00:00Z'),
  sp('c', 'd', 1, 1, 'POST', '2026-10-04T15:00:00Z'),
  sp('sva', 'c', 1, 0, 'POST', '2026-10-11T15:00:00Z'),
  sp('b', 'd', 0, 3, 'POST', '2026-10-11T15:00:00Z'),
]
// Spieltag 3 (18.10.): SVA führt gerade 1:0 (LIVE), c–b beendet 2:2
const heute = [
  ...vor,
  sp('sva', 'd', 1, 0, 'LIVE', '2026-10-18T15:00:00Z'),
  sp('c', 'b', 2, 2, 'POST', '2026-10-18T15:00:00Z'),
]

// ── Rechnung vor dem Spieltag ─────────────────────────────────────────────────
const tabVor = tabelleBerechnen(vor, { svaSlug: 'sva' })
const svaVor = tabVor.find((r) => r.slug === 'sva')
ok(svaVor.sp === 2 && svaVor.s === 2 && svaVor.pkt === 6 && svaVor.tore === 3 && svaVor.gegen === 0, 'SVA vor Spieltag: 2 Spiele, 6 Punkte, 3:0')
ok(tabVor[0].slug === 'sva', 'SVA führt vor dem Spieltag')

// ── Live-Tabelle am Spieltag (mit laufendem SVA-Spiel) ────────────────────────
const tabLive = tabelleBerechnen(heute, { svaSlug: 'sva', datum: '2026-10-18T00:00:00Z' })
const svaLive = tabLive.find((r) => r.slug === 'sva')
ok(svaLive.live === true && svaLive.sp === 3 && svaLive.pkt === 9, 'SVA live: laufendes Spiel zählt vorläufig (9 Punkte, live=true)')
ok(tabLive.every((r) => typeof r.trend === 'number'), 'Trend je Zeile gesetzt')

// ── Gleichstand-Sortierung (Punkte, dann Tordifferenz, dann Tore) ─────────────
const gleich = [
  sp('x', 'y', 3, 0, 'POST', '2026-10-01T00:00:00Z'), // x: 3 Pkt, +3
  sp('z', 'w', 2, 0, 'POST', '2026-10-01T00:00:00Z'), // z: 3 Pkt, +2
]
const tg = tabelleBerechnen(gleich, {})
ok(tg[0].slug === 'x' && tg[1].slug === 'z', 'Gleichstand: bessere Tordifferenz zuerst (x vor z)')

// ── Punktabzug ────────────────────────────────────────────────────────────────
const tabAbzug = tabelleBerechnen(vor, { abzug: { sva: 3 } })
ok(tabAbzug.find((r) => r.slug === 'sva').pkt === 3, 'Punktabzug (−3) wirkt')

// ── stimmtMitFupa ─────────────────────────────────────────────────────────────
const fupaStand = tabVor.map((r) => ({ rank: r.platz, points: r.pkt, ownGoals: r.tore, againstGoals: r.gegen, team: { slug: r.slug } }))
ok(stimmtMitFupa(tabVor, fupaStand) === true, 'stimmtMitFupa: identische Tabelle → true')
const kaputt = fupaStand.map((r) => (r.team.slug === 'sva' ? { ...r, points: r.points + 1 } : r))
ok(stimmtMitFupa(tabVor, kaputt) === false, 'stimmtMitFupa: abweichende Punkte → false (Live-Tabelle wird ausgeblendet)')
ok(stimmtMitFupa(tabVor, []) === false, 'stimmtMitFupa: keine FuPa-Tabelle → false')

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
