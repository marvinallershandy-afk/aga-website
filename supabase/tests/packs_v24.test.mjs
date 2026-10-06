// PGlite-Test v24-P „Pack-Typen“ (20261017100000_sva_album_packs_v24.sql):
// Bestand bleibt unverändert, Pack-Typen (Größe, Garantie, Optik, Wochen-Slot),
// Tipp-Pack über tipp_abgeben (packId + pack), tipp_lage().tippPack, Spieltags-,
// Sieg- (auch für Tipper ohne Check-in), Derby-/Event-Pack, Event-Code,
// Wochen-Slot (MOTM der Woche), Smart-Pack ab 2 Karten, Rechte/RLS,
// Pack-Kontrolle + Nachliefern.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/packs_v24.test.mjs <pg-ordner>/ && MIGRATIONS=<repo>/supabase/migrations/ node packs_v24.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261017100000_sva_album_packs_v24.sql'
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role; create role supabase_storage_admin;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select nullif(auth.jwt() ->> 'sub', '')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(auth.jwt() ->> 'role', 'anon') $$;
create table storage.buckets (id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now(), updated_at timestamptz default now(), owner uuid);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, metadata jsonb, created_at timestamptz default now(), updated_at timestamptz default now());
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql as $$ select string_to_array(name, '/') $$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
`)
let fails = 0
let oks = 0
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++; else oks++ }
const run = async (f) => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('OK   migration', f) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) } }
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
for (const f of files.filter((f) => f < NEU)) await run(f)

const claims = (uid, email) => JSON.stringify({ sub: uid, email, role: 'authenticated' })
const as = async (uid, email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(uid, email)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => { await db.exec(`set role anon;`); try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) } }
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 90)) }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const val = async (sql, params) => Object.values((await db.query(sql, params)).rows[0])[0]
const rpc = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]
let nU = 0
const user = async (email) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, '{"app":"sva-album"}') returning id`, [email ?? `fan${++nU}@x.example`])).id
const fanVon = (id, mail) => (sql, p) => as(id, mail, sql, p)
// Hilfs-Spiele ohne Tipp-Runde (sonst sperren sie als „wartet auf Wertung“ das Tipp-Spiel)
const keinTipp = (id) => db.query(`insert into sva_tipp_spieltage (spiel_id, tippbar) values ($1, false) on conflict (spiel_id) do update set tippbar = false`, [id])

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const CHEF = await user('chef@sva.de')
const admin = fanVon(CHEF, 'chef@sva.de')
await admin(`select album_admin_katalog_standard()`)

// ── 1. Bestand VOR der Migration ────────────────────────────────────────────
const LENA = await user('lena@fan.example')
const lena = fanVon(LENA, 'lena@fan.example')
await lena(`select album_profil_speichern('Lena', 'B', true, false, true)`)
const altStarter = (await rpc(lena, `select album_starter_holen()`)).packId
const ALT_SPIEL = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('TSV Alt', true, now() - interval '20 minutes') returning id`)).id
await keinTipp(ALT_SPIEL)
const altToken = (await rpc(admin, `select album_admin_code($1)`, [ALT_SPIEL])).token
const altCi = await rpc(lena, `select album_checkin($1)`, [altToken])
await rpc(lena, `select album_pack_oeffnen($1)`, [altStarter])
const besitzVorher = JSON.stringify((await db.query(`select fan_user_id, karte_id, anzahl from sva_album_besitz order by 1, 2`)).rows)
const packsVorher = JSON.stringify((await db.query(`select id, art, karten, seltenheiten, geoeffnet_at from sva_album_packs order by id`)).rows)
const settingsVorher = await one(`select doppelte_bremse, wunsch_kosten from sva_album_einstellungen`)

await defaults()
await run(NEU)
await run(NEU) // idempotent + entzieht Default-Rechte wieder
for (const f of files.filter((f) => f > NEU)) await run(f) // spätere Migrationen (v25 …) obendrauf
// v25: Check-in-Rotation lehnt statische Tokens ab — die Tests checken mit dem statischen Code ein
await db.exec(`update sva_album_einstellungen set checkin_rotation = false where id = 1`)

ok(JSON.stringify((await db.query(`select fan_user_id, karte_id, anzahl from sva_album_besitz order by 1, 2`)).rows) === besitzVorher, 'Bestand: Besitz der Fans unverändert')
ok(JSON.stringify((await db.query(`select id, art, karten, seltenheiten, geoeffnet_at from sva_album_packs order by id`)).rows) === packsVorher, 'Bestand: Packs (Karten, Seltenheiten, geöffnet) unverändert')
ok((await val(`select count(*)::int n from sva_album_packs where typ is not null`)) === 0, 'Bestand: alte Packs bekommen keinen typ in der Tabelle')
let mein = await rpc(lena, `select album_mein()`)
ok(mein.packs.length === 1 && mein.packs[0].id === altCi.packId && mein.packs[0].typ === 'spieltag', 'album_mein: altes Check-in-Pack zeigt Typ „spieltag“ (nur Anzeige)')

// ── 2. Pack-Typen + Einstellungen ───────────────────────────────────────────
const typen = Object.fromEntries((await db.query(`select * from sva_album_pack_typen`)).rows.map((t) => [t.typ, t]))
ok(Object.keys(typen).length === 6, 'sva_album_pack_typen: 6 Typen (nach 2 Läufen)')
ok(typen.tipp.karten === 2 && typen.tipp.min_seltenheit === null && typen.tipp.limitiert_chance === 8 && typen.tipp.optik === 'klein' && typen.tipp.reveal === 1,
  'Tipp-Pack: 2 Karten, Standard-Chancen, Wochen-Slot 8 %, Optik klein, Reveal 1')
ok(typen.spieltag.karten === 4 && typen.spieltag.min_seltenheit === 'silber' && typen.spieltag.limitiert_chance === 30, 'Spieltags-Pack: 4 Karten, mind. Silber, Slot 30 %')
ok(typen.sieg.karten === 2 && typen.sieg.min_seltenheit === 'gold' && typen.sieg.reveal === 3, 'Sieg-Pack: 2 Karten, mind. Gold, Reveal 3')
ok(typen.starter.karten === 5 && typen.starter.min_seltenheit === 'silber' && typen.starter.limitiert_chance === 0, 'Starter-Pack: 5 Karten, mind. Silber (aus karten_starter/starter_min_silber)')
ok(typen.ziel.karten === 1 && typen.event.karten === 3 && typen.event.limitiert_chance === 60, 'Ziel 1 (Kapitel-Bonus), Event 3 Karten mit 60 %')
const e1 = await one(`select doppelte_bremse, wunsch_kosten, smart_ab_karten from sva_album_einstellungen`)
ok(settingsVorher.doppelte_bremse === 25 && e1.doppelte_bremse === 5 && e1.wunsch_kosten === 5 && e1.smart_ab_karten === 2, 'Ökonomie v24: Bremse 25 → 5, Wunsch 3 → 5, Smart ab 2 Karten')
await expectErr(db.query(`update sva_album_pack_typen set karten = 11 where typ = 'tipp'`), 'Karten höchstens 10')
await expectErr(db.query(`update sva_album_pack_typen set limitiert_chance = 101 where typ = 'tipp'`), 'Chance höchstens 100 %')
await expectErr(db.query(`insert into sva_album_pack_typen (typ, titel, karten, optik) values ('gold', 'Gold', 3, 'gold')`), 'Kein fremder Pack-Typ')

// RLS / Rechte
const MIA = await user('mia@fan.example')
const mia = fanVon(MIA, 'mia@fan.example')
ok((await mia(`select * from sva_album_pack_typen`)).rows.length === 0, 'Fan liest sva_album_pack_typen nicht')
ok((await mia(`update sva_album_pack_typen set karten = 10 returning typ`)).rows.length === 0, 'Fan ändert keine Pack-Typen')
await expectErr(asAnon(`select * from sva_album_pack_typen`), 'anon: kein Zugriff auf Pack-Typen', /permission denied/)
ok((await admin(`update sva_album_pack_typen set beschreibung = 'Test' where typ = 'tipp' returning typ`)).rows.length === 1, 'Admin ändert Pack-Typen (RLS)')
await expectErr(admin(`delete from sva_album_pack_typen where typ = 'tipp'`), 'Admin löscht keine Pack-Typen', /permission denied/)
for (const fn of [`sva_album_pack_ziehen_v24('${MIA}', 'tipp', 'tipp')`, `sva_album_pack_soll()`, `sva_album_katalog_v22()`, `sva_tipp_lage_v22()`]) {
  await expectErr(mia(`select ${fn}`), `Fan darf ${fn.split('(')[0]} nicht`, /permission denied/)
}
await expectErr(mia(`select sva_admin_pack_kontrolle()`), 'Fan: keine Pack-Kontrolle', /album_kein_admin/)
await expectErr(mia(`select album_admin_pack_nachliefern('alle')`), 'Fan: kein Nachliefern', /album_kein_admin/)

// Katalog
const kat = await rpc(asAnon, `select album_katalog()`)
ok(Array.isArray(kat.regeln.packTypen) && kat.regeln.packTypen.length === 6 && kat.regeln.packTypen[0].typ === 'tipp'
  && kat.regeln.packTypen.find((t) => t.typ === 'sieg').minSeltenheit === 'gold' && kat.regeln.packTypen.find((t) => t.typ === 'event').limitiertChance === 60,
  'album_katalog: regeln.packTypen (sortiert, Garantie, Slot-Chance)')
ok(kat.regeln.kartenProPack === 3 && kat.regeln.shinyChance === 250 && kat.karten.length > 0, 'Katalog sonst unverändert (v22-Felder, Karten)')

// ── 3. Tipp-Liga: Tipp-Pack ─────────────────────────────────────────────────
const G = (await admin(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb) values ('SG Lühe', true, now() + interval '2 days', 'Kreisliga Stade') returning id`)).rows[0].id
await mia(`select tipp_beitreten('Mia', 'M', true, true, true)`)
let r = await rpc(mia, `select tipp_abgeben($1, 2, 1) j`, [G])
ok(r.ok && r.neu && r.karte === true && r.pack?.typ === 'tipp' && r.pack.karten === 2 && r.pack.titel === 'Tipp-Pack' && r.packId === r.pack.id, 'tipp_abgeben: Tipp-Pack · 2 Karten (packId + pack)')
const tippPack = r.packId
r = await rpc(mia, `select tipp_abgeben($1, 3, 1) j`, [G])
ok(r.ok && !r.neu && r.karte === false && !r.pack && !r.packId, 'Tipp ändern → kein zweites Pack, kein pack im Ergebnis')
ok((await val(`select count(*)::int n from sva_album_packs where fan_user_id = $1 and art = 'tipp'`, [MIA])) === 1, 'Genau 1 Tipp-Pack')
const lage = await rpc(asAnon, `select tipp_lage()`)
ok(lage.tippPack?.titel === 'Tipp-Pack' && lage.tippPack.karten === 2 && lage.offen?.id === G && Array.isArray(lage.kader), 'tipp_lage: tippPack {Tipp-Pack, 2} + v22-Inhalt')
mein = await rpc(mia, `select album_mein()`)
ok(mein.packs.some((p) => p.id === tippPack && p.typ === 'tipp' && p.anzahl === 2 && p.titel === 'Tipp-Pack'), 'album_mein: Tipp-Pack sofort sichtbar (typ, 2 Karten)')
const op = await rpc(mia, `select album_pack_oeffnen($1)`, [tippPack])
ok(op.typ === 'tipp' && op.titel === 'Tipp-Pack' && op.karten.length === 2 && op.karten[0].neu === true, 'album_pack_oeffnen: typ tipp, 2 Karten, erste neu (Smart-Pack)')
await db.exec(`update sva_album_pack_typen set karten = 0 where typ = 'tipp'`)
ok(!('tippPack' in (await rpc(asAnon, `select tipp_lage()`))), 'Tipp-Pack aus (0 Karten) → tipp_lage ohne tippPack')
await db.exec(`update sva_album_pack_typen set karten = 2 where typ = 'tipp'`)

// ── 4. Spieltags-Pack (Check-in) ───────────────────────────────────────────
const H = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('TuS Harsefeld', true, now() - interval '15 minutes') returning id`)).id
await keinTipp(H)
const helfer = []
for (let i = 0; i < 25; i++) helfer.push(await user())
await db.exec(`do $$ declare u uuid; begin foreach u in array array['${helfer.join("','")}']::uuid[] loop perform sva_album_pack_ziehen(u, '${H}', 'checkin'); end loop; end $$;`)
const sp = (await db.query(`select * from sva_album_packs where spiel_id = $1 and art = 'checkin'`, [H])).rows
ok(sp.length === 25 && sp.every((p) => p.typ === 'spieltag' && p.titel === 'Spieltags-Pack' && p.karten.length === 4), 'Check-in → Spieltags-Pack (typ, Titel, 4 Karten)')
ok(sp.every((p) => p.seltenheiten.some((s) => s !== 'bronze')), 'Spieltags-Pack: immer mind. 1 Silber oder besser (25 Packs)')
await db.exec(`do $$ declare u uuid; begin foreach u in array array['${helfer.join("','")}']::uuid[] loop perform sva_album_pack_ziehen(u, '${H}', 'checkin'); end loop; end $$;`)
ok((await val(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'checkin'`, [H])) === 25, 'Zweiter Aufruf je Fan+Spiel → kein zweites Pack')

// ── 5. Sieg-Pack: Tipper ODER Check-in ─────────────────────────────────────
const TOM = await user('tom@fan.example')
const tom = fanVon(TOM, 'tom@fan.example')
await tom(`select tipp_beitreten('Tom', 'K', true, true, true)`)
await rpc(tom, `select tipp_abgeben($1, 1, 0) j`, [G])
const OLE = await user('ole@fan.example')
const ole = fanVon(OLE, 'ole@fan.example')
await ole(`select album_profil_speichern('Ole', 'K', false, false, true)`)
await db.exec(`update sm_spiele set anstoss = now() - interval '10 minutes' where id = '${G}'`) // Anpfiff
const gToken = (await rpc(admin, `select album_admin_code($1)`, [G])).token
ok((await rpc(ole, `select album_checkin($1)`, [gToken])).ok, 'Ole checkt ein (ohne Tipp)')
await expectErr(ole(`select album_checkin($1)`, [gToken]), 'Doppelter Check-in → abgelehnt', /album_schon_eingecheckt/)
await admin(`update sm_spiele set tore_sva = 2, tore_gegner = 0 where id = $1`, [G])
const sieg = (await db.query(`select fan_user_id, typ, titel, karten, seltenheiten from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [G])).rows
const siegFans = new Set(sieg.map((p) => p.fan_user_id))
ok(siegFans.has(MIA) && siegFans.has(TOM) && siegFans.has(OLE) && sieg.length === 3, 'Heimsieg → Sieg-Pack für Tipper (Mia, Tom) UND Eingecheckte (Ole), je 1')
ok(sieg.every((p) => p.typ === 'sieg' && p.titel === 'Sieg-Pack' && p.karten.length === 2 && p.seltenheiten.some((s) => s === 'gold' || s === 'spezial')), 'Sieg-Pack: 2 Karten, mind. 1 Gold')
await admin(`update sm_spiele set tore_sva = 3 where id = $1`, [G])
await db.exec(`select sva_album_heimsieg_bonus('${G}')`)
ok((await val(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [G])) === 3, 'Ergebnis-Korrektur + erneuter Bonus-Lauf → keine Doppel')
// Wertung (gewertet_at) löst den Bonus ebenfalls aus — idempotent
await db.exec(`update sva_tipp_spieltage set gewertet_at = now() where spiel_id = '${G}'`)
ok((await val(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [G])) === 3, 'Wertung → Sieg-Packs bleiben genau 3')
const N = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('VfL Niederlage', true, now() - interval '1 hour') returning id`)).id
await keinTipp(N)
await rpc(ole, `select album_checkin($1)`, [(await rpc(admin, `select album_admin_code($1)`, [N])).token])
await admin(`update sm_spiele set tore_sva = 0, tore_gegner = 1 where id = $1`, [N])
ok((await val(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [N])) === 0, 'Niederlage → kein Sieg-Pack')

// ── 6. Wochen-Slot: MOTM-Karte der Woche ───────────────────────────────────
const ROSTER = (await one(`select id from sm_roster where aktiv and rolle = 'spieler' order by sortierung nulls last limit 1`)).id
const motm = await rpc(admin, `select album_admin_motm($1, $2)`, [ROSTER, G])
const MOTM = motm.id
ok(!!MOTM && new Date(motm.ziehbarVon) <= new Date() && new Date(motm.ziehbarBis) > new Date(), 'MOTM-Karte der Woche: ziehbar jetzt (Mo–So)')
await db.exec(`update sva_album_pack_typen set limitiert_chance = 100 where typ = 'tipp'`)
const slot = []
for (let i = 0; i < 12; i++) slot.push(await user())
for (const [i, u] of slot.entries()) await db.query(`select sva_album_pack_ziehen_v24($1, 'tipp', 'tipp', null, null, $2, 'Tipp-Pack')`, [u, 'tipp:slot' + i])
const sl = (await db.query(`select p.karten, (select bool_and(not k.variante and not k.limitiert) from sva_album_karten k where k.id = p.karten[1]) erste_album
                              from sva_album_packs p where p.quelle like 'tipp:slot%'`)).rows
ok(sl.length === 12 && sl.every((p) => p.karten.length === 2 && p.karten[1] === MOTM && p.erste_album), 'Slot 100 %: MOTM ersetzt die letzte Karte, erste bleibt die Smart-Karte')
// wer sie schon hat, bekommt sie nicht noch einmal
await db.query(`select sva_album_pack_ziehen_v24($1, 'tipp', 'tipp', null, null, 'tipp:slot-wieder', 'Tipp-Pack')`, [slot[0]])
ok(!(await one(`select karten from sva_album_packs where quelle = 'tipp:slot-wieder'`)).karten.includes(MOTM), 'Fan hat die Wochenkarte schon (im ungeöffneten Pack) → nicht noch einmal')
await db.exec(`update sva_album_pack_typen set limitiert_chance = 0 where typ = 'tipp'`)
let ohneSlot = 0
for (let i = 0; i < 30; i++) {
  const u = await user()
  const pid = (await one(`select sva_album_pack_ziehen_v24($1, 'tipp', 'tipp', null, null, 'tipp:x', 'Tipp-Pack') id`, [u])).id
  if ((await one(`select karten from sva_album_packs where id = $1`, [pid])).karten.includes(MOTM)) ohneSlot++
}
ok(ohneSlot === 0, `Slot 0 %: MOTM nie (Wochenkarten nur über den Slot, nicht über die Spezial-Ziehung) (${ohneSlot}/30)`)
await db.exec(`update sva_album_pack_typen set limitiert_chance = 8 where typ = 'tipp'`)
// außerhalb des Fensters nie
await db.exec(`update sva_album_karten set ziehbar_von = now() - interval '14 days', ziehbar_bis = now() - interval '7 days' where id = '${MOTM}';
               update sva_album_pack_typen set limitiert_chance = 100 where typ = 'spieltag'`)
const spaet = await user()
const ps = (await one(`select sva_album_pack_ziehen($1, null, 'checkin') id`, [spaet])).id
ok(!(await one(`select karten from sva_album_packs where id = $1`, [ps])).karten.includes(MOTM), 'Ziehfenster vorbei → keine MOTM-Karte, auch bei 100 %')
await db.exec(`update sva_album_karten set ziehbar_von = now() - interval '1 day', ziehbar_bis = now() + interval '6 days' where id = '${MOTM}';
               update sva_album_pack_typen set limitiert_chance = 30 where typ = 'spieltag'`)

// ── 7. Derby-Check-in = Event-Pack, Event-Code ─────────────────────────────
const D = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('VfL Derby', true, now() - interval '5 minutes') returning id`)).id
await keinTipp(D)
const DK = (await one(`insert into sva_album_karten (typ, titel, seltenheit, limitiert, nur_spiel_id, saison) values ('moment', 'Derby-Sieger', 'spezial', true, $1, '2026/27') returning id`, [D])).id
await db.exec(`update sva_album_pack_typen set limitiert_chance = 100 where typ = 'event'`)
const df = await user()
const dpId = await val(`select sva_album_pack_ziehen($1, $2, 'checkin') id`, [df, D])
const dp = await one(`select * from sva_album_packs where id = $1`, [dpId])
ok(dp.typ === 'event' && dp.art === 'checkin' && dp.titel === 'Derby-Pack' && dp.karten.length === 4 && dp.seltenheiten.some((s) => s !== 'bronze'), 'Derby-Check-in → Event-Pack (Derby-Pack, 4 Karten wie Spieltag, mind. Silber)')
ok(dp.karten.includes(DK) || dp.karten.includes(MOTM), 'Event-Slot 100 %: Derby- bzw. Wochenkarte im Pack')
const code = await rpc(admin, `select album_admin_story_code('event', 'MOTM-Woche', $1, null, 48)`, [MOTM])
ok(/^EVENT-[A-Z0-9]{5}$/.test(code.code), 'Admin: Event-Code ' + code.code)
ok((await one(`select karten, art from sva_album_codes where id = $1`, [code.id])).karten === 3, 'Event-Code: Kartenzahl aus dem Pack-Typ (3)')
const EVA = await user('eva@fan.example')
const eva = fanVon(EVA, 'eva@fan.example')
await eva(`select album_profil_speichern('Eva', 'S', false, false, true)`)
const ein = await rpc(eva, `select album_code_einloesen($1)`, [code.code])
const ep = await one(`select * from sva_album_packs where id = $1`, [ein.packId])
ok(ein.ok && ein.typ === 'event' && ep.typ === 'event' && ep.art === 'event' && ep.karten.length === 3 && ep.karten.includes(MOTM) && ep.karten[0] !== MOTM,
  'Event-Code einlösen → Event-Pack, 3 Karten, Event-Karte (MOTM) als letzte Karte, erste bleibt Smart')
ok((await rpc(eva, `select album_code_einloesen($1)`, [code.code])).grund === 'schon', 'Event-Code 1× pro Konto')
await db.exec(`update sva_album_pack_typen set limitiert_chance = 60 where typ = 'event'`)
await expectErr(admin(`select album_admin_story_code('quatsch', 'X')`), 'Unbekannte Code-Art → abgelehnt', /album_ungueltig:art/)

// ── 8. Smart-Pack ab 2 Karten, Smart je Typ ────────────────────────────────
const variantenErste = async (fn, n = 40) => {
  let v = 0
  const u = await user()
  for (let i = 0; i < n; i++) {
    const pid = (await one(`select ${fn} id`, [u])).id
    if ((await one(`select k.variante from sva_album_packs p join sva_album_karten k on k.id = p.karten[1] where p.id = $1`, [pid])).variante) v++
  }
  return v
}
const ein1 = await variantenErste(`sva_album_pack_ziehen_v24($1, 'geschenk', null, null, 1)`)
ok(ein1 > 0, `Einzelkarte (1 Karte) ist nicht smart: erste Karte auch mal eine Glanz-Variante (${ein1}/40)`)
await db.exec(`update sva_album_einstellungen set smart_ab_karten = 1`)
ok((await variantenErste(`sva_album_pack_ziehen_v24($1, 'geschenk', null, null, 1)`, 20)) === 0, 'smart_ab_karten = 1 → auch Einzelkarten smart')
await db.exec(`update sva_album_einstellungen set smart_ab_karten = 2; update sva_album_pack_typen set smart = false where typ = 'tipp'`)
ok((await variantenErste(`sva_album_pack_ziehen_v24($1, 'tipp', 'tipp', null)`)) > 0, 'Pack-Typ smart = false → erste Karte nicht garantiert neu')
await db.exec(`update sva_album_pack_typen set smart = true where typ = 'tipp'`)

// ── 9. Starter, Kapitel, Ziel ──────────────────────────────────────────────
const st = await user()
await db.query(`insert into sva_album_fans (user_id, vorname, initial, einwilligung_at) values ($1, 'Sam', 'S', now())`, [st])
const stp = await one(`select * from sva_album_packs where id = $1`, [await val(`select sva_album_pack_ziehen($1, null, 'starter') id`, [st])])
ok(stp.typ === 'starter' && stp.titel === 'Starter-Pack' && stp.karten.length === 5 && stp.quelle === 'starter', 'Starter-Pack: typ, 5 Karten, Quelle „starter“ (idempotent)')
ok((await val(`select sva_album_pack_ziehen($1, null, 'starter') id`, [st])) === null, 'Starter nur einmal')

// ── 10. Pack-Kontrolle + Nachliefern ───────────────────────────────────────
let k = await rpc(admin, `select sva_admin_pack_kontrolle()`)
const tippAnlass = `spiel:${G}:tipp`
ok(typeof k.ok === 'boolean' && Array.isArray(k.anlaesse) && k.anlaesse.some((a) => a.anlass === tippAnlass && a.soll === 2 && a.ist === 2), 'Kontrolle: Tipp-Anlass Soll 2 = Ist 2 ' + JSON.stringify(k.anlaesse.find((a) => a.anlass === tippAnlass)))
ok(k.anlaesse.some((a) => a.anlass === `spiel:${G}:sieg` && a.soll === 3 && a.ist === 3 && a.fehlend === 0), 'Kontrolle: Sieg-Anlass 3/3')
// alle Fans mit Profil > 10 min ohne Starter würden fehlen → Profile hier frisch, also nicht im Soll
ok(k.doppelt === 0, 'Kontrolle: keine Doppelten')
await db.exec(`delete from sva_album_packs where fan_user_id = '${TOM}' and spiel_id = '${G}' and art = 'heimsieg'`)
k = await rpc(admin, `select sva_admin_pack_kontrolle()`)
const sa = k.anlaesse.find((a) => a.anlass === `spiel:${G}:sieg`)
ok(!k.ok && sa.fehlend === 1 && sa.fans.includes('Tom K.') && k.anlaesse[0].anlass === sa.anlass, 'Kontrolle: fehlendes Sieg-Pack erkannt (Tom K.), Abweichung steht oben')
let nl = await rpc(admin, `select album_admin_pack_nachliefern($1)`, [sa.anlass])
ok(nl.nachgeliefert === 1 && nl.offen === 0, 'Nachliefern: 1 Pack, danach 0 offen')
nl = await rpc(admin, `select album_admin_pack_nachliefern($1)`, [sa.anlass])
ok(nl.nachgeliefert === 0, 'Nachliefern zweimal → nichts doppelt')
await expectErr(admin(`select album_admin_pack_nachliefern('drop table x')`), 'Ungültiger Anlass → abgelehnt', /album_ungueltig:anlass/)
k = await rpc(admin, `select sva_admin_pack_kontrolle()`)
ok(k.anlaesse.find((a) => a.anlass === sa.anlass).fehlend === 0, 'Kontrolle danach: Sieg-Anlass vollständig')

console.log(fails ? `\n${fails} FEHLER` : `\nALLES GRÜN (${oks} Prüfungen)`)
process.exit(fails ? 1 : 0)
