// ─────────────────────────────────────────────────────────────
// v17-A / v20-K: Album-Logik ohne React — Kapitel, Plätze, Fortschritt,
// Treue-Leiste, Meilensteine.
// Ein Spieler hat EINEN Platz, gefüllt von seiner Basis-Karte (Kader bzw.
// Gold für Kapitän/Trainer). Glanz-Varianten (variante) sind Zusatz-
// Sammelstücke am selben Platz und füllen ihn NICHT. Limitierte Karten
// (MOTM, Derby, Advent) liegen auf der Bonus-Seite und zählen nicht fürs
// Album. „Mannschaft komplett" = alle Spieler-Plätze (wie sva_album_komplett()).
// ─────────────────────────────────────────────────────────────
import type { Belohnung, Erstfund, Karte, Katalog, Mein, Seltenheit, ShinyFund } from './api'

export const SELTEN_RANG: Record<Seltenheit, number> = { bronze: 1, silber: 2, gold: 3, spezial: 4 }
/** Bronze = die Basis-Karte („Kader") — Seltenheit bewertet nie einen Spieler */
export const SELTEN_LABEL: Record<Seltenheit, string> = { bronze: 'Kader', silber: 'Silber', gold: 'Gold', spezial: 'Spezial' }
export const SELTEN_KURZ = SELTEN_LABEL

export type Gruppe = 'TW' | 'ABW' | 'MIT' | 'ANG' | 'stab' | 'moment' | 'fan' | 'partner' | 'kult' | 'bonus'
/** Kapitel in Heft-Reihenfolge (Server-Kapitel-IDs identisch) */
export const GRUPPEN: { id: Gruppe; titel: string; kurz: string }[] = [
  { id: 'TW', titel: 'Tor', kurz: 'Tor' },
  { id: 'ABW', titel: 'Abwehr', kurz: 'Abwehr' },
  { id: 'MIT', titel: 'Mittelfeld', kurz: 'Mitte' },
  { id: 'ANG', titel: 'Sturm', kurz: 'Sturm' },
  { id: 'stab', titel: 'Trainerstab', kurz: 'Stab' },
  { id: 'moment', titel: 'Momente', kurz: 'Momente' },
  { id: 'fan', titel: 'Kurve', kurz: 'Kurve' },
  { id: 'partner', titel: 'Partner', kurz: 'Partner' },
  { id: 'kult', titel: 'Kabinen-Kult', kurz: 'Kult' },
]
export const KAPITEL_NAME: Record<string, string> = Object.fromEntries(GRUPPEN.map((g) => [g.id, g.titel]))
export const SPIELER_GRUPPEN: Gruppe[] = ['TW', 'ABW', 'MIT', 'ANG']

export interface Platz {
  key: string
  /** fortlaufende Kartennummer im Album (Bonus-Seite: 0) */
  nr: number
  gruppe: Gruppe
  /** Basis-Karte(n) dieses Platzes */
  versionen: Karte[]
  /** Glanz-Varianten am selben Platz (Sammelstücke) */
  glanz: Karte[]
  /** Basis-Karte, die der Fan hat (sonst undefined = leerer Platz) */
  beste?: Karte
  /** beste Glanz-Variante, die der Fan hat */
  besterGlanz?: Karte
  /** Exemplare über Basis + Varianten */
  anzahl: number
}

export function besitzMap(mein: Mein | null): Map<string, number> {
  return new Map((mein?.besitz ?? []).map((b) => [b.karteId, b.anzahl]))
}

export function gruppeVon(k: Karte): Gruppe {
  if (k.kult) return 'kult'
  if (k.limitiert) return 'bonus'
  if (k.typ === 'spieler') return k.spieler?.position ?? 'MIT'
  if (k.typ === 'trainer') return 'stab'
  return k.typ
}

/** Plätze in Heft-Reihenfolge; `ohne` = Karten, die gerade noch „eingeklebt“ werden. */
export function plaetze(katalog: Katalog | null, besitz: Map<string, number>, ohne?: Set<string>): Platz[] {
  if (!katalog) return []
  const map = new Map<string, Platz>()
  for (const k of katalog.karten) {
    // v22: Geheimkarten leben nur auf der Geheimseite (mein.geheim)
    if (k.geheim) continue
    const gruppe = gruppeVon(k)
    const key =
      gruppe !== 'bonus' && (k.typ === 'spieler' || k.typ === 'trainer') && k.spieler ? `p:${k.typ}:${k.spieler.slug}` : `k:${k.id}`
    let p = map.get(key)
    if (!p) {
      p = { key, nr: 0, gruppe, versionen: [], glanz: [], anzahl: 0 }
      map.set(key, p)
    }
    if (k.variante) p.glanz.push(k)
    else p.versionen.push(k)
  }
  const alle = [...map.values()]
  // Ein Platz nur aus Varianten (Basis fehlt im Katalog) → Variante wird Basis
  for (const p of alle) if (!p.versionen.length) p.versionen = p.glanz.splice(0)
  const reihe = [...GRUPPEN.map((g) => g.id), 'bonus' as const].flatMap((g) => alle.filter((p) => p.gruppe === g))
  let nr = 0
  for (const p of reihe) {
    if (p.gruppe !== 'bonus' && p.gruppe !== 'kult') p.nr = ++nr
    p.versionen.sort((a, b) => SELTEN_RANG[a.seltenheit] - SELTEN_RANG[b.seltenheit])
    p.glanz.sort((a, b) => SELTEN_RANG[a.seltenheit] - SELTEN_RANG[b.seltenheit])
    const zaehl = (v: Karte) => {
      let n = besitz.get(v.id) ?? 0
      if (ohne?.has(v.id)) n = Math.max(0, n - 1)
      p.anzahl += n
      return n
    }
    for (const v of p.versionen) if (zaehl(v) > 0) p.beste = v
    for (const v of p.glanz) if (zaehl(v) > 0) p.besterGlanz = v
  }
  return reihe
}

export interface KapitelStand {
  id: Gruppe
  titel: string
  belegt: number
  gesamt: number
  komplett: boolean
}

export interface Fortschritt {
  belegt: number
  gesamt: number
  prozent: number
  spielerBelegt: number
  spielerGesamt: number
  doppelte: number
  glanz: number
  bonus: number
  komplett: boolean
  kapitel: KapitelStand[]
}

export const MEILENSTEINE = [10, 25, 50, 75, 100]

export function fortschritt(ps: Platz[]): Fortschritt {
  const album = ps.filter((p) => p.gruppe !== 'bonus' && p.gruppe !== 'kult')
  const spieler = album.filter((p) => SPIELER_GRUPPEN.includes(p.gruppe))
  const spielerBelegt = spieler.filter((p) => p.beste).length
  const belegt = album.filter((p) => p.beste).length
  const kapitel = GRUPPEN.map((g) => {
    const k = album.filter((p) => p.gruppe === g.id)
    const b = k.filter((p) => p.beste).length
    return { id: g.id, titel: g.titel, belegt: b, gesamt: k.length, komplett: k.length > 0 && b === k.length }
  }).filter((k) => k.gesamt > 0)
  return {
    belegt,
    gesamt: album.length,
    prozent: album.length ? Math.floor((100 * belegt) / album.length) : 0,
    spielerBelegt,
    spielerGesamt: spieler.length,
    // Doppelte = alles über das erste Exemplar je Karte hinaus
    doppelte: ps.reduce((a, p) => a + Math.max(0, p.anzahl - (p.beste ? 1 : 0) - (p.besterGlanz ? 1 : 0)), 0),
    glanz: album.filter((p) => p.besterGlanz).length,
    bonus: ps.filter((p) => p.gruppe === 'bonus' && p.beste).length,
    komplett: spieler.length > 0 && spielerBelegt === spieler.length,
    kapitel,
  }
}

export interface Treue {
  checkins: number
  stufen: (Belohnung & { checkins: number; erreicht: boolean })[]
  naechste?: Belohnung & { checkins: number; fehlen: number }
  max: number
}

export function treue(katalog: Katalog | null, checkins: number): Treue {
  const stufen = (katalog?.regeln.belohnungen ?? [])
    .filter((b): b is Belohnung & { checkins: number } => typeof b.checkins === 'number')
    .sort((a, b) => a.checkins - b.checkins)
    .map((b) => ({ ...b, erreicht: checkins >= b.checkins }))
  const n = stufen.find((s) => !s.erreicht)
  return {
    checkins,
    stufen,
    naechste: n ? { ...n, fehlen: n.checkins - checkins } : undefined,
    max: Math.max(1, ...stufen.map((s) => s.checkins), checkins),
  }
}

export function karteById(katalog: Katalog | null, mein?: Mein | null): Map<string, Karte> {
  const m = new Map((katalog?.karten ?? []).map((k) => [k.id, k]))
  // v22: gefundene Geheimkarten (stehen nicht im öffentlichen Katalog)
  for (const g of mein?.geheim ?? []) if (g.karte) m.set(g.karte.id, g.karte)
  return m
}

// ── v22: Shiny-Vitrine ──────────────────────────────────────
export interface ShinyPlatz {
  key: string
  /** Basis-Karte der Person (Darstellung) */
  karte: Karte
  nr: number
  fund?: ShinyFund
  /** wer die Person als Erste(r) shiny hatte (auch wenn ich sie nicht habe) */
  erstfund?: Erstfund
}

/** Eine Vitrine-Stelle je Person (Spieler + Trainerstab) — zählt NICHT fürs Album. */
export function shinyPlaetze(ps: Platz[], mein: Mein | null): ShinyPlatz[] {
  const funde = new Map((mein?.shiny ?? []).map((f) => [f.karteId, f]))
  const erst = new Map((mein?.shinyErstfunde ?? []).map((e) => [e.karteId, e]))
  return ps
    .filter((p) => p.gruppe !== 'bonus' && (p.versionen[0]?.typ === 'spieler' || p.versionen[0]?.typ === 'trainer'))
    .map((p) => {
      const ids = [...p.versionen, ...p.glanz].map((k) => k.id)
      const fund = ids.map((id) => funde.get(id)).find(Boolean)
      const e = ids.map((id) => erst.get(id)).find(Boolean)
      return { key: p.key, karte: p.versionen[0], nr: p.nr, fund, erstfund: fund?.erstfund ?? e }
    })
}

/** Anzeigename einer Karte (Spieler: echter Name) */
export const name = (k: Karte) => k.spieler?.name ?? k.partner?.name ?? k.titel

/** Doppelte (anzahl ≥ 2) als Liste [{karte, anzahl}] — für Tausch/Wunschkarte. */
export function doppelteListe(katalog: Katalog | null, besitz: Map<string, number>): { karte: Karte; extra: number }[] {
  return (katalog?.karten ?? [])
    .map((k) => ({ karte: k, extra: (besitz.get(k.id) ?? 0) - 1 }))
    .filter((x) => x.extra > 0 && !x.karte.limitiert)
}

export const reduzierteBewegung = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
