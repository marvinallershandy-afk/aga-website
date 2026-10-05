// PGlite-Test der Migration 20261006100000_sva_partner.sql: Pakete-Seed,
// Rechte, RPC partner_anfrage (Validierung, Honeypot, Rate-Limit, Aufräumen,
// Webhook über pg_net-Stub), web_snapshot().partner, web_live().partner.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/partner.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node partner.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261006100000_sva_partner.sql'
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

const as = async (email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params, headers) => {
  await db.exec(`select set_config('request.headers', '${JSON.stringify(headers ?? {})}', false); set role anon;`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.headers', '', false);`) }
}
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 90)) }
}
const count = async (sql) => (await db.query(sql)).rows[0].n

// Seed: genau 6 Pakete, auch nach zweitem Lauf
ok((await count(`select count(*)::int n from sva_partner_pakete`)) === 6, 'Seed: 6 Pakete (nach 2 Läufen)')
await db.exec(`delete from sva_partner_pakete where name = 'Unterstützer'`)
await run(NEU)
await grants()
ok((await count(`select count(*)::int n from sva_partner_pakete`)) === 5, 'Seed füllt eine gepflegte Tabelle NICHT wieder auf')
ok((await count(`select count(*)::int n from sva_partner_info`)) === 1, 'sva_partner_info: genau 1 Zeile')
ok((await count(`select count(*)::int n from sm_webhooks where event='partner.anfrage'`)) === 1, 'Webhook-Event partner.anfrage registriert')

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)

// Rechte auf Tabellen
ok((await as('chef@sva.de', `select count(*)::int n from sva_partner_pakete`)).rows[0].n === 5, 'Admin liest Pakete')
ok((await as('team@sva.de', `select count(*)::int n from sva_partner_pakete`)).rows[0].n === 0, 'Team liest Pakete NICHT')
ok((await asAnon(`select count(*)::int n from sva_partner_pakete`)).rows[0].n === 0, 'anon liest Pakete NICHT direkt')
await expectErr(asAnon(`insert into sva_partner_anfragen (firma, ansprechpartner, email, datenschutz_ok) values ('X GmbH','Max','a@b.de',true)`), 'anon darf NICHT direkt in Anfragen schreiben')
await expectErr(as('chef@sva.de', `insert into sva_partner_anfragen (firma, ansprechpartner, email, datenschutz_ok) values ('X GmbH','Max','a@b.de',true)`), 'auch Admin schreibt Anfragen nicht direkt (nur RPC)')
await expectErr(as('chef@sva.de', `insert into sva_partner_pakete (name, preis_einheit) values ('Test', 'Woche')`), 'Preis-Einheit geprüft')
await expectErr(as('chef@sva.de', `insert into sm_sponsoren (name, stufe) values ('X', 'gold')`), 'Stufe geprüft')
ok((await as('chef@sva.de', `delete from sva_partner_info returning id`)).rows.length === 0, 'Mediadaten-Zeile nicht löschbar')

// Sponsoren + Paket-Belegung
const pk = Object.fromEntries((await db.query(`select name, id from sva_partner_pakete`)).rows.map((r) => [r.name, r.id]))
const bande = pk['Bande am Spielfeld']
await as('chef@sva.de', `insert into sm_sponsoren (name, aktiv, stufe, partner_paket_id, logo_url, website_url, kontakt, ansprechpartner)
  values ('Autohaus Müller', true, 'hauptpartner', $1, 'https://x.supabase.co/storage/v1/object/public/sva_public/sponsoren/a.png', 'https://autohaus.example', 'geheim@autohaus.de', 'K. Müller'),
         ('Bäckerei Behrens', true, 'partner', $1, null, null, null, null),
         ('Getränke Kruse', false, 'unterstuetzer', $1, null, null, null, null),
         ('Elektro Lühmann', true, 'unterstuetzer', null, null, null, null, null)`, [bande])
const mueller = (await db.query(`select id from sm_sponsoren where name='Autohaus Müller'`)).rows[0].id
await as('chef@sva.de', `update sva_partner_info set instagram_follower = 2840, reichweite_monat = 41000, zuschauer_heim = 120, stand = '2026-10-01', live_partner_id = $1 where id = 1`, [mueller])
await as('chef@sva.de', `update sva_partner_pakete set sichtbar = false where name = 'Social-Media-Paket'`)

let snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
const p = snap.partner
ok(p && Array.isArray(p.pakete) && p.pakete.length === 4, 'web_snapshot.partner.pakete: nur sichtbare (4) → ' + p?.pakete?.length)
const pb = p.pakete.find((x) => x.name === 'Bande am Spielfeld')
ok(pb.plaetze === 8 && pb.frei === 6 && pb.preisAb === 250 && pb.preisEinheit === 'Saison' && pb.hervorgehoben === true, 'Bande: 8 Plätze, 6 frei (inaktive zählen nicht) ' + JSON.stringify({ plaetze: pb.plaetze, frei: pb.frei }))
const pt = p.pakete.find((x) => x.name === 'Trikot / Ärmel')
ok(pt.preisAb === undefined && pt.frei === 2 && Array.isArray(pt.leistungen), 'Trikot: Preis auf Anfrage (kein preisAb), 2 frei')
ok(p.pakete[0].name === 'Bande am Spielfeld', 'Pakete nach Sortierung')
ok(p.mediadaten.instagramFollower === 2840 && p.mediadaten.stand === '2026-10-01' && !('websiteBesucheMonat' in p.mediadaten), 'Mediadaten: nur gepflegte Felder ' + JSON.stringify(p.mediadaten))
ok(p.livePartner?.name === 'Autohaus Müller' && p.livePartner.logoUrl?.includes('/sponsoren/a.png'), 'livePartner im Snapshot')
ok(snap.sponsors.length === 3 && snap.sponsors[0].stufe === 'hauptpartner' && snap.sponsors[2].stufe === 'unterstuetzer', 'Sponsoren mit Stufe, Hauptpartner zuerst')
const s = JSON.stringify(snap)
ok(!s.includes('geheim@autohaus.de') && !s.includes('K. Müller') && !s.includes('partner_paket_id') && !s.includes(mueller), 'Snapshot: keine Kontakte/internen Sponsor-IDs')

let live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.partner?.name === 'Autohaus Müller' && live.partner.url === 'https://autohaus.example', 'web_live.partner (ohne Spiel)')
await as('chef@sva.de', `update sm_sponsoren set aktiv = false where id = $1`, [mueller])
live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.partner === null, 'web_live.partner: inaktiver Sponsor verschwindet')
await as('chef@sva.de', `update sm_sponsoren set aktiv = true where id = $1`, [mueller])

// ── RPC partner_anfrage ─────────────────────────────────────────────────────
const RPC = `select public.partner_anfrage(p_firma => $1, p_name => $2, p_email => $3, p_telefon => $4, p_paket_id => $5, p_nachricht => $6, p_datenschutz => $7, p_website => $8, p_dauer_ms => $9, p_quelle => $10) r`
const send = (o = {}, headers = { 'x-forwarded-for': '203.0.113.7, 10.0.0.1' }) => asAnon(RPC, [
  o.firma ?? 'Elektro Peters GmbH', o.name ?? 'Jana Peters', o.email ?? 'jana@peters.example', o.tel ?? '04141 12345',
  o.paket ?? bande, o.msg ?? 'Wir hätten Interesse an einer Bande.', o.ds ?? true, o.hp ?? null, o.ms ?? 9000, o.quelle ?? 'instagram'], headers)

let r = (await send()).rows[0].r
ok(r.ok === true, 'RPC: gültige Anfrage → ok')
let a = (await db.query(`select * from sva_partner_anfragen`)).rows
ok(a.length === 1 && a[0].status === 'neu' && a[0].paket_name === 'Bande am Spielfeld' && a[0].quelle === 'instagram' && /^[0-9a-f]{64}$/.test(a[0].ip_hash), 'gespeichert: Status neu, Paketname, Quelle, IP nur als Hash')
ok(!JSON.stringify(a[0]).includes('203.0.113.7'), 'Klartext-IP wird nicht gespeichert')
ok((await asAnon(`select count(*)::int n from sva_partner_anfragen`)).rows[0].n === 0, 'anon liest Anfragen NICHT')
ok((await as('team@sva.de', `select count(*)::int n from sva_partner_anfragen`)).rows[0].n === 0, 'Team liest Anfragen NICHT')
ok((await as('chef@sva.de', `select count(*)::int n from sva_partner_anfragen`)).rows[0].n === 1, 'Admin liest Anfragen')
await as('chef@sva.de', `update sva_partner_anfragen set status = 'in_kontakt', notiz = 'Rückruf Mi', updated_at = now()`)
ok((await db.query(`select status from sva_partner_anfragen`)).rows[0].status === 'in_kontakt', 'Admin setzt Status + Notiz')
await expectErr(as('chef@sva.de', `update sva_partner_anfragen set status = 'egal'`), 'Status geprüft')

// Honeypot + zu schnell → still ok, nichts gespeichert
r = (await send({ hp: 'http://spam.example', email: 'bot@spam.example' })).rows[0].r
ok(r.ok === true && (await count(`select count(*)::int n from sva_partner_anfragen where email='bot@spam.example'`)) === 0, 'Honeypot: still verworfen')
r = (await send({ ms: 300, email: 'fast@spam.example' })).rows[0].r
ok(r.ok === true && (await count(`select count(*)::int n from sva_partner_anfragen where email='fast@spam.example'`)) === 0, 'zu schnell (<1,5 s): still verworfen')

// Validierung
await expectErr(send({ email: 'keine-mail' }), 'E-Mail geprüft', /partner_anfrage_ungueltig:email/)
await expectErr(send({ firma: 'X' }), 'Firma geprüft', /ungueltig:firma/)
await expectErr(send({ name: '' }), 'Name geprüft', /ungueltig:name/)
await expectErr(send({ ds: false }), 'Datenschutz-Häkchen Pflicht', /ungueltig:datenschutz/)
await expectErr(send({ tel: 'ruf an!' }), 'Telefon geprüft', /ungueltig:telefon/)
await expectErr(send({ msg: 'x'.repeat(2001) }), 'Nachricht max. 2000 Zeichen', /ungueltig:nachricht/)
r = (await send({ email: 'ohne@paket.example', paket: '00000000-0000-4000-8000-000000000999', quelle: 'Böse Quelle!' })).rows[0].r
const op = (await db.query(`select paket_id, paket_name, quelle from sva_partner_anfragen where email='ohne@paket.example'`)).rows[0]
ok(r.ok && op.paket_id === null && op.paket_name === null && op.quelle === null, 'unbekanntes Paket/kaputte Quelle → Anfrage ohne Paket/Quelle angenommen')
const sm = pk['Social-Media-Paket']
await send({ email: 'versteckt@paket.example', paket: sm })
ok((await db.query(`select paket_id from sva_partner_anfragen where email='versteckt@paket.example'`)).rows[0].paket_id === null, 'verstecktes Paket wird nicht übernommen')

// Rate-Limit je E-Mail (5/h)
for (let i = 0; i < 4; i++) await send({ email: 'viel@x.example' }, { 'x-forwarded-for': `198.51.100.${i}` })
await send({ email: 'viel@x.example' }, { 'x-forwarded-for': '198.51.100.9' })
await expectErr(send({ email: 'VIEL@x.example' }, { 'x-forwarded-for': '198.51.100.10' }), '6. Anfrage je E-Mail/Std. gebremst (auch Großschreibung)', /partner_anfrage_limit/)
// Rate-Limit je IP (5/h): 203.0.113.7 hat schon 1 + 2 (ohne Paket/versteckt) = 3
await send({ email: 'ip1@x.example' })
await send({ email: 'ip2@x.example' })
await expectErr(send({ email: 'ip3@x.example' }), '6. Anfrage je IP/Std. gebremst', /partner_anfrage_limit/)
// ohne IP-Header (z. B. direkter Aufruf) → nur E-Mail-Limit
r = (await send({ email: 'ohneip@x.example' }, {})).rows[0].r
ok(r.ok && (await db.query(`select ip_hash from sva_partner_anfragen where email='ohneip@x.example'`)).rows[0].ip_hash === null, 'ohne IP-Header: angenommen, kein Hash')

// Gesamt-Limit (40/h)
await db.exec(`insert into sva_partner_anfragen (firma, ansprechpartner, email, datenschutz_ok)
  select 'Flut ' || g, 'Name', 'flut' || g || '@x.example', true from generate_series(1, 40) g`)
await expectErr(send({ email: 'neu@x.example' }, { 'x-forwarded-for': '192.0.2.200' }), 'Gesamt-Limit 40/Std.', /partner_anfrage_limit/)
await db.exec(`delete from sva_partner_anfragen where firma like 'Flut %'`)

// Aufräumen: IP-Hash nach 7 Tagen weg, abgelehnt nach 6 Monaten, offen nach 12 Monaten, gewonnen bleibt
await db.exec(`update sva_partner_anfragen set created_at = now() - interval '8 days', updated_at = now() - interval '8 days'`)
await db.exec(`insert into sva_partner_anfragen (firma, ansprechpartner, email, datenschutz_ok, status, updated_at, created_at) values
  ('Alt abgelehnt', 'N N', 'a1@x.example', true, 'abgelehnt', now() - interval '7 months', now() - interval '8 months'),
  ('Alt offen', 'N N', 'a2@x.example', true, 'neu', now() - interval '13 months', now() - interval '13 months'),
  ('Alt gewonnen', 'N N', 'a3@x.example', true, 'gewonnen', now() - interval '3 years', now() - interval '3 years'),
  ('Frisch abgelehnt', 'N N', 'a4@x.example', true, 'abgelehnt', now() - interval '1 month', now() - interval '1 month')`)
await send({ email: 'trigger@x.example' }, { 'x-forwarded-for': '192.0.2.1' })
ok((await count(`select count(*)::int n from sva_partner_anfragen where ip_hash is not null and created_at < now() - interval '7 days'`)) === 0, 'Aufräumen: IP-Hashes älter als 7 Tage geleert')
const rest = (await db.query(`select firma from sva_partner_anfragen where firma like 'Alt %' or firma like 'Frisch %' order by firma`)).rows.map((x) => x.firma)
ok(JSON.stringify(rest) === JSON.stringify(['Alt gewonnen', 'Frisch abgelehnt']), 'Aufräumen: abgelehnt > 6 Mon. + offen > 12 Mon. gelöscht, gewonnen bleibt ' + JSON.stringify(rest))

// Webhook über pg_net-Stub
await db.exec(`create schema if not exists net;
  create table net.calls (url text, body jsonb);
  create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000)
    returns bigint language sql as $$ insert into net.calls values (url, body); select 1::bigint $$;`)
await send({ email: 'hook0@x.example' }, { 'x-forwarded-for': '192.0.2.50' })
ok((await count(`select count(*)::int n from net.calls`)) === 0, 'Webhook: ohne URL kein Aufruf')
await db.exec(`update sm_webhooks set url = 'https://n8n.example/webhook/partner' where event = 'partner.anfrage'`)
await send({ email: 'hook@x.example', firma: 'Hook GmbH' }, { 'x-forwarded-for': '192.0.2.51' })
const call = (await db.query(`select * from net.calls`)).rows[0]
ok(call?.url === 'https://n8n.example/webhook/partner' && call.body.firma === 'Hook GmbH' && !JSON.stringify(call.body).includes('hook@x.example'), 'Webhook: n8n-Aufruf ohne E-Mail/Telefon ' + JSON.stringify(call?.body ?? {}).slice(0, 120))
ok((await count(`select count(*)::int n from sm_webhook_deliveries where event='partner.anfrage'`)) === 1, 'Webhook: Zustellung protokolliert')
await db.exec(`drop function net.http_post(text, jsonb, jsonb, jsonb, integer); create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$ begin raise exception 'netz kaputt'; end $$;`)
r = (await send({ email: 'hookfail@x.example' }, { 'x-forwarded-for': '192.0.2.52' })).rows[0].r
ok(r.ok && (await count(`select count(*)::int n from sva_partner_anfragen where email='hookfail@x.example'`)) === 1, 'Webhook-Fehler verliert die Anfrage nicht')

// Funktionsrechte
const priv = (await db.query(`select
  has_function_privilege('anon', 'public.partner_anfrage(text,text,text,text,uuid,text,boolean,text,integer,text)', 'execute') a,
  has_function_privilege('anon', 'public.web_snapshot()', 'execute') b,
  has_function_privilege('anon', 'public.is_sm_admin()', 'execute') c`)).rows[0]
ok(priv.a && priv.b && !priv.c, 'Rechte: anon=partner_anfrage, anon=web_snapshot, anon≠is_sm_admin ' + JSON.stringify(priv))

// Paket löschen → Sponsor/Anfrage behalten Daten (set null), Snapshot bleibt gültig
await as('chef@sva.de', `delete from sva_partner_pakete where id = $1`, [bande])
ok((await count(`select count(*)::int n from sm_sponsoren where partner_paket_id is null and name in ('Autohaus Müller','Bäckerei Behrens')`)) === 2, 'Paket gelöscht → Sponsoren bleiben (Paket leer)')
ok((await db.query(`select paket_name from sva_partner_anfragen where email='jana@peters.example'`)).rows[0].paket_name === 'Bande am Spielfeld', 'Anfrage behält den Paketnamen')
snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(snap.partner.pakete.length === 3 && snap.players.length > 20, 'Snapshot danach gültig (Pakete 3, Kader da)')

// Leerer Zustand: keine Pakete, keine Mediadaten → partner ohne Mediadaten-Felder
await db.exec(`delete from sva_partner_pakete; update sva_partner_info set instagram_follower=null, reichweite_monat=null, zuschauer_heim=null, stand=null, live_partner_id=null`)
snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(Array.isArray(snap.partner.pakete) && snap.partner.pakete.length === 0 && JSON.stringify(snap.partner.mediadaten) === '{}' && !('livePartner' in snap.partner), 'Leerer Partner-Bereich: ' + JSON.stringify(snap.partner))
console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
