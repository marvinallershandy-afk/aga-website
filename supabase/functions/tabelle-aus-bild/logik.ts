// ─────────────────────────────────────────────────────────────
// v15-T: Reine Logik der Edge Function „tabelle-aus-bild".
//
// Absichtlich OHNE Deno-, Node- oder Browser-APIs: dieselbe Datei wird
//   - von index.ts (Deno, Supabase Edge Function) importiert,
//   - vom Admin (Vite/React) für die Live-Prüfung beim Bearbeiten importiert,
//   - von logik.test.mjs direkt mit `node` getestet (Node ≥ 23 entfernt die Typen).
// Deshalb nur „erasable" TypeScript (keine enums, keine namespaces, keine
// Parameter-Properties) und relative Imports mit Endung.
// ─────────────────────────────────────────────────────────────

/** Modell für die Bilderkennung — hier an EINER Stelle änderbar. */
export const MODELL = 'claude-sonnet-5-5'
export const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages'
export const ANTHROPIC_VERSION = '2023-06-01'
export const MAX_TOKENS = 4096

export const MAX_BILDER = 3
/** Anthropic-Grenze je Bild (dekodiert). Der Admin verkleinert vorher ohnehin auf ≤ 2000 px. */
export const MAX_BILD_BYTES = 5 * 1024 * 1024
export const ERLAUBTE_TYPEN = ['image/png', 'image/jpeg', 'image/webp'] as const
export type BildTyp = (typeof ERLAUBTE_TYPEN)[number]

export const MAX_ZEILEN = 30
export const TOOL_NAME = 'tabelle_melden'

export type Konfidenz = 'hoch' | 'mittel' | 'niedrig'

/** Zahlenfelder einer Tabellenzeile. null = auf dem Bild nicht lesbar. */
export const ZAHLEN = ['spiele', 'siege', 'unentschieden', 'niederlagen', 'tore', 'gegentore', 'punkte'] as const
export type ZahlFeld = (typeof ZAHLEN)[number]

export const FELD_LABEL: Record<ZahlFeld | 'platz' | 'team', string> = {
  platz: 'Platz',
  team: 'Mannschaft',
  spiele: 'Spiele',
  siege: 'Siege',
  unentschieden: 'Unentschieden',
  niederlagen: 'Niederlagen',
  tore: 'Tore',
  gegentore: 'Gegentore',
  punkte: 'Punkte',
}

export interface TabellenZeile {
  platz: number
  team: string
  spiele: number | null
  siege: number | null
  unentschieden: number | null
  niederlagen: number | null
  tore: number | null
  gegentore: number | null
  punkte: number | null
  /** true = eigene Mannschaft (SV Agathenburg/Dollern). */
  self: boolean
  /** Plausibilitäts-Warnungen genau dieser Zeile. */
  warnungen: string[]
}

export interface TabellenErgebnis {
  rows: TabellenZeile[]
  liga: string | null
  spieltag: number | null
  konfidenz: Konfidenz
  /** Hinweise, die nicht an einer Zeile hängen (vom Modell + Tabellen-Prüfung). */
  hinweise: string[]
  /** ALLE Warnungen (hinweise + Zeilen-Warnungen mit Teamnamen) — für Anzeige/Protokoll. */
  warnungen: string[]
}

export interface Bild {
  mediaType: BildTyp
  /** Reines Base64 ohne „data:…;base64,"-Präfix. */
  data: string
}

// ─────────────────────────────────────────────────────────────
// 1) Eingabe: Bilder prüfen
// ─────────────────────────────────────────────────────────────

/** Dekodierte Größe eines Base64-Strings in Bytes (ohne zu dekodieren). */
export function base64Bytes(b64: string): number {
  const len = b64.length
  if (len === 0) return 0
  const pad = b64.endsWith('==') ? 2 : b64.endsWith('=') ? 1 : 0
  return Math.floor((len * 3) / 4) - pad
}

export type BilderErgebnis = { ok: true; bilder: Bild[] } | { ok: false; fehler: string }

/** Prüft den Request-Body `{ bilder: [{ data, mediaType }] }`. Fehlertexte sind für Menschen. */
export function pruefeBilder(body: unknown): BilderErgebnis {
  const roh = (body as { bilder?: unknown } | null)?.bilder
  if (!Array.isArray(roh) || roh.length === 0) {
    return { ok: false, fehler: 'Es wurde kein Bild mitgeschickt.' }
  }
  if (roh.length > MAX_BILDER) {
    return { ok: false, fehler: `Bitte höchstens ${MAX_BILDER} Bilder auf einmal hochladen.` }
  }
  const bilder: Bild[] = []
  for (let i = 0; i < roh.length; i++) {
    const nr = roh.length > 1 ? ` (Bild ${i + 1})` : ''
    const b = roh[i] as { data?: unknown; mediaType?: unknown } | null
    let data = typeof b?.data === 'string' ? b.data.trim() : ''
    let mediaType = typeof b?.mediaType === 'string' ? b.mediaType.toLowerCase() : ''
    // Data-URL tolerieren: „data:image/png;base64,AAAA…"
    const m = /^data:([a-z/+.-]+);base64,(.*)$/s.exec(data)
    if (m) {
      mediaType = mediaType || m[1].toLowerCase()
      data = m[2]
    }
    if (mediaType === 'image/jpg') mediaType = 'image/jpeg'
    if (!data) return { ok: false, fehler: `Das Bild ist leer${nr}.` }
    if (!(ERLAUBTE_TYPEN as readonly string[]).includes(mediaType)) {
      return { ok: false, fehler: `Dieses Bildformat geht leider nicht${nr}. Bitte einen Screenshot als PNG, JPG oder WebP nehmen.` }
    }
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(data)) {
      return { ok: false, fehler: `Das Bild ist beschädigt angekommen${nr}. Bitte nochmal auswählen.` }
    }
    if (base64Bytes(data) > MAX_BILD_BYTES) {
      return { ok: false, fehler: `Das Bild ist zu groß${nr} (höchstens 5 MB). Bitte einen normalen Screenshot nehmen.` }
    }
    bilder.push({ mediaType: mediaType as BildTyp, data })
  }
  return { ok: true, bilder }
}

// ─────────────────────────────────────────────────────────────
// 2) Prompt + Tool-Schema (strukturierte Ausgabe per erzwungenem Tool-Use)
// ─────────────────────────────────────────────────────────────

const ZAHL_ODER_NULL = { type: ['integer', 'null'], minimum: 0 } as const

export const TOOL_SCHEMA = {
  name: TOOL_NAME,
  description:
    'Meldet die vom Screenshot abgelesene Fußball-Ligatabelle. Muss genau einmal aufgerufen werden — ' +
    'auch wenn keine Tabelle zu sehen ist (dann rows leer und eine Warnung).',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      rows: {
        type: 'array',
        description: 'Alle Mannschaften in der Reihenfolge der Tabelle, jede genau einmal.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            platz: { type: ['integer', 'null'], minimum: 1, description: 'Tabellenplatz (Spalte Pl./Platz/#). null, wenn nicht lesbar.' },
            team: { type: 'string', description: 'Vereinsname genau wie angezeigt, ohne Platzziffer und ohne Symbole.' },
            spiele: { ...ZAHL_ODER_NULL, description: 'Anzahl Spiele (Sp.).' },
            siege: { ...ZAHL_ODER_NULL, description: 'Siege (S, G, W, gewonnen).' },
            unentschieden: { ...ZAHL_ODER_NULL, description: 'Unentschieden (U, D).' },
            niederlagen: { ...ZAHL_ODER_NULL, description: 'Niederlagen (N, V, L, verloren).' },
            tore: { ...ZAHL_ODER_NULL, description: 'Erzielte Tore — die Zahl VOR dem Doppelpunkt bei „Tore 25:10".' },
            gegentore: { ...ZAHL_ODER_NULL, description: 'Gegentore — die Zahl NACH dem Doppelpunkt bei „Tore 25:10".' },
            tordifferenz: { type: ['integer', 'null'], description: 'Tordifferenz (TD, Diff., +/-), mit Vorzeichen. null, wenn nicht sichtbar.' },
            punkte: { ...ZAHL_ODER_NULL, description: 'Punkte (Pkt.).' },
          },
          required: ['platz', 'team', 'spiele', 'siege', 'unentschieden', 'niederlagen', 'tore', 'gegentore', 'tordifferenz', 'punkte'],
        },
      },
      liga: { type: ['string', 'null'], description: 'Liga/Staffel, wenn sichtbar (z. B. „Kreisliga Stade"), sonst null.' },
      spieltag: { type: ['integer', 'null'], description: 'Spieltag, wenn sichtbar, sonst null.' },
      konfidenz: {
        type: 'string',
        enum: ['hoch', 'mittel', 'niedrig'],
        description: 'Wie sicher sind alle Zahlen abgelesen? niedrig bei unscharfen, kleinen oder teilweise verdeckten Zahlen.',
      },
      warnungen: {
        type: 'array',
        items: { type: 'string' },
        description: 'Kurze deutsche Hinweise für den Trainer, z. B. „Spalte Tore ist abgeschnitten" oder „Das ist die Heimtabelle".',
      },
    },
    required: ['rows', 'liga', 'spieltag', 'konfidenz', 'warnungen'],
  },
} as const

export function baueSystemPrompt(): string {
  return [
    'Du liest Fußball-Ligatabellen aus Screenshots ab — für den Trainer eines Amateurvereins (SV Agathenburg/Dollern, Kreisliga Stade).',
    'Die Zahlen werden nach einer Kontrolle auf der Vereinswebsite veröffentlicht. Genauigkeit geht vor Vollständigkeit.',
    '',
    'Typische Quellen: fussball.de, FuPa, kicker-App — als Handy- oder Desktop-Screenshot, im hellen oder dunklen Modus, manchmal mit abgeschnittenen Spalten.',
    '',
    'Spalten-Zuordnung (Kürzel je nach Quelle):',
    '- platz: „Pl.", „Platz", „#" oder die Ziffer vor dem Vereinsnamen.',
    '- team: Vereinsname vollständig wie angezeigt (inkl. „II", „III", „U23", „SG …", „/"). Ohne Platzziffer, Wappen, Pfeile (Auf-/Abstiegstendenz) oder Markierungen wie „(A)".',
    '- spiele: „Sp.", „Spiele", „SP".',
    '- siege: „S", „G" (gewonnen), „W". — unentschieden: „U", „D". — niederlagen: „N", „V" (verloren), „L".',
    '- tore/gegentore: Spalte „Tore" im Format „25:10" → tore = 25, gegentore = 10. Manche Apps zeigen „T" und „GT" getrennt.',
    '- tordifferenz: „TD", „Diff.", „+/-", „Tordiff." — mit Vorzeichen (−3 → -3).',
    '- punkte: „Pkt.", „Punkte", „P".',
    '',
    'Regeln:',
    '1. Jede Mannschaft genau einmal, in der Reihenfolge der Tabelle. Bei mehreren Bildern sind das Ausschnitte DERSELBEN Tabelle: überlappende Zeilen nur einmal melden.',
    '2. Nur ablesen, nichts ausrechnen oder ergänzen. Ist eine Spalte abgeschnitten, verdeckt oder unlesbar: null eintragen und in „warnungen" kurz sagen, welche Spalte fehlt.',
    '3. Ziffern sorgfältig unterscheiden (3/8, 1/7, 5/6, 6/8/0), besonders bei kleiner Schrift. Unsichere Zahlen → konfidenz „mittel" oder „niedrig" und eine Warnung mit dem Vereinsnamen.',
    '4. Nur die Gesamttabelle zählt. Ist erkennbar eine Teiltabelle ausgewählt (Heim, Auswärts, Hinrunde, Rückrunde, Form), trotzdem ablesen, aber in „warnungen" deutlich darauf hinweisen.',
    '5. Alles außerhalb der Tabelle ignorieren: Werbung, Navigation, Statusleiste, Spielpläne, Torschützenlisten.',
    '6. liga und spieltag nur, wenn sie auf dem Bild stehen — sonst null.',
    '7. Ist keine Ligatabelle zu erkennen: rows leer lassen und in „warnungen" kurz beschreiben, was stattdessen zu sehen ist.',
    `8. Antworte ausschließlich über das Werkzeug „${TOOL_NAME}". Warnungen auf Deutsch, kurz und ohne Fachjargon.`,
  ].join('\n')
}

export function baueNutzerText(anzahlBilder: number): string {
  return anzahlBilder > 1
    ? `Hier sind ${anzahlBilder} Screenshots, die zusammen eine Ligatabelle zeigen (z. B. oberer und unterer Teil). Lies die komplette Tabelle ab.`
    : 'Hier ist ein Screenshot einer Ligatabelle. Lies sie komplett ab.'
}

/** Body für POST https://api.anthropic.com/v1/messages */
export function baueAnfrage(bilder: Bild[], modell: string = MODELL) {
  return {
    model: modell,
    max_tokens: MAX_TOKENS,
    system: baueSystemPrompt(),
    tools: [TOOL_SCHEMA],
    tool_choice: { type: 'tool', name: TOOL_NAME },
    messages: [
      {
        role: 'user',
        content: [
          ...bilder.map((b) => ({
            type: 'image',
            source: { type: 'base64', media_type: b.mediaType, data: b.data },
          })),
          { type: 'text', text: baueNutzerText(bilder.length) },
        ],
      },
    ],
  }
}

// ─────────────────────────────────────────────────────────────
// 3) Antwort von Anthropic auswerten
// ─────────────────────────────────────────────────────────────

export interface RohZeile {
  platz?: unknown
  team?: unknown
  spiele?: unknown
  siege?: unknown
  unentschieden?: unknown
  niederlagen?: unknown
  tore?: unknown
  gegentore?: unknown
  tordifferenz?: unknown
  punkte?: unknown
}
export interface RohErgebnis {
  rows?: unknown
  liga?: unknown
  spieltag?: unknown
  konfidenz?: unknown
  warnungen?: unknown
}

export class AuslesenFehler extends Error {
  status: number
  constructor(meldung: string, status = 502) {
    super(meldung)
    this.name = 'AuslesenFehler'
    this.status = status
  }
}

/** Holt den Tool-Input aus der Messages-API-Antwort oder wirft einen verständlichen Fehler. */
export function leseToolAntwort(api: unknown): RohErgebnis {
  const a = (api ?? {}) as { content?: unknown; stop_reason?: unknown }
  if (a.stop_reason === 'refusal') {
    throw new AuslesenFehler('Das Bild konnte nicht ausgewertet werden. Bitte einen Screenshot nur der Tabelle nehmen.', 422)
  }
  const content = Array.isArray(a.content) ? a.content : []
  const block = content.find(
    (c) => (c as { type?: unknown }).type === 'tool_use' && (c as { name?: unknown }).name === TOOL_NAME,
  ) as { input?: unknown } | undefined
  if (!block || typeof block.input !== 'object' || block.input === null) {
    if (a.stop_reason === 'max_tokens') {
      throw new AuslesenFehler('Die Tabelle war zu lang für einen Durchgang. Bitte in zwei Screenshots aufteilen.', 422)
    }
    throw new AuslesenFehler('Claude hat keine Tabelle zurückgegeben. Bitte nochmal versuchen.')
  }
  return block.input as RohErgebnis
}

/** Übersetzt HTTP-Fehler der Anthropic-API in Klartext. */
export function fehlerAusApi(status: number, body: unknown): AuslesenFehler {
  const typ = (body as { error?: { type?: unknown } } | null)?.error?.type
  const msg = String((body as { error?: { message?: unknown } } | null)?.error?.message ?? '')
  if (status === 401 || typ === 'authentication_error') {
    return new AuslesenFehler('Der hinterlegte API-Key wird von Anthropic nicht akzeptiert. Bitte Marvin Bescheid geben.', 500)
  }
  if (status === 403 || typ === 'permission_error') {
    return new AuslesenFehler('Der API-Key darf dieses Modell nicht nutzen. Bitte Marvin Bescheid geben.', 500)
  }
  if (status === 404 || typ === 'not_found_error') {
    return new AuslesenFehler('Das eingestellte Claude-Modell gibt es nicht (mehr). Bitte Marvin Bescheid geben.', 500)
  }
  if (status === 413 || typ === 'request_too_large') {
    return new AuslesenFehler('Die Bilder sind zusammen zu groß. Bitte weniger oder kleinere Screenshots nehmen.', 413)
  }
  if (status === 429 || typ === 'rate_limit_error') {
    return new AuslesenFehler('Gerade zu viele Anfragen. Bitte eine Minute warten und nochmal versuchen.', 429)
  }
  if (status === 529 || typ === 'overloaded_error') {
    return new AuslesenFehler('Claude ist gerade überlastet. Bitte gleich nochmal versuchen.', 503)
  }
  if (status === 400 && /credit|billing|balance/i.test(msg)) {
    return new AuslesenFehler('Das Anthropic-Guthaben ist aufgebraucht. Bitte Marvin Bescheid geben.', 500)
  }
  if (status === 400 && /image/i.test(msg)) {
    return new AuslesenFehler('Das Bild konnte nicht gelesen werden. Bitte einen anderen Screenshot versuchen.', 422)
  }
  return new AuslesenFehler(`Die Bilderkennung ist fehlgeschlagen (Fehler ${status}). Bitte nochmal versuchen.`, 502)
}

// ─────────────────────────────────────────────────────────────
// 4) Säubern, eigene Mannschaft erkennen, Plausibilität prüfen
// ─────────────────────────────────────────────────────────────

/** Ganzzahl ≥ 0 (oder null). Akzeptiert auch Strings wie „12". */
export function zahl(v: unknown, { negativ = false }: { negativ?: boolean } = {}): number | null {
  let n: number
  if (typeof v === 'number') n = v
  else if (typeof v === 'string' && /^\s*[+\-−–]?\d+\s*$/.test(v)) n = Number(v.replace(/[−–]/, '-').trim())
  else return null
  if (!Number.isFinite(n) || !Number.isInteger(n)) return null
  if (!negativ && n < 0) return null
  if (Math.abs(n) > 999) return null
  return n
}

export function saeubereTeam(v: unknown): string {
  if (typeof v !== 'string') return ''
  return v
    .replace(/\s+/g, ' ')
    .replace(/^\s*\d{1,2}\s*[.)]\s+/, '') // „3. TuS …" → „TuS …"
    .replace(/\s*[▲▼↑↓↗↘•]+\s*/g, ' ')
    .trim()
    .slice(0, 80)
}

/** Vergleichsschlüssel für Teamnamen: klein, ohne Umlaute/Sonderzeichen. */
export function teamSchluessel(team: string): string {
  return team
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

/** Reserve-/Jugendteam („II", „2", „U23", „Alte Herren")? */
function istZweiteMannschaft(schluessel: string): boolean {
  return /\b(ii|iii|iv|2|3|u\d{2}|ah|alte herren|reserve)\b/.test(schluessel)
}

/**
 * Erkennt Schreibweisen von „SV Agathenburg/Dollern":
 * „SV Agathenburg-Dollern", „SV Agathenburg/Dollern", „SV Agathenb./Dollern",
 * „SV Aga.-Dollern", „SG Agathenburg/Dollern", „Agathenburg/D.", „SVA".
 */
export function istEigeneMannschaft(team: string): boolean {
  const s = teamSchluessel(team)
  if (!s) return false
  if (/\bagathenb/.test(s)) return true // agathenburg, agathenb.
  if (/\baga\b/.test(s) && /\bdollern\b/.test(s)) return true
  if (/^(sv )?sva\b/.test(s) || s === 'sv a d' || s === 'sva d') return true
  return false
}

/** Plausibilität EINER Zeile — wird auch im Admin live beim Bearbeiten genutzt. */
export function pruefeZeile(z: Pick<TabellenZeile, ZahlFeld | 'team'>): string[] {
  const w: string[] = []
  const fehlend = ZAHLEN.filter((f) => z[f] == null)
  if (fehlend.length) {
    w.push(`${fehlend.map((f) => FELD_LABEL[f]).join(', ')} nicht lesbar — bitte ergänzen.`)
  }
  const { spiele: sp, siege: s, unentschieden: u, niederlagen: n, punkte: p } = z
  if (s != null && u != null && n != null && sp != null && s + u + n !== sp) {
    w.push(`Siege + Unentschieden + Niederlagen = ${s + u + n}, aber ${sp} Spiele.`)
  }
  if (s != null && u != null && p != null && 3 * s + u !== p) {
    w.push(`Punkte ${p} passen nicht zu 3 × ${s} Siege + ${u} Unentschieden = ${3 * s + u} (Punktabzug oder Lesefehler?).`)
  }
  return w
}

/** Leere Einzelwerte aus den anderen Spalten ableiten (nur eindeutige Fälle). */
function ergaenze(z: TabellenZeile, hinweise: string[]): void {
  const fehlt = (['spiele', 'siege', 'unentschieden', 'niederlagen'] as const).filter((f) => z[f] == null)
  if (fehlt.length === 1) {
    const f = fehlt[0]
    const { spiele: sp, siege: s, unentschieden: u, niederlagen: n } = z
    let wert: number | null = null
    if (f === 'spiele') wert = s! + u! + n!
    else if (f === 'siege') wert = sp! - u! - n!
    else if (f === 'unentschieden') wert = sp! - s! - n!
    else wert = sp! - s! - u!
    if (wert != null && wert >= 0) {
      z[f] = wert
      hinweise.push(`${z.team}: ${FELD_LABEL[f]} war nicht lesbar und wurde aus den anderen Spalten berechnet (${wert}).`)
    }
  }
  if (z.punkte == null && z.siege != null && z.unentschieden != null) {
    z.punkte = 3 * z.siege + z.unentschieden
    hinweise.push(`${z.team}: Punkte waren nicht lesbar und wurden berechnet (${z.punkte}).`)
  }
}

function anzahlWerte(r: TabellenZeile): number {
  return ZAHLEN.filter((f) => r[f] != null).length
}

/** Aus der Rohantwort des Modells die geprüfte Antwort der Function bauen. */
export function verarbeite(roh: RohErgebnis): TabellenErgebnis {
  const hinweise: string[] = []
  const modellWarnungen = Array.isArray(roh.warnungen)
    ? roh.warnungen.filter((x): x is string => typeof x === 'string' && x.trim() !== '').map((x) => x.trim().slice(0, 300))
    : []
  hinweise.push(...modellWarnungen.slice(0, 10))

  const konfidenz: Konfidenz =
    roh.konfidenz === 'hoch' || roh.konfidenz === 'mittel' || roh.konfidenz === 'niedrig' ? roh.konfidenz : 'mittel'
  const liga = typeof roh.liga === 'string' && roh.liga.trim() ? roh.liga.trim().slice(0, 80) : null
  const spieltagRoh = zahl(roh.spieltag)
  const spieltag = spieltagRoh && spieltagRoh > 0 && spieltagRoh < 60 ? spieltagRoh : null

  // ── Zeilen säubern ──
  const rohZeilen = (Array.isArray(roh.rows) ? roh.rows : []) as RohZeile[]
  let rows: (TabellenZeile & { _tordiff: number | null })[] = []
  for (const r of rohZeilen) {
    const team = saeubereTeam(r?.team)
    if (!team) continue
    const platz = zahl(r.platz)
    rows.push({
      platz: platz && platz > 0 ? platz : 0,
      team,
      spiele: zahl(r.spiele),
      siege: zahl(r.siege),
      unentschieden: zahl(r.unentschieden),
      niederlagen: zahl(r.niederlagen),
      tore: zahl(r.tore),
      gegentore: zahl(r.gegentore),
      punkte: zahl(r.punkte),
      _tordiff: zahl(r.tordifferenz, { negativ: true }),
      self: false,
      warnungen: [],
    })
  }

  // ── Überlappung mehrerer Screenshots: gleiche Mannschaft nur einmal ──
  const gesehen = new Map<string, number>()
  const ohneDoppelte: typeof rows = []
  for (const r of rows) {
    const k = teamSchluessel(r.team)
    const idx = gesehen.get(k)
    if (idx == null) {
      gesehen.set(k, ohneDoppelte.length)
      ohneDoppelte.push(r)
      continue
    }
    const alt = ohneDoppelte[idx]
    if (alt.platz && r.platz && alt.platz !== r.platz) {
      hinweise.push(`${r.team} stand zweimal in der Tabelle (Platz ${alt.platz} und ${r.platz}) — bitte prüfen.`)
    }
    if (anzahlWerte(r) > anzahlWerte(alt)) ohneDoppelte[idx] = { ...r, platz: alt.platz || r.platz }
  }
  rows = ohneDoppelte

  if (rows.length > MAX_ZEILEN) {
    hinweise.push(`Mehr als ${MAX_ZEILEN} Zeilen erkannt — nur die ersten ${MAX_ZEILEN} übernommen.`)
    rows = rows.slice(0, MAX_ZEILEN)
  }

  // ── Plätze: fehlende auffüllen, lückenlos prüfen ──
  for (let i = 0; i < rows.length; i++) {
    if (!rows[i].platz) {
      const vorher = i > 0 ? rows[i - 1].platz : 0
      rows[i].platz = vorher + 1
      rows[i].warnungen.push('Platz war nicht lesbar und wurde aus der Reihenfolge ergänzt.')
    }
  }
  rows.sort((a, b) => a.platz - b.platz)
  if (rows.length) {
    if (rows[0].platz !== 1) {
      hinweise.push(`Die Tabelle beginnt erst bei Platz ${rows[0].platz} — fehlt oben etwas? Ggf. einen zweiten Screenshot dazunehmen.`)
    }
    const plaetze = rows.map((r) => r.platz)
    const doppelt = [...new Set(plaetze.filter((p, i) => plaetze.indexOf(p) !== i))]
    if (doppelt.length) hinweise.push(`Platz ${doppelt.join(', ')} kommt mehrfach vor — bitte korrigieren.`)
    const fehlend: number[] = []
    for (let p = rows[0].platz; p <= rows[rows.length - 1].platz; p++) if (!plaetze.includes(p)) fehlend.push(p)
    if (fehlend.length) {
      hinweise.push(`Platz ${fehlend.slice(0, 8).join(', ')} fehlt — evtl. nicht auf dem Bild. Ggf. einen zweiten Screenshot dazunehmen.`)
    }
  }

  // ── Ableitbare Lücken füllen, Zeilen prüfen ──
  for (const r of rows) {
    ergaenze(r, hinweise)
    if (r.tore != null && r.gegentore != null && r._tordiff != null && r.tore - r.gegentore !== r._tordiff) {
      r.warnungen.push(`Tore ${r.tore}:${r.gegentore} passen nicht zur angezeigten Tordifferenz ${r._tordiff > 0 ? '+' : ''}${r._tordiff}.`)
    }
    r.warnungen.push(...pruefeZeile(r))
  }

  // ── Eigene Mannschaft ──
  const treffer = rows.filter((r) => istEigeneMannschaft(r.team))
  if (treffer.length) {
    const erste = treffer.find((r) => !istZweiteMannschaft(teamSchluessel(r.team))) ?? treffer[0]
    erste.self = true
    if (treffer.length > 1) {
      hinweise.push(`Mehrere Agathenburg-Mannschaften erkannt — „${erste.team}" ist als eigene markiert. Bitte prüfen.`)
    }
  } else if (rows.length) {
    hinweise.push('Die eigene Mannschaft (SV Agathenburg/Dollern) wurde nicht gefunden — bitte in der Vorschau markieren.')
  }

  if (konfidenz === 'niedrig' && rows.length) {
    hinweise.push('Das Bild war schwer zu lesen — bitte alle Zahlen besonders genau prüfen.')
  }

  const fertig: TabellenZeile[] = rows.map(({ _tordiff: _, ...r }) => r)
  const warnungen = [
    ...hinweise,
    ...fertig.flatMap((r) => r.warnungen.map((w) => `Platz ${r.platz} · ${r.team}: ${w}`)),
  ]
  return { rows: fertig, liga, spieltag, konfidenz, hinweise, warnungen }
}
