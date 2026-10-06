// PGlite-Test der Migration 20261012100000_sva_tippliga.sql (v20-T „SVA Tipp-Liga“).
// Prüft: Punkteberechnung (viele Fälle), Sperre nach Anpfiff (RPC + Trigger),
// RLS (fremde Tipps erst nach Anpfiff), Joker-Limit, Liga-Codes, Demo-/Testspiel-
// Ausschluss, Spielbericht-Vorbefüllung aus dem Ticker, Werten + Neuberechnung,
// Ranglisten mit Trend, Fans vs. Kabine, Abzeichen, Album-Karte/-Missionen
// (gekapselt), Konto löschen, Statistik-Pfade.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/tippliga.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node tippliga.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261012100000_sva_tippliga.sql'
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
// Supabase-Default-Privilegien nachbilden (neue Tabellen/Funktionen für alle) —
// die Migration muss selbst entziehen.
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
for (const f of files) {
  if (f === NEU) await defaults()
  await run(f)
}
await defaults()
await run(NEU) // zweiter Lauf: idempotent + entzieht Default-Rechte wieder

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

// ── 1. Reine Punkte-Rechnung ────────────────────────────────────────────────
const erg = (a, b, c, d) => val(`select public.sva_tipp_ergebnis_punkte($1,$2,$3,$4) v`, [a, b, c, d])
const ergFaelle = [
  [[2, 1, 2, 1], 4, 'exakt 2:1'], [[0, 0, 0, 0], 4, 'exakt 0:0'], [[3, 1, 2, 0], 3, 'Differenz +2'],
  [[1, 1, 2, 2], 3, 'Remis andere Höhe = Differenz 0'], [[3, 0, 2, 1], 2, 'Tendenz Sieg'], [[0, 2, 1, 4], 2, 'Tendenz Niederlage'],
  [[1, 0, 1, 1], 0, 'Sieg getippt, Remis'], [[2, 2, 0, 1], 0, 'Remis getippt, Niederlage'], [[0, 1, 1, 0], 0, 'Niederlage getippt, Sieg'],
  [[1, 3, 0, 2], 3, 'Differenz −2'], [[5, 0, 1, 0], 2, 'Tendenz, Differenz falsch'], [[null, 1, 1, 0], 0, 'ohne Tipp 0'],
  [[1, 0, null, null], 0, 'ohne Ergebnis 0'],
]
for (const [args, soll, txt] of ergFaelle) ok((await erg(...args)) === soll, `Ergebnis-Punkte ${txt}: ${soll}`)

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const tp = (o) => val(`select public.sva_tipp_tipp_punkte($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) v`,
  [o.ts, o.tg, o.erster ?? null, o.motm ?? null, o.joker ?? false, o.bonus ?? {}, o.fragen ?? ['gelb', 'rot', 'tor20'], o.s, o.g, o.istErster ?? null, o.istMotm ?? null, o.auf ?? {}])
let r = await tp({ ts: 2, tg: 1, s: 2, g: 1, erster: A, istErster: A, motm: B, istMotm: B, bonus: { gelb: '1-2', rot: 'nein', tor20: 'ja' }, auf: { gelb: '1-2', rot: 'nein', tor20: 'nein' } })
ok(r.ergebnis === 4 && r.torschuetze === 3 && r.motm === 2 && r.bonusSumme === 2 && r.summe === 11 && r.gesamt === 11, 'Tipp-Punkte: exakt 4 + Torschütze 3 + MOTM 2 + 2 Bonus = 11 ' + JSON.stringify(r))
r = await tp({ ts: 2, tg: 1, s: 2, g: 1, erster: A, istErster: A, motm: B, istMotm: B, joker: true, bonus: { gelb: '1-2', rot: 'nein', tor20: 'ja' }, auf: { gelb: '1-2', rot: 'nein', tor20: 'nein' } })
ok(r.summe === 11 && r.gesamt === 22 && r.joker === true, 'Joker verdoppelt Teil A: 11 → 22')
r = await tp({ ts: 1, tg: 0, s: 0, g: 3, erster: A, istErster: null, joker: true })
ok(r.gesamt === 0 && r.art === 'daneben', 'Joker auf daneben bleibt 0')
r = await tp({ ts: 1, tg: 0, s: 2, g: 1, erster: null, istErster: null })
ok(r.torschuetze === 0 && r.ergebnis === 3, 'kein Torschützen-Tipp + kein SVA-Tor: keine Punkte (null ≠ null)')
r = await tp({ ts: 1, tg: 0, s: 1, g: 0, bonus: { gelb: '0', elfmeter: 'ja' }, fragen: ['gelb', 'rot', 'tor20'], auf: { gelb: '0', elfmeter: 'ja' } })
ok(r.bonusSumme === 1, 'Bonus nur für die 3 Fragen dieses Spiels (elfmeter zählt nicht)')
r = await tp({ ts: 1, tg: 0, s: 1, g: 0, bonus: { gelb: '0', rot: 'ja' }, auf: { gelb: '0' } })
ok(r.bonusSumme === 1 && !('rot' in r.bonus), 'Bonus ohne Auflösung wird nicht gewertet')
r = await tp({ ts: null, tg: null, s: 1, g: 0 })
ok(r.gesamt === 0 && r.art === 'kein', 'kein Tipp (nur Elf): Teil A = 0')

const sp = (o) => val(`select public.sva_tipp_spieler_punkte($1,$2,$3,$4,$5,$6,$7,$8,$9) v`,
  [o.ein ?? true, o.tore ?? 0, o.vor ?? 0, o.zn ?? false, o.pos ?? 'MIT', o.min ?? 90, o.karte ?? null, o.motm ?? false, o.sieg ?? false])
ok((await sp({})).punkte === 1, 'Elf: nur Einsatz +1')
ok((await sp({ ein: false, tore: 2 })).punkte === 0, 'Elf: nicht eingesetzt = 0 (auch mit Toren im Formular)')
ok((await sp({ tore: 2, vor: 1, sieg: true })).punkte === 1 + 10 + 3 + 2, 'Elf: 2 Tore + Vorlage + Sieg = 16')
ok((await sp({ pos: 'TW', zn: true, min: 90 })).punkte === 5, 'Elf: TW zu null 90 Min = 1 + 4')
ok((await sp({ pos: 'ABW', zn: true, min: 59 })).punkte === 1, 'Elf: ABW zu null nur 59 Min = kein Zu-null')
ok((await sp({ pos: 'Abwehr', zn: true, min: 60 })).punkte === 5, 'Elf: „Abwehr“ (Kader-Schreibweise) 60 Min = Zu-null')
ok((await sp({ pos: 'MIT', zn: true })).punkte === 1, 'Elf: Mittelfeld bekommt kein Zu-null')
ok((await sp({ karte: 'gelb' })).punkte === 0, 'Elf: Einsatz + Gelb = 0')
ok((await sp({ karte: 'gelbrot' })).punkte === -2, 'Elf: Einsatz + Gelb-Rot = −2')
ok((await sp({ karte: 'rot', sieg: true })).punkte === -1, 'Elf: Einsatz + Sieg + Rot = −1')
ok((await sp({ motm: true, tore: 1, sieg: true })).punkte === 1 + 5 + 5 + 2, 'Elf: MOTM + Tor + Sieg = 13')
const posten = (await sp({ tore: 1, karte: 'gelb' })).posten.map((x) => x.k).join(',')
ok(posten === 'einsatz,tor,gelb', 'Elf: Posten-Aufschlüsselung ' + posten)

// ── 2. Personen, Kader ──────────────────────────────────────────────────────
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const user = async (email, app) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, app ? { app } : {}])).id
const CHEF = await user('chef@sva.de')
const TEAM = await user('team@sva.de')
const F1 = await user('lena@fan.example', 'sva-album')
const F2 = await user('ole@fan.example', 'sva-album')
const F3 = await user('tobi@kabine.example', 'sva-album')
const F4 = await user('anon@fan.example', 'sva-album')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const team = (sql, p) => as(TEAM, 'team@sva.de', sql, p)
const fan1 = (sql, p) => as(F1, 'lena@fan.example', sql, p)
const fan2 = (sql, p) => as(F2, 'ole@fan.example', sql, p)
const fan3 = (sql, p) => as(F3, 'tobi@kabine.example', sql, p)
const fan4 = (sql, p) => as(F4, 'anon@fan.example', sql, p)

let kader = (await db.query(`select id, slug, public.sva_tipp_pos(position) pos from sm_roster where aktiv and rolle = 'spieler' order by sortierung, name`)).rows
if (kader.length < 8) {
  // Fallback, falls kein Seed-Kader vorhanden ist
  const neu = [['p-tw', 'Malte Pils', 'TW'], ['p-abw1', 'Justin Hüttry', 'ABW'], ['p-abw2', 'Lennard B', 'ABW'], ['p-mit1', 'Julio Paruzel', 'MIT'],
    ['p-mit2', 'Niclas Becker', 'MIT'], ['p-mit3', 'Tobias Helck', 'MIT'], ['p-ang1', 'Aaron Warkehr', 'ANG'], ['p-ang2', 'Marc Biedermann', 'ANG']]
  for (const [slug, name, pos] of neu) await db.query(`insert into sm_roster (slug, name, position) values ($1,$2,$3)`, [slug, name, pos])
  kader = (await db.query(`select id, slug, public.sva_tipp_pos(position) pos from sm_roster where aktiv and rolle = 'spieler' order by sortierung, name`)).rows
}
const nach = (pos) => kader.filter((k) => k.pos === pos)
const TW = nach('TW')[0] || nach('ABW')[0]
const ABW = nach('ABW')[0]
const [MIT1, MIT2] = nach('MIT')
const [ANG1, ANG2] = nach('ANG')
ok(TW && ABW && MIT1 && MIT2 && ANG1 && ANG2, `Kader vorhanden (${kader.length} Spieler)`)

// ── 3. Spiele: Pflicht, Auswärts, Test, Vorführung ──────────────────────────
// Feste Tage in einem künftigen Monat → Joker-Monat deterministisch.
const spiel = async (gegner, heim, sql, wettbewerb = 'Kreisliga Stade') =>
  (await admin(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb) values ($1, $2, ${sql}, $3) returning id`, [gegner, heim, wettbewerb])).rows[0].id
const MON = `date_trunc('month', now()) + interval '1 month'`
const S1 = await spiel('TuS Fischbek', true, `${MON} + interval '9 days 13 hours'`)
const S2 = await spiel('VfL Horneburg', false, `${MON} + interval '16 days 13 hours'`)       // gleicher Monat
const S3 = await spiel('SG Lühe', true, `${MON} + interval '1 month 4 days 13 hours'`)        // Folgemonat
const ST = await spiel('Blau-Weiß (TEST)', true, `${MON} + interval '5 days'`, 'Testspiel')
await admin(`select sva_demo_starten('FC Vorführung', false, false)`)
const DEMO = (await one(`select id from sm_spiele where demo`)).id

ok((await val(`select public.sva_tipp_wertung($1) v`, [S1])) === 'saison', 'Pflichtspiel → Wertung saison')
ok((await val(`select public.sva_tipp_wertung($1) v`, [ST])) === null, 'Testspiel ohne Schalter → nicht tippbar')
ok((await val(`select public.sva_tipp_wertung($1) v`, [DEMO])) === null, 'Vorführ-Spiel → nie tippbar')
ok((await val(`select public.sva_tipp_offen($1) v`, [S1])) === true, 'S1 offen (vor Anstoß)')
const fr = await val(`select public.sva_tipp_fragen_vorschlag($1) v`, [S2])
ok(fr.length === 3 && !fr.includes('zuschauer'), 'Fragen-Vorschlag: 3 Stück, Auswärts ohne Zuschauer ' + fr.join(','))
ok(JSON.stringify(await val(`select public.sva_tipp_fragen_vorschlag($1) v`, [S2])) === JSON.stringify(fr), 'Fragen-Vorschlag deterministisch')

// ── 4. Öffentlich: Lage ─────────────────────────────────────────────────────
let lage = await rpc(asAnon, `select tipp_lage() j`)
ok(lage.offen && lage.offen.id === ST ? false : lage.offen && lage.offen.id === S1, 'anon: tipp_lage → offenes Spiel ist S1 (nicht Test/Demo)')
ok(lage.kader.length === kader.length && lage.kader.every((k) => k.id && k.position && !('rating' in k)), 'Kader in der Lage, ohne Bewertungen')
ok(!lage.ich, 'anon: keine persönlichen Daten')
ok(lage.offen.fragen.length === 3, 'Lage: 3 Bonusfragen am Spiel')
ok(typeof lage.einstellungen.winterpause.aktiv === 'boolean', 'Lage: Winterpause-Info')

// ── 5. Teilnahme ────────────────────────────────────────────────────────────
await expectErr(fan1(`select tipp_abgeben($1, 2, 1)`, [S1]), 'ohne Teilnahme kein Tipp', /tipp_kein_teilnehmer/)
await expectErr(fan1(`select tipp_beitreten('Lena', 'K', true, false, true)`), 'ohne Teilnahmebedingungen kein Beitritt', /tipp_bedingungen_fehlen/)
await expectErr(fan1(`select tipp_beitreten('Lena', 'K', true, true, false)`), 'neues Konto ohne Einwilligung → abgelehnt', /tipp_einwilligung_fehlt/)
await expectErr(fan1(`select tipp_beitreten('L', 'K', true, true, true)`), 'Vorname zu kurz → Album-Prüfung greift', /album_ungueltig:vorname/)
await fan1(`select tipp_beitreten('Lena', 'K', true, true, true)`)
ok((await val(`select count(*)::int v from sva_album_fans where user_id = $1`, [F1])) === 1, 'Beitritt legt gemeinsames Album-Profil an')
// F2 hat schon ein Album-Profil → keine zweite Einwilligung nötig
await fan2(`select album_profil_speichern('Ole', 'M', false, false, true)`)
await fan2(`select tipp_beitreten(null, null, true, true, false)`)
await fan3(`select tipp_beitreten('Tobias', 'H', true, true, true)`)
await fan4(`select tipp_beitreten('Paula', 'S', false, true, true)`) // nicht öffentlich sichtbar
await expectErr(asAnon(`select tipp_beitreten('X', 'Y', true, true, true)`), 'anon darf nicht beitreten', /permission denied|tipp_nicht_angemeldet/)

// ── 6. Tipps abgeben ────────────────────────────────────────────────────────
const fragen1 = (await rpc(asAnon, `select tipp_lage() j`)).offen.fragen.map((f) => f.key)
const bonusAlle = (f) => Object.fromEntries(f.map((k) => [k, { gelb: '1-2', rot: 'nein', tor20: 'ja', tore_hz1: '2+', elfmeter: 'nein', zuschauer: 'unter', erstes_tor: 'sva' }[k]]))
r = await rpc(fan1, `select tipp_abgeben($1, 2, 1, $2, $3, true, $4) j`, [S1, ANG1.slug, MIT1.slug, bonusAlle(fragen1)])
ok(r.ok && r.neu === true && r.karte === false, 'Fan 1 tippt 2:1 mit Joker (ohne Album-RPC: karte=false)')
ok(Array.isArray(r.abzeichen) && r.abzeichen.includes('erster_tipp'), 'Abzeichen „erster_tipp“ sofort')
r = await rpc(fan1, `select tipp_abgeben($1, 3, 1, $2, $3, true, $4) j`, [S1, ANG1.slug, MIT1.slug, bonusAlle(fragen1)])
ok(r.neu === false, 'Tipp ändern vor Anpfiff → überschreibt (neu=false)')
ok((await val(`select count(*)::int v from sva_tipp_tipps where user_id = $1`, [F1])) === 1, 'nur eine Zeile pro Konto und Spiel')
await expectErr(fan2(`select tipp_abgeben($1, 1, 0, null, null, false, '{"elfmeter2":"ja"}')`, [S1]), 'unbekannte Bonusfrage → abgelehnt', /tipp_ungueltig:bonus/)
await expectErr(fan2(`select tipp_abgeben($1, 1, 0, null, null, false, $2)`, [S1, { [fragen1[0]]: 'vielleicht' }]), 'ungültige Bonus-Antwort → abgelehnt', /tipp_ungueltig:bonus/)
await expectErr(fan2(`select tipp_abgeben($1, 21, 0)`, [S1]), 'Ergebnis > 20 → abgelehnt', /tipp_ungueltig:ergebnis/)
await expectErr(fan2(`select tipp_abgeben($1, 1, 0, 'p-gibt-es-nicht')`, [S1]), 'unbekannter Torschütze → abgelehnt', /tipp_spieler_unbekannt/)
await expectErr(fan2(`select tipp_abgeben($1, 1, 0)`, [DEMO]), 'Vorführ-Spiel: Tipp abgelehnt', /tipp_nicht_tippbar/)
await expectErr(fan2(`select tipp_abgeben($1, 1, 0)`, [ST]), 'Testspiel ohne Schalter: Tipp abgelehnt', /tipp_nicht_tippbar/)

// Album-Karte: Stub der RPC aus Paket v20-karten anlegen → beim ERSTEN Tipp gutgeschrieben
await db.exec(`create table public._karten_log (quelle text, bezug uuid, uid uuid);
  -- v20: die echte RPC aus 20261012110000_sva_karten.sql für diesen Isolations-Test durch einen Stub ersetzen
  drop function if exists public.album_karte_gutschreiben(text, uuid);
  create function public.album_karte_gutschreiben(p_quelle text, p_bezug uuid) returns jsonb language plpgsql security definer as $$
  begin insert into public._karten_log values (p_quelle, p_bezug, auth.uid()); return jsonb_build_object('ok', true); end $$;`)
r = await rpc(fan2, `select tipp_abgeben($1, 1, 1, $2, null, false, '{}') j`, [S1, ANG2.slug])
ok(r.neu && r.karte === true, 'mit Album-RPC: erster Tipp → +1 Karte')
await fan2(`select tipp_abgeben($1, 2, 0, $2, null, false, '{}')`, [S1, ANG2.slug])
ok((await val(`select count(*)::int v from _karten_log where uid = $1`, [F2])) === 1, 'Tipp ändern → KEINE zweite Karte')
r = await rpc(fan3, `select tipp_abgeben($1, 2, 1, $2, $3, false, $4) j`, [S1, ANG1.slug, MIT1.slug, bonusAlle(fragen1)])
ok(r.karte === true, 'Kabine-Konto bekommt auch seine Karte')
await fan4(`select tipp_abgeben($1, 0, 0)`, [S1])
// Karten-RPC wirft Fehler → Tipp klappt trotzdem
await db.exec(`create or replace function public.album_karte_gutschreiben(p_quelle text, p_bezug uuid) returns jsonb language plpgsql as $$ begin raise exception 'kaputt'; end $$;`)
r = await rpc(fan1, `select tipp_abgeben($1, 1, 1) j`, [S2])
ok(r.ok && r.karte === false, 'Fehler in der Album-RPC verhindert den Tipp nicht')
await db.exec(`drop function public.album_karte_gutschreiben(text, uuid);`)

// ── 7. Joker 1× pro Monat ───────────────────────────────────────────────────
await expectErr(fan1(`select tipp_abgeben($1, 1, 1, null, null, true)`, [S2]), 'zweiter Joker im selben Monat → abgelehnt', /tipp_joker_verbraucht/)
r = await rpc(fan1, `select tipp_abgeben($1, 1, 0, null, null, true) j`, [S3])
ok(r.ok, 'Joker im Folgemonat erlaubt')
await expectErr(db.query(`update sva_tipp_tipps set joker = true where user_id = $1 and spiel_id = $2`, [F1, S2]), 'DB-Ebene: Unique-Index verhindert 2. Joker im Monat', /sva_tipp_joker_einmal_pro_monat|duplicate/)
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.ich.jokerFrei === true, 'Lage: Joker für S1 noch „frei“ (S1 trägt ihn selbst)')
ok(lage.offen.meinTipp.joker === true && lage.offen.meinTipp.toreSva === 3, 'Lage: eigener Tipp sichtbar')

// ── 8. Keine direkten Schreibrechte, RLS vor Anpfiff ────────────────────────
await expectErr(fan2(`insert into sva_tipp_tipps (user_id, spiel_id, tore_sva, tore_gegner) values ($1, $2, 9, 0)`, [F2, S2]), 'direktes INSERT verboten', /permission denied/)
await expectErr(fan2(`update sva_tipp_tipps set tore_sva = 9 where user_id = $1`, [F2]), 'direktes UPDATE verboten', /permission denied/)
await expectErr(fan2(`delete from sva_tipp_punkte`), 'direktes DELETE verboten', /permission denied/)
await expectErr(fan2(`update sva_tipp_teilnehmer set kabine = true where user_id = $1`, [F2]), 'Fan kann sich nicht selbst zur Kabine machen', /permission denied/)
await expectErr(asAnon(`select * from sva_tipp_tipps`), 'anon liest keine Tipps', /permission denied/)
let sicht = (await fan2(`select user_id from sva_tipp_tipps where spiel_id = $1`, [S1])).rows
ok(sicht.length === 1 && sicht[0].user_id === F2, 'RLS vor Anpfiff: Fan sieht nur den eigenen Tipp')
await expectErr(asAnon(`select tipp_verteilung($1)`, [S1]), 'Verteilung vor Anpfiff gesperrt', /tipp_noch_offen/)

// ── 9. Deine Elf ────────────────────────────────────────────────────────────
const elfKlassisch = [TW.slug, MIT1.slug, MIT2.slug, ANG1.slug, ANG2.slug]
await fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [S1, elfKlassisch, ANG1.slug])
await expectErr(fan2(`select tipp_elf_speichern($1, $2, $3, false)`, [S1, [ANG1.slug, MIT1.slug, MIT2.slug, ANG2.slug, TW.slug], ANG1.slug]), 'klassisch: Stürmer auf TW/ABW-Platz → abgelehnt', /tipp_ungueltig:positionen/)
await fan2(`select tipp_elf_speichern($1, $2, $3, true)`, [S1, [ANG1.slug, MIT1.slug, MIT2.slug, ANG2.slug, ABW.slug], MIT1.slug])
ok((await val(`select frei from sva_tipp_elf where user_id = $1`, [F2])) === true, 'freie Elf erlaubt (Standard)')
await expectErr(fan2(`select tipp_elf_speichern($1, $2, $3, true)`, [S1, [ANG1.slug, MIT1.slug, MIT2.slug, ANG2.slug], MIT1.slug]), 'nur 4 Spieler → abgelehnt', /tipp_ungueltig:elf/)
await expectErr(fan2(`select tipp_elf_speichern($1, $2, $3, true)`, [S1, [ANG1.slug, ANG1.slug, MIT2.slug, ANG2.slug, ABW.slug], MIT2.slug]), 'doppelter Spieler → abgelehnt', /tipp_ungueltig:elf/)
await expectErr(fan2(`select tipp_elf_speichern($1, $2, $3, true)`, [S1, [ANG1.slug, MIT1.slug, MIT2.slug, ANG2.slug, ABW.slug], TW.slug === ABW.slug ? nach('MIT')[2]?.slug ?? 'x' : TW.slug]), 'Kapitän nicht in der Elf → abgelehnt', /tipp_ungueltig:kapitaen|tipp_spieler_unbekannt/)
await fan3(`select tipp_elf_speichern($1, $2, $3, false)`, [S1, elfKlassisch, MIT1.slug])
await admin(`update sva_tipp_einstellungen set elf_frei = false where id = 1`)
await expectErr(fan2(`select tipp_elf_speichern($1, $2, $3, true)`, [S1, [ANG1.slug, MIT1.slug, MIT2.slug, ANG2.slug, ABW.slug], MIT1.slug]), 'Admin schaltet freie Elf ab → abgelehnt', /tipp_ungueltig:frei/)
await admin(`update sva_tipp_einstellungen set elf_frei = true where id = 1`)
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.offen.meineElf.kapitaen === ANG1.slug && lage.offen.meineElf.spieler.length === 5, 'Lage: eigene Elf mit Kapitän')

// ── 10. Anpfiff: Sperre (RPC + Trigger), RLS danach offen ───────────────────
await db.query(`update sm_spiele set anstoss = now() + interval '1 hour' where id = $1`, [S1])
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'anpfiff', 1, now() - interval '100 minutes')`, [S1])
ok((await val(`select status v from sm_spiele where id = $1`, [S1])) === 'live', 'Ticker-Anpfiff (vor geplantem Anstoß) → live')
ok((await val(`select public.sva_tipp_offen($1) v`, [S1])) === false, 'früherer Ticker-Anpfiff schließt die Abgabe')
await expectErr(fan1(`select tipp_abgeben($1, 4, 0)`, [S1]), 'nach Anpfiff: Tipp-RPC abgelehnt', /tipp_geschlossen/)
await expectErr(fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [S1, elfKlassisch, MIT1.slug]), 'nach Anpfiff: Elf-RPC abgelehnt', /tipp_geschlossen/)
await expectErr(db.query(`update sva_tipp_tipps set tore_sva = 5 where spiel_id = $1`, [S1]), 'nach Anpfiff: Trigger sperrt auch direkte Updates (Superuser)', /tipp_geschlossen/)
await expectErr(db.query(`insert into sva_tipp_tipps (user_id, spiel_id, tore_sva, tore_gegner) values ($1, $2, 1, 1)`, [F4, S1]), 'nach Anpfiff: Trigger sperrt Nachtrag', /tipp_geschlossen|duplicate/)
// Anstoß vorbei ohne Ticker → ebenfalls zu
const SV = await spiel('SV Vergessen', true, `now() + interval '2 days'`)
await fan4(`select tipp_abgeben($1, 1, 0)`, [SV])
await db.query(`update sm_spiele set anstoss = now() - interval '1 minute' where id = $1`, [SV])
await expectErr(fan4(`select tipp_abgeben($1, 2, 0)`, [SV]), 'Anstoßzeit erreicht (ohne Ticker) → geschlossen', /tipp_geschlossen/)
sicht = (await fan2(`select user_id from sva_tipp_tipps where spiel_id = $1`, [S1])).rows
ok(sicht.length === 4, `RLS nach Anpfiff: alle Tipps des Spiels sichtbar (${sicht.length})`)
ok((await fan2(`select count(*)::int n from sva_tipp_tipps where spiel_id = $1`, [S2])).rows[0].n === 0, 'RLS: fremde Tipps für noch offenes S2 weiter unsichtbar')
const vert = await rpc(asAnon, `select tipp_verteilung($1) j`, [S1])
ok(vert.n === 4 && vert.ergebnisse.length > 0 && vert.tendenz.sieg + vert.tendenz.remis + vert.tendenz.niederlage >= 99, 'Verteilung nach Anpfiff: ' + JSON.stringify(vert.tendenz))
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.gesperrt && lage.gesperrt.id === S1 && lage.offen.id !== S1, 'Lage: S1 jetzt „gesperrt“, nächstes offenes Spiel rückt nach')

// ── 11. Spiel mit Ticker: Tore, Karten, Wechsel, Abpfiff ────────────────────
const tick = (typ, min, minAgo, r1 = null, r2 = null, text = null) =>
  db.query(`insert into sva_ticker (spiel_id, typ, minute, roster_id, roster_id_2, text, zeitpunkt) values ($1,$2,$3,$4,$5,$6, now() - make_interval(mins => $7))`, [S1, typ, min, r1, r2, text, minAgo])
await tick('tor', 12, 88, ANG1.id, MIT1.id)          // 1:0 Ang1 (Vorlage Mit1)
await tick('gelb', 25, 75, MIT2.id)
await tick('gegentor', 30, 70)                       // 1:1
await tick('halbzeit', 45, 55)
await tick('wiederanpfiff', 46, 40)
await tick('wechsel', 60, 26, ANG2.id, MIT2.id)      // Ang2 rein, Mit2 raus
await tick('tor', 70, 16, ANG2.id, null, 'Elfmeter') // 2:1
await tick('abpfiff', 90, 1)
const s1 = await one(`select status, tore_sva, tore_gegner from sm_spiele where id = $1`, [S1])
ok(s1.status === 'beendet' && s1.tore_sva === 2 && s1.tore_gegner === 1, 'Abpfiff → 2:1 beendet')

// Lineup für S1: TW, ABW, MIT1, MIT2, ANG1 + 6 weitere (11)
const startelf = [TW, ABW, MIT1, MIT2, ANG1, ...kader.filter((k) => ![TW, ABW, MIT1, MIT2, ANG1, ANG2].includes(k))].slice(0, 11).map((k) => k.id)
if (startelf.length === 11) await admin(`insert into sva_lineup (startelf, bank, spiel_id) values ($1, $2, $3)`, [startelf, [ANG2.id], S1])

// ── 12. Spielbericht ────────────────────────────────────────────────────────
await expectErr(fan1(`select tipp_admin_bericht($1)`, [S1]), 'Fan darf keinen Spielbericht sehen', /tipp_kein_team/)
await expectErr(team(`select tipp_admin_werten($1)`, [S1]), 'Werten ohne gespeicherten Bericht → abgelehnt', /tipp_kein_bericht/)
const ber = await rpc(team, `select tipp_admin_bericht($1) j`, [S1])
const zeile = (slug) => ber.zeilen.find((z) => z.id === slug)
ok(ber.mitTicker && ber.spiel.toreSva === 2, 'Bericht: Ergebnis aus dem Ticker')
ok(zeile(ANG1.slug).tore === 1 && zeile(MIT1.slug).vorlagen === 1 && zeile(ANG2.slug).tore === 1, 'Bericht: Tore + Vorlagen vorbefüllt')
ok(zeile(MIT2.slug).karte === 'gelb', 'Bericht: Gelbe Karte vorbefüllt')
if (startelf.length === 11) {
  ok(zeile(MIT2.slug).eingesetzt && zeile(MIT2.slug).minuten === 60, 'Bericht: ausgewechselt nach 60 Min.')
  ok(zeile(ANG2.slug).eingesetzt && zeile(ANG2.slug).minuten === 30, 'Bericht: eingewechselt 30 Min.')
  ok(zeile(TW.slug).eingesetzt && zeile(TW.slug).zuNull === false, 'Bericht: Gegentor → kein Zu-null')
}
ok(ber.ersterTorschuetze === ANG1.slug, 'Bericht: erster SVA-Torschütze aus dem Ticker')
const au = ber.aufloesungAuto
ok(au.tor20 === 'ja' && au.erstes_tor === 'sva' && au.tore_hz1 === '2+' && au.gelb === '1-2' && au.rot === 'nein' && au.elfmeter === 'ja',
  'Bonus automatisch aufgelöst: ' + JSON.stringify(au))
// Zuschauer: Check-ins anlegen (Heimspiel) — Linie ohne Historie = 50
ok((await val(`select public.sva_tipp_zuschauer_linie($1) v`, [S1])) === 50, 'Zuschauer-Linie ohne Historie: 50')

const zeilen = ber.zeilen.filter((z) => z.eingesetzt)
await team(`select tipp_admin_bericht_speichern($1, $2, $3, $4, null)`, [S1, JSON.stringify(zeilen), JSON.stringify(ber.aufloesung), ber.ersterTorschuetze])
await expectErr(team(`select tipp_admin_bericht_speichern($1, '[]', '{"gelb":"viele"}')`, [S1]), 'ungültige Auflösung → abgelehnt', /tipp_ungueltig:aufloesung/)
await expectErr(team(`select tipp_admin_werten($1)`, [DEMO]), 'Vorführ-Spiel werten → abgelehnt', /tipp_demo_spiel/)
await expectErr(team(`select tipp_admin_werten($1)`, [S2]), 'offenes Spiel werten → abgelehnt', /tipp_noch_offen|tipp_kein/)

// Album-Missionen-Stub (3-Parameter-Fassung)
await db.exec(`create table public._ziele_log (ziel text, bezug uuid, uid uuid);
  create function public.album_ziel_ausloesen(p_ziel text, p_bezug uuid, p_user uuid) returns jsonb language sql security definer as $$
    insert into public._ziele_log values (p_ziel, p_bezug, p_user) returning jsonb_build_object('ok', true) $$;`)

// ── 13. Werten ──────────────────────────────────────────────────────────────
r = await rpc(team, `select tipp_admin_werten($1) j`, [S1])
ok(r.ok && r.teilnehmer === 4, 'Team wertet S1: 4 Teilnehmer ' + JSON.stringify(r))
const pkt = async (uid) => one(`select * from sva_tipp_punkte where user_id = $1 and spiel_id = $2`, [uid, S1])
// Fan 1: Tipp 3:1 (Differenz 2 ≠ 1 → Tendenz 2) + Torschütze Ang1 (+3) + MOTM-Tipp Mit1 (MOTM noch offen → 0) + Bonus
const auf = ber.aufloesung
const bonusRichtig = fragen1.filter((k) => auf[k] && bonusAlle(fragen1)[k] === auf[k]).length
let p1 = await pkt(F1)
ok(p1.tipp === 2 + 3 + bonusRichtig && p1.joker === true, `Fan 1 Teil A: Tendenz 2 + Torschütze 3 + ${bonusRichtig} Bonus = ${p1.tipp}`)
// Elf Fan 1: TW, MIT1, MIT2, ANG1 (Kapitän), ANG2 — Sieg (+2 für Eingesetzte)
const sp1 = p1.details.elf
const elfPunkte = Object.fromEntries(sp1.map((e) => [e.id, e.gesamt]))
ok(elfPunkte[ANG1.slug] === (1 + 5 + 2) * 2, `Kapitän Ang1: (Einsatz+Tor+Sieg)×2 = ${elfPunkte[ANG1.slug]}`)
ok(elfPunkte[MIT1.slug] === 1 + 3 + 2, `Mit1: Einsatz+Vorlage+Sieg = ${elfPunkte[MIT1.slug]}`)
ok(elfPunkte[MIT2.slug] === 1 + 2 - 1, `Mit2: Einsatz+Sieg−Gelb = ${elfPunkte[MIT2.slug]}`)
ok(elfPunkte[ANG2.slug] === 1 + 5 + 2, `Ang2 (Joker): Einsatz+Tor+Sieg = ${elfPunkte[ANG2.slug]}`)
ok(p1.gesamt === p1.tipp * 2 + p1.elf, `Fan 1 gesamt = Teil A × 2 (Joker) + Elf = ${p1.gesamt}`)
const p2 = await pkt(F2)
ok(p2.details.tipp.art === 'tendenz' && p2.details.tipp.torschuetze === 0, 'Fan 2: 2:0 auf 2:1 = Tendenz, Torschütze Ang2 falsch')
const p3 = await pkt(F3)
ok(p3.exakt === true && p3.details.tipp.ergebnis === 4, 'Fan 3 (Kabine): exakt 2:1')
ok((await val(`select gewertet_at is not null v from sva_tipp_spieltage where spiel_id = $1`, [S1])) === true, 'Spieltag als gewertet markiert')
const ziele = (await db.query(`select ziel, uid from _ziele_log order by ziel`)).rows
ok(ziele.some((z) => z.ziel === 'tipp_exakt' && z.uid === F3), 'Album-Mission tipp_exakt für Fan 3 ausgelöst')
ok(ziele.some((z) => z.ziel === 'kapitaen_trifft' && z.uid === F1), 'Album-Mission kapitaen_trifft für Fan 1 (Kapitän Ang1 traf)')
ok(ziele.some((z) => z.ziel === 'tipp_spieltagssieg'), 'Album-Mission tipp_spieltagssieg ausgelöst')

// ── 14. Korrektur: MOTM nachtragen (Montag) → Neuberechnung ─────────────────
await team(`select tipp_admin_bericht_speichern($1, $2, $3, $4, $5)`, [S1, JSON.stringify(zeilen), JSON.stringify(ber.aufloesung), ber.ersterTorschuetze, MIT1.slug])
ok((await val(`select public.sva_tipp_slug(motm_roster_id) v from sm_spiele where id = $1`, [S1])) === MIT1.slug, 'MOTM landet in sm_spiele.motm_roster_id')
await team(`select tipp_admin_werten($1)`, [S1])
const p1b = await pkt(F1)
ok(p1b.tipp === p1.tipp + 2, 'Neuberechnung: MOTM-Tipp richtig → Teil A +2')
ok(p1b.details.elf.find((e) => e.id === MIT1.slug).gesamt === 1 + 3 + 2 + 5, 'Neuberechnung: MOTM in der Elf +5')
ok((await val(`select count(*)::int v from sva_tipp_punkte where spiel_id = $1`, [S1])) === 4, 'Neuberechnung ohne Doppelte')

// ── 15. Ranglisten ──────────────────────────────────────────────────────────
let rl = await rpc(asAnon, `select tipp_rangliste('spieltag') j`)
ok(rl.spielId === S1 && rl.eintraege.length === 3, 'anon Spieltag-Rangliste: nur öffentlich sichtbare (3 von 4)')
ok(!rl.eintraege.some((e) => e.name === 'Paula S.'), 'nicht sichtbarer Fan erscheint öffentlich nicht')
const rl4 = await rpc(fan4, `select tipp_rangliste('spieltag') j`)
ok(rl4.ich && rl4.ich.name === 'Paula S.' && rl4.eintraege.length === 4, 'nicht sichtbarer Fan sieht sich selbst in der Liste')
ok(rl.eintraege[0].punkte >= rl.eintraege[rl.eintraege.length - 1].punkte, 'Rangliste absteigend sortiert')
rl = await rpc(fan1, `select tipp_rangliste('saison') j`)
ok(rl.ich && rl.ich.platz >= 1 && rl.teilnehmer === 3, 'Saison-Rangliste mit eigenem Platz')
rl = await rpc(fan1, `select tipp_rangliste('monat') j`)
ok(rl.eintraege.length >= 3 && rl.monat, 'Monats-Rangliste ' + rl.monat)

// zweites Spiel (S2) werten → Trend-Pfeile
await fan2(`select tipp_abgeben($1, 3, 0)`, [S2])
// S1 fand (realistisch) vor S2 statt: Anstoß S1 zurück in die Vergangenheit
await db.query(`update sm_spiele set anstoss = now() - interval '110 minutes' where id = $1`, [S1])
await db.query(`update sm_spiele set anstoss = now() - interval '30 minutes', tore_sva = 0, tore_gegner = 3, status = 'beendet' where id = $1`, [S2])
await team(`select tipp_admin_bericht_speichern($1, '[]', '{}', null, null)`, [S2])
await team(`select tipp_admin_werten($1)`, [S2])
rl = await rpc(fan1, `select tipp_rangliste('saison') j`)
ok(rl.eintraege.length === 3 && rl.eintraege.every((e) => typeof e.trend === 'number'), 'nach 2 Spieltagen: Trend je Eintrag ' + JSON.stringify(rl.eintraege.map((e) => [e.name, e.platz, e.trend])))
await expectErr(asAnon(`select tipp_rangliste('jahr')`), 'unbekannte Ranglisten-Art → Fehler', /tipp_ungueltig:art/)

// ── 16. Kabine + Fans vs. Kabine ────────────────────────────────────────────
await expectErr(team(`select tipp_admin_kabine($1, true)`, [F3]), 'Team darf keine Kabine markieren', /tipp_kein_admin/)
await admin(`select tipp_admin_kabine($1, true)`, [F3])
const tl = await rpc(admin, `select tipp_admin_teilnehmer('tobi') j`)
ok(tl.liste.length === 1 && tl.liste[0].kabine === true && tl.liste[0].email === 'tobi@kabine.example', 'Admin findet Teilnehmer per Suche, Kabine markiert')
const du = await rpc(asAnon, `select tipp_duell() j`)
ok(du.spieltag && du.spieltag.nKabine >= 0 && du.saison.kabine != null && du.saison.fans != null, 'Fans vs. Kabine: Schnitt beider Seiten ' + JSON.stringify(du.saison))
ok(du.kabineBester && du.kabineBester.name === 'Tobias H.', 'Duell: nur positiv — bester Kabinen-Tipper (sichtbar)')
rl = await rpc(asAnon, `select tipp_rangliste('spieltag', $1) j`, [S1])
ok(rl.eintraege.find((e) => e.name === 'Tobias H.').kabine === true, 'Rangliste markiert Kabine')

// ── 17. Stammtisch-Ligen ────────────────────────────────────────────────────
const liga = await rpc(fan1, `select tipp_liga_gruenden('Dodos Raum') j`)
ok(/^[A-HJ-NP-Z2-9]{6}$/.test(liga.code), 'Liga-Code 6 Zeichen ohne 0/O/1/I: ' + liga.code)
await expectErr(fan1(`select tipp_liga_gruenden('ab')`), 'Liga-Name zu kurz → abgelehnt', /tipp_ungueltig:liganame/)
await expectErr(fan2(`select tipp_liga_beitreten('ZZZZZZ')`), 'falscher Code → abgelehnt', /tipp_liga_unbekannt/)
const vs = await rpc(asAnon, `select tipp_liga_vorschau($1) j`, [liga.code.toLowerCase()])
ok(vs.name === 'Dodos Raum' && vs.mitglieder === 1, 'Einladungs-Vorschau ohne Login (Code egal welche Schreibweise)')
await fan2(`select tipp_liga_beitreten($1)`, [' ' + liga.code.toLowerCase() + ' '])
await fan4(`select tipp_liga_beitreten($1)`, [liga.code])
await fan2(`select tipp_liga_beitreten($1)`, [liga.code]) // doppelt = egal
ok((await val(`select count(*)::int v from sva_tipp_liga_mitglieder where liga_id = $1`, [liga.id])) === 3, 'Liga: 3 Mitglieder, doppelter Beitritt ignoriert')
const lr = await rpc(fan2, `select tipp_rangliste('saison', null, $1) j`, [liga.id])
ok(lr.eintraege.length === 3 && lr.eintraege.some((e) => e.name === 'Paula S.'), 'Liga-Rangliste zeigt alle Mitglieder (auch nicht-öffentliche)')
await expectErr(fan3(`select tipp_rangliste('saison', null, $1)`, [liga.id]), 'Nicht-Mitglied sieht Liga-Rangliste nicht', /tipp_liga_kein_mitglied/)
const lt = await rpc(fan2, `select tipp_liga_tipps($1, $2) j`, [liga.id, S1])
ok(lt.length === 3 && lt.every((t) => typeof t.punkte === 'number'), 'Liga-Tipps zu S1 nach Anpfiff sichtbar')
const S4 = await spiel('TSV Apensen', true, `${MON} + interval '20 days 13 hours'`)
await expectErr(fan2(`select tipp_liga_tipps($1, $2)`, [liga.id, S4]), 'Liga-Tipps vor Anpfiff gesperrt', /tipp_noch_offen/)
const ml = await rpc(fan1, `select tipp_meine_ligen() j`)
ok(ml.length === 1 && ml[0].mitglieder === 3 && ml[0].gruender === true && ml[0].meinPlatz >= 1, 'Meine Ligen: Größe, Gründer, Platz')
for (let i = 0; i < 4; i++) await fan1(`select tipp_liga_gruenden($1)`, [`Liga Nummer ${i + 2}`])
await expectErr(fan1(`select tipp_liga_gruenden('Liga Nummer 6')`), 'max. 5 eigene Ligen', /tipp_liga_limit/)
await fan4(`select tipp_liga_verlassen($1)`, [liga.id])
ok((await val(`select count(*)::int v from sva_tipp_liga_mitglieder where liga_id = $1`, [liga.id])) === 2, 'Liga verlassen')

// ── 18. Abzeichen ───────────────────────────────────────────────────────────
const abz = async (uid) => (await db.query(`select abzeichen from sva_tipp_abzeichen where user_id = $1`, [uid])).rows.map((r) => r.abzeichen)
ok((await abz(F1)).includes('erster_tipp'), 'Abzeichen erster_tipp')
ok((await abz(F1)).includes('kapitaensgriff'), 'Abzeichen kapitaensgriff (Kapitän ≥ 10 Punkte)')
const sieger = (await one(`select user_id from sva_tipp_punkte where spiel_id = $1 order by gesamt desc limit 1`, [S1])).user_id
ok((await abz(sieger)).includes('spieltagssieger'), 'Abzeichen spieltagssieger')

// ── 19. Testspiel als Winterwertung ─────────────────────────────────────────
await expectErr(fan1(`select tipp_admin_spieltag_speichern($1, true, null, null)`, [ST]), 'Fan darf Spieltage nicht pflegen', /tipp_kein_team/)
await team(`select tipp_admin_spieltag_speichern($1, true, null, null)`, [ST])
ok((await val(`select public.sva_tipp_wertung($1) v`, [ST])) === 'winter', 'Testspiel mit Schalter → Winterwertung')
r = await rpc(fan1, `select tipp_abgeben($1, 4, 0) j`, [ST])
ok(r.ok, 'Testspiel jetzt tippbar')
await expectErr(team(`select tipp_admin_spieltag_speichern($1, null, '{gelb,rot,zuschauer}', null)`, [S2]), 'Zuschauer-Frage nur bei Heimspielen', /tipp_ungueltig:zuschauer_nur_heim/)
await expectErr(team(`select tipp_admin_spieltag_speichern($1, null, '{gelb,gelb,rot}', null)`, [S4]), 'doppelte Frage → abgelehnt', /tipp_ungueltig:fragen/)
await team(`select tipp_admin_spieltag_speichern($1, null, '{elfmeter,zuschauer,erstes_tor}', 80)`, [S4])
ok(JSON.stringify(await val(`select public.sva_tipp_fragen($1) v`, [S4])) === JSON.stringify(['elfmeter', 'zuschauer', 'erstes_tor']), 'Admin-Fragen gespeichert')
await expectErr(team(`select tipp_admin_spieltag_speichern($1, null, '{gelb,rot,tor20}', null)`, [S1]), 'nach Tippschluss keine neuen Fragen', /tipp_fragen_gesperrt/)
const tage = await rpc(team, `select tipp_admin_spieltage() j`)
ok(tage.some((t) => t.id === S4 && t.linie === 80) && !tage.some((t) => t.id === DEMO), 'Admin-Spieltage: Linie gepflegt, Vorführ-Spiel ausgeblendet')

// ── 20. Story-Daten (Admin) ─────────────────────────────────────────────────
await expectErr(team(`select tipp_admin_story()`), 'Team bekommt keine Story-Daten', /tipp_kein_admin/)
await admin(`update sva_tipp_einstellungen set story_code = 'AGA-SA7' where id = 1`)
const story = await rpc(admin, `select tipp_admin_story() j`)
ok(story.storyCode === 'AGA-SA7' && Array.isArray(story.top5) && story.top5.every((e) => e.name !== 'Paula S.'), 'Story: Code + Top 5 nur öffentlich sichtbare')
ok(story.spieltag && story.spieltag.sieger.length >= 1, 'Story: Spieltagssieger vorhanden')
await expectErr(admin(`update sva_tipp_einstellungen set story_code = 'mit leerzeichen' where id = 1`), 'Story-Code-Format geprüft', /check|violates/)
await expectErr(fan1(`update sva_tipp_einstellungen set preise = 'x' where id = 1`).then((r) => { if (!r.affectedRows) throw new Error('keine Zeile (RLS)') }), 'Fan kann Einstellungen nicht ändern', /RLS|keine Zeile|permission/)

// ── 21. Konto löschen (Album) räumt die Tipp-Liga mit ab ────────────────────
await fan2(`select album_konto_loeschen()`)
const rest = await one(`select (select count(*) from sva_tipp_teilnehmer where user_id = $1)::int t, (select count(*) from sva_tipp_tipps where user_id = $1)::int ti,
                               (select count(*) from sva_tipp_punkte where user_id = $1)::int p, (select count(*) from sva_tipp_liga_mitglieder where user_id = $1)::int l`, [F2])
ok(rest.t + rest.ti + rest.p + rest.l === 0, 'Konto löschen: Teilnahme, Tipps, Punkte, Ligen weg ' + JSON.stringify(rest))

// ── 22. Statistik-Pfade + Rechte ────────────────────────────────────────────
ok((await rpc(asAnon, `select web_zaehlen('/tippen', 'instagram:story', 'mobil') j`)) === true, 'Statistik: /tippen wird gezählt')
ok((await rpc(asAnon, `select web_zaehlen('#ereignis:tipp-abgegeben', 'direkt', 'mobil') j`)) === true, 'Statistik: Ereignis tipp-abgegeben')
ok((await rpc(asAnon, `select web_zaehlen('#ereignis:liga-gegruendet', 'direkt', 'mobil') j`)) === true, 'Statistik: Ereignis liga-gegruendet')
ok((await rpc(asAnon, `select web_zaehlen('/kalender', 'direkt', 'mobil') j`)) === false, 'Statistik: unbekannte Pfade weiter abgelehnt')
const priv = async (role, sig) => val(`select has_function_privilege('${role}', '${sig}', 'EXECUTE') v`)
ok((await priv('anon', 'public.tipp_lage()')) === true, 'anon darf tipp_lage')
ok((await priv('anon', 'public.tipp_abgeben(uuid, integer, integer, text, text, boolean, jsonb)')) === false, 'anon darf NICHT tipp_abgeben')
ok((await priv('anon', 'public.tipp_admin_werten(uuid)')) === false, 'anon darf NICHT werten')
ok((await priv('authenticated', 'public.sva_tipp_rang(text, uuid, date, text, uuid, uuid, integer)')) === false, 'interne Ranglisten-Funktion nicht öffentlich')
ok((await priv('authenticated', 'public.sva_tipp_album_ziel(text, uuid, uuid)')) === false, 'Album-Missions-Helfer nicht öffentlich')
await expectErr(fan1(`select tipp_admin_werten($1)`, [S1]), 'Fan darf nicht werten', /tipp_kein_team/)
// web_snapshot unverändert: kein Tipp-Feld
const snap = await rpc(asAnon, `select web_snapshot() j`)
ok(!JSON.stringify(snap).includes('tipp'), 'web_snapshot() unverändert (keine Tipp-Daten)')

console.log(fails ? `\n${fails} FEHLER (${oks} ok)` : `\nALLES GRÜN (${oks} Prüfungen)`)
process.exit(fails ? 1 : 0)
