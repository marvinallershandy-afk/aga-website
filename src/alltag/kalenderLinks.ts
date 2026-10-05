// ─────────────────────────────────────────────────────────────
// v18-A: Kalender-Links — reine Funktionen (Node-Test: kalenderLinks.test.mjs).
//
// Einzelspiel:
//   · Google:  calendar.google.com/calendar/render?action=TEMPLATE … (UTC-Zeiten
//              mit „Z“ → Google rechnet in die Zeitzone des Nutzers um)
//   · Outlook: outlook.live.com/calendar/0/deeplink/compose … (ISO mit „Z“)
//   · Apple:   echte https-URL der Edge Function (/kalender.ics?anstoss=…)
//              → Safari öffnet „Hinzufügen“ (text/calendar, inline)
// Abo:
//   · Apple:   webcal://<host>/kalender.ics
//   · Google:  calendar.google.com/calendar/r?cid=webcal://…
//   · Outlook: outlook.live.com/calendar/0/addfromweb?url=…&name=…
// Google/Outlook für EIN Spiel funktionieren ohne Edge Function.
// ─────────────────────────────────────────────────────────────

export const VEREIN = 'SV Agathenburg-Dollern'
export const DAUER_MS = 2 * 60 * 60 * 1000

export interface KalenderSpiel {
  /** Spiel-ID (sm_spiele.id), falls bekannt — sonst wird über den Anstoß gesucht */
  id?: string
  gegner: string
  heim: boolean
  /** ISO-Zeitpunkt mit Zeitzone, z. B. 2026-10-11T15:00:00+02:00 */
  anstoss: string
  /** Spielort (Adresse); Heimspiel ohne Angabe → Vereinsadresse */
  ort?: string
  wettbewerb?: string
}

export type Geraet = 'apple' | 'android' | 'windows' | 'sonst'
export type Anbieter = 'apple' | 'google' | 'outlook'

/** Grobe Geräte-Erkennung nur für die Reihenfolge der Knöpfe (nichts wird gespeichert). */
export function erkenneGeraet(ua: string): Geraet {
  if (/Android/i.test(ua)) return 'android'
  // iPhone/iPad (iPadOS meldet sich als „Macintosh“) und Mac → Apple Kalender
  if (/iPhone|iPad|iPod|Macintosh|Mac OS X/i.test(ua)) return 'apple'
  if (/Windows/i.test(ua)) return 'windows'
  return 'sonst'
}

/** Empfohlene Reihenfolge je Gerät (erste = hervorgehoben). */
export function reihenfolge(g: Geraet): Anbieter[] {
  if (g === 'apple') return ['apple', 'google', 'outlook']
  if (g === 'windows') return ['outlook', 'google', 'apple']
  return ['google', 'apple', 'outlook']
}

/** Date → 20261011T130000Z (Google-Format) */
export function utcKompakt(d: Date): string {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}
/** Date → 2026-10-11T13:00:00Z (Outlook-Format) */
export function utcIso(d: Date): string {
  return d.toISOString().replace(/\.\d{3}/, '')
}

export function spielTitel(s: KalenderSpiel): string {
  return s.heim ? `${VEREIN} – ${s.gegner}` : `${s.gegner} – ${VEREIN}`
}

export function spielText(s: KalenderSpiel, seite: string): string {
  return [s.wettbewerb, `${s.heim ? 'Heimspiel' : 'Auswärtsspiel'} gegen ${s.gegner}`, `Live-Ticker, Aufstellung & Anfahrt: ${seite.replace(/\/+$/, '')}/live`]
    .filter(Boolean)
    .join('\n')
}

function zeiten(s: KalenderSpiel): { start: Date; ende: Date } | null {
  const start = new Date(s.anstoss)
  if (Number.isNaN(start.getTime())) return null
  return { start, ende: new Date(start.getTime() + DAUER_MS) }
}

export function googleTerminUrl(s: KalenderSpiel, seite: string, adresse: string): string | null {
  const z = zeiten(s)
  if (!z) return null
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: spielTitel(s),
    dates: `${utcKompakt(z.start)}/${utcKompakt(z.ende)}`,
    details: spielText(s, seite),
    location: s.ort || (s.heim ? adresse : ''),
    ctz: 'Europe/Berlin',
  })
  return `https://calendar.google.com/calendar/render?${p.toString()}`
}

export function outlookTerminUrl(s: KalenderSpiel, seite: string, adresse: string): string | null {
  const z = zeiten(s)
  if (!z) return null
  const p = new URLSearchParams({
    path: '/calendar/action/compose',
    rru: 'addevent',
    subject: spielTitel(s),
    startdt: utcIso(z.start),
    enddt: utcIso(z.ende),
    location: s.ort || (s.heim ? adresse : ''),
    body: spielText(s, seite),
  })
  return `https://outlook.live.com/calendar/0/deeplink/compose?${p.toString()}`
}

/** Einzeltermin als echte ICS-URL (Edge Function über Netlify-Proxy). */
export function appleTerminUrl(s: KalenderSpiel, origin: string): string | null {
  const z = zeiten(s)
  if (!z) return null
  const q = s.id ? `spiel=${encodeURIComponent(s.id)}` : `anstoss=${encodeURIComponent(utcIso(z.start))}`
  return `${origin.replace(/\/+$/, '')}/kalender.ics?${q}`
}

export function aboUrls(origin: string, alle: boolean) {
  const https = `${origin.replace(/\/+$/, '')}/${alle ? 'kalender-alle.ics' : 'kalender.ics'}`
  const webcal = https.replace(/^https?:\/\//, 'webcal://')
  const name = alle ? `${VEREIN} – alle Spiele` : `${VEREIN} – Heimspiele`
  return {
    https,
    webcal,
    google: `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcal)}`,
    outlook: `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(https)}&name=${encodeURIComponent(name)}`,
    name,
  }
}
