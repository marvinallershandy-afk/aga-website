// PGlite-Test der v26-Migrationen (Paket Z1 + folgende). Prüft die Ziel-Maschine
// (typ bestand/woche/monat), den 68er-Katalog, geheime ???-Ziele (nur id+hinweis),
// den Frühaufsteher-Check-in und den DURCHSTICH Tipp→Album für den Hotfix §0.4
// (tipp_admin_werten vergibt wirklich 'tipp_kapitaen_trifft').
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/album_v26.test.mjs <pg-ordner>/ && MIGRATIONS=<repo>/supabase/migrations/ node <pg-ordner>/album_v26.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
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
// Supabase-Default-Privilegien nachbilden; die Migrationen entziehen anschließend
// selbst, was intern bleiben soll (letztes Wort = Migration). Wie ziele.test:
// einmal kurz vor dem Haupt-Karten-Paket, danach legen die späteren Migrationen
// (v21..v26) ihre Revokes drüber — so bleiben die v26-Interna am Ende gesperrt.
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
const KARTEN = '20261012110000_sva_karten.sql'
const alleMig = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
for (const f of alleMig) {
  if (f === KARTEN) await defaults()
  try { await db.exec(fs.readFileSync(M + f, 'utf8')) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) }
}
await defaults()
try { await db.exec(fs.readFileSync(M + KARTEN, 'utf8')) } catch (e) { console.log('FAIL migration (2)', KARTEN, '→', e.message); process.exit(1) }
for (const f of alleMig.filter((x) => x > KARTEN)) {
  try { await db.exec(fs.readFileSync(M + f, 'utf8')) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) }
}
// v25-D: Diese Tests checken als Fan über den statischen Token ein → Rotation aus.
await db.exec(`update public.sva_album_einstellungen set checkin_rotation = false where id = 1`).catch(() => {})

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
const count = async (sql, params) => (await one(sql, params)).n
const val = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const user = async (email) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, '{"app":"sva-album"}') returning id`, [email])).id
const CHEF = await user('chef@sva.de')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const neuerFan = async (name, initial) => {
  const mail = name.toLowerCase() + '@fan.example'
  const id = await user(mail)
  const f = (sql, p) => as(id, mail, sql, p)
  await f(`select album_profil_speichern($1, $2, false, false, true)`, [name, initial])
  return { id, f }
}
await db.exec(`insert into sm_sponsoren (name, aktiv) values ('Mr. Döner', true), ('Altstadtcafé', true)`)
await val(admin, `select album_admin_katalog_standard()`)
const SAISON = '2026/27'
const karteSlug = async (slug, variante = false) => (await one(`select k.id from sva_album_karten k join sm_roster r on r.id = k.roster_id where r.slug = $1 and k.variante = $2 and not k.limitiert`, [slug, variante])).id
const setze = (fanId, karteId, n = 1) => db.query(`insert into sva_album_besitz (fan_user_id, karte_id, anzahl) values ($1, $2, $3) on conflict (fan_user_id, karte_id) do update set anzahl = excluded.anzahl`, [fanId, karteId, n])
const festPack = async (fanId, karteId) => (await one(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 1, null, 'Test', null, $2) id`, [fanId, karteId])).id
const erreicht = (fanId, schluessel) => count(`select count(*)::int n from sva_album_ziel_erreicht e join sva_album_ziele z on z.id = e.ziel_id where e.fan_user_id = $1 and z.schluessel = $2`, [fanId, schluessel])

// ── AK-1: Katalog 68, idempotent, Kategorien + typen ────────────────────────
const stand = await val(admin, `select album_admin_ziele_standard()`)
ok(stand.standard === 69 && stand.gesamt === 69, 'Standard-Katalog v26: 69 Ziele (inkl. pejas_kollektion aus V26-K) ' + JSON.stringify(stand))
await db.exec(`update sva_album_ziele set titel = 'Mein eigener Titel' where schluessel = 'karten_25'`)
const stand2 = await val(admin, `select album_admin_ziele_standard()`)
ok(stand2.angelegt === 0 && (await one(`select titel from sva_album_ziele where schluessel = 'karten_25'`)).titel === 'Mein eigener Titel', 'Zweiter Lauf: keine Doppelten, Admin-Titel bleibt, kategorie/bedingung werden aktualisiert')
const kats = Object.fromEntries((await db.query(`select kategorie, count(*)::int n from sva_album_ziele group by 1`)).rows.map((r) => [r.kategorie, r.n]))
ok(kats.start === 8 && kats.platz === 7 && kats.woche === 2 && kats.monat === 1 && kats.sammeln === 24 && kats.sets === 11 && kats.tipp === 8 && kats.sozial === 4 && kats.geheim === 4,
  'Kategorien-Verteilung (sets 11 inkl. pejas_kollektion) ' + JSON.stringify(kats))
const typen = Object.fromEntries((await db.query(`select typ, count(*)::int n from sva_album_ziele group by 1`)).rows.map((r) => [r.typ, r.n]))
ok(typen.bestand === 20 && typen.woche === 2 && typen.monat === 1, 'Neue Typen angelegt: bestand 20, woche 2, monat 1')
ok((await one(`select bedingung from sva_album_ziele where schluessel = 'karten_25'`)).bedingung?.n === 25, 'karten_25: bedingung {"was":"karten","n":25}')
const Z = Object.fromEntries((await db.query(`select schluessel, id from sva_album_ziele`)).rows.map((z) => [z.schluessel, z.id]))

// ── AK: bedingung-Constraint ────────────────────────────────────────────────
await expectErr(db.query(`insert into sva_album_ziele (schluessel, typ, titel, bedingung) values ('x_bad', 'bestand', 'Böse', '{"was":"quatsch","n":1}')`),
  'bedingung mit unbekanntem was → abgelehnt', /bedingung_chk/)

// ── AK-3: bestand positiv/negativ (karten_25 bei 24 nein, 25 ja) ────────────
const A = await neuerFan('Anna', 'A')
const alleKarten = (await db.query(`select id from sva_album_karten where not variante and not limitiert order by id limit 30`)).rows.map((r) => r.id)
for (const k of alleKarten.slice(0, 24)) await setze(A.id, k)
let op = await val(A.f, `select album_pack_oeffnen($1)`, [await festPack(A.id, alleKarten[0])])  // Doppelte → Summe 25, aber 24 verschiedene
ok((await erreicht(A.id, 'karten_25')) === 1, 'karten_25: 24 Karten + 1 Doppelte = Summe 25 → erreicht')
const B = await neuerFan('Ben', 'B')
for (const k of alleKarten.slice(0, 24)) await setze(B.id, k)
ok((await erreicht(B.id, 'karten_25')) === 0, 'karten_25: nur 24 Karten → noch nicht erreicht')
op = await val(B.f, `select album_pack_oeffnen($1)`, [await festPack(B.id, alleKarten[24])])
ok((await erreicht(B.id, 'karten_25')) === 1, 'karten_25: 25. Karte gezogen → erreicht')
ok(op.ziele.some((z) => z.schluessel === 'karten_25'), 'karten_25 erscheint im Pack-Öffnen-Ergebnis')

// erste_silber / glanz / doppelte / pack_art
const C = await neuerFan('Cem', 'C')
const silber = (await one(`select id from sva_album_karten where seltenheit = 'silber' and not variante and not limitiert limit 1`)).id
const bronze = (await one(`select id from sva_album_karten where seltenheit = 'bronze' and not variante and not limitiert limit 1`)).id
await setze(C.id, silber)
await val(C.f, `select album_pack_oeffnen($1)`, [await festPack(C.id, bronze)])
ok((await erreicht(C.id, 'erste_silber')) === 1, 'erste_silber: eine Silber-Karte → erreicht')
ok((await erreicht(C.id, 'erste_spezial')) === 0, 'erste_spezial: keine Spezial-Karte → nicht erreicht')
const glanzK = (await one(`select id from sva_album_karten where variante limit 1`)).id
await setze(C.id, glanzK)
await val(C.f, `select album_pack_oeffnen($1)`, [await festPack(C.id, alleKarten[2])])
ok((await erreicht(C.id, 'erster_glanz')) === 1, 'erster_glanz: eine Glanz-Variante → erreicht')

// doppelte_10
const D = await neuerFan('Dana', 'D')
for (const k of alleKarten.slice(0, 5)) await setze(D.id, k, 3)  // 5 Karten × je 2 Doppelte = 10 Doppelte
await val(D.f, `select album_pack_oeffnen($1)`, [await festPack(D.id, alleKarten[0])])
ok((await erreicht(D.id, 'doppelte_10')) === 1, 'doppelte_10: 5×(Anzahl 3) = 10 Doppelte → erreicht')

// ── AK-4: geheimZiele nur id+hinweis; ziele[] ohne geheime Schlüssel ────────
let mein = await val(A.f, `select album_mein()`)
ok(Array.isArray(mein.geheimZiele) && mein.geheimZiele.length === 4, 'geheimZiele: 4 offene ???-Kacheln (nachteule, fruehaufsteher, entdecker, winterkoenig)')
ok(mein.geheimZiele.every((g) => typeof g.id === 'string' && typeof g.hinweis === 'string' && g.erreicht === false
     && !('schluessel' in g) && !('titel' in g) && !('bedingung' in g)),
  'geheimZiele: nur id + hinweis + erreicht:false, kein Schlüssel/Titel/Bedingung (R4)')
ok(!mein.ziele.some((z) => z.schluessel === 'nachteule' || z.schluessel === 'fruehaufsteher'), 'ziele[]: kein geheimer Schlüssel vor dem Erreichen')
ok(mein.ziele.some((z) => z.schluessel === 'karten_25' && z.kategorie === 'start'), 'ziele[]: kategorie wird mitgeliefert')
const wz = mein.ziele.find((z) => z.schluessel === 'woche_tipp')
ok(wz && wz.wiederholbar === true && typeof wz.periode === 'string' && wz.periode.startsWith('woche:'), 'ziele[]: woche_tipp mit periode ' + wz?.periode)
ok(!mein.naechstesZiel || !['extern', 'woche', 'monat'].includes(mein.naechstesZiel.typ), 'naechstesZiel ohne woche/monat/extern')

// ── AK-3: woche_tipp per Periode idempotent ─────────────────────────────────
await db.exec(`create function public.tipp_test(p uuid) returns uuid language plpgsql security definer set search_path to 'public' as $$ begin return public.album_karte_gutschreiben('tipp', p); end $$;
  revoke all on function public.tipp_test(uuid) from public; grant execute on function public.tipp_test(uuid) to authenticated;`)
await val(A.f, `select tipp_test($1)`, ['11111111-1111-1111-1111-111111111111'])
ok((await erreicht(A.id, 'woche_tipp')) === 1 && (await erreicht(A.id, 'erster_tipp')) === 1, 'Tipp-Pack → woche_tipp (diese Woche) + erster_tipp erreicht')
await val(A.f, `select tipp_test($1)`, ['22222222-2222-2222-2222-222222222222'])
ok((await erreicht(A.id, 'woche_tipp')) === 1, 'woche_tipp: zweiter Tipp dieselbe ISO-Woche → nur 1× vergeben')
const wbezug = (await one(`select e.bezug from sva_album_ziel_erreicht e where e.ziel_id = $1 and e.fan_user_id = $2`, [Z.woche_tipp, A.id])).bezug
ok(/^woche:\d{4}-W\d{2}$/.test(wbezug), 'woche_tipp: Perioden-Bezug ' + wbezug)

// ── AK-6: fruehaufsteher (Check-in in den ersten 15 min des Fensters) ───────
const spiel = async (gegner, minNachAnstoss, stundeBerlin) => {
  // anstoss so legen, dass Fenster (anstoss - 60 min) vor „minNachAnstoss“ geöffnet hat
  const id = (await one(`insert into sm_spiele (gegner, heim, anstoss, spieltag_nr) values ($1, true, now() + make_interval(mins => $2), 9) returning id`, [gegner, minNachAnstoss])).id
  return { id, token: (await val(admin, `select album_admin_code($1)`, [id])).token }
}
// Fenster öffnet 60 min vor Anstoß. Anstoß in +50 min → Fenster seit 10 min offen → Frühaufsteher.
const Sfrueh = await spiel('Früh dran', 50)
const E = await neuerFan('Emil', 'E')
let ci = await val(E.f, `select album_checkin($1)`, [Sfrueh.token])
ok(ci.ziele?.some((z) => z.schluessel === 'fruehaufsteher'), 'Check-in 10 min nach Fensterstart → „Frühaufsteher“ erreicht')
// Anstoß in +30 min → Fenster seit 30 min offen → zu spät für Frühaufsteher.
const Sspaet = await spiel('Spät dran', 30)
const G = await neuerFan('Greta', 'G')
ci = await val(G.f, `select album_checkin($1)`, [Sspaet.token])
ok(!ci.ziele?.some((z) => z.schluessel === 'fruehaufsteher'), 'Check-in 30 min nach Fensterstart → kein „Frühaufsteher“')
ok((await erreicht(E.id, 'erster_checkin')) === 1, 'erster_checkin (bestand checkins≥1) über den Check-in erreicht')

// ── AK-7: DURCHSTICH Tipp→Album — Hotfix §0.4 (tipp_kapitaen_trifft) ────────
// Echtes tipp_admin_werten auf einem Spiel mit treffendem Kapitän. KEIN Stub auf
// der Album-Seite: der Schlüssel muss im Katalog auflösen und vergeben werden.
const F = await neuerFan('Finn', 'F')
await db.query(`insert into sva_tipp_teilnehmer (user_id) values ($1)`, [F.id])
// Spiel zunächst in der Zukunft anlegen (Elf-Abgabe offen), dann in die Vergangenheit schieben.
const SW = (await one(`insert into sm_spiele (gegner, heim, anstoss, spieltag_nr)
                       values ('Durchstich SV', true, now() + interval '2 hours', 10) returning id`)).id
await db.query(`insert into sva_tipp_spieltage (spiel_id, tippbar, aufloesung, bericht_at, bericht_von) values ($1, true, '{}'::jsonb, now(), 'test')`, [SW])
const kap = (await one(`select id from sm_roster where slug = 'p-helck'`)).id
const mit = (await db.query(`select id from sm_roster where rolle = 'spieler' and id <> $1 limit 4`, [kap])).rows.map((r) => r.id)
await db.query(`insert into sva_tipp_elf (user_id, spiel_id, spieler, kapitaen, frei) values ($1, $2, $3, $4, true)`, [F.id, SW, [kap, ...mit], kap])
await db.query(`update sm_spiele set anstoss = now() - interval '3 hours', tore_sva = 2, tore_gegner = 1, status = 'beendet' where id = $1`, [SW])
await db.query(`insert into sva_tipp_bericht (spiel_id, roster_id, eingesetzt, minuten, tore, vorlagen) values ($1, $2, true, 90, 1, 0)`, [SW, kap])
const werk = await val(admin, `select tipp_admin_werten($1)`, [SW])
ok(werk.ok === true, 'tipp_admin_werten läuft (Durchstich-Spiel)')
ok((await erreicht(F.id, 'tipp_kapitaen_trifft')) === 1, 'DURCHSTICH: tipp_admin_werten vergibt WIRKLICH tipp_kapitaen_trifft (Hotfix §0.4)')
ok((await count(`select count(*)::int n from sva_album_ziele where schluessel = 'kapitaen_trifft'`, [])) === 0, 'Regression: der alte (falsche) Schlüssel kapitaen_trifft existiert nicht')

// ── AK-8: Rechte ────────────────────────────────────────────────────────────
await expectErr(asAnon(`select album_admin_ziele_standard()`), 'anon darf Katalog nicht anlegen')
const rechte = await one(`select
  has_function_privilege('anon', 'public._sva_album_ziele_upsert_v26()', 'execute') a,
  has_function_privilege('authenticated', 'public._sva_album_ziele_upsert_v26()', 'execute') b,
  has_function_privilege('service_role', 'public._sva_album_ziele_upsert_v26()', 'execute') c,
  has_function_privilege('authenticated', 'public.sva_album_v26_nachziehen()', 'execute') d,
  has_function_privilege('service_role', 'public.sva_album_v26_nachziehen()', 'execute') e`)
ok(!rechte.a && !rechte.b && rechte.c && !rechte.d && rechte.e, 'Interna _sva_album_ziele_upsert_v26 + sva_album_v26_nachziehen nur service_role ' + JSON.stringify(rechte))

// ── V26-K: Kabinen-Kult ─────────────────────────────────────────────────────
// Katalog-Standard legt die 4 Pejas-Platzhalter (aktiv=false) + Set-Ziel an.
await val(admin, `select album_admin_ziele_standard()`)
const pejasRoster = (await one(`select id from sm_roster where slug = 'p-pejas-e'`)).id
ok((await count(`select count(*)::int n from sva_album_karten where kult and kollektion = 'Pejas-Kollektion'`)) === 4
  && (await count(`select count(*)::int n from sva_album_karten where kult and aktiv and kollektion = 'Pejas-Kollektion'`)) === 0,
  'Pejas-Kollektion: 4 Kult-Platzhalter angelegt, alle inaktiv (Einverständnis G2 offen)')
// Content-RPC: Kabinen-Kult (aktiv) + Monats-Moment-Pool (inaktiv, album-neutral)
const kultStd = await val(admin, `select album_admin_kult_standard()`)
ok(kultStd.kultNeu === 9 && kultStd.momentPoolNeu === 16, 'album_admin_kult_standard: 9 Kabinen-Kult (aktiv) + 16 Monats-Moment (inaktiv) ' + JSON.stringify(kultStd))
ok((await count(`select count(*)::int n from sva_album_karten where serie = 'Monats-Moment' and aktiv`)) === 0
  && (await count(`select count(*)::int n from sva_album_karten where serie = 'Monats-Moment' and limitiert`)) === 16,
  'Monats-Moment-Pool: alle inaktiv + limitiert → Album-Ökonomie unverändert')
const katV = await val(asAnon, `select album_katalog()`)
ok(katV.karten.some((k) => k.kult && k.kollektion === 'Kabinen-Kult') && !katV.karten.some((k) => k.serie === 'Monats-Moment'),
  'Katalog liefert aktive Kult-Karten (kult+kollektion), inaktiver Pool bleibt verborgen')
// Constraint: aktive Kult-Karte ohne Einverständnis unmöglich
await expectErr(db.query(`update sva_album_karten set aktiv = true where kult and titel = 'Volltreffer'`),
  'Kult aktiv ohne Einverständnis → Constraint', /sva_album_karten_kult/)

// Admin legt eine Kult-Karte an (Einverständnis-Pflicht)
await expectErr(admin(`select album_admin_kult_karte($1, 'Testkult', 'Anekdote', 'Pejas-Kollektion', '/album/karten/kult-platzhalter.webp', false)`, [pejasRoster]),
  'Kult ohne Einverständnis-Haken → Fehler', /album_kult_einverstaendnis/)
await expectErr(as((await neuerFan('Kurt', 'K')).id, 'kurt@fan.example', `select album_admin_kult_karte($1, 'X', 'Y', 'Z', null, true)`, [pejasRoster]),
  'Fan darf keine Kult-Karte anlegen', /album_kein_admin/)
const neuKult = await val(admin, `select album_admin_kult_karte($1, 'Der Volltreffer', 'Ball in die Weichteile.', 'Test-Kult', '/album/karten/kult-platzhalter.webp', true)`, [pejasRoster])
const nk = await one(`select * from sva_album_karten where id = $1`, [neuKult.id])
ok(nk.kult && nk.limitiert && !nk.variante && nk.kollektion === 'Test-Kult' && nk.einverstaendnis_at && nk.aktiv && nk.roster_id === pejasRoster,
  'album_admin_kult_karte: kult + limitiert + Kollektion + Einverständnis + Roster korrekt')

// 4 Platzhalter freischalten (Einverständnis) → Set-Ziel scharf (4 aktiv)
for (const k of (await db.query(`select id from sva_album_karten where kult and kollektion = 'Pejas-Kollektion' and not aktiv`)).rows) {
  await admin(`select album_admin_kult_schalten($1, true, true)`, [k.id])
}
const aktiveKult = (await db.query(`select id from sva_album_karten where kult and aktiv and kollektion = 'Pejas-Kollektion' order by sortierung limit 4`)).rows.map((r) => r.id)
ok(aktiveKult.length >= 4, 'Vier Pejas-Kult-Karten freigeschaltet')

// AK-6.1: Kult nie in 100 Zufalls-Packs (geschenk)
const Rk = await neuerFan('Rolf', 'R')
for (let i = 0; i < 100; i++) await db.query(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 3, $2, 'Zufall', null, null, false)`, [Rk.id, 'zuf' + i])
ok((await count(`select count(*)::int n from sva_album_packs p join sva_album_karten k on k.id = any(p.karten) where p.fan_user_id = $1 and k.kult`, [Rk.id])) === 0,
  'Kult-Karte wird in 100 Zufalls-Packs NIE gezogen')

// AK-2: Album-% + Plätze unverändert mit/ohne Kult
const plaetzeVorher = await count(`select count(*)::int n from sva_album_plaetze($1) p where p.belegt`, [Rk.id])
await setze(Rk.id, aktiveKult[0])
ok((await count(`select count(*)::int n from sva_album_plaetze($1) p where p.belegt`, [Rk.id])) === plaetzeVorher,
  'Kult-Besitz ändert die belegten Album-Plätze NICHT')

// AK-6.1: Check-in-Pack mit kult_chance=100 → genau eine FEHLENDE Kult-Karte
await db.exec(`update sva_album_einstellungen set kult_chance_prozent = 100 where id = 1`)
const spielK = async (gegner) => {
  const id = (await one(`insert into sm_spiele (gegner, heim, anstoss, spieltag_nr) values ($1, true, now() - interval '5 min', 12) returning id`, [gegner])).id
  return { id, token: (await val(admin, `select album_admin_code($1)`, [id])).token }
}
const SK1 = await spielK('Kult Eins')
const Ck = await neuerFan('Cord', 'C')
let cik = await val(Ck.f, `select album_checkin($1)`, [SK1.token])
const pk = await one(`select karten from sva_album_packs where id = $1`, [cik.packId])
const kultImPack = (await db.query(`select count(*)::int n from sva_album_karten where id = any($1) and kult`, [pk.karten])).rows[0].n
ok(kultImPack === 1 && cik.kult === 1, 'Check-in-Pack (Chance 100 %): genau eine fehlende Kult-Karte angehängt')

// alle aktiven Kult-Karten besitzen → kein Anhang
const Dk = await neuerFan('Dörte', 'D')
for (const k of (await db.query(`select id from sva_album_karten where kult and aktiv`)).rows) await setze(Dk.id, k.id)
const SK2 = await spielK('Kult Zwei')
let cik2 = await val(Dk.f, `select album_checkin($1)`, [SK2.token])
ok(!cik2.kult, 'Fan besitzt alle Kult-Karten → kein Kult-Anhang (keine Doppelten)')

// chance=0 → nie
await db.exec(`update sva_album_einstellungen set kult_chance_prozent = 0 where id = 1`)
const SK3 = await spielK('Kult Drei')
const Ek = await neuerFan('Elsa', 'E')
let cik3 = await val(Ek.f, `select album_checkin($1)`, [SK3.token])
ok(!cik3.kult, 'kult_chance_prozent = 0 → nie eine Kult-Karte im Check-in-Pack')

// AK-6.4: pejas_kollektion zündet bei 4/4
const Fk = await neuerFan('Fenna', 'F')
for (const k of aktiveKult.slice(0, 3)) await setze(Fk.id, k)
let opk = await val(Fk.f, `select album_pack_oeffnen($1)`, [await festPack(Fk.id, (await one(`select id from sva_album_karten where seltenheit='bronze' and not variante and not limitiert limit 1`)).id)])
ok((await erreicht(Fk.id, 'pejas_kollektion')) === 0, 'pejas_kollektion: 3/4 Kult → noch nicht erreicht')
await setze(Fk.id, aktiveKult[3])
opk = await val(Fk.f, `select album_pack_oeffnen($1)`, [await festPack(Fk.id, (await one(`select id from sva_album_karten where seltenheit='silber' and not variante and not limitiert limit 1`)).id)])
ok((await erreicht(Fk.id, 'pejas_kollektion')) === 1, 'pejas_kollektion: 4/4 Kult-Karten → erreicht')

// AK-6.7: Wunschkarte liefert nie Kult (limitiert ausgeschlossen)
const wunschKandidaten = await count(`select count(*)::int n from sva_album_karten where kult and aktiv and not limitiert`, [])
ok(wunschKandidaten === 0, 'Kult ist immer limitiert → Wunschkarte/Zufall können es nie liefern')

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
