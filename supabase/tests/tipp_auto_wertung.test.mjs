// PGlite-Test der Migration 20261018100000_sva_tipp_auto_wertung.sql (v25-B).
// Prüft: Auto-Wertung beendeter Pflichtspiele (≥ 30 min), „vorläufig“ bis MOTM,
// Nachwertung bei MOTM-/Bericht-Änderung (idempotent), 0-Tipp-Spiele werden
// gewertet (damit /tippen weiterschaltet), Vorführ-/Testspiele + „noch keine
// 30 min“ ausgeschlossen, Admin-Status (ungewertet seit X Std / vorläufig),
// Abschalter, manuelle Wertung übernimmt (auto_gewertet = false), Rechte.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/tipp_auto_wertung.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node tipp_auto_wertung.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261018100000_sva_tipp_auto_wertung.sql'
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
let oks = 0
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++; else oks++ }
const run = async (f) => { try { await db.exec(fs.readFileSync(M + f, 'utf8')); console.log('OK   migration', f) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) } }
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')

const claims = (uid, email) => JSON.stringify({ sub: uid, email, role: 'authenticated' })
const as = async (uid, email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(uid, email)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => { await db.exec(`set role anon;`); try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) } }
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 90)) }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const val = async (sql, params) => Object.values((await db.query(sql, params)).rows[0])[0]
const rpc = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]

// ── 1. Alle Migrationen ─────────────────────────────────────────────────────
const tippliga = '20261012100000_sva_tippliga.sql'
for (const f of files.filter((x) => x < NEU)) {
  if (f === tippliga) await defaults()
  await run(f)
  if (f === tippliga) await defaults()
}
await defaults()
await run(NEU)
await run(NEU) // idempotent
for (const f of files.filter((x) => x > NEU)) await run(f)
await defaults()

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const user = async (email, app) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, app ? { app } : {}])).id
await user('chef@sva.de')
const TEAM = await user('team@sva.de')
const F1 = await user('lena@fan.example', 'sva-album')
const F2 = await user('ole@fan.example', 'sva-album')
const admin = (sql, p) => as(TEAM, 'team@sva.de', sql, p) // Team reicht für Bericht/Werten
const team = admin
const fan1 = (sql, p) => as(F1, 'lena@fan.example', sql, p)
const fan2 = (sql, p) => as(F2, 'ole@fan.example', sql, p)

// Test-Kader (11 Spieler)
await db.exec(`update sm_roster set aktiv = false`)
const KADER = [['t-tw', 'Malte Pils', 'TW'], ['t-abw1', 'Justin Hüttry', 'ABW'], ['t-abw2', 'Lennard B', 'ABW'], ['t-abw3', 'Tom S', 'ABW'],
  ['t-mit1', 'Julio Paruzel', 'MIT'], ['t-mit2', 'Niclas Becker', 'MIT'], ['t-mit3', 'Noah Pejas', 'MIT'], ['t-mit4', 'Kai Helck', 'MIT'],
  ['t-ang1', 'Aaron Warkehr', 'ANG'], ['t-ang2', 'Marc Biedermann', 'ANG'], ['t-tw2', 'Tim Ebeling', 'TW']]
for (const [slug, name, pos] of KADER) await db.query(`insert into sm_roster (slug, name, position, aktiv, rolle) values ($1,$2,$3,true,'spieler')`, [slug, name, pos])
const rid = async (slug) => val(`select id v from sm_roster where slug = $1`, [slug])
const ELF = ['t-tw', 't-abw1', 't-mit1', 't-mit2', 't-ang1']
const ALLE11 = KADER.map((k) => k[0])
const ids = async (slugs) => Promise.all(slugs.map(rid))

await fan1(`select tipp_beitreten('Lena', 'K', true, true, true)`)
await fan2(`select tipp_beitreten('Ole', 'M', false, true, true)`)

const spiel = async (gegner, sql, { demo = false, wb = 'Kreisliga Stade' } = {}) =>
  (await db.query(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb, demo) values ($1, true, ${sql}, $2, $3) returning id`, [gegner, wb, demo])).rows[0].id

// ── 2. Spiel A: Tipps + Elf, dann Ticker (beendet seit 40 min) ─────────────
const A = await spiel('TuS Fischbek', `now() + interval '2 hours'`)
await fan1(`select tipp_abgeben($1, 2, 0)`, [A])
await fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [A, ELF, 't-ang1'])
await fan2(`select tipp_abgeben($1, 1, 1)`, [A]) // nur Ergebnis-Tipp, keine Elf
// Aufstellung (Startelf = alle 11) + Ticker: Anpfiff, Tor t-ang1, Abpfiff (40 min her)
await db.query(`insert into sva_lineup (formation, startelf, bank, spiel_id, match_label) values ('4-4-2', $1, '{}', $2, 'A')`, [await ids(ALLE11), A])
await db.query(`update sm_spiele set anstoss = now() - interval '2 hours' where id = $1`, [A])
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'anpfiff', 1, now() - interval '2 hours')`, [A])
await db.query(`insert into sva_ticker (spiel_id, typ, minute, roster_id, zeitpunkt) values ($1, 'tor', 23, $2, now() - interval '90 minutes')`, [A, await rid('t-ang1')])
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'abpfiff', 93, now() - interval '40 minutes')`, [A])
ok((await val(`select status v from sm_spiele where id = $1`, [A])) === 'beendet', 'A: beendet (Abpfiff im Ticker)')
ok((await val(`select tore_sva v from sm_spiele where id = $1`, [A])) === 1, 'A: Ergebnis 1:0 aus Ticker')

// vor dem Tick: nicht gewertet
ok((await val(`select gewertet_at v from sva_tipp_spieltage where spiel_id = $1`, [A])) == null, 'A: vor dem Tick ungewertet')

// ── 3. Auto-Tick wertet A automatisch (vorläufig: MOTM fehlt) ──────────────
let r = await val(`select sva_tipp_auto_tick() v`)
ok(r.gewertet === 1, 'Auto-Tick: 1 Spiel gewertet ' + JSON.stringify(r))
ok((await val(`select gewertet_at v from sva_tipp_spieltage where spiel_id = $1`, [A])) != null, 'A: jetzt gewertet')
ok((await val(`select gewertet_von v from sva_tipp_spieltage where spiel_id = $1`, [A])) === 'auto', 'A: gewertet_von = auto')
ok((await val(`select auto_gewertet v from sva_tipp_spieltage where spiel_id = $1`, [A])) === true, 'A: auto_gewertet = true')
ok((await val(`select bericht_at v from sva_tipp_spieltage where spiel_id = $1`, [A])) != null, 'A: Bericht automatisch angelegt')
// Punkte vorhanden; Elf-Spieler t-ang1 hat ein Tor → zählt
const pF1 = await val(`select gesamt v from sva_tipp_punkte where spiel_id = $1 and user_id = $2`, [A, F1])
const pF2 = await val(`select gesamt v from sva_tipp_punkte where spiel_id = $1 and user_id = $2`, [A, F2])
ok(pF1 != null && pF2 != null, 'A: Punkte für beide Tipper gerechnet (F1 ' + pF1 + ', F2 ' + pF2 + ')')
ok((await val(`select eingesetzt v from sva_tipp_bericht where spiel_id = $1 and roster_id = $2`, [A, await rid('t-ang1')])) === true, 'A: t-ang1 als eingesetzt im Auto-Bericht')
ok((await val(`select tore v from sva_tipp_bericht where spiel_id = $1 and roster_id = $2`, [A, await rid('t-ang1')])) === 1, 'A: t-ang1 Tor im Auto-Bericht')

// Idempotenz: zweiter Tick wertet A nicht erneut (nichts geändert)
r = await val(`select sva_tipp_auto_tick() v`)
ok(r.gewertet === 0 && r.re === 0, 'Auto-Tick erneut: nichts zu tun ' + JSON.stringify(r))

// ── 4. „vorläufig“ im Admin-Status, dann MOTM → automatische Nachwertung ───
let st = await rpc(team, `select tipp_admin_wertung_status() v`)
ok(Array.isArray(st.vorlaeufig) && st.vorlaeufig.some((x) => x.spielId === A), 'Status: A als „vorläufig“ (MOTM fehlt)')
ok(st.offen.length === 0, 'Status: nichts „ungewertet seit X Std“')
const gw1 = await val(`select gewertet_at v from sva_tipp_spieltage where spiel_id = $1`, [A])
// MOTM eintragen (über den Admin-Bericht; setzt bericht_at > gewertet_at)
await team(`select tipp_admin_bericht_speichern($1, '[]', '{}', null, 't-ang1')`, [A])
ok((await val(`select bericht_at v from sva_tipp_spieltage where spiel_id = $1`, [A])) > gw1, 'MOTM-Eintrag: bericht_at nach der Wertung')
r = await val(`select sva_tipp_auto_tick() v`)
ok(r.re === 1, 'Auto-Tick: 1 Nachwertung (MOTM) ' + JSON.stringify(r))
const pF1b = await val(`select gesamt v from sva_tipp_punkte where spiel_id = $1 and user_id = $2`, [A, F1])
ok(pF1b > pF1, 'A: F1 bekommt durch MOTM (t-ang1 in Elf) mehr Punkte (' + pF1 + ' → ' + pF1b + ')')
st = await rpc(team, `select tipp_admin_wertung_status() v`)
ok(!st.vorlaeufig.some((x) => x.spielId === A), 'Status: A nicht mehr vorläufig (MOTM da)')

// ── 5. 0-Tipp-Spiel ohne Ticker wird gewertet (damit /tippen weiterschaltet) ─
const Z = await spiel('Deinster SV', `now() - interval '3 hours'`)
await db.query(`update sm_spiele set status = 'beendet', tore_sva = null, tore_gegner = null, live_tore_sva = 2, live_tore_gegner = 2 where id = $1`, [Z])
ok((await val(`select count(*) v from sva_tipp_tipps where spiel_id = $1`, [Z])) === '0', 'Z: 0 Tipps')
r = await val(`select sva_tipp_auto_tick() v`)
ok(r.gewertet === 1, 'Auto-Tick: 0-Tipp-Spiel ebenfalls gewertet ' + JSON.stringify(r))
ok((await val(`select gewertet_at v from sva_tipp_spieltage where spiel_id = $1`, [Z])) != null, 'Z: als gewertet markiert')
ok((await val(`select tore_sva v from sm_spiele where id = $1`, [Z])) === 2, 'Z: Ergebnis aus Live-Stand gesichert (2:2)')

// ── 6. Ausschlüsse: Testspiel, Vorführ-Spiel, „noch keine 30 min“ ──────────
const T = await spiel('Gönnebek (Test)', `now() - interval '3 hours'`, { wb: 'Testspiel' })
await db.query(`update sm_spiele set status = 'beendet', tore_sva = 1, tore_gegner = 0 where id = $1`, [T])
await team(`update sva_tipp_spieltage set tippbar = true where spiel_id = $1`, [T]).catch(async () => {
  await db.query(`insert into sva_tipp_spieltage (spiel_id, tippbar) values ($1, true) on conflict (spiel_id) do update set tippbar = true`, [T])
})
const D = await spiel('Vorführ-FC', `now() - interval '3 hours'`, { demo: true })
await db.query(`update sm_spiele set status = 'beendet', tore_sva = 3, tore_gegner = 1 where id = $1`, [D])
const R = await spiel('SV Frisch', `now() - interval '40 minutes'`)
await db.query(`update sm_spiele set status = 'beendet', tore_sva = 1, tore_gegner = 1 where id = $1`, [R]) // Abpfiff ~ Anstoß+2h → noch nicht 30 min „beendet“
r = await val(`select sva_tipp_auto_tick() v`)
ok(r.gewertet === 0, 'Auto-Tick: Testspiel/Vorführ/zu-frisch werden NICHT gewertet ' + JSON.stringify(r))
ok((await val(`select gewertet_at v from sva_tipp_spieltage where spiel_id = $1`, [T])) == null, 'T: Testspiel ungewertet geblieben')
ok((await val(`select count(*) v from sva_tipp_spieltage where spiel_id = $1 and gewertet_at is not null`, [D])) === '0', 'D: Vorführ-Spiel ungewertet')
ok((await val(`select count(*) v from sva_tipp_spieltage where spiel_id = $1 and gewertet_at is not null`, [R])) === '0', 'R: zu frisch (< 30 min) ungewertet')

// ── 7. Abschalter ──────────────────────────────────────────────────────────
await db.query(`update sva_tipp_einstellungen set auto_wertung = false where id = 1`)
const H = await spiel('TSV Wiepenkathen', `now() - interval '3 hours'`)
await db.query(`update sm_spiele set status = 'beendet', tore_sva = 0, tore_gegner = 2 where id = $1`, [H])
r = await val(`select sva_tipp_auto_tick() v`)
ok(r.aus === true && r.gewertet === 0, 'Abschalter: Tick tut nichts ' + JSON.stringify(r))
ok((await val(`select count(*) v from sva_tipp_spieltage where spiel_id = $1 and gewertet_at is not null`, [H])) === '0', 'H: bei Abschalter ungewertet')
// Admin-Status zeigt H als „ungewertet seit X Std“
st = await rpc(team, `select tipp_admin_wertung_status() v`)
ok(st.autoAktiv === false, 'Status: autoAktiv = false')
ok(st.offen.some((x) => x.spielId === H && x.stunden >= 0), 'Status: H als „ungewertet seit X Std“ im Banner ' + JSON.stringify(st.offen.map((o) => o.gegner)))
await db.query(`update sva_tipp_einstellungen set auto_wertung = true where id = 1`)

// ── 8. Manuelle Wertung übernimmt (auto_gewertet = false) ──────────────────
await team(`select tipp_admin_bericht_speichern($1, '[]', '{}', null, null)`, [H])
await team(`select tipp_admin_werten($1)`, [H])
ok((await val(`select auto_gewertet v from sva_tipp_spieltage where spiel_id = $1`, [H])) === false, 'H: manuelle Wertung setzt auto_gewertet = false')
ok((await val(`select gewertet_von v from sva_tipp_spieltage where spiel_id = $1`, [H])) === 'team@sva.de', 'H: gewertet_von = Admin-Mail')

// ── 9. Rechte ────────────────────────────────────────────────────────────────
await expectErr(fan1(`select sva_tipp_auto_tick()`), 'Fan darf den Auto-Tick nicht rufen', /permission|denied/i)
await expectErr(asAnon(`select sva_tipp_auto_tick()`), 'anon darf den Auto-Tick nicht rufen', /permission|denied/i)
await expectErr(fan1(`select _sva_tipp_werten_kern($1, 'x')`, [A]), 'Fan darf den Wertungs-Kern nicht rufen', /permission|denied/i)
await expectErr(fan1(`select tipp_admin_wertung_status()`), 'Fan darf den Admin-Status nicht rufen', /kein_zugriff|permission|denied/i)

console.log(`\n${oks} OK, ${fails} FAIL`)
process.exit(fails ? 1 : 0)
