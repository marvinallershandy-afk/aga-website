// PGlite-Test der Migration 20261012110000_sva_karten.sql, Teil „Ziele, Lose,
// Verlosungen, Pflege“: Standard-Ziele (Familien-Sets inkl. Trainerstab,
// Kapitel, Meilensteine, Serien, Sozial, extern/Tipp-Liga, geheime Mission),
// Auslösung idempotent, Lose-Vergabe, faire + protokollierte Verlosung,
// „Spieler des Spiels“-Wochenfenster, Story-Codes auf Vorrat.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/ziele.test.mjs <pg-ordner>/ && MIGRATIONS=<repo>/supabase/migrations/ node <pg-ordner>/ziele.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261012110000_sva_karten.sql'
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
for (const f of fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()) {
  if (f === NEU) await defaults()
  await run(f)
}
await defaults()
await run(NEU) // zweiter Lauf: idempotent
for (const f of fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort().filter((f) => f > NEU)) await run(f)

const claims = (uid, email) => JSON.stringify({ sub: uid, email, role: 'authenticated' })
const as = async (uid, email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(uid, email)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => {
  await db.exec(`set role anon;`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) }
}
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 100)) }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const count = async (sql, params) => (await one(sql, params)).n
const val = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const user = async (email) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, '{"app":"sva-album"}') returning id`, [email])).id
const CHEF = await user('chef@sva.de')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const fans = {}
const neuerFan = async (name, initial) => {
  const mail = name.toLowerCase() + '@fan.example'
  const id = await user(mail)
  const f = (sql, p) => as(id, mail, sql, p)
  await f(`select album_profil_speichern($1, $2, false, false, true)`, [name, initial])
  fans[name] = { id, f }
  return { id, f }
}
await db.exec(`insert into sm_sponsoren (name, aktiv) values ('Mr. Döner', true), ('Altstadtcafé', true)`)
await val(admin, `select album_admin_katalog_standard()`)
const karte = async (slug, variante = false) => (await one(`select k.id from sva_album_karten k join sm_roster r on r.id = k.roster_id where r.slug = $1 and k.variante = $2 and not k.limitiert`, [slug, variante])).id
const setze = (fanId, karteId, n = 1) => db.query(`insert into sva_album_besitz (fan_user_id, karte_id, anzahl) values ($1, $2, $3) on conflict (fan_user_id, karte_id) do update set anzahl = excluded.anzahl`, [fanId, karteId, n])
const festPack = async (fanId, karteId) => (await one(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 1, null, 'Test', null, $2) id`, [fanId, karteId])).id
const SAISON = '2026/27'

// ── Standard-Ziele ─────────────────────────────────────────────────────────
await expectErr(as((await neuerFan('Fremd', 'F')).id, 'fremd@fan.example', `select album_admin_ziele_standard()`), 'Fan legt keine Ziele an', /album_kein_admin/)
let r = await val(admin, `select album_admin_ziele_standard()`)
ok(r.angelegt === 30 && r.gesamt === 30, 'Standard-Ziele: 30 angelegt (v21: + Rote Familie) ' + JSON.stringify(r))
await db.exec(`update sva_album_ziele set titel = 'Die Pejas-Zwillinge' where schluessel = 'zwillinge'`)
r = await val(admin, `select album_admin_ziele_standard()`)
ok(r.angelegt === 0 && r.gesamt === 30 && (await one(`select titel from sva_album_ziele where schluessel = 'zwillinge'`)).titel === 'Die Pejas-Zwillinge', 'Zweimal → keine Doppelten, Admin-Titel bleibt')
const Z = Object.fromEntries((await db.query(`select schluessel, id, typ, vorlage, cardinality(coalesce(karten, '{}')) nk, cardinality(coalesce(roster_ids, '{}')) nr, belohnung_karten bk, belohnung_min_seltenheit bm, belohnung_lose bl, geheim, wiederholbar from sva_album_ziele`)).rows.map((z) => [z.schluessel, z]))
ok(Z.zwillinge.nr === 2 && Z.warkehr.nr === 2 && Z.vater_sohn.nr === 2 && Z.familie_sva.nr === 6 && Z.familie_sva.bk === 3 && Z.familie_sva.bm === 'gold'
  && ['zwillinge', 'warkehr', 'vater_sohn', 'familie_sva'].every((k) => Z[k].vorlage === 'familie'), 'Familien-Sets: Zwillinge, Warkehr-Brüder, Vater & Sohn (je 2), Familie SVA (6, 3 Karten mind. Gold), Vorlage „familie“')
ok(Z.meister_2026.nk === 4 && Z.meister_2026.bm === 'spezial' && Z.rueckennummern.nr === 9 && Z.die_kurve.nk === 3 && Z.partner_set.nk === 2, 'Sets: Meister 2026 (4, mind. Spezial), Rückennummern 1–11 (9), Kurve (3), Partner (2)')
ok(['tw', 'abw', 'mit', 'ang', 'stab', 'moment', 'fan', 'partner'].every((k) => Z['kapitel_' + k]?.typ === 'kapitel') && [10, 25, 50, 75, 100].every((m) => Z['meilenstein_' + m]?.typ === 'meilenstein') && Z.meilenstein_100.bl === 5,
  'Je Kapitel ein Ziel, Meilensteine 10/25/50/75/100 % (100 % = 5 Lose)')
ok(Z.dauerkarte.bm === 'gold' && Z.tipp_serie.typ === 'serie_tipp' && Z.tipp_exakt.wiederholbar && Z.tipp_exakt.bm === 'silber' && Z.tipp_spieltagssieg.bl === 2 && Z.tipp_spieltagssieg.bk === 0 && Z.nachteule.geheim,
  'Dauerkarte (mind. Gold), Tipp-Serie, extern wiederholbar (exakt mind. Silber, Spieltagssieg 2 Lose), geheime Mission')
const vsRoster = (await db.query(`select r.rolle from sva_album_ziele z, unnest(z.roster_ids) rid join sm_roster r on r.id = rid where z.schluessel = 'vater_sohn' order by r.rolle`)).rows.map((x) => x.rolle)
ok(JSON.stringify(vsRoster) === '["co-trainer","spieler"]', 'Vater & Sohn deckt Trainerstab + Spieler ab')
await expectErr(db.query(`insert into sva_album_ziele (schluessel, typ, titel, wiederholbar) values ('x_set', 'set', 'X Set', true)`), 'Nur externe Ziele dürfen wiederholbar sein')
await expectErr(db.query(`insert into sva_album_ziele (schluessel, typ, titel, vorlage) values ('x_set2', 'set', 'X Set', 'quatsch')`), 'Vorlage geprüft')

// ── album_mein: Ziele-Liste + nächstes Ziel ────────────────────────────────
const A = await neuerFan('Anna', 'A')
let mein = await val(A.f, `select album_mein()`)
ok(mein.ziele.length > 20 && !mein.ziele.some((z) => z.schluessel === 'nachteule') && mein.ziele.every((z) => 'fortschritt' in z && 'belohnung' in z && typeof z.geheim === 'boolean'), 'album_mein.ziele: Liste ohne geheime Mission, mit Fortschritt/Belohnung')
const offen = mein.ziele.filter((z) => z.typ !== 'extern' && !z.erreicht)
ok(offen.every((z, i) => i === 0 || (z.benoetigt - z.fortschritt) >= (offen[i - 1].benoetigt - offen[i - 1].fortschritt)) && mein.naechstesZiel?.schluessel === offen[0].schluessel,
  'Sortierung: nächstes erreichbares Ziel vorne, naechstesZiel = kleinster Rest (' + mein.naechstesZiel?.titel + ')')
ok(mein.ziele.findIndex((z) => z.typ === 'extern') > mein.ziele.findIndex((z) => z.schluessel === offen[offen.length - 1].schluessel), 'Externe (Tipp-)Ziele hinter den Sammelzielen')
ok(mein.ziele.find((z) => z.schluessel === 'vater_sohn')?.benoetigt === 2 && mein.ziele.find((z) => z.schluessel === 'meilenstein_10')?.benoetigt === 4, 'Fortschritt: Vater & Sohn 0/2, Meilenstein 10 % = 4 von 40 Plätzen')

// ── Sets: Zwillinge (Variante zählt nicht), Familie SVA ────────────────────
await setze(A.id, await karte('p-pejas-e'))
await setze(A.id, await karte('p-pejas-n', true))
let op = await val(A.f, `select album_pack_oeffnen($1)`, [await festPack(A.id, await karte('p-pils'))])
ok(!op.ziele.some((z) => z.schluessel === 'zwillinge'), 'Pejas-e Basis + Pejas-n nur als Silber-Glanz-Variante → „Zwillinge“ NICHT erreicht')
op = await val(A.f, `select album_pack_oeffnen($1)`, [await festPack(A.id, await karte('p-pejas-n'))])
const zw = op.ziele.find((z) => z.schluessel === 'zwillinge')
ok(!!zw?.packId, 'Beide Basis-Karten → „Zwillinge“ erreicht + Bonus-Pack')
const zwp = await one(`select * from sva_album_packs where id = $1`, [zw.packId])
ok(zwp.art === 'ziel' && zwp.quelle === Z.zwillinge.id + ':' + SAISON && zwp.karten.length === 1 && zwp.titel === 'Die Pejas-Zwillinge', 'Ziel-Pack: art ziel, quelle = Ziel-ID:Saison, 1 Karte, Titel')
op = await val(A.f, `select album_pack_oeffnen($1)`, [zw.packId])
ok(!op.ziele.some((z) => z.schluessel === 'zwillinge') && (await count(`select count(*)::int n from sva_album_ziel_erreicht where ziel_id = $1`, [Z.zwillinge.id])) === 1, 'Ziel nur einmal (idempotent)')
for (const s of ['p-warkehr-i', 'p-warkehr-a', 'p-ebeling-t']) await setze(A.id, await karte(s))
op = await val(A.f, `select album_pack_oeffnen($1)`, [await festPack(A.id, (await one(`select k.id from sva_album_karten k join sm_roster r on r.id = k.roster_id where r.slug = 's-ebeling-a'`)).id)])
const fam = op.ziele.find((z) => z.schluessel === 'familie_sva')
ok(op.ziele.some((z) => z.schluessel === 'vater_sohn') && op.ziele.some((z) => z.schluessel === 'warkehr') && !!fam?.packId, 'Trainerstab-Karte (Adolf) → „Vater & Sohn“, „Warkehr-Brüder“ und „Familie SVA“ erreicht')
const famp = await one(`select * from sva_album_packs where id = $1`, [fam.packId])
ok(famp.karten.length === 3 && famp.seltenheiten.some((s) => s === 'gold' || s === 'spezial'), 'Familie SVA: Pack mit 3 Karten, mind. eine Gold/Spezial ' + JSON.stringify(famp.seltenheiten))

// ── Kapitel über das Ziel-System, Meilenstein + Lose ───────────────────────
op = await val(A.f, `select album_pack_oeffnen($1)`, [await festPack(A.id, await karte('p-pils'))])
mein = await val(A.f, `select album_mein()`)
ok(mein.abzeichen.includes('TW'), 'Kapitel TW (Pils + T. Ebeling) komplett → Abzeichen TW')
const kz = await one(`select e.pack_id from sva_album_ziel_erreicht e where e.ziel_id = $1 and e.fan_user_id = $2`, [Z.kapitel_tw.id, A.id])
ok(!!kz?.pack_id && (await count(`select count(*)::int n from sva_album_packs where fan_user_id = $1 and art = 'kapitel'`, [A.id])) === 0, 'Kapitel-Bonus läuft über das Ziel (art ziel), kein doppeltes Kapitel-Pack')
const B = await neuerFan('Ben', 'B')
for (const s of ['p-huettry', 'p-sladek', 'p-kalwa']) await setze(B.id, await karte(s))
op = await val(B.f, `select album_pack_oeffnen($1)`, [await festPack(B.id, await karte('p-matthes'))])
const m10 = op.ziele.find((z) => z.schluessel === 'meilenstein_10')
ok(!!m10?.packId && m10.lose === 1, '4 von 40 Plätzen → Meilenstein 10 %: Pack + 1 Los')
ok((await count(`select count(*)::int n from sva_album_lose where fan_user_id = $1 and quelle = 'ziel'`, [B.id])) === 1 && (await val(B.f, `select album_mein()`)).lose === 1, 'Los gebucht (album_mein.lose = 1)')
const kapOp = op.kapitel
ok(Array.isArray(kapOp), 'Pack öffnen liefert kapitel-Liste')
// Kapitel per Ziel: packId im Pack-Ergebnis
const C = await neuerFan('Cem', 'C')
await setze(C.id, await karte('p-ebeling-t'))
op = await val(C.f, `select album_pack_oeffnen($1)`, [await festPack(C.id, await karte('p-pils'))])
ok(op.kapitel.length === 1 && op.kapitel[0].kapitel === 'TW' && !!op.kapitel[0].packId && (await one(`select art from sva_album_packs where id = $1`, [op.kapitel[0].packId])).art === 'ziel', 'album_pack_oeffnen.kapitel: Pack-ID des Kapitel-Ziels')

// ── Album komplett → 5 Lose ────────────────────────────────────────────────
const D = await neuerFan('Dana', 'D')
await db.query(`insert into sva_album_besitz (fan_user_id, karte_id) select $1, k.id from sva_album_karten k where k.typ = 'spieler' and not k.variante and not k.limitiert and k.roster_id <> (select id from sm_roster where slug = 'p-pils')`, [D.id])
op = await val(D.f, `select album_pack_oeffnen($1)`, [await festPack(D.id, await karte('p-pils'))])
ok(op.gutscheine.some((g) => g.stufe === 'komplett') && (await count(`select coalesce(sum(anzahl), 0)::int n from sva_album_lose where fan_user_id = $1 and quelle = 'komplett'`, [D.id])) === 5, 'Mannschaft komplett → Verlosungs-Los + 5 Lose (lose_komplett)')

// ── Serie: 3 Heimspiele in Folge („Dauerkarte“) ────────────────────────────
const spiel = async (gegner, minAbAnstoss) => {
  const id = (await one(`insert into sm_spiele (gegner, heim, anstoss, spieltag_nr) values ($1, true, now() - make_interval(mins => $2), 7) returning id`, [gegner, minAbAnstoss])).id
  return { id, token: (await val(admin, `select album_admin_code($1)`, [id])).token }
}
const S1 = await spiel('Serie Eins', 14 * 1440)
const S2 = await spiel('Serie Zwei', 7 * 1440)
const S3 = await spiel('Serie Drei', 10)
const E = await neuerFan('Emil', 'E')
const G = await neuerFan('Greta', 'G')
for (const s of [S1, S2]) await db.query(`insert into sva_album_checkins (fan_user_id, spiel_id, saison) values ($1, $2, $3)`, [E.id, s.id, SAISON])
await db.query(`insert into sva_album_checkins (fan_user_id, spiel_id, saison) values ($1, $2, $3)`, [G.id, S1.id, SAISON])
let ci = await val(E.f, `select album_checkin($1)`, [S3.token])
const dk = ci.ziele?.find((z) => z.schluessel === 'dauerkarte')
ok(!!dk?.packId, '3 Heimspiele in Folge eingecheckt → „Dauerkarte“')
const dkp = await one(`select * from sva_album_packs where id = $1`, [dk.packId])
ok(dkp.seltenheiten.some((s) => s === 'gold' || s === 'spezial'), 'Dauerkarte-Pack: mind. Gold ' + JSON.stringify(dkp.seltenheiten))
ci = await val(G.f, `select album_checkin($1)`, [S3.token])
ok(!ci.ziele?.some((z) => z.schluessel === 'dauerkarte'), 'Lücke (Spiel 2 verpasst) → keine Dauerkarte')
ok((await val(G.f, `select album_mein()`)).ziele.find((z) => z.schluessel === 'dauerkarte')?.fortschritt === 1, 'Fortschritt Serie nach Lücke = 1')
ok((await val(E.f, `select album_mein()`)).lose === 1, 'Check-in → 1 Los (lose_checkin)')

// ── Tipp-Serie (4 ISO-Wochen), externe Ziele über die Tipp-Liga ────────────
await db.exec(`create function public.tipp_test(p uuid) returns uuid language plpgsql security definer set search_path to 'public' as $$ begin return public.album_karte_gutschreiben('tipp', p); end $$;
  create function public.tipp_ziel_test(p_s text, p uuid) returns jsonb language plpgsql security definer set search_path to 'public' as $$ begin return public.album_ziel_ausloesen(p_s, p); end $$;
  revoke all on function public.tipp_test(uuid), public.tipp_ziel_test(text, uuid) from public;
  grant execute on function public.tipp_test(uuid), public.tipp_ziel_test(text, uuid) to authenticated;`)
const altTipp = (fanId, tage) => db.query(`insert into sva_album_packs (fan_user_id, art, karten, seltenheiten, saison, quelle, created_at, geoeffnet_at)
  values ($1, 'tipp', array[(select id from sva_album_karten limit 1)], array['bronze'], $2, 'tipp:alt' || $3::text, now() - make_interval(days => $3::int), now())`, [fanId, SAISON, tage])
for (const t of [7, 14, 21]) await altTipp(E.id, t)
for (const t of [7, 21]) await altTipp(G.id, t)
const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
ok(!!(await val(E.f, `select tipp_test($1)`, [uuid(1)])) && (await count(`select count(*)::int n from sva_album_ziel_erreicht where ziel_id = $1 and fan_user_id = $2`, [Z.tipp_serie.id, E.id])) === 1, '4 Wochen in Folge getippt → „Tipp-Serie“')
await val(G.f, `select tipp_test($1)`, [uuid(2)])
ok((await count(`select count(*)::int n from sva_album_ziel_erreicht where ziel_id = $1 and fan_user_id = $2`, [Z.tipp_serie.id, G.id])) === 0, 'Lücke in der Tipp-Serie → nicht erreicht')
await expectErr(E.f(`select album_ziel_ausloesen('tipp_exakt', $1)`, [uuid(3)]), 'Fan ruft album_ziel_ausloesen direkt → verweigert', /permission denied/)
r = await val(E.f, `select tipp_ziel_test('tipp_exakt', $1)`, [uuid(3)])
ok(r.erreicht === true && !!r.packId && r.lose === 0 && !('titel' in r), 'tipp_exakt (über SECURITY-DEFINER-RPC) → { erreicht, packId, lose }')
ok((await one(`select seltenheiten from sva_album_packs where id = $1`, [r.packId])).seltenheiten.every((s) => s !== 'bronze'), 'tipp_exakt: Karte mind. Silber')
ok((await val(E.f, `select tipp_ziel_test('tipp_exakt', $1)`, [uuid(3)])).erreicht === false, 'Gleicher Bezug → nicht nochmal (idempotent)')
ok((await val(E.f, `select tipp_ziel_test('tipp_exakt', $1)`, [uuid(4)])).erreicht === true, 'Wiederholbar: neuer Bezug → nochmal')
r = await val(E.f, `select tipp_ziel_test('tipp_spieltagssieg', $1)`, [uuid(5)])
ok(r.erreicht && r.packId === null && r.lose === 2, 'tipp_spieltagssieg → 2 Lose, kein Pack')
ok((await val(E.f, `select tipp_ziel_test('zwillinge', $1)`, [uuid(6)])).erreicht === false && (await val(E.f, `select tipp_ziel_test('gibtsnicht', $1)`, [uuid(6)])).erreicht === false, 'Nur Ziele vom Typ extern auslösbar')
ok((await val(fans.Fremd.f, `select tipp_ziel_test('nachteule', $1)`, [uuid(7)])).erreicht === true && (await val(fans.Fremd.f, `select tipp_ziel_test('nachteule', $1)`, [uuid(8)])).erreicht === false, 'Nicht wiederholbares externes Ziel: Bezug egal, nur einmal')
mein = await val(E.f, `select album_mein()`)
ok(mein.ziele.find((z) => z.schluessel === 'tipp_exakt')?.anzahlErreicht === 2 && mein.ziele.find((z) => z.schluessel === 'tipp_serie')?.erreicht === true, 'album_mein: wiederholbare Ziele mit anzahlErreicht, erreichte Ziele markiert')

// ── Geheime Mission „Nachteule“ (Flutlicht, Anstoß ab 19 Uhr) ──────────────
const NE = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('Flutlicht FC', true,
  (date_trunc('day', now() at time zone 'Europe/Berlin') - interval '1 day' + interval '19 hours 30 minutes') at time zone 'Europe/Berlin') returning id`)).id
const NET = (await val(admin, `select album_admin_code($1)`, [NE])).token
await db.exec(`insert into sva_ticker (spiel_id, typ, zeitpunkt) values ('${NE}', 'anpfiff', now() - interval '20 hours'), ('${NE}', 'abpfiff', now())`)
ok(!(await val(E.f, `select album_mein()`)).ziele.some((z) => z.schluessel === 'nachteule'), 'Geheime Mission vorher unsichtbar')
ci = await val(E.f, `select album_checkin($1)`, [NET])
ok(ci.ziele?.some((z) => z.schluessel === 'nachteule' && z.packId), 'Check-in beim Flutlichtspiel → „Nachteule“ erreicht')
ok((await val(E.f, `select album_mein()`)).ziele.find((z) => z.schluessel === 'nachteule')?.geheim === true, 'Nach Erreichen sichtbar (geheim: true)')

// ── Sozial: Freund geworben, erster Tausch ─────────────────────────────────
const codeE = (await val(E.f, `select album_mein()`)).freundCode
await val(G.f, `select album_freund_hinzufuegen($1)`, [codeE])
ok((await count(`select count(*)::int n from sva_album_ziel_erreicht where ziel_id = $1 and fan_user_id in ($2, $3)`, [Z.freund_geworben.id, E.id, G.id])) === 2, 'Freundescode eingelöst → „Freund geworben“ für beide')
await db.exec(`update sva_album_fans set created_at = now() - interval '30 days' where user_id in ('${E.id}', '${G.id}')`)
const KX = await karte('p-becker'); const KY = await karte('p-helck')
await setze(E.id, KX, 2); await setze(G.id, KY, 2)
const T = (await val(E.f, `select album_tausch_anbieten($1, $2)`, [KX, KY])).code
r = await val(G.f, `select album_tausch_annehmen($1)`, [T])
ok(r.ok && r.ziele.some((z) => z.schluessel === 'erster_tausch') && (await count(`select count(*)::int n from sva_album_ziel_erreicht where ziel_id = $1 and fan_user_id in ($2, $3)`, [Z.erster_tausch.id, E.id, G.id])) === 2, 'Erster erledigter Tausch → „Erster Tausch“ für beide')

// ── Admin: Ziel-Status ─────────────────────────────────────────────────────
await expectErr(E.f(`select album_admin_ziel_status()`), 'Fan liest keinen Ziel-Status', /album_kein_admin/)
r = await val(admin, `select album_admin_ziel_status($1)`, [Z.zwillinge.id])
ok(r.ziele.length === 1 && r.ziele[0].erreicht === 2 && JSON.stringify(r.erreicht.map((x) => x.name).sort()) === '["Anna A.","Dana D."]' && r.erreicht.every((x) => !!x.at),
  'Ziel-Status: wer hat „Zwillinge“ wann erreicht (Anna, Dana) ' + JSON.stringify(r.erreicht.map((x) => x.name)))
r = await val(admin, `select album_admin_ziel_status()`)
ok(r.ziele.length === 30 && r.erreicht.length > 5, 'Ziel-Status gesamt: alle Ziele mit Zählungen + letzte Erfolge')

// ── Katalog-Regeln: Lose + Teilnahmebedingungen ────────────────────────────
const kat = await val(asAnon, `select album_katalog()`)
ok(kat.regeln.loseCheckin === 1 && kat.regeln.loseKomplett === 5 && /kostenlos/.test(kat.regeln.teilnahmeText) && /ab 18/.test(kat.regeln.teilnahmeText) && /Rechtsweg/.test(kat.regeln.teilnahmeText) && /SV Agathenburg-Dollern/.test(kat.regeln.teilnahmeText),
  'Katalog-Regeln: loseCheckin, loseKomplett, Teilnahmebedingungen (kostenlos, ab 16/18, Rechtsweg, Veranstalter)')

// ── Verlosungen ────────────────────────────────────────────────────────────
const V_SAISON = '2030/31'
const P1 = await neuerFan('Paul', 'P')  // 1 Los
const P3 = await neuerFan('Pia', 'Q')   // 3 Lose
await db.query(`insert into sva_album_lose (fan_user_id, anzahl, quelle, bezug, saison, at) values ($1, 1, 'admin', 'v1', $3, now() - interval '2 days'), ($2, 3, 'admin', 'v3', $3, now())`, [P1.id, P3.id, V_SAISON])
const verlosung = async (titel) => val(admin, `insert into sva_album_verlosungen (titel, preis, saison) values ($1, 'Trikot', '${V_SAISON}') returning id`, [titel])
const V1 = await verlosung('Trikot-Verlosung')
ok((await one(`select status from sva_album_verlosungen where id = $1`, [V1])).status === 'offen', 'Admin legt Verlosung an (Status offen)')
const V0 = await val(admin, `insert into sva_album_verlosungen (titel) values ('Saison-Verlosung') returning id`)
ok((await one(`select saison from sva_album_verlosungen where id = $1`, [V0])).saison === SAISON, 'Ohne Saison → aktuelle Saison (Trigger)')
await expectErr(E.f(`select album_admin_verlosung_ziehen($1)`, [V1]), 'Fan zieht keine Verlosung', /album_kein_admin/)
r = await val(admin, `select album_admin_verlosung_ziehen($1, 'seed-42')`, [V1])
ok(r.teilnehmer.length === 2 && r.loseGesamt === 4 && r.seed === 'seed-42' && r.teilnehmer[r.gewinnerIndex].name === r.gewinner.name && JSON.stringify(r.teilnehmer.map((t) => t.name)) === '["Paul P.","Pia Q."]',
  'Ziehung: Teilnehmer (Rad-Reihenfolge) mit Losen, Gewinner, Seed ' + JSON.stringify(r.gewinner))
const v1 = await one(`select * from sva_album_verlosungen where id = $1`, [V1])
ok(v1.status === 'gezogen' && v1.seed === 'seed-42' && v1.lose_gesamt === 4 && v1.teilnehmer === 2 && v1.gewinner_name === r.gewinner.name
  && v1.protokoll.seed === 'seed-42' && v1.protokoll.gewinnerIndex === r.gewinnerIndex && v1.protokoll.liste.length === 2 && /SHA-256/.test(v1.protokoll.verfahren) && !!v1.protokoll.zeit,
  'Protokoll gespeichert (Zeit, Seed, Teilnehmer, Lose, Verfahren, Gewinner-Index)')
await expectErr(admin(`select album_admin_verlosung_ziehen($1)`, [V1]), 'Zweites Ziehen verweigert', /album_verlosung_schon_gezogen/)
await expectErr(admin(`update sva_album_verlosungen set gewinner_name = 'Schummel S.' where id = $1`, [V1]), 'Ergebnis lässt sich nicht direkt fälschen', /album_verlosung_ergebnis_gesperrt/)
ok((await admin(`update sva_album_verlosungen set preis = 'Signiertes Trikot' where id = $1 returning id`, [V1])).rows.length === 1, 'Preis-Text darf nachträglich geändert werden')
const V2 = await verlosung('Gleicher Seed')
const r2 = await val(admin, `select album_admin_verlosung_ziehen($1, 'seed-42')`, [V2])
ok(r2.gewinnerIndex === r.gewinnerIndex && r2.gewinner.name === r.gewinner.name && r2.losNummer === r.losNummer, 'Determinismus: gleicher Seed + gleiche Liste → gleicher Gewinner')
const V3 = await verlosung('Ohne Seed')
const r3 = await val(admin, `select album_admin_verlosung_ziehen($1)`, [V3])
ok(/^[0-9a-f]{32}$/.test(r3.seed), 'Ohne Seed → zufälliger Seed (protokolliert)')
// Fairness: Lose-Gewichtung über viele Seeds
let pia = 0
const N = 200
for (let i = 0; i < N; i++) {
  const v = await verlosung('Fair ' + i)
  if ((await val(admin, `select album_admin_verlosung_ziehen($1, $2)`, [v, 'fair-' + i])).gewinner.name === 'Pia Q.') pia++
}
ok(pia / N > 0.64 && pia / N < 0.86, `Fairness: Pia (3 von 4 Losen) gewinnt ${Math.round((pia / N) * 100)} % von ${N} Ziehungen (erwartet ~75 %)`)
const verteilung = (await db.query(`select sva_album_los_nummer('s' || g, 4) n, count(*)::int c from generate_series(1, 4000) g group by 1 order by 1`)).rows
ok(verteilung.length === 4 && verteilung.every((x) => x.c > 880 && x.c < 1120), 'Los-Nummer aus SHA-256 gleichverteilt über 4000 Seeds: ' + JSON.stringify(verteilung.map((x) => x.c)))
// Stichtag + Mindest-Lose
const V4 = await val(admin, `insert into sva_album_verlosungen (titel, saison, stichtag) values ('Stichtag', '${V_SAISON}', now() - interval '1 day') returning id`)
r = await val(admin, `select album_admin_verlosung_ziehen($1, 'x')`, [V4])
ok(r.teilnehmer.length === 1 && r.gewinner.name === 'Paul P.', 'Stichtag: später gebuchte Lose zählen nicht')
const V5 = await val(admin, `insert into sva_album_verlosungen (titel, saison, min_lose) values ('Mindestens 2', '${V_SAISON}', 2) returning id`)
r = await val(admin, `select album_admin_verlosung_ziehen($1, 'x')`, [V5])
ok(r.teilnehmer.length === 1 && r.gewinner.name === 'Pia Q.', 'min_lose 2: nur Fans mit mind. 2 Losen')
const V6 = await val(admin, `insert into sva_album_verlosungen (titel, saison) values ('Leer', '2031/32') returning id`)
await expectErr(admin(`select album_admin_verlosung_ziehen($1)`, [V6]), 'Keine Teilnehmer → Fehler', /album_verlosung_keine_teilnehmer/)
// album_mein.verlosungen
const gewinnerV1 = r.gewinner // (V5: Pia)
const meinPia = await val(P3.f, `select album_mein()`)
const eV5 = meinPia.verlosungen.find((x) => x.id === V5)
const eV0 = meinPia.verlosungen.find((x) => x.id === V0)
ok(eV5?.status === 'gezogen' && eV5.gewonnen === true && eV5.gewinnerName === 'Pia Q.' && eV5.teilnahme === true && gewinnerV1.name === 'Pia Q.', 'album_mein.verlosungen: gezogen, gewonnen, Gewinnername, Teilnahme')
ok(eV0?.status === 'offen' && eV0.teilnahme === false && eV0.gewonnen === false, 'Offene Saison-Verlosung: Pia hat in 2026/27 keine Lose → teilnahme false')
ok((await val(P1.f, `select album_mein()`)).verlosungen.find((x) => x.id === V5)?.gewonnen === false, 'Andere sehen gewonnen: false')

// ── „Spieler des Spiels“: Wochenfenster Mo–So (Europe/Berlin), idempotent ──
const P_MOTM = (await one(`select id from sm_roster where slug = 'p-jochim'`)).id
const SP = (await one(`insert into sm_spiele (gegner, heim, anstoss, spieltag_nr) values ('TuS Fischbek', true, now() - interval '1 day', 7) returning id`)).id
const motm = await val(admin, `select album_admin_motm($1, $2)`, [P_MOTM, SP])
const mk = await one(`select k.*, extract(isodow from k.ziehbar_von at time zone 'Europe/Berlin')::int dow, (k.ziehbar_von at time zone 'Europe/Berlin')::time::text t,
  (k.ziehbar_bis at time zone 'Europe/Berlin')::date - (k.ziehbar_von at time zone 'Europe/Berlin')::date tage from sva_album_karten k where id = $1`, [motm.id])
ok(motm.neu && mk.titel === 'Sam Luca Jochim' && mk.untertitel === 'MOTM · 7. Spieltag · TuS Fischbek' && mk.serie === 'Spieler des Spiels' && mk.limitiert && mk.seltenheit === 'spezial',
  'MOTM-Karte: Titel = Spielername, Untertitel „MOTM · 7. Spieltag · TuS Fischbek“')
ok(mk.dow === 1 && mk.t === '00:00:00' && mk.tage === 7 && mk.ziehbar_von <= new Date() && mk.ziehbar_bis > new Date(), 'Ziehbar Mo 00:00 bis So 23:59:59 der aktuellen Woche (Europe/Berlin)')
const motm2 = await val(admin, `select album_admin_motm($1, $2)`, [P_MOTM, SP])
ok(motm2.id === motm.id && motm2.neu === false, 'MOTM idempotent je (Spieler, Spiel)')
await db.exec(`update sva_album_einstellungen set gewicht_bronze = 0, gewicht_silber = 0, gewicht_gold = 0, gewicht_spezial = 1, smart_pack = false`)
const zieh = async () => { let n = 0; for (let i = 0; i < 12; i++) { const u = await user(`m${Math.random()}@x.example`); const p = (await one(`select sva_album_pack_ziehen($1, null, 'geschenk') id`, [u])).id; if ((await one(`select $1 = any (karten) b from sva_album_packs where id = $2`, [motm.id, p])).b) n++ } return n }
await db.exec(`update sva_album_karten set ziehbar_von = now() + interval '1 hour', ziehbar_bis = now() + interval '7 days' where id = '${motm.id}'`)
ok((await zieh()) === 0, 'Verfügbarkeit: vor dem Fenster nie gezogen')
await db.exec(`update sva_album_karten set ziehbar_von = now() - interval '1 hour', ziehbar_bis = now() + interval '7 days' where id = '${motm.id}'`)
ok((await zieh()) > 0, 'Verfügbarkeit: im Fenster gezogen')
await db.exec(`update sva_album_karten set ziehbar_von = now() - interval '8 days', ziehbar_bis = now() - interval '1 second' where id = '${motm.id}'`)
ok((await zieh()) === 0, 'Verfügbarkeit: nach dem Fenster nie gezogen')
await db.exec(`update sva_album_einstellungen set gewicht_bronze = 70, gewicht_silber = 22, gewicht_gold = 7, gewicht_spezial = 1, smart_pack = true`)

// ── Story-Codes auf Vorrat ─────────────────────────────────────────────────
await expectErr(E.f(`select album_admin_story_codes_massen('2026-10-10', 3, 'Story')`), 'Fan erzeugt keine Story-Codes', /album_kein_admin/)
await expectErr(admin(`select album_admin_story_codes_massen('2026-10-10', 0, 'Story')`), 'Anzahl Tage geprüft', /album_ungueltig:tage/)
const massen = await val(admin, `select album_admin_story_codes_massen('2026-10-10', 3, 'Story der Woche', 2)`)
ok(massen.length === 3 && new Set(massen.map((x) => x.code)).size === 3 && massen.map((x) => x.datum).join(',') === '2026-10-10,2026-10-11,2026-10-12', 'Massen: je Tag ein eigener Code')
ok(new Date(massen[0].gueltigVon).toISOString() === '2026-10-09T22:00:00.000Z' && new Date(massen[0].gueltigBis).toISOString() === '2026-10-10T22:00:00.000Z', 'Gültig genau an diesem Tag (00:00–24:00 Europe/Berlin)')
ok((await one(`select karten, art from sva_album_codes where code = $1`, [massen[0].code])).karten === 2, 'Kartenanzahl je Code übernommen')
ok((await val(E.f, `select album_code_einloesen($1)`, [massen[2].code])).grund === 'noch_nicht', 'Code für einen späteren Tag → noch nicht gültig')

// ── Konto löschen räumt Ziele + Lose, Verlosungs-Ergebnis bleibt ───────────
r = await val(P3.f, `select album_konto_loeschen()`)
const v5 = await one(`select gewinner_fan, gewinner_name, status from sva_album_verlosungen where id = $1`, [V5])
ok(r.ok && v5.gewinner_fan === null && v5.gewinner_name === 'Pia Q.' && v5.status === 'gezogen', 'Konto gelöscht: Gewinner-Verknüpfung weg, Protokoll-Name bleibt')
ok((await count(`select ((select count(*) from sva_album_lose where fan_user_id = $1) + (select count(*) from sva_album_ziel_erreicht where fan_user_id = $1))::int n`, [P3.id])) === 0, 'Lose + erreichte Ziele des Kontos gelöscht')
r = await val(A.f, `select album_konto_loeschen()`)
ok(r.ok && (await count(`select count(*)::int n from sva_album_ziel_erreicht where fan_user_id = $1`, [A.id])) === 0, 'Konto mit vielen erreichten Zielen gelöscht')

// ── Rechte ─────────────────────────────────────────────────────────────────
const priv = await one(`select
  has_function_privilege('authenticated', 'public.album_ziel_ausloesen(text,uuid)', 'execute') a,
  has_function_privilege('service_role', 'public.album_ziel_ausloesen(text,uuid)', 'execute') b,
  has_function_privilege('anon', 'public.album_admin_verlosung_ziehen(uuid,text)', 'execute') c,
  has_function_privilege('authenticated', 'public.sva_album_ziel_vergeben(uuid,uuid,text)', 'execute') d,
  has_function_privilege('authenticated', 'public.sva_album_los_nummer(text,integer)', 'execute') e`)
ok(!priv.a && priv.b && !priv.c && !priv.d && !priv.e, 'Rechte: Ziel-Auslösung nur service_role, Ziehung nicht anon, Interna gesperrt ' + JSON.stringify(priv))

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
