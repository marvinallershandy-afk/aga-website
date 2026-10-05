// ─────────────────────────────────────────────────────────────
// v15-T: Tabelle per Screenshot — Client-Logik.
//
// Ablauf: Bild(er) im Browser verkleinern → Edge Function „tabelle-aus-bild"
// (Claude liest ab, Server prüft) → Vorschau mit Diff gegen die gespeicherte
// Saison-Tabelle → Übernehmen ersetzt die Saison-Tabelle in sm_tabelle.
//
// Die Plausibilitäts-Regeln (Punkte = 3·S + U, S+U+N = Spiele, eigene
// Mannschaft) kommen aus derselben Datei wie in der Edge Function — eine
// Quelle der Wahrheit für Server-Prüfung und Live-Prüfung beim Bearbeiten.
// ─────────────────────────────────────────────────────────────
import { supabase } from './supabase'
import { loadImage, renderScreenshot } from './image'
import type { TabelleInput, TabelleRow } from './db'
import {
  MAX_BILDER,
  ZAHLEN,
  istEigeneMannschaft,
  pruefeZeile,
  teamSchluessel,
  type TabellenErgebnis,
  type ZahlFeld,
} from '../../../supabase/functions/tabelle-aus-bild/logik.ts'

export { MAX_BILDER, ZAHLEN, istEigeneMannschaft, type TabellenErgebnis, type ZahlFeld }

export const FUNCTION_NAME = 'tabelle-aus-bild'

// ── Bilder ───────────────────────────────────────────────────

/** Datei → 1..n verkleinerte Bilder (lange Scroll-Screenshots werden geteilt). */
export async function bildVorbereiten(file: Blob, maxTeile = MAX_BILDER): Promise<Blob[]> {
  if (file.type && !file.type.startsWith('image/')) throw new Error('Das ist kein Bild. Bitte einen Screenshot auswählen.')
  let img: HTMLImageElement
  try {
    img = await loadImage(file)
  } catch {
    throw new Error('Das Bild lässt sich nicht öffnen. Bitte einen normalen Screenshot (PNG oder JPG) nehmen.')
  }
  return renderScreenshot(img, 2000, Math.max(1, maxTeile))
}

export function blobZuBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''))
    r.onerror = () => reject(new Error('Bild konnte nicht gelesen werden.'))
    r.readAsDataURL(blob)
  })
}

/** Ruft die Edge Function auf. Wirft immer einen deutschen, verständlichen Fehler. */
export async function tabelleAuslesen(bilder: Blob[]): Promise<TabellenErgebnis> {
  const payload = {
    bilder: await Promise.all(
      bilder.map(async (b) => ({ mediaType: b.type || 'image/jpeg', data: await blobZuBase64(b) })),
    ),
  }
  const { data, error } = await supabase.functions.invoke(FUNCTION_NAME, { body: payload })
  if (error) {
    const ctx = (error as { context?: unknown }).context
    const status = ctx instanceof Response ? ctx.status : null
    let meldung: string | null = null
    if (ctx instanceof Response) {
      try {
        const j = (await ctx.clone().json()) as { error?: unknown }
        if (typeof j?.error === 'string') meldung = j.error
      } catch {
        /* keine JSON-Antwort */
      }
    }
    if (status === 404 && !meldung) {
      throw new Error('Die Bilderkennung ist auf dem Server noch nicht eingerichtet. Bitte Marvin Bescheid geben.')
    }
    if (meldung) throw new Error(meldung)
    if (status === 401 || status === 403) throw new Error('Keine Berechtigung — bitte neu anmelden.')
    if (error.name === 'FunctionsFetchError') throw new Error('Keine Verbindung. Bitte Netz prüfen und nochmal versuchen.')
    if (error.name === 'FunctionsRelayError') {
      throw new Error('Die Bilderkennung ist auf dem Server noch nicht eingerichtet. Bitte Marvin Bescheid geben.')
    }
    throw new Error('Das Auslesen hat nicht geklappt. Bitte nochmal versuchen.')
  }
  const e = data as TabellenErgebnis | null
  if (!e || !Array.isArray(e.rows)) throw new Error('Unerwartete Antwort vom Server. Bitte nochmal versuchen.')
  return e
}

// ── Bearbeitbare Vorschau ────────────────────────────────────

export type Feld = 'platz' | 'team' | ZahlFeld | 'self'

export interface EditZeile {
  key: string
  platz: string
  team: string
  spiele: string
  siege: string
  unentschieden: string
  niederlagen: string
  tore: string
  gegentore: string
  punkte: string
  self: boolean
  /** Server-Warnungen, die die Live-Prüfung nicht kennt (z. B. Tordifferenz-Widerspruch).
   *  Verschwinden, sobald die Zeile bearbeitet wird. */
  extra: string[]
}

let keyZaehler = 0
const neuerKey = () => `z${++keyZaehler}`

const str = (n: number | null | undefined) => (n == null ? '' : String(n))
const num = (s: string): number | null => {
  const t = s.trim()
  if (t === '') return null
  const n = Number(t)
  return Number.isInteger(n) && n >= 0 ? n : null
}

export function ausErgebnis(e: TabellenErgebnis): EditZeile[] {
  return e.rows.map((r) => {
    const live = pruefeZeile(r)
    return {
      key: neuerKey(),
      platz: str(r.platz),
      team: r.team,
      spiele: str(r.spiele),
      siege: str(r.siege),
      unentschieden: str(r.unentschieden),
      niederlagen: str(r.niederlagen),
      tore: str(r.tore),
      gegentore: str(r.gegentore),
      punkte: str(r.punkte),
      self: r.self,
      extra: (r.warnungen ?? []).filter((w) => !live.includes(w)),
    }
  })
}

export function leereZeile(platz: number): EditZeile {
  return {
    key: neuerKey(),
    platz: String(platz),
    team: '',
    spiele: '',
    siege: '',
    unentschieden: '',
    niederlagen: '',
    tore: '',
    gegentore: '',
    punkte: '',
    self: false,
    extra: [],
  }
}

export function zahlenVon(z: EditZeile) {
  return {
    team: z.team.trim(),
    spiele: num(z.spiele),
    siege: num(z.siege),
    unentschieden: num(z.unentschieden),
    niederlagen: num(z.niederlagen),
    tore: num(z.tore),
    gegentore: num(z.gegentore),
    punkte: num(z.punkte),
  }
}

/** Warnungen einer Zeile — live, bei jeder Eingabe neu berechnet. */
export function zeilenWarnungen(z: EditZeile): string[] {
  const w = [...z.extra]
  if (!z.team.trim()) w.push('Mannschaftsname fehlt.')
  if (num(z.platz) == null || num(z.platz) === 0) w.push('Platz fehlt.')
  return [...w, ...pruefeZeile(zahlenVon(z))]
}

// ── Diff gegen die gespeicherte Tabelle ──────────────────────

/** Die aktuell gespeicherte Saison-Tabelle (Basis für Diff + Ersetzen). */
export function basisZeilen(rows: TabelleRow[], saison: string | null): TabelleRow[] {
  const s = saison?.trim() || null
  const passend = rows.filter((r) => (r.saison ?? null) === s)
  if (passend.length || !s) return passend
  // Altbestand ohne Saison-Angabe gilt als aktuelle Saison.
  return rows.filter((r) => !r.saison)
}

export interface ZeilenDiff {
  alt: TabelleRow | null
  geaendert: Set<Feld>
}

export function vergleiche(z: EditZeile, basis: TabelleRow[]): ZeilenDiff {
  const k = teamSchluessel(z.team)
  let alt = k ? basis.find((r) => teamSchluessel(r.team) === k) ?? null : null
  if (!alt && z.self) alt = basis.find((r) => r.self) ?? null
  const geaendert = new Set<Feld>()
  if (!alt) return { alt, geaendert }
  const n = zahlenVon(z)
  if (num(z.platz) !== alt.platz) geaendert.add('platz')
  for (const f of ZAHLEN) if ((n[f] ?? 0) !== alt[f]) geaendert.add(f)
  if (z.self !== alt.self) geaendert.add('self')
  return { alt, geaendert }
}

/** Gespeicherte Teams, die in der neuen Tabelle nicht mehr vorkommen. */
export function entfallen(zeilen: EditZeile[], basis: TabelleRow[]): TabelleRow[] {
  const neu = new Set(zeilen.map((z) => teamSchluessel(z.team)))
  const selfNeu = zeilen.some((z) => z.self)
  return basis.filter((r) => !neu.has(teamSchluessel(r.team)) && !(r.self && selfNeu))
}

// ── Speichern ────────────────────────────────────────────────

/** Blockierende Fehler vor dem Speichern (Warnungen blockieren nicht). */
export function validiere(zeilen: EditZeile[]): string | null {
  if (zeilen.length === 0) return 'Die Tabelle ist leer.'
  const ohneName = zeilen.filter((z) => !z.team.trim())
  if (ohneName.length) return 'Bitte bei jeder Zeile den Mannschaftsnamen eintragen (oder die Zeile entfernen).'
  const plaetze = zeilen.map((z) => num(z.platz))
  if (plaetze.some((p) => p == null || p < 1)) return 'Bitte bei jeder Zeile einen Platz ab 1 eintragen.'
  const doppelt = plaetze.filter((p, i) => plaetze.indexOf(p) !== i)
  if (doppelt.length) return `Platz ${[...new Set(doppelt)].join(', ')} ist mehrfach vergeben — jeder Platz darf nur einmal vorkommen.`
  const ungueltig = zeilen.find((z) => ZAHLEN.some((f) => z[f].trim() !== '' && num(z[f]) == null))
  if (ungueltig) return `${ungueltig.team}: Bitte nur ganze Zahlen ab 0 eintragen.`
  return null
}

export type TabelleSchreibInput = TabelleInput & { platz: number; team: string }

export function zuInputs(zeilen: EditZeile[], saison: string | null): TabelleSchreibInput[] {
  return zeilen
    .map((z) => {
      const n = zahlenVon(z)
      return {
        saison: saison?.trim() || null,
        platz: num(z.platz) ?? 0,
        team: n.team,
        spiele: n.spiele ?? 0,
        siege: n.siege ?? 0,
        unentschieden: n.unentschieden ?? 0,
        niederlagen: n.niederlagen ?? 0,
        tore: n.tore ?? 0,
        gegentore: n.gegentore ?? 0,
        punkte: n.punkte ?? 0,
        self: z.self,
      }
    })
    .sort((a, b) => a.platz - b.platz)
}

export interface SchreibOps {
  create: (input: TabelleSchreibInput) => Promise<unknown>
  update: (id: string, patch: TabelleInput) => Promise<unknown>
  remove: (id: string) => Promise<unknown>
}

/**
 * Ersetzt die Saison-Tabelle. Bewusst OHNE „erst alles löschen": bestehende
 * Plätze werden aktualisiert, neue angelegt, übrige Plätze zuletzt entfernt.
 * Bricht etwas ab, bleibt nie eine leere Tabelle zurück. Da je Platz genau eine
 * Zeile angefasst wird, kollidiert nichts mit unique (saison, platz).
 */
export async function ersetzeTabelle(neu: TabelleSchreibInput[], basis: TabelleRow[], ops: SchreibOps): Promise<void> {
  const nachPlatz = new Map(basis.map((r) => [r.platz, r]))
  const neuePlaetze = new Set(neu.map((r) => r.platz))
  await Promise.all(
    neu.map((r) => {
      const alt = nachPlatz.get(r.platz)
      return alt ? ops.update(alt.id, r) : ops.create(r)
    }),
  )
  await Promise.all(basis.filter((r) => !neuePlaetze.has(r.platz)).map((r) => ops.remove(r.id)))
}
