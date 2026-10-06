// ─────────────────────────────────────────────────────────────
// v17-A: Datenzugriff /album. Eigener Supabase-Client mit EIGENEM
// Speicherschlüssel ('sva-album-auth') — ein Fan-Login landet so nie in der
// Admin-Sitzung (/admin nutzt den Standard-Schlüssel) und umgekehrt.
// Admin-Rechte hängen ohnehin an der Allowlist sm_admins (is_sm_admin()).
//
// Login per E-Mail-Link (implicit flow: der Link funktioniert auch, wenn er
// in einem anderen Browser aufgeht als der QR-Scan) ODER per 6-stelligem
// Code aus derselben Mail. Neue Konten werden NUR hier angelegt
// (shouldCreateUser: true, user_metadata.app = 'sva-album').
// Alle Daten kommen aus RPCs; die Ziehung passiert in der Datenbank.
// ─────────────────────────────────────────────────────────────
import { createClient, isAuthRetryableFetchError, type Session } from '@supabase/supabase-js'
import { VORFUEHRUNG } from '../live/vorfuehrung'
import type { PackTyp, PackTypInfo } from './packTypen'
export type { PackTyp, PackTypInfo } from './packTypen'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

/** v22-A: /album?vorfuehrung=1 — rein clientseitige Simulation (src/album/vorfuehrung/*).
 *  Kein Login, kein Netz zur Datenbank, nichts wird gespeichert. */
export const ALBUM_VORFUEHRUNG = VORFUEHRUNG

export const albumKonfiguriert = !!(URL_BASE && KEY) && !ALBUM_VORFUEHRUNG

// In der Vorführung ein toter Client: anderer Speicherschlüssel, keine Sitzung,
// kein Token-Refresh — eine echte Fan-Sitzung im Browser bleibt unberührt.
export const supabase = createClient(URL_BASE || 'https://album.invalid', KEY || 'anon', {
  auth: ALBUM_VORFUEHRUNG
    ? { storageKey: 'sva-album-vorfuehrung', persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
    : {
        storageKey: 'sva-album-auth',
        flowType: 'implicit',
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
})

/** Sitzung des Vorführ-Fans (nur im Speicher, kein Token). */
export const VORFUEHR_SITZUNG = { user: { id: 'vorfuehrung', email: 'lena@vorfuehrung.sva' } } as unknown as Session

// ── v21-A: Sitzungs-Anker (netlify/functions/album-sitzung.mts) ─────────────
// Safari/iOS löscht localStorage nach 7 Tagen ohne Besuch (ITP). Der aktuelle
// Refresh-Token liegt deshalb zusätzlich als HttpOnly-Cookie der eigenen
// Domain; ist localStorage leer, stellt aktuelleSitzung() die Sitzung daraus
// wieder her. Lokal (Vite) gibt es den Endpunkt nicht → still ignoriert.
const ANKER = '/api/album-sitzung'
const ANKER_KOPF = { 'X-SVA-Album': '1' }
let ankerGesendet: string | null = null
function ankerSetzen(rt: string) {
  if (rt === ankerGesendet || typeof fetch === 'undefined') return
  ankerGesendet = rt
  fetch(ANKER, { method: 'POST', credentials: 'same-origin', keepalive: true, headers: { ...ANKER_KOPF, 'Content-Type': 'application/json' }, body: JSON.stringify({ rt }) })
    .then((r) => {
      if (!r.ok) ankerGesendet = null
    })
    .catch(() => {
      ankerGesendet = null
    })
}
function ankerLoeschen() {
  ankerGesendet = null
  fetch(ANKER, { method: 'DELETE', credentials: 'same-origin', keepalive: true, headers: ANKER_KOPF }).catch(() => {})
}
async function ankerHolen(): Promise<string | null> {
  try {
    const r = await fetch(ANKER, { credentials: 'same-origin', headers: ANKER_KOPF, cache: 'no-store' })
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null
    const j = (await r.json()) as { rt?: string | null }
    return typeof j.rt === 'string' && j.rt.length >= 8 ? j.rt : null
  } catch {
    return null
  }
}
if (albumKonfiguriert && !ALBUM_VORFUEHRUNG && typeof window !== 'undefined') {
  supabase.auth.onAuthStateChange((ev, s) => {
    // Kein await auf supabase.* hier (Callback läuft im Auth-Ablauf)
    if (s?.refresh_token && (ev === 'SIGNED_IN' || ev === 'TOKEN_REFRESHED' || ev === 'INITIAL_SESSION')) ankerSetzen(s.refresh_token)
    if (ev === 'SIGNED_OUT') ankerLoeschen()
  })
}

/** v21-A: Wohin ein Login-Link zurückführt (für die Startseiten-Weiche in main.tsx). */
export const LOGIN_ZIEL_KEY = 'sva-login-ziel'
function loginZielMerken(pfad: string) {
  try {
    localStorage.setItem(LOGIN_ZIEL_KEY, JSON.stringify({ pfad, t: Date.now() }))
  } catch {
    /* privat-Modus */
  }
}

// ── Typen (Spiegel der RPC-Antworten) ───────────────────────
export type Seltenheit = 'bronze' | 'silber' | 'gold' | 'spezial'
export type KartenTyp = 'spieler' | 'trainer' | 'moment' | 'partner' | 'fan'
export type Position = 'TW' | 'ABW' | 'MIT' | 'ANG'

export interface PartnerInfo {
  name: string
  logoUrl?: string
  url?: string
}

export interface Karte {
  id: string
  typ: KartenTyp
  titel: string
  untertitel?: string
  bildUrl?: string
  walkoutUrl?: string
  seltenheit: Seltenheit
  sortierung?: number
  /** v20-K: Glanz-Variante eines Spielers (füllt keinen Platz) */
  variante?: boolean
  /** v20-K: limitierte Karte (Bonus-Seite, zählt nicht fürs Album) */
  limitiert?: boolean
  /** v22: Geheimkarte (nur durch Entdecken; nie im öffentlichen Katalog) */
  geheim?: boolean
  ziehbarVon?: string
  ziehbarBis?: string
  /** v20-K: Derby-Karte (nur beim Check-in an einem bestimmten Spiel) */
  derby?: boolean
  serie?: string
  credit?: string
  bildFokus?: string
  rueckseite?: string
  praesentiertVon?: PartnerInfo
  spieler?: {
    slug: string
    name: string
    nummer?: number
    position: Position
    fotoUrl?: string
    cutoutUrl?: string
    kapitaen?: boolean
    /** nur Trainerstab: trainer | co-trainer | torwart-trainer | teammanager */
    rolle?: string
    seit?: number
    neuzugang?: boolean
    tore?: number
    vorlagen?: number
  }
  partner?: PartnerInfo & { seit?: number }
}

export interface Belohnung {
  stufe: 'schwelle_1' | 'schwelle_2' | 'schwelle_3' | 'komplett'
  checkins?: number
  titel: string
  partner?: PartnerInfo
}

export interface Katalog {
  saison: string
  aktiv: boolean
  regeln: {
    chancen: Record<Seltenheit, number>
    kartenProPack: number
    fensterVorMin: number
    fensterNachMin: number
    bonusHeimsieg: boolean
    belohnungen: Belohnung[]
    /** v20-K */
    kartenStarter?: number
    kartenHeimsieg?: number
    kartenTipp?: number
    kartenStory?: number
    kartenFreund?: number
    kartenKapitel?: number
    tauschMinTage?: number
    tauschProWoche?: number
    wunschKosten?: number
    smartPack?: boolean
    teilnahmeText?: string
    loseCheckin?: number
    loseKomplett?: number
    /** v22: Shiny-Chance 1 : N je Spieler-/Trainer-Karte (0 = aus) */
    shinyChance?: number
    /** v22: Vereins-Geburtstag als „MM-TT“ (Kerzen auf dem Cover) */
    vereinsGeburtstag?: string
    /** v22: Anzahl aktiver Geheimkarten */
    geheimAnzahl?: number
    /** v24-P: Pack-Typen (Größe, Garantie, Optik, Reveal, Wochen-Slot) */
    packTypen?: PackTypInfo[]
  }
  karten: Karte[]
}

export interface Gutschein {
  id: string
  stufe: Belohnung['stufe']
  titel: string
  code: string
  status: 'offen' | 'eingeloest'
  saison: string
  eingeloestAt?: string
  at: string
  partner?: PartnerInfo
}

export interface Profil {
  vorname: string
  initial: string
  anzeigename: string
  rangliste: boolean
  erinnerung: boolean
}

export interface Mein {
  email?: string
  saison: string
  profil: Profil | null
  checkins: number
  checkinsGesamt: number
  spiele: { gegner: string; anstoss: string; at: string }[]
  besitz: { karteId: string; anzahl: number }[]
  packs: { id: string; art: PackArt; anzahl: number; gegner?: string; at: string; titel?: string; typ?: PackTyp }[]
  gutscheine: Gutschein[]
  // ── v20-K ──
  freundCode?: string
  freunde?: string[]
  abzeichen?: string[]
  tausche?: TauschEintrag[]
  tauscheWoche?: number
  kontoTage?: number
  starterOffen?: boolean
  advent?: { tag: number; eingeloest: boolean }[] | null
  ziele?: Ziel[]
  naechstesZiel?: Ziel | null
  lose?: number
  loseVerlauf?: { anzahl: number; quelle: string; at: string }[]
  verlosungen?: Verlosung[]
  // ── v22 ──
  /** eigene Shiny-Funde (je Person; karteId = Basis-Karte der Person) */
  shiny?: ShinyFund[]
  /** wer welche Person als Erste(r) shiny gezogen hat (alle Fans) */
  shinyErstfunde?: { karteId: string; name: string; at: string; ich?: boolean }[]
  /** Geheimseite: Rätsel + (nach dem Fund) die Karte */
  geheim?: GeheimPlatz[]
}

export interface Erstfund {
  name: string
  at: string
  ich?: boolean
}
export interface ShinyFund {
  karteId: string
  /** tatsächlich gezogene Karte (Basis oder Glanz) */
  gezogen?: string
  anzahl: number
  at: string
  erstfund?: Erstfund
}
export interface GeheimPlatz {
  nr: number
  raetsel: string
  gefunden: boolean
  karte?: Karte
}

export interface TauschEintrag {
  code: string
  biete: string
  wunsch: string
  status: 'offen' | 'erledigt' | 'zurueckgezogen' | 'abgelaufen'
  eigen: boolean
  partner?: string
  at: string
}

export interface Ziel {
  id: string
  schluessel: string
  typ: string
  titel: string
  beschreibung?: string
  fortschritt: number
  benoetigt: number
  erreicht: boolean
  erreichtAt?: string
  belohnung: { karten?: number; minSeltenheit?: Seltenheit; lose?: number }
  gueltigBis?: string
  geheim?: boolean
}

export interface Verlosung {
  id: string
  titel: string
  preis?: string
  bildUrl?: string
  partner?: PartnerInfo
  stichtag?: string
  status: 'offen' | 'gezogen'
  gewinnerName?: string
  gewonnen?: boolean
  teilnahme?: boolean
}

export type PackArt = 'checkin' | 'heimsieg' | 'geschenk' | 'starter' | 'tipp' | 'story' | 'partner' | 'advent' | 'freund' | 'kapitel' | 'wunsch' | 'ziel' | 'geheim' | 'event'

export interface CheckinErgebnis {
  ok: true
  packId?: string
  bonusPackId?: string
  spiel: { gegner: string; anstoss: string }
  partner?: PartnerInfo
  checkins: number
  gutscheine: { id: string; stufe: string; titel: string; code: string }[]
  /** v20-K: Freund-Bonus (Freund ist beim selben Spiel eingecheckt) */
  freundPackId?: string
  freunde?: string[]
}

export interface PackInhalt {
  id: string
  art: PackArt
  /** v24-P */
  typ?: PackTyp
  gegner?: string
  karten: {
    karteId: string
    seltenheit: Seltenheit
    neu: boolean
    anzahl: number
    variante?: boolean
    limitiert?: boolean
    /** v22: diese Ziehung ist Shiny */
    shiny?: boolean
    erstfund?: Erstfund
    geheim?: boolean
    /** v22: Geheimkarten-Daten (stehen nicht im Katalog) */
    karte?: Karte
  }[]
  gutscheine: { id: string; stufe: string; titel: string; code: string }[]
  /** v20-K */
  titel?: string
  kapitel?: { kapitel: string; packId: string }[]
  ziele?: { titel: string; packId?: string; lose?: number }[]
}

export interface RanglistenEintrag {
  platz: number
  name: string
  checkins: number
  karten: number
  ich?: boolean
}

/** v17-D: Einlösen ohne PIN (Bestätigung im Client). */
export type EinloeseErgebnis =
  | { ok: true; eingeloestAt: string }
  | { ok: false; grund: 'verlosung' }
  | { ok: false; grund: 'schon_eingeloest'; eingeloestAt?: string }

// ── Fehler → freundlicher Text ──────────────────────────────
export class AlbumFehler extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const uhrzeit = (iso: string) =>
  new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
const datum = (iso: string) =>
  new Date(iso).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'numeric', timeZone: 'Europe/Berlin' })

export function fehlerText(code: string, detail?: string): string {
  switch (code) {
    case 'album_code_zu_frueh': {
      if (!detail) return 'Der Code gilt nur rund ums Spiel — ab einer Stunde vor Anstoß. Bis gleich am Platz!'
      const heute = new Date(detail).toDateString() === new Date().toDateString()
      return `Der Code gilt nur rund ums Spiel — einchecken kannst du ${heute ? 'heute' : `am ${datum(detail)}`} ab ${uhrzeit(detail)} Uhr. Bis gleich am Platz!`
    }
    case 'album_code_abgelaufen':
      return 'Der Code gilt nur rund ums Spiel — dieses Spiel ist schon vorbei. Beim nächsten Heimspiel wieder!'
    case 'album_code_unbekannt':
      return 'Diesen Check-in-Code kennen wir nicht. Scanne bitte den QR-Code am Eingang noch einmal.'
    case 'album_code_veraltet':
      return 'Dieser QR-Code ist nicht mehr gültig. Scanne bitte den QR-Code auf dem Bildschirm am Eingang — der wechselt alle paar Minuten.'
    case 'album_schon_eingecheckt':
      return 'Du bist für dieses Spiel schon eingecheckt — dein Pack hast du bekommen. Viel Spaß beim Spiel!'
    case 'album_pausiert':
      return 'Das Album macht gerade eine kurze Pause. Dein Check-in klappt beim nächsten Heimspiel.'
    case 'album_kein_profil':
      return 'Fast geschafft: Sag uns noch kurz deinen Vornamen.'
    case 'album_nicht_angemeldet':
      return 'Bitte melde dich kurz an.'
    case 'album_einwilligung_fehlt':
      return 'Bitte bestätige die Einwilligung, damit wir dein Album speichern dürfen.'
    case 'album_ungueltig:vorname':
      return 'Bitte nur deinen Vornamen (Buchstaben, 2–24 Zeichen).'
    case 'album_ungueltig:initial':
      return 'Bitte den ersten Buchstaben deines Nachnamens.'
    case 'album_pack_unbekannt':
      return 'Dieses Pack gibt es nicht (mehr).'
    case 'album_gutschein_unbekannt':
      return 'Diesen Gutschein gibt es nicht (mehr).'
    // v20-K
    case 'album_tausch_keine_doppelte':
      return 'Tauschen geht nur mit Doppelten — diese Karte hast du nur einmal.'
    case 'album_tausch_zu_neu':
      return 'Tauschen geht ab einer Woche im Album. Bis dahin: einfach weitersammeln.'
    case 'album_tausch_limit':
      return 'Diese Woche hast du schon fünfmal getauscht. Nächste Woche geht es weiter.'
    case 'album_tausch_karte':
      return 'Diese Karte kann man nicht tauschen.'
    case 'album_tausch_unbekannt':
      return 'Diesen Tausch gibt es nicht (mehr).'
    case 'album_wunsch_karte':
      return 'Als Wunschkarte gehen nur Kader- und Silber-Karten aus dem Album.'
    case 'album_wunsch_doppelte':
      return 'Dafür brauchst du genug Doppelte.'
    case 'album_freund_unbekannt':
      return 'Diesen Freundes-Code kennen wir nicht. Bitte noch einmal prüfen.'
    case 'album_freund_selbst':
      return 'Das ist dein eigener Code — schick ihn an deine Freunde.'
    case 'nicht-verfuegbar':
      return 'Das Album ist gerade nicht erreichbar. Bitte versuch es gleich noch einmal.'
    default:
      return 'Das hat nicht geklappt. Bitte prüf dein Netz und versuch es noch einmal.'
  }
}

function alsFehler(e: unknown): AlbumFehler {
  const err = e as { message?: string; code?: string; status?: number }
  const msg = err?.message ?? ''
  const m = /(album_[a-z_]+(?::[a-z]+)?)(?:\|([0-9TZ:.-]+))?/.exec(msg)
  if (m) return new AlbumFehler(m[1], fehlerText(m[1], m[2]))
  if (err?.code === 'PGRST202' || err?.code === '42883' || err?.status === 404) {
    return new AlbumFehler('nicht-verfuegbar', fehlerText('nicht-verfuegbar'))
  }
  return new AlbumFehler('netz', fehlerText('netz'))
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  // v22-A Vorführung: alles aus der Simulation im Browser — nie ins Netz, nie in die DB
  if (ALBUM_VORFUEHRUNG) {
    const sim = await import('./vorfuehrung/backend')
    return (await sim.simRpc(fn, args ?? {})) as T
  }
  if (!albumKonfiguriert) throw new AlbumFehler('nicht-verfuegbar', fehlerText('nicht-verfuegbar'))
  let res
  try {
    res = await supabase.rpc(fn, args)
  } catch (e) {
    throw alsFehler(e)
  }
  if (res.error) throw alsFehler({ ...res.error, status: res.status })
  return res.data as T
}

// ── Öffentlich ──────────────────────────────────────────────
// v25-D: Check-in nach QR-Scan für die E-Mail vormerken (anon; überlebt den Login
// in einem anderen Browser). Nur mit gültigem Rotationscode.
export const checkinVormerken = (spiel: string, email: string, code: string) =>
  rpc<{ ok: true }>('album_checkin_vormerken', { p_spiel: spiel, p_email: email, p_code: code })
export const ladeKatalog = () => rpc<Katalog>('album_katalog')
export const ladeRangliste = () => rpc<RanglistenEintrag[]>('album_rangliste')

// ── Eingeloggt ──────────────────────────────────────────────
export const ladeMein = () => rpc<Mein>('album_mein')
// v25-D: statischer QR gilt nur im Notfall-Modus (Rotation aus) — sonst album_code_veraltet
export const checkin = (token: string) => rpc<CheckinErgebnis>('album_checkin', { p_token: token })
// v25-D: Check-in per rotierendem Code (QR an der Check-in-Anzeige)
export const checkinRot = (spiel: string, code: string) => rpc<CheckinErgebnis>('album_checkin_rot', { p_spiel: spiel, p_code: code })
// v25-D: nach dem Login eine offene Vormerkung einlösen (Check-in überlebt „fremden Browser")
export const checkinEinloesen = () => rpc<CheckinErgebnis & { ok: boolean; grund?: string }>('album_checkin_offen_einloesen')
export const packOeffnen = (id: string) => rpc<PackInhalt>('album_pack_oeffnen', { p_pack: id })
export const profilSpeichern = (p: { vorname: string; initial: string; rangliste: boolean; erinnerung: boolean; einwilligung: boolean }) =>
  rpc<{ ok: true }>('album_profil_speichern', {
    p_vorname: p.vorname,
    p_initial: p.initial,
    p_rangliste: p.rangliste,
    p_erinnerung: p.erinnerung,
    p_einwilligung: p.einwilligung,
  })
export const gutscheinEinloesen = (id: string) =>
  rpc<EinloeseErgebnis>('album_gutschein_einloesen', { p_gutschein: id })
// ── v20-K: Karten-Quellen, Freunde, Tausch, Wunschkarte ───
export const starterHolen = () => rpc<{ packId: string | null }>('album_starter_holen')
export type CodeErgebnis =
  | { ok: true; packId: string; art: PackArt; titel?: string; typ?: PackTyp }
  | { ok: false; grund: 'ungueltig' | 'noch_nicht' | 'abgelaufen' | 'schon' | 'gesperrt' | 'kein_profil' | 'nicht_heute'; geheim?: boolean }
export const codeEinloesen = (code: string) => rpc<CodeErgebnis>('album_code_einloesen', { p_code: code })
export const freundHinzufuegen = (code: string) => rpc<{ ok: true; name: string }>('album_freund_hinzufuegen', { p_code: code })
export const tauschAnbieten = (biete: string, wunsch: string) => rpc<{ code: string }>('album_tausch_anbieten', { p_biete: biete, p_wunsch: wunsch })
export interface TauschAnsicht {
  code: string
  von: string
  biete: string
  wunsch: string
  status: TauschEintrag['status']
  eigen: boolean
  kannAnnehmen: boolean
  grund?: string
}
export const tauschAnsehen = (code: string) => rpc<TauschAnsicht>('album_tausch_ansehen', { p_code: code })
export const tauschAnnehmen = (code: string) => rpc<{ ok: true; erhalten: string; abgegeben: string }>('album_tausch_annehmen', { p_code: code })
export const tauschZurueckziehen = (code: string) => rpc<{ ok: true }>('album_tausch_zurueckziehen', { p_code: code })
export const wunschkarte = (karte: string, gegen: string[]) => rpc<{ packId: string }>('album_wunschkarte', { p_karte: karte, p_gegen: gegen })

export const kontoLoeschen = () => rpc<{ ok: true; loginGeloescht: boolean }>('album_konto_loeschen')

// ── Login ───────────────────────────────────────────────────
let wiederhergestellt: Promise<Session | null> | null = null
/** Sitzung aus localStorage; ist sie weg (Safari-ITP, Speicher geleert), einmal
 *  pro Seitenaufruf aus dem Sitzungs-Anker wiederherstellen. */
export async function aktuelleSitzung(): Promise<Session | null> {
  if (ALBUM_VORFUEHRUNG) return VORFUEHR_SITZUNG
  if (!albumKonfiguriert) return null
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session) return data.session
  } catch {
    return null
  }
  // Login-Rückkehr mit Tokens in der Adresse: das übernimmt supabase-js selbst
  if (typeof window !== 'undefined' && /(^|[#&])(access_token|error_description)=/.test(window.location.hash)) return null
  wiederhergestellt ??= (async () => {
    const rt = await ankerHolen()
    if (!rt) return null
    try {
      const { data, error } = await supabase.auth.refreshSession({ refresh_token: rt })
      if (error) {
        // abgelaufen/widerrufen → Anker weg; Netzfehler → beim nächsten Aufruf wieder versuchen
        if (isAuthRetryableFetchError(error)) wiederhergestellt = null
        else ankerLoeschen()
        return null
      }
      return data.session
    } catch {
      wiederhergestellt = null
      return null
    }
  })()
  return wiederhergestellt
}

/** Login-Link (+ 6-stelliger Code) per E-Mail. `token` = offener Check-in-Code. */
export async function loginLinkSenden(email: string, token: string | null): Promise<void> {
  if (!albumKonfiguriert) throw new AlbumFehler('nicht-verfuegbar', fehlerText('nicht-verfuegbar'))
  const ziel = `${window.location.origin}/album${token ? `?c=${encodeURIComponent(token)}` : ''}`
  loginZielMerken('/album')
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: ziel, data: { app: 'sva-album' } },
  })
  if (error) {
    if (error.status === 429 || /security purposes|rate limit/i.test(error.message)) {
      throw new AlbumFehler('limit', 'Gerade wurde schon ein Link verschickt. Bitte warte eine Minute und schau in dein Postfach (auch im Spam-Ordner).')
    }
    if (/invalid/i.test(error.message) && /email/i.test(error.message)) {
      throw new AlbumFehler('email', 'Diese E-Mail-Adresse sieht nicht richtig aus.')
    }
    throw new AlbumFehler('netz', 'Der Link konnte nicht verschickt werden. Bitte versuch es gleich noch einmal.')
  }
}

export async function codeBestaetigen(email: string, code: string): Promise<void> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (error) throw new AlbumFehler('code', 'Der Code passt nicht oder ist abgelaufen. Fordere einfach einen neuen an.')
}

export async function abmelden(): Promise<void> {
  if (ALBUM_VORFUEHRUNG) return
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* lokal trotzdem weg */
  }
}
