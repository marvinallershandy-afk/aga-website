// PGlite-Test der Migration 20261010130000_sva_haertung.sql:
//   · Kochsafe-SECDEF-RPCs verlieren EXECUTE für anon/authenticated,
//   · search_path wird bei sva_statistik_pfade / sva_demo_position gepinnt,
//   · sm_admins-Policies konsolidiert (eine SELECT-Policy, Verhalten gleich).
// In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp supabase/tests/haertung.test.mjs /tmp/pg/ && cd /tmp/pg
//   MIGRATIONS=<repo>/supabase/migrations/ node haertung.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261010130000_sva_haertung.sql'
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

// Kochsafe-Altlasten simulieren: SECDEF-RPCs, die anon/authenticated ausführen
// dürfen (genau der Zustand, den die Migration entschärfen soll). Werden VOR dem
// Migrationslauf angelegt, damit die NEU-Migration sie findet und sperrt.
await db.exec(`
create function public.haushalt_gruenden(p_name text) returns uuid language sql security definer set search_path to 'public' as $$ select gen_random_uuid() $$;
create function public.generiere_einladungscode() returns text language sql security definer set search_path to 'public' as $$ select 'x' $$;
create function public.rezept_speichern(p_rezept jsonb) returns uuid language sql security definer set search_path to 'public' as $$ select gen_random_uuid() $$;
grant execute on function public.haushalt_gruenden(text) to anon, authenticated;
grant execute on function public.generiere_einladungscode() to anon, authenticated;
grant execute on function public.rezept_speichern(jsonb) to anon, authenticated;
`)

let fails = 0
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++ }
const run = async (f) => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('OK   migration', f) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) } }
const files = fs.readdirSync(M).sort()
for (const f of files) await run(f)
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
await run(NEU) // zweiter Lauf: idempotent
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)

const priv = async (role, sig) => (await db.query(`select has_function_privilege('${role}', '${sig}', 'EXECUTE') p`)).rows[0].p

// ── 1. Kochsafe-RPCs gesperrt ──────────────────────────────────────────────────
for (const sig of ['public.haushalt_gruenden(text)', 'public.generiere_einladungscode()', 'public.rezept_speichern(jsonb)']) {
  ok((await priv('anon', sig)) === false, `anon kann ${sig} NICHT mehr ausführen`)
  ok((await priv('authenticated', sig)) === false, `authenticated kann ${sig} NICHT mehr ausführen`)
}
// Funktion existiert weiterhin (nichts gedroppt)
ok((await db.query(`select to_regprocedure('public.haushalt_gruenden(text)') r`)).rows[0].r !== null, 'haushalt_gruenden existiert weiterhin (nicht gedroppt)')

// ── 2. search_path gepinnt ──────────────────────────────────────────────────────
const cfg = async (sig) => (await db.query(`select proconfig from pg_proc where oid = to_regprocedure('${sig}')`)).rows[0]?.proconfig ?? []
ok((await cfg('public.sva_statistik_pfade()')).some((c) => c.startsWith('search_path=')), 'sva_statistik_pfade: search_path gepinnt')
ok((await cfg('public.sva_demo_position(text)')).some((c) => c.startsWith('search_path=')), 'sva_demo_position: search_path gepinnt')

// ── 3. sm_admins: genau eine SELECT-Policy, Verhalten unverändert ───────────────
const selPolicies = (await db.query(`select policyname from pg_policies where tablename='sm_admins' and cmd='SELECT' order by policyname`)).rows.map((r) => r.policyname)
ok(selPolicies.length === 1 && selPolicies[0] === 'sm_admins_select', 'genau eine SELECT-Policy (sm_admins_select): ' + JSON.stringify(selPolicies))

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const as = async (email, sql) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
ok((await as('chef@sva.de', `select count(*)::int n from sm_admins`)).rows[0].n === 2, 'Admin sieht alle Zugänge')
ok((await as('team@sva.de', `select count(*)::int n from sm_admins`)).rows[0].n === 1, 'Team sieht nur sich selbst')
// Selbst-Schutz bleibt
await as('chef@sva.de', `delete from sm_admins where email='chef@sva.de'`)
ok((await db.query(`select count(*)::int n from sm_admins where email='chef@sva.de'`)).rows[0].n === 1, 'Admin kann sich nicht selbst löschen')
await as('chef@sva.de', `update sm_admins set rolle='team' where email='chef@sva.de'`)
ok((await db.query(`select rolle from sm_admins where email='chef@sva.de'`)).rows[0].rolle !== 'team', 'Admin kann sich nicht selbst herabstufen')
await as('chef@sva.de', `delete from sm_admins where email='team@sva.de'`)
ok((await db.query(`select count(*)::int n from sm_admins where email='team@sva.de'`)).rows[0].n === 0, 'Admin darf andere löschen')

console.log(fails ? `\n${fails} FEHLER` : '\nAlle Tests grün.')
process.exit(fails ? 1 : 0)
