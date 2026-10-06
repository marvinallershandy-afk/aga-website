// v20-K: Album-Karte (Katalog) → KartenDaten des gemeinsamen Kartensystems.
// Gecacht je Karte + Nummer (die Karte wird an vielen Stellen gezeigt).
import { vonAlbumKarte } from '../karten/adapter'
import type { KartenDaten } from '../karten/typen'
import type { Karte } from './api'

const cache = new WeakMap<Karte, Map<string, KartenDaten>>()
export function kartenDaten(k: Karte, nr?: number, gesamt?: number, saison?: string): KartenDaten {
  let m = cache.get(k)
  if (!m) cache.set(k, (m = new Map()))
  const key = `${nr}|${gesamt}|${saison}`
  let d = m.get(key)
  if (!d) {
    d = vonAlbumKarte(k, { nr, gesamt, saison })
    m.set(key, d)
  }
  return d
}
