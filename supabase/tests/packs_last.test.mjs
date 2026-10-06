// PGlite-Konsistenztest v24-P „Packs unter Last“: 50 simulierte Fans tippen
// (auch doppelt abgeschickt und geändert), checken ein (auch doppelt), lösen
// einen Event-Code ein (doppelt), der Heimsieg wird eingetragen, korrigiert und
// gewertet, Ziele werden erfüllt (Packs öffnen → Meilensteine/Kapitel,
// exakter Tipp). Danach EXAKT: jeder Fan hat genau die Packs, die ihm zustehen
// — kein Verlust, kein Doppel —, jede Gutschrift ist idempotent (Unique-Key je
// Fan + Anlass), die MOTM-Karte der Woche kommt je Fan höchstens einmal, und
// die Pack-Kontrolle (sva_admin_pack_kontrolle) meldet „alles zugestellt“.
// Danach: Packs „verloren“ → Kontrolle zeigt sie, Nachliefern stellt sie
// genau einmal zu.
// Läuft gegen eine In-Memory-Postgres mit Supabase-Stubs — NIE gegen die echte DB.
//   cp <repo>/supabase/tests/packs_last.test.mjs <pg-ordner>/ && MIGRATIONS=<repo>/supabase/migrations/ node packs_last.test.mjs
import { PGlite } from '@electric-sql/pglite'
import fs from 'node:fs'
const M = process.env.MIGRATIONS || new URL('../migrations/', import.meta.url).pathname
const NEU = '20261017100000_sva_album_packs_v24.sql'
const FANS = 50
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
for (const f of files) {
  if (f === NEU) await defaults()
  await run(f)
}
await run(NEU) // zweiter Lauf: idempotent + Rechte

const claims = (uid, email) => JSON.stringify({ sub: uid, email, role: 'authenticated' })
const as = async (uid, email, sql, params) => {
  await db.exec(`set role authenticated; select set_config('request.jwt.claims', '${claims(uid, email)}', false);`)
  try { return await db.query(sql, params) } finally { await db.exec(`reset role; select set_config('request.jwt.claims', '', false);`) }
}
const one = async (sql, params) => (await db.query(sql, params)).rows[0]
const val = async (sql, params) => Object.values((await db.query(sql, params)).rows[0])[0]
const rpc = async (who, sql, p) => Object.values((await who(sql, p)).rows[0])[0]
const fehlerVon = async (p) => { try { await p; return null } catch (e) { return e.message } }
const user = async (email) => (await one(`insert into auth.users (email, raw_user_meta_data) values ($1, '{"app":"sva-album"}') returning id`, [email])).id

await db.exec(`insert into sm_admins (email) values ('chef@sva.de') on conflict do nothing;`)
const CHEF = await user('chef@sva.de')
const admin = (sql, p) => as(CHEF, 'chef@sva.de', sql, p)
await admin(`select album_admin_katalog_standard()`)
await admin(`select album_admin_ziele_standard()`)
// MOTM der Woche (Ziehfenster jetzt) — für den Wochen-Slot
const ROSTER = (await one(`select id from sm_roster where aktiv and rolle = 'spieler' order by sortierung nulls last limit 1`)).id
const VORHER = (await one(`insert into sm_spiele (gegner, heim, anstoss, tore_sva, tore_gegner) values ('TSV Vorwoche', false, now() - interval '3 days', 1, 0) returning id`)).id
await db.query(`insert into sva_tipp_spieltage (spiel_id, tippbar, gewertet_at) values ($1, false, now())`, [VORHER])
const MOTM = (await rpc(admin, `select album_admin_motm($1, $2)`, [ROSTER, VORHER])).id

// ── Fans ────────────────────────────────────────────────────────────────────
const fans = []
for (let i = 0; i < FANS; i++) {
  const mail = `fan${i}@last.example`
  const id = await user(mail)
  const f = { i, id, mail, q: (sql, p) => as(id, mail, sql, p), tipp: false, checkin: false, event: false }
  await f.q(`select tipp_beitreten($1, 'L', true, true, true)`, ['Fan' + String.fromCharCode(65 + (i % 26)) + 'x'])
  fans.push(f)
}
// Starter: jeder holt ihn (die Hälfte doppelt)
for (const f of fans) {
  await f.q(`select album_starter_holen()`)
  if (f.i % 2 === 0) await f.q(`select album_starter_holen()`)
}

// ── Tipps: 40 tippen, 15 schicken denselben Tipp nochmal, 10 ändern ────────
const G = (await admin(`insert into sm_spiele (gegner, heim, anstoss, wettbewerb) values ('SG Lühe', true, now() + interval '2 days', 'Kreisliga Stade') returning id`)).rows[0].id
let packIdsAusAbgabe = 0
for (const f of fans) {
  if (f.i % 5 === 0) continue
  const [a, b] = f.i % 4 === 0 ? [2, 1] : [f.i % 3, 1]
  const r = await rpc(f.q, `select tipp_abgeben($1, $2, $3) j`, [G, a, b])
  if (r.packId && r.pack?.karten === 2) packIdsAusAbgabe++
  f.tipp = true
  f.exakt = a === 2 && b === 1
  if (f.i % 3 === 0) await rpc(f.q, `select tipp_abgeben($1, $2, $3) j`, [G, a, b]) // doppelt abgeschickt
  if (f.i % 7 === 0) { await rpc(f.q, `select tipp_abgeben($1, 2, 1) j`, [G]); f.exakt = true } // geändert
}
const tipper = fans.filter((f) => f.tipp)
ok(packIdsAusAbgabe === tipper.length, `Jede erste Abgabe meldet ihr Tipp-Pack (${packIdsAusAbgabe}/${tipper.length})`)

// ── Anpfiff, Check-ins (30, davon 10 doppelt) ──────────────────────────────
await db.exec(`update sm_spiele set anstoss = now() - interval '10 minutes' where id = '${G}'`)
const token = (await rpc(admin, `select album_admin_code($1)`, [G])).token
let doppeltAbgelehnt = 0
for (const f of fans) {
  if (f.i % 5 === 1) continue
  if (fans.filter((x) => x.checkin).length >= 30) break
  const r = await rpc(f.q, `select album_checkin($1)`, [token])
  if (r.ok) f.checkin = true
  if (f.i % 3 === 1 && /album_schon_eingecheckt/.test((await fehlerVon(f.q(`select album_checkin($1)`, [token]))) ?? '')) doppeltAbgelehnt++
}
const drin = fans.filter((f) => f.checkin)
ok(drin.length === 30 && doppeltAbgelehnt > 0, `30 Check-ins, doppelte abgelehnt (${doppeltAbgelehnt})`)

// ── Heimsieg: eintragen, korrigieren, werten ───────────────────────────────
await admin(`update sm_spiele set tore_sva = 2, tore_gegner = 1, status = 'beendet' where id = $1`, [G])
await admin(`update sm_spiele set tore_sva = 3 where id = $1`, [G]) // Korrektur
await admin(`update sm_spiele set tore_sva = 2 where id = $1`, [G]) // zurück
await db.exec(`select sva_album_heimsieg_bonus('${G}'); select sva_album_heimsieg_bonus('${G}');`) // Wiederholung
const ber = await rpc(admin, `select tipp_admin_bericht($1) j`, [G])
await admin(`select tipp_admin_bericht_speichern($1, $2, $3, $4, null)`, [G, JSON.stringify(ber.zeilen.filter((z) => z.eingesetzt)), JSON.stringify(ber.aufloesung ?? {}), ber.ersterTorschuetze ?? null])
const w = await rpc(admin, `select tipp_admin_werten($1) j`, [G])
ok(w.ok, 'Spiel gewertet ' + JSON.stringify(w).slice(0, 80))
const w2 = await fehlerVon(admin(`select tipp_admin_werten($1) j`, [G]))
console.log('     (zweites Werten:', w2 ?? 'ok', ')')

// ── Event-Code (20 Fans, je zweimal) ───────────────────────────────────────
const code = (await rpc(admin, `select album_admin_story_code('event', 'MOTM-Woche', $1, null, 48)`, [MOTM])).code
for (const f of fans.slice(0, 20)) {
  const r1 = await rpc(f.q, `select album_code_einloesen($1)`, [code])
  const r2 = await rpc(f.q, `select album_code_einloesen($1)`, [code])
  f.event = r1.ok && r2.ok === false && r2.grund === 'schon'
}
ok(fans.slice(0, 20).every((f) => f.event), 'Event-Code: 20 × eingelöst, zweiter Versuch je „schon“')

// ── Packs öffnen (25 Fans, solange etwas wartet) → Ziele, Kapitel ──────────
for (const f of fans.slice(10, 35)) {
  for (let n = 0; n < 30; n++) {
    const m = await rpc(f.q, `select album_mein()`)
    if (!m.packs.length) break
    await rpc(f.q, `select album_pack_oeffnen($1)`, [m.packs[0].id])
    if (n % 4 === 0) await rpc(f.q, `select album_pack_oeffnen($1)`, [m.packs[0].id]) // doppelt geöffnet
  }
}

// ── Exakte Prüfung je Fan ──────────────────────────────────────────────────
const zaehle = async (fan, art, extra = '', p = []) => val(`select count(*)::int n from sva_album_packs where fan_user_id = $1 and art = $2 ${extra}`, [fan, art, ...p])
let abw = []
for (const f of fans) {
  const soll = { starter: 1, tipp: f.tipp ? 1 : 0, checkin: f.checkin ? 1 : 0, heimsieg: f.tipp || f.checkin ? 1 : 0, event: f.event ? 1 : 0 }
  for (const [art, n] of Object.entries(soll)) {
    const ist = await zaehle(f.id, art)
    if (ist !== n) abw.push(`${f.mail} ${art}: soll ${n}, ist ${ist}`)
  }
  // Ziel-Packs: genau eins je erreichtem Ziel mit Karten (Quelle = Ziel:Bezug)
  const ziele = (await db.query(`select e.ziel_id, e.bezug, e.pack_id, z.belohnung_karten from sva_album_ziel_erreicht e join sva_album_ziele z on z.id = e.ziel_id where e.fan_user_id = $1`, [f.id])).rows
  for (const z of ziele) {
    const n = await zaehle(f.id, 'ziel', `and quelle = $3`, [`${z.ziel_id}:${z.bezug}`])
    if (n !== (z.belohnung_karten > 0 ? 1 : 0)) abw.push(`${f.mail} Ziel ${z.ziel_id}: ${n}`)
  }
  const fremdeZielPacks = await val(`select count(*)::int n from sva_album_packs p where p.fan_user_id = $1 and p.art = 'ziel'
    and not exists (select 1 from sva_album_ziel_erreicht e where e.fan_user_id = p.fan_user_id and p.quelle = e.ziel_id::text || ':' || e.bezug)`, [f.id])
  if (fremdeZielPacks) abw.push(`${f.mail}: ${fremdeZielPacks} Ziel-Packs ohne erreichtes Ziel`)
}
ok(abw.length === 0, `Alle ${FANS} Fans: genau die zustehenden Packs (Starter, Tipp, Check-in, Sieg, Event, Ziele) ${abw.slice(0, 5).join(' | ')}`)
const zielPacks = await val(`select count(*)::int n from sva_album_packs where art = 'ziel'`)
const exakt = await val(`select count(*)::int n from sva_album_ziel_erreicht e join sva_album_ziele z on z.id = e.ziel_id where z.schluessel = 'tipp_exakt'`)
ok(zielPacks > 0 && exakt === fans.filter((f) => f.tipp && f.exakt).length, `Ziele erfüllt: ${zielPacks} Ziel-Packs, „Exakt getippt“ ${exakt}× (= exakte Tipper)`)
const doppel = await val(`select count(*)::int n from (select fan_user_id, art, coalesce(spiel_id::text, quelle, id::text) a, count(*) c
                              from sva_album_packs group by 1, 2, 3 having count(*) > 1) x`)
ok(doppel === 0, 'Kein Fan hat ein Pack doppelt (je Fan + Art + Anlass)')
const motmDoppelt = await val(`select count(*)::int n from (select p.fan_user_id from sva_album_packs p, unnest(p.karten) k where k = $1 group by 1 having count(*) > 1) x`, [MOTM])
const motmFans = await val(`select count(distinct p.fan_user_id)::int n from sva_album_packs p where $1 = any (p.karten)`, [MOTM])
ok(motmDoppelt === 0, `MOTM-Karte der Woche je Fan höchstens einmal (${motmFans} von ${FANS} Fans haben sie)`)
const besitzMotm = await val(`select coalesce(max(anzahl), 0)::int n from sva_album_besitz where karte_id = $1`, [MOTM])
ok(besitzMotm <= 1, 'Besitz: MOTM nie doppelt')
const eventTypen = await val(`select count(*)::int n from sva_album_packs where art = 'event' and typ = 'event' and cardinality(karten) = 3`)
ok(eventTypen === 20, 'Event-Packs: 20 × typ event mit 3 Karten')
const ohneTyp = await val(`select count(*)::int n from sva_album_packs where art in ('tipp', 'checkin', 'heimsieg', 'starter', 'ziel', 'event') and typ is null`)
ok(ohneTyp === 0, 'Jedes neue Pack trägt seinen Pack-Typ')

// ── Pack-Kontrolle ─────────────────────────────────────────────────────────
await db.exec(`update sva_album_fans set created_at = now() - interval '1 hour'`) // Starter zählen mit
let k = await rpc(admin, `select sva_admin_pack_kontrolle()`)
ok(k.ok === true && k.fehlend === 0 && k.doppelt === 0 && k.soll === k.ist && k.soll > 150, `Kontrolle: alles zugestellt ✓ (Soll ${k.soll} = Ist ${k.ist})`)
const ank = (a) => k.anlaesse.find((x) => x.anlass === a)
ok(ank(`spiel:${G}:tipp`)?.soll === tipper.length && ank(`spiel:${G}:checkin`)?.soll === 30
  && ank(`spiel:${G}:sieg`)?.soll === fans.filter((f) => f.tipp || f.checkin).length && ank('starter')?.soll === FANS,
  `Kontrolle je Anlass: Tipp ${tipper.length}, Check-in 30, Sieg ${fans.filter((f) => f.tipp || f.checkin).length}, Starter ${FANS}`)

// „Verlust“ simulieren: 4 Packs weg (Tipp, Sieg, Check-in, Ziel)
const opfer = fans.find((f) => f.tipp && f.checkin && f.i >= 35)
await db.query(`delete from sva_album_packs where fan_user_id = $1 and art in ('tipp', 'heimsieg', 'checkin')`, [opfer.id])
const zielOpfer = await one(`select p.id, p.fan_user_id from sva_album_packs p where p.art = 'ziel' and p.geoeffnet_at is null limit 1`)
if (zielOpfer) await db.query(`delete from sva_album_packs where id = $1`, [zielOpfer.id])
const verloren = 3 + (zielOpfer ? 1 : 0)
k = await rpc(admin, `select sva_admin_pack_kontrolle()`)
ok(!k.ok && k.fehlend === verloren && k.anlaesse.slice(0, verloren).every((a) => a.fehlend === 1), `Kontrolle meldet ${verloren} fehlende Packs (oben in der Liste)`)
let nl = await rpc(admin, `select album_admin_pack_nachliefern('alle')`)
ok(nl.nachgeliefert === verloren && nl.offen === 0, `Nachliefern: ${nl.nachgeliefert} zugestellt, 0 offen`)
nl = await rpc(admin, `select album_admin_pack_nachliefern('alle')`)
ok(nl.nachgeliefert === 0, 'Nachliefern erneut → nichts doppelt')
k = await rpc(admin, `select sva_admin_pack_kontrolle()`)
ok(k.ok && k.fehlend === 0 && k.doppelt === 0, 'Kontrolle danach wieder: alles zugestellt ✓')
ok((await zaehle(opfer.id, 'tipp')) === 1 && (await zaehle(opfer.id, 'heimsieg')) === 1 && (await zaehle(opfer.id, 'checkin')) === 1, 'Fan hat nach dem Nachliefern wieder genau je 1 Tipp-/Sieg-/Spieltags-Pack')

// Wiederholungen nach allem: nichts ändert sich
const vorher = await val(`select count(*)::int n from sva_album_packs`)
await db.exec(`select sva_album_heimsieg_bonus('${G}')`)
for (const f of fans.slice(0, 10)) { await f.q(`select album_starter_holen()`); if (f.tipp) await fehlerVon(f.q(`select tipp_abgeben($1, 2, 1)`, [G])) }
ok((await val(`select count(*)::int n from sva_album_packs`)) === vorher, `Wiederholte Aufrufe (Bonus, Starter, Tipp nach Anpfiff) → keine neuen Packs (${vorher})`)

console.log(fails ? `\n${fails} FEHLER` : `\nALLES GRÜN (${oks} Prüfungen)`)
process.exit(fails ? 1 : 0)
