// Monte-Carlo-Simulation der Sammelkarten-Ökonomie v20 + v22 + v24 (ohne Datenbank).
//
// v24-P (supabase/migrations/20261017100000_sva_album_packs_v24.sql): PACK-TYPEN
//   (sva_album_pack_typen: Karten, Garantie, Wochen-Slot-Chance je Typ),
//   Sieg-Pack für alle, die getippt ODER eingecheckt haben, Derby-Check-in =
//   Event-Pack, Event-Codes. WOCHEN-SLOT: jedes Pack würfelt EINMAL mit der
//   Chance seines Typs auf die gerade ziehbare limitierte Wochenkarte (MOTM,
//   Derby) und ersetzt dann die letzte Karte (nur, wenn der Fan sie noch nicht hat).
//
// MUSS ZUR MIGRATION PASSEN: supabase/migrations/20261012110000_sva_karten.sql
// und (v22, Shiny) supabase/migrations/20261014110000_sva_album_v22.sql:
//   · jede gezogene Spieler-/Trainer-Karte (nicht limitiert) ist mit
//     1 : shiny_chance zusätzlich Shiny (sva_album_pack_shiny) — ändert an der
//     Ziehung NICHTS (gleiche Karte, gleicher Platz), zählt nicht fürs Album.
//   · Geheimkarten werden nie gezogen (nur Easter Eggs) → hier nicht simuliert.
//   · Ziehung = sva_album_pack_ziehen_v20 / sva_album_karte_waehlen
//     (Seltenheit nach Gewicht nur aus Stufen mit ziehbaren Karten, Smart-Pack
//     auf der ersten Karte, Doppelten-Bremse, Mindest-Seltenheit)
//   · Standard-Katalog = album_admin_katalog_standard()
//   · Standard-Ziele   = album_admin_ziele_standard()
//   · Parameter-Namen  = Spalten von sva_album_einstellungen
// Wer dort etwas ändert, ändert es hier mit (und umgekehrt).
//
// Aufruf:  node scripts/karten-simulation.mjs            (10 000 Läufe je Persona)
//          node scripts/karten-simulation.mjs 2000 8     (Läufe, Anzahl Partner)
//          node scripts/karten-simulation.mjs 2000 6 1 50 (+ smart_pack_belohnung 0/1, doppelte_bremse)
//          node scripts/karten-simulation.mjs 10000 6 0 25 100   (+ shiny_chance, z. B. 1 : 100)
//          ALT=1 node scripts/karten-simulation.mjs          (Vergleich: v20-Ökonomie, je 1 Karte, Bremse 25, Wunsch 3)
// Ergebnis steht in docs/KARTEN.md (Abschnitt „Ökonomie & Ziehung").

// ── Einstellungen (= Defaults der Migration) ──────────────────────────────────
export const EINSTELLUNGEN = {
  gewicht_bronze: 70, gewicht_silber: 22, gewicht_gold: 7, gewicht_spezial: 1,
  karten_pro_pack: 3,        // Check-in-Pack
  karten_starter: 5, starter_min_silber: true,
  karten_heimsieg: 1, karten_tipp: 1, karten_story: 1, karten_freund: 1, karten_kapitel: 1,
  doppelte_bremse: 5,        // % (v20: 25; v24 gesenkt — größere Packs liefern genug Neue)
  smart_pack: true,
  smart_ab_karten: 2,        // v24: Smart-Pack nur in Packs ab 2 Karten (Story/Advent/Freund = reine Zufallskarte)
  smart_pack_belohnung: false, // Smart-Pack auch in Belohnungs-Packs (Ziele/Kapitel)?
  tausch_min_tage: 7, tausch_pro_woche: 5, wunsch_kosten: 5, // v24: Wunsch 3 → 5 (mehr Doppelte im Umlauf)
  schwelle_1: 3, schwelle_2: 6, schwelle_3: 8,
  lose_checkin: 1, lose_komplett: 5,
  shiny_chance: 250,         // v22: 1 : N je Spieler-/Trainer-Karte, 0 = aus
}
export const PARTNER_SELTENHEIT = 'bronze' // album_admin_katalog_standard: Partnerkarten
// v24: Pack-Typen (= Startwerte von sva_album_pack_typen). chance = Wochen-Slot in %.
export const PACK_TYPEN = {
  tipp:     { karten: 2, min: null,     chance: 8 },
  spieltag: { karten: 4, min: 'silber', chance: 30 },
  sieg:     { karten: 2, min: 'gold',   chance: 30 },
  starter:  { karten: 5, min: 'silber', chance: 0 },
  ziel:     { karten: 1, min: null,     chance: 0 },  // Kapitel-Bonus; Ziele haben eigene Kartenzahl
  event:    { karten: 3, min: null,     chance: 60 },
}
// Event-Codes je Saison (Derby-Woche, 2× MOTM-Woche, Winter-Aktion) — Einlösequote wie Story
const EVENT_CODES = ['2026-10-21', '2026-11-11', '2027-03-17', '2027-04-07']
// v20-Vergleich: ALT=1 → alte Ökonomie (je 1 Karte, Check-in 3, kein Wochen-Slot, Sieg nur Check-in)
const ALT = process.env.ALT === '1'
// Vergleichsläufe: PT='{"tipp":{"chance":10}}'  E='{"doppelte_bremse":0}'  KURZ=1 (eine Zeile)
if (process.env.PT) for (const [k, v] of Object.entries(JSON.parse(process.env.PT))) PACK_TYPEN[k] = { ...PACK_TYPEN[k], ...v }
if (process.env.E) Object.assign(EINSTELLUNGEN, JSON.parse(process.env.E))
if (ALT) {
  Object.assign(EINSTELLUNGEN, { doppelte_bremse: 25, wunsch_kosten: 3, smart_ab_karten: 1 })
  Object.assign(PACK_TYPEN, { tipp: { karten: 1, min: null, chance: 0 }, spieltag: { karten: 3, min: null, chance: 0 }, sieg: { karten: 1, min: null, chance: 0 }, event: { karten: 0, min: null, chance: 0 } })
}

const STUFEN = ['bronze', 'silber', 'gold', 'spezial']
const RANG = { bronze: 1, silber: 2, gold: 3, spezial: 4 }
const LAEUFE = Number(process.argv[2] || 10000)
const PARTNER = Number(process.argv[3] || 6) // aktive Sponsoren (Annahme)
if (process.argv[4]) EINSTELLUNGEN.smart_pack_belohnung = process.argv[4] === '1' // Vergleichslauf
if (process.argv[5]) EINSTELLUNGEN.doppelte_bremse = Number(process.argv[5])      // Vergleichslauf
if (process.argv[6]) EINSTELLUNGEN.shiny_chance = Number(process.argv[6])         // Vergleichslauf

// ── Zufall (seedbar → reproduzierbare Tabelle) ────────────────────────────────
let s0 = 0x9e3779b9
const rnd = () => { s0 |= 0; s0 = (s0 + 0x6d2b79f5) | 0; let t = Math.imul(s0 ^ (s0 >>> 15), 1 | s0); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (arr) => arr[Math.floor(rnd() * arr.length)]

// ── Standard-Katalog v20 (wie album_admin_katalog_standard) ───────────────────
// Kader laut sm_roster: 2 TW, 9 ABW, 10 MIT (inkl. Kapitän), 3 ANG + 3 Trainerstab.
function katalog() {
  const K = []
  let id = 0
  const add = (o) => { const k = { id: id++, variante: false, limitiert: false, nurSpiel: null, von: null, bis: null, ...o }; k.album = !k.variante && !k.limitiert; k.platz = k.platz ?? 'k' + k.id; K.push(k); return k }
  const kader = [['TW', 2], ['ABW', 9], ['MIT', 10], ['ANG', 3]]
  let nr = 0
  for (const [pos, n] of kader) for (let i = 0; i < n; i++) {
    const p = 'r' + nr++
    const kapitaen = pos === 'MIT' && i === 7
    add({ typ: 'spieler', selt: kapitaen ? 'gold' : 'bronze', platz: p, kapitel: pos, roster: p })
    add({ typ: 'spieler', selt: 'silber', variante: true, platz: p, kapitel: pos, roster: p })
  }
  // s0 Trainer, s1 Co-Trainer (Adolf Ebeling), s2 Teammanager
  for (let i = 0; i < 3; i++) add({ typ: 'trainer', selt: 'gold', platz: 's' + i, kapitel: 'stab' })
  const momente = [['spezial', 'Meister 2026'], ['gold', 'Meister 2026'], ['gold', 'Meister 2026'], ['silber', 'Meister 2026'],
    ['spezial', 'Urknall-Pokal 2026'], ['gold', 'Urknall-Pokal 2026'], ['gold', 'Urknall-Pokal 2026'], ['silber', 'Urknall-Pokal 2026']]
  for (const [selt, serie] of momente) add({ typ: 'moment', selt, serie, kapitel: 'moment' })
  for (const selt of ['silber', 'bronze', 'silber']) add({ typ: 'fan', selt, kapitel: 'fan' })
  for (let i = 0; i < PARTNER; i++) add({ typ: 'partner', selt: PARTNER_SELTENHEIT, kapitel: 'partner' })
  return { K, add }
}

// ── Kalender Restsaison (heute 06.10.2026 bis 31.05.2027) ─────────────────────
// 17 Spieltage, 8 Heimspiele, Winterpause Dezember bis Februar.
const tag = (s) => Math.round((Date.parse(s) - Date.parse('2026-10-06')) / 864e5)
const SPIELTAGE = ['2026-10-11', '2026-10-18', '2026-10-25', '2026-11-01', '2026-11-08', '2026-11-15', '2026-11-22', '2026-11-29',
  '2027-03-07', '2027-03-14', '2027-03-21', '2027-04-04', '2027-04-11', '2027-04-18', '2027-04-25', '2027-05-09', '2027-05-23']
  .map((d, i) => ({ t: tag(d), heim: [0, 2, 4, 6, 8, 11, 13, 15].includes(i), derby: i === 11 }))
const ENDE = tag('2027-05-31')
const DEZ = [tag('2026-12-01'), tag('2026-12-24')]
// Story-Codes ~1 pro Woche (mittwochs), nicht im Dezember (dann Adventskalender)
const STORIES = []
for (let t = tag('2026-10-07'); t <= ENDE; t += 7) if (t < tag('2026-12-01') || t > tag('2026-12-31')) STORIES.push(t)
const monat = (t) => new Date(Date.parse('2026-10-06') + t * 864e5).toISOString().slice(0, 7)

// ── Personas ──────────────────────────────────────────────────────────────────
// heim = Anteil besuchter Heimspiele, tipp = Anteil getippter Spieltage, story/advent
// = Anteil eingelöster Codes, freund = Anteil Heimspiele mit eingechecktem Freund.
const PERSONAS = [
  { name: 'Gelegenheits-Follower', ziel: '55–60 % (v24: ~41 Karten)', heim: 0.15, tipp: 0.25, story: 0.2, advent: 0.2, freund: 0, tausch: 0, wunsch: false },
  { name: 'Typischer Follower', ziel: '~70 % (v24: ~50 Karten)', heim: 0.25, tipp: 0.3, story: 0.2, advent: 0.2, freund: 0.2, tausch: 0, wunsch: false },
  { name: 'Stammfan', ziel: 'komplett ~April/Mai (Tausch)', heim: 0.75, tipp: 0.4, story: 0.15, advent: 0.15, freund: 0.3, tausch: 0.35, wunsch: true },
]
const P_HEIMSIEG = 0.6
const P_TIPP_EXAKT = 0.1      // Ziel „tipp_exakt" (extern, 1 Karte mind. Silber)
const P_KAPITAEN_TRIFFT = 0.05 // Ziel „tipp_kapitaen_trifft" (extern, 1 Karte)

// ── Ziehung (1:1 wie sva_album_karte_waehlen) ─────────────────────────────────
const E = EINSTELLUNGEN
const gewicht = (s) => E['gewicht_' + s]
function stufeZiehen(stufen) {
  const st = STUFEN.filter((s) => stufen.includes(s) && gewicht(s) > 0)
  const total = st.reduce((a, s) => a + gewicht(s), 0)
  if (total <= 0) return null
  let r = rnd() * total
  for (const s of st) { if (r < gewicht(s)) return s; r -= gewicht(s) }
  return st[st.length - 1]
}
function karteWaehlen(fan, ziehbar, erlaubt, smart, pack, packPlaetze) {
  const vorhanden = [...new Set(ziehbar.filter((k) => erlaubt.includes(k.selt)).map((k) => k.selt))]
  if (!vorhanden.length) return null
  let s = stufeZiehen(vorhanden)
  const fehlt = (k) => k.album && !fan.plaetze.has(k.platz) && !packPlaetze.has(k.platz)
  if (smart) {
    let c = ziehbar.filter((k) => k.selt === s && fehlt(k))
    if (!c.length) {
      const fs =[...new Set(ziehbar.filter((k) => erlaubt.includes(k.selt) && fehlt(k)).map((k) => k.selt))]
      const s2 = fs.length ? stufeZiehen(fs) : null
      if (s2) c = ziehbar.filter((k) => k.selt === s2 && fehlt(k))
    }
    if (c.length) return pick(c)
  }
  if (rnd() * 100 < E.doppelte_bremse) {
    const c = ziehbar.filter((k) => (s === null || k.selt === s) && erlaubt.includes(k.selt) && !fan.besitz.has(k.id) && !pack.includes(k))
    if (c.length) return pick(c)
  }
  const c = ziehbar.filter((k) => (s === null || k.selt === s) && erlaubt.includes(k.selt))
  return c.length ? pick(c) : null
}
function packZiehen(fan, kat, t, { n, spiel = null, minSelt = null, fest = null, ziel = false, typ = null }) {
  // v24: Größe/Garantie aus dem Pack-Typ, wenn nicht übergeben
  const T = typ ? PACK_TYPEN[typ] : null
  n = n ?? T?.karten ?? E.karten_pro_pack
  minSelt = minSelt ?? T?.min ?? null
  if (n <= 0) return []
  // Smart-Pack: erste Karte jedes Zufalls-Packs; Belohnungs-Packs (Ziele, Kapitel) nur mit smart_pack_belohnung
  // v24: Smart je Pack-Typ abschaltbar (T.smart === false, z. B. Sieg-Pack als Bonus)
  const smart = E.smart_pack && !fest && (!ziel || E.smart_pack_belohnung) && T?.smart !== false && n >= (E.smart_ab_karten ?? 1)
  const alleZiehbar = kat.filter((k) => (k.von === null || k.von <= t) && (k.bis === null || k.bis > t) && (k.nurSpiel === null || k.nurSpiel === spiel)
    && (!k.limitiert || k.von !== null || k.bis !== null || k.nurSpiel !== null))
  // v24: limitierte Wochenkarten nur über den Wochen-Slot (ALT=1: wie v20 in der normalen Ziehung)
  const ziehbar = ALT ? alleZiehbar : alleZiehbar.filter((k) => !k.limitiert)
  const wochenKarten = alleZiehbar.filter((k) => k.limitiert)
  const pack = []
  const pp = new Set()
  for (let i = 0; i < n; i++) {
    const k = i === 0 && fest ? fest : karteWaehlen(fan, ziehbar, STUFEN, smart && i === 0, pack, pp)
    if (!k) break
    pack.push(k); if (k.album) pp.add(k.platz)
  }
  if (minSelt && pack.length && !pack.some((k) => RANG[k.selt] >= RANG[minSelt]) && !(pack.length === 1 && fest)) {
    const alt = pack.pop()
    const pp2 = new Set(pack.filter((k) => k.album).map((k) => k.platz))
    const k = karteWaehlen(fan, ziehbar, STUFEN.filter((s) => RANG[s] >= RANG[minSelt]), smart && pack.length === 0, pack, pp2)
    pack.push(k || alt)
  }
  // v24 Wochen-Slot (sva_album_pack_ziehen_v24): EIN Wurf je Pack
  if (T?.chance > 0 && !fest && pack.length && rnd() * 100 < T.chance) {
    const kand = wochenKarten.filter((k) => !fan.besitz.has(k.id) && !pack.includes(k))
    if (kand.length) {
      const ev = pick(kand)
      if (pack.length === 1) pack.push(ev)
      else for (let j = pack.length - 1; j >= 1; j--) {
        const ok = !minSelt || RANG[ev.selt] >= RANG[minSelt] || pack.some((k, i) => i !== j && RANG[k.selt] >= RANG[minSelt])
        if (ok) { pack[j] = ev; break }
      }
    }
  }
  return pack
}

// ── Ein Fan, eine Saison ──────────────────────────────────────────────────────
function lauf(persona) {
  const { K, add } = katalog()
  const album = K.filter((k) => k.album)
  const alleP = new Set(album.map((k) => k.platz))
  const kapitelP = {}
  for (const k of album) (kapitelP[k.kapitel] ??= new Set()).add(k.platz)
  const fan = { besitz: new Map(), plaetze: new Set(), karten: 0, lose: 0, komplettT: null, ziele: new Set(), tauschT: -99, wochenTausche: [], personKarten: 0, shiny: 0, shinyPersonen: new Set() }
  // gezogen = aus einem Pack (nur dort entscheidet der Shiny-Trigger); Tausch zählt nicht
  const zuschreiben = (pack, t, gezogen = true) => {
    for (const k of pack) {
      fan.besitz.set(k.id, (fan.besitz.get(k.id) || 0) + 1); if (k.album) fan.plaetze.add(k.platz); fan.karten++
      if (gezogen && (k.typ === 'spieler' || k.typ === 'trainer') && !k.limitiert) {
        fan.personKarten++
        if (E.shiny_chance > 0 && rnd() * E.shiny_chance < 1) { fan.shiny++; fan.shinyPersonen.add(k.platz) }
      }
    }
    pruefeSammelziele(t)
  }
  const pack = (t, opt) => zuschreiben(packZiehen(fan, K, t, opt), t)
  const ziel = (key, t, opt) => { if (fan.ziele.has(key)) return; fan.ziele.add(key); if (opt.lose) fan.lose += opt.lose; if (opt.n) pack(t, { n: opt.n, minSelt: opt.min, ziel: true }) }
  // Standard-Ziele (album_admin_ziele_standard): Sets, Kapitel, Meilensteine
  const sets = {
    zwillinge: new Set(['r16', 'r17']),                    // p-pejas-n + p-pejas-e
    warkehr: new Set(['r10', 'r21']),                      // p-warkehr-i (ABW) + p-warkehr-a (ANG)
    vater_sohn: new Set(['s1', 'r1']),                     // s-ebeling-a (Trainerstab) + p-ebeling-t
    familie: new Set(['r16', 'r17', 'r10', 'r21', 's1', 'r1']), // „Familie SVA" = alle Familien-Paare
    rueckennummern: new Set(['r0', 'r2', 'r3', 'r4', 'r11', 'r12', 'r13', 'r21', 'r22']), // Nummern 1–11 (9 Spieler)
    meister_2026: new Set(album.filter((k) => k.serie === 'Meister 2026').map((k) => k.platz)),
    die_kurve: kapitelP.fan, partner_set: kapitelP.partner,
  }
  const setMin = { meister_2026: 'spezial', familie: 'gold' }
  const setN = { familie: 3 }
  function pruefeSammelziele(t) {
    for (const [key, ps] of Object.entries(sets)) if (ps.size && [...ps].every((p) => fan.plaetze.has(p))) ziel(key, t, { n: setN[key] || 1, min: setMin[key] })
    for (const [kap, ps] of Object.entries(kapitelP)) if ([...ps].every((p) => fan.plaetze.has(p))) ziel('kapitel_' + kap, t, { n: PACK_TYPEN.ziel.karten })
    const pct = (100 * fan.plaetze.size) / alleP.size
    for (const [m, lose] of [[10, 1], [25, 1], [50, 2], [75, 3], [100, 5]]) if (pct >= m) ziel('meilenstein_' + m, t, { n: 1, lose })
    if (fan.plaetze.size === alleP.size && fan.komplettT === null) { fan.komplettT = t; fan.lose += E.lose_komplett }
  }
  // Tausch + Wunschkarte (Stammfan)
  const doppelte = () => [...fan.besitz].filter(([id, n]) => n >= 2 && !K[id].limitiert)
  const fehlendeAlbum = () => album.filter((k) => !fan.plaetze.has(k.platz))
  function tauschen(t) {
    const woche = fan.wochenTausche.filter((x) => x > t - 7)
    if (t < E.tausch_min_tage || woche.length >= E.tausch_pro_woche || rnd() >= persona.tausch) return
    const d = doppelte(); const f = fehlendeAlbum()
    if (!d.length || !f.length) return
    const [gibId] = pick(d)
    fan.besitz.set(gibId, fan.besitz.get(gibId) - 1)
    zuschreiben([pick(f)], t, false)
    fan.wochenTausche.push(t)
    ziel('erster_tausch', t, { n: 1 })
  }
  function wuenschen(t) {
    if (!persona.wunsch) return
    for (;;) {
      const f = fehlendeAlbum().filter((k) => k.selt === 'bronze' || k.selt === 'silber')
      const spare = doppelte().reduce((a, [, n]) => a + n - 1, 0)
      if (!f.length || spare < E.wunsch_kosten) return
      let rest = E.wunsch_kosten
      for (const [id, n] of doppelte()) { const ab = Math.min(rest, n - 1); fan.besitz.set(id, n - ab); rest -= ab; if (!rest) break }
      zuschreiben([pick(f)], t)
    }
  }
  // Limitierte Karten
  const weihnacht = add({ typ: 'moment', selt: 'spezial', limitiert: true, kapitel: 'moment' })
  let serie = 0
  const tippWochen = new Set()
  // ── Ablauf ──
  pack(0, { typ: 'starter' })
  const ereignisse = []
  for (const s of SPIELTAGE) ereignisse.push({ t: s.t, art: 'spieltag', s })
  for (const t of STORIES) ereignisse.push({ t, art: 'story' })
  for (const d of EVENT_CODES) ereignisse.push({ t: tag(d), art: 'event' })
  for (let t = DEZ[0]; t <= DEZ[1]; t++) ereignisse.push({ t, art: 'advent', tag: t - DEZ[0] + 1 })
  for (let t = 7; t <= ENDE; t += 7) ereignisse.push({ t, art: 'woche' })
  ereignisse.sort((a, b) => a.t - b.t)
  // v24: MOTM-Wochenkarten (Fenster + ob der Fan in diesem Fenster getippt / eingecheckt hat)
  const motm = []
  for (const e of ereignisse) {
    const t = e.t
    if (e.art === 'spieltag') {
      const s = e.s
      const imFenster = motm.filter((m) => m.k.von <= t && t < m.k.bis)
      imFenster.forEach((m) => (m.heim = s.heim))
      let getippt = false
      // Tipp vor dem Spiel (Tipp-Pack) + Tipp-Serie (4 Wochen in Folge)
      if (rnd() < persona.tipp) {
        getippt = true
        imFenster.forEach((m) => (m.tipp = true))
        pack(t, { typ: 'tipp' })
        const w = Math.floor((t + 1) / 7); tippWochen.add(w)
        let n = 0; while (tippWochen.has(w - n)) n++
        if (n >= 4) ziel('tipp_serie', t, { n: 1 })
        if (rnd() < P_TIPP_EXAKT) pack(t, { n: 1, minSelt: 'silber', ziel: true, typ: 'ziel' })
        if (rnd() < P_KAPITAEN_TRIFFT) pack(t, { n: 1, ziel: true, typ: 'ziel' })
      }
      if (s.derby) add({ typ: 'moment', selt: 'spezial', limitiert: true, nurSpiel: s.t, kapitel: 'moment' })
      if (s.heim) {
        const sieg = rnd() < P_HEIMSIEG
        let drin = false
        if (rnd() < persona.heim) {
          drin = true
          imFenster.forEach((m) => (m.checkin = true))
          serie++
          fan.lose += E.lose_checkin
          // Derby: Check-in-Pack ist ein Event-Pack (Größe/Garantie wie Spieltag, Wochen-Slot des Events)
          if (s.derby && PACK_TYPEN.event.karten > 0) pack(t, { typ: 'event', n: Math.max(PACK_TYPEN.spieltag.karten, PACK_TYPEN.event.karten), minSelt: PACK_TYPEN.spieltag.min, spiel: s.t })
          else pack(t, { typ: 'spieltag', spiel: s.t })
          if (rnd() < persona.freund) { pack(t, { n: E.karten_freund, spiel: s.t }); ziel('freund_geworben', t, { n: 1 }) }
          if (serie >= 3) ziel('dauerkarte', t, { n: 1, min: 'gold' })
        } else serie = 0
        // v24: Sieg-Pack für alle, die eingecheckt ODER getippt haben (v20: nur Check-in)
        if (sieg && (drin || (getippt && !ALT))) {
          imFenster.forEach((m) => (m.sieg = true))
          pack(t, { typ: 'sieg', spiel: s.t })
        }
      }
      // „Spieler des Spiels": limitierte Spezialkarte, ziehbar Mo–So der Folgewoche
      const k = add({ typ: 'spieler', selt: 'spezial', limitiert: true, von: t + 1, bis: t + 8, kapitel: 'MIT' })
      motm.push({ k, tipp: false, checkin: false, heim: false, sieg: false })
    } else if (e.art === 'story') {
      if (rnd() < persona.story) pack(t, { n: E.karten_story })
    } else if (e.art === 'event') {
      if (PACK_TYPEN.event.karten > 0 && rnd() < persona.story) pack(t, { typ: 'event' })
    } else if (e.art === 'advent') {
      if (rnd() < persona.advent) pack(t, e.tag === 24 ? { n: 1, fest: weihnacht } : { n: 1 })
    } else if (e.art === 'woche') {
      tauschen(t); wuenschen(t)
    }
  }
  const motmStat = motm.map((m) => ({ tipp: m.tipp, checkin: m.checkin, heim: m.heim, sieg: m.sieg, hat: fan.besitz.has(m.k.id) }))
  const dop = [...fan.besitz.values()].reduce((a, n) => a + n - 1, 0)
  return { karten: fan.karten, pct: (100 * fan.plaetze.size) / alleP.size, komplettT: fan.komplettT, dop, lose: fan.lose, plaetze: alleP.size, personKarten: fan.personKarten, shiny: fan.shiny, motmStat }
}

// ── Auswertung ────────────────────────────────────────────────────────────────
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))]
const t0 = Date.now()
const zeilen = []
const shinyJeFan = []
const motmAlle = []
let plaetze = 0
for (const p of PERSONAS) {
  const r = Array.from({ length: LAEUFE }, () => lauf(p))
  plaetze = r[0].plaetze
  const pct = r.map((x) => x.pct).sort((a, b) => a - b)
  const fertig = r.filter((x) => x.komplettT !== null)
  const monate = {}
  for (const x of fertig) monate[monat(x.komplettT)] = (monate[monat(x.komplettT)] || 0) + 1
  const mittelT = fertig.length ? fertig.reduce((a, x) => a + x.komplettT, 0) / fertig.length : null
  zeilen.push({
    Persona: p.name, Ziel: p.ziel,
    'Ø Karten': (r.reduce((a, x) => a + x.karten, 0) / LAEUFE).toFixed(1),
    'Ø Album %': (pct.reduce((a, x) => a + x, 0) / LAEUFE).toFixed(1),
    Median: q(pct, 0.5).toFixed(1), P10: q(pct, 0.1).toFixed(1), P90: q(pct, 0.9).toFixed(1),
    'komplett %': ((100 * fertig.length) / LAEUFE).toFixed(1),
    'Ø fertig': mittelT === null ? '–' : monat(Math.round(mittelT)),
    'Ø Doppelte': (r.reduce((a, x) => a + x.dop, 0) / LAEUFE).toFixed(1),
    'Ø Lose': (r.reduce((a, x) => a + x.lose, 0) / LAEUFE).toFixed(1),
    'Ø Personenkarten': (r.reduce((a, x) => a + x.personKarten, 0) / LAEUFE).toFixed(1),
    'Shiny ≥1 %': ((100 * r.filter((x) => x.shiny > 0).length) / LAEUFE).toFixed(1),
    'Ø Shinys': (r.reduce((a, x) => a + x.shiny, 0) / LAEUFE).toFixed(3),
  })
  shinyJeFan.push(r.reduce((a, x) => a + x.shiny, 0) / LAEUFE)
  for (const x of r) motmAlle.push(...x.motmStat)
}
if (process.env.KURZ) {
  const m = (f) => { const l = motmAlle.filter(f); return l.length ? Math.round((100 * l.filter((x) => x.hat).length) / l.length) : '-' }
  console.log(zeilen.map((z) => `${z.Persona.split(' ')[0]} ${z['Ø Karten']}K ${z['Ø Album %']}% kompl ${z['komplett %']}% ${z['Ø fertig']} dop ${z['Ø Doppelte']}`).join(' | '),
    `| MOTM aktiv ${m((x) => x.tipp && x.checkin)}% nurTipp ${m((x) => x.tipp && !x.checkin)}%`)
  process.exit(0)
}
console.log(`Sammelkarten-Simulation v24${ALT ? ' (ALT=1: v20-Ökonomie zum Vergleich)' : ''} · ${LAEUFE} Läufe je Persona · ${plaetze} Album-Plätze (${PARTNER} Partner) · Restsaison 17 Spieltage / 8 Heimspiele\n`)
console.table(zeilen)
console.log('Standardwerte:', JSON.stringify({ ...EINSTELLUNGEN, partner_seltenheit: PARTNER_SELTENHEIT }))
console.log('Pack-Typen:', JSON.stringify(PACK_TYPEN))

// ── v24: MOTM-Karte der Woche — wer bekommt sie? (je Fan und MOTM-Woche) ──────
const gruppe = (f) => motmAlle.filter(f)
const quote = (l) => (l.length ? ((100 * l.filter((m) => m.hat).length) / l.length).toFixed(1) + ' %' : '–')
console.log('\nMOTM-Karte der Woche (Ziehfenster Mo–So, Wochen-Slot je Pack):')
console.table([
  { Woche: 'tippt + checkt ein (Heimspiel-Woche)', Quote: quote(gruppe((m) => m.tipp && m.checkin)), Anteil: gruppe((m) => m.tipp && m.checkin).length },
  { Woche: '… davon mit Heimsieg (Sieg-Pack)', Quote: quote(gruppe((m) => m.tipp && m.checkin && m.sieg)), Anteil: gruppe((m) => m.tipp && m.checkin && m.sieg).length },
  { Woche: 'nur Tipp (ohne Sieg-Pack)', Quote: quote(gruppe((m) => m.tipp && !m.checkin && !m.sieg)), Anteil: gruppe((m) => m.tipp && !m.checkin && !m.sieg).length },
  { Woche: 'nur Tipp, alle Wochen', Quote: quote(gruppe((m) => m.tipp && !m.checkin)), Anteil: gruppe((m) => m.tipp && !m.checkin).length },
  { Woche: 'nur Check-in', Quote: quote(gruppe((m) => !m.tipp && m.checkin)), Anteil: gruppe((m) => !m.tipp && m.checkin).length },
  { Woche: 'nicht aktiv (nur Codes/Ziele)', Quote: quote(gruppe((m) => !m.tipp && !m.checkin)), Anteil: gruppe((m) => !m.tipp && !m.checkin).length },
])

// ── v24: Ziehwahrscheinlichkeiten je Pack-Typ (Fan mit halbem Album, MOTM-Woche) ──
function packStatistik(N = 20000) {
  const zeilen = []
  for (const typ of Object.keys(PACK_TYPEN)) {
    const T = PACK_TYPEN[typ]
    if (!T.karten) continue
    const st = { karten: 0, neu1: 0, silber: 0, gold: 0, spezial: 0, motm: 0, shiny: 0, goldKarte: 0 }
    for (let i = 0; i < N; i++) {
      const { K, add } = katalog()
      const album = K.filter((k) => k.album)
      const fan = { besitz: new Map(), plaetze: new Set() }
      for (const k of album) if (rnd() < 0.5) { fan.besitz.set(k.id, 1); fan.plaetze.add(k.platz) }
      const m = add({ typ: 'spieler', selt: 'spezial', limitiert: true, von: 0, bis: 7, kapitel: 'MIT' })
      const p = packZiehen(fan, K, 3, { typ, ziel: typ === 'ziel', n: typ === 'ziel' ? 1 : undefined })
      st.karten += p.length
      if (p[0] && p[0].album && !fan.plaetze.has(p[0].platz)) st.neu1++
      if (p.some((k) => RANG[k.selt] >= 2)) st.silber++
      if (p.some((k) => RANG[k.selt] >= 3)) st.gold++
      st.goldKarte += p.filter((k) => RANG[k.selt] >= 3).length
      if (p.some((k) => k.selt === 'spezial')) st.spezial++
      if (p.includes(m)) st.motm++
      const personen = p.filter((k) => (k.typ === 'spieler' || k.typ === 'trainer') && !k.limitiert).length
      if (E.shiny_chance > 0 && Array.from({ length: personen }).some(() => rnd() * E.shiny_chance < 1)) st.shiny++
    }
    const pc = (x) => ((100 * x) / N).toFixed(1) + ' %'
    zeilen.push({ Typ: typ, Karten: (st.karten / N).toFixed(2), 'Karte 1 neu': pc(st.neu1), '≥1 Silber+': pc(st.silber), '≥1 Gold+': pc(st.gold),
      'Gold+ je Karte': ((100 * st.goldKarte) / st.karten).toFixed(1) + ' %', '≥1 Spezial': pc(st.spezial), 'MOTM der Woche': pc(st.motm), '≥1 Shiny': pc(st.shiny) })
  }
  return zeilen
}
console.log('\nZiehwahrscheinlichkeiten je Pack (Fan mit halbem Album, MOTM-Karte der Woche ziehbar, fehlt noch):')
console.table(packStatistik(Math.max(2000, Math.round(LAEUFE * 2))))
// Gemeinschaft: 100 aktive Fans (Annahme 50 % Gelegenheit, 35 % typisch, 15 % Stammfans)
const mix = 50 * shinyJeFan[0] + 35 * shinyJeFan[1] + 15 * shinyJeFan[2]
console.log(`Shiny (1 : ${E.shiny_chance}): je 100 aktive Fans (50/35/15 %) rund ${mix.toFixed(1)} Shinys pro Saison — bei 27 Personen ist fast jeder Fund ein Erstfund.`)
console.log(`Laufzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`)
