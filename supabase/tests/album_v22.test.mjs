// PGlite-Test der Migration 20261014100000_sva_album_v22.sql (Shiny + Geheimkarten):
//   · Nachziehen einer DB im Stand v21 (Katalog, Ziele, Fans mit Besitz und
//     ungeöffnetem Pack): Sammlungen bleiben unverändert, idempotent.
//   · Shiny: serverseitig je gezogener Spieler-/Trainer-Karte mit 1 : N
//     (Fairness-Stichprobe), nie für Momente/Partner/Kurve/limitierte Karten,
//     0 = aus; Öffnen → Vitrine + Erstfund, zählt NICHT fürs Album.
//   · Geheimkarten: nicht im öffentlichen Katalog, nie gezogen, Token nur als
//     Hash, Einlösen über album_code_einloesen (Rate-Limit), je Fan einmal,
//     Geburtstag nur am Vereins-Geburtstag, Eier per Admin an/aus.
//   · Konto löschen, Admin-RPCs, Rechte.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/album_v22.test.mjs <pg-ordner>/ && MIGRATIONS=<repo>/supabase/migrations/ node <pg-ordner>/album_v22.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
import crypto from 'node:crypto'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261014100000_sva_album_v22.sql'
const KARTEN = '20261012110000_sva_karten.sql'
const SETUP = `
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
`
let fails = 0
const ok = (cond, msg) => { console.log(cond ? 'OK  ' : 'FAIL', msg); if (!cond) fails++ }
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 100)) }
}
const alle = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(alle.includes(NEU), 'Migration vorhanden: ' + NEU)

// Token wie im Browser (src/album/geheim/token.ts): „G-“ + 32 Hex von SHA-256('sva-geheim|' + teil)
const token = (teil) => 'G-' + crypto.createHash('sha256').update('sva-geheim|' + teil).digest('hex').slice(0, 32).toUpperCase()

const db = new PGlite()
await db.exec(SETUP)
const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                grant execute on all functions in schema public to anon, authenticated, service_role;`)
for (const f of alle.filter((f) => f < NEU)) {
  if (f === KARTEN) await defaults()
  try { await db.exec(fs.readFileSync(M + f, 'utf8')) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) }
}
await defaults()

const claims = (uid, email) => JSON.stringify({ sub: uid, email, role: 'authenticated' })
const as = async (uid, email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(uid, email)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const asAnon = async (sql, params) => {
  await db.exec(`set role anon;`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role;`) }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const val = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]
const user = async (email) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, '{"app":"sva-album"}') returning id`, [email])).id
const fan = async (vorname, initial) => {
  const mail = vorname.toLowerCase() + '@fan.example'
  const id = await user(mail)
  const f = (sql, p) => as(id, mail, sql, p)
  await f(`select album_profil_speichern($1, $2, false, false, true)`, [vorname, initial])
  return { id, f }
}

// ══ A) Stand v21 → Migration v22 ═════════════════════════════════════════════
await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const CHEF = await user('chef@sva.de')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
await db.exec(`insert into sm_sponsoren (name, aktiv) values ('Mr. Döner', true)`)
await val(admin, `select album_admin_katalog_standard()`)
await val(admin, `select album_admin_ziele_standard()`)
const LENA = await fan('Lena', 'B')
const altPack = await val(LENA.f, `select (album_starter_holen() ->> 'packId')`)
const offenPack = (await one(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 3, 'vorher', 'Vorher', null, null) id`, [LENA.id])).id
await LENA.f(`select album_pack_oeffnen($1)`, [altPack])
const besitzVorher = JSON.stringify((await db.query(`select fan_user_id, karte_id, anzahl from sva_album_besitz order by 1, 2`)).rows)
const meinVorher = await val(LENA.f, `select album_mein()`)

await db.exec(fs.readFileSync(M + NEU, 'utf8'))
ok(JSON.stringify((await db.query(`select fan_user_id, karte_id, anzahl from sva_album_besitz order by 1, 2`)).rows) === besitzVorher, 'Sammlungen der Fans unverändert nach der Migration')
let r = await one(`select count(*)::int n, bool_and(limitiert) lim, bool_and(seltenheit = 'spezial') sp from sva_album_karten where geheim`)
ok(r.n === 4 && r.lim && r.sp, '4 Geheimkarten angelegt (limitiert, Spezial)')
ok((await one(`select count(*)::int n from sva_album_geheim where aktiv`)).n === 4, '4 Easter Eggs aktiv')
ok((await one(`select shiny_chance from sva_album_einstellungen where id = 1`)).shiny_chance === 250, 'Standard: Shiny 1 : 250')
const offen = await val(LENA.f, `select album_pack_oeffnen($1)`, [offenPack])
ok(offen.karten.length === 3 && offen.karten.every((k) => k.shiny === false), 'Altes ungeöffnetes Pack (ohne Shiny-Spalte) öffnet normal, ohne Shiny')
await db.exec(fs.readFileSync(M + NEU, 'utf8'))
ok((await one(`select count(*)::int n from sva_album_karten where geheim`)).n === 4 && (await one(`select count(*)::int n from sva_album_geheim`)).n === 4, 'Zweiter Lauf: idempotent (weiter 4 Geheimkarten/Eier)')

// Rechte nach der Migration (Hüllen öffentlich, alte Fassungen intern)
await expectErr(LENA.f(`select sva_album_mein_v21()`), 'Alte album_mein-Fassung nicht mehr direkt aufrufbar')
await expectErr(LENA.f(`select sva_album_katalog_v21()`), 'Alte Katalog-Fassung nicht mehr direkt aufrufbar')
await expectErr(LENA.f(`select sva_album_v22_nachziehen()`), 'Nachziehen nicht für Fans')
await expectErr(asAnon(`select album_mein()`), 'anon: album_mein verweigert')
ok((await LENA.f(`select * from sva_album_geheim`)).rows.length === 0, 'Fan sieht die Easter-Egg-Tabelle (Token-Hashes) nicht')
ok((await LENA.f(`select * from sva_album_shiny`)).rows.length === 0, 'Fan liest sva_album_shiny nicht direkt')
await expectErr(LENA.f(`update sva_album_einstellungen set shiny_chance = 2 where id = 1 returning id`).then((x) => { if (!x.rows.length) throw new Error('kein Zugriff (RLS)') }), 'Fan kann die Shiny-Chance nicht ändern')

// Katalog + album_mein
const kat = await val(asAnon, `select album_katalog()`)
const katText = JSON.stringify(kat)
ok(kat.karten.length > 40 && !kat.karten.some((k) => k.geheim) && !/Platzwart|Geheimtaktik|verlorene Ball|Seit 1949/.test(katText), 'Öffentlicher Katalog ohne Geheimkarten (weder Titel noch IDs)')
ok(kat.regeln.shinyChance === 250 && kat.regeln.geheimAnzahl === 4 && kat.regeln.vereinsGeburtstag === undefined, 'Katalog-Regeln: shinyChance 250, geheimAnzahl 4, kein Geburtstag gesetzt')
const meinNach = await val(LENA.f, `select album_mein()`)
ok(meinNach.besitz.length >= meinVorher.besitz.length && meinNach.lose === meinVorher.lose && JSON.stringify(meinNach.ziele.map((z) => z.schluessel).sort()) === JSON.stringify(meinVorher.ziele.map((z) => z.schluessel).sort()), 'album_mein: bisherige Felder unverändert')
ok(meinNach.geheim.length === 4 && meinNach.geheim.every((g) => g.gefunden === false && !g.karte && g.raetsel && !g.schluessel), 'Geheimseite: 4 Rätsel, ohne Karte/Schlüssel/Ort')
ok(Array.isArray(meinNach.shiny) && meinNach.shiny.length === 0 && Array.isArray(meinNach.shinyErstfunde), 'album_mein: shiny + shinyErstfunde (leer)')

// ══ B) Shiny-Ziehung: fair, serverseitig ═════════════════════════════════════
const SAISON = (await one(`select sva_album_saison() s`)).s
await db.exec(`update sva_album_einstellungen set shiny_chance = 5 where id = 1`)
const ZIEH = await fan('Zora', 'Z')
// 1 500 Packs à 2 Karten über die echte Ziehung (Quelle eindeutig) — ohne Öffnen
await db.query(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 2, 'test:' || g, 'Test', null, null) from generate_series(1, 1500) g`, [ZIEH.id])
r = await one(`
  select count(*) filter (where k.typ in ('spieler', 'trainer') and not k.limitiert)::int person,
         count(*) filter (where k.typ in ('spieler', 'trainer') and not k.limitiert and x.s)::int person_shiny,
         count(*) filter (where not (k.typ in ('spieler', 'trainer') and not k.limitiert) and x.s)::int andere_shiny,
         count(*) filter (where not (k.typ in ('spieler', 'trainer') and not k.limitiert))::int andere,
         count(*) filter (where k.seltenheit = 'bronze')::int bronze, count(*)::int alle
    from sva_album_packs p cross join lateral unnest(p.karten, p.shiny) as x(id, s) join sva_album_karten k on k.id = x.id
   where p.fan_user_id = $1`, [ZIEH.id])
const p = r.person_shiny / r.person
const sigma = Math.sqrt(0.2 * 0.8 / r.person)
ok(r.alle === 3000 && Math.abs(p - 0.2) < 4 * sigma, `Shiny-Quote bei 1 : 5 = ${(p * 100).toFixed(1)} % von ${r.person} Personen-Karten (Soll 20 % ± ${(4 * sigma * 100).toFixed(1)})`)
ok(r.andere > 100 && r.andere_shiny === 0, `Nie Shiny: Momente, Kurve, Partner (${r.andere} Karten)`)
ok(Math.abs(r.bronze / r.alle - 0.70) < 0.06, `Seltenheit unverändert fair (Kader ${(100 * r.bronze / r.alle).toFixed(1)} % ≈ 70 %)`)
ok((await one(`select count(*)::int n from sva_album_packs where fan_user_id = $1 and cardinality(shiny) <> cardinality(karten)`, [ZIEH.id])).n === 0, 'Jede Karte hat genau ein Shiny-Flag')
// Standard 1 : 250 — grobe Plausibilität (Erwartung 4 bei 1 000 Personen-Karten)
await db.exec(`update sva_album_einstellungen set shiny_chance = 250 where id = 1`)
await db.query(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 5, 'std:' || g, 'Test', null, null) from generate_series(1, 400) g`, [ZIEH.id])
r = await one(`select count(*) filter (where x.s)::int n, count(*)::int alle from sva_album_packs p cross join lateral unnest(p.karten, p.shiny) as x(id, s) join sva_album_karten k on k.id = x.id
                where p.fan_user_id = $1 and p.quelle like 'std:%' and k.typ in ('spieler', 'trainer')`, [ZIEH.id])
ok(r.n <= 20, `Standard 1 : 250: ${r.n} Shinys in ${r.alle} Personen-Karten (Erwartung ${(r.alle / 250).toFixed(1)})`)
await db.exec(`update sva_album_einstellungen set shiny_chance = 0 where id = 1`)
await db.query(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 5, 'aus:' || g, 'Test', null, null) from generate_series(1, 120) g`, [ZIEH.id])
ok((await one(`select count(*)::int n from sva_album_packs p cross join lateral unnest(p.shiny) s where p.fan_user_id = $1 and p.quelle like 'aus:%' and s`, [ZIEH.id])).n === 0, 'shiny_chance = 0 → keine Shinys')
await expectErr(db.query(`update sva_album_einstellungen set shiny_chance = 1 where id = 1`), 'shiny_chance = 1 (jede Karte) abgelehnt')
await db.exec(`update sva_album_einstellungen set shiny_chance = 250 where id = 1`)
// Geheimkarten werden nie gezogen
ok((await one(`select count(*)::int n from sva_album_packs p cross join lateral unnest(p.karten) x(id) join sva_album_karten k on k.id = x.id where k.geheim`)).n === 0, 'Geheimkarten in über 5 000 gezogenen Karten nie dabei')

// ══ C) Shiny öffnen: Vitrine, Erstfund, zählt nicht fürs Album ══════════════
const basis = async (slug) => (await one(`select k.id from sva_album_karten k join sm_roster r on r.id = k.roster_id where r.slug = $1 and not k.variante and not k.limitiert`, [slug])).id
const glanz = async (slug) => (await one(`select k.id from sva_album_karten k join sm_roster r on r.id = k.roster_id where r.slug = $1 and k.variante`, [slug])).id
const PILS = await basis('p-pils')
const PILS_G = await glanz('p-pils')
const MOMENT = (await one(`select id from sva_album_karten where typ = 'moment' and not geheim limit 1`)).id
const packMit = async (fid, karten, shiny) => (await one(`insert into sva_album_packs (fan_user_id, art, karten, seltenheiten, saison, quelle, shiny)
  values ($1, 'geschenk', $2::uuid[], (select array_agg(k.seltenheit order by x.i) from unnest($2::uuid[]) with ordinality x(id, i) join sva_album_karten k on k.id = x.id), $3, 'shiny:' || gen_random_uuid(), $4::boolean[]) returning id`, [fid, karten, SAISON, shiny])).id
const MIA = await fan('Mia', 'K')
const plaetze = async (fid) => (await one(`select count(*) filter (where belegt)::int n from sva_album_plaetze($1)`, [fid])).n
const vorPl = await plaetze(MIA.id)
const p1 = await packMit(MIA.id, [PILS, MOMENT], [true, true])
const o1 = await val(MIA.f, `select album_pack_oeffnen($1)`, [p1])
ok(o1.karten[0].shiny === true && o1.karten[0].erstfund?.name === 'Mia K.' && o1.karten[0].erstfund.ich === true, 'Shiny geöffnet: Erstfund „Mia K.“ (ich)')
ok(o1.karten[1].shiny === true && !o1.karten[1].erstfund, 'Moment mit (erzwungenem) Flag: keine Vitrine/kein Erstfund (nur Personen)')
ok((await plaetze(MIA.id)) === vorPl + 2, 'Shiny zählt nicht extra: nur die normalen Karten belegen ihre Plätze (+2)')
let mm = await val(MIA.f, `select album_mein()`)
ok(mm.shiny.length === 1 && mm.shiny[0].karteId === PILS && mm.shiny[0].anzahl === 1 && mm.shiny[0].erstfund.ich, 'Vitrine: 1 Shiny (Basis-Karte der Person), Erstfund ich')
ok(mm.besitz.find((b) => b.karteId === PILS)?.anzahl === 1, 'Besitz: Basis-Karte ganz normal ×1')
await val(MIA.f, `select album_pack_oeffnen($1)`, [p1])
ok((await val(MIA.f, `select album_mein()`)).shiny[0].anzahl === 1, 'Erneutes Öffnen zählt nicht doppelt')
// Zweiter Fan: Glanz-Variante shiny → gleiche Person, Erstfund bleibt bei Mia
const OLE = await fan('Ole', 'S')
const p2 = await packMit(OLE.id, [PILS_G], [true])
const o2 = await val(OLE.f, `select album_pack_oeffnen($1)`, [p2])
ok(o2.karten[0].shiny && o2.karten[0].erstfund?.name === 'Mia K.' && o2.karten[0].erstfund.ich === false, 'Zweiter Fund derselben Person: Erstfund bleibt „Mia K.“')
ok((await plaetze(OLE.id)) === 0, 'Shiny-Glanz-Variante belegt keinen Album-Platz')
const mo = await val(OLE.f, `select album_mein()`)
ok(mo.shiny[0].karteId === PILS && mo.shiny[0].gezogen === PILS_G && mo.shinyErstfunde.some((e) => e.karteId === PILS && e.name === 'Mia K.' && !e.ich), 'Vitrine zeigt die Person (Basis), gezogen = Glanz; Erstfunde für alle sichtbar')
const zweit = await packMit(OLE.id, [PILS_G], [true])
await val(OLE.f, `select album_pack_oeffnen($1)`, [zweit])
ok((await val(OLE.f, `select album_mein()`)).shiny[0].anzahl === 2, 'Zweites Shiny derselben Person → ×2')
// Admin-Übersicht
const as1 = await val(admin, `select album_admin_shiny()`)
ok(as1.chance === 250 && as1.personen === 1 && as1.fans === 2 && as1.funde.length === 2 && as1.funde.some((f) => f.fan === 'Mia K.' && f.erstfund && f.person === 'Malte Pils'), 'Admin „Shiny-Funde“: Personen, Fans, Erstfund markiert')
await expectErr(MIA.f(`select album_admin_shiny()`), 'Fan: keine Shiny-Admin-Übersicht', /album_kein_admin/)

// ══ D) Geheimkarten ═════════════════════════════════════════════════════════
const code = async (who, c) => val(who, `select album_code_einloesen($1)`, [c])
r = await code(MIA.f, token('wappen|7'))
ok(r.ok === true && r.art === 'geheim' && !!r.packId, 'Wappen-Token → Geheim-Pack')
const og = await val(MIA.f, `select album_pack_oeffnen($1)`, [r.packId])
ok(og.art === 'geheim' && og.karten.length === 1 && og.karten[0].geheim && og.karten[0].karte?.titel === 'Der Platzwart' && og.karten[0].shiny === false, 'Geheim-Pack: „Der Platzwart“ (Kartendaten mitgeliefert, nie Shiny)')
mm = await val(MIA.f, `select album_mein()`)
ok(mm.geheim.filter((g) => g.gefunden).length === 1 && mm.geheim.find((g) => g.gefunden).karte.titel === 'Der Platzwart', 'Geheimseite: 1 von 4 gefunden, Karte sichtbar')
r = await code(MIA.f, token('wappen|7'))
ok(r.ok === false && r.grund === 'schon', 'Gleiches Ei zweimal → „schon“')
r = await code(MIA.f, token('ball|rundgang'))
ok(r.ok, 'Ball im Rundgang → Geheim-Pack')
await val(MIA.f, `select album_pack_oeffnen($1)`, [r.packId])
r = await code(MIA.f, 'g-' + token('geste|OOUULRLR').slice(2).toLowerCase())
ok(r.ok, 'Geste-Token (klein geschrieben) → eingelöst')
r = await code(MIA.f, token('geste|OOUULRLL'))
ok(r.ok === false && r.grund === 'ungueltig', 'Falsche Geste → ungültig (Fehlversuch)')
r = await code(MIA.f, token('geburtstag|kerzen'))
ok(r.ok === false && r.grund === 'nicht_heute', 'Geburtstag ohne Datum → „nicht_heute“')
await db.exec(`update sva_album_einstellungen set vereins_geburtstag = make_date(1949, extract(month from now() at time zone 'Europe/Berlin')::int, extract(day from now() at time zone 'Europe/Berlin')::int) where id = 1`)
ok((await val(asAnon, `select album_katalog()`)).regeln.vereinsGeburtstag?.length === 5, 'Katalog zeigt Geburtstag als MM-TT')
r = await code(MIA.f, token('geburtstag|kerzen'))
ok(r.ok, 'Am Vereins-Geburtstag → Geheim-Pack')
await db.exec(`update sva_album_einstellungen set vereins_geburtstag = (now() at time zone 'Europe/Berlin')::date + 3 - interval '77 years' where id = 1`)
r = await code(OLE.f, token('geburtstag|kerzen'))
ok(r.ok === false && r.grund === 'nicht_heute', 'Anderer Tag → „nicht_heute“')
// Story-Codes laufen weiter über die alte Fassung
const sc = await val(admin, `select album_admin_story_code('story', 'Story v22')`)
r = await code(OLE.f, sc.code)
ok(r.ok && r.art === 'story', 'Normale Story-Codes funktionieren weiter')
// Ei abschalten
ok((await admin(`update sva_album_geheim set aktiv = false where schluessel = 'ball' returning schluessel`)).rows.length === 1, 'Admin schaltet ein Ei ab (RLS)')
r = await code(OLE.f, token('ball|rundgang'))
ok(r.ok === false && r.grund === 'ungueltig', 'Abgeschaltetes Ei → ungültig')
ok((await val(OLE.f, `select album_mein()`)).geheim.length === 3, 'Abgeschaltetes Ei verschwindet von der Geheimseite …')
ok((await val(MIA.f, `select album_mein()`)).geheim.length === 4, '… außer für Fans, die die Karte schon haben')
ok((await LENA.f(`update sva_album_geheim set aktiv = true returning schluessel`)).rows.length === 0, 'Fan kann Eier nicht umschalten')
// Rate-Limit greift auch für Geheim-Tokens
const RATE = await fan('Rasmus', 'R')
for (let i = 0; i < 10; i++) await code(RATE.f, token('falsch|' + i))
r = await code(RATE.f, token('wappen|7'))
ok(r.ok === false && r.grund === 'gesperrt', 'Nach 10 Fehlversuchen gesperrt — auch das richtige Token')
// Geheimkarten: nicht tauschbar, keine Wunschkarte
const PLATZWART = (await one(`select id from sva_album_karten where geheim and titel = 'Der Platzwart'`)).id
await expectErr(MIA.f(`select album_wunschkarte($1, array[$2, $2, $2]::uuid[])`, [PLATZWART, PILS]), 'Geheimkarte nicht als Wunschkarte', /album_wunsch/)
await expectErr(MIA.f(`select album_tausch_anbieten($1, $2)`, [PLATZWART, PILS]), 'Geheimkarte nicht tauschbar', /album_tausch/)
ok((await one(`select count(*)::int n from sva_album_plaetze($1) p join sva_album_karten k on k.id = p.platz where k.geheim`, [MIA.id])).n === 0, 'Geheimkarten sind keine Album-Plätze')
// Admin
const ag = await val(admin, `select album_admin_geheim()`)
ok(ag.eier.length === 4 && ag.eier.find((e) => e.schluessel === 'wappen').gefunden === 1 && ag.eier.find((e) => e.schluessel === 'ball').aktiv === false && !JSON.stringify(ag).includes('token'), 'Admin „Geheimkarten“: 4 Eier, Funde, an/aus, ohne Token')
ok((await val(admin, `select album_admin_geheim_standard()`)).karten === 0, 'Standard-Geheimkarten erneut: keine Doppelten')
await expectErr(MIA.f(`select album_admin_geheim()`), 'Fan: keine Geheim-Admin-Übersicht', /album_kein_admin/)
await expectErr(db.query(`update sva_album_karten set ziehbar_von = now() where id = $1`, [PLATZWART]), 'Geheimkarte lässt sich nicht ziehbar machen (Constraint)')

// ══ E) Konto löschen ════════════════════════════════════════════════════════
await val(MIA.f, `select album_konto_loeschen()`)
ok((await one(`select count(*)::int n from sva_album_shiny where fan_user_id = $1`, [MIA.id])).n === 0, 'Konto gelöscht: Shiny-Funde weg')
const ef = await one(`select name, fan_user_id from sva_album_shiny_erstfund where roster_id = (select id from sm_roster where slug = 'p-pils')`)
ok(ef.name === 'Ein SVA-Fan' && ef.fan_user_id === null, 'Erstfund bleibt, aber anonym („Ein SVA-Fan“)')
ok((await val(OLE.f, `select album_mein()`)).shiny[0].erstfund.name === 'Ein SVA-Fan', 'Andere Fans sehen den anonymen Erstfund')

// ══ F) Frische DB: Geheimkarten erst per Admin (Migration legt ohne Katalog nichts an) ══
{
  const db2 = new PGlite()
  await db2.exec(SETUP)
  for (const f of alle.filter((f) => f <= NEU)) {
    if (f === KARTEN) await db2.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role; grant execute on all functions in schema public to anon, authenticated, service_role;`)
    await db2.exec(fs.readFileSync(M + f, 'utf8'))
  }
  ok((await db2.query(`select count(*)::int n from sva_album_karten where geheim`)).rows[0].n === 0, 'Frische DB: keine Geheimkarten ohne Katalog')
  ok((await db2.query(`select (sva_album_v22_nachziehen() ->> 'karten')::int n`)).rows[0].n === 4, 'Nachziehen (Admin-Knopf) legt die 4 Geheimkarten an')
  await db2.close()
}

console.log(fails ? `\n${fails} FEHLER` : '\nAlle v22-Tests grün.')
process.exit(fails ? 1 : 0)
