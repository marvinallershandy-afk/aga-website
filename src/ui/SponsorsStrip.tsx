import { motion } from 'framer-motion'
import { SPONSORS, SPONSOR_PLACEHOLDER_SLOTS, NEXT_MATCH } from '../data/club'

// ─────────────────────────────────────────────────────────────
// Sponsoren-Strip + Nächstes Heimspiel (v8-E5). Solange keine echten
// Sponsoren-Logos da sind, zeigen Platzhalter-Slots „Hier könnte dein
// Logo stehen" — zugleich Verkaufsargument. Nächstes-Heimspiel-Slot
// zieht Fans; PLATZHALTER bis echte Termine / fussball.de.
// ─────────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

export function NextMatch() {
  return (
    <motion.div className="next-match" {...reveal}>
      <span className="next-match__label">Nächstes Heimspiel</span>
      <span className="next-match__game">
        SV Agathenburg-Dollern <em>vs.</em> {NEXT_MATCH.opponent}
      </span>
      <span className="next-match__date">
        {NEXT_MATCH.date}
        {NEXT_MATCH.isPlaceholder && <span className="next-match__ph"> · Platzhalter</span>}
      </span>
    </motion.div>
  )
}

export function SponsorsStrip() {
  const hasReal = SPONSORS.length > 0
  const slots = hasReal ? SPONSORS : Array.from({ length: SPONSOR_PLACEHOLDER_SLOTS })
  return (
    <motion.div className="sponsors" {...reveal}>
      <span className="sponsors__label">Unsere Partner</span>
      <div className="sponsors__row">
        {slots.map((_, i) => {
          const sponsor = hasReal ? SPONSORS[i] : null
          if (sponsor?.logo) {
            const img = <img src={sponsor.logo} alt={sponsor.name} loading="lazy" />
            return (
              <div className="sponsors__slot" key={i}>
                {sponsor.url ? (
                  <a href={sponsor.url} target="_blank" rel="noreferrer">
                    {img}
                  </a>
                ) : (
                  img
                )}
              </div>
            )
          }
          return (
            <div className="sponsors__slot sponsors__slot--empty" key={i}>
              Hier könnte<br />dein Logo stehen
            </div>
          )
        })}
      </div>
    </motion.div>
  )
}
