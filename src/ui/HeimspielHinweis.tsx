import { ArrowRight } from 'lucide-react'
import { CONTACT } from '../data/content'

// ─────────────────────────────────────────────────────────────
// v19-K (Audit B §2.1.2): Ruhiger Heimspiel-Hinweis auf der Karten-Totale,
// sichtbar ab 72 h vor einem Heimspiel (Stil wie AlbumTeaser — eine Fakt-Zeile
// + CTA, kein Popup, keine Animation). NICHTS erfinden: nur Tag/Uhrzeit (aus
// dem nächsten Spiel) und der Spielort. CTA → /live (Countdown, Anfahrt,
// Kalender). Das Gating (Heimspiel, Zeitfenster) macht die Karte, hier wird
// nur dargestellt.
// ─────────────────────────────────────────────────────────────

const TZ = 'Europe/Berlin'

function wannLang(d: Date): string {
  const tag = d.toLocaleDateString('de-DE', { weekday: 'long', timeZone: TZ })
  const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
  return `${tag}, ${zeit} Uhr`
}

export function HeimspielHinweis({ kickoff }: { kickoff: Date }) {
  // Spielort kurz: erster Teil der Adresse (z. B. „Waldsportplatz").
  const ort = CONTACT.address.split(',')[0].trim()
  return (
    <a className="hs-hint hs-hint--karte" href="/live">
      <span className="hs-hint__text">
        <span className="hs-hint__kicker">Heimspiel</span>
        <b>{wannLang(kickoff)}</b>
        <small>{ort}</small>
        <span className="hs-hint__cta">
          Anfahrt &amp; Kalender <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </span>
    </a>
  )
}
