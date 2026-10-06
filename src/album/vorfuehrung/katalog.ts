// ─────────────────────────────────────────────────────────────
// v22-A Vorführung: Katalog ohne Datenbank — gebaut aus den Website-Daten
// (Kader, Trainerstab, Partner) + den Standard-Momenten/-Kurve-Karten wie in
// album_admin_katalog_standard() + MOTM (limitiert) + den 4 Geheimkarten wie
// in sva_album_v22_nachziehen(). Gleiche Regeln/Chancen wie die Standardwerte.
// Nur geladen mit ?vorfuehrung=1 (eigener Chunk).
// ─────────────────────────────────────────────────────────────
import { PLAYERS, STAFF } from '../../data/players'
import { PARTNER_SPONSOREN } from '../../data/partner'
import type { Karte, Katalog, Position } from '../api'

export const SAISON = '2026/27'

const POS_NAME: Record<Position, string> = { TW: 'Torwart', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' }

/** Basis-Karte (Album-Platz) einer Person */
export const basisId = (slug: string) => `vf-k-${slug}`
export const glanzId = (slug: string) => `vf-g-${slug}`

function spielerKarten(): Karte[] {
  const out: Karte[] = []
  PLAYERS.forEach((p, i) => {
    const spieler = {
      slug: p.id,
      name: p.name,
      nummer: p.number ?? undefined,
      position: p.position,
      fotoUrl: p.photoUrl ?? undefined,
      cutoutUrl: p.cutoutUrl ?? undefined,
      kapitaen: p.isCaptain || undefined,
      seit: p.since ?? undefined,
      neuzugang: p.isNewSigning || undefined,
      tore: 0,
      vorlagen: 0,
    }
    out.push({
      id: basisId(p.id),
      typ: 'spieler',
      titel: p.name,
      untertitel: p.isCaptain ? 'Kapitän' : POS_NAME[p.position],
      bildUrl: p.photoUrl ?? undefined,
      seltenheit: p.isCaptain ? 'gold' : 'bronze',
      sortierung: 10 + i,
      spieler,
    })
    out.push({
      id: glanzId(p.id),
      typ: 'spieler',
      titel: p.name,
      untertitel: 'Silber-Glanz',
      bildUrl: p.cutoutUrl ?? p.photoUrl ?? undefined,
      seltenheit: 'silber',
      variante: true,
      sortierung: 10 + i,
      spieler,
    })
  })
  STAFF.filter((s) => !s.isPlaceholder).forEach((s, i) => {
    out.push({
      id: basisId(s.id),
      typ: 'trainer',
      titel: s.name,
      untertitel: { trainer: 'Trainer', 'co-trainer': 'Co-Trainer', 'torwart-trainer': 'Torwart-Trainer', teammanager: 'Teammanager' }[s.role],
      bildUrl: s.photoUrl ?? undefined,
      seltenheit: 'gold',
      sortierung: 500 + i,
      spieler: { slug: s.id, name: s.name, position: 'MIT', fotoUrl: s.photoUrl ?? undefined, cutoutUrl: s.cutoutUrl ?? undefined, rolle: s.role, seit: s.since ?? undefined, neuzugang: s.isNewSigning || undefined },
    })
  })
  return out
}

const MOMENTE: [string, Karte['seltenheit'], string, string, number][] = [
  ['Die Meister-Elf', 'spezial', 'meister-elf', 'Meister 2026', 10],
  ['Meister-Shirt', 'gold', 'meister-shirt', 'Meister 2026', 11],
  ['Ab in die Kurve', 'gold', 'ab-in-die-kurve', 'Meister 2026', 12],
  ['Die Umarmung', 'silber', 'umarmung', 'Meister 2026', 13],
  ['Der Pokal', 'spezial', 'pokal', 'Urknall-Pokal 2026', 20],
  ['Siegerfoto', 'gold', 'siegerfoto', 'Urknall-Pokal 2026', 21],
  ['Einer fliegt', 'gold', 'einer-fliegt', 'Urknall-Pokal 2026', 22],
  ['Die Parade', 'silber', 'parade', 'Urknall-Pokal 2026', 23],
]
const KURVE: [string, Karte['seltenheit'], string, number, string][] = [
  ['Die Kurve', 'silber', 'kurve', 10, 'Hinter der Bande am Waldsportplatz: Banner hoch, Arme hoch, jedes Tor gehört auch euch. Die Kurve ist der zwölfte Mann des SVA.'],
  ['Die Fahne', 'bronze', 'fahne', 11, 'Schwarz-Rot über dem Mannschaftskreis. Wenn die Fahne weht, weiß der ganze Platz, wer hier zu Hause ist.'],
  ['Das Urknall-Banner', 'silber', 'urknall-banner', 12, 'AGA Urknall, est. 2024: das Banner der Kurve. Hängt am Zaun, am Tor, auf jeder Feier — und ist bei jedem Heimspiel dabei.'],
]

/** Die 4 Geheimkarten (gleiche Texte wie die Migration v22). */
export const GEHEIM: { schluessel: string; teil: string; raetsel: string; karte: Karte }[] = [
  {
    schluessel: 'wappen',
    teil: 'wappen|7',
    raetsel: 'Sieben Mal klopft, wer den Platzwart sprechen will.',
    karte: { id: 'vf-geheim-wappen', typ: 'moment', titel: 'Der Platzwart', untertitel: 'Hüter des Waldsportplatzes', bildUrl: '/album/karten/geheim-platzwart.webp', bildFokus: '50% 46%', seltenheit: 'spezial', limitiert: true, geheim: true, serie: 'Geheimkarte', rueckseite: 'Wenn das Flutlicht ausgeht, dreht er noch eine Runde: Netze, Fahnen, Kreidelinien. Ohne ihn gibt es keinen Anstoß.' },
  },
  {
    schluessel: 'ball',
    teil: 'ball|rundgang',
    raetsel: 'Einer ging nie ins Tor. Er wartet darauf, dass ihn jemand findet.',
    karte: { id: 'vf-geheim-ball', typ: 'fan', titel: 'Der verlorene Ball', untertitel: 'Irgendwo am Waldsportplatz', seltenheit: 'spezial', limitiert: true, geheim: true, serie: 'Geheimkarte', rueckseite: 'Über den Zaun, in den Wald, nie wieder gesehen. Bis du ihn gefunden hast. Jeder Verein hat so einen — das hier ist unserer.' },
  },
  {
    schluessel: 'geburtstag',
    teil: 'geburtstag|kerzen',
    raetsel: 'Nur an einem Tag im Jahr brennen die Kerzen.',
    karte: { id: 'vf-geheim-geburtstag', typ: 'fan', titel: 'Seit 1949', untertitel: 'Der Geburtstag des SVA', seltenheit: 'spezial', limitiert: true, geheim: true, serie: 'Geheimkarte', rueckseite: 'Gegründet 1949 — seitdem rollt der Ball in Agathenburg und Dollern. Diese Karte gibt es nur an einem einzigen Tag im Jahr.' },
  },
  {
    schluessel: 'geste',
    teil: 'geste|OOUULRLR',
    raetsel: 'Hoch, hoch, runter, runter … wer die Alten kennt, kennt den Rest.',
    karte: { id: 'vf-geheim-geste', typ: 'fan', titel: 'Die Geheimtaktik', untertitel: 'Nur für Eingeweihte', seltenheit: 'spezial', limitiert: true, geheim: true, serie: 'Geheimkarte', rueckseite: 'Kein Trainer verrät sie, keine Taktiktafel zeigt sie. Wer sie kennt, gehört dazu.' },
  },
]

/** MOTM der Woche (limitiert, Bonus-Seite) */
export const MOTM_ID = 'vf-motm-1'

let cache: Katalog | null = null
export function vorfuehrKatalog(): Katalog {
  if (cache) return cache
  const personen = spielerKarten()
  const kapitaen = PLAYERS.find((p) => p.isCaptain) ?? PLAYERS[0]
  const momente: Karte[] = MOMENTE.map(([titel, seltenheit, bild, serie, sortierung]) => ({
    id: `vf-m-${bild}`, typ: 'moment', titel, seltenheit, bildUrl: `/album/karten/${bild}.webp`, bildFokus: '50% 50%', serie, credit: 'picture by Nele', sortierung,
  }))
  const kurve: Karte[] = KURVE.map(([titel, seltenheit, bild, sortierung, rueckseite]) => ({
    id: `vf-f-${bild}`, typ: 'fan', titel, seltenheit, bildUrl: `/album/karten/${bild}.webp`, bildFokus: '50% 50%', credit: 'picture by Nele', rueckseite, sortierung,
  }))
  const partnerQuelle = PARTNER_SPONSOREN.filter((s) => s.name).slice(0, 4)
  const partner: Karte[] = [
    ...partnerQuelle.map((s, i) => ({
      id: `vf-p-${i}`, typ: 'partner' as const, titel: s.name, seltenheit: 'bronze' as const, sortierung: i,
      partner: { name: s.name, logoUrl: s.logoUrl ?? undefined, url: s.url ?? undefined, seit: 2024 },
    })),
    // Verkaufs-Platzhalter: so sieht eine Partnerkarte ohne Logo aus
    { id: 'vf-p-deine-firma', typ: 'partner', titel: 'Deine Firma', seltenheit: 'bronze', sortierung: 99, partner: { name: 'Deine Firma' } },
  ]
  const motm: Karte = {
    id: MOTM_ID, typ: 'spieler', titel: kapitaen.name, untertitel: 'MOTM · 7. Spieltag · TuS Harsefeld', seltenheit: 'spezial', limitiert: true,
    serie: 'Spieler des Spiels', bildUrl: kapitaen.photoUrl ?? undefined,
    spieler: { slug: kapitaen.id, name: kapitaen.name, nummer: kapitaen.number ?? undefined, position: kapitaen.position, fotoUrl: kapitaen.photoUrl ?? undefined, cutoutUrl: kapitaen.cutoutUrl ?? undefined, kapitaen: true },
  }
  cache = {
    saison: SAISON,
    aktiv: true,
    regeln: {
      chancen: { bronze: 70, silber: 22, gold: 7, spezial: 1 },
      kartenProPack: 3, kartenStarter: 5, kartenHeimsieg: 1, kartenTipp: 1, kartenStory: 1, kartenFreund: 1, kartenKapitel: 1,
      fensterVorMin: 60, fensterNachMin: 135, bonusHeimsieg: true, smartPack: true,
      tauschMinTage: 7, tauschProWoche: 5, wunschKosten: 3, loseCheckin: 1, loseKomplett: 5,
      shinyChance: 250, geheimAnzahl: GEHEIM.length,
      // In der Vorführung ist „heute“ Vereins-Geburtstag → die Kerzen sind zu sehen
      vereinsGeburtstag: heuteMMTT(),
      teilnahmeText: 'Vorführung: Diese Verlosung ist simuliert. Echte Teilnahmebedingungen stehen im Album.',
      belohnungen: [
        { stufe: 'schwelle_1', checkins: 3, titel: 'Getränk nach Wahl' },
        { stufe: 'schwelle_2', checkins: 6, titel: 'Bratwurst + Getränk nach Wahl oder Fanartikel' },
        { stufe: 'schwelle_3', checkins: 8, titel: 'Los für die Saison-Verlosung (alle Heimspiele)' },
        { stufe: 'komplett', titel: 'Los für die Saison-Verlosung' },
      ],
    },
    karten: [...personen, ...momente, ...partner, ...kurve, motm],
  }
  return cache
}

export function heuteMMTT(): string {
  const t = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  const [d, m] = t.split('.')
  return `${m}-${d}`
}
