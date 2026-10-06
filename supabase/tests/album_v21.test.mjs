// PGlite-Test der Migration 20261013200000_sva_album_v21.sql:
//   · Nachziehen einer DB im Stand der echten DB (v20-Katalog mit alten
//     Bildpfaden + „Dodos Raum“ ohne Bild, 29 Standard-Ziele, Fans mit Besitz):
//     neue Bilder, „Dodos Raum“ → „Das Urknall-Banner“ (gleiche ID, Besitz bleibt),
//     Rückseiten, „Die Rote Familie“ — idempotent, Admin-Uploads unberührt.
//   · Admin-RPC album_admin_katalog_v21() (nur Admin), frische DB über
//     album_admin_katalog_standard() / album_admin_ziele_standard().
//   · „Die Rote Familie“ wird beim Sammeln der drei Spieler erreicht.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/album_v21.test.mjs <pg-ordner>/ && MIGRATIONS=<repo>/supabase/migrations/ node <pg-ordner>/album_v21.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261013200000_sva_album_v21.sql'
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
const alle = fs.readdirSync(M).filter((f) => f.endsWith('.sql')).sort()
ok(alle.includes(NEU), 'Migration vorhanden: ' + NEU)

async function neueDb(bis) {
  const db = new PGlite()
  await db.exec(SETUP)
  const defaults = () => db.exec(`grant select, insert, update, delete on all tables in schema public to anon, authenticated, service_role;
                                  grant execute on all functions in schema public to anon, authenticated, service_role;`)
  for (const f of alle.filter((f) => !bis || f < bis)) {
    if (f === KARTEN) await defaults()
    try { await db.exec(fs.readFileSync(M + f, 'utf8')) } catch (e) { console.log('FAIL migration', f, '→', e.message); process.exit(1) }
  }
  await defaults()
  return db
}
function helfer(db) {
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
  return { as, asAnon, one, val, user }
}
const expectErr = async (p, msg, re) => {
  try { await p; ok(false, msg + ' (kein Fehler!)') } catch (e) { ok(!re || re.test(e.message), msg + ' → ' + e.message.slice(0, 100)) }
}

// ══ A) Stand der echten DB (v20) → Migration v21 ══════════════════════════════
{
  const db = await neueDb(NEU)
  const { as, asAnon, one, val, user } = helfer(db)
  await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
  const CHEF = await user('chef@sva.de')
  const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
  await db.exec(`insert into sm_sponsoren (name, aktiv) values ('Mr. Döner', true)`)
  // v20-Funktionen (noch ohne v21): Katalog + Ziele wie in der echten DB
  const k0 = await val(admin, `select album_admin_katalog_standard()`)
  const z0 = await val(admin, `select album_admin_ziele_standard()`)
  ok(k0.kurve === 3 && z0.gesamt === 29, 'Ausgangslage v20: 3 Kurve-Karten, 29 Ziele ' + JSON.stringify({ k0, z0 }))
  const dodo = await one(`select id, bild_url from sva_album_karten where titel = 'Dodos Raum'`)
  ok(!!dodo && dodo.bild_url === null, 'Ausgangslage: „Dodos Raum“ ohne Bild')
  // Fans mit Besitz (u. a. Dodos Raum doppelt) + Admin hat eine Karte selbst bebildert
  const fan = await user('marvin@fan.example')
  const marvin = (sql, p) => as(fan, 'marvin@fan.example', sql, p)
  await marvin(`select album_profil_speichern('Marvin', 'A', false, false, true)`)
  const kurve = (await one(`select id from sva_album_karten where titel = 'Die Kurve'`)).id
  await db.query(`insert into sva_album_besitz (fan_user_id, karte_id, anzahl) values ($1, $2, 2), ($1, $3, 1)`, [fan, dodo.id, kurve])
  await db.exec(`update sva_album_karten set bild_url = 'https://x.supabase.co/storage/v1/object/public/sva_public/album/eigen.webp' where titel = 'Siegerfoto'`)
  const besitzVorher = (await db.query(`select karte_id, anzahl from sva_album_besitz order by karte_id`)).rows
  const zielVorher = await one(`select id, karten from sva_album_ziele where schluessel = 'die_kurve'`)

  // Migration anwenden (wie supabase db push) — zweimal: idempotent
  await db.exec(fs.readFileSync(M + NEU, 'utf8'))
  const nachher = (await db.query(`select titel, bild_url, bild_fokus, credit, rueckseite from sva_album_karten where typ in ('fan', 'moment') order by typ, sortierung`)).rows
  const t = Object.fromEntries(nachher.map((k) => [k.titel, k]))
  ok(!t['Dodos Raum'] && t['Das Urknall-Banner']?.bild_url === '/album/karten/urknall-banner.webp', '„Dodos Raum“ → „Das Urknall-Banner“ mit Foto')
  ok((await one(`select id from sva_album_karten where titel = 'Das Urknall-Banner'`)).id === dodo.id, 'Gleiche Karten-ID (nur umbenannt)')
  ok(JSON.stringify((await db.query(`select karte_id, anzahl from sva_album_besitz order by karte_id`)).rows) === JSON.stringify(besitzVorher), 'Besitz/Sammlungen der Fans unverändert')
  ok(JSON.stringify((await one(`select karten from sva_album_ziele where schluessel = 'die_kurve'`)).karten) === JSON.stringify(zielVorher.karten), 'Set „Die Kurve“ zeigt weiter auf dieselben Karten')
  const fanMom = nachher.filter((k) => k.titel !== 'Siegerfoto')
  ok(fanMom.length === 10 && fanMom.every((k) => k.bild_url.startsWith('/album/karten/') && k.bild_fokus === '50% 50%' && k.credit === 'picture by Nele'), 'Alle Kurve-/Moment-Karten: neues Bild unter /album/karten/, Fokus 50/50, Credit')
  ok(t['Siegerfoto'].bild_url.endsWith('/eigen.webp'), 'Eigenes Admin-Bild bleibt unberührt')
  ok(['Die Kurve', 'Die Fahne', 'Das Urknall-Banner'].every((n) => t[n].rueckseite?.length > 40), 'Kurve-Karten bekommen einen Rückseiten-Text')
  for (const k of fanMom) ok(fs.existsSync(new URL(`../../public${k.bild_url}`, `file://${M}`)) && fs.existsSync(new URL(`../../public${k.bild_url.replace('.webp', '-640.webp')}`, `file://${M}`)), `Bilddatei + 640er vorhanden: ${k.bild_url}`)
  const rf = await one(`select z.*, (select array_agg(r.slug order by r.slug) from sm_roster r where r.id = any (z.roster_ids)) slugs from sva_album_ziele z where schluessel = 'rote_familie'`)
  ok(rf?.titel === 'Die Rote Familie' && JSON.stringify(rf.slugs) === '["p-brettschneider","p-bruenjes","p-nauerz"]' && rf.typ === 'set' && rf.belohnung_min_seltenheit === 'silber' && /Drei Mann, drei Platzverweise/.test(rf.beschreibung),
    '„Die Rote Familie“ angelegt: Brettschneider, Brünjes, Nauerz (Set, Belohnung mind. Silber)')

  const snap = JSON.stringify((await db.query(`select id, titel, bild_url, credit, rueckseite from sva_album_karten order by id`)).rows)
  await db.exec(fs.readFileSync(M + NEU, 'utf8'))
  ok(JSON.stringify((await db.query(`select id, titel, bild_url, credit, rueckseite from sva_album_karten order by id`)).rows) === snap
    && (await one(`select count(*)::int n from sva_album_ziele`)).n === 30, 'Zweiter Lauf: nichts ändert sich (idempotent), 30 Ziele')
  let r = await val(admin, `select album_admin_katalog_v21()`)
  ok(r.umbenannt === 0 && r.bilder === 0 && r.rueckseiten === 0 && r.roteFamilie === true, 'Admin-RPC album_admin_katalog_v21(): idempotent ' + JSON.stringify(r))
  await expectErr(marvin(`select album_admin_katalog_v21()`), 'Fan darf nicht nachziehen', /album_kein_admin/)
  await expectErr(asAnon(`select album_admin_katalog_v21()`), 'anon darf nicht nachziehen')
  await expectErr(marvin(`select sva_album_v21_nachziehen()`), 'Interne Funktion nicht für Fans')
  r = await val(admin, `select album_admin_ziele_standard()`)
  ok(r.angelegt === 0 && r.gesamt === 30 && r.standard === 30, 'Standard-Ziele danach: keine Doppelten (30)')
  r = await val(admin, `select album_admin_katalog_standard()`)
  ok(r.kurve === 0 && r.momente === 0, 'Standard-Katalog danach: keine neue Kurve-/Moment-Karte (kein zweites Banner)')

  // Fan-Sicht: Katalog + Ziel in album_mein
  const kat = await val(asAnon, `select album_katalog()`)
  ok(kat.karten.filter((k) => k.typ === 'fan').every((k) => !!k.bildUrl && k.credit === 'picture by Nele'), 'album_katalog: jede Kurve-Karte mit Bild + Credit')
  const mein = await val(marvin, `select album_mein()`)
  const z = mein.ziele.find((x) => x.schluessel === 'rote_familie')
  ok(z?.benoetigt === 3 && z.fortschritt === 0 && z.belohnung.minSeltenheit === 'silber', 'album_mein: „Die Rote Familie“ 0/3')
  // Rote Familie erreichen
  const basis = async (slug) => (await one(`select k.id from sva_album_karten k join sm_roster r on r.id = k.roster_id where r.slug = $1 and not k.variante and not k.limitiert`, [slug])).id
  await db.query(`insert into sva_album_besitz (fan_user_id, karte_id, anzahl) values ($1, $2, 1), ($1, $3, 1)`, [fan, await basis('p-brettschneider'), await basis('p-nauerz')])
  const pid = (await one(`select sva_album_pack_ziehen_v20($1, 'geschenk', null, 1, null, 'Test', null, $2) id`, [fan, await basis('p-bruenjes')])).id
  const op = await val(marvin, `select album_pack_oeffnen($1)`, [pid])
  const erreicht = op.ziele.find((x) => x.schluessel === 'rote_familie')
  ok(!!erreicht?.packId, 'Dritter Rot-Sünder im Album → „Die Rote Familie“ erreicht + Bonus-Pack')
  const bonus = await one(`select karten from sva_album_packs where id = $1`, [erreicht.packId])
  const sel = await one(`select seltenheit from sva_album_karten where id = $1`, [bonus.karten[0]])
  ok(['silber', 'gold', 'spezial'].includes(sel.seltenheit), 'Bonus-Karte mind. Silber (' + sel.seltenheit + ')')
  await db.close()
}

// ══ B) Frische DB: alle Migrationen inkl. v21, dann Standard-Katalog/-Ziele ══
{
  const db = await neueDb(null)
  const { as, one, val, user } = helfer(db)
  await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
  const CHEF = await user('chef@sva.de')
  const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
  ok((await one(`select count(*)::int n from sva_album_ziele`)).n === 0, 'Frische DB: Migration legt ohne Standard-Ziele keine Rote Familie vorab an')
  const k = await val(admin, `select album_admin_katalog_standard()`)
  ok(k.kurve === 3 && k.momente === 8, 'Frischer Standard-Katalog: 3 Kurve + 8 Momente ' + JSON.stringify(k))
  const fans = (await db.query(`select titel, bild_url, credit, rueckseite from sva_album_karten where typ = 'fan' order by sortierung`)).rows
  ok(JSON.stringify(fans.map((f) => f.titel)) === '["Die Kurve","Die Fahne","Das Urknall-Banner"]' && fans.every((f) => f.bild_url && f.credit && f.rueckseite), 'Kurve: Kurve, Fahne, Urknall-Banner — alle mit Foto, Credit, Rückseite')
  ok((await one(`select count(*)::int n from sva_album_karten where typ in ('fan', 'moment') and bild_url not like '/album/karten/%'`)).n === 0, 'Keine alten /karten/-Pfade mehr im Standard')
  const z = await val(admin, `select album_admin_ziele_standard()`)
  ok(z.angelegt === 30 && (await one(`select cardinality(roster_ids) n from sva_album_ziele where schluessel = 'rote_familie'`)).n === 3, 'Standard-Ziele: 30 inkl. Rote Familie (3 Spieler)')
  await db.close()
}

console.log(fails ? `\n${fails} FEHLER` : '\nAlle v21-Tests grün.')
process.exit(fails ? 1 : 0)
