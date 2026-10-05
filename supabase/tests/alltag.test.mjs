// PGlite-Test der Migration 20261009090000_sva_alltag.sql (v18-A):
// Kalender-Version am Spiel (Trigger), öffentliche RPC web_kalender()
// (nur Spielplan-Felder, ohne Testspiele, Heim/alle), Mannschaften für den
// Probetraining-Assistenten (Rechte, Prüfungen, web_mitspielen()).
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/alltag.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node alltag.test.mjs
//   AUSGABE=datei.json → schreibt die web_kalender(true)-Antwort (Testdaten) für den ICS-Test
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261009090000_sva_alltag.sql'
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

// ── 1. Migrationen ──────────────────────────────────────────────────────────
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
for (const f of files) {
  if (f === NEU) await defaults()
  await run(f)
}
await defaults()
await run(NEU) // zweiter Lauf: idempotent + entzieht Default-Rechte wieder
for (const f of files.filter((f) => f > NEU)) await run(f)

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;
               update sva_settings set adresse = 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg' where id = 1;`)

// ── 2. Spiele + Kalender-Version ────────────────────────────────────────────
const neu = async (gegner, heim, tageOffset, extra = {}) =>
  (await as('chef@sva.de', `insert into sm_spiele (gegner, heim, anstoss, ort, wettbewerb, spieltag_nr, notizen, tore_sva, tore_gegner)
                            values ($1, $2, date_trunc('day', now()) + make_interval(days => $3) + interval '13 hours', $4, $5, $6, $7, $8, $9) returning id, kalender_seq`,
    [gegner, heim, tageOffset, extra.ort ?? null, extra.wettbewerb ?? 'Kreisliga Stade', extra.nr ?? null, extra.notiz ?? null, extra.tore?.[0] ?? null, extra.tore?.[1] ?? null])).rows[0]
const h1 = await neu('TSV Apensen', true, 6, { nr: 7, notiz: 'Schiri anrufen: 0151 999', ort: 'Waldsportplatz' })
const a1 = await neu('VfL Güldenstern Stade III', false, 13, { ort: 'Güldenstern-Arena, Stade', nr: 8 })
const h0 = await neu('FC Mulsum; Kutenholz, II', true, -8, { nr: 6, tore: [3, 1] })
await neu('Probe (TEST)', true, 2)
await neu('Testgegner (test)', false, 3)
ok(h1.kalender_seq === 0, 'neues Spiel: kalender_seq = 0')

let seq = (await db.query(`select kalender_seq, kalender_geaendert_at from sm_spiele where id = $1`, [h1.id])).rows[0]
await as('chef@sva.de', `update sm_spiele set notizen = 'nur intern' where id = $1`, [h1.id])
ok((await db.query(`select kalender_seq from sm_spiele where id = $1`, [h1.id])).rows[0].kalender_seq === 0, 'Notiz ändern: Version bleibt (nicht im Kalender)')
await as('chef@sva.de', `update sm_spiele set anstoss = anstoss + interval '30 minutes' where id = $1`, [h1.id])
seq = (await db.query(`select kalender_seq, kalender_geaendert_at from sm_spiele where id = $1`, [h1.id])).rows[0]
ok(seq.kalender_seq === 1 && seq.kalender_geaendert_at, 'Anstoß verlegt: Version 1 + Änderungszeit')
await as('chef@sva.de', `update sm_spiele set kalender_seq = 0 where id = $1`, [h1.id])
ok((await db.query(`select kalender_seq from sm_spiele where id = $1`, [h1.id])).rows[0].kalender_seq === 1, 'Version lässt sich von außen nicht zurückdrehen')
await as('team@sva.de', `update sm_spiele set live_tore_sva = 1 where id = $1`, [h1.id])
ok((await db.query(`select kalender_seq from sm_spiele where id = $1`, [h1.id])).rows[0].kalender_seq === 1, 'Live-Zwischenstand (Team): Version bleibt')
await as('team@sva.de', `update sm_spiele set tore_sva = 2, tore_gegner = 0 where id = $1`, [h1.id])
ok((await db.query(`select kalender_seq from sm_spiele where id = $1`, [h1.id])).rows[0].kalender_seq === 2, 'Endergebnis eingetragen (Team darf das): Version 2')
await expectErr(as('team@sva.de', `update sm_spiele set gegner = 'X' where id = $1`, [h1.id]), 'Team-Wächter greift weiterhin für Stammdaten', /sva_team_nur_live_felder/)
await as('chef@sva.de', `update sm_spiele set tore_sva = null, tore_gegner = null where id = $1`, [h1.id])

// ── 3. web_kalender() ───────────────────────────────────────────────────────
const kal = async (alle) => (await asAnon(`select public.web_kalender($1) j`, [alle])).rows[0].j
const heim = await kal(false)
const alle = await kal(true)
ok(heim.spiele.length === 2 && heim.spiele.every((s) => s.heim), `Heim-Kalender: nur Heimspiele (${heim.spiele.map((s) => s.gegner).join(' | ')})`)
ok(alle.spiele.length === 3, 'alle=1: Heim + Auswärts')
ok(!JSON.stringify(alle).toLowerCase().includes('(test)'), 'Testspiele „(TEST)“ ausgeblendet (Groß/klein egal)')
ok(!JSON.stringify(alle).includes('Schiri') && !JSON.stringify(alle).includes('notiz'), 'keine Notizen im öffentlichen Kalender')
ok(alle.verein.adresse.startsWith('Waldsportplatz'), 'Vereinsadresse dabei (Ort der Heimspiele)')
const ah1 = alle.spiele.find((s) => s.id === h1.id)
ok(ah1.seq === 3 && ah1.geaendert && ah1.spieltag === 7 && ah1.wettbewerb === 'Kreisliga Stade', 'Felder: seq, geaendert, spieltag, wettbewerb')
ok(!('toreSva' in ah1), 'ohne Endergebnis: keine Tore')
const ah0 = alle.spiele.find((s) => s.id === h0.id)
ok(ah0.toreSva === 3 && ah0.toreGegner === 1, 'mit Endergebnis: Tore dabei')
ok(alle.spiele[0].id === h0.id, 'nach Anstoß sortiert')
ok((await as('fan@x.de', `select public.web_kalender(false) j`)).rows[0].j.spiele.length === 2, 'auch eingeloggt (beliebig) lesbar')
ok((await asAnon(`select count(*)::int n from sm_spiele`)).rows[0].n === 0, 'anon sieht sm_spiele direkt weiterhin nicht (RLS: 0 Zeilen)')

if (process.env.AUSGABE) {
  fs.writeFileSync(process.env.AUSGABE, JSON.stringify(alle, null, 2))
  console.log('→ web_kalender(true) geschrieben:', process.env.AUSGABE)
}

// ── 4. Mannschaften ─────────────────────────────────────────────────────────
const start = (await db.query(`select schluessel, name, sichtbar from sva_mannschaften order by sortierung`)).rows
ok(start.length === 2 && start[0].schluessel === 'herren-1' && start[1].schluessel === 'jugend', 'Startwerte: 1. Herren + Jugend (nach 2 Läufen genau 2)')
let mit = (await asAnon(`select public.web_mitspielen() j`)).rows[0].j
ok(mit.length === 2 && mit[0].id === 'herren-1' && !('whatsapp' in mit[0]), 'web_mitspielen(): sichtbare Mannschaften, ohne Nummer → kein whatsapp-Feld')
await expectErr(asAnon(`select * from sva_mannschaften`), 'anon liest die Tabelle NICHT direkt', /permission denied/)
await expectErr(asAnon(`insert into sva_mannschaften (schluessel, name) values ('x', 'Hack')`), 'anon schreibt NICHT', /permission denied/)
ok((await as('team@sva.de', `select count(*)::int n from sva_mannschaften`)).rows[0].n === 0, 'Team-Zugang sieht keine Zeilen (nur Admin)')
await expectErr(as('team@sva.de', `insert into sva_mannschaften (schluessel, name) values ('team', 'Team')`), 'Team legt keine Mannschaft an', /row-level security/)
await as('chef@sva.de', `insert into sva_mannschaften (schluessel, name, hinweis, ansprechpartner, whatsapp, sortierung) values ('herren-2', '2. Herren', 'ab 18 Jahren', 'Jan', '4915112345678', 15)`)
await as('chef@sva.de', `update sva_mannschaften set sichtbar = false where schluessel = 'jugend'`)
mit = (await asAnon(`select public.web_mitspielen() j`)).rows[0].j
ok(mit.length === 2 && mit[1].id === 'herren-2' && mit[1].whatsapp === '4915112345678' && mit[1].kontakt === 'Jan', 'neue Mannschaft mit eigener Nummer + Ansprechpartner, unsichtbare fehlt')
await expectErr(as('chef@sva.de', `insert into sva_mannschaften (schluessel, name, whatsapp) values ('x', 'X-Team', '+49 151 123')`), 'WhatsApp nur im Format 49151…', /check constraint/)
await expectErr(as('chef@sva.de', `insert into sva_mannschaften (schluessel, name) values ('Böse Taste', 'X-Team')`), 'Schlüssel nur a-z, 0-9, -', /check constraint/)
await expectErr(as('chef@sva.de', `insert into sva_mannschaften (schluessel, name) values ('herren-1', 'Doppelt')`), 'Schlüssel eindeutig', /duplicate key|unique/)

// ── 5. web_snapshot() bleibt unberührt ──────────────────────────────────────
const snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(snap && snap.version === 1 && 'galerien' in snap && 'partner' in snap, 'web_snapshot() läuft unverändert (galerien, partner vorhanden)')

console.log(fails ? `\n${fails} FEHLER` : '\nalle Prüfungen bestanden')
process.exit(fails ? 1 : 0)
