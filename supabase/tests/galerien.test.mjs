// PGlite-Test der Migration 20261008100000_sva_galerien.sql: Tabellen,
// Rechte (nur Admin), Titelbild-Einmaligkeit, web_snapshot().galerien —
// und vor allem: die neu angelegte web_snapshot() verliert KEIN bestehendes
// Feld (Vergleich Snapshot vorher/nachher mit denselben Testdaten).
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/galerien.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node galerien.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261008100000_sva_galerien.sql'
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
const grants = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
const as = async (email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => {
  await db.exec(`set role anon;`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) }
}
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 90)) }
}
const snapshot = async () => (await asAnon(`select public.web_snapshot() j`)).rows[0].j

// ── 1. Alles VOR der neuen Migration ────────────────────────────────────────
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
for (const f of files.filter((f) => f < NEU)) await run(f)
await grants()

// Testdaten, die jedes bestehende Feld von web_snapshot() füllen
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
await db.exec(`
  insert into sm_roster (name, slug, rolle, nummer, position, aktiv, kapitaen, foto_url, freisteller_url)
    values ('Test Torwart', 'p-test-galerie', 'spieler', 1, 'TW', true, true, 'https://x/p.webp', 'https://x/c.webp'),
           ('Test Trainer', 's-test-galerie', 'trainer', null, null, true, false, null, null);
  insert into sm_spiele (gegner, heim, anstoss) values ('TSV Test', true, now() + interval '3 days');
  insert into sm_spiele (gegner, heim, anstoss, tore_sva, tore_gegner) values ('FC Alt', true, now() - interval '7 days', 3, 1);
  insert into sm_sponsoren (name, aktiv, stufe, logo_url, website_url) values ('Autohaus Müller', true, 'hauptpartner', 'https://x/a.png', 'https://autohaus.example');
  update sva_partner_info set instagram_follower = 2840, stand = '2026-10-01' where id = 1;
  update sva_settings set training = 'Di & Do, ab 19:00 Uhr' where id = 1;
`)
const vorher = await snapshot()

// ── 2. Neue Migration (zweimal: idempotent) ─────────────────────────────────
await run(NEU)
await grants()
await run(NEU)
await grants()
for (const f of files.filter((f) => f > NEU)) await run(f)
const nachher = await snapshot()

// Jedes Blatt (Pfad → Wert) aus „vorher“ muss in „nachher“ gleich vorhanden sein
const leaves = (o, p = '', out = {}) => {
  if (o && typeof o === 'object') {
    const keys = Object.keys(o)
    if (keys.length === 0) out[p] = JSON.stringify(o)
    for (const k of keys) leaves(o[k], p ? p + '.' + k : k, out)
  } else out[p] = JSON.stringify(o)
  return out
}
const lv = leaves(vorher)
const ln = leaves(nachher)
const fehlend = Object.keys(lv).filter((k) => k !== 'generatedAt' && !(k in ln))
const anders = Object.keys(lv).filter((k) => k !== 'generatedAt' && k in ln && lv[k] !== ln[k])
ok(Object.keys(lv).length > 30, `Vergleich hat Substanz (${Object.keys(lv).length} Felder vorher)`)
ok(fehlend.length === 0, 'web_snapshot(): kein bestehendes Feld verloren ' + JSON.stringify(fehlend.slice(0, 8)))
ok(anders.length === 0, 'web_snapshot(): bestehende Werte unverändert ' + JSON.stringify(anders.slice(0, 8)))
for (const k of ['players', 'staff', 'lineup', 'nextMatch', 'lastMatch', 'form', 'table', 'sponsors', 'settings', 'sections', 'partner']) {
  ok(k in nachher, `Feld ${k} vorhanden`)
}
ok(nachher.partner?.mediadaten?.instagramFollower === 2840, 'partner.mediadaten (v16-S) erhalten')
ok(nachher.sponsors?.[0]?.stufe === 'hauptpartner', 'sponsors[].stufe (v16-S) erhalten')
ok(Array.isArray(nachher.galerien) && nachher.galerien.length === 0, 'galerien: leer, solange nichts veröffentlicht ist')

// ── 3. Rechte ───────────────────────────────────────────────────────────────
await expectErr(asAnon(`insert into sva_galerien (slug, titel) values ('x-test', 'Test')`), 'anon darf keine Galerie anlegen')
ok((await asAnon(`select count(*)::int n from sva_galerien`)).rows[0].n === 0, 'anon liest Galerien nicht direkt')
await expectErr(as('team@sva.de', `insert into sva_galerien (slug, titel) values ('team-test', 'Team')`), 'Team-Zugang darf keine Galerie anlegen')

// ── 4. Pflege als Admin ─────────────────────────────────────────────────────
const spiel = (await db.query(`select id from sm_spiele where gegner = 'FC Alt'`)).rows[0].id
const g = (await as('chef@sva.de', `insert into sva_galerien (slug, titel, untertitel, datum, spiel_id, fotograf_url)
  values ('urknall-pokal-2026', 'AGA Urknall — Sieger Aspe-Haie-Pokal 2026', 'Turniersieg', '2026-09-12', $1, 'https://instagram.com/pictureby.nele') returning id`, [spiel])).rows[0].id
await as('chef@sva.de', `insert into sva_galerie_bilder (galerie_id, pfad, vorschau_pfad, breite, hoehe, reihenfolge, alt_text, titelbild) values
  ($1, 'galerien/urknall-pokal-2026/02.webp', 'galerien/urknall-pokal-2026/02-800.webp', 2000, 1333, 20, 'Siegerfoto', false),
  ($1, 'galerien/urknall-pokal-2026/01.webp', 'galerien/urknall-pokal-2026/01-800.webp', 2000, 1333, 10, 'Pokal-Jubel', true)`, [g])
await expectErr(as('chef@sva.de', `insert into sva_galerie_bilder (galerie_id, pfad, titelbild) values ($1, 'galerien/x/3.webp', true)`, [g]), 'nur EIN Titelbild je Galerie', /duplicate|unique/i)
await expectErr(as('chef@sva.de', `insert into sva_galerien (slug, titel) values ('Ungültig Slug!', 'X')`), 'Slug geprüft')
await expectErr(as('chef@sva.de', `insert into sva_galerien (slug, titel, fotograf_url) values ('ok-slug', 'X', 'javascript:alert(1)')`), 'Fotograf-Link nur https')
ok((await as('team@sva.de', `select count(*)::int n from sva_galerien`)).rows[0].n === 0, 'Team liest Galerien NICHT')
ok((await as('chef@sva.de', `select count(*)::int n from sva_galerien`)).rows[0].n === 1, 'Admin liest Galerien')

ok((await snapshot()).galerien.length === 0, 'unveröffentlichte Galerie bleibt privat')
await as('chef@sva.de', `update sva_galerien set veroeffentlicht = true where id = $1`, [g])
// leere veröffentlichte Galerie erscheint nicht
await as('chef@sva.de', `insert into sva_galerien (slug, titel, veroeffentlicht, datum) values ('leer', 'Leer', true, '2026-10-01')`)
const s = await snapshot()
ok(s.galerien.length === 1, 'nur veröffentlichte Galerien MIT Bildern im Snapshot')
const gal = s.galerien[0]
ok(gal.slug === 'urknall-pokal-2026' && gal.titel.startsWith('AGA Urknall') && gal.datum === '2026-09-12' && gal.fotograf === 'picture by Nele', 'Galerie-Kopf: Slug, Titel, Datum, Fotograf (Default „picture by Nele“)')
ok(gal.fotografUrl === 'https://instagram.com/pictureby.nele', 'Fotograf-Link')
ok(gal.spiel?.opponent === 'FC Alt' && gal.spiel.home === true, 'verknüpftes Spiel (Gegner, Heim)')
ok(gal.bilder.length === 2 && gal.bilder[0].alt === 'Pokal-Jubel' && gal.bilder[0].cover === true && !('cover' in gal.bilder[1]), 'Bilder in Reihenfolge, Titelbild markiert')
ok(gal.bilder[0].pfad.endsWith('01.webp') && gal.bilder[0].vorschau.endsWith('01-800.webp') && gal.bilder[0].w === 2000 && gal.bilder[0].h === 1333, 'Pfad, Vorschau, Maße')
const js = JSON.stringify(s.galerien)
ok(!js.includes(g) && !js.includes(spiel) && !js.includes('created_at'), 'keine internen IDs/Zeitstempel im Snapshot')

// ── 5. Löschen ──────────────────────────────────────────────────────────────
await as('chef@sva.de', `delete from sva_galerien where id = $1`, [g])
ok((await db.query(`select count(*)::int n from sva_galerie_bilder`)).rows[0].n === 0, 'Galerie löschen entfernt ihre Bilder (cascade)')
await as('chef@sva.de', `delete from sm_spiele where gegner = 'TSV Test'`)
ok((await snapshot()).galerien.length === 0, 'Snapshot nach Löschen wieder leer')

console.log(fails ? `\n${fails} FEHLER` : '\nalle Prüfungen bestanden')
process.exit(fails ? 1 : 0)
