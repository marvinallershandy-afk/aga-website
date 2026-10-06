// PGlite-Test der Migration 20261014100000_sva_tippliga_v22.sql (v22-T).
// Prüft: EIN Fokus (nächstes Spiel erst nach Wertung bzw. spätestens 24 h nach
// Abpfiff tippbar — Tipp UND Elf, Lage zeigt es nur als Vorschau „naechstes“),
// Vorführ-Spiele sperren nie, Preise (Admin-Pflege, RLS, Altersgrenze mit
// U18-Alternative, Partner, leer = unsichtbar), Startelf-Vorschlag aus der
// aktuellen Aufstellung (Formation, nicht verfügbar, kein Kapitän), Rechte.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/tippliga_v22.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node tippliga_v22.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261014100000_sva_tippliga_v22.sql'
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

// ── 1. Alle Migrationen (Default-Rechte wie bei Supabase für neue Tabellen) ─
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

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const user = async (email, app) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, app ? { app } : {}])).id
const CHEF = await user('chef@sva.de')
const TEAM = await user('team@sva.de')
const F1 = await user('lena@fan.example', 'sva-album')
const F2 = await user('ole@fan.example', 'sva-album')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const team = (sql, p) => as(TEAM, 'team@sva.de', sql, p)
const fan1 = (sql, p) => as(F1, 'lena@fan.example', sql, p)
const fan2 = (sql, p) => as(F2, 'ole@fan.example', sql, p)

// Test-Kader (11 Spieler, eindeutig; Seed-Kader ausgeblendet)
await db.exec(`update sm_roster set aktiv = false`)
const KADER = [['t-tw', 'Malte Pils', 'TW'], ['t-abw1', 'Justin Hüttry', 'ABW'], ['t-abw2', 'Lennard B', 'ABW'], ['t-abw3', 'Tom S', 'ABW'],
  ['t-mit1', 'Julio Paruzel', 'MIT'], ['t-mit2', 'Niclas Becker', 'MIT'], ['t-mit3', 'Noah Pejas', 'MIT'], ['t-mit4', 'Kai Helck', 'MIT'],
  ['t-ang1', 'Aaron Warkehr', 'ANG'], ['t-ang2', 'Marc Biedermann', 'ANG'], ['t-tw2', 'Tim Ebeling', 'TW']]
for (const [slug, name, pos] of KADER) await db.query(`insert into sm_roster (slug, name, position, aktiv, rolle) values ($1,$2,$3,true,'spieler')`, [slug, name, pos])
const ELF = ['t-tw', 't-abw1', 't-mit1', 't-mit2', 't-ang1']

const spiel = async (gegner, sql, demo = false) => (await admin(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb, demo) values ($1, true, ${sql}, 'Kreisliga Stade', $2) returning id`, [gegner, demo])).rows[0].id
const A = await spiel('TuS Fischbek', `now() + interval '2 hours'`)
const B = await spiel('SG Lühe', `now() + interval '7 days'`)

await fan1(`select tipp_beitreten('Lena', 'K', true, true, true)`)
await fan2(`select tipp_beitreten('Ole', 'M', false, true, true)`)

// ── 2. Vor dem Anpfiff: nur das anstehende Spiel ───────────────────────────
let lage = await rpc(asAnon, `select tipp_lage() j`)
ok(lage.version === 2 && lage.offen?.id === A && !lage.naechstes, 'vor Anpfiff: offen = anstehendes Spiel, keine Vorschau')
await fan1(`select tipp_abgeben($1, 2, 1)`, [A])
await fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [A, ELF, 't-ang1'])
ok(true, 'Tipp + Elf fürs anstehende Spiel gehen')
// Vorab-Tipp für ein späteres Spiel bleibt serverseitig möglich (v20-Joker-Logik
// über Monate); /tippen bietet vor dem Anpfiff nur das anstehende Spiel an.
await fan2(`select tipp_abgeben($1, 1, 0)`, [B])
ok(true, 'vor dem 1. Anpfiff: Vorab-Tipp fürs spätere Spiel erlaubt (UI zeigt ihn nicht)')
ok((await rpc(asAnon, `select public.sva_tipp_freigegeben($1) j`, [A]).catch(() => 'kein Recht')) === 'kein Recht', 'interner Helfer sva_tipp_freigegeben nicht für anon')
ok((await val(`select public.sva_tipp_freigegeben($1) v`, [A])) === true, 'freigegeben: A ja')

// ── 3. Live: nur das Live-Spiel, nächstes nur als Vorschau ─────────────────
await db.query(`update sm_spiele set anstoss = now() - interval '30 minutes' where id = $1`, [A])
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'anpfiff', 1, now() - interval '30 minutes')`, [A])
ok((await val(`select status v from sm_spiele where id = $1`, [A])) === 'live', 'Ticker: Spiel A läuft')
lage = await rpc(fan1, `select tipp_lage() j`)
ok(!lage.offen, 'live: KEIN offenes Spiel (nächstes nicht tippbar)')
ok(lage.gesperrt?.id === A && lage.gesperrt.status === 'live', 'live: gesperrt = Live-Spiel')
ok(lage.naechstes?.id === B && lage.naechstes.gegner === 'SG Lühe' && !('meinTipp' in lage.naechstes), 'live: Vorschau „naechstes“ = SG Lühe (ohne Tippschein-Daten)')
const ab1 = new Date(lage.naechstes.oeffnetAb).getTime()
const anstossA = new Date(await val(`select anstoss v from sm_spiele where id = $1`, [A])).getTime()
ok(Math.abs(ab1 - (anstossA + 26 * 3600_000)) < 5000, 'ohne Abpfiff-Ereignis: öffnet spätestens Anstoß + 2 h + 24 h')
await expectErr(fan1(`select tipp_abgeben($1, 1, 0)`, [B]), 'live: Tipp fürs nächste Spiel → tipp_noch_nicht_offen', /tipp_noch_nicht_offen/)
await expectErr(fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [B, ELF, 't-tw']), 'live: Elf fürs nächste Spiel → tipp_noch_nicht_offen', /tipp_noch_nicht_offen/)
await expectErr(fan1(`select tipp_abgeben($1, 1, 0)`, [A]), 'live: Live-Spiel selbst bleibt geschlossen', /tipp_geschlossen/)

// ── 4. Abpfiff → „Wertung folgt“: weiter gesperrt, Frist ab Abpfiff ────────
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'tor', 23, now() - interval '20 minutes')`, [A])
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'abpfiff', 93, now() - interval '1 minute')`, [A])
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.gesperrt?.status === 'beendet' && !lage.offen && lage.naechstes?.id === B, 'nach Abpfiff, vor Wertung: Auflösung folgt, nächstes noch zu')
const ab2 = new Date(lage.naechstes.oeffnetAb).getTime()
ok(Math.abs(ab2 - (Date.now() - 60_000 + 24 * 3600_000)) < 60_000, 'Frist: Abpfiff (Ticker) + 24 h ' + lage.naechstes.oeffnetAb)
await expectErr(fan2(`select tipp_abgeben($1, 0, 0)`, [B]), 'nach Abpfiff vor Wertung: nächstes gesperrt', /tipp_noch_nicht_offen/)

// ── 5. Wertung öffnet das nächste Spiel sofort ─────────────────────────────
await team(`select tipp_admin_bericht_speichern($1, '[]', '{}', null, null)`, [A])
const w = await rpc(team, `select tipp_admin_werten($1) j`, [A])
ok(w.ok, 'Spiel A gewertet')
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.offen?.id === B && !lage.naechstes && lage.gewertet?.id === A, 'nach Wertung: SG Lühe offen, Auflösung A da')
await fan2(`select tipp_abgeben($1, 0, 0)`, [B])
await fan2(`select tipp_elf_speichern($1, $2, $3, false)`, [B, ELF, 't-mit1'])
ok(true, 'nach Wertung: Tipp + Elf fürs nächste Spiel gehen')

// ── 6. Spätestens 24 h nach Abpfiff, auch ohne Wertung ─────────────────────
const C = await spiel('VfL Horneburg', `now() + interval '14 days'`)
await db.query(`update sm_spiele set anstoss = now() - interval '26 hours' where id = $1`, [B])
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'anpfiff', 1, now() - interval '26 hours'), ($1, 'abpfiff', 93, now() - interval '23 hours')`, [B])
lage = await rpc(fan1, `select tipp_lage() j`)
ok(!lage.offen && lage.naechstes?.id === C, '23 h nach Abpfiff ohne Wertung: noch gesperrt')
await expectErr(fan1(`select tipp_abgeben($1, 3, 0)`, [C]), '23 h: Tipp abgelehnt', /tipp_noch_nicht_offen/)
await db.query(`update sva_ticker set zeitpunkt = now() - interval '25 hours' where spiel_id = $1 and typ = 'abpfiff'`, [B])
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.offen?.id === C && !lage.naechstes, '25 h nach Abpfiff ohne Wertung: nächstes Spiel öffnet von selbst')
ok(lage.gesperrt?.id === B && lage.gesperrt.status === 'beendet', '… das ungewertete Spiel steht weiter als „Wertung folgt“ da')
await fan1(`select tipp_abgeben($1, 3, 0)`, [C])
ok(true, '25 h: Tipp geht')

// ohne Ticker (vergessen): Anstoß + 2 h + 24 h
const D = await spiel('FC Stade', `now() + interval '21 days'`)
await db.query(`update sm_spiele set anstoss = now() - interval '25 hours' where id = $1`, [C])
lage = await rpc(fan1, `select tipp_lage() j`)
ok(!lage.offen && lage.naechstes?.id === D, 'ohne Ticker: 25 h nach Anstoß noch gesperrt (Abpfiff geschätzt +2 h)')
await db.query(`update sm_spiele set anstoss = now() - interval '27 hours' where id = $1`, [C])
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.offen?.id === D, 'ohne Ticker: 27 h nach Anstoß offen')

// Vorführ-Spiel sperrt nie
await db.query(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb, demo) values ('Vorführ-FC', true, now() - interval '20 minutes', 'Kreisliga Stade', true)`) // wie die Demo-RPC (nicht als Fan/Team)
lage = await rpc(fan1, `select tipp_lage() j`)
ok(lage.offen?.id === D && !lage.naechstes, 'laufendes Vorführ-Spiel sperrt das echte nicht')

// ── 7. Preise ───────────────────────────────────────────────────────────────
ok(!('preise' in lage), 'ohne Preise: kein Preis-Bereich in der Lage')
const SP = (await admin(`insert into sm_sponsoren (name, logo_url, aktiv) values ('Getränke Meyer', 'https://x.example/logo.png', true) returning id`)).rows[0].id
await admin(`insert into sva_tipp_preise (wertung, platz, titel, beschreibung, partner_id) values ('saison', 1, 'Trikot nach Wahl', 'Übergabe beim letzten Heimspiel', $1)`, [SP])
await admin(`insert into sva_tipp_preise (wertung, platz, titel, partner_id, ab_alter) values ('saison', 2, 'Getränkegutschein Vereinsheim', $1, 18)`, [SP])
await admin(`insert into sva_tipp_preise (wertung, platz, titel, ab_alter, alternative) values ('monat', 1, 'Kiste Getränke', 18, 'Kiste Limo')`)
ok((await val(`select alternative v from sva_tipp_preise where platz = 2 and wertung = 'saison'`)) === 'Softdrink-Variante', 'Altersgrenze ohne Alternative → „Softdrink-Variante“ automatisch')
await expectErr(admin(`insert into sva_tipp_preise (wertung, platz, titel) values ('monat', 4, 'x Preis')`), 'Monatswertung nur Platz 1–3', /sva_tipp_preise_monat_platz/)
await expectErr(admin(`insert into sva_tipp_preise (wertung, platz, titel) values ('saison', 1, 'Doppelt')`), 'pro Platz nur ein aktiver Preis', /duplicate|unique/i)
await expectErr(admin(`insert into sva_tipp_preise (wertung, platz, titel, ab_alter) values ('saison', 3, 'Preis', 21)`), 'Altersgrenze nur 16/18', /check/i)
await expectErr(fan1(`insert into sva_tipp_preise (wertung, platz, titel) values ('saison', 4, 'Fan-Preis')`), 'Fan darf keine Preise anlegen', /row-level security|permission/i)
ok((await fan1(`select * from sva_tipp_preise`)).rows.length === 0, 'Fan liest die Preistabelle nicht direkt')
await expectErr(asAnon(`select * from sva_tipp_preise`), 'anon liest die Preistabelle nicht', /permission/i)
await expectErr(team(`update sva_tipp_preise set titel = 'Team' where platz = 1`).then((r) => { if (!r.affectedRows) throw new Error('permission: 0 Zeilen') }), 'Team (nicht Admin) ändert keine Preise', /permission/)
lage = await rpc(asAnon, `select tipp_lage() j`)
ok(lage.preise?.length === 3 && lage.preise[0].wertung === 'saison' && lage.preise[0].platz === 1 && lage.preise[2].wertung === 'monat', 'Lage: Preise sortiert (Saison 1, 2 · Monat 1) ' + JSON.stringify(lage.preise?.map((p) => p.wertung + p.platz)))
ok(lage.preise[0].partner?.name === 'Getränke Meyer' && lage.preise[0].partner.logoUrl && lage.preise[0].beschreibung, 'Lage: „präsentiert von“ mit Logo')
ok(lage.preise[1].abAlter === 18 && lage.preise[1].alternative === 'Softdrink-Variante' && lage.preise[2].alternative === 'Kiste Limo', 'Lage: Altersgrenze + U18-Alternative')
await admin(`update sm_sponsoren set aktiv = false where id = $1`, [SP])
lage = await rpc(asAnon, `select tipp_lage() j`)
ok(!lage.preise[0].partner, 'inaktiver Partner → ohne „präsentiert von“')
await admin(`update sva_tipp_preise set aktiv = false`)
lage = await rpc(asAnon, `select tipp_lage() j`)
ok(!('preise' in lage), 'alle Preise inaktiv → Bereich unsichtbar')

// ── 8. Startelf-Vorschlag ───────────────────────────────────────────────────
ok(!('vorschlagElf' in lage) || lage.vorschlagElf == null || lage.vorschlagElf.spieler.every((x) => x == null || KADER.some((k) => k[0] === x)), 'Vorschlag nur aus aktiven Spielern')
const ids = async (slugs) => Promise.all(slugs.map((s) => val(`select id v from sm_roster where slug = $1 and aktiv`, [s])))
const START = ['t-tw', 't-abw2', 't-abw1', 't-abw3', 't-mit3', 't-mit1', 't-mit2', 't-mit4', 't-ang2', 't-ang1', 't-tw2']
await db.query(`insert into sva_lineup (formation, startelf, bank, match_label) values ('4-4-2', $1, '{}', 'gegen SG Lühe')`, [await ids(START)])
await team(`select tipp_admin_spieler_speichern('t-mit3', null, true, 'Urlaub')`)
lage = await rpc(asAnon, `select tipp_lage() j`)
const v = lage.vorschlagElf
ok(v && JSON.stringify(v.spieler) === JSON.stringify(['t-tw', 't-abw2', 't-mit1', 't-mit2', 't-ang2']), 'Vorschlag: TW · ABW · MIT · MIT · ANG in Aufstellungs-Reihenfolge, nicht verfügbar übersprungen ' + JSON.stringify(v?.spieler))
ok(v.kapitaen === '' && v.frei === false && v.quelle === 'Startelf gegen SG Lühe', 'Vorschlag: ohne Kapitän (bewusste Wahl), Quelle benannt')
await fan2(`select tipp_elf_speichern($1, $2, $3, false)`, [D, v.spieler, 't-ang2'])
ok(true, 'Vorschlag ist eine gültige Elf (Formation)')

// ── 9. Rechte ───────────────────────────────────────────────────────────────
const recht = async (role, sig) => val(`select has_function_privilege('${role}', '${sig}', 'EXECUTE') v`)
ok((await recht('anon', 'public.tipp_lage()')) === true && (await recht('authenticated', 'public.tipp_lage()')) === true, 'tipp_lage bleibt öffentlich')
for (const f of ['sva_tipp_blocker(uuid)', 'sva_tipp_oeffnet_ab(uuid)', 'sva_tipp_abpfiff_zeit(uuid)', 'sva_tipp_vorschlag_elf()', 'sva_tipp_preise_json()']) {
  ok((await recht('authenticated', 'public.' + f)) === false && (await recht('anon', 'public.' + f)) === false, `interner Helfer ${f} nicht öffentlich`)
}

console.log(`\n${oks} OK, ${fails} FAIL`)
process.exit(fails ? 1 : 0)
