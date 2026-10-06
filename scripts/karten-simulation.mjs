// Monte-Carlo-Simulation der Sammelkarten-Ökonomie v20 (ohne Datenbank).
//
// MUSS ZUR MIGRATION PASSEN: supabase/migrations/20261012110000_sva_karten.sql
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
// Ergebnis steht in docs/KARTEN.md (Abschnitt „Ökonomie & Ziehung").

// ── Einstellungen (= Defaults der Migration) ──────────────────────────────────
export const EINSTELLUNGEN = {
  gewicht_bronze: 70, gewicht_silber: 22, gewicht_gold: 7, gewicht_spezial: 1,
  karten_pro_pack: 3,        // Check-in-Pack
  karten_starter: 5, starter_min_silber: true,
  karten_heimsieg: 1, karten_tipp: 1, karten_story: 1, karten_freund: 1, karten_kapitel: 1,
  doppelte_bremse: 25,       // % (vorher 50; per Simulation gesenkt, Smart-Pack übernimmt)
  smart_pack: true,
  smart_pack_belohnung: false, // Smart-Pack auch in Belohnungs-Packs (Ziele/Kapitel)?
  tausch_min_tage: 7, tausch_pro_woche: 5, wunsch_kosten: 3,
  schwelle_1: 3, schwelle_2: 6, schwelle_3: 8,
  lose_checkin: 1, lose_komplett: 5,
}
export const PARTNER_SELTENHEIT = 'bronze' // album_admin_katalog_standard: Partnerkarten

const STUFEN = ['bronze', 'silber', 'gold', 'spezial']
const RANG = { bronze: 1, silber: 2, gold: 3, spezial: 4 }
const LAEUFE = Number(process.argv[2] || 10000)
const PARTNER = Number(process.argv[3] || 6) // aktive Sponsoren (Annahme)
if (process.argv[4]) EINSTELLUNGEN.smart_pack_belohnung = process.argv[4] === '1' // Vergleichslauf
if (process.argv[5]) EINSTELLUNGEN.doppelte_bremse = Number(process.argv[5])      // Vergleichslauf

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
  { name: 'Gelegenheits-Follower', ziel: '~30 Karten → 55–60 %', heim: 0.15, tipp: 0.25, story: 0.2, advent: 0.2, freund: 0, tausch: 0, wunsch: false },
  { name: 'Typischer Follower', ziel: '~40 Karten → ~70 %', heim: 0.25, tipp: 0.3, story: 0.2, advent: 0.2, freund: 0.2, tausch: 0, wunsch: false },
  { name: 'Stammfan', ziel: '~70 Karten + Tausch → komplett ~Mai', heim: 0.75, tipp: 0.4, story: 0.15, advent: 0.15, freund: 0.3, tausch: 0.35, wunsch: true },
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
function packZiehen(fan, kat, t, { n, spiel = null, minSelt = null, fest = null, ziel = false }) {
  if (n <= 0) return []
  // Smart-Pack: erste Karte jedes Zufalls-Packs; Belohnungs-Packs (Ziele, Kapitel) nur mit smart_pack_belohnung
  const smart = E.smart_pack && !fest && (!ziel || E.smart_pack_belohnung)
  const ziehbar = kat.filter((k) => (k.von === null || k.von <= t) && (k.bis === null || k.bis > t) && (k.nurSpiel === null || k.nurSpiel === spiel)
    && (!k.limitiert || k.von !== null || k.bis !== null || k.nurSpiel !== null))
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
  return pack
}

// ── Ein Fan, eine Saison ──────────────────────────────────────────────────────
function lauf(persona) {
  const { K, add } = katalog()
  const album = K.filter((k) => k.album)
  const alleP = new Set(album.map((k) => k.platz))
  const kapitelP = {}
  for (const k of album) (kapitelP[k.kapitel] ??= new Set()).add(k.platz)
  const fan = { besitz: new Map(), plaetze: new Set(), karten: 0, lose: 0, komplettT: null, ziele: new Set(), tauschT: -99, wochenTausche: [] }
  const zuschreiben = (pack, t) => {
    for (const k of pack) { fan.besitz.set(k.id, (fan.besitz.get(k.id) || 0) + 1); if (k.album) fan.plaetze.add(k.platz); fan.karten++ }
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
    for (const [kap, ps] of Object.entries(kapitelP)) if ([...ps].every((p) => fan.plaetze.has(p))) ziel('kapitel_' + kap, t, { n: E.karten_kapitel })
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
    zuschreiben([pick(f)], t)
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
  pack(0, { n: E.karten_starter, minSelt: E.starter_min_silber ? 'silber' : null })
  const ereignisse = []
  for (const s of SPIELTAGE) ereignisse.push({ t: s.t, art: 'spieltag', s })
  for (const t of STORIES) ereignisse.push({ t, art: 'story' })
  for (let t = DEZ[0]; t <= DEZ[1]; t++) ereignisse.push({ t, art: 'advent', tag: t - DEZ[0] + 1 })
  for (let t = 7; t <= ENDE; t += 7) ereignisse.push({ t, art: 'woche' })
  ereignisse.sort((a, b) => a.t - b.t)
  for (const e of ereignisse) {
    const t = e.t
    if (e.art === 'spieltag') {
      const s = e.s
      // Tipp vor dem Spiel (1 Karte je Tipp) + Tipp-Serie (4 Wochen in Folge)
      if (rnd() < persona.tipp) {
        pack(t, { n: E.karten_tipp })
        const w = Math.floor((t + 1) / 7); tippWochen.add(w)
        let n = 0; while (tippWochen.has(w - n)) n++
        if (n >= 4) ziel('tipp_serie', t, { n: 1 })
        if (rnd() < P_TIPP_EXAKT) pack(t, { n: 1, minSelt: 'silber' })
        if (rnd() < P_KAPITAEN_TRIFFT) pack(t, { n: 1 })
      }
      if (s.derby) add({ typ: 'moment', selt: 'spezial', limitiert: true, nurSpiel: s.t, kapitel: 'moment' })
      if (s.heim) {
        if (rnd() < persona.heim) {
          serie++
          fan.lose += E.lose_checkin
          pack(t, { n: E.karten_pro_pack, spiel: s.t })
          if (rnd() < P_HEIMSIEG) pack(t, { n: E.karten_heimsieg, spiel: s.t })
          if (rnd() < persona.freund) { pack(t, { n: E.karten_freund, spiel: s.t }); ziel('freund_geworben', t, { n: 1 }) }
          if (serie >= 3) ziel('dauerkarte', t, { n: 1, min: 'gold' })
        } else serie = 0
      }
      // „Spieler des Spiels": limitierte Spezialkarte, ziehbar Mo–So der Folgewoche
      add({ typ: 'spieler', selt: 'spezial', limitiert: true, von: t + 1, bis: t + 8, kapitel: 'MIT' })
    } else if (e.art === 'story') {
      if (rnd() < persona.story) pack(t, { n: E.karten_story })
    } else if (e.art === 'advent') {
      if (rnd() < persona.advent) pack(t, e.tag === 24 ? { n: 1, fest: weihnacht } : { n: 1 })
    } else if (e.art === 'woche') {
      tauschen(t); wuenschen(t)
    }
  }
  const dop = [...fan.besitz.values()].reduce((a, n) => a + n - 1, 0)
  return { karten: fan.karten, pct: (100 * fan.plaetze.size) / alleP.size, komplettT: fan.komplettT, dop, lose: fan.lose, plaetze: alleP.size }
}

// ── Auswertung ────────────────────────────────────────────────────────────────
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(p * a.length))]
const t0 = Date.now()
const zeilen = []
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
  })
}
console.log(`Sammelkarten-Simulation v20 · ${LAEUFE} Läufe je Persona · ${plaetze} Album-Plätze (${PARTNER} Partner) · Restsaison 17 Spieltage / 8 Heimspiele\n`)
console.table(zeilen)
console.log('Standardwerte:', JSON.stringify({ ...EINSTELLUNGEN, partner_seltenheit: PARTNER_SELTENHEIT }))
console.log(`Laufzeit ${((Date.now() - t0) / 1000).toFixed(1)} s`)
