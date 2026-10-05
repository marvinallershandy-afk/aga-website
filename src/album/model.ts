// ─────────────────────────────────────────────────────────────
// v17-A: Album-Logik ohne React — Heft-Seiten, Sticker-Plätze,
// Fortschritt, Treue-Leiste.
// Ein Spieler hat EINEN Platz im Heft, egal wie viele Versionen es gibt
// (Kader-Sticker, Silber-, Gold-Folie, Spezial-Glitzer). „Album komplett"
// = alle Spieler-Plätze belegt (wie serverseitig in sva_album_komplett()).
// Trainerstab, Momente, Partner und Fans haben je eigene Plätze, zählen
// aber nicht für „komplett".
// ─────────────────────────────────────────────────────────────
import type { Belohnung, Karte, Katalog, Mein, Seltenheit } from './api'

export const SELTEN_RANG: Record<Seltenheit, number> = { bronze: 1, silber: 2, gold: 3, spezial: 4 }
/** Bronze = der normale Kader-Sticker (wie im Konzept „Kader (Bronze)") */
export const SELTEN_LABEL: Record<Seltenheit, string> = { bronze: 'Kader', silber: 'Silber-Folie', gold: 'Gold-Folie', spezial: 'Glitzer-Spezial' }
export const SELTEN_KURZ: Record<Seltenheit, string> = { bronze: 'Kader', silber: 'Silber', gold: 'Gold', spezial: 'Spezial' }

export type Gruppe = 'TW' | 'ABW' | 'MIT' | 'ANG' | 'stab' | 'moment' | 'partner' | 'fan'
/** Reihenfolge der Heft-Seiten (wie im gedruckten Stickerheft) */
export const GRUPPEN: { id: Gruppe; titel: string; kurz: string }[] = [
  { id: 'moment', titel: 'Foto des Jahres', kurz: 'Momente' },
  { id: 'TW', titel: 'Torhüter', kurz: 'Tor' },
  { id: 'ABW', titel: 'Abwehr', kurz: 'Abwehr' },
  { id: 'MIT', titel: 'Mittelfeld', kurz: 'Mitte' },
  { id: 'ANG', titel: 'Sturm', kurz: 'Sturm' },
  { id: 'stab', titel: 'Trainerstab', kurz: 'Stab' },
  { id: 'partner', titel: 'Unsere Partner', kurz: 'Partner' },
  { id: 'fan', titel: 'Die Fans', kurz: 'Fans' },
]
export const SPIELER_GRUPPEN: Gruppe[] = ['TW', 'ABW', 'MIT', 'ANG']

export interface Platz {
  key: string
  /** fortlaufende Sticker-Nummer im Heft (wie bei Panini) */
  nr: number
  gruppe: Gruppe
  /** alle Versionen dieses Platzes, Kader-Sticker zuerst */
  versionen: Karte[]
  /** beste Version, die der Fan hat (sonst undefined = leerer Umriss) */
  beste?: Karte
  /** Summe aller Exemplare über alle Versionen */
  anzahl: number
}

export function besitzMap(mein: Mein | null): Map<string, number> {
  return new Map((mein?.besitz ?? []).map((b) => [b.karteId, b.anzahl]))
}

export function gruppeVon(k: Karte): Gruppe {
  if (k.typ === 'spieler') return k.spieler?.position ?? 'MIT'
  if (k.typ === 'trainer') return 'stab'
  return k.typ
}

/** Plätze in Heft-Reihenfolge; `ohne` = Karten, die gerade noch „eingeklebt“ werden. */
export function plaetze(katalog: Katalog | null, besitz: Map<string, number>, ohne?: Set<string>): Platz[] {
  if (!katalog) return []
  const map = new Map<string, Platz>()
  for (const k of katalog.karten) {
    const gruppe = gruppeVon(k)
    const key = (k.typ === 'spieler' || k.typ === 'trainer') && k.spieler ? `p:${k.typ}:${k.spieler.slug}` : `k:${k.id}`
    let p = map.get(key)
    if (!p) {
      p = { key, nr: 0, gruppe, versionen: [], anzahl: 0 }
      map.set(key, p)
    }
    p.versionen.push(k)
  }
  const reihe = GRUPPEN.flatMap((g) => [...map.values()].filter((p) => p.gruppe === g.id))
  reihe.forEach((p, i) => {
    p.nr = i + 1
    p.versionen.sort((a, b) => SELTEN_RANG[a.seltenheit] - SELTEN_RANG[b.seltenheit])
    for (const v of p.versionen) {
      let n = besitz.get(v.id) ?? 0
      if (ohne?.has(v.id)) n = Math.max(0, n - 1)
      p.anzahl += n
      if (n > 0) p.beste = v // aufsteigend sortiert → am Ende die beste
    }
  })
  return reihe
}

export interface Fortschritt {
  belegt: number
  gesamt: number
  spielerBelegt: number
  spielerGesamt: number
  doppelte: number
  komplett: boolean
}

export function fortschritt(ps: Platz[]): Fortschritt {
  const spieler = ps.filter((p) => SPIELER_GRUPPEN.includes(p.gruppe))
  const spielerBelegt = spieler.filter((p) => p.beste).length
  return {
    belegt: ps.filter((p) => p.beste).length,
    gesamt: ps.length,
    spielerBelegt,
    spielerGesamt: spieler.length,
    doppelte: ps.reduce((a, p) => a + Math.max(0, p.anzahl - (p.beste ? 1 : 0)), 0),
    komplett: spieler.length > 0 && spielerBelegt === spieler.length,
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

export function karteById(katalog: Katalog | null): Map<string, Karte> {
  return new Map((katalog?.karten ?? []).map((k) => [k.id, k]))
}

/** Anzeigename einer Karte (Spieler: echter Name) */
export const name = (k: Karte) => k.spieler?.name ?? k.titel

export const reduzierteBewegung = () =>
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
