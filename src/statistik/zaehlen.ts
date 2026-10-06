// ─────────────────────────────────────────────────────────────
// v18-A: Cookiefreie, datensparsame Besuchszählung.
//
// Was gesendet wird (EIN kleiner POST je Seitenaufruf, nach dem ersten Bild,
// im Leerlauf): { pfad, quelle, geraet } — z. B. { "/", "instagram:bio",
// "mobil" }. Die Datenbank (web_zaehlen) zählt daraus nur Tagessummen.
//   · KEINE Cookies, KEIN localStorage/sessionStorage, keine IDs
//   · keine IP/User-Agent-Speicherung (der UA wird nur HIER im Browser grob
//     ausgewertet: Bot? Instagram-In-App-Browser? — nie übertragen)
//   · Bots/Prerender (navigator.webdriver) werden nicht gezählt
//   · v18-T: Aufrufe über den Vorführ-Link (?vorfuehrung=1) auch nicht
// Ereignisse (Ziele) laufen über dieselbe Tabelle als „#ereignis:<name>“.
// Feste Listen = supabase/migrations/20261009100000_sva_statistik.sql.
// ─────────────────────────────────────────────────────────────

import { istBotUa, pfadAusAdresse, quelleErmitteln } from './quelle'
import { istVorfuehrungsAdresse } from '../live/vorfuehrung'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export type Ereignis =
  | 'kalender-abo'
  | 'kalender-termin'
  | 'kalender-link'
  | 'probetraining-start'
  | 'probetraining'
  | 'partner-anfrage'
  | 'album-checkin'
  | 'instagram'
  | 'tipp-abgegeben'
  | 'elf-gespeichert'
  | 'liga-gegruendet'
  | 'liga-beigetreten'
  | 'tipp-teilen'

// Startzustand beim Laden des Moduls festhalten — bevor das Karten-Routing
// die Adresse normalisiert (utm_* gingen sonst verloren).
const START =
  typeof window !== 'undefined'
    ? { search: window.location.search, ref: document.referrer, host: window.location.host }
    : { search: '', ref: '', host: '' }

/** Nur im Dev-Build: was gesendet worden wäre (Prüfung/Screenshots). */
export const protokoll: { pfad: string; quelle: string; geraet: string }[] = []

function istBot(): boolean {
  if (typeof navigator === 'undefined') return true
  if (navigator.webdriver) return true
  if ((document as Document & { prerendering?: boolean }).prerendering) return true
  return istBotUa(navigator.userAgent)
}

function geraet(): 'mobil' | 'desktop' {
  try {
    return window.matchMedia('(pointer: coarse)').matches || window.innerWidth < 768 ? 'mobil' : 'desktop'
  } catch {
    return 'desktop'
  }
}

let quelleCache: string | null = null
function quelle(): string {
  return (quelleCache ??= quelleErmitteln(START.search, START.ref, START.host, navigator.userAgent))
}

function senden(pfad: string) {
  if (typeof window === 'undefined' || istBot()) return
  // v18-T: Vorführ-Link (?vorfuehrung=1) ist kein echter Besuch → nicht zählen
  if (istVorfuehrungsAdresse(START.search)) return
  const daten = { pfad, quelle: quelle(), geraet: geraet() }
  if (import.meta.env.DEV) {
    protokoll.push(daten)
    ;(window as unknown as { __svaZaehlung?: typeof protokoll }).__svaZaehlung = protokoll
    return
  }
  if (!URL_BASE || !KEY) return
  try {
    void fetch(`${URL_BASE}/rest/v1/rpc/web_zaehlen`, {
      method: 'POST',
      headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(daten),
      credentials: 'omit',
      cache: 'no-store',
      keepalive: true,
    }).catch(() => {})
  } catch {
    /* Zählung darf nie stören */
  }
}

const gezaehlt = new Set<string>()

/** Ziel-Ereignis zählen (je Seitenaufruf höchstens einmal pro Name). */
export function zaehleEreignis(name: Ereignis) {
  if (gezaehlt.has(name)) return
  gezaehlt.add(name)
  senden(`#ereignis:${name}`)
}

let seiteGezaehlt = false
function zaehleSeite() {
  if (seiteGezaehlt) return
  seiteGezaehlt = true
  const pfad = pfadAusAdresse(window.location.pathname, window.location.hash)
  senden(pfad)
  // Album: QR-Einstieg /album?c=… = Check-in gestartet
  if (pfad === '/album' && new URLSearchParams(START.search).has('c')) zaehleEreignis('album-checkin')
}

function instagramKlicks() {
  document.addEventListener(
    'click',
    (e) => {
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (a && /(^|\.)instagram\.com\//i.test(a.href.replace(/^https?:\/\//, ''))) zaehleEreignis('instagram')
    },
    { capture: true, passive: true },
  )
}

/** Einmal je Seite aufrufen (Einstieg). Zählt nach dem ersten Bild im
 *  Leerlauf — kostet die Karte keinen Frame. */
export function starteZaehlung() {
  if (typeof window === 'undefined') return
  instagramKlicks()
  const los = () => {
    const ric =
      (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback ??
      ((cb: () => void) => window.setTimeout(cb, 1500))
    ric(zaehleSeite, { timeout: 4000 })
  }
  // nach dem Laden (oder spätestens nach 4 s), dann zwei Frames Abstand
  let gestartet = false
  const einmal = () => {
    if (gestartet) return
    gestartet = true
    requestAnimationFrame(() => requestAnimationFrame(los))
  }
  if (document.readyState === 'complete') einmal()
  else {
    window.addEventListener('load', einmal, { once: true })
    window.setTimeout(einmal, 4000)
  }
}
