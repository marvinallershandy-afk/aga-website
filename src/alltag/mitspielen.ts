// ─────────────────────────────────────────────────────────────
// v18-A: Daten + Nachricht für den Probetraining-Assistenten.
// Mannschaften: Admin → Verein & Links → „Mannschaften (Probetraining)“
// (sva_mannschaften → web_mitspielen() → Build-Overlay). Bis dahin der Seed
// unten = was die Website heute schon kennt (1. Herren, Jugend unter 18).
// Nummer je Mannschaft optional; leer → Haupt-WhatsApp (Verein & Links);
// ohne echte Nummer → E-Mail (wie überall auf der Seite). Nichts wird gespeichert.
// ─────────────────────────────────────────────────────────────
import { CONTACT, whatsappReady } from '../data/content'
import { WEBSITE_CONTENT_OVERLAY } from '../data/generated/website-content.generated'
import type { MannschaftOverlay } from '../data/content-overlay'

export type Mannschaft = MannschaftOverlay

const SEED: Mannschaft[] = [
  { id: 'herren-1', name: '1. Herren', hinweis: 'ab 18 Jahren · Kreisliga' },
  {
    id: 'jugend',
    name: 'Jugend (unter 18)',
    hinweis: 'eigene Teams und Trainer',
    training: 'Zeiten je nach Altersklasse — wir verbinden dich mit der Jugend.',
  },
]

export const MANNSCHAFTEN: Mannschaft[] = WEBSITE_CONTENT_OVERLAY?.mannschaften?.length ? WEBSITE_CONTENT_OVERLAY.mannschaften : SEED

export const POSITIONEN = ['Tor', 'Abwehr', 'Mittelfeld', 'Sturm', 'Egal'] as const
export type Position = (typeof POSITIONEN)[number]

const NUMMER = /^[1-9]\d{7,14}$/

export interface Anfrage {
  mannschaft: Mannschaft
  position?: Position | null
  vorname?: string
  jahrgang?: string
}

export function nachricht(a: Anfrage): string {
  const vorname = (a.vorname ?? '').trim().slice(0, 40)
  const anrede = a.mannschaft.kontakt ? `Hallo ${a.mannschaft.kontakt}!` : 'Hallo SV Agathenburg-Dollern!'
  const zeilen = [
    anrede,
    `${vorname ? `Ich bin ${vorname} und würde` : 'Ich würde'} gern zum Probetraining kommen – ${a.mannschaft.name}.`,
  ]
  const jg = (a.jahrgang ?? '').trim()
  if (/^\d{4}$/.test(jg)) zeilen.push(`Jahrgang: ${jg}`)
  if (a.position && a.position !== 'Egal') zeilen.push(`Position: ${a.position}`)
  zeilen.push('Wann passt es euch?')
  return zeilen.join('\n')
}

/** Ziel-Link: Mannschafts-WhatsApp → Haupt-WhatsApp → E-Mail. */
export function anfrageLink(a: Anfrage): { href: string; kanal: 'whatsapp' | 'mail' } {
  const text = nachricht(a)
  const nummer = a.mannschaft.whatsapp && NUMMER.test(a.mannschaft.whatsapp) ? a.mannschaft.whatsapp : whatsappReady ? CONTACT.whatsapp : null
  if (nummer) return { href: `https://wa.me/${nummer}?text=${encodeURIComponent(text)}`, kanal: 'whatsapp' }
  return {
    href: `mailto:${CONTACT.email}?subject=${encodeURIComponent(`Probetraining – ${a.mannschaft.name}`)}&body=${encodeURIComponent(text)}`,
    kanal: 'mail',
  }
}

/** Trainingszeile für die gewählte Mannschaft (eigene Angabe → sonst Verein & Links). */
export function trainingFuer(m: Mannschaft): { wann: string; wo?: string } {
  if (m.training) return { wann: m.training }
  return { wann: CONTACT.training, wo: CONTACT.trainingOrt || undefined }
}

// ── v19-K (Audit B §4.7): „Mithelfen am Spieltag" — vierte Option im Assistenten.
// Kein Team, kein Probetraining: eine fertige WhatsApp-/Mail-Vorlage für Helfer.
// Nichts erfunden — nur ein offenes Angebot mitzuhelfen.
export function helferNachricht(vorname?: string): string {
  const v = (vorname ?? '').trim().slice(0, 40)
  return [
    'Hallo SV Agathenburg-Dollern!',
    `${v ? `Ich bin ${v} und würde` : 'Ich würde'} am Spieltag gern mithelfen – z. B. Grill, Getränke, Auf- und Abbau oder an der Kasse.`,
    'Wo könnt ihr Hände gebrauchen?',
  ].join('\n')
}

/** Ziel-Link für Helfer: Haupt-WhatsApp (Verein & Links) → sonst E-Mail. */
export function helferLink(vorname?: string): { href: string; kanal: 'whatsapp' | 'mail' } {
  const text = helferNachricht(vorname)
  if (whatsappReady && NUMMER.test(CONTACT.whatsapp)) {
    return { href: `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent(text)}`, kanal: 'whatsapp' }
  }
  return {
    href: `mailto:${CONTACT.email}?subject=${encodeURIComponent('Mithelfen am Spieltag')}&body=${encodeURIComponent(text)}`,
    kanal: 'mail',
  }
}
