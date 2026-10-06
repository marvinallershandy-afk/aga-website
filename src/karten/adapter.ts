// ─────────────────────────────────────────────────────────────
// v20-K: Adapter → KartenDaten. Bilder kommen IMMER über playerMedia()
// (Greenscreen card.webp → HD-Freisteller → Foto; Loop = lebende Karte).
// Sobald die Greenscreen-Aufnahmen in src/data/greenscreen.ts stehen,
// zeigen alle Karten sie automatisch — hier ist nichts zu ändern.
// ─────────────────────────────────────────────────────────────
import type { Player, Staff } from '../data/players'
import { ROLE_LABEL } from '../data/players'
import { playerMedia } from '../data/playerMedia'
import { hdCutout } from '../ui/hdCutout'
import type { KartenDaten, KartenWert, Position, Seltenheit } from './typen'
import { POSITION_NAME } from './typen'

/** Minimal-Form einer Album-Karte (album_katalog()); bewusst strukturell. */
export interface AlbumKarteQuelle {
  id: string
  typ: 'spieler' | 'trainer' | 'moment' | 'partner' | 'fan'
  titel: string
  untertitel?: string
  bildUrl?: string
  seltenheit: Seltenheit
  variante?: boolean
  limitiert?: boolean
  /** v22: Geheimkarte (nicht im öffentlichen Katalog) */
  geheim?: boolean
  /** v26: Kabinen-Kult-Karte */
  kult?: boolean
  kollektion?: string
  serie?: string
  credit?: string
  bildFokus?: string
  rueckseite?: string
  praesentiertVon?: { name: string; logoUrl?: string }
  spieler?: {
    slug: string
    name: string
    nummer?: number
    position: Position
    fotoUrl?: string
    cutoutUrl?: string
    kapitaen?: boolean
    rolle?: string
    seit?: number
    neuzugang?: boolean
    tore?: number
    vorlagen?: number
  }
  partner?: { name: string; logoUrl?: string; url?: string; seit?: number }
}

const ROLLE: Record<string, string> = { trainer: 'Trainer', 'co-trainer': 'Co-Trainer', 'torwart-trainer': 'Torwart-Trainer', teammanager: 'Teammanager' }

function medien(id: string, fallback: { cutoutUrl?: string | null; photoUrl?: string | null }) {
  const m = playerMedia(id, fallback)
  return {
    figur: m.figure ? hdCutout(m.figure) : null,
    foto: fallback.photoUrl ?? null,
    loop: m.loop,
    loopGeo: m.loopSize,
  }
}

/** Website-Spieler (src/data/players.ts / DB-Kader) → Karte. */
export function vonSpieler(p: Player, extra: Partial<KartenDaten> = {}): KartenDaten {
  const m = medien(p.id, p)
  const werte: KartenWert[] = [{ label: 'Position', wert: POSITION_NAME[p.position] }]
  if (p.number != null) werte.push({ label: 'Rückennummer', wert: String(p.number) })
  if (p.since != null) werte.push({ label: 'Im Verein seit', wert: String(p.since) })
  if (p.stats.games > 0) werte.push({ label: 'Spiele', wert: String(p.stats.games) })
  if (p.stats.goals > 0) werte.push({ label: 'Tore', wert: String(p.stats.goals) })
  if (p.isCaptain) werte.push({ label: 'Rolle', wert: 'Kapitän' })
  return {
    id: `sp:${p.id}`,
    art: 'spieler',
    // Seltenheit bewertet nie einen Spieler: Kader = Basis, Gold nur Kapitän
    seltenheit: p.isPlayerOfMonth ? 'spezial' : p.isCaptain ? 'gold' : 'bronze',
    titel: p.name,
    nummer: p.number,
    position: p.position,
    kapitaen: p.isCaptain,
    neuzugang: p.isNewSigning,
    serie: p.isPlayerOfMonth ? 'Spieler des Monats' : undefined,
    saison: '2026/27',
    werte,
    ...m,
    ...extra,
  }
}

/** Trainerstab → Karte (Gold-Basis: objektive Rolle). */
export function vonStab(s: Staff, extra: Partial<KartenDaten> = {}): KartenDaten {
  const m = medien(s.id, s)
  const werte: KartenWert[] = [{ label: 'Rolle', wert: ROLE_LABEL[s.role] }]
  if (s.since != null) werte.push({ label: 'Im Verein seit', wert: String(s.since) })
  return {
    id: `st:${s.id}`,
    art: 'trainer',
    seltenheit: 'gold',
    titel: s.name,
    rolle: ROLE_LABEL[s.role],
    neuzugang: s.isNewSigning,
    saison: '2026/27',
    werte,
    ...m,
    ...extra,
  }
}

/** Album-Katalog-Karte → Karte. nr/gesamt = Kartennummer im Heft. */
export function vonAlbumKarte(k: AlbumKarteQuelle, opts: { nr?: number; gesamt?: number; saison?: string } = {}): KartenDaten {
  const s = k.spieler
  const person = (k.typ === 'spieler' || k.typ === 'trainer') && !!s
  const basis: KartenDaten = {
    id: k.id,
    art: k.typ,
    seltenheit: k.seltenheit,
    titel: s?.name ?? k.titel,
    untertitel: k.untertitel,
    variante: k.variante,
    limitiert: k.limitiert,
    geheim: k.geheim,
    kult: k.kult,
    kollektion: k.kollektion,
    serie: k.serie,
    credit: k.credit,
    fokus: k.bildFokus,
    rueckseite: k.rueckseite,
    praesentiertVon: k.praesentiertVon ?? null,
    kartenNr: opts.nr,
    kartenGesamt: opts.gesamt,
    saison: opts.saison,
  }
  if (person && s) {
    // Eigenes Kartenfoto (Admin-Upload) hat Vorrang nur, wenn es kein Kaderfoto ist
    const m = medien(s.slug, { cutoutUrl: s.cutoutUrl, photoUrl: s.fotoUrl })
    const werte: KartenWert[] = []
    if (k.typ === 'spieler') {
      werte.push({ label: 'Position', wert: POSITION_NAME[s.position] })
      if (s.nummer != null) werte.push({ label: 'Rückennummer', wert: String(s.nummer) })
    } else {
      werte.push({ label: 'Rolle', wert: ROLLE[s.rolle ?? ''] ?? 'Trainerstab' })
    }
    if (s.seit != null) werte.push({ label: 'Im Verein seit', wert: String(s.seit) })
    if (s.tore) werte.push({ label: 'Tore (Saison)', wert: String(s.tore) })
    if (s.vorlagen) werte.push({ label: 'Vorlagen (Saison)', wert: String(s.vorlagen) })
    if (s.kapitaen && k.typ === 'spieler') werte.push({ label: 'Rolle', wert: 'Kapitän' })
    return {
      ...basis,
      ...m,
      foto: m.figur ? null : k.bildUrl ?? s.fotoUrl ?? null,
      nummer: s.nummer ?? null,
      position: s.position,
      rolle: k.typ === 'trainer' ? ROLLE[s.rolle ?? ''] ?? 'Trainerstab' : undefined,
      kapitaen: !!s.kapitaen,
      neuzugang: s.neuzugang,
      werte,
    }
  }
  if (k.typ === 'partner') {
    return {
      ...basis,
      titel: k.partner?.name ?? k.titel,
      logo: k.partner?.logoUrl ?? null,
      foto: null,
      partnerSeit: k.partner?.seit ?? null,
    }
  }
  // v21-A: Kurve-Karten nie ohne Foto — fehlt eins (z. B. frisch im Admin
  // angelegt), springt das Kurve-Foto ein (picture by Nele).
  if (k.typ === 'fan' && !k.bildUrl && !k.geheim) {
    return { ...basis, foto: KURVE_ERSATZ, fokus: '50% 50%', credit: k.credit ?? 'picture by Nele' }
  }
  return { ...basis, foto: k.bildUrl ?? null }
}

/** Ersatzfoto für Kurve-Karten ohne eigenes Bild (scripts/karten-fotos.mjs). */
export const KURVE_ERSATZ = '/album/karten/kurve.webp'
