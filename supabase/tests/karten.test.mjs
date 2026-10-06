// PGlite-Test der Migration 20261012110000_sva_karten.sql (v20-K Sammelkarten):
// Standard-Katalog, Smart-Pack, Seltenheits-Verteilung, Starter, Heimsieg-Pack,
// Derby, limitierte Karten, Aktions-Codes (Story/Partner/Advent, Sperre),
// Freund-Bonus, Tausch, Wunschkarte, Kapitel, Belohnungen 3/6/8, Tipp-Liga-
// Schnittstelle, Missbrauch, Konto löschen. Ziele/Lose/Verlosungen: ziele.test.mjs.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/karten.test.mjs <pg-ordner>/ && MIGRATIONS=<repo>/supabase/migrations/ node <pg-ordner>/karten.test.mjs
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
// Supabase-Default-Privilegien nachbilden (Tabellen UND Funktionen für anon/authenticated)
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
for (const f of fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()) {
  if (f === NEU) await defaults()
  await run(f)
}
await defaults()
await run(NEU) // zweiter Lauf: idempotent + entzieht die Default-Rechte wieder
for (const f of fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort().filter((f) => f > NEU)) await run(f)
// v25-D: Diese Tests prüfen den statischen Check-in → Rotation (Standard an) hier aus.
await db.exec(`update public.sva_album_einstellungen set checkin_rotation = false where id = 1`).catch(() => {})

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

// ── Personen ────────────────────────────────────────────────────────────────
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const user = async (email) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, '{"app":"sva-album"}') returning id`, [email])).id
const CHEF = await user('chef@sva.de')
const F = {}
for (const [k, mail] of [['marvin', 'marvin@fan.example'], ['lena', 'lena@fan.example'], ['ole', 'ole@fan.example'], ['tom', 'tom@fan.example'], ['ohne', 'ohne@fan.example']]) F[k] = { id: await user(mail), mail }
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
const fan = (k) => (sql, p) => as(F[k].id, F[k].mail, sql, p)
const [marvin, lena, ole, tom, ohne] = ['marvin', 'lena', 'ole', 'tom', 'ohne'].map(fan)

// ── Einstellungen ──────────────────────────────────────────────────────────
ok((await count(`select count(*)::int n from sva_album_einstellungen`)) === 1, 'Einstellungen: genau 1 Zeile (nach 2 Läufen)')
const e0 = await one(`select * from sva_album_einstellungen`)
ok(e0.karten_starter === 5 && e0.starter_min_silber && e0.karten_heimsieg === 1 && e0.karten_tipp === 1 && e0.karten_story === 1
  && e0.karten_freund === 1 && e0.karten_kapitel === 1 && e0.smart_pack && !e0.smart_pack_belohnung && e0.doppelte_bremse === 25,
  'Standard: Starter 5 (mind. Silber), je 1 Karte für Heimsieg/Tipp/Story/Freund/Kapitel, Smart-Pack an, Bremse 25 %')
ok(e0.schwelle_1 === 3 && e0.schwelle_2 === 6 && e0.schwelle_3 === 8 && e0.belohnung_1 === 'Getränk nach Wahl'
  && e0.belohnung_3.startsWith('Los für die Saison-Verlosung') && e0.tausch_min_tage === 7 && e0.tausch_pro_woche === 5
  && e0.wunsch_kosten === 3 && e0.code_fehler_limit === 10 && e0.lose_checkin === 1 && e0.lose_komplett === 5,
  'Standard: Belohnungen 3/6/8, Tausch 7 Tage/5 pro Woche, Wunsch 3, Code-Sperre 10, Lose 1/5')
await expectErr(db.query(`update sva_album_einstellungen set schwelle_3 = 6`), 'Schwelle 3 muss über Schwelle 2 liegen')
await expectErr(db.query(`update sva_album_einstellungen set wunsch_kosten = 1`), 'Wunsch-Kosten mind. 2')
await expectErr(db.query(`update sva_album_einstellungen set karten_starter = 11`), 'Starter höchstens 10 Karten')

// ── Standard-Katalog ───────────────────────────────────────────────────────
await db.exec(`insert into sm_sponsoren (name, aktiv, logo_url, laufzeit_von) values
  ('Mr. Döner', true, 'https://x.supabase.co/storage/v1/object/public/sva_public/sponsoren/d.png', '2024-03-01'),
  ('Altstadtcafé', true, null, null), ('Alter Partner', false, null, null)`)
const DOENER = (await one(`select id from sm_sponsoren where name = 'Mr. Döner'`)).id
await expectErr(marvin(`select album_admin_katalog_standard()`), 'Fan darf den Standard-Katalog nicht anlegen', /album_kein_admin/)
let r = await val(admin, `select album_admin_katalog_standard()`)
ok(r.spielerBasis === 24 && r.varianten === 24 && r.trainer === 3 && r.momente === 8 && r.kurve === 3 && r.partner === 2 && r.albumPlaetze === 40,
  'Standard-Katalog: 24 Basis + 24 Silber-Glanz + 3 Trainerstab + 8 Momente + 3 Kurve + 2 Partner = 40 Album-Plätze ' + JSON.stringify(r))
r = await val(admin, `select album_admin_katalog_standard()`)
ok(r.spielerBasis === 0 && r.varianten === 0 && r.trainer === 0 && r.momente === 0 && r.kurve === 0 && r.partner === 0 && r.albumPlaetze === 40, 'Standard-Katalog zweimal → keine Doppelten')
const kap = await one(`select k.seltenheit, k.untertitel from sva_album_karten k join sm_roster r on r.id = k.roster_id where r.kapitaen and not k.variante`)
ok(kap.seltenheit === 'gold' && kap.untertitel === 'Kapitän', 'Kapitän: Basis-Karte Gold')
ok((await count(`select count(*)::int n from sva_album_karten k join sm_roster r on r.id = k.roster_id where not r.kapitaen and r.rolle = 'spieler' and not k.variante and k.seltenheit = 'bronze'`)) === 23, 'Übrige Spieler: Basis Bronze (Seltenheit bewertet keinen Spieler)')
ok((await count(`select count(*)::int n from sva_album_karten where typ = 'trainer' and seltenheit = 'gold'`)) === 3, 'Trainerstab: Basis Gold')
ok((await count(`select count(*)::int n from sva_album_karten where variante and seltenheit = 'silber' and untertitel = 'Silber-Glanz'`)) === 24, 'Silber-Glanz-Variante je Spieler')
await expectErr(db.query(`insert into sva_album_karten (typ, roster_id, titel, seltenheit, variante, saison)
  select 'spieler', roster_id, 'Doppelt', 'silber', true, saison from sva_album_karten where variante limit 1`), 'Zweite Silber-Glanz-Variante desselben Spielers → Unique-Index')
await expectErr(db.query(`update sva_album_karten set bild_fokus = 'oben' where typ = 'moment'`), 'Bildfokus geprüft (Format „50% 40%“)')
await expectErr(db.query(`update sva_album_karten set rueckseite = repeat('x', 401) where typ = 'moment'`), 'Rückseite höchstens 400 Zeichen')

// Tore/Vorlagen aus dem Ticker (Saison)
const P_TOR = (await one(`select id from sm_roster where slug = 'p-viedts'`)).id
const P_VOR = (await one(`select id from sm_roster where slug = 'p-helck'`)).id
const ALT = (await one(`insert into sm_spiele (gegner, heim, anstoss, tore_sva, tore_gegner) values ('TSV Altspiel', true, now() - interval '3 days', 2, 0) returning id`)).id
await db.exec(`insert into sva_ticker (spiel_id, typ, roster_id, roster_id_2, zeitpunkt) values
  ('${ALT}', 'tor', '${P_TOR}', '${P_VOR}', now() - interval '3 days'), ('${ALT}', 'tor', '${P_TOR}', null, now() - interval '3 days')`)

let kat = await val(asAnon, `select album_katalog()`)
ok(kat.karten.length === 64, 'anon: Katalog 64 Karten (40 Album + 24 Varianten) → ' + kat.karten.length)
const kViedts = kat.karten.find((k) => k.spieler?.slug === 'p-viedts' && !k.variante)
ok(kViedts?.spieler.tore === 2 && kat.karten.find((k) => k.spieler?.slug === 'p-helck' && !k.variante)?.spieler.vorlagen === 1 && kViedts.kapitel === 'ANG', 'Katalog: Tore/Vorlagen der Saison aus dem Ticker, Kapitel ANG')
const kMeister = kat.karten.find((k) => k.titel === 'Die Meister-Elf')
ok(kMeister?.seltenheit === 'spezial' && kMeister.serie === 'Meister 2026' && kMeister.credit === 'picture by Nele' && kMeister.bildFokus === '50% 50%' && kMeister.bildUrl === '/album/karten/meister-elf.webp' && kMeister.kapitel === 'moment', 'Katalog: Moment mit Serie, Credit, Bild, Bildfokus')
// v21-A: jede Kurve-Karte mit echtem Foto, „Das Urknall-Banner“ statt „Dodos Raum“
ok(kat.karten.filter((k) => k.typ === 'fan').length === 3 && kat.karten.filter((k) => k.typ === 'fan').every((k) => k.bildUrl?.startsWith('/album/karten/') && k.credit === 'picture by Nele')
  && kat.karten.find((k) => k.titel === 'Das Urknall-Banner')?.kapitel === 'fan' && !kat.karten.some((k) => k.titel === 'Dodos Raum'), 'Kurve: alle 3 Karten mit Foto + Credit, „Das Urknall-Banner“ statt „Dodos Raum“')
const kDoener = kat.karten.find((k) => k.typ === 'partner' && k.partner?.name === 'Mr. Döner')
ok(kDoener?.partner.seit === 2024 && kDoener.seltenheit === 'bronze' && !kat.karten.some((k) => k.titel === 'Alter Partner'), 'Partnerkarte (Bronze) mit „seit 2024“, inaktiver Sponsor ohne Karte')
ok(kat.karten.every((k) => typeof k.variante === 'boolean' && typeof k.limitiert === 'boolean' && typeof k.derby === 'boolean'), 'Katalog: variante/limitiert/derby je Karte')
ok(kat.regeln.kartenStarter === 5 && kat.regeln.kartenHeimsieg === 1 && kat.regeln.kartenTipp === 1 && kat.regeln.kartenStory === 1 && kat.regeln.kartenFreund === 1
  && kat.regeln.kartenKapitel === 1 && kat.regeln.tauschMinTage === 7 && kat.regeln.tauschProWoche === 5 && kat.regeln.wunschKosten === 3 && kat.regeln.smartPack === true,
  'Katalog-Regeln: Packgrößen, Tausch, Wunschkarte, Smart-Pack')
ok(kat.regeln.belohnungen.length === 4 && kat.regeln.belohnungen[2].stufe === 'schwelle_3' && kat.regeln.belohnungen[2].checkins === 8 && kat.regeln.belohnungen[0].titel === 'Getränk nach Wahl', 'Katalog-Regeln: Belohnungen 3/6/8 + komplett')
const katJson = JSON.stringify(kat)
ok(!katJson.includes('roster_id') && !katJson.includes('sponsor_id') && !katJson.includes('nur_spiel') && !katJson.includes(P_TOR) && !katJson.includes(DOENER), 'Katalog: keine internen Felder/IDs (roster, sponsor, nur_spiel)')

// ── Profile ────────────────────────────────────────────────────────────────
await marvin(`select album_profil_speichern('Marvin', 'A', true, true, true)`)
await lena(`select album_profil_speichern('Lena', 'B', true, false, true)`)
await ole(`select album_profil_speichern('Ole', 'K', false, false, true)`)
await tom(`select album_profil_speichern('Tom', 'S', false, false, true)`)
let mein = await val(marvin, `select album_mein()`)
ok(/^[A-HJ-NP-Z2-9]{6}$/.test(mein.freundCode) && mein.starterOffen === true && mein.kontoTage === 0 && mein.advent === null && Array.isArray(mein.tausche) && mein.tauscheWoche === 0,
  'album_mein: Freundescode (6 Zeichen), starterOffen, kontoTage, advent = null im Oktober ' + mein.freundCode)
ok((await val(marvin, `select album_freund_code()`)).code === mein.freundCode, 'album_freund_code() liefert denselben Code')

// ── Starter-Pack ───────────────────────────────────────────────────────────
ok((await val(ohne, `select album_starter_holen()`)).packId === null, 'Starter ohne Profil → packId null')
const st1 = (await val(marvin, `select album_starter_holen()`)).packId
const stp = await one(`select * from sva_album_packs where id = $1`, [st1])
ok(stp.art === 'starter' && stp.karten.length === 5 && stp.seltenheiten.some((s) => s !== 'bronze') && stp.titel === 'Starter-Pack', 'Starter: 5 Karten, mind. 1 Silber oder besser ' + JSON.stringify(stp.seltenheiten))
ok((await val(marvin, `select album_starter_holen()`)).packId === null && (await val(marvin, `select album_mein()`)).starterOffen === false, 'Starter nur einmal (zweiter Aufruf → null)')
// Mindest-Silber statistisch: 60 Starter-Packs (Superuser, Hilfskonten)
await db.exec(`do $$ declare u uuid; begin for i in 1..60 loop
  insert into auth.users (email) values ('st' || i || '@x.example') returning id into u;
  insert into sva_album_fans (user_id, vorname, initial, einwilligung_at) values (u, 'Test', 'T', now());
  perform sva_album_pack_ziehen(u, null, 'starter'); end loop; end $$;`)
ok((await count(`select count(*)::int n from sva_album_packs p where art = 'starter' and cardinality(karten) = 5
  and not exists (select 1 from unnest(seltenheiten) s where s <> 'bronze')`)) === 0, 'Starter: in 60 Packs immer mind. eine Silber-/Gold-/Spezial-Karte')
ok((await count(`select count(*)::int n from sva_album_packs p join sva_album_karten k on k.id = p.karten[1]
  where p.art = 'starter' and (k.variante or k.limitiert)`)) === 0, 'Starter: erste Karte immer eine Album-Karte (Smart-Pack)')

// ── Smart-Pack: erste Karte immer neu, bis das Album voll ist ──────────────
await db.exec(`update sva_album_einstellungen set karten_kapitel = 0`)
const SMART = { id: await user('smart@fan.example'), mail: 'smart@fan.example' }
const smartFan = (sql, p) => as(SMART.id, SMART.mail, sql, p)
await smartFan(`select album_profil_speichern('Smart', 'S', false, false, true)`)
let packs = 0; let immerNeu = true; let voll = false
while (packs < 60) {
  const frei = await count(`select count(*)::int n from sva_album_plaetze($1) where not belegt`, [SMART.id])
  if (frei === 0) { voll = true; break }
  const pid = (await one(`select sva_album_pack_ziehen($1, null, 'geschenk') id`, [SMART.id])).id
  const erste = await one(`select sva_album_platz(k.typ, k.roster_id, k.id) p, k.variante, k.limitiert from sva_album_packs pk join sva_album_karten k on k.id = pk.karten[1] where pk.id = $1`, [pid])
  const belegt = await count(`select count(*)::int n from sva_album_plaetze($1) where belegt and platz = $2`, [SMART.id, erste.p])
  if (erste.variante || erste.limitiert || belegt > 0) immerNeu = false
  await smartFan(`select album_pack_oeffnen($1)`, [pid])
  packs++
}
ok(voll && immerNeu && packs <= 40, `Smart-Pack: erste Karte jedes Packs war eine fehlende Album-Karte, Album nach ${packs} Packs (≤ 40 Plätze) voll`)
const nachVoll = (await one(`select sva_album_pack_ziehen($1, null, 'geschenk') id`, [SMART.id])).id
ok(!!nachVoll, 'Album voll → Packs werden weiter normal gezogen')
await db.exec(`update sva_album_einstellungen set smart_pack = false`)
const DUMM = await user('dumm@fan.example')
let ohneSmart = 0
for (let i = 0; i < 30; i++) {
  const pid = (await one(`select sva_album_pack_ziehen($1, null, 'geschenk') id`, [DUMM])).id
  if ((await one(`select k.variante from sva_album_packs p join sva_album_karten k on k.id = p.karten[1] where p.id = $1`, [pid])).variante) ohneSmart++
}
ok(ohneSmart > 0, `Smart-Pack aus → erste Karte auch mal eine Variante (${ohneSmart}/30)`)
await db.exec(`update sva_album_einstellungen set smart_pack = true`)

// ── Seltenheits-Verteilung mit Smart-Pack (≥ 4000 Karten) ──────────────────
const vert = async (fanId) => Object.fromEntries((await db.query(`select s, count(*)::int n from sva_album_packs, unnest(seltenheiten) s where fan_user_id = $1 group by s`, [fanId])).rows.map((x) => [x.s, x.n]))
const fmt = (v, n) => JSON.stringify(Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round((x / n) * 1000) / 10])))
const imBereich = (v, n) => v.bronze / n > 0.65 && v.bronze / n < 0.75 && v.silber / n > 0.18 && v.silber / n < 0.26 && v.gold / n > 0.045 && v.gold / n < 0.1 && v.spezial / n > 0.002 && v.spezial / n < 0.025
await db.exec(`update sva_album_einstellungen set karten_pro_pack = 5`)
const DIST1 = await user('dist1@test.example')
await db.exec(`do $$ begin for i in 1..800 loop perform sva_album_pack_ziehen('${DIST1}', null, 'geschenk'); end loop; end $$;`)
let v = await vert(DIST1)
ok(imBereich(v, 4000), 'Verteilung 4000 Karten (Packs ungeöffnet, Smart an): ' + fmt(v, 4000))
// Packs werden sofort geöffnet → Smart-Pack greift, bis das Album voll ist
const DIST2 = await user('dist2@test.example')
await db.exec(`do $$ declare p uuid; k uuid; begin for i in 1..800 loop
  p := sva_album_pack_ziehen('${DIST2}', null, 'geschenk');
  foreach k in array (select karten from sva_album_packs where id = p) loop
    insert into sva_album_besitz (fan_user_id, karte_id) values ('${DIST2}', k)
    on conflict (fan_user_id, karte_id) do update set anzahl = sva_album_besitz.anzahl + 1;
  end loop;
  update sva_album_packs set geoeffnet_at = now() where id = p; end loop; end $$;`)
v = await vert(DIST2)
ok(imBereich(v, 4000), 'Verteilung 4000 Karten (Packs sofort geöffnet, Smart greift): ' + fmt(v, 4000))
ok((await count(`select count(*)::int n from sva_album_plaetze($1) where not belegt`, [DIST2])) === 0, 'Nach 800 Packs alle Album-Plätze belegt')
await db.exec(`update sva_album_einstellungen set karten_pro_pack = 3`)

// ── Spiele, Check-in, Heimsieg-Pack ────────────────────────────────────────
let nr = 0
const heimspiel = async (gegner, minAbAnstoss = 10, extra = {}) => {
  const id = (await one(`insert into sm_spiele (gegner, heim, anstoss, spieltag_nr) values ($1, true, now() - make_interval(mins => $2), $3) returning id`, [gegner, minAbAnstoss, extra.spieltag ?? ++nr])).id
  const token = (await val(admin, `select album_admin_code($1)`, [id])).token
  return { id, token }
}
const G1 = await heimspiel('TuS Fischbek')
let ci = await val(marvin, `select album_checkin($1)`, [G1.token])
ok(ci.ok && ci.packId && !ci.freundPackId && Array.isArray(ci.freunde) && ci.freunde.length === 0, 'Check-in ohne Freunde: kein Freund-Pack')
ok((await one(`select cardinality(karten) n from sva_album_packs where id = $1`, [ci.packId])).n === 3, 'Check-in-Pack: 3 Karten')
await db.exec(`update sm_spiele set tore_sva = 2, tore_gegner = 0 where id = '${G1.id}'`)
const hs = await one(`select * from sva_album_packs where spiel_id = $1 and art = 'heimsieg' and fan_user_id = $2`, [G1.id, F.marvin.id])
ok(hs && hs.karten.length === 1 && hs.titel === 'Heimsieg-Bonus', 'Heimsieg → Bonus-Pack mit 1 Karte (karten_heimsieg)')
await db.exec(`update sva_album_einstellungen set karten_heimsieg = 0`)
ci = await val(ole, `select album_checkin($1)`, [G1.token])
ok(ci.ok && !ci.bonusPackId, 'karten_heimsieg = 0 → kein Heimsieg-Pack')
await db.exec(`update sva_album_einstellungen set karten_heimsieg = 1`)

// ── Derby-Karte nur im passenden Spiel ─────────────────────────────────────
const DERBY = await heimspiel('VfL Derby', 5)
const DK = (await one(`insert into sva_album_karten (typ, titel, seltenheit, limitiert, nur_spiel_id, saison) values ('moment', 'Derby-Sieger', 'spezial', true, $1, '2026/27') returning id`, [DERBY.id])).id
await db.exec(`update sva_album_einstellungen set gewicht_bronze = 0, gewicht_silber = 0, gewicht_gold = 0, gewicht_spezial = 1, smart_pack = false`)
const DT = []
for (let i = 0; i < 12; i++) DT.push(await user(`derby${i}@x.example`))
for (const u of DT) {
  await db.query(`select sva_album_pack_ziehen($1, $2, 'checkin')`, [u, DERBY.id])
  await db.query(`select sva_album_pack_ziehen($1, $2, 'checkin')`, [u, G1.id])
  await db.query(`select sva_album_pack_ziehen($1, null, 'geschenk')`, [u])
}
const mitDerby = await count(`select count(*)::int n from sva_album_packs where $1 = any (karten) and spiel_id = $2`, [DK, DERBY.id])
const fremd = await count(`select count(*)::int n from sva_album_packs where $1 = any (karten) and spiel_id is distinct from $2`, [DK, DERBY.id])
ok(mitDerby > 0 && fremd === 0, `Derby-Karte nur in Packs des Derby-Spiels (${mitDerby} Packs) — nie in anderen Spielen/Geschenken`)
kat = await val(asAnon, `select album_katalog()`)
const kDerby = kat.karten.find((k) => k.id === DK)
ok(kDerby?.derby === true && kDerby.limitiert === true && kDerby.derbySpiel?.gegner === 'VfL Derby', 'Katalog: Derby-Karte mit Spiel (ohne interne ID)')

// ── Limitierte Karten: nur im Fenster ziehbar ──────────────────────────────
const P_MOTM = (await one(`select id from sm_roster where slug = 'p-jochim'`)).id
await expectErr(marvin(`select album_admin_motm($1)`, [P_MOTM]), 'Fan erzeugt keine Spieler-des-Spiels-Karte', /album_kein_admin/)
const motm = await val(admin, `select album_admin_motm($1, null, null, 7)`, [P_MOTM])
ok(motm.neu && !!motm.id, 'Spieler des Spiels: limitierte Spezialkarte angelegt')
const MK = motm.id
const mk = await one(`select * from sva_album_karten where id = $1`, [MK])
ok(mk.limitiert && mk.seltenheit === 'spezial' && mk.serie === 'Spieler des Spiels' && mk.typ === 'spieler', 'MOTM-Karte: typ spieler, spezial, limitiert, Serie')
const WK = (await one(`insert into sva_album_karten (typ, titel, seltenheit, limitiert, saison) values ('moment', 'Weihnachtskarte', 'spezial', true, '2026/27') returning id`)).id
const zieheSpezial = async (n) => { const ids = []; for (let i = 0; i < n; i++) { const u = await user(`lim${Math.random()}@x.example`); ids.push((await one(`select sva_album_pack_ziehen($1, null, 'geschenk') id`, [u])).id) } return ids }
await db.exec(`update sva_album_karten set ziehbar_von = now() - interval '10 days', ziehbar_bis = now() - interval '3 days' where id = '${MK}'`)
let ids = await zieheSpezial(10)
ok((await count(`select count(*)::int n from sva_album_packs where id = any ($1) and $2 = any (karten)`, [ids, MK])) === 0, 'Limitierte Karte NACH dem Fenster: nie gezogen (30 Spezial-Ziehungen)')
await db.exec(`update sva_album_karten set ziehbar_von = now() + interval '1 day', ziehbar_bis = now() + interval '8 days' where id = '${MK}'`)
ids = await zieheSpezial(10)
ok((await count(`select count(*)::int n from sva_album_packs where id = any ($1) and $2 = any (karten)`, [ids, MK])) === 0, 'Limitierte Karte VOR dem Fenster: nie gezogen')
await db.exec(`update sva_album_karten set ziehbar_von = now() - interval '1 day', ziehbar_bis = now() + interval '6 days' where id = '${MK}'`)
ids = await zieheSpezial(10)
ok((await count(`select count(*)::int n from sva_album_packs where id = any ($1) and $2 = any (karten)`, [ids, MK])) > 0, 'Limitierte Karte IM Fenster: wird gezogen')
ok((await count(`select count(*)::int n from sva_album_packs where $1 = any (karten)`, [WK])) === 0, 'Weihnachtskarte (limitiert, ohne Fenster) wird nie zufällig gezogen')
await db.exec(`update sva_album_einstellungen set gewicht_bronze = 70, gewicht_silber = 22, gewicht_gold = 7, gewicht_spezial = 1, smart_pack = true`)
ok((await count(`select count(*)::int n from sva_album_plaetze($1)`, [F.marvin.id])) === 40, 'Limitierte Karten (MOTM, Derby, Weihnachten) zählen nicht als Album-Platz')

// ── Aktions-Codes ──────────────────────────────────────────────────────────
await expectErr(marvin(`select album_admin_story_code('story', 'Story Mo')`), 'Fan legt keine Codes an', /album_kein_admin/)
const sc = await val(admin, `select album_admin_story_code('story', 'Story vom Montag')`)
ok(/^STORY-[A-HJ-NP-Z2-9]{5}$/.test(sc.code) && Math.abs(new Date(sc.gueltigBis) - Date.now() - 864e5) < 6e4, 'Story-Code: automatisch, 24 h gültig ' + sc.code)
r = await val(marvin, `select album_code_einloesen($1)`, [' ' + sc.code.toLowerCase() + ' '])
ok(r.ok && r.packId && r.art === 'story' && r.titel === 'Story vom Montag', 'Story-Code einlösen (Kleinbuchstaben/Leerzeichen egal) → Pack')
const scp = await one(`select * from sva_album_packs where id = $1`, [r.packId])
ok(scp.art === 'story' && scp.karten.length === 1 && scp.quelle === sc.id, 'Story-Pack: 1 Karte, Quelle = Code-ID')
ok((await val(marvin, `select album_code_einloesen($1)`, [sc.code])).grund === 'schon', 'Gleicher Code zweimal → „schon“')
ok((await val(lena, `select album_code_einloesen($1)`, [sc.code])).ok === true, 'Anderes Konto darf denselben Code einlösen')
ok((await val(ohne, `select album_code_einloesen($1)`, [sc.code])).grund === 'kein_profil', 'Ohne Profil → „kein_profil“')
const sc2 = await val(admin, `select album_admin_story_code('story', 'Alte Story')`)
await db.exec(`update sva_album_codes set gueltig_von = now() - interval '2 days', gueltig_bis = now() - interval '1 day' where id = '${sc2.id}'`)
ok((await val(marvin, `select album_code_einloesen($1)`, [sc2.code])).grund === 'abgelaufen', 'Code nach 24 h → „abgelaufen“')
const sc3 = await val(admin, `select album_admin_story_code('story', 'Morgen', null, null, 24, 'MORGEN-1')`)
await db.exec(`update sva_album_codes set gueltig_von = now() + interval '1 day', gueltig_bis = now() + interval '2 days' where id = '${sc3.id}'`)
ok(sc3.code === 'MORGEN-1' && (await val(marvin, `select album_code_einloesen('MORGEN-1')`)).grund === 'noch_nicht', 'Eigener Code, noch nicht gültig → „noch_nicht“')
await expectErr(admin(`select album_admin_story_code('story', 'Doppelt', null, null, 24, 'morgen-1')`), 'Code-Name doppelt → vergeben', /album_code_vergeben/)
await expectErr(admin(`select album_admin_story_code('story', 'Böse', null, null, 24, 'A<B')`), 'Code-Format geprüft', /album_ungueltig:code/)
// Partner-Code liefert gezielt die Partnerkarte
const pc = await val(admin, `select album_admin_story_code('partner', 'Mr. Döner Laden', $1, 1, 720)`, [kDoener.id])
r = await val(tom, `select album_code_einloesen($1)`, [pc.code])
const pcp = await one(`select * from sva_album_packs where id = $1`, [r.packId])
ok(r.ok && r.art === 'partner' && pcp.karten.length === 1 && pcp.karten[0] === kDoener.id, 'Partner-Code im Laden → genau die Partnerkarte')
// max_einloesungen
const mx = await val(admin, `select album_admin_story_code('story', 'Nur einer')`)
await db.exec(`update sva_album_codes set max_einloesungen = 1 where id = '${mx.id}'`)
await val(marvin, `select album_code_einloesen($1)`, [mx.code])
ok((await val(lena, `select album_code_einloesen($1)`, [mx.code])).grund === 'abgelaufen', 'max. Einlösungen erreicht → „abgelaufen“')
// Rate-Limit: Fehlversuche bleiben gespeichert (kein Rollback), dann Sperre
for (let i = 0; i < 10; i++) {
  r = await val(ole, `select album_code_einloesen($1)`, ['FALSCH-' + i])
  if (r.grund !== 'ungueltig') ok(false, 'Fehlversuch ' + i + ' → ' + JSON.stringify(r))
}
ok((await count(`select count(*)::int n from sva_album_code_fehler where fan_user_id = $1`, [F.ole.id])) === 10, '10 Fehlversuche gespeichert (trotz Fehler-Rückgabe)')
ok((await val(ole, `select album_code_einloesen($1)`, [sc.code])).grund === 'gesperrt', 'Nach 10 Fehlversuchen/Stunde: auch gültiger Code → „gesperrt“')
await db.exec(`update sva_album_code_fehler set at = now() - interval '2 hours' where fan_user_id = '${F.ole.id}'`)
ok((await val(ole, `select album_code_einloesen($1)`, [sc.code])).ok === true, 'Nach einer Stunde wieder frei')

// ── Freund-Bonus ───────────────────────────────────────────────────────────
const codeLena = (await val(lena, `select album_mein()`)).freundCode
await expectErr(marvin(`select album_freund_hinzufuegen('ZZZZZZ')`), 'Unbekannter Freundescode', /album_freund_unbekannt/)
await expectErr(lena(`select album_freund_hinzufuegen($1)`, [codeLena]), 'Eigener Code → abgelehnt', /album_freund_selbst/)
await expectErr(ohne(`select album_freund_hinzufuegen($1)`, [codeLena]), 'Ohne Profil keine Freunde', /album_kein_profil/)
r = await val(marvin, `select album_freund_hinzufuegen($1)`, [codeLena.toLowerCase()])
ok(r.ok && r.name === 'Lena B.', 'Freund hinzufügen → { ok, name: „Lena B.“ }')
await val(marvin, `select album_freund_hinzufuegen($1)`, [codeLena])
ok((await count(`select count(*)::int n from sva_album_freunde`)) === 1, 'Doppelt hinzufügen → eine (symmetrische) Freundschaft')
ok(JSON.stringify((await val(lena, `select album_mein()`)).freunde) === '["Marvin A."]', 'Freundschaft ist symmetrisch (Lena sieht Marvin)')
await val(ole, `select album_freund_hinzufuegen($1)`, [codeLena])
const G2 = await heimspiel('SG Harsefeld')
ci = await val(marvin, `select album_checkin($1)`, [G2.token])
ok(!ci.freundPackId, 'Marvin zuerst da → noch kein Freund-Pack')
ci = await val(lena, `select album_checkin($1)`, [G2.token])
ok(!!ci.freundPackId && JSON.stringify(ci.freunde) === '["Marvin A."]', 'Lena checkt ein, Marvin ist schon da → Freund-Pack + Name')
ok((await count(`select count(*)::int n from sva_album_packs where art = 'freund' and spiel_id = $1 and fan_user_id = $2`, [G2.id, F.marvin.id])) === 1, '… und Marvin bekommt auch eins')
ci = await val(ole, `select album_checkin($1)`, [G2.token])
ok(!!ci.freundPackId, 'Ole (Freund von Lena) → eigenes Freund-Pack')
ok((await count(`select count(*)::int n from sva_album_packs where art = 'freund' and spiel_id = $1 and fan_user_id = $2`, [G2.id, F.lena.id])) === 1, 'Lena: höchstens ein Freund-Pack je Spiel (idempotent)')
ok((await one(`select cardinality(karten) n from sva_album_packs where id = $1`, [ci.freundPackId])).n === 1, 'Freund-Pack: 1 Karte')

// ── Tausch ─────────────────────────────────────────────────────────────────
const basis = (await db.query(`select id from sva_album_karten where typ = 'spieler' and not variante and not limitiert and seltenheit = 'bronze' order by titel limit 6`)).rows.map((x) => x.id)
const [KX, KY, KZ, KW, KV, KU] = basis
const setze = (fanId, karte, n) => db.query(`insert into sva_album_besitz (fan_user_id, karte_id, anzahl) values ($1, $2, $3) on conflict (fan_user_id, karte_id) do update set anzahl = excluded.anzahl`, [fanId, karte, n])
const anz = async (fanId, karte) => (await one(`select coalesce((select anzahl from sva_album_besitz where fan_user_id = $1 and karte_id = $2), 0) n`, [fanId, karte])).n
await setze(F.marvin.id, KX, 1)
await expectErr(marvin(`select album_tausch_anbieten($1, $2)`, [KX, KY]), 'Tausch ohne Doppelte → abgelehnt', /album_tausch_keine_doppelte/)
await setze(F.marvin.id, KX, 2)
await expectErr(marvin(`select album_tausch_anbieten($1, $2)`, [KX, KY]), 'Konto jünger als 7 Tage → abgelehnt', /album_tausch_zu_neu/)
await db.exec(`update sva_album_fans set created_at = now() - interval '10 days' where user_id in ('${F.marvin.id}', '${F.lena.id}')`)
await expectErr(marvin(`select album_tausch_anbieten($1, $2)`, [KX, MK]), 'Limitierte Karte nicht tauschbar', /album_tausch_karte/)
await expectErr(marvin(`select album_tausch_anbieten($1, $2)`, [KX, KX]), 'Gleiche Karte ↔ gleiche Karte abgelehnt', /album_tausch_karte/)
const T1 = (await val(marvin, `select album_tausch_anbieten($1, $2)`, [KX, KY])).code
ok(/^[A-HJ-NP-Z2-9]{8}$/.test(T1), 'Tausch-Angebot → Code ' + T1)
let ta = await val(ole, `select album_tausch_ansehen($1)`, [T1])
ok(ta.von === 'Marvin A.' && ta.biete === KX && ta.wunsch === KY && ta.status === 'offen' && ta.kannAnnehmen === false && ta.grund === 'zu_neu', 'Ansehen (Ole, Konto neu) → kannAnnehmen false, grund zu_neu')
ok((await val(marvin, `select album_tausch_ansehen($1)`, [T1])).grund === 'eigen', 'Eigenes Angebot → grund eigen')
ta = await val(lena, `select album_tausch_ansehen($1)`, [T1])
ok(ta.kannAnnehmen === false && ta.grund === 'keine_doppelte', 'Lena ohne Doppelte der Wunschkarte → keine_doppelte')
await expectErr(lena(`select album_tausch_annehmen($1)`, [T1]), 'Annehmen ohne Doppelte → abgelehnt', /album_tausch_keine_doppelte/)
await setze(F.lena.id, KY, 2)
ok((await val(lena, `select album_tausch_ansehen($1)`, [T1])).kannAnnehmen === true, 'Mit Doppelter → kannAnnehmen')
await expectErr(marvin(`select album_tausch_annehmen($1)`, [T1]), 'Eigenes Angebot annehmen → abgelehnt', /album_tausch_eigen/)
await expectErr(lena(`select album_tausch_zurueckziehen($1)`, [T1]), 'Fremdes Angebot zurückziehen → unbekannt', /album_tausch_unbekannt/)
r = await val(lena, `select album_tausch_annehmen($1)`, [T1])
ok(r.ok && r.erhalten === KX && r.abgegeben === KY, 'Tausch angenommen → { erhalten, abgegeben }')
ok((await anz(F.marvin.id, KX)) === 1 && (await anz(F.marvin.id, KY)) === 1 && (await anz(F.lena.id, KX)) === 1 && (await anz(F.lena.id, KY)) === 1, 'Besitz atomar umgebucht (je 1 abgegeben, 1 erhalten)')
await expectErr(lena(`select album_tausch_annehmen($1)`, [T1]), 'Zweites Annehmen → abgelaufen/erledigt', /album_tausch_abgelaufen/)
await expectErr(ole(`select album_tausch_ansehen($1)`, [T1]), 'Fremde sehen erledigte Tausche nicht', /album_tausch_unbekannt/)
await expectErr(ole(`select album_tausch_annehmen($1)`, [T1]), 'Fremde nehmen erledigte Tausche nicht an', /album_tausch_unbekannt/)
mein = await val(marvin, `select album_mein()`)
ok(mein.tauscheWoche === 1 && mein.tausche.some((t) => t.code === T1 && t.status === 'erledigt' && t.eigen && t.partner === 'Lena B.') && mein.kontoTage === 10, 'album_mein: Tausch-Verlauf, tauscheWoche 1, kontoTage 10')
// Partner hat die Doppelte inzwischen nicht mehr → atomar abgelehnt, nichts gebucht
await setze(F.marvin.id, KZ, 2)
const T2 = (await val(marvin, `select album_tausch_anbieten($1, $2)`, [KZ, KW])).code
await setze(F.lena.id, KW, 3)
await setze(F.marvin.id, KZ, 1)
ok((await val(lena, `select album_tausch_ansehen($1)`, [T2])).grund === 'partner_keine_doppelte', 'Ansehen: Anbieter hat keine Doppelte mehr')
await expectErr(lena(`select album_tausch_annehmen($1)`, [T2]), 'Annehmen, wenn der Anbieter keine Doppelte mehr hat → abgelehnt', /album_tausch_partner/)
ok((await anz(F.lena.id, KW)) === 3 && (await anz(F.marvin.id, KZ)) === 1, '… und nichts wurde umgebucht')
ok((await val(marvin, `select album_tausch_zurueckziehen($1)`, [T2])).ok === true && (await one(`select status from sva_album_tausch where code = $1`, [T2])).status === 'zurueckgezogen', 'Eigenes Angebot zurückziehen')
await expectErr(marvin(`select album_tausch_zurueckziehen($1)`, [T2]), 'Zweimal zurückziehen → nicht offen', /album_tausch_nicht_offen/)
// Wochenlimit
await db.exec(`update sva_album_einstellungen set tausch_pro_woche = 1`)
await setze(F.marvin.id, KV, 2)
await expectErr(marvin(`select album_tausch_anbieten($1, $2)`, [KV, KU]), 'Wochenlimit erreicht → abgelehnt', /album_tausch_limit/)
await db.exec(`update sva_album_tausch set erledigt_at = now() - interval '8 days' where code = '${T1}'; update sva_album_einstellungen set tausch_pro_woche = 5`)
const T3 = (await val(marvin, `select album_tausch_anbieten($1, $2)`, [KV, KU])).code
ok(!!T3, 'Nach 7 Tagen wieder möglich')
await db.exec(`update sva_album_tausch set gueltig_bis = now() - interval '1 minute' where code = '${T3}'`)
await setze(F.lena.id, KU, 2)
ok((await val(lena, `select album_tausch_ansehen($1)`, [T3])).status === 'abgelaufen', 'Angebot nach 7 Tagen → abgelaufen')
await expectErr(lena(`select album_tausch_annehmen($1)`, [T3]), 'Abgelaufenes Angebot annehmen → abgelehnt', /album_tausch_abgelaufen/)

// ── Wunschkarte ────────────────────────────────────────────────────────────
const fehlend = (await one(`select id from sva_album_karten k where typ = 'spieler' and not variante and not limitiert and seltenheit = 'bronze'
  and not exists (select 1 from sva_album_besitz b where b.fan_user_id = $1 and b.karte_id = k.id) limit 1`, [F.tom.id])).id
const spezialAlbum = (await one(`select id from sva_album_karten where titel = 'Der Pokal'`)).id
const variante = (await one(`select id from sva_album_karten where variante limit 1`)).id
await setze(F.tom.id, KX, 2); await setze(F.tom.id, KY, 2); await setze(F.tom.id, KZ, 4)
await expectErr(tom(`select album_wunschkarte($1, $2)`, [spezialAlbum, [KX, KY, KZ]]), 'Wunschkarte nie Spezial', /album_wunsch_karte/)
await expectErr(tom(`select album_wunschkarte($1, $2)`, [variante, [KX, KY, KZ]]), 'Wunschkarte nie Variante', /album_wunsch_karte/)
await expectErr(tom(`select album_wunschkarte($1, $2)`, [MK, [KX, KY, KZ]]), 'Wunschkarte nie limitiert', /album_wunsch_karte/)
await expectErr(tom(`select album_wunschkarte($1, $2)`, [fehlend, [KX, KY]]), 'Nur 2 statt 3 Doppelte → abgelehnt', /album_wunsch_doppelte/)
await expectErr(tom(`select album_wunschkarte($1, $2)`, [fehlend, [KX, KX, KY]]), 'KX zweimal genannt, aber nur 1 Doppelte → abgelehnt', /album_wunsch_doppelte/)
ok((await anz(F.tom.id, KX)) === 2, '… nichts abgezogen')
r = await val(tom, `select album_wunschkarte($1, $2)`, [fehlend, [KZ, KZ, KZ]])
const wp = await one(`select * from sva_album_packs where id = $1`, [r.packId])
ok(wp.art === 'wunsch' && wp.karten.length === 1 && wp.karten[0] === fehlend && (await anz(F.tom.id, KZ)) === 1, 'KZ dreimal (4 im Besitz) → Wunsch-Pack mit genau der Wunschkarte, 3 abgezogen')
const silberBasis = (await one(`select id from sva_album_karten where titel = 'Die Kurve'`)).id
await setze(F.tom.id, KX, 2); await setze(F.tom.id, KY, 3)
r = await val(tom, `select album_wunschkarte($1, $2)`, [silberBasis, [KX, KY, KY]])
ok(!!r.packId && (await anz(F.tom.id, KX)) === 1 && (await anz(F.tom.id, KY)) === 1, 'Silber-Basis-Karte als Wunsch möglich (Kurve)')

// ── Kapitel komplett → Abzeichen + Bonus-Pack (einmalig) ───────────────────
await db.exec(`update sva_album_einstellungen set karten_kapitel = 1`)
const kurve = (await db.query(`select id from sva_album_karten where typ = 'fan' order by titel`)).rows.map((x) => x.id)
const KF = await user('kapitel@fan.example')
const kf = (sql, p) => as(KF, 'kapitel@fan.example', sql, p)
await kf(`select album_profil_speichern('Kim', 'K', false, false, true)`)
await setze(KF, kurve[0], 1); await setze(KF, kurve[1], 1)
const kp1 = (await one(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 1, null, 'Test', null, $2) id`, [KF, kurve[2]])).id
let op = await val(kf, `select album_pack_oeffnen($1)`, [kp1])
ok(op.kapitel.length === 1 && op.kapitel[0].kapitel === 'fan' && !!op.kapitel[0].packId, 'Letzte Kurve-Karte → Kapitel „fan“ komplett + Bonus-Pack ' + JSON.stringify(op.kapitel))
ok(op.titel === 'Test' && op.karten[0].variante === false && op.karten[0].limitiert === false, 'Pack öffnen: titel + variante/limitiert je Karte')
const kbp = await one(`select * from sva_album_packs where id = $1`, [op.kapitel[0].packId])
ok(kbp.art === 'kapitel' && kbp.karten.length === 1, 'Kapitel-Bonus: 1 Karte')
op = await val(kf, `select album_pack_oeffnen($1)`, [kbp.id])
ok(!op.kapitel.some((k) => k.kapitel === 'fan'), 'Kapitel-Bonus nur einmal')
ok((await val(kf, `select album_mein()`)).abzeichen.includes('fan'), 'album_mein: Abzeichen „fan“')
// Variante füllt keinen Platz
const TWv = (await db.query(`select id, variante from sva_album_karten k where typ = 'spieler' and roster_id in (select id from sm_roster where position = 'TW')`)).rows
for (const k of TWv.filter((x) => x.variante)) await setze(KF, k.id, 1)
const kp2 = (await one(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 1, null, null, null, $2) id`, [KF, kurve[0]])).id
op = await val(kf, `select album_pack_oeffnen($1)`, [kp2])
ok(!op.kapitel.some((k) => k.kapitel === 'TW'), 'Nur Silber-Glanz-Varianten der Torhüter → Kapitel TW NICHT komplett')

// ── Belohnungen 3 / 6 / 8 (nur Check-ins) ──────────────────────────────────
const BF = await user('treu@fan.example')
const bf = (sql, p) => as(BF, 'treu@fan.example', sql, p)
await bf(`select album_profil_speichern('Treu', 'T', false, false, true)`)
const altSpiele = async (n) => { for (let i = 0; i < n; i++) { const s = (await one(`insert into sm_spiele (gegner, heim, anstoss) values ('Alt ' || $1, true, now() - interval '20 days') returning id`, [Math.random()])).id; await db.query(`insert into sva_album_checkins (fan_user_id, spiel_id, saison) values ($1, $2, '2026/27')`, [BF, s]) } }
await altSpiele(2)
ci = await val(bf, `select album_checkin($1)`, [(await heimspiel('Dritter')).token])
ok(ci.gutscheine.length === 1 && ci.gutscheine[0].stufe === 'schwelle_1' && ci.gutscheine[0].titel === 'Getränk nach Wahl', '3. Check-in → „Getränk nach Wahl“')
await altSpiele(2)
ci = await val(bf, `select album_checkin($1)`, [(await heimspiel('Sechster')).token])
ok(ci.gutscheine.length === 1 && ci.gutscheine[0].stufe === 'schwelle_2' && ci.gutscheine[0].titel === 'Bratwurst + Getränk nach Wahl oder Fanartikel', '6. Check-in → Bratwurst + Getränk oder Fanartikel')
await altSpiele(1)
ci = await val(bf, `select album_checkin($1)`, [(await heimspiel('Achter')).token])
ok(ci.gutscheine.length === 1 && ci.gutscheine[0].stufe === 'schwelle_3', '8. Check-in → Verlosungs-Los (Schwelle 3)')
const g3 = (await val(bf, `select album_mein()`)).gutscheine.find((g) => g.stufe === 'schwelle_3')
r = await val(bf, `select album_gutschein_einloesen($1)`, [g3.id])
ok(r.ok === false && r.grund === 'verlosung' && g3.verlosung === true, 'Verlosungs-Los (Schwelle 3) ist NICHT am Stand einlösbar')
const g1 = (await val(bf, `select album_mein()`)).gutscheine.find((g) => g.stufe === 'schwelle_1')
ok((await val(bf, `select album_gutschein_einloesen($1)`, [g1.id])).ok === true, 'Getränke-Gutschein am Stand einlösbar')
ok((await val(bf, `select album_mein()`)).lose === 3, 'Lose: 1 je echtem Check-in (3)')

// ── Tipp-Liga-Schnittstelle ────────────────────────────────────────────────
await db.exec(`create function public.tipp_abgeben_test(p_tipp uuid) returns uuid language plpgsql security definer set search_path to 'public' as $$
  begin return public.album_karte_gutschreiben('tipp', p_tipp); end $$;
  create function public.tipp_falsch_test(p_tipp uuid) returns uuid language plpgsql security definer set search_path to 'public' as $$
  begin return public.album_karte_gutschreiben('quatsch', p_tipp); end $$;
  revoke all on function public.tipp_abgeben_test(uuid), public.tipp_falsch_test(uuid) from public;
  grant execute on function public.tipp_abgeben_test(uuid), public.tipp_falsch_test(uuid) to authenticated;`)
const TIPP = '11111111-1111-4111-8111-111111111111'
await expectErr(marvin(`select album_karte_gutschreiben('tipp', $1)`, [TIPP]), 'Fan ruft album_karte_gutschreiben direkt → verweigert', /permission denied/)
await expectErr(asAnon(`select album_karte_gutschreiben('tipp', $1)`, [TIPP]), 'anon ruft album_karte_gutschreiben → verweigert', /permission denied/)
const tp = await val(marvin, `select tipp_abgeben_test($1)`, [TIPP])
const tpp = await one(`select * from sva_album_packs where id = $1`, [tp])
ok(!!tp && tpp.art === 'tipp' && tpp.karten.length === 1 && tpp.quelle === 'tipp:' + TIPP && tpp.fan_user_id === F.marvin.id, 'Über SECURITY-DEFINER-Tipp-RPC: Tipp-Pack (1 Karte, Fan = auth.uid())')
ok((await val(marvin, `select tipp_abgeben_test($1)`, [TIPP])) === null, 'Gleicher Tipp nochmal → null (idempotent)')
ok((await val(ohne, `select tipp_abgeben_test($1)`, [TIPP])) === null, 'Ohne Album-Profil → null')
await expectErr(marvin(`select tipp_falsch_test($1)`, [TIPP]), 'Unbekannte Quelle → album_quelle_unbekannt', /album_quelle_unbekannt/)

// ── Adventskalender ────────────────────────────────────────────────────────
await expectErr(marvin(`select album_admin_advent(2026, $1)`, [WK]), 'Fan legt keinen Adventskalender an', /album_kein_admin/)
const adv = await val(admin, `select album_admin_advent(2026, $1)`, [WK])
ok(adv.length === 24 && adv.every((x, i) => x.tag === i + 1 && /^ADVENT-/.test(x.code)), 'Adventskalender: 24 Codes')
const adv2 = await val(admin, `select album_admin_advent(2026, $1)`, [WK])
ok(JSON.stringify(adv) === JSON.stringify(adv2) && (await count(`select count(*)::int n from sva_album_codes where art = 'advent'`)) === 24, 'Adventskalender zweimal → dieselben 24 Codes')
const t1 = await one(`select gueltig_von, gueltig_bis, karte_id from sva_album_codes where art = 'advent' and advent_tag = 1`)
const t24 = await one(`select gueltig_von, karte_id from sva_album_codes where art = 'advent' and advent_tag = 24`)
ok(t1.gueltig_von.toISOString() === '2026-11-30T23:00:00.000Z' && t1.gueltig_bis.toISOString() === '2026-12-01T23:00:00.000Z' && !t1.karte_id && t24.karte_id === WK,
  'Tag 1 gilt 01.12. 00:00–24:00 (Berlin), Tag 24 = Weihnachtskarte')
ok((await val(marvin, `select album_code_einloesen($1)`, [adv[0].code])).grund === 'noch_nicht', 'Im Oktober: Türchen 1 noch nicht offen')
await db.exec(`update sva_album_codes set gueltig_von = now() - interval '1 hour', gueltig_bis = now() + interval '1 hour' where art = 'advent' and advent_tag in (5, 24)`)
r = await val(marvin, `select album_code_einloesen($1)`, [adv[4].code])
ok(r.ok && r.art === 'advent', 'Türchen 5 (Fenster verschoben) → Pack')
r = await val(marvin, `select album_code_einloesen($1)`, [adv[23].code])
ok(r.ok && (await one(`select karten from sva_album_packs where id = $1`, [r.packId])).karten[0] === WK, 'Heiligabend → Weihnachts-Spezialkarte')
ok((await val(marvin, `select album_mein()`)).advent === null, 'album_mein.advent außerhalb Dezember = null')
await db.exec(`set sva.test_jetzt = '2026-12-10 12:00:00+01'`)
mein = await val(marvin, `select album_mein()`)
await db.exec(`reset sva.test_jetzt`)
ok(mein.advent?.length === 24 && mein.advent[4].eingeloest === true && mein.advent[23].eingeloest === true && mein.advent[0].eingeloest === false, 'album_mein.advent im Dezember: 24 Tage, eingelöste markiert')

// ── MISSBRAUCH ─────────────────────────────────────────────────────────────
for (const t of ['sva_album_codes', 'sva_album_code_einloesungen', 'sva_album_code_fehler', 'sva_album_freunde', 'sva_album_tausch', 'sva_album_abzeichen', 'sva_album_ziele', 'sva_album_ziel_erreicht', 'sva_album_lose', 'sva_album_verlosungen']) {
  ok((await marvin(`select count(*)::int n from ${t}`)).rows[0].n === 0, `Fan liest ${t} NICHT`)
  await expectErr(asAnon(`select count(*) from ${t}`), `anon: ${t} gesperrt`, /permission denied/)
}
ok((await admin(`select count(*)::int n from sva_album_codes`)).rows[0].n > 0, 'Admin liest Codes')
await expectErr(marvin(`insert into sva_album_codes (code, art, titel) values ('HACK-1', 'story', 'Hack')`), 'Fan legt keinen Code direkt an', /row-level security/)
await expectErr(marvin(`insert into sva_album_freunde (fan_a, fan_b) values ($1, $2)`, [F.marvin.id < F.tom.id ? F.marvin.id : F.tom.id, F.marvin.id < F.tom.id ? F.tom.id : F.marvin.id]), 'Fan trägt keine Freundschaft direkt ein', /row-level security/)
ok((await marvin(`update sva_album_tausch set status = 'erledigt' returning id`)).rows.length === 0, 'Fan ändert keinen Tausch direkt')
for (const fn of [`album_admin_katalog_standard()`, `album_admin_story_codes_massen(current_date, 3, 'X Y')`, `album_admin_ziele_standard()`, `album_admin_ziel_status()`, `album_admin_statistik()`]) {
  await expectErr(marvin(`select ${fn}`), `Fan ruft ${fn.split('(')[0]} NICHT`, /album_kein_admin/)
}
for (const fn of [`sva_album_pack_ziehen_v20('${F.marvin.id}', 'geschenk')`, `sva_album_pack_ziehen('${F.marvin.id}', null, 'starter')`, `sva_album_lose_buchen('${F.marvin.id}', 99, 'admin', 'x')`, `sva_album_kapitel_pruefen('${F.marvin.id}')`, `album_ziel_ausloesen('tipp_exakt', '${TIPP}')`]) {
  await expectErr(marvin(`select ${fn}`), `Fan ruft intern ${fn.split('(')[0]} NICHT`, /permission denied/)
}
await expectErr(lena(`select album_pack_oeffnen($1)`, [tp]), 'Fremdes (Tipp-)Pack öffnen → unbekannt', /album_pack_unbekannt/)
await expectErr(asAnon(`select album_code_einloesen('X')`), 'anon löst keine Codes ein', /permission denied/)
await expectErr(asAnon(`select album_starter_holen()`), 'anon holt kein Starter-Pack', /permission denied/)
const priv = await one(`select
  has_function_privilege('anon', 'public.album_katalog()', 'execute') a,
  has_function_privilege('authenticated', 'public.album_tausch_annehmen(text)', 'execute') b,
  has_function_privilege('anon', 'public.album_tausch_annehmen(text)', 'execute') c,
  has_function_privilege('authenticated', 'public.album_karte_gutschreiben(text,uuid)', 'execute') d,
  has_function_privilege('service_role', 'public.album_karte_gutschreiben(text,uuid)', 'execute') e,
  has_function_privilege('authenticated', 'public.sva_album_pack_ziehen_v20(uuid,text,uuid,integer,text,text,text,uuid,boolean)', 'execute') f`)
ok(priv.a && priv.b && !priv.c && !priv.d && priv.e && !priv.f, 'Rechte: Katalog öffentlich, Fan-RPCs eingeloggt, Gutschreiben nur service_role, Ziehung intern ' + JSON.stringify(priv))

// ── Statistik + Konto löschen ──────────────────────────────────────────────
const stat = await val(admin, `select album_admin_statistik()`)
ok(stat.codesEingeloest >= 6 && stat.tauscheErledigt === 1 && stat.starterGeholt === 61 && typeof stat.fans === 'number' && Array.isArray(stat.kontakte), 'Admin-Statistik: codesEingeloest, tauscheErledigt, starterGeholt (+ bisherige Felder) ' + JSON.stringify({ c: stat.codesEingeloest, t: stat.tauscheErledigt, s: stat.starterGeholt }))
const spuren = async (id) => count(`select ((select count(*) from sva_album_fans where user_id = $1) + (select count(*) from sva_album_besitz where fan_user_id = $1)
  + (select count(*) from sva_album_packs where fan_user_id = $1) + (select count(*) from sva_album_freunde where fan_a = $1 or fan_b = $1)
  + (select count(*) from sva_album_tausch where von_fan = $1 or an_fan = $1) + (select count(*) from sva_album_code_einloesungen where fan_user_id = $1)
  + (select count(*) from sva_album_code_fehler where fan_user_id = $1) + (select count(*) from sva_album_abzeichen where fan_user_id = $1)
  + (select count(*) from sva_album_lose where fan_user_id = $1) + (select count(*) from sva_album_ziel_erreicht where fan_user_id = $1)
  + (select count(*) from sva_album_gutscheine where fan_user_id = $1))::int n`, [id])
ok((await spuren(F.marvin.id)) > 5, 'Vorher: Marvin hat Daten in den neuen Tabellen')
await db.query(`insert into sva_album_code_fehler (fan_user_id) values ($1)`, [F.marvin.id])
await db.query(`insert into sva_album_abzeichen (fan_user_id, saison, kapitel) values ($1, '2026/27', 'TW') on conflict do nothing`, [F.marvin.id])
r = await val(marvin, `select album_konto_loeschen()`)
ok(r.ok && r.loginGeloescht === true && (await spuren(F.marvin.id)) === 0, 'Konto löschen räumt alles (Freunde, Tausche, Codes, Fehler, Abzeichen, Lose, Ziele, Packs …)')
ok(JSON.stringify((await val(lena, `select album_mein()`)).freunde) === '["Ole K."]', 'Freundschaft des gelöschten Kontos ist weg')

console.log(fails ? `\n${fails} FEHLER` : '\nALLES GRÜN')
process.exit(fails ? 1 : 0)
