// PGlite-Test der Migration 20261011100000_sva_am_platz.sql (v19-K, Audit B §2.2):
//   · web_snapshot().settings.amPlatz zeigt den gepflegten Freitext
//   · ohne Pflege (NULL/leer) taucht amPlatz NICHT auf (jsonb_strip_nulls) →
//     die übrige Ausgabe bleibt unverändert (darum bleiben die anderen Tests grün)
//   · Mini-Spielplan kommt aus web_kalender(true): nächste Spiele mit Heim/Auswärts,
//     ohne Vorführ-Spiele, ohne (TEST)-Spiele
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/am_platz.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node am_platz.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
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
const tabellenRechte = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;`)
const as = async (email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${JSON.stringify({ email, role: 'authenticated' })}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => { await db.exec(`set role anon;`); try { return await db.query(sql, params) } finally { await db.exec('reset role') } }

// ── 1. Alle Migrationen anwenden (inkl. der neuen) ──────────────────────────
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes('20261011100000_sva_am_platz.sql'), 'Migration liegt im Ordner')
for (const f of files) await run(f)
await tabellenRechte()
// idempotent: zweimal anwenden schadet nicht
await run('20261011100000_sva_am_platz.sql')
await tabellenRechte()

// ── 2. Ausgangszustand: am_platz ungepflegt → amPlatz fehlt ─────────────────
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
let snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(!('amPlatz' in (snap.settings || {})), 'ungepflegt: settings.amPlatz fehlt (jsonb_strip_nulls)')

// leerer String zählt wie ungepflegt (nullif(btrim(...),''))
await db.exec(`update sva_settings set am_platz = '   ' where id = 1;`)
snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(!('amPlatz' in (snap.settings || {})), 'nur Leerzeichen: settings.amPlatz fehlt weiterhin')

// ── 3. Gepflegt → amPlatz erscheint ─────────────────────────────────────────
const TEXT = 'Bratwurst & Kaltgetränke ab 14 Uhr · Eintritt frei · Parken an der Mehrzweckhalle · Kinder und Hunde erwünscht.'
await db.exec(`update sva_settings set am_platz = ${quote(TEXT)} where id = 1;`)
snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(snap.settings.amPlatz === TEXT, 'gepflegt: settings.amPlatz zeigt den Freitext')

// ── 4. Mini-Spielplan-Quelle web_kalender(true): Heim/Auswärts, ohne Demo/TEST ─
const spiel = async (gegner, heim, stundenOffset) =>
  (await as('chef@sva.de', `insert into sm_spiele (gegner, heim, anstoss, wettbewerb)
                            values ($1, $2, now() + make_interval(hours => $3), 'Kreisliga Stade') returning id`,
    [gegner, heim, stundenOffset])).rows[0].id
await spiel('SV Vergangen', true, -24 * 7)          // vorbei
await spiel('TuS Heimnah', true, 24)                // Heimspiel in 1 Tag
await spiel('SG Auswärts', false, 24 * 6)           // Auswärtsspiel
await spiel('TSV Spät', true, 24 * 13)              // Heimspiel in 13 Tagen
await spiel('Probe (TEST)', true, 24 * 2)           // Testspiel → NICHT im Kalender
// Vorführ-Spiel (nur über die RPC) → NICHT im Kalender
await as('chef@sva.de', `select public.sva_demo_starten('FC Vorführung', false, true)`)

const kal = (await asAnon(`select public.web_kalender(true) j`)).rows[0].j
const spiele = kal.spiele || []
const gegner = spiele.map((s) => s.gegner)
ok(!gegner.some((g) => /vorführung/i.test(g)), 'web_kalender: kein Vorführ-Spiel')
ok(!gegner.some((g) => /test/i.test(g)), 'web_kalender: kein (TEST)-Spiel')
const kommend = spiele.filter((s) => new Date(s.anstoss) >= new Date(Date.now() - 3 * 3600_000))
ok(kommend.length >= 3, `web_kalender: kommende Spiele vorhanden (${kommend.length})`)
const heimnah = kommend.find((s) => s.gegner === 'TuS Heimnah')
const auswaerts = kommend.find((s) => s.gegner === 'SG Auswärts')
ok(heimnah && heimnah.heim === true, 'web_kalender: „TuS Heimnah" als Heimspiel (heim=true)')
ok(auswaerts && auswaerts.heim === false, 'web_kalender: „SG Auswärts" als Auswärtsspiel (heim=false)')
// die ersten 5 kommenden (Mini-Spielplan) tragen alle ein H/A-Kennzeichen
const top5 = kommend.slice(0, 5)
ok(top5.every((s) => typeof s.heim === 'boolean'), 'Mini-Spielplan: jedes der nächsten Spiele hat H/A')

// ── 5. nextMatch/Snapshot ignoriert das Vorführ-Spiel weiterhin ─────────────
snap = (await asAnon(`select public.web_snapshot() j`)).rows[0].j
ok(snap.nextMatch && !/vorführung/i.test(snap.nextMatch.opponent), 'web_snapshot.nextMatch: kein Vorführ-Spiel')

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)

// kleiner SQL-String-Quoter (nur für Testdaten)
function quote(s) { return `'` + String(s).replace(/'/g, `''`) + `'` }
