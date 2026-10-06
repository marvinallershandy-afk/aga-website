// Node-Test der reinen Abbildung FuPa → sva_ticker (live_map.mjs).
// KEIN Netz: echte Fixtures (einmalig abgerufenes, bereinigtes SVA-Spiel) +
// synthetische Spezialfälle. Ausführen:  node supabase/tests/fupa_live_map.test.mjs
import fs from 'node:fs'
import { configAusFupaUrl } from '../functions/fupa-sync/map.mjs'
import { kopfAusMatch, ereignisseAusStream, zeitpunktFuer, mitZeitpunkten, aufstellungAusLineup } from '../functions/fupa-live/live_map.mjs'

const FX = new URL('./fixtures/fupa_live/real/', import.meta.url)
const lies = (f) => JSON.parse(fs.readFileSync(new URL(f, FX), 'utf8'))
let fails = 0
const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fails++ }

const cfg = configAusFupaUrl('https://www.fupa.net/team/sv-agathenburg-dollern-m1-2026-27')
const kopf = lies('kopf_post.json')
const stream = lies('stream_final.json')
const lineup = lies('lineup_post.json')

// ── Kopf ─────────────────────────────────────────────────────────────────────
const k = kopfAusMatch(kopf, cfg)
ok(k.section === 'POST' && k.toreHeim === 2 && k.toreGast === 2, 'Kopf: POST 2:2')
ok(k.heimIstSva === true, 'Kopf: SVA ist Heim')
ok(k.autorId === 224890 && k.autorName === 'Niko', 'Kopf: Autor-ID + Vorname')
ok(k.tickerTyp === 'live', 'Kopf: tickerTyp live')

// ── Stream (echtes Spiel) ─────────────────────────────────────────────────────
const ctx = { heimIstSva: true, svaTeamSlug: cfg.teamSlug, rosterByFupaId: new Map([[1792205, 'uuid-bruenjes'], [2160027, 'uuid-pejas']]), textAutorErlaubt: false, anstoss: new Date('2026-10-04T13:00:00Z'), anpfiffAt: null, fupaMatchId: kopf.id }
const soll = ereignisseAusStream(stream, ctx)
const nach = (t) => soll.filter((r) => r.typ === t)
ok(nach('tor').length + nach('gegentor').length === 4, '4 Tore gesamt (tor+gegentor)')
ok(nach('gelb').length === 1 && nach('gelb')[0].team === 'gegner', '1 Gelb, Gegner')
ok(nach('wechsel').length + soll.filter((r) => r.typ === 'wechsel_gegner').length === 7, '7 Wechsel gesamt')
ok(nach('anpfiff').length === 1 && nach('halbzeit').length === 1 && nach('wiederanpfiff').length === 1 && nach('abpfiff').length === 1, 'alle vier Pfiffe')
ok(soll.every((r) => r.text === null || r.text_quelle !== 'reporter'), 'ohne Freigabe: keine Reportertexte')
ok(soll.every((r) => r.fupa_event_id != null), 'jede Zeile hat fupa_event_id')
// Wechsel „Janek Brünjes für Elias Pejas": primary = rein = Brünjes
const w = nach('wechsel').find((r) => r.roster_id === 'uuid-bruenjes')
ok(w && w.roster_id === 'uuid-bruenjes' && w.roster_id_2 === 'uuid-pejas', 'Wechsel: rein=Brünjes, raus=Pejas (primary=rein)')
// Abpfiff 90+5
const ab = nach('abpfiff')[0]
ok(ab.nachspielzeit === 5, 'Abpfiff 90+5 (Nachspielzeit 5)')
// unbekannte Typen (text/news/lineupentered) weggelassen
ok(!soll.some((r) => r.typ === 'kommentar'), 'ohne Freigabe: Textzeilen weggelassen')

// ── Synthetischer Zeitpunkt: Pfiff-Reihenfolge = chronologisch ────────────────
const mz = mitZeitpunkten(soll, ctx)
const tp = (t) => new Date(mz.find((r) => r.typ === t).zeitpunkt).getTime()
ok(tp('anpfiff') < tp('halbzeit') && tp('halbzeit') < tp('wiederanpfiff') && tp('wiederanpfiff') < tp('abpfiff'),
  'Pfiffe chronologisch über den synthetischen Zeitpunkt')

// ── Heim/Auswärts gespiegelt ──────────────────────────────────────────────────
const torEvt = { type: 'matchevent', entity: { id: 9001, minute: 10, additionalMinute: 0, type: 'goal', subtype: 'goal_shoot', team: { slug: cfg.teamSlug }, homeGoal: 1, awayGoal: 0, primaryRole: { player: { id: 1792205, firstName: 'Janek', lastName: 'Brünjes' } } } }
const heimSoll = ereignisseAusStream([torEvt], { ...ctx, heimIstSva: true })
ok(heimSoll[0].typ === 'tor' && heimSoll[0].roster_id === 'uuid-bruenjes', 'SVA Heim: eigenes Tor → tor + roster')
const torEvtAway = { type: 'matchevent', entity: { ...torEvt.entity, id: 9002, homeGoal: 0, awayGoal: 1 } }
const awaySoll = ereignisseAusStream([torEvtAway], { ...ctx, heimIstSva: false })
ok(awaySoll[0].typ === 'tor', 'SVA Auswärts: Auswärts-Stand steigt → tor')

// ── Eigentor über den Stand entschieden ───────────────────────────────────────
const egSva = { type: 'matchevent', entity: { id: 9100, minute: 20, type: 'goal', subtype: 'goal_own_goal', team: { slug: 'deinster-sv-m1-2026-27' }, homeGoal: 1, awayGoal: 0, primaryRole: null } }
const egSollSva = ereignisseAusStream([egSva], { ...ctx, heimIstSva: true })
ok(egSollSva[0].typ === 'tor' && egSollSva[0].zusatz === 'Eigentor' && !egSollSva[0].roster_id, 'Eigentor: SVA-Stand steigt → tor „Eigentor" ohne Roster')
// Sequenz: erst SVA 1:0, dann Eigentor zum 1:1 (nur Auswärts-/Gegner-Stand steigt)
const seq = [
  { type: 'matchevent', entity: { id: 9100, minute: 20, type: 'goal', subtype: 'goal_shoot', team: { slug: cfg.teamSlug }, homeGoal: 1, awayGoal: 0, primaryRole: { player: { id: 1792205, firstName: 'J', lastName: 'B' } } } },
  { type: 'matchevent', entity: { id: 9101, minute: 21, type: 'goal', subtype: 'goal_own_goal', team: { slug: cfg.teamSlug }, homeGoal: 1, awayGoal: 1, primaryRole: null } },
]
const egSollGeg = ereignisseAusStream(seq, { ...ctx, heimIstSva: true })
const egZeile = egSollGeg.find((r) => r.fupa_event_id === 9101)
ok(egZeile.typ === 'gegentor' && egZeile.zusatz === 'Eigentor', 'Eigentor: Gegner-Stand steigt → gegentor „Eigentor"')

// ── Stand schlägt team (Absicherung) ──────────────────────────────────────────
const widerspruch = { type: 'matchevent', entity: { id: 9200, minute: 30, type: 'goal', subtype: 'goal_shoot', team: { slug: cfg.teamSlug }, homeGoal: 0, awayGoal: 1, primaryRole: { player: { id: 1, firstName: 'X', lastName: 'Y' } } } }
const wSoll = ereignisseAusStream([widerspruch], { ...ctx, heimIstSva: true })
ok(wSoll[0].typ === 'gegentor', 'Widerspruch team vs. Stand → Stand gewinnt (gegentor)')

// ── Text nur mit Freigabe ─────────────────────────────────────────────────────
const mitText = { type: 'matchevent', entity: { id: 9300, minute: 40, type: 'goal', subtype: 'goal_shoot', text: 'Traumtor!', team: { slug: cfg.teamSlug }, homeGoal: 1, awayGoal: 0, primaryRole: { player: { id: 1792205, firstName: 'Janek', lastName: 'Brünjes' } } } }
const frei = ereignisseAusStream([mitText], { ...ctx, textAutorErlaubt: true })
ok(frei[0].text === 'Traumtor!' && frei[0].text_quelle === 'reporter', 'mit Freigabe: Reportertext 1:1')
const unfrei = ereignisseAusStream([mitText], { ...ctx, textAutorErlaubt: false })
ok(unfrei[0].text === null && unfrei[0].text_quelle === 'vorlage', 'ohne Freigabe: Fakt ohne Text (Vorlage)')

// ── Clamping Minute ───────────────────────────────────────────────────────────
const hoch = { type: 'matchevent', entity: { id: 9400, minute: 200, type: 'card', subtype: 'card_red', team: { slug: cfg.teamSlug }, primaryRole: { player: { id: 1792205, firstName: 'J', lastName: 'B' } } } }
ok(ereignisseAusStream([hoch], ctx)[0].minute === 130, 'Minute auf 130 geclampt')

// ── Unbekannte Typen ignoriert ────────────────────────────────────────────────
const unbekannt = [{ type: 'matchevent', entity: { id: 1, type: 'timepenalty' } }, { type: 'news', entity: { id: 2 } }, { type: 'matchevent', entity: { id: 3, type: 'lineupentered' } }]
ok(ereignisseAusStream(unbekannt, ctx).length === 0, 'timepenalty/news/lineupentered ignoriert')

// ── Aufstellung ───────────────────────────────────────────────────────────────
const auf = aufstellungAusLineup(lineup, true)
ok(auf.length >= 11 && auf.every((s) => s.fupaId && s.vorname && typeof s.minuten !== 'undefined'), 'Aufstellung: Spieler mit FuPa-ID + Minuten')
ok(!JSON.stringify(auf).includes('birthday') && !JSON.stringify(auf).includes('image'), 'Aufstellung: keine birthday/image-Felder')

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
