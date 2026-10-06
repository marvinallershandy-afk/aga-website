import { ArrowUpRight } from 'lucide-react'
import { IgIcon } from './Icons'
import { CONTACT } from '../data/content'
import { zaehleEreignis } from '../statistik/zaehlen'
import './instagram-zeile.css'

// ─────────────────────────────────────────────────────────────
// v19-S: EIN Baustein für den Rückkanal nach Instagram (Audit B §2.7).
// Überall gleich: IG-Icon, @svagathenburg, Ziel-Ereignis „instagram".
// Dezent im Designsystem (Linien-Knopf, Marke über das Icon, nicht die
// Farbe). Die globale Klick-Zählung (statistik/zaehlen) feuert ohnehin bei
// jedem instagram.com-Link — der explizite Aufruf hier ist idempotent und
// stellt die Zählung auch ohne den globalen Listener sicher.
// ─────────────────────────────────────────────────────────────

export const IG_STANDARD = '@svagathenburg folgen – Wochenplan, MOTM, Tipp-Sieger, Gewinnspiele.'

export function InstagramZeile({ text = IG_STANDARD, className }: { text?: string; className?: string }) {
  return (
    <a
      className={`ig-zeile${className ? ` ${className}` : ''}`}
      href={CONTACT.instagramUrl}
      target="_blank"
      rel="noopener"
      onClick={() => zaehleEreignis('instagram')}
    >
      <IgIcon size={18} />
      <span className="ig-zeile__text">{text}</span>
      <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
    </a>
  )
}
