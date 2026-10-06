// PGlite-Test der Migration 20261016100000_sva_fupa_kader.sql:
// sva_fupa_kader + sva_admin_fupa_fehlende (Team) + sva_admin_fupa_spieler_anlegen
// (nur Admin). In-Memory-Postgres, NIE gegen die echte DB.
//   cp <repo>/supabase/tests/fupa_kader.test.mjs /tmp/pg/ &&
//   MIGRATIONS=<repo>/supabase/migrations/ node fupa_kader.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261016100000_sva_fupa_kader.sql'
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role; create role supabase_storage_admin;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', 'anon') $$;
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
const files = fs.readdirSync(M).sort().filter((f) => f.endsWith('.sql') && !f.includes('_cron'))
for (const f of files) await run(f)
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
await run(NEU) // zweiter Lauf: idempotent
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)

const as = async (email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => { await db.exec(`set role anon;`); try { return await db.query(sql, params) } finally { await db.exec('reset role') } }
const asService = async (sql, params) => { await db.exec(`set role service_role;`); try { return await db.query(sql, params) } finally { await db.exec('reset role') } }
const expectErr = async (p, msg) => { try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(true, msg + ' → ' + e.message.slice(0, 60)) } }

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)

// Setup als Superuser (das PGlite-service_role hat kein BYPASSRLS).
// Einen Kader-Spieler mit bekanntem Namen anlegen (für den Namens-Match).
await db.exec(`insert into sm_roster (slug, name, rolle, position, aktiv, sortierung) values ('p-tom-match', 'Tom Match', 'spieler', 'MIT', true, 500)`)
// ...und einen, der schon eine FuPa-ID trägt.
await db.exec(`insert into sm_roster (slug, name, rolle, position, aktiv, sortierung, fupa_spieler_id) values ('p-id-match', 'Egal Name', 'spieler', 'ABW', true, 510, 999001)`)

// FuPa-Kader füllen (so wie es der fupa-sync-Bot täte):
await db.exec(`insert into sva_fupa_kader (fupa_spieler_id, vorname, nachname, nummer, spiele, tore, vorlagen) values
  (999001, 'Egal', 'Name', 5, 9, 1, 0),      -- per FuPa-ID zugeordnet → NICHT fehlend
  (999002, 'Tom', 'Match', 7, 8, 3, 2),      -- per Name zugeordnet → NICHT fehlend
  (999003, 'Jarek', 'Dettmer', 14, 6, 0, 1), -- fehlt
  (999004, 'David', 'Neimann', 22, 4, 2, 0)  -- fehlt`)

// ── sva_admin_fupa_fehlende (Team darf, anon nicht) ──────────────────────────
await expectErr(asAnon(`select sva_admin_fupa_fehlende()`), 'anon darf fehlende nicht lesen')
const fehlend = (await as('team@sva.de', `select sva_admin_fupa_fehlende() as j`)).rows[0].j
const namen = fehlend.map((x) => x.name).sort()
ok(fehlend.length === 2, `fehlende: genau 2 (ohne FuPa-ID-/Namens-Match) — ${namen.join(', ')}`)
ok(namen.includes('Jarek Dettmer') && namen.includes('David Neimann'), 'fehlende enthält Dettmer + Neimann')
ok(!namen.includes('Tom Match') && !fehlend.some((x) => x.fupaId === 999001), 'zugeordnete (ID + Name) sind NICHT fehlend')
ok(fehlend.find((x) => x.name === 'Jarek Dettmer')?.spiele === 6, 'Statistik (Spiele) mitgeliefert')

// ── sva_admin_fupa_spieler_anlegen: nur Admin ────────────────────────────────
await expectErr(as('team@sva.de', `select sva_admin_fupa_spieler_anlegen(999003)`), 'Team darf NICHT anlegen (nur Admin)')
await expectErr(asAnon(`select sva_admin_fupa_spieler_anlegen(999003)`), 'anon darf NICHT anlegen')
const neu = (await as('chef@sva.de', `select sva_admin_fupa_spieler_anlegen(999003) as j`)).rows[0].j
ok(neu && neu.name === 'Jarek Dettmer' && /^p-dettmer/.test(neu.slug), `anlegen: Spieler + Slug (${neu.slug})`)
const row = (await db.query(`select name, nummer, position, aktiv, fupa_spieler_id, foto_url from sm_roster where fupa_spieler_id = 999003`)).rows[0]
ok(row && row.nummer === 14 && row.position === 'MIT' && row.aktiv === true && row.foto_url == null, 'angelegter Spieler: Nummer/Position/aktiv/ohne Foto')

// Doppelt anlegen → Fehler
await expectErr(as('chef@sva.de', `select sva_admin_fupa_spieler_anlegen(999003)`), 'anlegen doppelt → schon_angelegt')
// Unbekannte FuPa-ID → Fehler
await expectErr(as('chef@sva.de', `select sva_admin_fupa_spieler_anlegen(123456)`), 'anlegen unbekannt → fupa_spieler_unbekannt')

// Nach dem Anlegen ist Dettmer nicht mehr fehlend (jetzt nur noch Neimann).
const fehlend2 = (await as('team@sva.de', `select sva_admin_fupa_fehlende() as j`)).rows[0].j
ok(fehlend2.length === 1 && fehlend2[0].name === 'David Neimann', 'nach Anlegen: nur noch Neimann fehlt')

console.log(fails ? `\n${fails} FEHLER` : '\nalles grün')
process.exit(fails ? 1 : 0)
