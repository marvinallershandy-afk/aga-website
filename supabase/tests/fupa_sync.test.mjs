// PGlite-Test der Migration 20261010110000_sva_fupa_sync.sql: sva_sync_log
// (RLS, nur Admin liest, niemand schreibt über den Client), Spalte
// sva_settings.fupa_auto, Pruning-Trigger. In-Memory-Postgres mit
// Supabase-Stubs — NIE gegen die echte DB.
//   cp supabase/tests/fupa_sync.test.mjs /tmp/pg/ && cd /tmp/pg
//   MIGRATIONS=<repo>/supabase/migrations/ node fupa_sync.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261010110000_sva_fupa_sync.sql'
const db = new PGlite()
await db.exec(`
create role anon; create role authenticated; create role service_role; create role supabase_storage_admin;
create schema auth; create schema storage; create schema extensions;
create table auth.users (id uuid primary key default gen_random_uuid(), email text);
create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::jsonb $$;
create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
create function auth.role() returns text language sql stable as $$ select 'anon' $$;
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
const files = fs.readdirSync(M).sort()
for (const f of files) await run(f)
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
await run(NEU) // zweiter Lauf: idempotent
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)

const as = async (email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql) => { await db.exec(`set role anon;`); try { return await db.query(sql) } finally { await db.exec('reset role') } }
const expectErr = async (p, msg) => { try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(true, msg + ' → ' + e.message.slice(0, 80)) } }

// ── Schema ───────────────────────────────────────────────────────────────────
const col = (await db.query(`select column_default, is_nullable from information_schema.columns where table_name='sva_settings' and column_name='fupa_auto'`)).rows[0]
ok(!!col, 'sva_settings.fupa_auto existiert')
ok(col && col.is_nullable === 'NO' && /true/.test(col.column_default), 'fupa_auto NOT NULL default true: ' + JSON.stringify(col))
ok((await db.query(`select to_regclass('public.sva_sync_log') r`)).rows[0].r !== null, 'Tabelle sva_sync_log existiert')

// ── RLS: Admin liest, Team/Anon nicht ─────────────────────────────────────────
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
// Eine Zeile direkt (als Superuser, wie es die Edge Function mit service_role täte)
await db.exec(`insert into sva_sync_log (quelle, ausloeser, status, geaendert, details) values ('fupa','auto','ok',3,'{"spiele_neu":3}'::jsonb)`)

ok((await as('chef@sva.de', `select count(*)::int n from sva_sync_log`)).rows[0].n === 1, 'Admin liest das Protokoll')
ok((await as('team@sva.de', `select count(*)::int n from sva_sync_log`)).rows[0].n === 0, 'Team-Zugang sieht das Protokoll NICHT')
ok((await asAnon(`select count(*)::int n from sva_sync_log`)).rows[0].n === 0, 'anon sieht das Protokoll NICHT')

// Kein Schreibpfad über den Client (nur service_role via RLS-Bypass)
await expectErr(as('chef@sva.de', `insert into sva_sync_log (status) values ('ok')`), 'Admin darf NICHT ins Protokoll schreiben (nur Function/service_role)')
await expectErr(asAnon(`insert into sva_sync_log (status) values ('ok')`), 'anon darf NICHT ins Protokoll schreiben')

// ── CHECK-Constraints ─────────────────────────────────────────────────────────
await expectErr(db.query(`insert into sva_sync_log (status) values ('quatsch')`), 'ungültiger Status wird abgelehnt')
await expectErr(db.query(`insert into sva_sync_log (status, ausloeser) values ('ok','falsch')`), 'ungültiger Auslöser wird abgelehnt')

// ── Pruning-Trigger: höchstens 500 Einträge ───────────────────────────────────
await db.exec(`insert into sva_sync_log (status, zeit)
               select 'ok', now() - (g || ' seconds')::interval from generate_series(1, 600) g`)
const n = (await db.query(`select count(*)::int n from sva_sync_log`)).rows[0].n
ok(n === 500, `Pruning hält genau 500 Einträge (ist ${n})`)
// Die jüngsten bleiben: der zuletzt eingefügte (g=1 → now()-1s) muss noch da sein
const juengste = (await db.query(`select max(zeit) m from sva_sync_log`)).rows[0].m
ok(new Date(juengste).getTime() > Date.now() - 60_000, 'jüngste Einträge bleiben erhalten')

console.log(fails ? `\n${fails} FEHLER` : '\nAlle Tests grün.')
process.exit(fails ? 1 : 0)
