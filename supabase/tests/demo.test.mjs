// PGlite-Test der Migration 20261010100000_sva_demo_spiel.sql (v18-T „Vorführ-Spiel“):
//   · Ausgabe von web_snapshot(), web_live(), web_kalender() ist OHNE Vorführ-Spiel
//     Feld für Feld gleich der bisherigen (alte Funktionsrümpfe werden vor der
//     Migration als alt_* gesichert und in mehreren Spiel-Zuständen verglichen)
//   · MIT Vorführ-Spiel (live, beendet, geplant, mit Aufstellung) bleiben alle
//     öffentlichen Ausgaben unverändert; nur web_live_demo() zeigt es
//   · Rechte: nur Admins starten/beenden/löschen; anon/Team nicht; das
//     Kennzeichen lässt sich nicht direkt setzen/umschalten; höchstens eins
//   · Album: keine Codes/Check-ins für Vorführ-Spiele
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   mkdir /tmp/pg && cd /tmp/pg && npm i @electric-sql/pglite
//   cp <repo>/supabase/tests/demo.test.mjs . && MIGRATIONS=<repo>/supabase/migrations/ node demo.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import { isDeepStrictEqual } from 'node:util'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261010100000_sva_demo_spiel.sql'
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
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 100)) }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]

// Zeitstempel des Aufrufs (now()) sind die einzigen Felder, die sich von
// Aufruf zu Aufruf ändern dürfen.
// serverNow u. ä. ändern sich je Aufruf. Zusätzlich (v23-L): web_live() wurde zu
// Version 2 erweitert (additive Felder source/reactions/conference/tipp/fupaUrl/
// fupaAutor). Diese werden beim „neu = bisher"-Vergleich gegen die Pre-v23-Baseline
// ignoriert — die Demo-Ausschluss- und Idempotenz-Prüfungen bleiben voll wirksam.
const ZEIT = new Set(['generatedAt', 'serverNow', 'erzeugt',
  'version', 'source', 'reactions', 'conference', 'tipp', 'fupaUrl', 'fupaAutor'])
const ohneZeit = (o) => JSON.parse(JSON.stringify(o, (k, v) => (ZEIT.has(k) ? undefined : v)))
/** Feld-für-Feld-Vergleich; bei Abweichung die ersten unterschiedlichen Pfade. */
function diff(a, b, pfad = '$', out = []) {
  if (out.length > 5) return out
  if (isDeepStrictEqual(a, b)) return out
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], `${pfad}.${k}`, out)
    if (Array.isArray(a) && a.length !== b.length) out.push(`${pfad}.length ${a.length}≠${b.length}`)
  } else out.push(`${pfad}: ${JSON.stringify(a)?.slice(0, 60)} ≠ ${JSON.stringify(b)?.slice(0, 60)}`)
  return out
}
const gleich = (a, b, msg) => {
  const d = diff(ohneZeit(a), ohneZeit(b))
  ok(d.length === 0, msg + (d.length ? ' → ' + d.join(' | ') : ''))
}
const anzahlFelder = (o) => JSON.stringify(o).length

// ── 1. Alle Migrationen VOR der neuen; Rümpfe sichern ───────────────────────
const files = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(files.includes(NEU), 'Migration liegt im Ordner')
for (const f of files.filter((f) => f < NEU)) await run(f)
await tabellenRechte()

// Bisherige Definitionen als alt_* sichern (gleicher Rumpf, anderer Name)
for (const [sig, name] of [['public.web_snapshot()', 'web_snapshot'], ['public.web_live()', 'web_live'], ['public.web_kalender(boolean)', 'web_kalender']]) {
  const def = (await one(`select pg_get_functiondef($1::regprocedure) d`, [sig])).d
  await db.exec(def.replace(`public.${name}(`, `public.alt_${name}(`))
}
await db.exec(`grant execute on function public.alt_web_snapshot(), public.alt_web_live(), public.alt_web_kalender(boolean) to anon;`)

// ── 2. Testdaten (echte Spiele) ─────────────────────────────────────────────
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;
               insert into sm_admins (email, rolle) values ('team@sva.de', 'team') on conflict do nothing;
               update sva_settings set adresse = 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg' where id = 1;
               insert into sm_sponsoren (name, aktiv, stufe, logo_url, website_url) values ('Autohaus Müller', true, 'hauptpartner', 'https://x/a.png', 'https://autohaus.example');`)
const spiel = async (gegner, heim, stundenOffset, tore) =>
  (await as('chef@sva.de', `insert into sm_spiele (gegner, heim, anstoss, wettbewerb, spieltag_nr, tore_sva, tore_gegner)
                            values ($1, $2, now() + make_interval(hours => $3), 'Kreisliga Stade', 5, $4, $5) returning id`,
    [gegner, heim, stundenOffset, tore?.[0] ?? null, tore?.[1] ?? null])).rows[0].id
const v1 = await spiel('TSV Apensen', true, -24 * 21, [2, 2])
const v2 = await spiel('VfL Güldenstern Stade III', false, -24 * 14, [0, 1])
const v3 = await spiel('FC Mulsum/Kutenholz II', true, -24 * 7, [3, 1])
const heute = await spiel('TuS Fischbek', true, 2) // in 2 h: nächstes Spiel
await spiel('SG Lühe', false, 24 * 6)
await spiel('Probe (TEST)', true, 24 * 2)
const kader = (await db.query(`select id, slug from sm_roster where rolle = 'spieler' and aktiv order by sortierung, name`)).rows
ok(kader.length >= 15, `echter Kader aus der Vereinspflege-Migration (${kader.length} Spieler)`)
const ids = kader.map((r) => r.id)
await as('chef@sva.de', `insert into sva_lineup (formation, startelf, bank, spiel_id, match_label, created_at) values ('4-4-2', $1::uuid[], $2::uuid[], $3, 'vs TuS Fischbek', now() - interval '1 hour')`,
  [ids.slice(0, 11), ids.slice(11, 15), heute])
const gal = (await as('chef@sva.de', `insert into sva_galerien (slug, titel, datum, spiel_id, veroeffentlicht) values ('mulsum', 'Gegen Mulsum', current_date - 7, $1, true) returning id`, [v3])).rows[0].id
await as('chef@sva.de', `insert into sva_galerie_bilder (galerie_id, pfad, titelbild) values ($1, 'galerien/mulsum/1.webp', true)`, [gal])

const oeffentlich = async (pre = '') => ({
  snap: (await asAnon(`select public.${pre}web_snapshot() j`)).rows[0].j,
  live: (await asAnon(`select public.${pre}web_live() j`)).rows[0].j,
  kalHeim: (await asAnon(`select public.${pre}web_kalender(false) j`)).rows[0].j,
  kalAlle: (await asAnon(`select public.${pre}web_kalender(true) j`)).rows[0].j,
})
const vergleicheAltNeu = async (zustand) => {
  const alt = await oeffentlich('alt_')
  const neu = await oeffentlich()
  for (const k of Object.keys(alt)) gleich(neu[k], alt[k], `[${zustand}] ${k}: neu = bisher (Feld für Feld, ${anzahlFelder(alt[k])} Zeichen JSON)`)
  return neu
}

// ── 3. Neue Migration (zweimal: idempotent) ─────────────────────────────────
const vorher = await oeffentlich('alt_')
await run(NEU)
await tabellenRechte()
await run(NEU)
await tabellenRechte()
for (const f of files.filter((f) => f > NEU)) await run(f)
const nachher = await oeffentlich()
for (const k of Object.keys(vorher)) gleich(nachher[k], vorher[k], `[vor/nach Migration] ${k} unverändert`)
ok(nachher.snap.nextMatch?.opponent === 'TuS Fischbek' && nachher.snap.form.length === 3 && nachher.snap.galerien[0]?.spiel, 'Testdaten greifen (nächstes Spiel, Form, Galerie mit Spiel)')
ok(nachher.live.match?.opponent === 'TuS Fischbek' && nachher.live.lineup?.forMatch, 'web_live: nächstes Spiel mit Aufstellung')

// ── 4. Rechte: wer darf ein Vorführ-Spiel starten? ──────────────────────────
await expectErr(asAnon(`select public.sva_demo_starten()`), 'anon darf kein Vorführ-Spiel starten', /permission denied/)
await expectErr(as('team@sva.de', `select public.sva_demo_starten()`), 'Team-Zugang darf kein Vorführ-Spiel starten', /nicht_erlaubt/)
await expectErr(as('fan@x.de', `select public.sva_demo_starten()`), 'beliebiges Login darf kein Vorführ-Spiel starten', /nicht_erlaubt/)
await expectErr(as('team@sva.de', `select public.sva_demo_beenden()`), 'Team darf nicht beenden', /nicht_erlaubt/)
await expectErr(as('team@sva.de', `select public.sva_demo_loeschen()`), 'Team darf nicht löschen', /nicht_erlaubt/)
await expectErr(as('chef@sva.de', `insert into sm_spiele (gegner, anstoss, demo) values ('Hinten rum', now(), true)`), 'Admin kann das Kennzeichen nicht direkt setzen (nur per Knopf)', /sva_demo_nur_per_knopf/)
await expectErr(as('chef@sva.de', `update sm_spiele set demo = true where id = $1`, [v3]), 'echtes Spiel lässt sich nicht verstecken', /sva_demo_unveraenderlich/)
await expectErr(as('chef@sva.de', `select public.sva_demo_beenden()`), 'Beenden ohne Vorführ-Spiel → klare Meldung', /sva_demo_fehlt/)
await expectErr(as('chef@sva.de', `select public.sva_demo_starten(repeat('x', 61))`), 'Gegnername begrenzt', /sva_demo_gegner/)
for (const fn of ['sva_live_daten(boolean)', 'sva_demo_starten(text,boolean,boolean)', 'sva_demo_beenden()', 'sva_demo_loeschen()']) {
  ok(!(await one(`select has_function_privilege('anon', 'public.${fn}', 'execute') p`)).p, `anon: kein Ausführungsrecht auf ${fn}`)
}
ok((await one(`select has_function_privilege('anon', 'public.web_live_demo()', 'execute') p`)).p, 'anon: web_live_demo() ausführbar (Vorführ-Pfad)')
ok(!(await one(`select has_function_privilege('authenticated', 'public.sva_live_daten(boolean)', 'execute') p`)).p, 'authenticated: sva_live_daten nicht direkt')

// ── 5. Admin startet: leerer Ticker, Anpfiff jetzt ──────────────────────────
const d0 = (await as('chef@sva.de', `select public.sva_demo_starten() j`)).rows[0].j
ok(d0.gegner === 'FC Vorführung' && d0.status === 'live', 'Standard: „FC Vorführung“, live ' + JSON.stringify(d0))
let demoLive = (await asAnon(`select public.web_live_demo() j`)).rows[0].j
ok(demoLive.match?.demo === true && demoLive.match.id === d0.id && demoLive.match.status === 'live' && demoLive.match.minute === 1, 'web_live_demo: Vorführ-Spiel live, 1. Minute, demo = true')
ok(demoLive.events.length === 1 && demoLive.events[0].type === 'anpfiff', 'Ticker enthält nur „Anpfiff“')
ok(demoLive.lineup && demoLive.lineup.forMatch === false && demoLive.lineup.startelf.length === 11, 'Aufstellung: aktuelle echte (nicht „für dieses Spiel“)')
ok(demoLive.settings.address?.startsWith('Waldsportplatz') && demoLive.previous?.opponent === 'FC Mulsum/Kutenholz II', 'Spielort + „Zuletzt“ (echtes Spiel) dabei')
gleich(await oeffentlich(), nachher, '[Vorführ-Spiel live] alle öffentlichen Ausgaben unverändert')
const altSiehtEs = (await asAnon(`select public.alt_web_live() j`)).rows[0].j
ok(altSiehtEs.match?.id === d0.id, 'Gegenprobe: die BISHERIGE web_live() hätte das Vorführ-Spiel öffentlich gezeigt')
ok((await asAnon(`select count(*)::int n from sm_spiele`)).rows[0].n === 0, 'anon liest sm_spiele direkt nicht (RLS)')
ok(!JSON.stringify((await asAnon(`select public.web_kalender(true) j`)).rows[0].j).includes('Vorführung'), 'Kalender-Abo (Edge Function liest web_kalender) ohne Vorführ-Spiel')

// ── 6. Neu starten = zurücksetzen (gleiche ID), mit Beispiel-Ereignissen ────
const d1 = (await as('chef@sva.de', `select public.sva_demo_starten('SC Schaukampf', true) j`)).rows[0].j
ok(d1.id === d0.id && d1.gegner === 'SC Schaukampf' && d1.toreSva === 1 && d1.toreGegner === 0, 'zurückgesetzt (gleiche ID), Gegner frei wählbar, 1:0 ' + JSON.stringify(d1))
ok((await one(`select count(*)::int n from sm_spiele where demo`)).n === 1, 'höchstens EIN Vorführ-Spiel')
await expectErr(db.query(`insert into sm_spiele (gegner, anstoss, demo) values ('Zweites', now(), true)`), 'zweites Vorführ-Spiel scheitert am Index (auch für Wartung)', /duplicate key|unique/)
demoLive = (await asAnon(`select public.web_live_demo() j`)).rows[0].j
const typen = demoLive.events.map((e) => e.type).reverse()
ok(JSON.stringify(typen) === JSON.stringify(['anpfiff', 'kommentar', 'tor', 'gelb', 'kommentar']), 'Beispiel-Ereignisse: Anpfiff, Chance, Tor, Gelb, Kommentar → ' + typen.join(','))
ok(demoLive.match.minute === 25 && demoLive.match.goalsFor === 1 && demoLive.match.goalsAgainst === 0, `laufende Minute passt (25.: ${demoLive.match.minute}), Stand 1:0`)
const tor = demoLive.events.find((e) => e.type === 'tor')
const gelb = demoLive.events.find((e) => e.type === 'gelb')
const slugs = new Set(kader.map((k) => k.slug))
ok(tor.player && tor.player2 && gelb.player && slugs.has(tor.player) && slugs.has(gelb.player) && new Set([tor.player, tor.player2, gelb.player]).size === 3,
  `echte Kader-Spieler (Tor ${tor.player}, Vorlage ${tor.player2}, Gelb ${gelb.player})`)
ok(demoLive.players.some((p) => p.id === tor.player), 'Spielerliste enthält den Torschützen')
gleich(await oeffentlich(), nachher, '[Vorführ-Spiel mit Ereignissen] öffentliche Ausgaben unverändert')

// Ticker-Pult: Team/Admin bedienen das Vorführ-Spiel ganz normal
await as('team@sva.de', `insert into sva_ticker (spiel_id, typ, minute, text) values ($1, 'gegentor', 26, 'Konter')`, [d0.id])
ok((await one(`select live_tore_gegner n from sm_spiele where id = $1`, [d0.id])).n === 1, 'Ticker-Pult: Gegentor am Vorführ-Spiel → 1:1')
await expectErr(as('team@sva.de', `update sm_spiele set demo = false where id = $1`, [d0.id]), 'Vorführ-Spiel lässt sich nicht „echt“ machen', /sva_demo_unveraenderlich|sva_team_nur_live_felder/)
await expectErr(as('chef@sva.de', `update sm_spiele set demo = false where id = $1`, [d0.id]), 'auch nicht vom Admin', /sva_demo_unveraenderlich/)

// Aufstellung, die (z. B. per API) am Vorführ-Spiel hängt, wird nirgends öffentlich
await as('chef@sva.de', `insert into sva_lineup (formation, startelf, bank, spiel_id) values ('4-3-3', $1::uuid[], '{}', $2)`, [ids.slice(4, 15), d0.id])
gleich(await oeffentlich(), nachher, '[Aufstellung am Vorführ-Spiel] öffentliche Aufstellung unverändert')
demoLive = (await asAnon(`select public.web_live_demo() j`)).rows[0].j
ok(demoLive.lineup.forMatch === true && demoLive.lineup.formation === '4-3-3', 'web_live_demo zeigt die Vorführ-Aufstellung')

// Album: keine Codes, keine Check-ins
await expectErr(as('chef@sva.de', `select public.album_admin_code($1)`, [d0.id]), 'Album: kein Check-in-Code für das Vorführ-Spiel', /album_demo_spiel/)
const fan = (await one(`insert into auth.users (email) values ('fan@x.de') returning id`)).id
await expectErr(db.query(`insert into sva_album_checkins (fan_user_id, spiel_id, saison) values ($1, $2, public.sva_album_saison())`, [fan, d0.id]), 'Album: kein Check-in am Vorführ-Spiel', /album_demo_spiel/)
ok((await as('chef@sva.de', `select public.album_admin_code($1) j`, [heute])).rows[0].j.token, 'Album: echtes Heimspiel bekommt weiterhin einen Code')

// ── 7. Beenden: Endstand nur in der Vorführung ──────────────────────────────
const e1 = (await as('chef@sva.de', `select public.sva_demo_beenden() j`)).rows[0].j
ok(e1.status === 'beendet' && e1.toreSva === 1 && e1.toreGegner === 1, 'Beenden → Abpfiff, Endstand 1:1 ' + JSON.stringify(e1))
demoLive = (await asAnon(`select public.web_live_demo() j`)).rows[0].j
ok(demoLive.match.status === 'beendet' && demoLive.events[0].type === 'abpfiff', 'web_live_demo: Endstand + Abpfiff im Ticker')
const nachEnde = await oeffentlich()
gleich(nachEnde, nachher, '[Vorführ-Spiel beendet] lastMatch/Form/Kalender unverändert')
ok(nachEnde.snap.lastMatch.opponent === 'FC Mulsum/Kutenholz II' && nachEnde.snap.form.join('') === 'UNW', 'Form/letztes Spiel ohne Vorführ-Ergebnis')
ok((await as('chef@sva.de', `select public.sva_demo_beenden() j`)).rows[0].j.status === 'beendet', 'zweimal Beenden schadet nicht')

// ── 8. Vor dem Anpfiff (Countdown) — darf nicht „nächstes Spiel“ werden ─────
const d2 = (await as('chef@sva.de', `select public.sva_demo_starten('FC Vorführung', true, false) j`)).rows[0].j
ok(d2.status === 'geplant' && new Date(d2.anstoss) > new Date(), 'ohne Anpfiff: geplant, Anstoß in der Zukunft (Beispiele ignoriert)')
ok((await one(`select count(*)::int n from sva_ticker where spiel_id = $1`, [d2.id])).n === 0, 'Ticker leer')
ok((await one(`select count(*)::int n from sva_lineup where spiel_id = $1`, [d2.id])).n === 0, 'Zurücksetzen entfernt die Vorführ-Aufstellung')
gleich(await oeffentlich(), nachher, '[Vorführ-Spiel geplant, Anstoß in 15 min] nextMatch/Live unverändert')

// ── 9. Löschen ──────────────────────────────────────────────────────────────
await as('chef@sva.de', `insert into sva_lineup (formation, startelf, bank, spiel_id) values ('4-3-3', $1::uuid[], '{}', $2)`, [ids.slice(4, 15), d0.id])
const l1 = (await as('chef@sva.de', `select public.sva_demo_loeschen() j`)).rows[0].j
ok(l1.geloescht === 1, 'Löschen: 1 Spiel')
ok((await one(`select count(*)::int n from sm_spiele where demo`)).n === 0 && (await one(`select count(*)::int n from sva_ticker where spiel_id = $1`, [d0.id])).n === 0, 'Spiel + Ticker weg')
ok((await one(`select count(*)::int n from sva_lineup where formation = '4-3-3'`)).n === 0, 'Vorführ-Aufstellung mit gelöscht (wird nicht zur „aktuellen“)')
const leer = (await asAnon(`select public.web_live_demo() j`)).rows[0].j
ok(leer.match === null && Array.isArray(leer.events) && leer.settings, 'web_live_demo ohne Vorführ-Spiel: match = null')
await vergleicheAltNeu('nach dem Löschen')
ok((await as('chef@sva.de', `select public.sva_demo_loeschen() j`)).rows[0].j.geloescht === 0, 'Löschen ohne Vorführ-Spiel schadet nicht')

// ── 10. Echtes Spiel live (alt = neu), Vorführung parallel ──────────────────
const ev = (typ, min, minutenHer, extra = {}) => as('team@sva.de',
  `insert into sva_ticker (spiel_id, typ, minute, roster_id, roster_id_2, zeitpunkt) values ($1, $2, $3, $4, $5, now() - make_interval(secs => $6))`,
  [heute, typ, min, extra.r1 ?? null, extra.r2 ?? null, minutenHer * 60])
await ev('anpfiff', 1, 30.5)
await ev('tor', 12, 19, { r1: ids[9], r2: ids[8] })
await ev('gelb', 20, 10, { r1: ids[3] })
const echtLive = await vergleicheAltNeu('echtes Spiel live')
ok(echtLive.live.match.id === heute && echtLive.live.match.status === 'live' && echtLive.live.match.minute === 31 && !('demo' in echtLive.live.match), 'web_live: echtes Spiel live (31.), ohne demo-Feld')
const d3 = (await as('chef@sva.de', `select public.sva_demo_starten('FC Vorführung', true) j`)).rows[0].j
gleich(await oeffentlich(), echtLive, '[echtes Spiel live + Vorführung live] öffentliche Ausgaben unverändert')
ok((await asAnon(`select public.web_live_demo() j`)).rows[0].j.match.id === d3.id, 'web_live_demo: parallel die Vorführung')
await as('chef@sva.de', `select public.sva_demo_loeschen()`)
await ev('halbzeit', 45, 0.1)
await vergleicheAltNeu('echtes Spiel Halbzeit')
await ev('wiederanpfiff', 46, 0.05)
await ev('abpfiff', 90, 0)
await vergleicheAltNeu('echtes Spiel beendet')

console.log(fails ? `\n${fails} FEHLER` : '\nalle Prüfungen bestanden')
process.exit(fails ? 1 : 0)
