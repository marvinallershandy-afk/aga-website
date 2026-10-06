// PGlite-Test der Migration 20261007100000_sva_album.sql: Katalog, Check-in
// (Token, Zeitfenster, Einmaligkeit), serverseitige Ziehung (Gewichte,
// Doppelten-Bremse), Pack öffnen, Belohnungen, Gutschein einlösen (v17-D: ohne PIN,
// 20261008110000_sva_album_gutschein_ohne_pin.sql),
// Heimsieg-Bonus, Rangliste, Konto löschen, Mediadaten in web_snapshot() —
// und MISSBRAUCH: Fan-Konto liest/schreibt Admin-Tabellen, ruft Admin-/interne
// Funktionen, öffnet fremde Packs, löst fremde Gutscheine ein.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/album.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node album.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261007100000_sva_album.sql'
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
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++ }
const run = async (f) => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('OK   migration', f) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) } }
// Supabase-Default-Privilegien nachbilden: neue Tabellen UND Funktionen sind
// für anon/authenticated freigegeben — die Migration muss selbst entziehen.
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
for (const f of fs.readdirSync(M).sort()) {
  if (f === NEU) await defaults() // Stand VOR der Album-Migration
  await run(f)
}
await defaults()
await run(NEU) // zweiter Lauf: idempotent + entzieht die Default-Rechte wieder
// v17-D: spätere Migrationen danach erneut (sonst stünde nach dem zweiten
// Album-Lauf wieder die alte PIN-Funktion da — echte Reihenfolge herstellen)
for (const f of fs.readdirSync(M).sort().filter((f) => f > NEU)) await run(f)
// v25-D: Diese Tests prüfen den statischen Check-in → Rotation (Standard an) hier aus.
await db.exec(`update public.sva_album_einstellungen set checkin_rotation = false where id = 1`).catch(() => {})

const claims = (uid, email) => JSON.stringify({ sub: uid, email, role: 'authenticated' })
const as = async (uid, email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(uid, email)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => {
  await db.exec(`set role anon;`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) }
}
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 100)) }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const count = async (sql, params) => (await one(sql, params)).n

// ── Personen ────────────────────────────────────────────────────────────────
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const user = async (email, app) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, app ? { app } : {}])).id
const CHEF = await user('chef@sva.de')
const TEAM = await user('team@sva.de')
const FAN1 = await user('marvin@fan.example')            // Login gab es schon (z. B. fremde App)
const FAN2 = await user('lena@fan.example', 'sva-album') // vom Album angelegt
const FAN3 = await user('ole@fan.example', 'sva-album')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const team = (sql, p) => as(TEAM, 'team@sva.de', sql, p)
const fan1 = (sql, p) => as(FAN1, 'marvin@fan.example', sql, p)
const fan2 = (sql, p) => as(FAN2, 'lena@fan.example', sql, p)
const fan3 = (sql, p) => as(FAN3, 'ole@fan.example', sql, p)
const rpc = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]

ok((await count(`select count(*)::int n from sva_album_einstellungen`)) === 1, 'Einstellungen: genau 1 Zeile (nach 2 Läufen)')
const e0 = await one(`select * from sva_album_einstellungen`)
// v20-K: neue Standards nach 20261012110000_sva_karten.sql (3/6/8, „Getränk nach Wahl“)
ok(e0.gewicht_bronze === 70 && e0.gewicht_silber === 22 && e0.gewicht_gold === 7 && e0.gewicht_spezial === 1 && e0.schwelle_1 === 3 && e0.schwelle_2 === 6 && e0.schwelle_3 === 8
  && e0.belohnung_1 === 'Getränk nach Wahl' && e0.belohnung_2 === 'Bratwurst + Getränk nach Wahl oder Fanartikel', 'Standard: 70/22/7/1, Schwellen 3, 6 und 8 (v20-K)')

// ── Katalog ────────────────────────────────────────────────────────────────
let r = await rpc(admin, `select album_admin_spielerkarten()`)
ok(r.bronze === 24 && r.gold === 1 && r.trainer === 3 && r.saison === '2026/27', 'Sticker aus Kader: 24 Bronze + 1 Gold (Kapitän) + 3 Trainerstab ' + JSON.stringify(r))
r = await rpc(admin, `select album_admin_spielerkarten()`)
ok(r.bronze === 0 && r.gold === 0, 'Spielerkarten zweimal erzeugen → keine Doppelten')
await expectErr(fan1(`select album_admin_spielerkarten()`), 'Fan darf keine Spielerkarten erzeugen', /album_kein_admin/)
await expectErr(team(`select album_admin_spielerkarten()`), 'Team-Zugang darf keine Spielerkarten erzeugen', /album_kein_admin/)
await admin(`insert into sm_sponsoren (name, aktiv, logo_url) values ('Mr. Döner', true, 'https://x.supabase.co/storage/v1/object/public/sva_public/sponsoren/d.png')`)
const DOENER = (await one(`select id from sm_sponsoren where name = 'Mr. Döner'`)).id
await admin(`insert into sva_album_karten (typ, titel, untertitel, seltenheit, saison) values
  ('moment', 'Meister 2026', 'Pokal-Moment', 'spezial', '2026/27'),
  ('fan', 'Die Kurve', 'Waldsportplatz', 'silber', '2026/27'),
  ('moment', 'Altes Album', null, 'gold', '2025/26')`)
await admin(`insert into sva_album_karten (typ, sponsor_id, titel, seltenheit) values ('partner', $1, 'Mr. Döner', 'silber')`, [DOENER])
await expectErr(admin(`insert into sva_album_karten (typ, titel, seltenheit) values ('trainer', 'X', 'bronze')`), 'Kartentyp geprüft')
await expectErr(admin(`insert into sva_album_karten (typ, titel, seltenheit) values ('fan', 'X Y', 'platin')`), 'Seltenheit geprüft')
await expectErr(admin(`insert into sva_album_karten (typ, titel, bild_url) values ('fan', 'Böse', 'javascript:alert(1)')`), 'Bild-URL nur https:// oder /')

let kat = await rpc(asAnon, `select album_katalog()`)
ok(kat.karten.length === 31 && kat.saison === '2026/27', 'anon: Katalog der Saison (24+1+3 Stab+3, ohne alte Saison) → ' + kat.karten.length)
ok(kat.karten.find((k) => k.typ === 'trainer')?.spieler?.rolle === 'trainer' && kat.karten[0].spieler.fotoUrl?.endsWith('.webp'), 'Katalog: Trainerstab mit Rolle, Sticker mit Foto')
ok(kat.karten[0].typ === 'spieler' && kat.karten[0].spieler?.slug === 'p-pils' && kat.karten[0].spieler.position === 'TW', 'Katalog: Spieler zuerst, mit Slug/Position')
ok(kat.karten.some((k) => k.typ === 'partner' && k.partner?.name === 'Mr. Döner'), 'Katalog: Partnerkarte mit Sponsor')
// v20-K: belohnungen jetzt 4 (Schwelle 3 = Verlosungs-Los)
ok(kat.regeln.chancen.bronze === 70 && kat.regeln.chancen.spezial === 1 && kat.regeln.kartenProPack === 3 && kat.regeln.belohnungen.length === 4, 'Katalog: Regeln (Chancen, Pack-Größe, Belohnungen)')
// v20-K: alte Testkette auf den alten Stand zurücksetzen (Schwellen 5/10 ohne 3.,
// Kapitel-Bonus-Pack aus — sonst entstünden beim Öffnen zusätzliche Packs)
await db.exec(`update sva_album_einstellungen set schwelle_1 = 5, schwelle_2 = 10, schwelle_3 = null, karten_kapitel = 0`)
ok(!JSON.stringify(kat).includes('stand_pin') && !JSON.stringify(kat).includes('roster_id'), 'Katalog: keine internen Felder')

// ── Spiele + Codes ─────────────────────────────────────────────────────────
const spiel = async (gegner, minAbAnstoss, heim = true) =>
  (await one(`insert into sm_spiele (gegner, heim, anstoss) values ($1, $2, now() - make_interval(mins => $3)) returning id`, [gegner, heim, minAbAnstoss])).id
const JETZT = await spiel('TuS Fischbek', 10)
const SPAETER = await spiel('VfL Stade', -180)
const VORBEI = await spiel('TSV Apensen', 300)
const LANG = await spiel('FC Lang', 170)        // Anstoß vor 2:50 h, aber Abpfiff erst vor 10 min
const AUSWAERTS = await spiel('SV Ahlerstedt', 10, false)
const SPIEL2 = await spiel('SG Harsefeld', 20)
const SPIEL3 = await spiel('MTV Hammah', 30)
const code = async (id, partner = null, neu = false) => (await rpc(admin, `select album_admin_code($1, $2, $3)`, [id, partner, neu])).token
const T_JETZT = await code(JETZT, DOENER)
const T_SPAETER = await code(SPAETER)
const T_VORBEI = await code(VORBEI)
const T_LANG = await code(LANG)
const T_2 = await code(SPIEL2)
const T_3 = await code(SPIEL3)
ok(/^[a-z0-9]{24}$/.test(T_JETZT) && T_JETZT !== T_SPAETER, 'Token: 24 Zeichen, je Spiel verschieden')
ok((await code(JETZT, DOENER)) === T_JETZT, 'Code erneut anfordern ohne „neu“ → gleicher Token')
await expectErr(admin(`select album_admin_code($1)`, [AUSWAERTS]), 'Code nur für Heimspiele', /album_nur_heimspiel/)
await expectErr(fan1(`select album_admin_code($1)`, [JETZT]), 'Fan darf keinen Code erzeugen', /album_kein_admin/)
ok((await fan1(`select count(*)::int n from sva_album_spielcodes`)).rows[0].n === 0, 'Fan liest keine Tokens')
await db.exec(`insert into sva_ticker (spiel_id, typ, zeitpunkt) values ('${LANG}', 'anpfiff', now() - interval '165 minutes'), ('${LANG}', 'abpfiff', now() - interval '10 minutes')`)

// ── Profil + Einwilligung ──────────────────────────────────────────────────
await expectErr(asAnon(`select album_checkin($1)`, [T_JETZT]), 'anon darf nicht einchecken', /permission denied/)
await expectErr(asAnon(`select album_mein()`), 'anon liest kein Album', /permission denied/)
await expectErr(fan1(`select album_checkin($1)`, [T_JETZT]), 'Check-in ohne Profil → Profil nötig', /album_kein_profil/)
await expectErr(fan1(`select album_profil_speichern('Marvin', 'A', false, false, false)`), 'Profil ohne Einwilligung abgelehnt', /album_einwilligung_fehlt/)
await expectErr(fan1(`select album_profil_speichern('<script>', 'A', false, false, true)`), 'Vorname geprüft', /album_ungueltig:vorname/)
await expectErr(fan1(`select album_profil_speichern('Marvin', '1', false, false, true)`), 'Initial geprüft', /album_ungueltig:initial/)
await fan1(`select album_profil_speichern('Marvin', 'allers', true, true, true)`)
await fan2(`select album_profil_speichern('Lena', 'b', true, false, true)`)
await fan3(`select album_profil_speichern('Ole', 'K', false, false, true)`)
let mein = await rpc(fan1, `select album_mein()`)
ok(mein.profil?.anzeigename === 'Marvin A.' && mein.email === 'marvin@fan.example' && mein.checkins === 0, 'Profil: „Marvin A.“ (nur Initial gespeichert)')
await fan1(`select album_profil_speichern('Marvin', 'A', true, true, false)`)
ok((await rpc(fan1, `select album_mein()`)).profil.rangliste === true, 'Profil ändern geht ohne erneute Einwilligung')

// ── Check-in ───────────────────────────────────────────────────────────────
await expectErr(fan1(`select album_checkin('falsch')`), 'Kaputter Token → unbekannt', /album_code_unbekannt/)
await expectErr(fan1(`select album_checkin($1)`, ['0'.repeat(24)]), 'Unbekannter Token → unbekannt', /album_code_unbekannt/)
await expectErr(fan1(`select album_checkin($1)`, [T_SPAETER]), 'Zu früh (Anstoß in 3 h) → zu früh mit Startzeit', /album_code_zu_frueh\|\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ/)
await expectErr(fan1(`select album_checkin($1)`, [T_VORBEI]), 'Abgelaufener Token (Anstoß vor 5 h) → abgelaufen', /album_code_abgelaufen/)
let ci = await rpc(fan1, `select album_checkin($1)`, [T_JETZT.toUpperCase()])
ok(ci.ok && ci.packId && ci.checkins === 1 && ci.spiel.gegner === 'TuS Fischbek' && ci.partner?.name === 'Mr. Döner', 'Check-in im Fenster → Pack + „präsentiert von“ ' + JSON.stringify(ci).slice(0, 140))
await expectErr(fan1(`select album_checkin($1)`, [T_JETZT]), 'Doppelter Check-in → abgelehnt', /album_schon_eingecheckt/)
ok((await count(`select count(*)::int n from sva_album_checkins where fan_user_id = $1`, [FAN1])) === 1 && (await count(`select count(*)::int n from sva_album_packs where fan_user_id = $1`, [FAN1])) === 1, 'Doppelter Check-in: weder 2. Check-in noch 2. Pack')
ci = await rpc(fan1, `select album_checkin($1)`, [T_LANG])
ok(ci.ok, 'Spiel lief länger: Abpfiff vor 10 min → Fenster bis Abpfiff + 30 min offen')
const pack1 = await one(`select * from sva_album_packs where id = $1`, [(await rpc(fan1, `select album_mein()`)).packs[0].id])
ok(pack1.karten.length === 3 && pack1.seltenheiten.length === 3 && pack1.geoeffnet_at === null, 'Pack: 3 Karten serverseitig gezogen, noch zu')
ok((await count(`select count(*)::int n from sva_album_besitz where fan_user_id = $1`, [FAN1])) === 0, 'Vor dem Öffnen nichts im Album (Gutschrift beim Öffnen)')

// ── Pack öffnen ────────────────────────────────────────────────────────────
mein = await rpc(fan1, `select album_mein()`)
ok(mein.packs.length === 2 && mein.checkins === 2, 'album_mein: 2 ungeöffnete Packs, 2 Check-ins')
await expectErr(fan2(`select album_pack_oeffnen($1)`, [mein.packs[0].id]), 'Fremdes Pack öffnen → unbekannt', /album_pack_unbekannt/)
let op = await rpc(fan1, `select album_pack_oeffnen($1)`, [mein.packs[0].id])
ok(op.karten.length === 3 && op.karten.every((k) => typeof k.neu === 'boolean' && k.anzahl >= 1), 'Pack geöffnet: 3 Karten mit neu/anzahl')
const summe = await count(`select coalesce(sum(anzahl), 0)::int n from sva_album_besitz where fan_user_id = $1`, [FAN1])
ok(summe === 3, 'Gutschrift: 3 Karten im Besitz')
const op2 = await rpc(fan1, `select album_pack_oeffnen($1)`, [mein.packs[0].id])
ok(JSON.stringify(op2.karten.map((k) => k.karteId)) === JSON.stringify(op.karten.map((k) => k.karteId)) && (await count(`select coalesce(sum(anzahl), 0)::int n from sva_album_besitz where fan_user_id = $1`, [FAN1])) === 3, 'Zweimal öffnen: gleicher Inhalt, keine Doppel-Gutschrift')
await rpc(fan1, `select album_pack_oeffnen($1)`, [mein.packs[1].id])
ok((await rpc(fan1, `select album_mein()`)).packs.length === 0, 'Alle Packs offen')

// ── Ziehung: Gewichte + Doppelten-Bremse (direkt, als Superuser) ───────────
await db.exec(`update sva_album_karten set aktiv = true; update sva_album_einstellungen set karten_pro_pack = 5, doppelte_bremse = 0`)
const TEST = await user('stat@test.example')
await db.exec(`do $$ begin for i in 1..800 loop perform sva_album_pack_ziehen('${TEST}', null, 'geschenk'); end loop; end $$;`)
const vert = Object.fromEntries((await db.query(`select s, count(*)::int n from sva_album_packs, unnest(seltenheiten) s where fan_user_id = '${TEST}' group by s`)).rows.map((x) => [x.s, x.n / 4000]))
ok(vert.bronze > 0.66 && vert.bronze < 0.74 && vert.silber > 0.18 && vert.silber < 0.26 && vert.gold > 0.045 && vert.gold < 0.1 && vert.spezial > 0.002 && vert.spezial < 0.025,
  'Gewichte 70/22/7/1 über 4000 Karten: ' + JSON.stringify(Object.fromEntries(Object.entries(vert).map(([k, v]) => [k, Math.round(v * 1000) / 10]))))
await db.exec(`delete from sva_album_packs where fan_user_id = '${TEST}'; update sva_album_karten set aktiv = false where seltenheit = 'spezial'`)
await db.exec(`do $$ begin for i in 1..200 loop perform sva_album_pack_ziehen('${TEST}', null, 'geschenk'); end loop; end $$;`)
ok((await count(`select count(*)::int n from sva_album_packs, unnest(seltenheiten) s where fan_user_id = '${TEST}' and s = 'spezial'`)) === 0, 'Ohne aktive Spezialkarte wird nie „spezial“ gezogen (Gewicht neu verteilt)')
await db.exec(`delete from sva_album_packs where fan_user_id = '${TEST}'; update sva_album_karten set aktiv = true;
  update sva_album_einstellungen set doppelte_bremse = 100, gewicht_silber = 0, gewicht_gold = 0, gewicht_spezial = 0`)
const zieh = async () => one(`select karten, seltenheiten from sva_album_packs where id = $1`, [(await one(`select sva_album_pack_ziehen('${TEST}', null, 'geschenk') id`)).id])
const pz = await zieh()
ok(new Set(pz.karten).size === 5 && pz.seltenheiten.every((s) => s === 'bronze'), 'Doppelten-Bremse 100 %: 5 verschiedene Karten im Pack')
const pz2 = await zieh()
ok(pz2.karten.every((k) => !pz.karten.includes(k)), 'Doppelten-Bremse beachtet auch ungeöffnete Packs')
await db.exec(`update sva_album_einstellungen set karten_pro_pack = 3, doppelte_bremse = 50, gewicht_silber = 22, gewicht_gold = 7, gewicht_spezial = 1`)
await expectErr(fan1(`select sva_album_pack_ziehen($1, null, 'geschenk')`, [FAN1]), 'Fan darf NICHT selbst ziehen (interne Funktion)', /permission denied/)
await expectErr(fan1(`select sva_album_belohnungen($1)`, [FAN1]), 'Fan darf Belohnungen nicht selbst auslösen', /permission denied/)
await expectErr(fan1(`select sva_album_heimsieg_bonus($1)`, [JETZT]), 'Fan darf Bonus nicht selbst auslösen', /permission denied/)

// ── Heimsieg-Bonus ─────────────────────────────────────────────────────────
await rpc(fan2, `select album_checkin($1)`, [T_JETZT])
await admin(`update sm_spiele set tore_sva = 2, tore_gegner = 1 where id = $1`, [JETZT])
ok((await count(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [JETZT])) === 2, 'Heimsieg → Bonus-Pack für beide Eingecheckten')
ok((await one(`select bonus_at from sva_album_spielcodes where spiel_id = $1`, [JETZT])).bonus_at !== null, 'Bonus vermerkt')
await admin(`update sm_spiele set tore_sva = 3 where id = $1`, [JETZT])
ok((await count(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [JETZT])) === 2, 'Ergebnis-Korrektur → kein zweiter Bonus')
ci = await rpc(fan3, `select album_checkin($1)`, [T_JETZT])
ok(ci.ok && ci.bonusPackId, 'Einchecken nach feststehendem Heimsieg → Bonus sofort')
await admin(`update sm_spiele set tore_sva = 0, tore_gegner = 1 where id = $1`, [SPIEL2])
await rpc(fan1, `select album_checkin($1)`, [T_2])
ok((await count(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [SPIEL2])) === 0, 'Niederlage → kein Bonus')
// Ticker-geführt: Abpfiff setzt das Ergebnis per Trigger → Bonus
await rpc(fan2, `select album_checkin($1)`, [T_3])
await db.exec(`insert into sva_ticker (spiel_id, typ, zeitpunkt) values ('${SPIEL3}', 'anpfiff', now() - interval '25 minutes'), ('${SPIEL3}', 'tor', now() - interval '20 minutes'), ('${SPIEL3}', 'abpfiff', now())`)
ok((await count(`select count(*)::int n from sva_album_packs where spiel_id = $1 and art = 'heimsieg'`, [SPIEL3])) === 1, 'Ticker-Abpfiff mit 1:0 → Bonus-Pack')

// ── Belohnungen ────────────────────────────────────────────────────────────
mein = await rpc(fan1, `select album_mein()`)
ok(mein.checkins === 3 && mein.gutscheine.length === 0, '3 Check-ins → noch kein Gutschein (Schwelle 5)')
await db.exec(`update sva_album_einstellungen set schwelle_1 = 3, schwelle_2 = 4`)
const S4 = await spiel('Buxtehuder SV II', 5)
const T_4 = await code(S4)
ci = await rpc(fan1, `select album_checkin($1)`, [T_4])
ok(ci.gutscheine.length === 2 && ci.gutscheine.every((g) => /^SVA-[A-Z0-9]{5}$/.test(g.code)), 'Schwellen 3 + 4 erreicht → 2 Gutscheine im Check-in ' + JSON.stringify(ci.gutscheine.map((g) => g.stufe)))
await rpc(fan1, `select album_checkin($1)`, [await code(await spiel('VSV Hedendorf', 5))])
ok((await count(`select count(*)::int n from sva_album_gutscheine where fan_user_id = $1`, [FAN1])) === 2, 'Weitere Check-ins → keine doppelten Gutscheine')
await expectErr(admin(`update sva_album_einstellungen set schwelle_2 = 2 where id = 1`), 'Schwelle 2 muss über Schwelle 1 liegen')
// Album komplett: alle Spieler-Plätze belegen (Kapitän reicht als Bronze ODER Gold)
await db.exec(`insert into sva_album_besitz (fan_user_id, karte_id)
  select '${FAN1}', k.id from sva_album_karten k where k.typ = 'spieler' and k.seltenheit = 'bronze' and k.roster_id <> (select id from sm_roster where kapitaen limit 1)
  on conflict do nothing;
  insert into sva_album_besitz (fan_user_id, karte_id) select '${FAN1}', id from sva_album_karten where typ = 'spieler' and seltenheit = 'gold' on conflict do nothing;`)
const p3 = (await rpc(fan1, `select album_mein()`)).packs[0]
op = await rpc(fan1, `select album_pack_oeffnen($1)`, [p3.id])
ok(op.gutscheine.some((g) => g.stufe === 'komplett'), 'Alle Spieler-Plätze belegt (Kapitän als Gold) → „Album komplett“-Los')

// ── Gutschein einlösen (v17-D: ohne PIN, Bestätigung im Client) ────────────
const g1 = (await rpc(fan1, `select album_mein()`)).gutscheine.find((g) => g.stufe === 'schwelle_1')
const gk = (await rpc(fan1, `select album_mein()`)).gutscheine.find((g) => g.stufe === 'komplett')
await expectErr(fan1(`select album_gutschein_einloesen($1, '4711')`, [g1.id]), 'Alte PIN-Signatur gibt es nicht mehr', /does not exist/)
await expectErr(admin(`select album_admin_pin('4711')`), 'album_admin_pin entfernt', /does not exist/)
await expectErr(fan2(`select album_gutschein_einloesen($1)`, [g1.id]), 'Fremden Gutschein einlösen → abgelehnt (unbekannt)', /album_gutschein_unbekannt/)
ok((await one(`select status from sva_album_gutscheine where id = $1`, [g1.id])).status === 'offen', 'Fremder Versuch: Gutschein bleibt offen')
await expectErr(asAnon(`select album_gutschein_einloesen('${'00000000-0000-4000-8000-000000000000'}')`), 'anon darf nicht einlösen', /permission denied/)
r = await rpc(fan1, `select album_gutschein_einloesen($1)`, [g1.id])
const eg = await one(`select status, eingeloest_at, eingeloest_durch from sva_album_gutscheine where id = $1`, [g1.id])
ok(r.ok === true && !!r.eingeloestAt && eg.status === 'eingeloest' && eg.eingeloest_durch === 'stand' && eg.eingeloest_at != null, 'Eigener Gutschein → eingelöst mit Zeitstempel')
r = await rpc(fan1, `select album_gutschein_einloesen($1)`, [g1.id])
ok(r.ok === false && r.grund === 'schon_eingeloest' && !!r.eingeloestAt, 'Doppeltes Einlösen → abgelehnt („schon eingelöst“ + Zeitpunkt)')
ok((await one(`select eingeloest_at from sva_album_gutscheine where id = $1`, [g1.id])).eingeloest_at.getTime() === eg.eingeloest_at.getTime(), 'Zeitstempel bleibt beim zweiten Versuch unverändert')
r = await rpc(fan1, `select album_gutschein_einloesen($1)`, [gk.id])
ok(r.ok === false && r.grund === 'verlosung', 'Verlosungs-Los ist nicht am Stand einlösbar')
ok((await fan1(`update sva_album_gutscheine set status = 'eingeloest' where fan_user_id = $1 returning id`, [FAN1])).rows.length === 0, 'Fan kann Gutscheine nicht direkt auf „eingelöst“ setzen')

// ── MISSBRAUCH: Fan-Konto ≠ Admin ──────────────────────────────────────────
ok((await rpc(fan1, `select is_sm_admin()`)) === false && (await rpc(fan1, `select sva_meine_rolle()`)) === null, 'Fan: is_sm_admin() = false, keine Rolle')
for (const t of ['sva_album_einstellungen', 'sva_album_karten', 'sva_album_spielcodes', 'sva_album_fans', 'sva_album_checkins', 'sva_album_packs', 'sva_album_besitz', 'sva_album_gutscheine', 'sm_admins', 'sm_roster', 'sm_spiele', 'sm_sponsoren', 'sva_partner_anfragen', 'sva_settings', 'sva_partner_info']) {
  ok((await fan1(`select count(*)::int n from ${t}`)).rows[0].n === 0, `Fan liest ${t} NICHT (0 Zeilen)`)
}
const EINE = (await one(`select id from sva_album_karten where seltenheit = 'spezial' limit 1`)).id
await expectErr(fan1(`insert into sva_album_besitz (fan_user_id, karte_id, anzahl) values ($1, $2, 99)`, [FAN1, EINE]), 'Fan schreibt sich KEINE Karten gut', /row-level security/)
ok((await fan1(`update sva_album_besitz set anzahl = 99 returning karte_id`)).rows.length === 0, 'Fan erhöht keine Anzahl')
await expectErr(fan1(`insert into sva_album_karten (typ, titel) values ('fan', 'Hack')`), 'Fan legt keine Karte an', /row-level security/)
await expectErr(fan1(`insert into sva_album_checkins (fan_user_id, spiel_id, saison) values ($1, $2, '2026/27')`, [FAN1, VORBEI]), 'Fan trägt sich nicht direkt als eingecheckt ein', /row-level security/)
await expectErr(fan1(`insert into sm_admins (email) values ('marvin@fan.example')`), 'Fan macht sich nicht selbst zum Admin', /row-level security/)
ok((await fan1(`update sva_album_einstellungen set gewicht_spezial = 1000 returning id`)).rows.length === 0, 'Fan ändert keine Gewichte')
ok((await fan1(`update sm_spiele set tore_sva = 9, tore_gegner = 0 returning id`)).rows.length === 0, 'Fan trägt kein Ergebnis ein (kein Bonus-Erschleichen)')
ok((await fan1(`delete from sva_album_karten returning id`)).rows.length === 0, 'Fan löscht keine Karten')
await expectErr(fan1(`select album_admin_statistik()`), 'Fan liest keine Admin-Statistik (E-Mails)', /album_kein_admin/)
await expectErr(asAnon(`select count(*) from sva_album_einstellungen`), 'anon: Tabellen gar nicht freigegeben', /permission denied/)
ok((await team(`select count(*)::int n from sva_album_karten`)).rows[0].n === 0, 'Team-Zugang liest den Album-Admin NICHT')
ok((await admin(`select count(*)::int n from sva_album_gutscheine`)).rows[0].n === 3, 'Admin liest Gutscheine')

// ── Rangliste, Zuschauerzahl, Mediadaten, Statistik ────────────────────────
const rl = await rpc(asAnon, `select album_rangliste()`)
ok(rl.length === 2 && rl[0].name === 'Marvin A.' && rl[0].platz === 1 && rl.every((x) => x.name !== 'Ole K.'), 'Rangliste: nur mit Einwilligung, „Vorname I.“ ' + JSON.stringify(rl))
ok(!JSON.stringify(rl).includes('@') && !JSON.stringify(rl).includes(FAN1), 'Rangliste: keine E-Mail/IDs')
ok((await rpc(fan2, `select album_rangliste()`)).find((x) => x.ich)?.name === 'Lena B.', 'Rangliste markiert den eigenen Eintrag')
const cps = await rpc(asAnon, `select album_checkins_pro_spiel()`)
ok(cps.find((x) => x.spielId === JETZT)?.checkins === 3 && !cps.some((x) => x.spielId === AUSWAERTS), 'Zuschauer-Check-ins je Heimspiel (öffentlich): ' + JSON.stringify(cps.map((x) => x.checkins)))
let snap = await rpc(asAnon, `select web_snapshot()`)
const nSpiele = cps.length
const schnitt = Math.round(cps.reduce((a, x) => a + x.checkins, 0) / nSpiele)
ok(snap.partner.mediadaten.checkinsSpiele === nSpiele && snap.partner.mediadaten.checkinsSchnitt === schnitt, `web_snapshot: Mediadaten Ø ${schnitt} Check-ins über ${nSpiele} Heimspiele`)
ok(snap.players.length === 24 && Array.isArray(snap.partner.pakete), 'web_snapshot sonst unverändert (Kader, Pakete)')
const st = await rpc(admin, `select album_admin_statistik()`)
ok(st.fans === 3 && st.kontakte.length === 1 && st.kontakte[0].email === 'marvin@fan.example' && st.spiele.find((x) => x.spielId === JETZT)?.checkins === 3, 'Admin-Statistik: Live-Zähler + E-Mail NUR mit Erinnerungs-Einwilligung')

// ── Pause + leerer Katalog ─────────────────────────────────────────────────
await db.exec(`update sva_album_einstellungen set aktiv = false`)
await expectErr(fan3(`select album_checkin($1)`, [T_2]), 'Album pausiert → freundlich abgelehnt', /album_pausiert/)
await db.exec(`update sva_album_einstellungen set aktiv = true; update sva_album_karten set aktiv = false`)
ci = await rpc(fan3, `select album_checkin($1)`, [T_2])
ok(ci.ok && !ci.packId, 'Leerer Katalog: Check-in zählt trotzdem (ohne Pack)')
await db.exec(`update sva_album_karten set aktiv = true`)
const alt = await code(JETZT, null, true)
ok(alt !== T_JETZT, 'Admin erzeugt neuen Token')
await expectErr(fan3(`select album_checkin($1)`, [T_JETZT]), 'Alter Token nach Neu-Erzeugen ungültig', /album_code_unbekannt/)

// ── Konto löschen ──────────────────────────────────────────────────────────
const vorher = await count(`select count(*)::int n from sva_album_checkins where spiel_id = $1`, [JETZT])
r = await rpc(fan2, `select album_konto_loeschen()`)
ok(r.ok && r.loginGeloescht === true, 'Konto löschen (vom Album angelegt) → Login gelöscht')
ok((await count(`select count(*)::int n from auth.users where id = $1`, [FAN2])) === 0, 'auth.users-Zeile weg')
ok((await count(`select (select count(*) from sva_album_fans where user_id = $1) + (select count(*) from sva_album_besitz where fan_user_id = $1) + (select count(*) from sva_album_packs where fan_user_id = $1) + (select count(*) from sva_album_checkins where fan_user_id = $1) n`, [FAN2])) === 0, 'Alle Album-Daten des Fans gelöscht')
ok((await count(`select count(*)::int n from sva_album_checkins where spiel_id = $1`, [JETZT])) === vorher, 'Zuschauerzahl bleibt (Check-in anonymisiert)')
r = await rpc(fan1, `select album_konto_loeschen()`)
ok(r.ok && r.loginGeloescht === false && (await count(`select count(*)::int n from auth.users where id = $1`, [FAN1])) === 1, 'Fremd angelegtes Login bleibt (geteiltes Auth), Album-Daten weg')
ok((await count(`select count(*)::int n from sva_album_gutscheine where fan_user_id = $1`, [FAN1])) === 0, 'Gutscheine des gelöschten Kontos weg')
const ADMINFAN = await user('chef2@sva.de', 'sva-album')
await db.exec(`insert into sm_admins (email) values ('chef2@sva.de')`)
await as(ADMINFAN, 'chef2@sva.de', `select album_profil_speichern('Chef', 'Z', false, false, true)`)
r = Object.values((await as(ADMINFAN, 'chef2@sva.de', `select album_konto_loeschen()`)).rows[0])[0]
ok(r.loginGeloescht === false && (await count(`select count(*)::int n from auth.users where id = $1`, [ADMINFAN])) === 1, 'Admin-Login wird nie über das Album gelöscht')

// ── Funktionsrechte ────────────────────────────────────────────────────────
const priv = await one(`select
  has_function_privilege('anon', 'public.album_katalog()', 'execute') a,
  has_function_privilege('anon', 'public.album_checkin(text)', 'execute') b,
  has_function_privilege('authenticated', 'public.album_checkin(text)', 'execute') c,
  has_function_privilege('authenticated', 'public.sva_album_pack_ziehen(uuid,uuid,text)', 'execute') d,
  has_function_privilege('anon', 'public.album_admin_statistik()', 'execute') e,
  has_function_privilege('anon', 'public.web_snapshot()', 'execute') f`)
ok(priv.a && !priv.b && priv.c && !priv.d && !priv.e && priv.f, 'Rechte: anon=Katalog/Snapshot, eingeloggt=Check-in, niemand=Ziehung ' + JSON.stringify(priv))
// Löschen eines Spielers/Sponsors bricht nichts
await db.exec(`delete from sm_sponsoren where id = '${DOENER}'`)
kat = await rpc(asAnon, `select album_katalog()`)
ok(kat.karten.some((k) => k.typ === 'partner' && !k.partner), 'Sponsor gelöscht → Partnerkarte bleibt (ohne Logo)')

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
