// PGlite-Test der Migration 20261010120000_sva_backup_bucket.sql: privater
// Bucket sva_backup (nur service_role), RPC sva_backup_dump() (service_role-only,
// deckt alle sva_*/sm_*-Tabellen ab, lässt Kochsafe sme_* aus). In-Memory-
// Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp supabase/tests/backup.test.mjs /tmp/pg/ && cd /tmp/pg
//   MIGRATIONS=<repo>/supabase/migrations/ node backup.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261010120000_sva_backup_bucket.sql'
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
grant usage on schema public, auth, storage to anon, authenticated, service_role;
grant execute on all functions in schema auth to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects, storage.buckets to anon, authenticated, service_role;
`)
let fails = 0
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++ }
const run = async (f) => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('OK   migration', f) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) } }
const files = fs.readdirSync(M).sort()
for (const f of files) await run(f)
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
await run(NEU) // zweiter Lauf: idempotent
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)

// Eine Kochsafe-Tabelle simulieren, um die Ausgrenzung zu prüfen.
await db.exec(`create table if not exists public.sme_members (id uuid primary key default gen_random_uuid(), foo text);
               insert into public.sme_members (foo) values ('geheim');`)

const asRole = async (role, sql) => { await db.exec(`set role ${role};`); try { return await db.query(sql) } finally { await db.exec('reset role') } }
const expectErr = async (p, msg) => { try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(true, msg + ' → ' + e.message.slice(0, 80)) } }

// ── Bucket ────────────────────────────────────────────────────────────────────
const bucket = (await db.query(`select public, file_size_limit, allowed_mime_types from storage.buckets where id='sva_backup'`)).rows[0]
ok(!!bucket, 'Bucket sva_backup existiert')
ok(bucket && bucket.public === false, 'Bucket ist privat (public=false)')
ok(bucket && Array.isArray(bucket.allowed_mime_types) && bucket.allowed_mime_types.includes('application/json'), 'nur application/json erlaubt')

// ── Storage-Policies: nur service_role ─────────────────────────────────────────
ok((await asRole('service_role', `insert into storage.objects (bucket_id, name) values ('sva_backup','backup-2026-10-06.json') returning id`)).rows.length === 1, 'service_role darf ins Backup schreiben')
await expectErr(asRole('authenticated', `insert into storage.objects (bucket_id, name) values ('sva_backup','x.json')`), 'authenticated darf NICHT ins Backup schreiben')
await expectErr(asRole('anon', `insert into storage.objects (bucket_id, name) values ('sva_backup','x.json')`), 'anon darf NICHT ins Backup schreiben')
ok((await asRole('authenticated', `select count(*)::int n from storage.objects where bucket_id='sva_backup'`)).rows[0].n === 0, 'authenticated sieht keine Backup-Objekte')

// ── sva_backup_dump(): Rechte ──────────────────────────────────────────────────
await expectErr(asRole('anon', `select public.sva_backup_dump()`), 'anon darf sva_backup_dump NICHT ausführen')
await expectErr(asRole('authenticated', `select public.sva_backup_dump()`), 'authenticated darf sva_backup_dump NICHT ausführen')

// ── sva_backup_dump(): Inhalt (als service_role) ───────────────────────────────
const dump = (await asRole('service_role', `select public.sva_backup_dump() d`)).rows[0].d
const schluessel = Object.keys(dump.tables)
ok(schluessel.includes('sva_settings'), 'Dump enthält sva_settings')
ok(schluessel.includes('sm_spiele'), 'Dump enthält sm_spiele')
ok(!schluessel.includes('sme_members'), 'Dump schließt Kochsafe sme_members AUS')
ok(schluessel.every((k) => k.startsWith('sva_') || k.startsWith('sm_')), 'nur sva_/sm_-Tabellen im Dump')
ok(Array.isArray(dump.tables.sva_settings) && dump.tables.sva_settings.length === 1, 'sva_settings-Seed (1 Zeile) gesichert')
ok(dump.tableCount === schluessel.length, 'tableCount stimmt mit Schlüsselzahl überein')
ok(typeof dump.generatedAt === 'string', 'generatedAt gesetzt')

console.log(fails ? `\n${fails} FEHLER` : '\nAlle Tests grün.')
process.exit(fails ? 1 : 0)
