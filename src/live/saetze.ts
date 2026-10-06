// ─────────────────────────────────────────────────────────────
// v23-U: Satzvorlagen für den Liveticker. Reine Funktion — baut aus einem
// LiveEvent (web_live v2) die angezeigten Textbausteine. Für Bot-Ereignisse
// (source='fupa', textSource='vorlage') schreibt der Server KEINEN Satz; den
// baut diese Datei. Reportertexte (textSource='reporter') werden 1:1 gezeigt,
// Pult-Zeilen wie bisher. Gemeinsam getestet über scripts/live-audit.mjs.
// ─────────────────────────────────────────────────────────────
import type { LiveEvent, TickerTyp } from './model'
import { TYP_LABEL, minuteLabel } from './model'

export interface SatzKontext {
  /** Gegner-Name (für Gegentor/Gegner-Karten). */
  opponent: string
  /** Spielstand in Paarungsreihenfolge, z. B. „2:1“ (nur Tor-Zeilen). */
  stand?: string | null
  /** Kader-Name zu einem Slug (oder null). */
  spielerName: (slug?: string | null) => string | null
}

export interface ZeileTexte {
  /** Für Tor-Zeilen: Überschrift („TOR für den SVA!“ / „Tor für Gegner“). */
  torKicker?: string
  /** Für Tor-Zeilen: großer Name (oder „(Torschütze folgt)“). */
  torName?: string | null
  /** Titel bei Karten/Wechsel/Pfiff/Kommentar. */
  titel?: string
  /** Unterzeile (Vorlage, Spielername). */
  sub?: string | null
  /** Zusatz-Chip (Kopfball/Elfmeter/Freistoß/Eigentor). */
  zusatz?: string | null
  /** Freitext (Pult-/Reportertext), klein darunter. */
  text?: string | null
  /** true = Gegner-Ereignis (dezent/grau darstellen). */
  gegner?: boolean
}

const PFIFFE: TickerTyp[] = ['anpfiff', 'halbzeit', 'wiederanpfiff', 'abpfiff']

/** Name aus Kader-Slug, sonst FuPa-Klartextname. */
function torschuetze(e: LiveEvent, ctx: SatzKontext): string | null {
  return ctx.spielerName(e.player) ?? e.name ?? null
}
function vorlageGeber(e: LiveEvent, ctx: SatzKontext): string | null {
  return ctx.spielerName(e.player2) ?? e.name2 ?? null
}

/** Freitext nur zeigen, wenn er Inhalt trägt (Reporter, Pult, Kommentar). */
function freitext(e: LiveEvent): string | null {
  const t = (e.text ?? '').trim()
  if (!t) return null
  // Bei Vorlage-Fakten (Tor/Karte/Wechsel) baut das UI den Satz — Freitext nur
  // bei Kommentaren bzw. Reporter-/Pult-Quelle.
  if (e.textSource === 'vorlage' && e.type !== 'kommentar') return null
  return t
}

/** Baut die Textbausteine einer Ticker-Zeile (reine Funktion). */
export function zeileTexte(e: LiveEvent, ctx: SatzKontext): ZeileTexte {
  const gegner = e.team === 'gegner'
  const text = freitext(e)

  if (e.type === 'tor') {
    return {
      torKicker: 'TOR für den SVA!',
      torName: e.placeholder ? '(Torschütze folgt)' : (torschuetze(e, ctx) ?? 'Tor SVA'),
      sub: !e.placeholder && vorlageGeber(e, ctx) ? `Vorlage: ${vorlageGeber(e, ctx)}` : null,
      zusatz: e.zusatz ?? null,
      text,
    }
  }
  if (e.type === 'gegentor') {
    const sch = e.placeholder ? null : torschuetze(e, ctx)
    return {
      titel: `Tor für ${ctx.opponent}`,
      sub: e.placeholder ? '(Torschütze folgt)' : sch,
      zusatz: e.zusatz ?? null,
      text,
      gegner: true,
    }
  }
  if (e.type === 'gelb' || e.type === 'gelbrot' || e.type === 'rot') {
    const sp = torschuetze(e, ctx)
    return {
      titel: TYP_LABEL[e.type],
      sub: [sp, gegner ? ctx.opponent : null].filter(Boolean).join(' · ') || (gegner ? ctx.opponent : null),
      text,
      gegner,
    }
  }
  if (e.type === 'wechsel') {
    const rein = torschuetze(e, ctx)
    const raus = vorlageGeber(e, ctx)
    return {
      titel: 'Wechsel SVA',
      sub: [rein && `↑ ${rein}`, raus && `↓ ${raus}`].filter(Boolean).join('   ') || null,
      text,
    }
  }
  if (e.type === 'wechsel_gegner') {
    const rein = e.name ?? null
    const raus = e.name2 ?? null
    return {
      titel: 'Wechsel',
      sub: `${ctx.opponent}: ${[rein, raus].filter(Boolean).join(' für ')}`.trim() || ctx.opponent,
      text,
      gegner: true,
    }
  }
  if (e.type === 'elfmeter' || e.type === 'elfmeter_verschossen') {
    const sp = torschuetze(e, ctx)
    const titel = e.type === 'elfmeter_verschossen' ? 'Elfmeter verschossen' : 'Elfmeter'
    return { titel, sub: [sp, gegner ? ctx.opponent : null].filter(Boolean).join(' · ') || null, text, gegner }
  }
  if (PFIFFE.includes(e.type)) {
    // Pfiffe rendern eigen; hier nur Titel + Minute-freier Freitext.
    return { titel: TYP_LABEL[e.type], text }
  }
  // kommentar / Rest
  return { titel: e.type === 'kommentar' ? '' : TYP_LABEL[e.type], text }
}

/** Fuß-Hinweis zur Quelle (für den Ticker-Abschluss). */
export function quelleFuss(source: 'fupa' | 'pult' | undefined, fupaUrl?: string): { text: string; url?: string } {
  if (source === 'fupa') return { text: 'Live-Daten: FuPa · ohne Gewähr', url: fupaUrl }
  return { text: 'Eigener Liveticker des Vereins · ohne Gewähr' }
}

/** Credit-Zeile für Reportertexte („Text: Niko · via FuPa“). */
export function reporterCredit(e: LiveEvent, autorVorname?: string): string | null {
  if (e.source !== 'fupa' || e.textSource !== 'reporter') return null
  const vn = (autorVorname ?? '').trim().split(/\s+/)[0]
  return vn ? `Text: ${vn} · via FuPa` : 'Text via FuPa'
}

/** „45+2'“ → für Statuszeilen. */
export { minuteLabel }
