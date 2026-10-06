// PGlite-Test der Migration 20261015100000_sva_live_v23.sql: Erlaubnis-Gate,
// Bot-Ticker-RPC, Dedupe/Hand-Schutz, Reaktionen (+Limit/Demo/Verdichtung),
// web_live() v2, tipp_live_kurz, Konferenz-Frische, Rollen. In-Memory-Postgres
// mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/live_v23.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node live_v23.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261015100000_sva_live_v23.sql'
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

const as = async (email, sql, params, uid) => {
  const claims = { email, role: 'authenticated' }
  if (uid) claims.sub = uid
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify(claims)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => { await db.exec(`set role anon;`); try { return await db.query(sql, params) } finally { await db.exec('reset role') } }
const asService = async (sql, params) => { await db.exec(`set role service_role;`); try { return await db.query(sql, params) } finally { await db.exec('reset role') } }
const expectErr = async (p, msg) => { try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(true, msg + ' → ' + e.message.slice(0, 70)) } }

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)

// ── Erlaubnis-Gate (A4) ──────────────────────────────────────────────────────
ok((await db.query(`select fupa_live_modus from sva_settings where id=1`)).rows[0].fupa_live_modus === 'aus', 'A3: Modus nach Migration = aus')
await expectErr(as('chef@sva.de', `update sva_settings set fupa_live_modus='an' where id=1`), 'A4: Modus an ohne Erlaubnis-Notiz → Fehler')
await as('team@sva.de', `update sva_settings set fupa_erlaubnis_notiz='x' where id=1`)
ok((await db.query(`select fupa_erlaubnis_notiz from sva_settings where id=1`)).rows[0].fupa_erlaubnis_notiz == null, 'Team-Update an sva_settings wirkungslos (RLS nur Admin)')
await as('chef@sva.de', `update sva_settings set fupa_erlaubnis_notiz='Mail C. Nähring 12.10.2026', fupa_erlaubnis_datum='2026-10-12', fupa_erlaubnis_art='vorlaeufig' where id=1`)
await as('chef@sva.de', `update sva_settings set fupa_live_modus='an' where id=1`)
ok((await db.query(`select fupa_live_modus from sva_settings where id=1`)).rows[0].fupa_live_modus === 'an', 'Modus an mit Erlaubnis-Notiz')

// ── Spiel + Kader ────────────────────────────────────────────────────────────
const sp = (await as('chef@sva.de', `insert into sm_spiele (gegner, heim, anstoss, ort, fupa_id, spieltag_nr, live_quelle)
  values ('Deinster SV', true, now() - interval '30 minutes', 'Waldsportplatz', 15241638, 9, 'fupa') returning id`)).rows[0].id
const rid = (await db.query(`select id, slug, name from sm_roster where rolle='spieler' order by sortierung limit 1`)).rows[0]
await db.exec(`insert into sva_tipp_spieltage (spiel_id) values ('${sp}')`)

// ── Bot-Ticker-RPC: nur service_role (A... ) ─────────────────────────────────
await expectErr(as('team@sva.de', `select sva_fupa_ticker_anwenden('${sp}', '{}'::jsonb)`), 'Bot-RPC nur service_role (team nein)')
await expectErr(asAnon(`select sva_fupa_ticker_anwenden('${sp}', '{}'::jsonb)`), 'Bot-RPC nur service_role (anon nein)')

// Bot trägt Anpfiff + Tor (mit Kader-Spieler) + Gegentor ein
const anp = new Date(Date.now() - 30 * 60000).toISOString()
await asService(`select sva_fupa_ticker_anwenden('${sp}', $1::jsonb)`, [JSON.stringify({
  einfuegen: [
    { fupa_event_id: 5001, typ: 'anpfiff', minute: 1, team: null, text_quelle: 'vorlage', zeitpunkt: anp },
    { fupa_event_id: 5002, typ: 'tor', minute: 10, roster_id: rid.id, team: 'sva', text_quelle: 'vorlage', zeitpunkt: new Date(Date.now() - 20 * 60000).toISOString() },
    { fupa_event_id: 5003, typ: 'gegentor', minute: 20, fupa_name: 'Moritz Glodeck', team: 'gegner', text_quelle: 'vorlage', zeitpunkt: new Date(Date.now() - 10 * 60000).toISOString() },
  ], stream_ts: 1791174635,
})])
let s = (await db.query(`select status, live_tore_sva, live_tore_gegner, fupa_stream_ts from sm_spiele where id='${sp}'`)).rows[0]
ok(s.status === 'live' && s.live_tore_sva === 1 && s.live_tore_gegner === 1 && Number(s.fupa_stream_ts) === 1791174635, 'Bot: live 1:1, stream_ts gesetzt ' + JSON.stringify(s))

// ── Dedupe: Pult-Tor Minute 11, Bot versteckt sein Tor (A6) ──────────────────
const pultTor = (await as('team@sva.de', `insert into sva_ticker (id, spiel_id, typ, minute, roster_id, zeitpunkt)
  values (gen_random_uuid(), '${sp}', 'tor', 11, '${rid.id}', now() - interval '19 minutes') returning id`)).rows[0].id
const botTor = (await db.query(`select id from sva_ticker where fupa_event_id=5002`)).rows[0].id
await asService(`select sva_fupa_ticker_anwenden('${sp}', $1::jsonb)`, [JSON.stringify({ verstecken: [{ id: botTor, duplikat_von: pultTor }] })])
s = (await db.query(`select live_tore_sva from sm_spiele where id='${sp}'`)).rows[0]
ok(s.live_tore_sva === 1, 'A6: Pult-Tor + verstecktes Bot-Tor → genau 1 sichtbares Tor')
ok((await db.query(`select versteckt, duplikat_von from sva_ticker where id='${botTor}'`)).rows[0].versteckt === true, 'Bot-Tor versteckt + duplikat_von gesetzt')

// ── Hand-Schutz (A7): authenticated edit → gesperrt; delete → versteckt+gesperrt
const botGeg = (await db.query(`select id from sva_ticker where fupa_event_id=5003`)).rows[0].id
await as('team@sva.de', `update sva_ticker set text='Korrigiert' where id='${botGeg}'`)
let g = (await db.query(`select gesperrt, text_quelle, text from sva_ticker where id='${botGeg}'`)).rows[0]
ok(g.gesperrt === true && g.text_quelle === 'pult', 'A7: Hand-Edit Bot-Zeile → gesperrt + text_quelle=pult')
// Bot-Abgleich darf gesperrte Zeile nicht ändern/löschen
await asService(`select sva_fupa_ticker_anwenden('${sp}', $1::jsonb)`, [JSON.stringify({ aendern: [{ id: botGeg, patch: { text: 'Bot-Text' } }], loeschen: [botGeg] })])
g = (await db.query(`select text, versteckt from sva_ticker where id='${botGeg}'`)).rows[0]
ok(g.text === 'Korrigiert' && g.versteckt === false, 'A7: gesperrte Zeile bleibt unverändert und erhalten')
// authenticated delete einer anderen fupa-Zeile (Anpfiff) → versteckt+gesperrt, kein echter Delete
const botAnp = (await db.query(`select id from sva_ticker where fupa_event_id=5001`)).rows[0].id
await as('team@sva.de', `delete from sva_ticker where id='${botAnp}'`)
g = (await db.query(`select versteckt, gesperrt from sva_ticker where id='${botAnp}'`)).rows[0]
ok(g && g.versteckt === true && g.gesperrt === true, 'A7: Hand-Delete Bot-Zeile → versteckt+gesperrt (Zeile bleibt)')

// ── Team darf live_quelle, aber keine fupa_*-Felder ──────────────────────────
await as('team@sva.de', `update sm_spiele set live_quelle='auto' where id='${sp}'`)
ok((await db.query(`select live_quelle from sm_spiele where id='${sp}'`)).rows[0].live_quelle === 'auto', 'Team darf live_quelle setzen')
await expectErr(as('team@sva.de', `update sm_spiele set fupa_minute=50 where id='${sp}'`), 'Team darf fupa_* nicht setzen')
await as('chef@sva.de', `update sm_spiele set live_quelle='fupa' where id='${sp}'`)

// ── web_live() v2 ────────────────────────────────────────────────────────────
let live = (await asAnon(`select web_live() j`)).rows[0].j
ok(live.version === 2, 'web_live version 2')
ok(live.match.source === 'fupa' && live.match.fupaUrl === 'https://www.fupa.net/match/15241638', 'web_live: source fupa + fupaUrl')
ok(!live.events.some((e) => e.id === botTor), 'web_live: versteckte Zeile nicht enthalten')
ok(live.events.some((e) => e.type === 'gegentor' && e.name === 'Moritz Glodeck' && e.team === 'gegner'), 'web_live: Gegentor mit fupa_name + team')
ok(live.events.every((e) => !e.source || e.source === 'fupa'), 'web_live: Ereignis-source gesetzt')

// ── Reaktionen ───────────────────────────────────────────────────────────────
// Sichtbaren Pult-Anpfiff ergänzen (der Bot-Anpfiff wurde im A7-Test versteckt) → Spiel live.
await as('team@sva.de', `insert into sva_ticker (id, spiel_id, typ, minute, zeitpunkt) values (gen_random_uuid(), '${sp}', 'anpfiff', 1, now() - interval '35 minutes')`)
ok((await db.query(`select status from sm_spiele where id='${sp}'`)).rows[0].status === 'live', 'Spiel wieder live nach Pult-Anpfiff')
const uid = (await db.query(`insert into auth.users (email) values ('fan@x.de') returning id`)).rows[0].id
await db.exec(`insert into sva_album_fans (user_id, vorname, initial, einwilligung_at) values ('${uid}', 'Max', 'M', now())`)
const sichtbarTor = pultTor // Pult-Tor ist sichtbar
await expectErr(asAnon(`select sva_reagieren('${sichtbarTor}', 'tor')`), 'anon darf nicht reagieren')
let sum = (await as('fan@x.de', `select sva_reagieren('${sichtbarTor}', 'tor') j`, [], uid)).rows[0].j
ok(sum.tor === 1, 'Reaktion gesetzt (tor=1)')
sum = (await as('fan@x.de', `select sva_reagieren('${sichtbarTor}', 'feuer') j`, [], uid)).rows[0].j
ok(sum.feuer === 1 && !sum.tor, '1 pro Konto+Ereignis: Wechsel tor→feuer')
await expectErr(as('fan@x.de', `select sva_reagieren('${botAnp}', 'tor')`, [], uid), 'Reaktion nur an erlaubten Typen (anpfiff nein)')
sum = (await as('fan@x.de', `select sva_reagieren('${sichtbarTor}', null) j`, [], uid)).rows[0].j
ok(!sum.feuer, 'Reaktion zurückgenommen')
// mehrere Ereignisse für Limit 30: 31 künstliche tor-Zeilen? Prüfe Limit mit kleiner Schranke via direkter Zählung
// (Limit-Logik: 30 verschiedene Ereignisse). Wir legen 31 sichtbare Pult-Tore an.
await db.exec(`do $$ declare i int; begin for i in 1..31 loop
  insert into sva_ticker (id, spiel_id, typ, minute, zeitpunkt) values (gen_random_uuid(), '${sp}', 'tor', 50, now()); end loop; end $$;`)
const tore = (await db.query(`select id from sva_ticker where spiel_id='${sp}' and typ='tor' and minute=50 order by created_at limit 31`)).rows.map((r) => r.id)
for (let i = 0; i < 30; i++) await as('fan@x.de', `select sva_reagieren('${tore[i]}', 'tor')`, [], uid)
await expectErr(as('fan@x.de', `select sva_reagieren('${tore[30]}', 'tor')`, [], uid), 'Limit 30 Reaktionen/Spiel → Fehler')

// Demo verboten (Demo-Spiel über Superuser anlegen; der Demo-Wächter blockt authenticated)
const spD = (await db.query(`insert into sm_spiele (gegner, heim, anstoss, demo, status) values ('Demo', true, now(), true, 'live') returning id`)).rows[0].id
const dTor = (await db.query(`insert into sva_ticker (id, spiel_id, typ, minute, zeitpunkt) values (gen_random_uuid(), '${spD}', 'tor', 5, now()) returning id`)).rows[0].id
await expectErr(as('fan@x.de', `select sva_reagieren('${dTor}', 'tor')`, [], uid), 'Reaktion im Demo verboten')

// Konto löschen kaskadiert
await db.exec(`delete from auth.users where id='${uid}'`)
ok((await db.query(`select count(*)::int n from sva_reaktion`)).rows[0].n === 0, 'Konto löschen → Reaktionen weg (kaskadiert)')

// Verdichtung: Abpfiff > 7 Tage her → Summen, Einzelzeilen weg
const uid2 = (await db.query(`insert into auth.users (email) values ('fan2@x.de') returning id`)).rows[0].id
await db.exec(`insert into sva_album_fans (user_id, vorname, initial, einwilligung_at) values ('${uid2}', 'Lea', 'L', now())`)
const spAlt = (await as('chef@sva.de', `insert into sm_spiele (gegner, heim, anstoss, status, live_quelle) values ('Alt', true, now() - interval '10 days', 'beendet', 'pult') returning id`)).rows[0].id
const altTor = (await as('team@sva.de', `insert into sva_ticker (id, spiel_id, typ, minute, zeitpunkt) values (gen_random_uuid(), '${spAlt}', 'tor', 5, now() - interval '10 days') returning id`)).rows[0].id
await as('team@sva.de', `insert into sva_ticker (id, spiel_id, typ, minute, zeitpunkt) values (gen_random_uuid(), '${spAlt}', 'abpfiff', 90, now() - interval '10 days')`)
await db.exec(`insert into sva_reaktion (ticker_id, user_id, emoji) values ('${altTor}', '${uid2}', 'applaus')`)
const vn = (await asService(`select sva_reaktion_verdichten() n`)).rows[0].n
ok(Number(vn) >= 1 && (await db.query(`select count(*)::int n from sva_reaktion`)).rows[0].n === 0
   && (await db.query(`select anzahl from sva_reaktion_summe where ticker_id='${altTor}' and emoji='applaus'`)).rows[0]?.anzahl === 1,
   'Verdichtung: Einzelreaktionen → Summe, Einzelzeilen weg')

// ── tipp_live_kurz: vor/nach Tippschluss, Demo ausgeschlossen ─────────────────
ok((await asAnon(`select tipp_live_kurz('${spD}') j`)).rows[0].j === null, 'tipp_live_kurz: Demo ausgeschlossen')
// Teilnehmer + Tipps auf Pflichtspiel sp
await db.exec(`insert into auth.users (email) values ('t1@x.de'),('t2@x.de'),('t3@x.de')`)
const us = (await db.query(`select id from auth.users where email in ('t1@x.de','t2@x.de','t3@x.de') order by email`)).rows.map((r) => r.id)
for (const u of us) await db.exec(`insert into sva_album_fans (user_id, vorname, initial, einwilligung_at) values ('${u}','Ab','A',now());
  insert into sva_tipp_teilnehmer (user_id) values ('${u}');`)
// Tipps direkt setzen (Tippschluss-Wächter für die Dateneinrichtung aussetzen)
await db.exec(`set session_replication_role = replica;
  insert into sva_tipp_tipps (user_id, spiel_id, tore_sva, tore_gegner) values
  ('${us[0]}','${sp}',2,0),('${us[1]}','${sp}',1,1),('${us[2]}','${sp}',3,1);
  set session_replication_role = origin;`)
// sp ist live (angepfiffen) → Tippschluss vorbei → Tendenzen
let tk = (await asAnon(`select tipp_live_kurz('${sp}') j`)).rows[0].j
ok(tk.tipps === 3 && tk.sieg === 67 && tk.remis === 33, 'tipp_live_kurz nach Tippschluss: Tendenzen in % ' + JSON.stringify(tk))
// Ein offenes Pflichtspiel → nur Anzahl
const spOffen = (await as('chef@sva.de', `insert into sm_spiele (gegner, heim, anstoss) values ('Zukunft', true, now() + interval '2 days') returning id`)).rows[0].id
// Dateneinrichtung: seit v22 öffnet das nächste Spiel erst nach der Wertung → Wächter hier aussetzen
await db.exec(`set session_replication_role = replica;
  insert into sva_tipp_spieltage (spiel_id) values ('${spOffen}');
  insert into sva_tipp_tipps (user_id, spiel_id, tore_sva, tore_gegner) values ('${us[0]}','${spOffen}',1,0);
  set session_replication_role = origin;`)
tk = (await asAnon(`select tipp_live_kurz('${spOffen}') j`)).rows[0].j
ok(tk.tipps === 1 && tk.sieg === undefined, 'tipp_live_kurz vor Tippschluss: nur Anzahl')

// ── Konferenz nur frisch (≤10 min) ───────────────────────────────────────────
const heute = (await db.query(`select to_char((now() at time zone 'Europe/Berlin')::date, 'YYYY-MM-DD') d`)).rows[0].d
await db.exec(`insert into sva_konferenz (datum, saison, spieltag, spiele, tabelle, aktualisiert_at)
  values ('${new Date(Date.now() - 30 * 60000).toISOString().slice(0, 10)}', '2026/27', 9, '[{"heim":"A","gast":"B"}]'::jsonb, '{"zeilen":[],"stimmt":true}'::jsonb, now() - interval '30 minutes')`)
// Spiel sp hat anstoss heute? anstoss war now()-30min → heutiges Datum. Setze konferenz-Datum auf sp-Datum:
await db.exec(`update sva_konferenz set datum='${heute}' where saison='2026/27'`)
live = (await asAnon(`select web_live() j`)).rows[0].j
ok(live.conference == null, 'Konferenz: alte Daten (>10 min) → nicht geliefert')
await db.exec(`update sva_konferenz set aktualisiert_at=now() where datum='${heute}'`)
live = (await asAnon(`select web_live() j`)).rows[0].j
ok(live.conference && live.conference.stimmt === true, 'Konferenz: frische Daten geliefert')
await db.exec(`update sva_settings set konferenz_an=false where id=1`)
live = (await asAnon(`select web_live() j`)).rows[0].j
ok(live.conference == null, 'Konferenz aus → nicht geliefert')

// ── Rollen: anon/Team dürfen Admin-RPCs nicht ────────────────────────────────
await expectErr(asAnon(`select sva_admin_live_status('${sp}')`), 'anon darf sva_admin_live_status nicht')
const st = (await as('team@sva.de', `select sva_admin_live_status('${sp}') j`)).rows[0].j
ok(st.quelleEffektiv === 'fupa' && st.modus === 'an', 'Team: sva_admin_live_status liefert Quelle/Modus')

// ── Namens-Normalisierung + Zuordnung ────────────────────────────────────────
ok((await db.query(`select sva_name_norm('Müller-Lüdenscheidt') n`)).rows[0].n === 'mueller luedenscheidt', 'sva_name_norm: Umlaute + Bindestrich')

// Rechte-Stichprobe
const priv = (await db.query(`select has_function_privilege('anon','public.web_live()','execute') a,
  has_function_privilege('anon','public.sva_reagieren(uuid,text)','execute') b,
  has_function_privilege('service_role','public.sva_fupa_ticker_anwenden(uuid,jsonb)','execute') c,
  has_function_privilege('authenticated','public.sva_fupa_ticker_anwenden(uuid,jsonb)','execute') d`)).rows[0]
ok(priv.a && !priv.b && priv.c && !priv.d, 'Rechte: anon=web_live, anon≠reagieren, service=botRPC, authenticated≠botRPC ' + JSON.stringify(priv))

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
