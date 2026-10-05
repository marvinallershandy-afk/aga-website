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
import { createClient, type Session } from '@supabase/supabase-js'

const URL_BASE = import.meta.env.VITE_SUPABASE_URL as string | undefined
const KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const albumKonfiguriert = !!(URL_BASE && KEY)

export const supabase = createClient(URL_BASE || 'https://album.invalid', KEY || 'anon', {
  auth: {
    storageKey: 'sva-album-auth',
    flowType: 'implicit',
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
})

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
  }
  partner?: PartnerInfo
}

export interface Belohnung {
  stufe: 'schwelle_1' | 'schwelle_2' | 'komplett'
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
  packs: { id: string; art: PackArt; anzahl: number; gegner?: string; at: string }[]
  gutscheine: Gutschein[]
}

export type PackArt = 'checkin' | 'heimsieg' | 'geschenk'

export interface CheckinErgebnis {
  ok: true
  packId?: string
  bonusPackId?: string
  spiel: { gegner: string; anstoss: string }
  partner?: PartnerInfo
  checkins: number
  gutscheine: { id: string; stufe: string; titel: string; code: string }[]
}

export interface PackInhalt {
  id: string
  art: PackArt
  gegner?: string
  karten: { karteId: string; seltenheit: Seltenheit; neu: boolean; anzahl: number }[]
  gutscheine: { id: string; stufe: string; titel: string; code: string }[]
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
export const ladeKatalog = () => rpc<Katalog>('album_katalog')
export const ladeRangliste = () => rpc<RanglistenEintrag[]>('album_rangliste')

// ── Eingeloggt ──────────────────────────────────────────────
export const ladeMein = () => rpc<Mein>('album_mein')
export const checkin = (token: string) => rpc<CheckinErgebnis>('album_checkin', { p_token: token })
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
export const kontoLoeschen = () => rpc<{ ok: true; loginGeloescht: boolean }>('album_konto_loeschen')

// ── Login ───────────────────────────────────────────────────
export async function aktuelleSitzung(): Promise<Session | null> {
  if (!albumKonfiguriert) return null
  try {
    const { data } = await supabase.auth.getSession()
    return data.session
  } catch {
    return null
  }
}

/** Login-Link (+ 6-stelliger Code) per E-Mail. `token` = offener Check-in-Code. */
export async function loginLinkSenden(email: string, token: string | null): Promise<void> {
  if (!albumKonfiguriert) throw new AlbumFehler('nicht-verfuegbar', fehlerText('nicht-verfuegbar'))
  const ziel = `${window.location.origin}/album${token ? `?c=${encodeURIComponent(token)}` : ''}`
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
  try {
    await supabase.auth.signOut({ scope: 'local' })
  } catch {
    /* lokal trotzdem weg */
  }
}
