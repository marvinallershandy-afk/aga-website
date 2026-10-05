import { SECTIONS, CONTACT, NEXT_MATCH, nextKickoff, TRAINING_ORT_KURZ } from '../data/content'
import type { PlaceId } from './places'

// ─────────────────────────────────────────────────────────────
// v16-K: Kerntexte je Ort — EINE Quelle für die Panel-Einleitung und den
// SEO-Block (visuell verborgen im DOM, vorgerendert ins HTML). Kurz:
// IG-Traffic liest drei Zeilen, keine Textwand.
// ─────────────────────────────────────────────────────────────

const sec = (id: string) => SECTIONS.find((s) => s.id === id)

function nextMatchLine(): string {
  const k = nextKickoff()
  if (!k || NEXT_MATCH.isPlaceholder) return 'Der nächste Spieltermin steht bald hier — bis dahin: Tabelle und Spielplan bei fussball.de.'
  const when = k.toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
  return `Nächstes Spiel: ${when} Uhr, ${NEXT_MATCH.home ? `Heimspiel gegen ${NEXT_MATCH.opponent}` : `auswärts bei ${NEXT_MATCH.opponent}`}.`
}

export const PLACE_LEAD: Record<PlaceId, string> = {
  spieltag: 'Wann, gegen wen, wie steht’s? Am Spieltag läuft hier der Live-Ticker — sonst Tabelle, Form und das nächste Spiel.',
  training: `Probetraining ist bei uns ein kompliziertes Verfahren: hinkommen, Schuhe an, fertig. ${CONTACT.training} — keine Anmeldung, keine Ausrede.`,
  mannschaft: 'Eine Truppe, die montags humpelt und sonntags fliegt — jeder als Sammelkarte. Tipp einen Spieler an, dann dreht sich seine Karte.',
  fans: sec('fanblock')?.body ?? '',
  musik: sec('musik')?.body ?? '',
  partner: 'Dein Logo direkt am Spielfeld — plus Reichweite im Dorf und in der Story. Eine Bande haben wir extra für dich freigelassen.',
  anfahrt: 'Der Waldsportplatz liegt am Ortsrand von Agathenburg, mitten im Wald. Parken direkt an der Mehrzweckhalle.',
}

export const PLACE_SEO: Record<PlaceId, string[]> = {
  spieltag: [PLACE_LEAD.spieltag, nextMatchLine()],
  training: [
    PLACE_LEAD.training,
    `Training: ${CONTACT.training}${CONTACT.trainingOrt ? `, ${CONTACT.trainingOrt}` : ''}.`,
    'Unter 18? Schreib uns — wir verbinden dich mit der Jugend.',
  ],
  mannschaft: [PLACE_LEAD.mannschaft, 'Kader der 1. Herren des SV Agathenburg-Dollern als Sammelkarten mit Aufstellung, Bank und Trainerstab.'],
  fans: [PLACE_LEAD.fans, 'Fotos der Meisterfeier 2026: Aufstieg aus der 1. Kreisklasse.'],
  musik: [PLACE_LEAD.musik, 'Das Album „Heimspiel Überall“ von AGA Urknall — im Partyraum des Vereinsheims.'],
  partner: [PLACE_LEAD.partner, 'Banden, Trikot und digitale Flächen für Unternehmen aus der Region.'],
  anfahrt: [
    `Spielort: ${CONTACT.address}.`,
    TRAINING_ORT_KURZ ? `Trainingsort: ${CONTACT.trainingOrt}.` : '',
    `Kontakt: ${CONTACT.email} · Instagram ${CONTACT.instagram}.`,
  ].filter(Boolean),
}
