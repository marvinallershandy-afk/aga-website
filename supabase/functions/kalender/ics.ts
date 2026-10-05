// ─────────────────────────────────────────────────────────────
// v18-A: ICS-Erzeugung (RFC 5545) für das Kalender-Abo — reine Logik,
// ohne Deno-/Netz-Abhängigkeiten (Node-Test: ics.test.mjs).
//
// Regeln:
//   · CRLF als Zeilenende, Zeilen auf max. 75 Oktette gefaltet (UTF-8-sicher:
//     ein Umlaut wird nie zerteilt), Fortsetzung mit einem Leerzeichen
//   · TEXT-Werte escaped: \  ;  ,  Zeilenumbruch
//   · Zeiten in UTC (…Z) → keine VTIMEZONE nötig, Kalender rechnen selbst um
//   · UID je Spiel stabil (Spiel-ID), SEQUENCE/LAST-MODIFIED aus der DB-Version
//   · Ausgabe deterministisch (DTSTAMP = Änderungszeit) → gleiche Daten,
//     gleiche Datei, gleicher ETag
// ─────────────────────────────────────────────────────────────

export interface KalenderSpiel {
  id: string
  gegner: string
  heim: boolean
  anstoss: string
  ort?: string
  wettbewerb?: string
  spieltag?: number
  toreSva?: number
  toreGegner?: number
  seq?: number
  geaendert?: string
}

export interface KalenderDaten {
  spiele: KalenderSpiel[]
  verein?: { adresse?: string }
}

export interface KalenderOptionen {
  /** true = Heim + Auswärts */
  alle: boolean
  /** z. B. https://aga-erste.de — Basis für Live-Link und UID-Domain */
  seite: string
}

export const VEREIN = 'SV Agathenburg-Dollern'
export const VEREIN_KURZ = 'SVA'
export const DAUER_MS = 2 * 60 * 60 * 1000
const STANDARD_ADRESSE = 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg'

/** TEXT-Wert nach RFC 5545 §3.3.11 escapen. */
export function escapeText(s: string): string {
  return String(s)
    .replace(/\r\n?/g, '\n')
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

const enc = new TextEncoder()

/** Eine Inhaltszeile auf ≤ 75 Oktette falten (RFC 5545 §3.1), UTF-8-sicher. */
export function foldLine(line: string): string {
  if (enc.encode(line).length <= 75) return line
  const teile: string[] = []
  let akt = ''
  let bytes = 0
  let grenze = 75 // erste Zeile 75, Folgezeilen 74 + führendes Leerzeichen
  for (const ch of line) {
    const b = enc.encode(ch).length
    if (bytes + b > grenze) {
      teile.push(akt)
      akt = ''
      bytes = 0
      grenze = 74
    }
    akt += ch
    bytes += b
  }
  if (akt) teile.push(akt)
  return teile.join('\r\n ')
}

/** Date → 20261011T130000Z */
export function utc(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

function sauber(s: string | undefined | null): string {
  return (s ?? '').replace(/[\u0000-\u0008\u000B-\u001F\u007F]/g, '').trim()
}

export function kalenderName(alle: boolean): string {
  return alle ? `${VEREIN} – alle Spiele` : `${VEREIN} – Heimspiele`
}

/** Stabile UID je Spiel — feste Domain, damit ein Domain-Umzug (Netlify →
 *  aga-erste.de) keine doppelten Termine in abonnierten Kalendern erzeugt. */
export function uidFuer(spielId: string): string {
  return `spiel-${spielId.toLowerCase()}@aga-erste.de`
}

export function titel(s: KalenderSpiel): string {
  const gegner = sauber(s.gegner)
  const heim = s.heim ? VEREIN : gegner
  const gast = s.heim ? gegner : VEREIN
  const fertig = Number.isInteger(s.toreSva) && Number.isInteger(s.toreGegner)
  if (!fertig) return `${heim} – ${gast}`
  const th = s.heim ? s.toreSva : s.toreGegner
  const tg = s.heim ? s.toreGegner : s.toreSva
  return `${heim} – ${gast} ${th}:${tg}`
}

export function ort(s: KalenderSpiel, d: KalenderDaten): string {
  const o = sauber(s.ort)
  if (s.heim) {
    // Der Admin füllt Heimspiele mit „Sportplatz Agathenburg“ vor — zu wenig
    // fürs Navi. Nur eine vollständige Adresse (mit PLZ) ersetzt die Vereinsadresse.
    return o && /\b\d{5}\b/.test(o) ? o : sauber(d.verein?.adresse) || STANDARD_ADRESSE
  }
  return o
}

export function beschreibung(s: KalenderSpiel, liveUrl: string): string {
  const kopf = [sauber(s.wettbewerb), s.spieltag ? `${s.spieltag}. Spieltag` : ''].filter(Boolean).join(' · ')
  return [
    kopf,
    `${s.heim ? 'Heimspiel' : 'Auswärtsspiel'} gegen ${sauber(s.gegner)}`,
    `Live-Ticker, Aufstellung & Anfahrt: ${liveUrl}`,
  ]
    .filter(Boolean)
    .join('\n')
}

function prop(name: string, wert: string): string {
  return foldLine(`${name}:${wert}`)
}

function vevent(s: KalenderSpiel, d: KalenderDaten, liveUrl: string): string[] | null {
  if (!s || !s.id || !sauber(s.gegner)) return null
  if (/\(\s*test\s*\)/i.test(s.gegner)) return null
  const start = new Date(s.anstoss)
  if (Number.isNaN(start.getTime())) return null
  const ende = new Date(start.getTime() + DAUER_MS)
  const geaendert = s.geaendert ? new Date(s.geaendert) : start
  const stamp = Number.isNaN(geaendert.getTime()) ? start : geaendert
  const o = ort(s, d)
  return [
    'BEGIN:VEVENT',
    prop('UID', uidFuer(s.id)),
    `DTSTAMP:${utc(stamp)}`,
    `LAST-MODIFIED:${utc(stamp)}`,
    `SEQUENCE:${Math.max(0, Math.floor(s.seq ?? 0))}`,
    `DTSTART:${utc(start)}`,
    `DTEND:${utc(ende)}`,
    prop('SUMMARY', escapeText(titel(s))),
    ...(o ? [prop('LOCATION', escapeText(o))] : []),
    prop('DESCRIPTION', escapeText(beschreibung(s, liveUrl))),
    prop('URL;VALUE=URI', liveUrl),
    prop('CATEGORIES', ['Fußball', s.heim ? 'Heimspiel' : 'Auswärtsspiel'].map(escapeText).join(',')),
    'STATUS:CONFIRMED',
    'TRANSP:TRANSPARENT',
    'END:VEVENT',
  ]
}

/** Komplettes VCALENDAR (Abo) als String (CRLF, gefaltet). */
export function baueKalender(d: KalenderDaten, opt: KalenderOptionen): string {
  const seite = opt.seite.replace(/\/+$/, '')
  const liveUrl = `${seite}/live`
  const name = kalenderName(opt.alle)
  const zeilen: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    prop('PRODID', '-//SV Agathenburg-Dollern//Spielplan//DE'),
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    prop('NAME', escapeText(name)),
    prop('X-WR-CALNAME', escapeText(name)),
    prop(
      'X-WR-CALDESC',
      escapeText(`${opt.alle ? 'Alle Spiele' : 'Alle Heimspiele'} der 1. Herren – aktualisiert sich von selbst. ${seite}`),
    ),
    'X-WR-TIMEZONE:Europe/Berlin',
    'REFRESH-INTERVAL;VALUE=DURATION:PT6H',
    'X-PUBLISHED-TTL:PT6H',
    prop('SOURCE;VALUE=URI', `${seite}/${opt.alle ? 'kalender-alle.ics' : 'kalender.ics'}`),
    prop('URL;VALUE=URI', seite),
  ]
  for (const s of d.spiele) {
    if (!opt.alle && !s?.heim) continue
    const ev = vevent(s, d, liveUrl)
    if (ev) zeilen.push(...ev)
  }
  zeilen.push('END:VCALENDAR')
  return zeilen.join('\r\n') + '\r\n'
}

/** Ein einzelnes Spiel suchen: per Spiel-ID oder exaktem Anstoß (ISO). Nur
 *  echte Spiele aus der DB — die Function erzeugt keine freien Termine. */
export function findeSpiel(d: KalenderDaten, q: { spiel?: string | null; anstoss?: string | null }): KalenderSpiel | null {
  const id = (q.spiel || '').trim().toLowerCase()
  if (id && /^[0-9a-f-]{36}$/.test(id)) return d.spiele.find((s) => s.id.toLowerCase() === id) ?? null
  const t = q.anstoss ? new Date(q.anstoss).getTime() : NaN
  if (!Number.isNaN(t)) return d.spiele.find((s) => new Date(s.anstoss).getTime() === t) ?? null
  return null
}

/** Einzeltermin zum Hinzufügen (iPhone/Mac: Safari öffnet „Hinzufügen“). */
export function baueEinzeltermin(s: KalenderSpiel, d: KalenderDaten, seite: string): string | null {
  const ev = vevent(s, d, `${seite.replace(/\/+$/, '')}/live`)
  if (!ev) return null
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      prop('PRODID', '-//SV Agathenburg-Dollern//Spielplan//DE'),
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      ...ev,
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'
  )
}
