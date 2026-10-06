// PGlite-Test der Migration 20261018130000_sva_checkin_rotation.sql (v25-D).
// Prüft: rotierender Code (aktuelles ± 1 Intervall gültig, älteres/falsches ab-
// gelehnt), Admin/Team-Codeanzeige + 2-h-Vorschau, Vormerken (anon, nur mit
// gültigem Code, E-Mail-Prüfung), Einlösen nach Login („anderer Browser“ = ohne
// lokalen Zustand), 30-min-Frist, kein Doppel-Check-in, Rechte.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/checkin_rotation.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node checkin_rotation.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261018130000_sva_checkin_rotation.sql'
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
let fails = 0, oks = 0
const ok = (c, m) => { console.log(c ? 'OK  ' : 'FAIL', m); if (!c) fails++; else oks++ }
const run = async (f) => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('OK   migration', f) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) } }
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
const claims = (uid, email) => JSON.stringify({ sub: uid, email, role: 'authenticated' })
const as = async (uid, email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(uid, email)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => { await db.exec(`set role anon;`); try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) } }
const expectErr = async (p, m, re) => { try { await p; ok(false, m + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), m + ' → ' + e.message.slice(0, 90)) } }
const one = async (sql, p) => (await db.query(sql, p)).rows[0]
const val = async (sql, p) => Object.values((await db.query(sql, p)).rows[0])[0]
const rpc = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]

// alle Migrationen
const album = '20261007100000_sva_album.sql'
for (const f of files.filter((x) => x < NEU)) { if (f === album) await defaults(); await run(f); if (f === album) await defaults() }
await defaults(); await run(NEU); await run(NEU) /* idempotent */
for (const f of files.filter((x) => x > NEU)) await run(f)

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const user = async (email, app) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, app ? { app } : {}])).id
const CHEF = await user('chef@sva.de'); const TEAM = await user('team@sva.de')
const FAN1 = await user('marvin@fan.example', 'sva-album'); const FAN2 = await user('lena@fan.example', 'sva-album')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const team = (sql, p) => as(TEAM, 'team@sva.de', sql, p)
const fan1 = (sql, p) => as(FAN1, 'marvin@fan.example', sql, p)
const fan2 = (sql, p) => as(FAN2, 'lena@fan.example', sql, p)

// Katalog (Spielerkarten reichen für die Ziehung)
await rpc(admin, `select album_admin_spielerkarten()`)
await fan1(`select album_profil_speichern('Marvin', 'A', true, true, true)`)
await fan2(`select album_profil_speichern('Lena', 'B', true, false, true)`)

// Heimspiel im Check-in-Fenster + Code
const SPIEL = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('TuS Fischbek', true, now() - interval '10 minutes') returning id`)).id
const TOKEN = (await rpc(admin, `select album_admin_code($1, null, false)`, [SPIEL])).token
ok(/^[a-z0-9]{16,64}$/.test(TOKEN), 'statischer Token angelegt (Fallback)')

const rotNow = async (off = 0) => val(`select sva_album_rot_code($1, sva_album_rot_index(now(), 3) + $2) v`, [TOKEN, off])
const CODE = await rotNow(0)
ok(/^[0-9A-F]{6}$/.test(CODE), 'Rotationscode: 6 Hex-Zeichen ' + CODE)

// ── 1. Gültigkeit aktuelles ± 1 Intervall ──────────────────────────────────
ok((await val(`select sva_album_rot_gueltig($1, $2) v`, [SPIEL, CODE])) === true, 'aktueller Code gültig')
ok((await val(`select sva_album_rot_gueltig($1, $2) v`, [SPIEL, await rotNow(-1)])) === true, 'voriges Intervall gültig')
ok((await val(`select sva_album_rot_gueltig($1, $2) v`, [SPIEL, await rotNow(1)])) === true, 'nächstes Intervall gültig (Taktabweichung)')
ok((await val(`select sva_album_rot_gueltig($1, $2) v`, [SPIEL, await rotNow(-2)])) === false, 'zu altes Intervall (−2) abgelehnt')
ok((await val(`select sva_album_rot_gueltig($1, $2) v`, [SPIEL, 'ZZZZZZ'])) === false, 'falscher Code abgelehnt')
ok((await val(`select sva_album_rot_gueltig($1, $2) v`, [SPIEL, 'abc'])) === false, 'Formatfehler abgelehnt')

// ── 2. Admin/Team-Codeanzeige + 2-h-Vorschau ───────────────────────────────
const ca = await rpc(team, `select album_checkin_code($1) v`, [SPIEL])
ok(ca.rotation === true && ca.intervallMin === 3 && ca.jetzt.code === CODE, 'Team: Codeanzeige (Rotation an, aktueller Code)')
ok(Array.isArray(ca.codes) && ca.codes.length >= 40 && ca.token === TOKEN, 'Team: 2-h-Vorschau (~40 Codes) + Fallback-Token')
await expectErr(fan1(`select album_checkin_code($1)`, [SPIEL]), 'Fan darf die Codeanzeige nicht rufen', /album_kein_team|permission/i)
await expectErr(asAnon(`select album_checkin_code($1)`, [SPIEL]), 'anon darf die Codeanzeige nicht rufen', /permission/i)

// ── 3. Check-in per Rotationscode (ruft intern album_checkin) ───────────────
await expectErr(fan1(`select album_checkin_rot($1, $2)`, [SPIEL, 'ZZZZZZ']), 'falscher Rotationscode → unbekannt', /album_code_unbekannt/)
const ci = await rpc(fan1, `select album_checkin_rot($1, $2) v`, [SPIEL, await rotNow(0)])
ok(ci.ok === true && ci.packId, 'Rotations-Check-in: eingecheckt + Pack')
ok((await val(`select count(*)::int v from sva_album_checkins where fan_user_id = $1 and spiel_id = $2`, [FAN1, SPIEL])) === 1, 'genau 1 Check-in')
await expectErr(fan1(`select album_checkin_rot($1, $2)`, [SPIEL, await rotNow(0)]), 'kein Doppel-Check-in', /album_schon_eingecheckt/)

// ── 4. Vormerken (anon) + Einlösen nach Login („anderer Browser“) ───────────
await expectErr(asAnon(`select album_checkin_vormerken($1, $2, $3)`, [SPIEL, 'keine-mail', await rotNow(0)]), 'Vormerken: E-Mail geprüft', /album_email_ungueltig/)
await expectErr(asAnon(`select album_checkin_vormerken($1, $2, $3)`, [SPIEL, 'lena@fan.example', 'ZZZZZZ']), 'Vormerken ohne gültigen Code abgelehnt', /album_code_unbekannt/)
ok((await rpc(asAnon, `select album_checkin_vormerken($1, $2, $3) v`, [SPIEL, 'LENA@fan.example', await rotNow(-1)])).ok === true, 'Vormerken (anon, voriger Code, E-Mail normalisiert)')
ok((await val(`select count(*)::int v from sva_album_checkin_vormerk where email = 'lena@fan.example'`)) === 1, 'Vormerkung gespeichert (lowercase)')
// Lena loggt sich „in einem anderen Browser“ ein (kein lokaler Zustand) → Einlösen
const res = await rpc(fan2, `select album_checkin_offen_einloesen() v`, [])
ok(res.ok === true && res.packId, 'Login-Einlösung: Check-in + Pack ' + JSON.stringify(res).slice(0, 60))
ok((await val(`select count(*)::int v from sva_album_checkins where fan_user_id = $1 and spiel_id = $2`, [FAN2, SPIEL])) === 1, 'Lena ist eingecheckt')
ok((await val(`select eingeloest_at is not null v from sva_album_checkin_vormerk where email = 'lena@fan.example' and spiel_id = $1`, [SPIEL])) === true, 'Vormerkung als eingelöst markiert')
// erneut: nichts offen mehr
ok((await rpc(fan2, `select album_checkin_offen_einloesen() v`, [])).ok === false, 'zweiter Login-Versuch: nichts offen')

// 30-min-Frist: abgelaufene Vormerkung wird nicht eingelöst
const SP2 = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('SG Harsefeld', true, now() - interval '10 minutes') returning id`)).id
const TOK2 = (await rpc(admin, `select album_admin_code($1, null, false)`, [SP2])).token
await db.query(`insert into sva_album_checkin_vormerk (email, spiel_id, scan_at) values ('marvin@fan.example', $1, now() - interval '31 minutes')`, [SP2])
ok((await rpc(fan1, `select album_checkin_offen_einloesen() v`, [])).ok === false, '31 min alte Vormerkung wird NICHT eingelöst')
ok((await val(`select count(*)::int v from sva_album_checkins where fan_user_id = $1 and spiel_id = $2`, [FAN1, SP2])) === 0, 'kein Check-in aus abgelaufener Vormerkung')
void TOK2

// ── 4b. Statischer Token (20261018140000): nur im Notfall-Modus ─────────────
if (files.includes('20261018140000_sva_checkin_statisch_gate.sql')) {
  await expectErr(fan1(`select album_checkin_kern($1)`, [TOK2]), 'Kern ist für Fans nicht aufrufbar', /permission denied/)
  await expectErr(fan1(`select album_checkin($1)`, [TOK2]), 'statischer QR bei Rotation AN abgelehnt', /album_code_veraltet/)
  await db.exec(`update sva_album_einstellungen set checkin_rotation = false where id = 1`)
  const st = await rpc(fan1, `select album_checkin($1) v`, [TOK2])
  ok(st && st.packId, 'statischer QR bei Rotation AUS (Notfall) klappt')
  await db.exec(`update sva_album_einstellungen set checkin_rotation = true where id = 1`)
  await db.query(`insert into sva_album_checkin_vormerk (email, spiel_id, scan_at) values ('alt@fan.example', $1, now() - interval '2 days')`, [SP2])
  ok((await val(`select sva_album_vormerk_aufraeumen() v`)) >= 1, 'alte Vormerkungen werden gelöscht')
}

// ── 5. Rechte ────────────────────────────────────────────────────────────────
await expectErr(fan1(`select sva_album_rot_code($1, 1)`, [TOKEN]), 'Fan darf die Code-Funktion nicht rufen', /permission denied/)
await expectErr(asAnon(`select album_checkin_offen_einloesen()`), 'anon darf nicht einlösen', /permission denied/)
await expectErr(fan1(`select * from sva_album_checkin_vormerk`), 'Fan liest die Vormerk-Tabelle nicht', /permission denied/)

console.log(`\n${oks} OK, ${fails} FAIL`)
process.exit(fails ? 1 : 0)
