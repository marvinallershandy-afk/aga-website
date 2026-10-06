// ─────────────────────────────────────────────────────────────
// v20-T: Datenzugriff /tippen. Gemeinsames Konto mit dem Sammelalbum:
// derselbe Supabase-Client mit DEMSELBEN Speicherschlüssel ('sva-album-auth')
// → wer im Album eingeloggt ist, ist es hier auch (und umgekehrt).
// Alle Daten kommen aus RPCs (supabase/migrations/20261012100000_sva_tippliga.sql);
// Punkte rechnet ausschließlich die Datenbank.
// ─────────────────────────────────────────────────────────────
import { albumKonfiguriert, supabase, type Katalog, type Mein } from '../album/api'
import { VORFUEHRUNG } from '../live/vorfuehrung'

export { supabase, albumKonfiguriert as tippKonfiguriert }
export { aktuelleSitzung, abmelden, codeBestaetigen } from '../album/api'

/** v21: /tippen?vorfuehrung=1 — rein clientseitige Simulation, KEINE Datenbank. */
export const IST_VORFUEHRUNG = VORFUEHRUNG

/** v22-T: Album-Ziel — in der Vorführung der Album-Vorführmodus (kein Login),
 *  sonst das echte Album (gleiches Konto, 'sva-album-auth'). */
export const ALBUM_HREF = IST_VORFUEHRUNG ? '/album?vorfuehrung=1' : '/album'

/** v24-P: Album-Deep-Link, der genau dieses Pack sofort öffnet (ohne ID: alle wartenden Tütchen). */
export function albumPackHref(packId?: string | null): string {
  if (!packId) return `${ALBUM_HREF}#tuetchen`
  return `${ALBUM_HREF}${ALBUM_HREF.includes('?') ? '&' : '?'}oeffnen=${encodeURIComponent(packId)}`
}

export type Position = 'TW' | 'ABW' | 'MIT' | 'ANG'
export type BonusKey = 'gelb' | 'rot' | 'tor20' | 'tore_hz1' | 'elfmeter' | 'zuschauer' | 'erstes_tor'

export interface KaderSpieler {
  id: string
  name: string
  nummer?: number
  position: Position
  /** v21: darf auch auf diese Position (Admin pflegt), z. B. offensiver MIT → ANG */
  zweitposition?: Position
  /** v21: verletzt/abwesend — ausgegraut, nicht wählbar */
  nichtVerfuegbar?: boolean
  hinweis?: string
  fotoUrl?: string
  cutoutUrl?: string
  kapitaen?: boolean
  spiele: number
  tore: number
}

export interface MeinTipp {
  toreSva: number
  toreGegner: number
  ersterTorschuetze?: string
  motm?: string
  joker: boolean
  bonus: Partial<Record<BonusKey, string>>
  at?: string
}

export interface MeineElf {
  spieler: string[]
  kapitaen: string
  frei: boolean
}

export interface SpielerPosten {
  k: 'einsatz' | 'tor' | 'vorlage' | 'zunull' | 'motm' | 'sieg' | 'gelb' | 'gelbrot' | 'rot'
  p: number
  n?: number
}

export interface PunkteDetails {
  tipp: {
    ergebnis: number
    art: 'exakt' | 'differenz' | 'tendenz' | 'daneben' | 'kein'
    torschuetze: number
    motm: number
    bonus: Partial<Record<BonusKey, number>>
    bonusSumme: number
    bonusRichtig: number
    summe: number
    joker: boolean
    gesamt: number
  }
  elf?: { id: string; punkte: number; gesamt: number; kapitaen: boolean; eingesetzt: boolean; posten: SpielerPosten[] }[]
  kapitaenPunkte?: number
  hatTipp?: boolean
  hatElf?: boolean
}

export interface MeinePunkte {
  tipp: number
  elf: number
  joker: boolean
  gesamt: number
  exakt: boolean
  details: PunkteDetails
}

/** v21: Live-Daten während des Spiels (Vorführung: simuliert; echt: aus dem Spielstand). */
export interface LiveEreignis {
  minute: number
  typ: 'anpfiff' | 'tor' | 'gegentor' | 'gelb' | 'gelbrot' | 'rot' | 'wechsel' | 'halbzeit' | 'wiederanpfiff' | 'abpfiff' | 'elfmeter'
  spieler?: string
  spieler2?: string
  text?: string
  stand?: [number, number]
}

export interface LiveHochrechnung {
  tipp: number
  elf: number
  gesamt: number
  /** Teil A je Baustein (wie PunkteDetails.tipp), vorläufig */
  teile: { k: 'ergebnis' | 'torschuetze' | 'bonus' | 'joker'; label: string; p: number; offen?: boolean }[]
  /** Elf je Spieler, vorläufig */
  elfSpieler: { id: string; p: number; kapitaen: boolean; posten: SpielerPosten[] }[]
}

export interface LiveDaten {
  minute: number
  nachspielzeit?: number
  ereignisse: LiveEreignis[]
  ich?: LiveHochrechnung
  rangliste?: RangEintrag[]
  /** Fans vs. Kabine im Spiel (Ø live) */
  duell?: { fans: number; kabine: number }
  /** v23-U: öffentliche Kurzkennzahl (tipp_live_kurz) — Tipps + Tendenz (nach Tippschluss). */
  tippLive?: { tipps: number; sieg?: number; remis?: number; niederlage?: number }
  /** v23-U: Ticker-Quelle (für den FuPa-Fuß). */
  quelle?: 'fupa' | 'pult'
  fupaUrl?: string
}

export interface TippSpiel {
  id: string
  gegner: string
  heim: boolean
  anstoss: string
  schluss: string
  offen: boolean
  wettbewerb?: string
  spieltag?: number
  ort?: string
  status: 'geplant' | 'live' | 'halbzeit' | 'beendet'
  wertung: 'saison' | 'winter'
  toreSva?: number
  toreGegner?: number
  fragen: { key: BonusKey; linie?: number }[]
  anzahlTipps: number
  gewertetAt?: string
  aufloesung?: Partial<Record<BonusKey, string>>
  motm?: string
  ersterTorschuetze?: string
  meinTipp?: MeinTipp
  meineElf?: MeineElf
  meinePunkte?: MeinePunkte
  /** v21: nur während des Spiels */
  live?: LiveDaten
}

export interface PartnerInfo {
  name: string
  logoUrl?: string
  url?: string
}

export interface Ich {
  email?: string
  profil?: { vorname: string; initial: string; anzeigename: string }
  teilnehmer?: { sichtbar: boolean; kabine: boolean; seit: string }
  jokerFrei?: boolean
  abzeichen: { key: string; at: string }[]
  statistik?: { punkte: number; spieltage: number; exakt: number; beste: number }
  tippsGesamt: number
  letzteElf?: MeineElf
  ligen: number
}

/** v21-UX (Vorschlag): zuletzt aufgestellte Startelf des Vereins — als „Vorschlag
 *  übernehmen“ für neue Tipper ohne eigene letzte Elf (nie automatisch abgegeben). */
export interface VorschlagElf extends MeineElf {
  /** Woher der Vorschlag kommt (z. B. „Aufstellung Horneburg“) — für den Hinweis. */
  quelle?: string
}

/** v22-T: das nächste Spiel, solange es noch gesperrt ist (ein Fokus) — nur Vorschau. */
export interface NaechstesSpiel {
  id: string
  gegner: string
  heim: boolean
  anstoss: string
  wettbewerb?: string
  spieltag?: number
  /** spätestens ab dann tippbar (Abpfiff des laufenden Spiels + 24 h); früher, sobald gewertet */
  oeffnetAb?: string
}

/** v22-T: Preis (Admin pflegt; leer = Bereich unsichtbar). */
export interface Preis {
  wertung: 'saison' | 'monat'
  platz: number
  titel: string
  beschreibung?: string
  abAlter?: 16 | 18
  alternative?: string
  partner?: PartnerInfo
}

export interface Lage {
  version: number
  serverNow: string
  saison: string
  einstellungen: {
    aktiv: boolean
    partner?: PartnerInfo
    preise?: string
    elfFrei: boolean
    winterpause: { aktiv: boolean; bis: string; von: string }
  }
  /** JETZT tippbar (v22: nur, wenn kein früheres Spiel noch auf die Wertung wartet) */
  offen?: TippSpiel
  /** v22-T: gesperrtes nächstes Spiel als dezente Vorschau */
  naechstes?: NaechstesSpiel
  gesperrt?: TippSpiel
  gewertet?: TippSpiel
  kader: KaderSpieler[]
  ich?: Ich
  /** v21-UX: Vorschlags-Elf (letzte Vereins-Startelf) für neue Tipper. */
  vorschlagElf?: VorschlagElf
  /** v22-T: Preise (Saison Platz 1–5, Monat) */
  preise?: Preis[]
  /** v24-P: Pack-Typ „tipp“ des Albums (fehlt = Tipp-Pack aus) */
  tippPack?: { titel: string; karten: number }
}

export interface RangEintrag {
  platz: number
  name: string
  punkte: number
  exakt: number
  spiele: number
  trend?: number
  neu?: boolean
  kabine?: boolean
  ich?: boolean
  /** v21: Live-Hochrechnung: Punkte vor dem letzten Ereignis (für Zähler) */
  vorher?: number
}

export type RangArt = 'spieltag' | 'monat' | 'saison' | 'winter'

export interface Rangliste {
  art: RangArt
  spielId?: string
  monat?: string
  saison?: string
  eintraege: RangEintrag[]
  ich?: RangEintrag
  teilnehmer: number
  schnitt?: number
  spiel?: { gegner: string; heim: boolean; anstoss: string; toreSva?: number; toreGegner?: number }
}

export interface Duell {
  spieltag?: { spielId: string; gegner: string; heim: boolean; anstoss: string; fans?: number; kabine?: number; nFans: number; nKabine: number }
  saison: { saison: string; fans?: number; kabine?: number; nFans: number; nKabine: number }
  kabineBester?: { name: string; punkte: number }
}

export interface Verteilung {
  n: number
  ergebnisse: { toreSva: number; toreGegner: number; anteil: number }[]
  tendenz: { sieg: number; remis: number; niederlage: number }
  elf: { spieler: string; anteil: number }[]
  kapitaen?: { spieler: string; anteil: number }
  joker: number
}

export interface Liga {
  id: string
  name: string
  /** System-Ligen (Kabine) haben keinen Code */
  code?: string
  gruender: boolean
  /** v21: 'kabine' = feste Kabinen-Liga (automatisch, kein Verlassen) */
  system?: 'kabine'
  mitglieder: number
  meinPlatz?: number
  fuehrender?: string
}

export interface LigaTipp {
  name: string
  ich?: boolean
  toreSva?: number
  toreGegner?: number
  joker?: boolean
  kapitaen?: string
  punkte?: number
}

export interface AbgabeErgebnis {
  ok: true
  neu: boolean
  karte: boolean
  abzeichen: string[]
  anzahlTipps: number
  /** v24-P: gutgeschriebenes Tipp-Pack (nur beim ersten Tipp eines Spieltags) */
  packId?: string
  pack?: { id: string; typ: string; titel: string; karten: number }
}

// ── Fehler → freundlicher Text ──────────────────────────────
export class TippFehler extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

export function fehlerText(code: string): string {
  switch (code) {
    case 'tipp_geschlossen':
      return 'Tippschluss — der Ball rollt schon. Beim nächsten Spieltag bist du wieder dabei.'
    case 'tipp_noch_nicht_offen':
      return 'Dieser Spieltag öffnet erst nach der Auflösung des laufenden Spiels.'
    case 'tipp_nicht_tippbar':
      return 'Für dieses Spiel gibt es keine Tipp-Runde.'
    case 'tipp_kein_teilnehmer':
      return 'Fast geschafft: Einmal kurz anmelden und mitmachen.'
    case 'tipp_nicht_angemeldet':
      return 'Bitte melde dich kurz an.'
    case 'tipp_joker_verbraucht':
      return 'Deinen Joker hast du diesen Monat schon gesetzt. Ab dem 1. gibt’s einen neuen.'
    case 'tipp_pausiert':
      return 'Die Tipp-Liga macht gerade Pause.'
    case 'tipp_bedingungen_fehlen':
      return 'Bitte bestätige die Teilnahmebedingungen.'
    case 'tipp_einwilligung_fehlt':
      return 'Bitte bestätige die Einwilligung, damit wir deine Tipps speichern dürfen.'
    case 'album_ungueltig:vorname':
      return 'Bitte nur deinen Vornamen (Buchstaben, 2–24 Zeichen).'
    case 'album_ungueltig:initial':
      return 'Bitte den ersten Buchstaben deines Nachnamens.'
    case 'tipp_ungueltig:positionen':
      return 'Deine Elf: Torwart, Abwehr, zwei Mittelfeld, ein Angreifer — oder „Frei aufstellen“ wählen.'
    case 'tipp_ungueltig:nicht_verfuegbar':
      return 'Ein Spieler deiner Elf ist gerade nicht verfügbar. Bitte tausch ihn aus.'
    case 'tipp_liga_system':
      return 'Die Kabinen-Liga gehört automatisch zu jedem Spieler-Konto.'
    case 'tipp_ungueltig:elf':
      return 'Deine Elf braucht fünf verschiedene Spieler.'
    case 'tipp_ungueltig:kapitaen':
      return 'Wähle einen Kapitän aus deiner Elf.'
    case 'tipp_ungueltig:liganame':
      return 'Der Liga-Name braucht 3 bis 40 Zeichen.'
    case 'tipp_liga_unbekannt':
      return 'Diesen Liga-Code kennen wir nicht. Tippfehler?'
    case 'tipp_liga_voll':
      return 'Diese Liga ist voll.'
    case 'tipp_liga_limit':
      return 'Du hast schon fünf Ligen gegründet.'
    case 'tipp_liga_kein_mitglied':
      return 'Diese Liga sehen nur ihre Mitglieder.'
    case 'tipp_noch_offen':
      return 'Das siehst du nach dem Anpfiff.'
    case 'nicht-verfuegbar':
      return 'Die Tipp-Liga ist gerade nicht erreichbar. Bitte gleich noch einmal versuchen.'
    default:
      return 'Das hat nicht geklappt. Bitte prüf dein Netz und versuch es noch einmal.'
  }
}

function alsFehler(e: unknown): TippFehler {
  const err = e as { message?: string; code?: string; status?: number }
  const msg = err?.message ?? ''
  const m = /((?:tipp|album)_[a-z_]+(?::[a-z_]+)?)/.exec(msg)
  if (m) return new TippFehler(m[1], fehlerText(m[1]))
  if (err?.code === 'PGRST202' || err?.code === '42883' || err?.status === 404) {
    return new TippFehler('nicht-verfuegbar', fehlerText('nicht-verfuegbar'))
  }
  return new TippFehler('netz', fehlerText('netz'))
}

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  // Vorführung: alles aus der Simulation im Browser — nie ins Netz, nie in die DB
  if (IST_VORFUEHRUNG) {
    const sim = await import('./vorfuehrung/backend')
    return sim.simRpc(fn, args ?? {}) as T
  }
  if (!albumKonfiguriert) throw new TippFehler('nicht-verfuegbar', fehlerText('nicht-verfuegbar'))
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
export const ladeLage = () => rpc<Lage>('tipp_lage')
export const ladeRangliste = (art: RangArt, bezug?: string | null, liga?: string | null) =>
  rpc<Rangliste>('tipp_rangliste', { p_art: art, p_bezug: bezug ?? null, p_liga: liga ?? null })
export const ladeDuell = () => rpc<Duell>('tipp_duell')
export const ladeVerteilung = (spiel: string) => rpc<Verteilung>('tipp_verteilung', { p_spiel: spiel })
export const ladeKabinenLiga = () => rpc<{ id: string; name: string; system: 'kabine'; mitglieder: number } | null>('tipp_kabinen_liga')
export const ligaVorschau = (code: string) => rpc<{ name: string; code: string; mitglieder: number } | null>('tipp_liga_vorschau', { p_code: code })

// ── Eingeloggt ──────────────────────────────────────────────
export const beitreten = (p: { vorname: string; initial: string; sichtbar: boolean; bedingungen: boolean; einwilligung: boolean }) =>
  rpc<{ ok: true }>('tipp_beitreten', {
    p_vorname: p.vorname,
    p_initial: p.initial,
    p_sichtbar: p.sichtbar,
    p_bedingungen: p.bedingungen,
    p_einwilligung: p.einwilligung,
  })
export const profilSpeichern = (vorname: string, initial: string, sichtbar: boolean) =>
  rpc<{ ok: true }>('tipp_profil_speichern', { p_vorname: vorname, p_initial: initial, p_sichtbar: sichtbar })
export const tippAbgeben = (spiel: string, t: MeinTipp) =>
  rpc<AbgabeErgebnis>('tipp_abgeben', {
    p_spiel: spiel,
    p_tore_sva: t.toreSva,
    p_tore_gegner: t.toreGegner,
    p_erster: t.ersterTorschuetze ?? null,
    p_motm: t.motm ?? null,
    p_joker: t.joker,
    p_bonus: t.bonus,
  })
export const elfSpeichern = (spiel: string, e: MeineElf) =>
  rpc<{ ok: true }>('tipp_elf_speichern', { p_spiel: spiel, p_spieler: e.spieler, p_kapitaen: e.kapitaen, p_frei: e.frei })
export const ligaGruenden = (name: string) => rpc<{ id: string; name: string; code: string }>('tipp_liga_gruenden', { p_name: name })
export const ligaBeitreten = (code: string) => rpc<{ id: string; name: string; code: string; abzeichen: string[] }>('tipp_liga_beitreten', { p_code: code })
export const ligaVerlassen = (id: string) => rpc<{ ok: true }>('tipp_liga_verlassen', { p_liga: id })
export const meineLigen = () => rpc<Liga[]>('tipp_meine_ligen')
export const ligaTipps = (liga: string, spiel: string) => rpc<LigaTipp[]>('tipp_liga_tipps', { p_liga: liga, p_spiel: spiel })

// ── Album-Stand (für den Umschalter „Tipp-Liga | Album“) ────
export interface AlbumStand {
  belegt: number
  gesamt: number
  /** ungeöffnete Tütchen */
  tuetchen: number
}
export async function ladeAlbumStand(): Promise<AlbumStand | null> {
  if (IST_VORFUEHRUNG) return rpc<AlbumStand>('album_stand')
  if (!albumKonfiguriert) return null
  try {
    const [{ data: katalog }, { data: mein }] = await Promise.all([supabase.rpc('album_katalog'), supabase.rpc('album_mein')])
    if (!katalog) return null
    const { plaetze, besitzMap, fortschritt } = await import('../album/model')
    const f = fortschritt(plaetze(katalog as Katalog, besitzMap((mein as Mein | null) ?? null)))
    const tuetchen = ((mein as Mein | null)?.packs ?? []).reduce((a, p) => a + (p.anzahl ?? 1), 0)
    return { belegt: f.belegt, gesamt: f.gesamt, tuetchen }
  } catch {
    return null
  }
}

// ── Login (gemeinsam mit dem Album, Rücksprung nach /tippen) ─
export async function loginLinkSenden(email: string, rueck: string): Promise<void> {
  if (!albumKonfiguriert) throw new TippFehler('nicht-verfuegbar', fehlerText('nicht-verfuegbar'))
  const { error } = await supabase.auth.signInWithOtp({
    email,
    // gleiche Kennung wie das Album → „Konto löschen“ darf das Login mitnehmen
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}${rueck}`, data: { app: 'sva-album' } },
  })
  if (error) {
    if (error.status === 429 || /security purposes|rate limit/i.test(error.message)) {
      throw new TippFehler('limit', 'Gerade wurde schon ein Link verschickt. Bitte warte eine Minute und schau in dein Postfach (auch im Spam-Ordner).')
    }
    if (/invalid/i.test(error.message) && /email/i.test(error.message)) {
      throw new TippFehler('email', 'Diese E-Mail-Adresse sieht nicht richtig aus.')
    }
    throw new TippFehler('netz', 'Der Link konnte nicht verschickt werden. Bitte versuch es gleich noch einmal.')
  }
}
