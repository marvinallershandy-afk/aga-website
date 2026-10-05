// PGlite-Test der Migration 20261009100000_sva_statistik.sql (v18-A):
// anonyme Tageszählung web_zaehlen() — Whitelist, Normalisierung, Deckel —,
// Rechte (anon zählt, liest aber nichts; nur Admin wertet aus) und die
// Auswertung web_statistik() mit Testdaten.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/statistik.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node statistik.test.mjs
//   AUSGABE=datei.json → schreibt die web_statistik(30)-Antwort (Testdaten) für Screenshots
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261009100000_sva_statistik.sql'
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
// Supabase-Default-Privilegien nachbilden: neue Tabellen UND Funktionen sind
// für anon/authenticated freigegeben — die Migration muss selbst entziehen.
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
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
const zaehlen = async (pfad, quelle, geraet) => (await asAnon(`select public.web_zaehlen($1, $2, $3) r`, [pfad, quelle, geraet])).rows[0].r
const zeile = async (pfad, quelle, geraet) =>
  (await db.query(`select zaehler from sva_statistik_tage where tag = (now() at time zone 'Europe/Berlin')::date and pfad = $1 and quelle = $2 and geraet = $3`, [pfad, quelle, geraet])).rows[0]?.zaehler ?? 0

// ── 1. Migrationen: alle der Reihe nach, die neue zweimal (idempotent) ──────
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
for (const f of files) {
  if (f === NEU) await defaults()
  await run(f)
}
await defaults()
await run(NEU) // zweiter Lauf: idempotent + entzieht die Default-Rechte wieder
for (const f of files.filter((f) => f > NEU)) await run(f)

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)

// ── 2. Spalten: nichts Personenbezogenes ────────────────────────────────────
const spalten = (await db.query(`select column_name from information_schema.columns where table_schema = 'public' and table_name = 'sva_statistik_tage' order by ordinal_position`)).rows.map((r) => r.column_name)
ok(JSON.stringify(spalten) === JSON.stringify(['tag', 'pfad', 'quelle', 'geraet', 'zaehler']), 'Tabelle hat genau: tag, pfad, quelle, geraet, zaehler (keine IP/UA/ID/Zeitstempel)')

// ── 3. Zählen (anon) ────────────────────────────────────────────────────────
ok((await zaehlen('/', 'instagram:bio', 'mobil')) === true, 'anon zählt Startseite (Instagram-Bio, mobil)')
await zaehlen('/', 'instagram:bio', 'mobil')
ok((await zeile('/', 'instagram:bio', 'mobil')) === 2, 'zweiter Aufruf erhöht dieselbe Tageszeile (2)')
ok((await zaehlen('/LIVE ', 'Google', 'Desktop')) === true && (await zeile('/live', 'google', 'desktop')) === 1, 'Pfad/Quelle/Gerät werden klein geschrieben + getrimmt')
ok((await zaehlen('#ereignis:kalender-abo', 'direkt', 'mobil')) === true, 'Ereignis kalender-abo wird gezählt')
ok((await zaehlen('#ereignis:probetraining', 'instagram:story', 'mobil')) === true, 'Ereignis probetraining (aus Story) wird gezählt')

ok((await zaehlen('/wp-admin', 'direkt', 'mobil')) === false, 'unbekannter Pfad wird abgelehnt')
ok((await zaehlen('/?utm_source=x', 'direkt', 'mobil')) === false, 'Pfad mit Query wird abgelehnt')
ok((await zaehlen('#ereignis:hack', 'direkt', 'mobil')) === false, 'unbekanntes Ereignis wird abgelehnt')
ok((await zaehlen('/', 'direkt', 'tablet')) === false, 'unbekannter Gerätetyp wird abgelehnt')
ok((await zaehlen('/', 'direkt', null)) === false && (await zaehlen(null, 'direkt', 'mobil')) === false, 'NULL-Werte werden abgelehnt')
await zaehlen('/', 'evil.example.com', 'mobil')
ok((await zeile('/', 'sonstige', 'mobil')) === 1, 'unbekannte Quelle → „sonstige“ (keine freien Werte in der DB)')
await zaehlen('/', 'instagram:<script>', 'mobil')
ok((await zeile('/', 'instagram', 'mobil')) === 1, 'unbekanntes Medium wird verworfen → „instagram“')
await zaehlen('/', 'x'.repeat(5000), 'desktop')
const quellen = (await db.query(`select distinct quelle from sva_statistik_tage`)).rows.map((r) => r.quelle).sort()
ok(quellen.every((q) => /^(instagram|facebook|google|whatsapp|qr|direkt|intern|sonstige)(:(bio|story|post|reel|platz|plakat|flyer|status|gruppe))?$/.test(q)), `nur Listen-Werte gespeichert: ${quellen.join(', ')}`)

// ── 4. Rechte ───────────────────────────────────────────────────────────────
await expectErr(asAnon(`select * from sva_statistik_tage`), 'anon liest die Tabelle NICHT', /permission denied/)
await expectErr(asAnon(`insert into sva_statistik_tage (tag, pfad, quelle, geraet, zaehler) values (current_date, '/', 'direkt', 'mobil', 999999)`), 'anon schreibt NICHT direkt', /permission denied/)
await expectErr(as('fan@x.de', `insert into sva_statistik_tage (tag, pfad, quelle, geraet, zaehler) values (current_date, '/', 'direkt', 'mobil', 9)`), 'eingeloggter Nicht-Admin schreibt NICHT direkt', /permission denied/)
await expectErr(as('chef@sva.de', `update sva_statistik_tage set zaehler = 1000000`), 'auch Admin ändert Zähler NICHT direkt', /permission denied/)
ok((await as('fan@x.de', `select count(*)::int n from sva_statistik_tage`)).rows[0].n === 0, 'Nicht-Admin sieht 0 Zeilen (RLS)')
ok((await as('team@sva.de', `select count(*)::int n from sva_statistik_tage`)).rows[0].n === 0, 'Team-Zugang sieht 0 Zeilen (nur Admin)')
ok((await as('chef@sva.de', `select count(*)::int n from sva_statistik_tage`)).rows[0].n > 0, 'Admin liest die Tageszeilen')
await expectErr(asAnon(`select public.web_statistik(30)`), 'anon darf web_statistik() NICHT ausführen', /permission denied/)
await expectErr(as('fan@x.de', `select public.web_statistik(30)`), 'Nicht-Admin bekommt keine Auswertung', /nicht_erlaubt/)
await expectErr(as('team@sva.de', `select public.web_statistik(30)`), 'Team bekommt keine Auswertung', /nicht_erlaubt/)

// ── 5. Deckel ───────────────────────────────────────────────────────────────
await db.exec(`update sva_statistik_tage set zaehler = 4999 where pfad = '/live' and quelle = 'google'`)
ok((await zaehlen('/live', 'google', 'desktop')) === true && (await zeile('/live', 'google', 'desktop')) === 5000, 'Zeile erreicht den Deckel 5000')
ok((await zaehlen('/live', 'google', 'desktop')) === false && (await zeile('/live', 'google', 'desktop')) === 5000, 'darüber: abgelehnt, bleibt bei 5000')
await db.exec(`insert into sva_statistik_tage (tag, pfad, quelle, geraet, zaehler)
               values ((now() at time zone 'Europe/Berlin')::date, '/galerie', 'direkt', 'desktop', 45000)`)
ok((await zaehlen('/album', 'direkt', 'mobil')) === false, 'Tagesdeckel 50000 gesamt: weitere Aufrufe abgelehnt')
const zeilenHeute = (await db.query(`select count(*)::int n from sva_statistik_tage where tag = (now() at time zone 'Europe/Berlin')::date`)).rows[0].n
const maxZeilen = (await db.query(`select cardinality(public.sva_statistik_pfade()) * 8 * 10 * 2 as n`)).rows[0].n
ok(zeilenHeute <= maxZeilen, `Zeilen pro Tag sind fest begrenzt (heute ${zeilenHeute}, Obergrenze ${maxZeilen})`)

// ── 6. Auswertung mit Testdaten ─────────────────────────────────────────────
await db.exec(`delete from sva_statistik_tage`)
// 40 Tage Verlauf: Instagram (Bio/Story) führt, dazu Google, direkt, QR am Spieltag
await db.exec(`
  insert into sva_statistik_tage (tag, pfad, quelle, geraet, zaehler)
  select d::date, x.pfad, x.quelle, x.geraet,
         greatest(0, x.basis + ((extract(doy from d)::int * 7 + length(x.pfad)) % 5) - 2
                    + case when extract(isodow from d) = 7 then x.sonntag else 0 end)
    from generate_series((now() at time zone 'Europe/Berlin')::date - 39, (now() at time zone 'Europe/Berlin')::date, interval '1 day') d,
         (values ('/', 'instagram:bio', 'mobil', 9, 14), ('/', 'instagram:story', 'mobil', 5, 18), ('/live', 'instagram:story', 'mobil', 2, 30),
                 ('/', 'google', 'desktop', 4, 2), ('/', 'google', 'mobil', 3, 2), ('/', 'direkt', 'mobil', 3, 4), ('/', 'direkt', 'desktop', 2, 1),
                 ('/#training', 'instagram:bio', 'mobil', 2, 1), ('/#spieltag', 'direkt', 'mobil', 1, 6), ('/partner', 'google', 'desktop', 1, 0),
                 ('/partner', 'whatsapp', 'mobil', 1, 0), ('/album', 'qr:platz', 'mobil', 0, 22), ('/galerie', 'instagram:post', 'mobil', 1, 6),
                 ('/', 'facebook', 'mobil', 1, 1),
                 ('#ereignis:kalender-abo', 'instagram:bio', 'mobil', 0, 2), ('#ereignis:kalender-termin', 'google', 'mobil', 0, 1),
                 ('#ereignis:probetraining-start', 'instagram:bio', 'mobil', 0, 3), ('#ereignis:probetraining', 'instagram:bio', 'mobil', 0, 1),
                 ('#ereignis:album-checkin', 'qr:platz', 'mobil', 0, 20),
                 ('#ereignis:instagram', 'direkt', 'mobil', 0, 3)) as x(pfad, quelle, geraet, basis, sonntag)
`)
await db.exec(`insert into sva_statistik_tage values ((now() at time zone 'Europe/Berlin')::date - 3, '#ereignis:partner-anfrage', 'google', 'desktop', 1),
                                                    ((now() at time zone 'Europe/Berlin')::date - 12, '#ereignis:partner-anfrage', 'instagram:bio', 'mobil', 1)`)
const st = (await as('chef@sva.de', `select public.web_statistik(30) j`)).rows[0].j
ok(st.tage === 30 && st.proTag.length === 30, 'Auswertung: 30 Tage, eine Zeile je Tag (auch Tage ohne Aufrufe)')
const summeTage = st.proTag.reduce((a, d) => a + d.aufrufe, 0)
ok(summeTage === st.aufrufe && st.aufrufe > 0, `Aufrufe gesamt = Summe der Tage (${st.aufrufe})`)
ok(st.aufrufeVorher > 0, `Vergleichszeitraum (Tage 31–60) gefüllt: ${st.aufrufeVorher}`)
ok(st.quellen[0].quelle === 'instagram', `Quellen nach Aufrufen sortiert, Instagram vorn (${st.quellen.map((q) => q.quelle + ' ' + q.aufrufe).join(', ')})`)
ok(st.quellen.reduce((a, q) => a + q.aufrufe, 0) === st.aufrufe, 'Summe der Quellen = Aufrufe gesamt')
ok(st.medien.some((m) => m.quelle === 'instagram:bio') && st.medien.some((m) => m.quelle === 'instagram:story'), 'Medien: Instagram-Bio und -Story getrennt')
ok(st.seiten[0].pfad === '/' && st.seiten.every((s) => !s.pfad.startsWith('#')), 'Top-Seiten: Startseite vorn, keine Ereignisse darin')
const ev = Object.fromEntries(st.ereignisse.map((e) => [e.name, e]))
ok(ev['album-checkin']?.anzahl > 0 && ev['probetraining']?.anzahl > 0 && ev['kalender-abo']?.anzahl > 0 && ev['partner-anfrage']?.anzahl === 2, 'Ereignisse: Album, Probetraining, Kalender, Partner-Anfrage gezählt')
ok(ev['probetraining'].vonInstagram === ev['probetraining'].anzahl, 'Ereignis kennt den Instagram-Anteil')
ok(!JSON.stringify(st).includes('#ereignis'), 'Ereignisnamen ohne Präfix')
const st7 = (await as('chef@sva.de', `select public.web_statistik(7) j`)).rows[0].j
ok(st7.proTag.length === 7 && st7.aufrufe < st.aufrufe, '7-Tage-Auswertung kleiner als 30 Tage')
const stX = (await as('chef@sva.de', `select public.web_statistik(100000) j`)).rows[0].j
ok(stX.tage === 400, 'Zeitraum auf 400 Tage gedeckelt')

if (process.env.AUSGABE) {
  fs.writeFileSync(process.env.AUSGABE, JSON.stringify({ 30: st, 7: st7 }, null, 2))
  console.log('→ Auswertung geschrieben:', process.env.AUSGABE)
}

console.log(fails ? `\n${fails} FEHLER` : '\nalle Prüfungen bestanden')
process.exit(fails ? 1 : 0)
