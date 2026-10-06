import { useEffect, useState } from 'react'
import { ArrowRight, Check, Sparkles, Target } from 'lucide-react'
import { nextKickoff } from '../data/content'
import { TIPP_STAND_KEY, tippStandLesen, type TippStand } from '../tippen/tippStand'

// ─────────────────────────────────────────────────────────────
// v21-UX (Befund 1): sichtbarer Einstieg in die Tipp-Liga auf der Startseite.
// Gleicher Stil wie der Album-Teaser (.alb-t), gestapelt darüber. Lädt KEIN
// Supabase-Bundle: Countdown aus den Build-Daten (nextKickoff), Tipp-Zustand
// aus dem Speicher (src/tippen/tippStand.ts, von /tippen geschrieben).
//   · neuer/offener Fan  → „Jetzt tippen · noch X Std“
//   · schon getippt      → „Tipp abgegeben ✓“
//   · frische Auflösung  → „+14 Punkte“
// ─────────────────────────────────────────────────────────────

const TIPP_LINK = '/tippen'

function restText(ms: number): string | null {
  if (ms <= 0) return null
  const std = Math.floor(ms / 3_600_000)
  if (std >= 48) return `noch ${Math.floor(std / 24)} Tage`
  if (std >= 1) return `noch ${std} Std`
  return `noch ${Math.max(1, Math.round(ms / 60_000))} Min`
}

function sameDay(a: number, b: number): boolean {
  const f = (t: number) => new Date(t).toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })
  return f(a) === f(b)
}

interface Darstellung {
  kicker: string
  titel: string
  zeile: string
  ton: 'rot' | 'gruen' | 'gold'
  icon: typeof Target
}

function darstellung(stand: TippStand | null, now: number): Darstellung {
  const k = nextKickoff()
  // frische Auflösung (≤ 4 Tage) und nichts Offenes mehr → Punkte feiern
  if (stand?.letztePunkte != null && stand.letzteAnstoss && now - new Date(stand.letzteAnstoss).getTime() < 4 * 86_400_000 && (!stand.offenAnstoss || stand.getippt)) {
    return { kicker: 'Tipp-Liga · Auflösung', titel: `+${stand.letztePunkte} Punkte`, zeile: 'Sieh dir deine Auflösung an', ton: 'gold', icon: Sparkles }
  }
  // offenes Spiel schon getippt (Abgleich über den Anpfiff aus den Build-Daten)
  const getipptFuerNaechstes = stand?.getippt && (!k || !stand.offenAnstoss || sameDay(new Date(stand.offenAnstoss).getTime(), k.getTime()))
  if (getipptFuerNaechstes) {
    return { kicker: 'Tipp-Liga', titel: 'Tipp abgegeben ✓', zeile: 'Änderbar bis Anpfiff', ton: 'gruen', icon: Check }
  }
  // Standard: jetzt tippen (mit Countdown, wenn ein Anstoß bekannt ist)
  const rest = k ? restText(k.getTime() - now) : null
  return {
    kicker: 'Tipp-Liga · kostenlos',
    titel: 'Jetzt tippen',
    zeile: rest ? `${rest} · Tipp-Pack` : 'Kostenlos · Tipp-Pack',
    ton: 'rot',
    icon: Target,
  }
}

export function TippTeaser() {
  const [stand, setStand] = useState<TippStand | null>(() => (typeof window !== 'undefined' ? tippStandLesen() : null))
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    // Countdown einmal pro Minute auffrischen (kein Dauer-Timer im ersten Bild)
    const t = window.setInterval(() => setNow(Date.now()), 60_000)
    const f = (e: StorageEvent) => {
      if (e.key === TIPP_STAND_KEY) setStand(tippStandLesen())
    }
    window.addEventListener('storage', f)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('storage', f)
    }
  }, [])

  const d = darstellung(stand, now)
  const Icon = d.icon
  return (
    <a className={`alb-t alb-t--karte tip-t tip-t--${d.ton}`} href={TIPP_LINK} aria-label={`Tipp-Liga öffnen — ${d.titel}`}>
      <span className="tip-t__icon" aria-hidden="true">
        <Icon size={22} strokeWidth={1.75} />
      </span>
      <span className="alb-t__text">
        <span className="alb-t__kicker">{d.kicker}</span>
        <b>{d.titel}</b>
        <small>{d.zeile}</small>
      </span>
      <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
    </a>
  )
}
