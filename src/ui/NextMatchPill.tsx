import { NEXT_MATCH, nextKickoff } from '../data/content'
import { jumpToSection } from './Brandbar'

// ─────────────────────────────────────────────────────────────
// v14: „Wann ist das nächste Spiel?" ist der häufigste Grund, die Seite
// zu öffnen — die Antwort steht jetzt direkt im Hero statt erst an
// Station 5. Rendert NUR mit echtem Termin (Admin → Spiele → Build);
// ohne Pflege ist der Pill einfach nicht da.
// ─────────────────────────────────────────────────────────────

export function NextMatchPill() {
  const kickoff = nextKickoff()
  if (NEXT_MATCH.isPlaceholder || !kickoff) return null
  if (kickoff.getTime() < Date.now() - 2 * 3600 * 1000) return null // Spiel vorbei
  const when = kickoff.toLocaleString('de-DE', {
    weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
  })
  return (
    <button type="button" className="next-pill" onClick={() => jumpToSection('tabelle')}>
      <span className="next-pill__dot" aria-hidden="true" />
      <span className="next-pill__label">Nächstes Spiel</span>
      <b>{when} Uhr</b>
      <span className="next-pill__vs">
        {NEXT_MATCH.home ? `vs ${NEXT_MATCH.opponent} · Heim` : `bei ${NEXT_MATCH.opponent} · Auswärts`}
      </span>
    </button>
  )
}
