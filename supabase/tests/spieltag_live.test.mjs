// PGlite-Test der Migration 20261005100000_sva_spieltag_live.sql: Rollen,
// Ticker-Trigger, Team-Wächter, web_live, Spielort/Trainingsort. Läuft gegen
// eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/spieltag_live.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node spieltag_live.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261005100000_sva_spieltag_live.sql'
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
// Supabase-Default: authenticated/anon haben Tabellenrechte auf public (RLS schützt)
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
await run(NEU) // zweiter Lauf: idempotent
await db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)

// Prod-ähnlicher Zustand: Adresse steht auf dem Trainingsplatz
await db.exec(`update sva_settings set adresse = 'Sportplatz an der B73, Am Paschberg 1, 21684 Agathenburg', training_ort = null where id = 1`)
await run(NEU)
let st = (await db.query(`select adresse, training_ort from sva_settings where id=1`)).rows[0]
ok(st.adresse.startsWith('Waldsportplatz') && st.training_ort.includes('B73'), 'Spielort/Trainingsort umgezogen: ' + JSON.stringify(st))
await db.exec(`update sva_settings set training_ort = 'Eigener Text' where id=1`)
await run(NEU)
st = (await db.query(`select training_ort from sva_settings where id=1`)).rows[0]
ok(st.training_ort === 'Eigener Text', 'gepflegter Trainingsort bleibt bei erneutem Lauf')

// Admins + Team
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const as = async (email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql) => { await db.exec(`set role anon;`); try { return await db.query(sql) } finally { await db.exec('reset role') } }
const expectErr = async (p, msg) => { try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(true, msg + ' → ' + e.message.slice(0, 90)) } }

ok((await as('chef@sva.de', `select public.is_sm_admin() a, public.is_sva_team() t, public.sva_meine_rolle() r`)).rows[0].r === 'admin', 'chef = admin')
const tr = (await as('team@sva.de', `select public.is_sm_admin() a, public.is_sva_team() t, public.sva_meine_rolle() r`)).rows[0]
ok(!tr.a && tr.t && tr.r === 'team', 'team: kein Admin, aber Team ' + JSON.stringify(tr))
ok((await as('fremd@x.de', `select public.sva_meine_rolle() r`)).rows[0].r === null, 'fremd: keine Rolle')
await expectErr(asAnon(`select public.is_sva_team()`), 'anon darf is_sva_team nicht ausführen')

// Team & Zugänge
ok((await as('chef@sva.de', `select count(*)::int n from sm_admins`)).rows[0].n === 2, 'Admin sieht alle Zugänge')
ok((await as('team@sva.de', `select count(*)::int n from sm_admins`)).rows[0].n === 1, 'Team sieht nur sich selbst')
await as('chef@sva.de', `insert into sm_admins (email, rolle, name) values ('neu@sva.de', 'team', 'Neu')`)
ok((await db.query(`select count(*)::int n from sm_admins where email='neu@sva.de'`)).rows[0].n === 1, 'Admin legt Team-Zugang an')
await expectErr(as('chef@sva.de', `insert into sm_admins (email, rolle) values ('Gross@SVA.de ', 'team')`), 'E-Mail muss klein/ohne Leerzeichen sein')
await expectErr(as('team@sva.de', `insert into sm_admins (email) values ('hacker@x.de')`), 'Team darf keine Zugänge anlegen')
await as('chef@sva.de', `delete from sm_admins where email='chef@sva.de'`)
ok((await db.query(`select count(*)::int n from sm_admins where email='chef@sva.de'`)).rows[0].n === 1, 'Admin kann sich nicht selbst löschen')
await as('chef@sva.de', `update sm_admins set rolle='team' where email='chef@sva.de'`)
ok((await db.query(`select rolle from sm_admins where email='chef@sva.de'`)).rows[0].rolle === 'admin', 'Admin kann sich nicht selbst herabstufen')
await as('chef@sva.de', `delete from sm_admins where email='neu@sva.de'`)
ok((await db.query(`select count(*)::int n from sm_admins where email='neu@sva.de'`)).rows[0].n === 0, 'Admin entfernt Zugang')

// Spiel anlegen (Admin), Team-Rechte an sm_spiele
const sp = (await as('chef@sva.de', `insert into sm_spiele (gegner, heim, anstoss, ort) values ('TuS Fischbek', true, now() + interval '10 minutes', 'Waldsportplatz') returning id`)).rows[0].id
await expectErr(as('team@sva.de', `insert into sm_spiele (gegner, anstoss) values ('X', now())`), 'Team darf keine Spiele anlegen')
await expectErr(as('team@sva.de', `update sm_spiele set gegner='Fake' where id=$1`, [sp]), 'Team darf Stammdaten nicht ändern')
await as('team@sva.de', `update sm_spiele set tore_sva=1, tore_gegner=0 where id=$1`, [sp])
ok((await db.query(`select tore_sva from sm_spiele where id=$1`, [sp])).rows[0].tore_sva === 1, 'Team darf Ergebnis eintragen')
await as('team@sva.de', `update sm_spiele set tore_sva=null, tore_gegner=null where id=$1`, [sp])
await as('team@sva.de', `delete from sm_spiele where id=$1`, [sp])
ok((await db.query(`select count(*)::int n from sm_spiele where id=$1`, [sp])).rows[0].n === 1, 'Team kann keine Spiele löschen')
ok((await as('team@sva.de', `select count(*)::int n from sm_roster`)).rows[0].n > 20, 'Team liest Kader')
ok((await as('team@sva.de', `select count(*)::int n from sva_settings`)).rows[0].n === 0, 'Team liest sva_settings NICHT')
await expectErr(as('team@sva.de', `insert into sm_roster (name) values ('X')`), 'Team darf Kader nicht schreiben')

// Aufstellung durch Team
const ids = (await db.query(`select id from sm_roster where rolle='spieler' order by sortierung limit 15`)).rows.map((r) => r.id)
await as('team@sva.de', `insert into sva_lineup (formation, startelf, bank, spiel_id) values ('4-4-2', $1::uuid[], $2::uuid[], $3)`, [ids.slice(0, 11), ids.slice(11), sp])
ok((await db.query(`select count(*)::int n from sva_lineup where spiel_id=$1`, [sp])).rows[0].n === 1, 'Team speichert Aufstellung zum Spiel')

// web_live vor Anpfiff
let live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.match?.status === 'geplant' && live.match.opponent === 'TuS Fischbek', 'web_live: nächstes Spiel geplant')
ok(live.lineup?.forMatch === true && live.lineup.startelf.length === 11, 'web_live: Aufstellung zum Spiel')
ok(live.settings.address?.startsWith('Waldsportplatz'), 'web_live: Spielort')
ok(!JSON.stringify(live).includes('@sva.de'), 'web_live: keine E-Mails')

// Ticker: Anpfiff vor 30 min, Tore, Wechsel, Halbzeit …
const ev = async (typ, min, extra = {}) => as('team@sva.de',
  `insert into sva_ticker (id, spiel_id, typ, minute, roster_id, roster_id_2, text, zeitpunkt) values (coalesce($1, gen_random_uuid()), $2, $3, $4, $5, $6, $7, coalesce($8, now())) returning id`,
  [extra.id ?? null, sp, typ, min, extra.r1 ?? null, extra.r2 ?? null, extra.text ?? null, extra.at ?? null])
const anpfiffId = (await ev('anpfiff', 1, { at: new Date(Date.now() - 30 * 60000).toISOString() })).rows[0].id
await ev('tor', 12, { r1: ids[9], r2: ids[8], at: new Date(Date.now() - 19 * 60000).toISOString() })
const dupId = (await ev('gegentor', 20, { at: new Date(Date.now() - 11 * 60000).toISOString() })).rows[0].id
await expectErr(ev('gegentor', 20, { id: dupId }), 'Doppeltes Senden scheitert am Primärschlüssel')
await ev('gelb', 25, { r1: ids[3] })
let s = (await db.query(`select status, live_tore_sva, live_tore_gegner, tore_sva, anpfiff_at from sm_spiele where id=$1`, [sp])).rows[0]
ok(s.status === 'live' && s.live_tore_sva === 1 && s.live_tore_gegner === 1 && s.tore_sva === null, 'Trigger: live 1:1 ' + JSON.stringify(s))
live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.match.status === 'live' && live.match.minute === 31 && live.match.half === 1, 'web_live: Minute 31 (1. HZ) → ' + live.match.minute)
ok(live.events.length === 4 && live.events[0].type === 'gelb', 'web_live: Ticker neueste zuerst')
ok(live.events.find((e) => e.type === 'tor')?.player && live.players.some((p) => p.id === live.events.find((e) => e.type === 'tor').player), 'web_live: Torschütze als slug + Spielerliste')
await expectErr(asAnon(`select * from sva_ticker`).then((r) => { if (r.rows.length) throw new Error('lesbar'); return Promise.reject(new Error('leer (RLS)')) }), 'anon liest sva_ticker nicht direkt')

// Uhr stellen (Update des Anpfiff-Ereignisses)
await as('team@sva.de', `update sva_ticker set zeitpunkt = now() - interval '40 minutes' where id=$1`, [anpfiffId])
live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.match.minute === 41, 'Uhr gestellt → Minute 41: ' + live.match.minute)

await ev('halbzeit', 45, { at: new Date(Date.now() - 1000).toISOString() })
ok((await asAnon(`select public.web_live() j`)).rows[0].j.match.status === 'halbzeit', 'Halbzeit')
await ev('wiederanpfiff', 46, { at: new Date().toISOString() })
live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.match.status === 'live' && live.match.half === 2 && live.match.minute === 46, '2. HZ Minute 46: ' + live.match.minute)
await ev('wechsel', 60, { r1: ids[12], r2: ids[9] })
const abpfiffId = (await ev('abpfiff', 90, { at: new Date(Date.now() + 1000).toISOString() })).rows[0].id
s = (await db.query(`select status, tore_sva, tore_gegner from sm_spiele where id=$1`, [sp])).rows[0]
ok(s.status === 'beendet' && s.tore_sva === 1 && s.tore_gegner === 1, 'Abpfiff → Endergebnis 1:1 ' + JSON.stringify(s))
await as('team@sva.de', `delete from sva_ticker where id=$1`, [abpfiffId])
s = (await db.query(`select status, tore_sva from sm_spiele where id=$1`, [sp])).rows[0]
ok(s.status === 'live' && s.tore_sva === null, 'Rückgängig Abpfiff → wieder live, Ergebnis weg')
await ev('tor', 88, { r1: ids[12] })
await ev('abpfiff', 90, { at: new Date(Date.now() + 2000).toISOString() })
await as('team@sva.de', `update sm_spiele set motm_roster_id=$1 where id=$2`, [ids[12], sp])
live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.match.status === 'beendet' && live.match.goalsFor === 2 && live.match.goalsAgainst === 1 && live.match.motm, 'web_live: Endstand 2:1 + MOTM')

const snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(snap.settings.trainingOrt === 'Eigener Text' && snap.lastMatch?.goalsFor === 2, 'web_snapshot: trainingOrt + lastMatch')
await expectErr(as('chef@sva.de', `update sva_settings set fussball_de_widget_tabelle='kurz' where id=1`), 'Widget-ID muss 32 Zeichen haben')
await as('chef@sva.de', `update sva_settings set fussball_de_widget_tabelle='02EP29CA1O000000VS5489B2VVP292BR' where id=1`)
ok((await asAnon(`select public.web_live() j`)).rows[0].j.settings.widgetTabelle === '02EP29CA1O000000VS5489B2VVP292BR', 'Widget-ID im web_live')

// Rechte
const priv = (await db.query(`select has_function_privilege('anon','public.is_sm_admin()','execute') a, has_function_privilege('anon','public.web_live()','execute') b, has_function_privilege('authenticated','public.sva_spiel_live_sync(uuid)','execute') c`)).rows[0]
ok(!priv.a && priv.b && !priv.c, 'Rechte: anon≠is_sm_admin, anon=web_live, authenticated≠sync ' + JSON.stringify(priv))

// Kein Spiel → web_live trotzdem gültig
await db.exec(`delete from sm_spiele`)
live = (await asAnon(`select public.web_live() j`)).rows[0].j
ok(live.match === null && Array.isArray(live.events) && live.settings, 'web_live ohne Spiel')
console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
