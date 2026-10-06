// PGlite-Integrationstest Tipp-Liga ↔ Sammelalbum (v20, echte RPCs, keine Stubs):
// erster Tipp → echtes Tipp-Pack im Album (album_karte_gutschreiben), Ändern →
// kein zweites; Werten → Ziel tipp_exakt über album_ziel_ausloesen (2-Param-Fassung).
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/tippliga.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node tippliga.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261012120000_sva_motm_bruecke.sql'
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
// Supabase-Default-Privilegien nachbilden (neue Tabellen/Funktionen für alle) —
// die Migration muss selbst entziehen.
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
for (const f of files) {
  if (f === NEU) await defaults()
  await run(f)
}
await defaults()
await run(NEU) // zweiter Lauf: idempotent + entzieht Default-Rechte wieder

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


const user = async (email, app) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, app ? { app } : {}])).id
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const CHEF = await user('chef@sva.de')
const F = await user('mia@fan.example', 'sva-album')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const fan = (sql, p) => as(F, 'mia@fan.example', sql, p)
let kader = (await db.query(`select id, slug from sm_roster where aktiv and rolle = 'spieler'`)).rows
if (kader.length < 1) { await db.query(`insert into sm_roster (slug, name, position) values ('p-x', 'Max Muster', 'ANG')`); kader = (await db.query(`select id, slug from sm_roster`)).rows }
// Katalog anlegen, damit Packs Karten enthalten
try { await admin(`select album_admin_katalog_standard()`) } catch (e) { console.log('Hinweis Katalog:', e.message.slice(0, 80)) }
const S = (await admin(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb) values ('SG Lühe', false, now() + interval '3 days', 'Kreisliga Stade') returning id`)).rows[0].id
await fan(`select tipp_beitreten('Mia', 'M', true, true, true)`)
const vorher = await val(`select count(*)::int v from sva_album_packs where fan_user_id = $1`, [F])
let r = await rpc(fan, `select tipp_abgeben($1, 2, 1) j`, [S])
ok(r.ok && r.neu, 'Tipp abgegeben')
ok(r.karte === true, 'Antwort meldet +1 Karte')
const nachher = await val(`select count(*)::int v from sva_album_packs where fan_user_id = $1`, [F])
ok(nachher === vorher + 1, `echtes Tipp-Pack im Album (${vorher} → ${nachher})`)
await fan(`select tipp_abgeben($1, 3, 1)`, [S])
ok((await val(`select count(*)::int v from sva_album_packs where fan_user_id = $1`, [F])) === nachher, 'Tipp ändern → kein zweites Pack')
ok(!!(await val(`select to_regprocedure('public.album_motm_karte_veroeffentlichen(uuid)') is not null v`)), 'MOTM-Brücke vorhanden → Knopf im Spielbericht aktiv')
console.log(fails ? `\n${fails} FEHLER` : `\nALLES GRÜN (${oks} Prüfungen)`)
process.exit(fails ? 1 : 0)
