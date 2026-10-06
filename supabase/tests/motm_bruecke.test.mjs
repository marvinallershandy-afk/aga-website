// PGlite-Test der Brücke 20261012120000_sva_motm_bruecke.sql (v20):
//   · album_motm_karte_veroeffentlichen(spiel) erzeugt die MOTM-Karte über album_admin_motm
//   · ohne eingetragenen MOTM → klare Fehlermeldung; anon darf nicht
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/am_platz.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node am_platz.test.mjs
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
const run = async (f) => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('OK   migration', f) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) } }
const tabellenRechte = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
const as = async (email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => { await db.exec(`set role anon;`); try { return await db.query(sql, params) } finally { await db.exec('reset role') } }


const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes('20261012120000_sva_motm_bruecke.sql'), 'Migration liegt im Ordner')
for (const f of files) await run(f)
await tabellenRechte()
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const r = (await db.query(`insert into sm_roster (name, position, rueckennummer, aktiv) values ('Marc Biedermann', 'ANG', 37, true) returning id`).catch(async () => db.query(`insert into sm_roster (name) values ('Marc Biedermann') returning id`))).rows[0].id
const s = (await db.query(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb, status) values ('SG Lühe', false, now() - interval '1 day', 'Kreisliga Stade', 'beendet') returning id`)).rows[0].id
ok(!!(await db.query(`select to_regprocedure('public.album_motm_karte_veroeffentlichen(uuid)') p`)).rows[0].p, 'Funktion existiert (Tipp-Liga-Knopf wird aktiv)')
let fehler = ''
try { await as('chef@sva.de', `select public.album_motm_karte_veroeffentlichen($1) j`, [s]) } catch (e) { fehler = e.message }
ok(fehler.includes('album_motm_fehlt'), 'ohne MOTM: Fehler album_motm_fehlt')
await db.exec(`update sm_spiele set motm_roster_id = '${r}' where id = '${s}'`)
const res = (await as('chef@sva.de', `select public.album_motm_karte_veroeffentlichen($1) j`, [s])).rows[0].j
ok(res && res.id, 'mit MOTM: Karte erzeugt (' + JSON.stringify(res).slice(0, 80) + ')')
const n = (await db.query(`select count(*)::int n from sva_album_karten where id = $1`, [res.id])).rows[0].n
ok(n === 1, 'Karte steht im Katalog')
let anon = ''
try { await asAnon(`select public.album_motm_karte_veroeffentlichen('${s}') j`) } catch (e) { anon = e.message }
ok(anon.length > 0, 'anon darf nicht: ' + anon.slice(0, 60))
console.log(fails ? `\n${fails} FEHLER` : '\nalle Prüfungen bestanden')
process.exit(fails ? 1 : 0)
