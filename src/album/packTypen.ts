// ─────────────────────────────────────────────────────────────
// v24-P: Pack-Typen (Spiegel von sva_album_pack_typen, Migration
// 20261017100000_sva_album_packs_v24.sql). Die echten Werte kommen aus
// album_katalog().regeln.packTypen bzw. tipp_lage().tippPack — die
// Standardwerte hier gelten nur, solange der Server (noch) nichts liefert,
// und für die Vorführungen. Kein React, kein Supabase — auch für /tippen.
// ─────────────────────────────────────────────────────────────

export type PackTyp = 'tipp' | 'spieltag' | 'sieg' | 'starter' | 'ziel' | 'event'
export type PackOptik = 'klein' | 'gross' | 'gold' | 'starter' | 'ziel' | 'event'
type Selt = 'bronze' | 'silber' | 'gold' | 'spezial'

export interface PackTypInfo {
  typ: PackTyp
  titel: string
  karten: number
  minSeltenheit?: Exclude<Selt, 'bronze'>
  optik: PackOptik
  /** 1 ruhig · 2 normal · 3 groß */
  reveal: 1 | 2 | 3
  /** Wochen-Slot: Chance (%) auf die limitierte Wochenkarte (MOTM/Derby) */
  limitiertChance?: number
  smart?: boolean
  beschreibung?: string
}

export const PACK_TYPEN_STANDARD: PackTypInfo[] = [
  { typ: 'tipp', titel: 'Tipp-Pack', karten: 2, optik: 'klein', reveal: 1, limitiertChance: 8, beschreibung: 'Für den ersten Tipp eines Spieltags in der Tipp-Liga.' },
  { typ: 'spieltag', titel: 'Spieltags-Pack', karten: 4, minSeltenheit: 'silber', optik: 'gross', reveal: 2, limitiertChance: 30, beschreibung: 'Check-in am Platz (QR-Code am Eingang).' },
  { typ: 'sieg', titel: 'Sieg-Pack', karten: 2, minSeltenheit: 'gold', optik: 'gold', reveal: 3, limitiertChance: 30, beschreibung: 'Heimsieg: für alle, die eingecheckt oder getippt haben.' },
  { typ: 'starter', titel: 'Starter-Pack', karten: 5, minSeltenheit: 'silber', optik: 'starter', reveal: 2, beschreibung: 'Einmal zur Anmeldung.' },
  { typ: 'ziel', titel: 'Ziel-Pack', karten: 1, optik: 'ziel', reveal: 2, beschreibung: 'Sammelziel, Meilenstein oder Kapitel komplett.' },
  { typ: 'event', titel: 'Event-Pack', karten: 3, optik: 'event', reveal: 3, limitiertChance: 60, beschreibung: 'Derby, MOTM-Woche, Aktionen: mit Chance auf die limitierte Karte.' },
]

/** Pack-Typ einer Pack-Art (wie sva_album_typ_von_art) — für alte Packs ohne typ. */
export function typVonArt(art?: string): PackTyp | undefined {
  switch (art) {
    case 'tipp':
      return 'tipp'
    case 'checkin':
      return 'spieltag'
    case 'heimsieg':
      return 'sieg'
    case 'starter':
      return 'starter'
    case 'ziel':
    case 'kapitel':
      return 'ziel'
    case 'event':
      return 'event'
    default:
      return undefined
  }
}

export function packTypInfo(typ: PackTyp | undefined, liste?: PackTypInfo[] | null): PackTypInfo | undefined {
  if (!typ) return undefined
  return (liste ?? []).find((t) => t.typ === typ) ?? PACK_TYPEN_STANDARD.find((t) => t.typ === typ)
}

const SELT_KURZ: Record<string, string> = { silber: 'Silber', gold: 'Gold', spezial: 'Spezial' }
export const kartenWort = (n: number) => (n === 1 ? '1 Karte' : `${n} Karten`)
/** „Tipp-Pack · 2 Karten“ */
export const packZeile = (t: Pick<PackTypInfo, 'titel' | 'karten'>) => `${t.titel} · ${kartenWort(t.karten)}`
/** „mind. 1 Gold“ */
export const garantieText = (t?: Pick<PackTypInfo, 'minSeltenheit'>) => (t?.minSeltenheit ? `mind. 1 ${SELT_KURZ[t.minSeltenheit]}` : '')
