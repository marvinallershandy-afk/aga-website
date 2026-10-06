// ─────────────────────────────────────────────────────────────
// v22-A Album-Vorführung (/album?vorfuehrung=1): beantwortet ALLE album_*-
// Aufrufe aus api.ts im Browser. Kein Netz, keine Datenbank, kein Login —
// der Zustand lebt nur im Speicher dieses Tabs (Neu laden = zurücksetzen).
//
// Demo-Fan „Lena B.“: halb volles Album, 2 ungeöffnete Tütchen (eins mit
// garantierter Gold-Karte, eins mit garantiertem Shiny), Ziele/Medaillen,
// Lose, Verlosungen, Shiny-Vitrine mit Erstfunden, Geheimseite (1 von 4).
// Die Steuerleiste (Steuerleiste.tsx) legt weitere Test-Packs an.
// v24-P: Stand im sessionStorage dieses Tabs (überlebt den Wechsel zur
// Tipp-Liga und zurück); übernimmt die Packs der Tipp-Vorführung
// (uebergabe.ts) und zieht sie wie der Server nach Pack-Typ (Größe,
// Garantie, Smart-Pack, Wochen-Slot). „Zurücksetzen“ = von vorn.
// ─────────────────────────────────────────────────────────────
import type { Karte, Mein, PackArt, PackInhalt, Seltenheit, Ziel } from '../api'
import { GEHEIM, MOTM_ID, MOTM_WOCHE_ID, SAISON, basisId, glanzId, vorfuehrKatalog } from './katalog'
import { packTypInfo, typVonArt, type PackTyp } from '../packTypen'
import { uebergabeGeoeffnet, uebergabeLeeren, uebergabeLesen } from './uebergabe'

async function sha256hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export const FAN = { vorname: 'Lena', initial: 'B', anzeigename: 'Lena B.' }
export const VF_PACK_EREIGNIS = 'album-vf-pack'

interface VfPack {
  id: string
  art: PackArt
  typ?: PackTyp
  titel?: string
  gegner?: string
  karten: string[]
  shiny: boolean[]
  geoeffnet: boolean
  neu?: boolean[]
  at: string
}
interface Zustand {
  besitz: Map<string, number>
  packs: VfPack[]
  /** Shiny je Person (Schlüssel = Basis-Karte) */
  shiny: Map<string, { anzahl: number; at: string; gezogen: string }>
  erstfunde: Map<string, { name: string; at: string; ich: boolean }>
  codes: Set<string>
  lose: number
  checkins: number
  n: number
}

const tage = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
let z: Zustand | null = null
const SPEICHER_KEY = 'sva-album-vf'

function karten() {
  return vorfuehrKatalog().karten
}
const karteVon = (id: string): Karte | undefined => karten().find((k) => k.id === id) ?? GEHEIM.find((g) => g.karte.id === id)?.karte
const person = (k?: Karte) => !!k && (k.typ === 'spieler' || k.typ === 'trainer') && !k.limitiert && !k.geheim
const basisVon = (k: Karte) => (k.spieler ? basisId(k.spieler.slug) : k.id)

function start(): Zustand {
  const kat = karten()
  const besitz = new Map<string, number>()
  const basis = kat.filter((k) => !k.variante && !k.limitiert)
  // halb volles Album: jede zweite Person, die Hälfte der Momente/Kurve/Partner
  basis.forEach((k, i) => {
    const fuellen = k.typ === 'spieler' ? i % 2 === 0 : k.typ === 'trainer' ? i % 3 === 0 : i % 2 === 1
    // Gold-Trainer + Kapitän bleiben offen → das Gold-Tütchen zeigt einen Walkout auf einen freien Platz
    if (fuellen && !(k.seltenheit === 'gold')) besitz.set(k.id, i % 5 === 0 ? 3 : i % 4 === 0 ? 2 : 1)
  })
  // ein paar Glanz-Varianten + die MOTM-Karte
  kat.filter((k) => k.variante).slice(0, 3).forEach((k) => besitz.set(k.id, 1))
  besitz.set(MOTM_ID, 1)
  // 1 von 4 Geheimkarten schon entdeckt (Geburtstag) — die übrigen drei lassen sich vorführen
  besitz.set(GEHEIM[2].karte.id, 1)
  const spieler = kat.filter((k) => k.typ === 'spieler' && !k.variante && !k.limitiert)
  const erste = spieler[0]
  besitz.set(erste.id, Math.max(1, besitz.get(erste.id) ?? 1))
  const shiny = new Map([[erste.id, { anzahl: 1, at: tage(9), gezogen: erste.id }]])
  const erstfunde = new Map([
    [erste.id, { name: FAN.anzeigename, at: tage(9), ich: true }],
    [spieler[5].id, { name: 'Tom K.', at: tage(4), ich: false }],
    [spieler[11].id, { name: 'Jana W.', at: tage(2), ich: false }],
  ])
  // Tütchen: Check-in mit garantierter Gold-Karte (fehlender Trainer) + Tipp mit Shiny
  const trainer = kat.find((k) => k.typ === 'trainer' && !besitz.has(k.id)) ?? kat.find((k) => k.seltenheit === 'gold')!
  const fehlt = basis.filter((k) => k.typ === 'spieler' && !besitz.has(k.id) && k.seltenheit === 'bronze')
  // garantierter Shiny auf einer Person ohne Erstfund → „Erstfund! Du bist die Erste“
  const shinyKarte = fehlt.find((k) => k !== fehlt[0] && k !== fehlt[1] && !erstfunde.has(k.id)) ?? spieler[3]
  const packs: VfPack[] = [
    { id: 'vf-pack-1', art: 'checkin', typ: 'spieltag', gegner: 'TuS Harsefeld', titel: 'Spieltags-Pack', karten: [fehlt[0].id, glanzId(fehlt[1].spieler!.slug), trainer.id], shiny: [false, false, false], geoeffnet: false, at: tage(0) },
    { id: 'vf-pack-2', art: 'tipp', typ: 'tipp', titel: 'Tipp-Pack', karten: [shinyKarte.id, glanzId(fehlt[2]?.spieler?.slug ?? fehlt[1].spieler!.slug)], shiny: [true, false], geoeffnet: false, at: tage(0) },
  ]
  return { besitz, packs, shiny, erstfunde, codes: new Set(), lose: 7, checkins: 4, n: 10 }
}
// ── v24-P: Stand merken (sessionStorage) + Übergabe aus der Tipp-Liga ──
function laden(): Zustand | null {
  try {
    const g = JSON.parse(sessionStorage.getItem(SPEICHER_KEY) ?? 'null')
    if (!g || !Array.isArray(g.packs)) return null
    return {
      besitz: new Map(g.besitz), packs: g.packs, shiny: new Map(g.shiny), erstfunde: new Map(g.erstfunde),
      codes: new Set(g.codes), lose: g.lose, checkins: g.checkins, n: g.n,
    }
  } catch {
    return null
  }
}
function speichern(s: Zustand) {
  try {
    const plaetze = karten().filter((k) => !k.variante && !k.limitiert)
    const stand = { belegt: plaetze.filter((k) => (s.besitz.get(k.id) ?? 0) > 0).length, gesamt: plaetze.length, tuetchen: s.packs.filter((p) => !p.geoeffnet).length }
    sessionStorage.setItem(SPEICHER_KEY, JSON.stringify({
      besitz: [...s.besitz], packs: s.packs, shiny: [...s.shiny], erstfunde: [...s.erstfunde], codes: [...s.codes],
      lose: s.lose, checkins: s.checkins, n: s.n, stand, packIds: s.packs.map((p) => p.id),
    }))
  } catch {
    /* privat-Modus: Vorführung läuft trotzdem, nur ohne Gedächtnis */
  }
}
function uebernehmen(s: Zustand) {
  for (const u of uebergabeLesen()) {
    if (u.geoeffnet || s.packs.some((p) => p.id === u.id)) continue
    const { ids, shiny } = vfZiehen(s, u.typ, u.karten)
    s.packs.push({ id: u.id, art: u.art as PackArt, typ: u.typ, titel: u.titel, gegner: u.gegner, karten: ids, shiny, geoeffnet: false, at: u.at })
  }
}
function zustand(): Zustand {
  if (!z) z = laden() ?? start()
  uebernehmen(z)
  return z
}
export function vfZuruecksetzen() {
  uebergabeLeeren()
  z = start()
  speichern(z)
}

// ── Ziehen (nur Demo, fair nach den Standard-Gewichten) ─────
const GEWICHT: Record<Seltenheit, number> = { bronze: 70, silber: 22, gold: 7, spezial: 1 }
function zufallsKarte(min?: Seltenheit): Karte {
  const pool = karten().filter((k) => !k.limitiert && !k.geheim)
  const rang: Record<Seltenheit, number> = { bronze: 1, silber: 2, gold: 3, spezial: 4 }
  const stufen = (Object.keys(GEWICHT) as Seltenheit[]).filter((s) => !min || rang[s] >= rang[min]).filter((s) => pool.some((k) => k.seltenheit === s))
  let r = Math.random() * stufen.reduce((a, s) => a + GEWICHT[s], 0)
  let s = stufen[stufen.length - 1]
  for (const x of stufen) {
    if (r < GEWICHT[x]) {
      s = x
      break
    }
    r -= GEWICHT[x]
  }
  const st = pool.filter((k) => k.seltenheit === s)
  return st[Math.floor(Math.random() * st.length)]
}

// v24-P: Ziehung nach Pack-Typ — wie sva_album_pack_ziehen_v24 (Demo, fair nach
// den Standard-Gewichten): Smart-Karte zuerst, Garantie ersetzt die letzte Karte,
// Wochen-Slot (MOTM der Woche) ersetzt die letzte Karte, wenn die Fanin sie noch nicht hat.
const RANG: Record<Seltenheit, number> = { bronze: 1, silber: 2, gold: 3, spezial: 4 }
function vfZiehen(s: Zustand, typ: PackTyp, anzahl?: number, opt: { slot?: number } = {}): { ids: string[]; shiny: boolean[] } {
  const t = packTypInfo(typ)!
  const n = Math.max(1, anzahl ?? t.karten)
  const kat = karten()
  const imPack = new Set(s.packs.filter((p) => !p.geoeffnet).flatMap((p) => p.karten))
  const hat = (id: string) => (s.besitz.get(id) ?? 0) > 0 || imPack.has(id)
  const ids: string[] = []
  const fehlend = kat.filter((k) => !k.variante && !k.limitiert && !k.geheim && !hat(k.id))
  if (fehlend.length && (t.smart ?? true) && typ !== 'ziel') {
    const stufen = (Object.keys(GEWICHT) as Seltenheit[]).filter((x) => fehlend.some((k) => k.seltenheit === x))
    let r = Math.random() * stufen.reduce((a, x) => a + GEWICHT[x], 0)
    let st = stufen[stufen.length - 1]
    for (const x of stufen) {
      if (r < GEWICHT[x]) {
        st = x
        break
      }
      r -= GEWICHT[x]
    }
    const c = fehlend.filter((k) => k.seltenheit === st)
    ids.push(c[Math.floor(Math.random() * c.length)].id)
  }
  while (ids.length < n) ids.push(zufallsKarte().id)
  const selt = (id: string) => kat.find((k) => k.id === id)?.seltenheit ?? 'bronze'
  if (t.minSeltenheit && !ids.some((id) => RANG[selt(id)] >= RANG[t.minSeltenheit!])) ids[ids.length - 1] = zufallsKarte(t.minSeltenheit).id
  const chance = opt.slot ?? t.limitiertChance ?? 0
  if (chance > 0 && Math.random() * 100 < chance && !hat(MOTM_WOCHE_ID)) {
    if (ids.length === 1) ids.push(MOTM_WOCHE_ID)
    else ids[ids.length - 1] = MOTM_WOCHE_ID
  }
  return { ids, shiny: ids.map((id) => person(karteVon(id)) && Math.random() * 250 < 1) }
}

const ART_VON_TYP: Record<PackTyp, PackArt> = { tipp: 'tipp', spieltag: 'checkin', sieg: 'heimsieg', starter: 'starter', ziel: 'ziel', event: 'event' }

export type TestPack = PackTyp | 'shiny' | 'alle'
/** Steuerleiste: neues Tütchen anlegen (nur in diesem Tab). */
export function vfPackAnlegen(art: TestPack): { id: string; art: PackArt; titel: string; typ?: PackTyp } {
  const s = zustand()
  const id = `vf-pack-${++s.n}`
  let ids: string[]
  let shiny: boolean[]
  let titel: string
  const kat = karten()
  if (art !== 'alle' && art !== 'shiny') {
    // v24-P: echte Pack-Typen; das Event-Pack zeigt in der Vorführung immer die Wochenkarte (falls noch nicht da)
    const t = packTypInfo(art)!
    const z2 = vfZiehen(s, art, undefined, art === 'event' ? { slot: 100 } : {})
    titel = art === 'event' ? 'Event-Pack · MOTM-Woche' : t.titel
    s.packs.push({ id, art: ART_VON_TYP[art], typ: art, titel, gegner: art === 'spieltag' || art === 'sieg' ? 'TuS Fischbek' : undefined, karten: z2.ids, shiny: z2.shiny, geoeffnet: false, at: new Date().toISOString() })
    speichern(s)
    return { id, art: ART_VON_TYP[art], titel, typ: art }
  }
  if (art === 'alle') {
    // jede Kartenart und Seltenheit einmal, mit echter Reveal-Animation
    const fehlendKader = kat.find((k) => k.typ === 'spieler' && !k.variante && !k.limitiert && k.seltenheit === 'bronze' && !s.besitz.has(k.id)) ?? kat.find((k) => k.seltenheit === 'bronze' && k.typ === 'spieler')!
    const glanz = kat.find((k) => k.variante && !s.besitz.has(k.id)) ?? kat.find((k) => k.variante)!
    const gold = kat.find((k) => k.typ === 'spieler' && k.seltenheit === 'gold' && !k.limitiert)!
    const moment = kat.find((k) => k.typ === 'moment' && k.seltenheit === 'spezial')!
    const partner = kat.find((k) => k.typ === 'partner')!
    const kurve = kat.find((k) => k.typ === 'fan' && !k.geheim)!
    const shinyP = kat.filter((k) => person(k) && !k.variante)[7]
    const geheim = GEHEIM.find((g) => !s.besitz.has(g.karte.id))?.karte ?? GEHEIM[3].karte
    ids = [fehlendKader.id, glanz.id, gold.id, moment.id, MOTM_ID, partner.id, kurve.id, shinyP.id, geheim.id]
    shiny = ids.map((x) => x === shinyP.id)
    titel = 'Test-Pack · alle Karten'
  } else {
    const p = kat.filter((k) => person(k) && !k.variante)
    const sk = p[Math.floor(Math.random() * p.length)]
    ids = [zufallsKarte().id, zufallsKarte().id, sk.id]
    shiny = [false, false, true]
    titel = 'Shiny-Pack (Vorführung)'
  }
  s.packs.push({ id, art: 'geschenk', titel, karten: ids, shiny, geoeffnet: false, at: new Date().toISOString() })
  speichern(s)
  return { id, art: 'geschenk', titel }
}

// ── Ziele (aus dem Demo-Stand berechnet) ────────────────────
function ziele(s: Zustand): Ziel[] {
  const kat = karten()
  const plaetze = kat.filter((k) => !k.variante && !k.limitiert)
  const hat = (id: string) => (s.besitz.get(id) ?? 0) > 0
  const prozent = Math.floor((100 * plaetze.filter((k) => hat(k.id)).length) / plaetze.length)
  const kap = (f: (k: Karte) => boolean) => {
    const l = plaetze.filter(f)
    return [l.filter((k) => hat(k.id)).length, l.length] as const
  }
  const set = (slugs: string[]) => [slugs.filter((x) => hat(basisId(x))).length, slugs.length] as const
  const roh: [string, string, string, string | undefined, readonly [number, number], Ziel['belohnung']][] = [
    ['zwillinge', 'set', 'Die Zwillinge', 'Elias und Noah Pejas im Album.', set(['p-pejas-e', 'p-pejas-n']), { karten: 1 }],
    ['rote_familie', 'set', 'Die Rote Familie', 'Drei Mann, drei Platzverweise – sammle Brettschneider, Nauerz und Brünjes.', set(['p-brettschneider', 'p-nauerz', 'p-bruenjes']), { karten: 1, minSeltenheit: 'silber' }],
    ['vater_sohn', 'set', 'Vater & Sohn', 'Adolf (Trainerstab) und Tino Ebeling im Album.', set(['s-ebeling-a', 'p-ebeling-t']), { karten: 1 }],
    ['kapitel_tw', 'kapitel', 'Kapitel komplett: Torwart', undefined, kap((k) => k.spieler?.position === 'TW' && k.typ === 'spieler'), { karten: 1 }],
    ['kapitel_abw', 'kapitel', 'Kapitel komplett: Abwehr', undefined, kap((k) => k.spieler?.position === 'ABW' && k.typ === 'spieler'), { karten: 1 }],
    ['kapitel_moment', 'kapitel', 'Kapitel komplett: Momente', undefined, kap((k) => k.typ === 'moment'), { karten: 1 }],
    ['meilenstein_25', 'meilenstein', '25 % gesammelt', undefined, [Math.min(prozent, 25), 25], { karten: 1, lose: 1 }],
    ['meilenstein_50', 'meilenstein', 'Halbzeit: 50 %', undefined, [Math.min(prozent, 50), 50], { karten: 1, lose: 2 }],
    ['meilenstein_75', 'meilenstein', '75 % gesammelt', undefined, [Math.min(prozent, 75), 75], { karten: 1, lose: 3 }],
    ['dauerkarte', 'serie_checkin', 'Dauerkarte', '3 Heimspiele in Folge eingecheckt.', [2, 3], { karten: 1, minSeltenheit: 'gold' }],
    ['tipp_serie', 'serie_tipp', 'Tipp-Serie', '4 Wochen in Folge getippt.', [4, 4], { karten: 1 }],
    ['erster_tausch', 'sozial_tausch', 'Erster Tausch', 'Eine Karte mit einem Freund getauscht.', [1, 1], { karten: 1 }],
    ['tipp_exakt', 'extern', 'Exakt getippt', 'Ergebnis exakt getippt.', [1, 1], { karten: 1, minSeltenheit: 'silber' }],
  ]
  return roh.map(([schluessel, typ, titel, beschreibung, [f, b], belohnung], i) => ({
    id: `vf-z-${i}`, schluessel, typ, titel, beschreibung, fortschritt: f, benoetigt: b, erreicht: f >= b,
    erreichtAt: f >= b ? tage(i + 1) : undefined, belohnung,
  }))
}

function mein(): Mein {
  const s = zustand()
  const zl = ziele(s)
  return {
    email: 'lena@vorfuehrung.sva',
    saison: SAISON,
    profil: { ...FAN, rangliste: true, erinnerung: false },
    checkins: s.checkins,
    checkinsGesamt: s.checkins + 6,
    spiele: [],
    besitz: [...s.besitz].filter(([, n]) => n > 0).map(([karteId, anzahl]) => ({ karteId, anzahl })),
    packs: s.packs.filter((p) => !p.geoeffnet).map((p) => ({ id: p.id, art: p.art, typ: p.typ ?? typVonArt(p.art), anzahl: p.karten.length, gegner: p.gegner, at: p.at, titel: p.titel })),
    gutscheine: [{ id: 'vf-g1', stufe: 'schwelle_1', titel: 'Getränk nach Wahl', code: 'SVA-VORF1', status: 'offen', saison: SAISON, at: tage(14) }],
    freundCode: 'LENA42',
    freunde: ['Tom K.', 'Jana W.'],
    abzeichen: [],
    tausche: [],
    tauscheWoche: 1,
    kontoTage: 40,
    starterOffen: false,
    advent: null,
    ziele: zl,
    naechstesZiel: zl.find((x) => !x.erreicht && x.typ !== 'extern') ?? null,
    lose: s.lose,
    loseVerlauf: [
      { anzahl: 1, quelle: 'checkin', at: tage(3) },
      { anzahl: 2, quelle: 'ziel', at: tage(8) },
    ],
    verlosungen: [
      { id: 'vf-v1', titel: 'Trikot der Saison', preis: 'Original-Heimtrikot mit Flock', bildUrl: '/album/karten/meister-shirt-640.webp', stichtag: new Date(Date.now() + 20 * 864e5).toISOString(), status: 'offen', teilnahme: true },
      { id: 'vf-v2', titel: 'Bratwurst-Flatrate', preis: 'Ein Heimspiel lang Bratwurst', status: 'gezogen', gewinnerName: 'Tom K.' },
    ],
    shiny: [...s.shiny].map(([karteId, f]) => ({ karteId, gezogen: f.gezogen, anzahl: f.anzahl, at: f.at, erstfund: s.erstfunde.get(karteId) })),
    shinyErstfunde: [...s.erstfunde].map(([karteId, e]) => ({ karteId, ...e })),
    geheim: GEHEIM.map((g, i) => {
      const gefunden = (s.besitz.get(g.karte.id) ?? 0) > 0
      return { nr: i + 1, raetsel: g.raetsel, gefunden, karte: gefunden ? g.karte : undefined }
    }),
  }
}

function oeffnen(id: string): PackInhalt {
  const s = zustand()
  const p = s.packs.find((x) => x.id === id)
  if (!p) throw Object.assign(new Error('album_pack_unbekannt'), { message: 'album_pack_unbekannt' })
  const vorher = ziele(s).filter((x) => x.erreicht).map((x) => x.schluessel)
  if (!p.geoeffnet) {
    p.neu = p.karten.map((k) => {
      const n = s.besitz.get(k) ?? 0
      s.besitz.set(k, n + 1)
      return n === 0
    })
    p.karten.forEach((k, i) => {
      const karte = karteVon(k)
      if (!p.shiny[i] || !person(karte)) return
      const b = basisVon(karte!)
      const f = s.shiny.get(b)
      s.shiny.set(b, { anzahl: (f?.anzahl ?? 0) + 1, at: f?.at ?? new Date().toISOString(), gezogen: k })
      if (!s.erstfunde.has(b)) s.erstfunde.set(b, { name: FAN.anzeigename, at: new Date().toISOString(), ich: true })
    })
    p.geoeffnet = true
    uebergabeGeoeffnet(p.id)
    speichern(s)
  }
  const neuErreicht = ziele(s).filter((x) => x.erreicht && !vorher.includes(x.schluessel))
  return {
    id: p.id,
    art: p.art,
    typ: p.typ ?? typVonArt(p.art),
    titel: p.titel,
    gegner: p.gegner,
    karten: p.karten.map((k, i) => {
      const karte = karteVon(k)
      const shiny = !!p.shiny[i] && person(karte)
      return {
        karteId: k,
        seltenheit: karte?.seltenheit ?? 'bronze',
        neu: !!p.neu?.[i],
        anzahl: s.besitz.get(k) ?? 1,
        variante: karte?.variante,
        limitiert: karte?.limitiert,
        geheim: karte?.geheim,
        karte: karte?.geheim ? karte : undefined,
        shiny,
        erstfund: shiny ? s.erstfunde.get(basisVon(karte!)) : undefined,
      }
    }),
    gutscheine: [],
    kapitel: [],
    ziele: neuErreicht.map((x) => ({ titel: x.titel, lose: x.belohnung.lose })),
  }
}

const kurz = (ms = 160) => new Promise((r) => window.setTimeout(r, ms))
const fehler = (code: string) => Object.assign(new Error(code), { message: code })

export async function simRpc(fn: string, a: Record<string, unknown>): Promise<unknown> {
  const s = zustand()
  try {
    return await simRpcInnen(s, fn, a)
  } finally {
    speichern(s)
  }
}

async function simRpcInnen(s: Zustand, fn: string, a: Record<string, unknown>): Promise<unknown> {
  switch (fn) {
    case 'album_katalog':
      return vorfuehrKatalog()
    case 'album_mein':
      return mein()
    case 'album_rangliste':
      return [
        { platz: 1, name: 'Tom K.', checkins: 7, karten: 38 },
        { platz: 2, name: 'Jana W.', checkins: 6, karten: 33 },
        { platz: 3, name: FAN.anzeigename, checkins: s.checkins, karten: [...s.besitz.values()].length, ich: true },
      ]
    case 'album_pack_oeffnen':
      await kurz(380)
      return oeffnen(String(a.p_pack))
    case 'album_starter_holen':
      return { packId: null }
    case 'album_freund_code':
      return { code: 'LENA42' }
    case 'album_code_einloesen': {
      await kurz()
      const code = String(a.p_code ?? '').trim().toUpperCase()
      const hash = /^G-[0-9A-F]{32}$/.test(code) ? await sha256hex(code) : ''
      for (const g of GEHEIM) {
        if (g.tokenHash !== hash) continue
        if (s.codes.has(code) || (s.besitz.get(g.karte.id) ?? 0) > 0) return { ok: false, grund: 'schon', geheim: true }
        s.codes.add(code)
        const id = `vf-pack-${++s.n}`
        s.packs.push({ id, art: 'geheim', titel: 'Geheimkarte entdeckt', karten: [g.karte.id], shiny: [false], geoeffnet: false, at: new Date().toISOString() })
        return { ok: true, packId: id, art: 'geheim', titel: 'Geheimkarte entdeckt', geheim: true }
      }
      if (code === 'SVA-DEMO' && !s.codes.has(code)) {
        s.codes.add(code)
        const id = `vf-pack-${++s.n}`
        s.packs.push({ id, art: 'story', titel: 'Story-Code', karten: [zufallsKarte().id], shiny: [false], geoeffnet: false, at: new Date().toISOString() })
        return { ok: true, packId: id, art: 'story', titel: 'Story-Code' }
      }
      return { ok: false, grund: s.codes.has(code) ? 'schon' : 'ungueltig' }
    }
    case 'album_checkin':
      throw fehler('album_schon_eingecheckt')
    case 'album_gutschein_einloesen':
      return { ok: true, eingeloestAt: new Date().toISOString() }
    case 'album_freund_hinzufuegen':
      return { ok: true, name: 'Mia K.' }
    case 'album_tausch_anbieten':
      return { code: 'VORFUEHR' }
    case 'album_tausch_zurueckziehen':
      return { ok: true }
    case 'album_tausch_ansehen':
      throw fehler('album_tausch_unbekannt')
    case 'album_wunschkarte': {
      const id = `vf-pack-${++s.n}`
      for (const g of (a.p_gegen as string[]) ?? []) s.besitz.set(g, Math.max(1, (s.besitz.get(g) ?? 1) - 1))
      s.packs.push({ id, art: 'wunsch', titel: 'Wunschkarte', karten: [String(a.p_karte)], shiny: [false], geoeffnet: false, at: new Date().toISOString() })
      return { packId: id }
    }
    case 'album_profil_speichern':
    case 'album_konto_loeschen':
      return { ok: true, loginGeloescht: false }
    default:
      throw fehler('nicht-verfuegbar')
  }
}
