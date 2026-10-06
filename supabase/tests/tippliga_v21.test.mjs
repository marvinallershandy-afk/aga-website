// PGlite-Test der Migration 20261013100000_sva_tippliga_v21.sql (v21-T).
// Prüft: neue Formation 1 TW · 1 ABW · 2 MIT · 1 ANG, Zweitposition (Admin/Team),
// „nicht verfügbar“, Migration bestehender Elfen (offene Spiele sortiert bzw.
// „frei“, gewertete unverändert), Punkte unverändert, Kabinen-Liga (automatisch,
// kein Code-Beitritt, kein Verlassen, öffentlich lesbar nur „sichtbar“), Rechte.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/tippliga_v21.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node tippliga_v21.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261013100000_sva_tippliga_v21.sql'
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

// ── 1. Stand VOR v21: Migrationen bis 20261012120000 ────────────────────────
const tippliga = '20261012100000_sva_tippliga.sql'
for (const f of files.filter((x) => x < NEU)) {
  if (f === tippliga) await defaults()
  await run(f)
}
await defaults()
await run(tippliga) // entzieht Default-Rechte wieder
for (const f of files.filter((x) => x > tippliga && x < NEU)) await run(f)

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;`)
const user = async (email, app) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id`, [email, app ? { app } : {}])).id
const CHEF = await user('chef@sva.de')
const TEAM = await user('team@sva.de')
const F1 = await user('lena@fan.example', 'sva-album')
const F2 = await user('ole@fan.example', 'sva-album')
const K1 = await user('tobi@kabine.example', 'sva-album')
const K2 = await user('jannik@kabine.example', 'sva-album')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const team = (sql, p) => as(TEAM, 'team@sva.de', sql, p)
const fan1 = (sql, p) => as(F1, 'lena@fan.example', sql, p)
const fan2 = (sql, p) => as(F2, 'ole@fan.example', sql, p)
const kab1 = (sql, p) => as(K1, 'tobi@kabine.example', sql, p)
const kab2 = (sql, p) => as(K2, 'jannik@kabine.example', sql, p)

// Kader: eigener, eindeutiger Test-Kader (Seed-Kader wird ausgeblendet)
await db.exec(`update sm_roster set aktiv = false`)
const KADER = [['t-tw', 'Malte Pils', 'TW'], ['t-abw1', 'Justin Hüttry', 'ABW'], ['t-abw2', 'Lennard B', 'ABW'],
  ['t-mit1', 'Julio Paruzel', 'MIT'], ['t-mit2', 'Niclas Becker', 'MIT'], ['t-pejas', 'Noah Pejas', 'MIT'],
  ['t-ang1', 'Aaron Warkehr', 'ANG'], ['t-ang2', 'Marc Biedermann', 'ANG']]
for (const [slug, name, pos] of KADER) await db.query(`insert into sm_roster (slug, name, position, aktiv, rolle) values ($1,$2,$3,true,'spieler')`, [slug, name, pos])
const id = async (slug) => val(`select id v from sm_roster where slug = $1 and aktiv`, [slug])

const MON = `date_trunc('month', now()) + interval '1 month'`
const spiel = async (gegner, sql) => (await admin(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb) values ($1, true, ${sql}, 'Kreisliga Stade') returning id`, [gegner])).rows[0].id
const OFFEN = await spiel('TuS Fischbek', `${MON} + interval '9 days 13 hours'`)

await fan1(`select tipp_beitreten('Lena', 'K', true, true, true)`)
await fan2(`select tipp_beitreten('Ole', 'M', false, true, true)`)
await kab1(`select tipp_beitreten('Tobias', 'H', false, true, true)`)
await kab2(`select tipp_beitreten('Jannik', 'S', false, true, true)`)
// alte Formation [TW/ABW, MIT, MIT, ANG, ANG] — vor v21 gültig
await fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-abw1', 't-mit1', 't-mit2', 't-ang1', 't-ang2'], 't-ang1'])
await fan2(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-tw', 't-mit1', 't-mit2', 't-ang1', 't-ang2'], 't-mit1'])
await kab1(`select tipp_abgeben($1, 2, 1)`, [OFFEN])
await admin(`select tipp_admin_kabine($1, true)`, [K1]) // alte Fassung: ohne „sichtbar“

// ── 2. v21 anwenden (zweimal: idempotent) ───────────────────────────────────
await defaults()
await run(NEU)
await run(NEU)

// Migration bestehender Elfen (offenes Spiel)
const elf = async (uid) => one(`select e.frei, array(select r.slug from unnest(e.spieler) with ordinality u(x, i) join sm_roster r on r.id = u.x order by u.i) slugs from sva_tipp_elf e where user_id = $1 and spiel_id = $2`, [uid, OFFEN])
let e1 = await elf(F1)
let e2 = await elf(F2)
ok(e1.frei === true, 'alte Elf ohne TW + zwei ANG passt nicht in 1-1-2-1 → als „frei“ markiert (bleibt gültig) ' + JSON.stringify(e1))
ok(e2.frei === true && e2.slugs.length === 5, 'alte Elf mit TW, aber ohne ABW → „frei“ ' + JSON.stringify(e2))
// Startwerte: Zweitposition aus der Migration (Seed-Slugs) — hier Test-Kader → keine
ok((await val(`select count(*)::int v from sva_tipp_spieler s join sm_roster r on r.id = s.roster_id where r.aktiv`)) === 0, 'Startwerte nur für bekannte Seed-Slugs')

// ── 3. Formation 1 TW · 1 ABW · 2 MIT · 1 ANG ──────────────────────────────
const neu = ['t-tw', 't-abw1', 't-mit1', 't-mit2', 't-ang1']
await fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, neu, 't-ang1'])
e1 = await elf(F1)
ok(e1.frei === false && e1.slugs.join() === neu.join(), 'neue Formation wird gespeichert ' + e1.slugs.join(','))
await expectErr(fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-tw', 't-mit1', 't-mit2', 't-ang1', 't-ang2'], 't-ang1']), 'alte Formation (2 ANG, kein ABW) → abgelehnt', /tipp_ungueltig:positionen/)
await expectErr(fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-abw1', 't-tw', 't-mit1', 't-mit2', 't-ang1'], 't-ang1']), 'TW und ABW vertauscht → abgelehnt', /tipp_ungueltig:positionen/)
await expectErr(fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-tw', 't-abw1', 't-mit1', 't-mit2', 't-pejas'], 't-pejas']), 'MIT im Angriff ohne Zweitposition → abgelehnt', /tipp_ungueltig:positionen/)

// Zweitposition (Team pflegt)
await expectErr(fan1(`select tipp_admin_spieler_speichern('t-pejas', 'ANG', false)`), 'Fan darf Zweitposition nicht setzen', /tipp_kein_team/)
await expectErr(team(`select tipp_admin_spieler_speichern('t-pejas', 'STURM', false)`), 'unbekannte Position → abgelehnt', /tipp_ungueltig:position/)
await team(`select tipp_admin_spieler_speichern('t-pejas', 'ANG', false)`)
await fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-tw', 't-abw1', 't-mit1', 't-mit2', 't-pejas'], 't-pejas'])
ok((await elf(F1)).slugs[4] === 't-pejas', 'Zweitposition ANG: offensiver MIT darf in den Angriff')
await fan1(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-tw', 't-abw1', 't-pejas', 't-mit2', 't-ang1'], 't-ang1'])
ok((await elf(F1)).slugs[2] === 't-pejas', 'Hauptposition gilt weiter (Pejas auch im Mittelfeld)')
await team(`select tipp_admin_spieler_speichern('t-abw2', 'ABW', false)`)
ok((await val(`select zweitposition v from sva_tipp_spieler where roster_id = $1`, [await id('t-abw2')])) === null, 'Zweitposition = Hauptposition wird nicht gespeichert')

// Kader-JSON
let lage = await rpc(asAnon, `select tipp_lage() j`)
const kp = (slug) => lage.kader.find((k) => k.id === slug)
ok(kp('t-pejas').zweitposition === 'ANG' && kp('t-pejas').position === 'MIT', 'Lage: Kader zeigt Zweitposition')
ok(!('zweitposition' in kp('t-mit1')) && !('nichtVerfuegbar' in kp('t-mit1')), 'Lage: ohne Zusatz keine leeren Felder')

// nicht verfügbar
await team(`select tipp_admin_spieler_speichern('t-ang2', null, true, 'Muskelfaserriss')`)
lage = await rpc(asAnon, `select tipp_lage() j`)
ok(kp('t-ang2').nichtVerfuegbar === true && kp('t-ang2').hinweis === 'Muskelfaserriss', 'Lage: „nicht verfügbar“ mit Hinweis')
await expectErr(fan2(`select tipp_elf_speichern($1, $2, $3, false)`, [OFFEN, ['t-tw', 't-abw1', 't-mit1', 't-mit2', 't-ang2'], 't-mit1']), 'nicht verfügbarer Spieler → abgelehnt', /tipp_ungueltig:nicht_verfuegbar/)
await expectErr(fan2(`select tipp_elf_speichern($1, $2, $3, true)`, [OFFEN, ['t-tw', 't-abw1', 't-mit1', 't-ang1', 't-ang2'], 't-mit1']), 'auch „frei“: nicht verfügbar → abgelehnt', /tipp_ungueltig:nicht_verfuegbar/)
await expectErr(team(`select tipp_admin_spieler_speichern('t-ang2', null, true, $1)`, ['x'.repeat(61)]), 'Hinweis max. 60 Zeichen', /tipp_ungueltig:hinweis/)
await team(`select tipp_admin_spieler_speichern('t-ang2', null, false, 'egal')`)
ok((await val(`select hinweis v from sva_tipp_spieler where roster_id = $1`, [await id('t-ang2')])) === null, 'wieder verfügbar → Hinweis gelöscht')
const ak = await rpc(team, `select tipp_admin_kader() j`)
ok(ak.length === KADER.length && ak.find((k) => k.id === 't-pejas').zweitposition === 'ANG' && ak.every((k) => typeof k.nichtVerfuegbar === 'boolean'), 'Admin-Kader-Liste (Team)')
await expectErr(fan1(`select tipp_admin_kader()`), 'Fan sieht Admin-Kader nicht', /tipp_kein_team/)
ok((await fan1(`select * from sva_tipp_spieler`)).rows.length === 0, 'Fan liest sva_tipp_spieler nicht (RLS: nur Team)')
ok((await team(`select * from sva_tipp_spieler`)).rows.length >= 1, 'Team liest sva_tipp_spieler')

// ── 4. Punkte unverändert (Zu-null nach Hauptposition) ──────────────────────
const sp = (o) => val(`select public.sva_tipp_spieler_punkte($1,$2,$3,$4,$5,$6,$7,$8,$9) v`, [true, o.tore ?? 0, 0, o.zn ?? false, o.pos, o.min ?? 90, null, false, o.sieg ?? false])
ok((await sp({ pos: 'ABW', zn: true })).punkte === 5, 'Punkte: ABW zu null = 5 (wie bisher)')
ok((await sp({ pos: 'MIT', tore: 1, sieg: true })).punkte === 8, 'Punkte: MIT Tor + Sieg = 8 (wie bisher)')

// ── 5. Kabinen-Liga ─────────────────────────────────────────────────────────
const KL = await val(`select id v from sva_tipp_ligen where system = 'kabine'`)
ok(!!KL, 'Kabinen-Liga angelegt (genau eine) ' + (await val(`select count(*)::int v from sva_tipp_ligen where system = 'kabine'`)))
const mitglieder = async () => (await db.query(`select user_id from sva_tipp_liga_mitglieder where liga_id = $1`, [KL])).rows.map((r) => r.user_id)
ok((await mitglieder()).includes(K1), 'bestehendes Kabine-Konto nachgezogen')
await admin(`select tipp_admin_kabine($1, true)`, [K2])
ok((await mitglieder()).includes(K2), 'Admin markiert Kabine → automatisch in der Kabinen-Liga')
ok((await val(`select sichtbar v from sva_tipp_teilnehmer where user_id = $1`, [K2])) === true, 'Kabine markieren → öffentlich sichtbar')
await admin(`select tipp_admin_kabine($1, false)`, [K2])
ok(!(await mitglieder()).includes(K2), 'Kabine entfernt → raus aus der Kabinen-Liga')
await admin(`select tipp_admin_kabine($1, true)`, [K2])
await kab2(`select tipp_profil_speichern('Jannik', 'S', false)`)
const code = await val(`select code v from sva_tipp_ligen where id = $1`, [KL])
await expectErr(fan1(`select tipp_liga_beitreten($1)`, [code]), 'Kabinen-Liga: kein Beitritt per Code', /tipp_liga_unbekannt/)
ok((await rpc(asAnon, `select tipp_liga_vorschau($1) j`, [code])) === null, 'Kabinen-Liga: keine Einladungs-Vorschau')
await expectErr(kab1(`select tipp_liga_verlassen($1)`, [KL]), 'Kabinen-Liga: Verlassen nicht möglich', /tipp_liga_system/)
const mk = await rpc(kab1, `select tipp_meine_ligen() j`)
ok(mk[0].system === 'kabine' && !('code' in mk[0]) && mk[0].mitglieder === 2, 'Meine Ligen: Kabinen-Liga zuerst, ohne Code ' + JSON.stringify(mk[0]))
const kl = await rpc(asAnon, `select tipp_kabinen_liga() j`)
ok(kl.name === 'Kabinen-Liga' && kl.mitglieder === 2, 'tipp_kabinen_liga öffentlich (Name + Größe)')

// Wertung → Kabinen-Liga-Tabelle
await db.query(`insert into sva_ticker (spiel_id, typ, minute, zeitpunkt) values ($1, 'anpfiff', 1, now() - interval '100 minutes')`, [OFFEN])
await db.query(`update sm_spiele set anstoss = now() - interval '100 minutes', tore_sva = 2, tore_gegner = 1, status = 'beendet' where id = $1`, [OFFEN])
await kab2(`select 1`)
await team(`select tipp_admin_bericht_speichern($1, '[]', '{}', null, null)`, [OFFEN])
const w = await rpc(team, `select tipp_admin_werten($1) j`, [OFFEN])
ok(w.ok, 'Spiel gewertet ' + JSON.stringify(w))
const tabMitglied = await rpc(kab1, `select tipp_rangliste('saison', null, $1) j`, [KL])
const tabFan = await rpc(fan1, `select tipp_rangliste('saison', null, $1) j`, [KL])
const tabAnon = await rpc(asAnon, `select tipp_rangliste('saison', null, $1) j`, [KL])
ok(tabMitglied.eintraege.length >= 1 && tabMitglied.eintraege.every((x) => x.kabine === true), 'Kabinen-Liga-Tabelle für Mitglieder ' + JSON.stringify(tabMitglied.eintraege))
ok(tabFan.eintraege.every((x) => x.name !== 'Jannik S.') && tabAnon.eintraege.every((x) => x.name !== 'Jannik S.'), 'Nicht-Mitglieder sehen nur sichtbare Kabine-Konten')
const priv = await rpc(fan1, `select tipp_liga_gruenden('Stammtisch-Liga') j`)
await expectErr(fan2(`select tipp_rangliste('saison', null, $1)`, [priv.id]), 'private Liga bleibt nur für Mitglieder', /tipp_liga_kein_mitglied/)
const rlOeff = await rpc(asAnon, `select tipp_rangliste('spieltag', $1) j`, [OFFEN])
ok(rlOeff.eintraege.some((x) => x.name === 'Tobias H.' && x.kabine === true), 'öffentliche Rangliste: Kabine-Konto mit Abzeichen (Migration schaltet bestehende Kabine sichtbar)')
ok(!rlOeff.eintraege.some((x) => x.name === 'Jannik S.'), 'Spieler hat „öffentlich zeigen“ im Profil abgeschaltet → bleibt verborgen')
const du = await rpc(asAnon, `select tipp_duell() j`)
ok(du.saison && du.saison.nKabine >= 1, 'Fans vs. Kabine bleibt ' + JSON.stringify(du.saison))

// ── 6. Rechte ───────────────────────────────────────────────────────────────
const recht = async (role, sig) => val(`select has_function_privilege('${role}', '${sig}', 'EXECUTE') v`)
ok((await recht('anon', 'public.tipp_admin_spieler_speichern(text, text, boolean, text)')) === false, 'anon darf Kader nicht pflegen')
ok((await recht('authenticated', 'public.sva_tipp_elf_ordnen(uuid[])')) === false, 'interner Helfer elf_ordnen nicht öffentlich')
ok((await recht('authenticated', 'public.sva_tipp_scope(text, uuid, date, text, uuid, uuid)')) === false, 'sva_tipp_scope bleibt intern')
ok((await recht('anon', 'public.tipp_rangliste(text, text, uuid)')) === true, 'anon darf weiter Ranglisten lesen')
ok((await recht('anon', 'public.tipp_meine_ligen()')) === false, 'anon darf tipp_meine_ligen nicht')

console.log(`\n${oks} OK, ${fails} FAIL`)
process.exit(fails ? 1 : 0)
