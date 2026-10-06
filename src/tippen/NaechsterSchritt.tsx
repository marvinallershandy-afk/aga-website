import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, CheckCircle2, Clock, HelpCircle, Radio, Snowflake, Sparkles, Trophy } from 'lucide-react'
import type { Lage } from './api'
import { aufloesungGesehen, rest, uhrzeit, datumKurz } from './model'
import { T_MITTEL } from './bewegung'

// ─────────────────────────────────────────────────────────────
// v21-T: „Nächster Schritt“ — eine Zeile, die IMMER sagt, was gerade
// ansteht, was man tun muss und was es dafür gibt. Tippen springt dorthin.
// ─────────────────────────────────────────────────────────────

export type Ziel = 'tippschein' | 'live' | 'aufloesung' | 'rangliste' | 'anmelden' | 'einfuehrung'

interface Schritt {
  key: string
  ton: 'rot' | 'gruen' | 'gold' | 'ruhig' | 'live'
  icon: typeof Clock
  text: string
  stark?: string
  ziel?: Ziel
  knopf?: string
}

function dauer(ms: number): string {
  const r = rest(new Date(Date.now() + ms).toISOString(), Date.now())
  if (r.tage >= 1) return `${r.tage} ${r.tage === 1 ? 'Tag' : 'Tagen'} ${r.std} Std`
  if (r.std >= 1) return `${r.std} Std ${r.min} Min`
  return `${r.min} Min`
}

function schrittFuer(lage: Lage, now: number, angemeldet: boolean): Schritt | null {
  const { offen, gesperrt, gewertet } = lage
  // 1. frische Auflösung, noch nicht angesehen
  if (gewertet?.meinePunkte && now - new Date(gewertet.anstoss).getTime() < 4 * 86400_000 && !aufloesungGesehen(`${gewertet.id}:${gewertet.meinePunkte.gesamt}`) && !gesperrt) {
    return { key: `aufl-${gewertet.id}-${gewertet.motm ?? ''}`, ton: 'gold', icon: Sparkles, stark: `Neue Punkte! +${gewertet.meinePunkte.gesamt}`, text: 'sieh dir die Auflösung an', ziel: 'aufloesung', knopf: 'Ansehen' }
  }
  // 2. Spiel läuft
  if (gesperrt && (gesperrt.status === 'live' || gesperrt.status === 'halbzeit')) {
    const p = gesperrt.live?.ich?.gesamt
    const platz = gesperrt.live?.rangliste?.find((e) => e.ich)?.platz
    return {
      key: 'live',
      ton: 'live',
      icon: Radio,
      stark: `Live ${gesperrt.toreSva ?? 0}:${gesperrt.toreGegner ?? 0}${gesperrt.live ? ` · ${gesperrt.live.minute}′` : ''}`,
      text: gesperrt.meinTipp ? (p != null ? `du stehst bei ${p} Punkten${platz ? ` · Platz ${platz}` : ''}` : 'deine Punkte rechnen live mit') : 'diesmal ohne Tipp — nächster Spieltag kommt',
      ziel: 'live',
      knopf: 'Live',
    }
  }
  if (gesperrt && gesperrt.status === 'beendet') {
    return {
      key: 'nach',
      ton: 'ruhig',
      icon: Clock,
      stark: 'Abpfiff · Wertung folgt',
      text: lage.naechstes ? `danach öffnet der nächste Spieltag (${lage.naechstes.heim ? 'gegen' : 'bei'} ${lage.naechstes.gegner})` : 'die Auflösung kommt mit dem Spielbericht, meist am selben Abend',
      ziel: 'live',
    }
  }
  // 3. Tipp offen
  if (offen?.offen) {
    const ms = new Date(offen.schluss).getTime() - now
    if (!angemeldet && !offen.meinTipp) {
      return { key: 'gast', ton: 'rot', icon: Clock, stark: `Noch ${dauer(ms)}`, text: 'kostenlos tippen — jeder Spieltag bringt +1 Karte fürs Album', ziel: 'tippschein', knopf: 'Tippen' }
    }
    if (!offen.meinTipp) {
      return { key: 'offen', ton: 'rot', icon: Clock, stark: `Noch ${dauer(ms)}`, text: 'tippe jetzt für +1 Karte fürs Album', ziel: 'tippschein', knopf: 'Tippen' }
    }
    const elfFehlt = !offen.meineElf
    return {
      key: 'getippt',
      ton: 'gruen',
      icon: CheckCircle2,
      stark: 'Tipp abgegeben',
      text: elfFehlt
        ? 'stell noch deine Elf auf — sonst zählt nur das Ergebnis'
        : `Anpfiff ${datumKurz(offen.anstoss)} ${uhrzeit(offen.anstoss)} · Auflösung am Abend · änderbar bis Anpfiff`,
      ziel: 'tippschein',
      knopf: elfFehlt ? 'Elf' : undefined,
    }
  }
  if (lage.einstellungen.winterpause.aktiv) {
    return { key: 'winter', ton: 'ruhig', icon: Snowflake, stark: 'Winterpause', text: 'Saisonstand und Ligen bleiben offen', ziel: 'rangliste', knopf: 'Tabelle' }
  }
  if (gewertet) {
    return { key: 'warten', ton: 'ruhig', icon: Trophy, stark: 'Nächster Spieltag folgt', text: 'bis dahin: Rangliste checken, Liga gründen', ziel: 'rangliste', knopf: 'Tabelle' }
  }
  return null
}

export function NaechsterSchritt({ lage, now, angemeldet, onZiel }: { lage: Lage; now: number; angemeldet: boolean; onZiel: (z: Ziel) => void }) {
  const s = schrittFuer(lage, now, angemeldet)
  return (
    <div className="tp-schritt-platz" aria-live="polite">
      <AnimatePresence initial={false} mode="popLayout">
        {s && (
          <motion.button
            type="button"
            key={s.key}
            className={`tp-schritt is-${s.ton}`}
            onClick={() => s.ziel && onZiel(s.ziel)}
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={T_MITTEL}
          >
            <s.icon className="tp-schritt__icon" size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="tp-schritt__text">
              {s.stark && <b>{s.stark}</b>}
              <span>{s.text}</span>
            </span>
            {s.knopf ? (
              <span className="tp-schritt__knopf">
                {s.knopf} <ArrowRight size={14} strokeWidth={2} aria-hidden="true" />
              </span>
            ) : (
              <ArrowRight className="tp-schritt__pfeil" size={16} strokeWidth={1.75} aria-hidden="true" />
            )}
          </motion.button>
        )}
      </AnimatePresence>
      <button type="button" className="tp-schritt__hilfe" onClick={() => onZiel('einfuehrung')} aria-label="So funktioniert’s">
        <HelpCircle size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>
  )
}
