// PGlite-Test der Migration 20261011100000_sva_partner_ansprechpartner.sql:
// neue Spalten an sva_partner_info, RPC web_partner_kontakt() (null ohne Name,
// Block mit Name, nur gepflegte Felder, anon-Ausführbarkeit, Idempotenz).
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/partner_ansprechpartner.test.mjs . \
//     && MIGRATIONS=<repo>/supabase/migrations/ node partner_ansprechpartner.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261011100000_sva_partner_ansprechpartner.sql'
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
const grants = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
for (const f of fs.readdirSync(M).sort()) await run(f)
await grants()
await run(NEU) // zweiter Lauf: idempotent
await grants()

const asAnon = async (sql, params) => {
  await db.exec(`set role anon;`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) }
}
const kontakt = async () => (await asAnon(`select public.web_partner_kontakt() as k`)).rows[0].k

// Spalten da?
const spalten = (await db.query(`
  select column_name from information_schema.columns
  where table_schema='public' and table_name='sva_partner_info'
    and column_name like 'ansprechpartner_%'`)).rows.map((r) => r.column_name).sort()
ok(spalten.length === 4, 'vier ansprechpartner_* Spalten vorhanden: ' + spalten.join(', '))

// genau 1 Zeile (unverändert)
ok((await db.query(`select count(*)::int n from sva_partner_info`)).rows[0].n === 1, 'sva_partner_info: weiterhin genau 1 Zeile')

// Ohne Name → null
ok((await kontakt()) === null, 'web_partner_kontakt() = null ohne gepflegten Namen')

// Nur Name → Block mit genau einem Feld (jsonb_strip_nulls)
await db.exec(`update sva_partner_info set ansprechpartner_name = '  Marvin Allers  ' where id = 1`)
let k = await kontakt()
ok(k && k.name === 'Marvin Allers', 'Name wird getrimmt zurückgegeben')
ok(k && k.rolle === undefined && k.fotoUrl === undefined && k.telefon === undefined, 'leere Felder fallen weg (strip_nulls)')

// Alle Felder
await db.exec(`update sva_partner_info set
  ansprechpartner_rolle = 'Sponsoring',
  ansprechpartner_foto_url = 'https://example.com/foto.webp',
  ansprechpartner_telefon = '0170 1234567' where id = 1`)
k = await kontakt()
ok(k && k.rolle === 'Sponsoring' && k.fotoUrl === 'https://example.com/foto.webp' && k.telefon === '0170 1234567', 'alle Felder im Block')

// Nur Leerzeichen im Namen → wieder null
await db.exec(`update sva_partner_info set ansprechpartner_name = '   ' where id = 1`)
ok((await kontakt()) === null, 'nur Leerzeichen im Namen → null')

// Längen-Check greift
try {
  await db.exec(`update sva_partner_info set ansprechpartner_name = repeat('x', 81) where id = 1`)
  ok(false, 'Längen-Check Name (kein Fehler!)')
} catch (e) { ok(/sva_partner_info_ap_name_laenge/.test(e.message), 'Längen-Check Name greift') }

// anon darf die RPC ausführen, sieht die Tabelle per RLS aber NICHT (0 Zeilen)
await db.exec(`update sva_partner_info set ansprechpartner_name = 'Test' where id = 1`)
ok((await kontakt())?.name === 'Test', 'anon darf web_partner_kontakt() ausführen')
const direkt = await asAnon(`select ansprechpartner_name from sva_partner_info where id = 1`)
ok(direkt.rows.length === 0, 'anon-Direktzugriff auf sva_partner_info bleibt per RLS gesperrt (0 Zeilen)')

console.log(fails ? `\n${fails} FEHLER` : '\nAlle Tests grün')
process.exit(fails ? 1 : 0)
