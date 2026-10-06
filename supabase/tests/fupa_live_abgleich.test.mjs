// Node-Test des Abgleichs Soll↔Ist + Pult-Duplikate + Platzhalter (abgleich.mjs).
// node supabase/tests/fupa_live_abgleich.test.mjs
import { abgleichen } from '../functions/fupa-live/abgleich.mjs'
let fails = 0
const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fails++ }

const soll = (fid, typ, extra = {}) => ({ fupa_event_id: fid, typ, minute: extra.minute ?? null, nachspielzeit: null, roster_id: extra.roster_id ?? null, roster_id_2: null, text: null, text_quelle: 'vorlage', fupa_name: null, fupa_name_2: null, team: extra.team ?? null, platzhalter: false, zeitpunkt: '2026-10-04T13:10:00Z', ...extra })
const ist = (fid, typ, extra = {}) => ({ id: 'id-' + fid, fupa_event_id: fid, typ, minute: extra.minute ?? null, roster_id: extra.roster_id ?? null, roster_id_2: null, text: extra.text ?? null, text_quelle: extra.text_quelle ?? 'vorlage', fupa_name: null, fupa_name_2: null, team: extra.team ?? null, platzhalter: extra.platzhalter ?? false, gesperrt: extra.gesperrt ?? false, versteckt: extra.versteckt ?? false, duplikat_von: extra.duplikat_von ?? null })

// ── 1. Einfügen + Pult-Duplikat (Minute 10 vs 11) versteckt ───────────────────
let r = abgleichen({
  soll: [soll(5001, 'anpfiff'), soll(5002, 'tor', { minute: 10, roster_id: 'u-brun', team: 'sva' })],
  ist: [],
  pultZeilen: [{ id: 'pult-anp', typ: 'anpfiff', minute: 1 }, { id: 'pult-tor', typ: 'tor', minute: 11, roster_id: 'u-brun' }],
})
const dupTor = r.einfuegen.find((e) => e.fupa_event_id === 5002)
ok(dupTor && dupTor.versteckt === true && dupTor.duplikat_von === 'pult-tor', 'Pult-Tor Minute 10 vs 11 → Bot-Tor versteckt + duplikat_von')
const dupAnp = r.einfuegen.find((e) => e.fupa_event_id === 5001)
ok(dupAnp && dupAnp.versteckt === true, 'Pfiff-Duplikat (anpfiff) → versteckt')

// ── 2. Kein Duplikat (Minute zu weit, 10 vs 20) ───────────────────────────────
r = abgleichen({ soll: [soll(5003, 'tor', { minute: 10, roster_id: 'u-x', team: 'sva' })], ist: [], pultZeilen: [{ id: 'p', typ: 'tor', minute: 20, roster_id: 'u-y' }] })
ok(r.einfuegen[0] && !r.einfuegen[0].versteckt, '|Δ Minute| > 3 → kein Duplikat (sichtbar)')

// ── 3. Ändern (Torschütze korrigiert) ─────────────────────────────────────────
r = abgleichen({ soll: [soll(6001, 'tor', { minute: 15, roster_id: 'u-neu', team: 'sva' })], ist: [ist(6001, 'tor', { minute: 15, roster_id: 'u-alt', team: 'sva' })], pultZeilen: [] })
ok(r.aendern.length === 1 && r.aendern[0].id === 'id-6001' && r.aendern[0].patch.roster_id === 'u-neu', 'geänderter Torschütze → aendern')

// ── 4. Gesperrte Zeile bleibt (nie ändern/löschen) ────────────────────────────
r = abgleichen({ soll: [], ist: [ist(6002, 'tor', { gesperrt: true })], pultZeilen: [] })
ok(r.loeschen.length === 0, 'gesperrte Zeile: kein Löschen, obwohl nicht mehr im Stream')
r = abgleichen({ soll: [soll(6003, 'tor', { minute: 20, roster_id: 'u-neu' })], ist: [ist(6003, 'tor', { minute: 20, roster_id: 'u-alt', gesperrt: true })], pultZeilen: [] })
ok(r.aendern.length === 0, 'gesperrte Zeile: kein Ändern')

// ── 5. Löschen (FuPa hat Ereignis entfernt) ───────────────────────────────────
r = abgleichen({ soll: [], ist: [ist(7001, 'tor')], pultZeilen: [] })
ok(r.loeschen.length === 1 && r.loeschen[0] === 'id-7001', 'fehlt im Stream → löschen')

// ── 6. Platzhalter aus Soft-Ticker-Stand (1:0, kein Ereignis) ─────────────────
r = abgleichen({ soll: [], ist: [], pultZeilen: [], kopf: { toreHeim: 1, toreGast: 0, minute: 30 }, heimIstSva: true, fupaMatchId: 15241638 })
const ph = r.einfuegen.filter((e) => e.platzhalter && e.typ === 'tor')
ok(ph.length === 1 && ph[0].fupa_event_id < 0 && ph[0].minute === 30, 'Soft-Ticker 1:0 → 1 Platzhalter-Tor (negative ID, Kopf-Minute)')

// ── 7. Echtes Tor ersetzt Platzhalter (kein Doppel) ───────────────────────────
r = abgleichen({ soll: [soll(8001, 'tor', { minute: 31, roster_id: 'u-brun', team: 'sva' })], ist: [ist(-1524163801, 'tor', { platzhalter: true, team: 'sva' })], pultZeilen: [], kopf: { toreHeim: 1, toreGast: 0, minute: 31 }, heimIstSva: true, fupaMatchId: 15241638 })
const neueTore = r.einfuegen.filter((e) => e.typ === 'tor' && !e.platzhalter)
const neuePH = r.einfuegen.filter((e) => e.platzhalter)
ok(neueTore.length === 1 && neuePH.length === 0 && r.loeschen.includes('id--1524163801'), 'echtes Tor kommt → Platzhalter gelöscht, kein Doppel')

// ── 8. Stand zurückgenommen (Tor annulliert) → Platzhalter weg ────────────────
r = abgleichen({ soll: [], ist: [ist(-1524163801, 'tor', { platzhalter: true, team: 'sva' })], pultZeilen: [], kopf: { toreHeim: 0, toreGast: 0, minute: 35 }, heimIstSva: true, fupaMatchId: 15241638 })
ok(r.loeschen.includes('id--1524163801'), 'Stand 1:0 → 0:0 zurückgenommen → Platzhalter gelöscht')

// ── 9. Progression v1→v2→final: Stände/Zählung stimmen am Ende ────────────────
// final: Anpfiff, Tor SVA, Gegentor, Gelb Gegner, Wechsel, Abpfiff — alles neu
const final = [soll(1, 'anpfiff'), soll(2, 'tor', { minute: 10, roster_id: 'u-a', team: 'sva' }), soll(3, 'gegentor', { minute: 20, fupa_name: 'Gast', team: 'gegner' }), soll(4, 'gelb', { minute: 25, team: 'gegner', fupa_name: 'Gast2' }), soll(5, 'wechsel', { minute: 60, roster_id: 'u-b', roster_id_2: 'u-a', team: 'sva' }), soll(6, 'abpfiff' )]
r = abgleichen({ soll: final, ist: [], pultZeilen: [], kopf: { toreHeim: 1, toreGast: 1, minute: 90 }, heimIstSva: true, fupaMatchId: 1 })
ok(r.einfuegen.length === 6 && r.einfuegen.filter((e) => e.platzhalter).length === 0, 'final: 6 Zeilen, keine Platzhalter (Stand voll durch echte Tore gedeckt)')

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
