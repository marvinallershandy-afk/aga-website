// ─────────────────────────────────────────────────────────────
// v20-T: reine Helfer der Tipp-Liga (Texte, Fragen, Abzeichen, Zeit).
// Regeln/Punkte rechnet NUR die Datenbank — hier stehen nur die Texte dazu.
// ─────────────────────────────────────────────────────────────
import type { BonusKey, KaderSpieler, Position, SpielerPosten, TippSpiel } from './api'
import { VORFUEHRUNG } from '../live/vorfuehrung'

export const VEREIN_KURZ = 'SVA'

export interface BonusFrage {
  key: BonusKey
  frage: (linie?: number) => string
  optionen: { wert: string; label: string }[]
  /** kurze Bezeichnung für Auflösung/Story */
  kurz: string
}

export const BONUS: Record<BonusKey, BonusFrage> = {
  gelb: {
    key: 'gelb',
    frage: () => 'Wie viele Gelbe Karten sieht der SVA?',
    optionen: [
      { wert: '0', label: 'Keine' },
      { wert: '1-2', label: '1–2' },
      { wert: '3+', label: '3+' },
    ],
    kurz: 'Gelbe Karten SVA',
  },
  rot: {
    key: 'rot',
    frage: () => 'Gibt es eine Rote Karte im Spiel?',
    optionen: [
      { wert: 'ja', label: 'Ja' },
      { wert: 'nein', label: 'Nein' },
    ],
    kurz: 'Rote Karte',
  },
  tor20: {
    key: 'tor20',
    frage: () => 'Fällt ein Tor vor der 20. Minute?',
    optionen: [
      { wert: 'ja', label: 'Ja' },
      { wert: 'nein', label: 'Nein' },
    ],
    kurz: 'Tor vor der 20.',
  },
  tore_hz1: {
    key: 'tore_hz1',
    frage: () => 'Wie viele Tore fallen in der 1. Halbzeit?',
    optionen: [
      { wert: '0', label: 'Keins' },
      { wert: '1', label: 'Eins' },
      { wert: '2+', label: '2+' },
    ],
    kurz: 'Tore 1. Halbzeit',
  },
  elfmeter: {
    key: 'elfmeter',
    frage: () => 'Gibt es einen Elfmeter?',
    optionen: [
      { wert: 'ja', label: 'Ja' },
      { wert: 'nein', label: 'Nein' },
    ],
    kurz: 'Elfmeter',
  },
  zuschauer: {
    key: 'zuschauer',
    frage: (linie) => `Checken mehr als ${linie ?? 50} Fans am Platz ein?`,
    optionen: [
      { wert: 'ueber', label: 'Mehr' },
      { wert: 'unter', label: 'Weniger' },
    ],
    kurz: 'Zuschauer',
  },
  erstes_tor: {
    key: 'erstes_tor',
    frage: () => 'Wer trifft zuerst?',
    optionen: [
      { wert: 'sva', label: 'SVA' },
      { wert: 'gegner', label: 'Gegner' },
      { wert: 'niemand', label: 'Niemand' },
    ],
    kurz: 'Erstes Tor',
  },
}

export function bonusLabel(key: BonusKey, wert?: string): string {
  return BONUS[key].optionen.find((o) => o.wert === wert)?.label ?? '–'
}

export interface Abzeichen {
  key: string
  titel: string
  text: string
  /** Medaillen-Metall: Gold nur für die ganz großen (DESIGN.md: Gold = Pokal) */
  stufe?: 'rot' | 'silber' | 'gold'
  /** lucide-Icon-Name (Mapping in Abzeichen.tsx) */
  icon: 'eye' | 'flame' | 'square' | 'crown' | 'target' | 'sparkles' | 'footprints' | 'trophy' | 'users' | 'pen'
}

export const ABZEICHEN: Abzeichen[] = [
  { key: 'erster_tipp', titel: 'Anstoß', text: 'Deinen ersten Tipp abgegeben', icon: 'pen' },
  { key: 'hellseher', titel: 'Hellseher', text: '3× das exakte Ergebnis getippt', icon: 'eye' },
  { key: 'treuer_tipper', titel: 'Treuer Tipper', text: '10 Spieltage am Stück getippt', icon: 'flame', stufe: 'silber' },
  { key: 'kartenexperte', titel: 'Kartenexperte', text: '5 Karten-Bonusfragen richtig', icon: 'square' },
  { key: 'kapitaensgriff', titel: 'Kapitänsgriff', text: 'Dein Kapitän holt 10+ Punkte', icon: 'crown' },
  { key: 'volltreffer', titel: 'Volltreffer', text: 'Exakt + alle 3 Bonusfragen richtig', icon: 'target', stufe: 'silber' },
  { key: 'jokerkoenig', titel: 'Jokerkönig', text: 'Joker auf ein exaktes Ergebnis', icon: 'sparkles', stufe: 'silber' },
  { key: 'torriecher', titel: 'Torriecher', text: '3× den ersten SVA-Torschützen richtig', icon: 'footprints' },
  { key: 'spieltagssieger', titel: 'Spieltagssieger', text: 'Platz 1 an einem Spieltag', icon: 'trophy', stufe: 'gold' },
  { key: 'stammtisch', titel: 'Stammtisch', text: 'In einer Liga mit 5+ Leuten', icon: 'users' },
]
export const abzeichen = (key: string) => ABZEICHEN.find((a) => a.key === key)

export const POSTEN_LABEL: Record<SpielerPosten['k'], string> = {
  einsatz: 'Einsatz',
  tor: 'Tor',
  vorlage: 'Vorlage',
  zunull: 'Zu null',
  motm: 'Spieler des Spiels',
  sieg: 'Sieg',
  gelb: 'Gelb',
  gelbrot: 'Gelb-Rot',
  rot: 'Rot',
}

export const POS_LANG: Record<Position, string> = { TW: 'Torwart', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' }

/** Plätze von „Deine Elf“ (Reihenfolge = Server, v21): 1 TW · 1 ABW · 2 MIT · 1 ANG. */
export const PLAETZE: { label: string; pos: Position }[] = [
  { label: 'TW', pos: 'TW' },
  { label: 'ABW', pos: 'ABW' },
  { label: 'MIT', pos: 'MIT' },
  { label: 'MIT', pos: 'MIT' },
  { label: 'ANG', pos: 'ANG' },
]

/** Passt der Spieler auf den Platz? Haupt- ODER Zweitposition (frei: alle). */
export function passt(slot: number, p: KaderSpieler | undefined, frei: boolean): boolean {
  if (!p) return false
  if (frei) return true
  const soll = PLAETZE[slot]?.pos
  return p.position === soll || p.zweitposition === soll
}

export const verfuegbar = (p: KaderSpieler | undefined) => !!p && !p.nichtVerfuegbar

/**
 * Gespeicherte/letzte Elf in die aktuelle Formation bringen (z. B. die alte
 * 1-2-2 vom letzten Spieltag): jeder Spieler sucht sich einen passenden Platz,
 * nicht Passende/nicht Verfügbare fallen raus. Kapitän nur, wenn er drinbleibt.
 */
export function elfEinordnen(ids: (string | null | undefined)[], kader: Map<string, KaderSpieler>, frei: boolean): (string | null)[] {
  const kandidaten = ids.filter((x): x is string => !!x && kader.has(x) && verfuegbar(kader.get(x)))
  if (frei) return [0, 1, 2, 3, 4].map((i) => kandidaten[i] ?? null)
  const plaetze: (string | null)[] = [null, null, null, null, null]
  // 1. Durchgang: Hauptposition, in der gespeicherten Reihenfolge (gleiche Plätze bleiben gleich)
  const rest: string[] = []
  ids.forEach((id, i) => {
    if (!id || !kandidaten.includes(id)) return
    if (plaetze[i] === null && kader.get(id)!.position === PLAETZE[i]?.pos) plaetze[i] = id
    else rest.push(id)
  })
  // 2. Durchgang: freie Plätze per Haupt-, dann Zweitposition
  for (const nurHaupt of [true, false]) {
    for (const id of [...rest]) {
      const k = kader.get(id)!
      const i = plaetze.findIndex((x, j) => x === null && (nurHaupt ? k.position === PLAETZE[j].pos : passt(j, k, false)))
      if (i !== -1) {
        plaetze[i] = id
        rest.splice(rest.indexOf(id), 1)
      }
    }
  }
  return plaetze
}

export function nachname(name: string): string {
  const t = name.trim().split(/\s+/)
  return t[t.length - 1] ?? name
}
export function vorname(name: string): string {
  const t = name.trim().split(/\s+/)
  return t.slice(0, -1).join(' ')
}

// ── Zeit ─────────────────────────────────────────────────────
const TZ = 'Europe/Berlin'
export const datumLang = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ })
export const datumKurz = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: TZ }).replace(',', '')
export const uhrzeit = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
export const monatName = (ym: string) => {
  const [y, m] = ym.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, 15)).toLocaleDateString('de-DE', { month: 'long', year: 'numeric', timeZone: 'UTC' })
}

export interface Rest {
  tage: number
  std: number
  min: number
  sek: number
  gesamtMs: number
}
export function rest(zielIso: string, now: number): Rest {
  const ms = Math.max(0, new Date(zielIso).getTime() - now)
  const s = Math.floor(ms / 1000)
  return { tage: Math.floor(s / 86400), std: Math.floor((s % 86400) / 3600), min: Math.floor((s % 3600) / 60), sek: s % 60, gesamtMs: ms }
}

export function paarung(s: Pick<TippSpiel, 'heim' | 'gegner'>): { heim: string; gast: string } {
  return s.heim ? { heim: 'SV Agathenburg-Dollern', gast: s.gegner } : { heim: s.gegner, gast: 'SV Agathenburg-Dollern' }
}

export function kuerzel(name: string): string {
  const woerter = name
    .replace(/\(.*?\)/g, '')
    .split(/[\s/-]+/)
    .filter((w) => w && !/^(sv|tsv|fc|vfl|tus|sg|ssv|jsg|mtv|vfr|sc|fsv|tsg|vfb|tv|sv\.)$/i.test(w))
  if (woerter.length === 0) return name.slice(0, 3).toUpperCase()
  // ein Wort (TuS Fischbek → FIS), sonst Anfangsbuchstaben (Blau-Weiß Buxtehude → BWB)
  if (woerter.length === 1) return woerter[0].slice(0, 3).toUpperCase()
  return woerter.map((w) => w[0]).join('').slice(0, 3).toUpperCase()
}

/** Kurzes haptisches Feedback (Android; iOS ignoriert es still). */
export function haptik(muster: number | number[] = 8) {
  try {
    // nur nach einer echten Berührung (sonst warnt der Browser)
    const aktiv = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation?.hasBeenActive ?? true
    if (aktiv && !reduzierteBewegung()) navigator.vibrate?.(muster)
  } catch {
    /* egal */
  }
}

/** Initialen-Farbe für Avatare (ruhig, aus dem Namen abgeleitet, nur CI-nahe Töne). */
export function avatarTon(name: string): number {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return h % 5
}

export function reduzierteBewegung(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

// ── Lokaler Entwurf (nur auf diesem Gerät, vor dem Login) ────
// Vorführung: eigener Schlüssel — der echte Entwurf bleibt unberührt
const ENTWURF_KEY = VORFUEHRUNG ? 'sva-tipp-entwurf-vorfuehrung' : 'sva-tipp-entwurf'
export interface Entwurf {
  spielId: string
  toreSva: number
  toreGegner: number
  ersterTorschuetze?: string
  motm?: string
  joker: boolean
  bonus: Partial<Record<BonusKey, string>>
  elf: (string | null)[]
  kapitaen?: string
  frei: boolean
  absenden?: boolean
  /** v21: Formation der gespeicherten Elf (alte Entwürfe ohne → neu einordnen) */
  formation?: 'v21'
}
export function entwurfLesen(): Entwurf | null {
  try {
    const r = localStorage.getItem(ENTWURF_KEY)
    return r ? (JSON.parse(r) as Entwurf) : null
  } catch {
    return null
  }
}
export function entwurfSchreiben(e: Entwurf | null) {
  try {
    if (e) localStorage.setItem(ENTWURF_KEY, JSON.stringify(e))
    else localStorage.removeItem(ENTWURF_KEY)
  } catch {
    /* privat-Modus */
  }
}

/** Auflösung einmal animiert zeigen, danach ruhig. */
export function aufloesungGesehen(spielId: string): boolean {
  try {
    return localStorage.getItem(`sva-tipp-gesehen-${spielId}`) === '1'
  } catch {
    return false
  }
}
export function aufloesungMerken(spielId: string) {
  try {
    localStorage.setItem(`sva-tipp-gesehen-${spielId}`, '1')
  } catch {
    /* egal */
  }
}

export const TIPPEN_URL = 'aga-erste.de/tippen'

/** v21: Was bekomme ich wann? (Album-Belohnungen laut 20261012110000_sva_karten.sql) */
export const BELOHNUNGEN: { wann: string; was: string; art: 'karte' | 'lose' | 'abzeichen' | 'punkte' }[] = [
  { wann: 'Jeder getippte Spieltag', was: '+1 Karte fürs Album', art: 'karte' },
  { wann: 'Ergebnis exakt getippt', was: '+1 Karte (mind. Silber)', art: 'karte' },
  { wann: 'Dein Kapitän trifft', was: '+1 Karte', art: 'karte' },
  { wann: '4 Wochen am Stück getippt', was: '+1 Karte', art: 'karte' },
  { wann: 'Spieltagssieger', was: '2 Lose für die Verlosungen', art: 'lose' },
  { wann: 'Meilensteine (Hellseher, Torriecher …)', was: 'Abzeichen fürs Profil', art: 'abzeichen' },
]

// ── Erster Besuch: 3-Schritt-Einführung (einmal, überspringbar) ─
const ONBOARDING_KEY = VORFUEHRUNG ? 'sva-tipp-einfuehrung-vorfuehrung' : 'sva-tipp-einfuehrung'
export function einfuehrungGesehen(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_KEY) === '1'
  } catch {
    return true
  }
}
export function einfuehrungMerken() {
  try {
    localStorage.setItem(ONBOARDING_KEY, '1')
  } catch {
    /* privat */
  }
}
