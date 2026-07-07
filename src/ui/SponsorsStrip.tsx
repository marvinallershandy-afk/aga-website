import { motion } from 'framer-motion'
import { SPONSORS, SPONSOR_PLACEHOLDER_SLOTS, NEXT_MATCH, whatsappUrl } from '../data/club'

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

// v9-E4: Die Sponsoren-Station (Geld-Station). Argumente knackig,
// WhatsApp-CTA „Bande sichern", darunter die freien Logo-Slots.
const SPONSOR_ARGS = [
  { h: 'Reichweite', p: 'Jeden Sonntag am Platz, jede Woche in der Story. Dein Logo sieht das halbe Dorf.' },
  { h: 'Echtes Herz', p: 'Kein anonymes Banner an der Autobahn — ein Verein, den hier alle kennen und lieben.' },
  { h: 'Logo am Platz', p: 'Deine Bande direkt am Spielfeldrand. Wir haben extra eine für dich freigelassen.' },
]
const WA_TEXT = 'Hallo SV Agathenburg-Dollern! Ich interessiere mich für eine Bande / ein Sponsoring. Erzählt mir mehr?'

export function SponsorPitch() {
  return (
    <>
      <motion.div className="sponsor-args" {...reveal}>
        {SPONSOR_ARGS.map((a) => (
          <div className="sponsor-arg" key={a.h}>
            <h3>{a.h}</h3>
            <p>{a.p}</p>
          </div>
        ))}
      </motion.div>
      <motion.a
        className="btn btn--wa"
        href={whatsappUrl(WA_TEXT)}
        target="_blank"
        rel="noreferrer"
        {...reveal}
      >
        Bande sichern · WhatsApp
      </motion.a>
      <SponsorsStrip />
    </>
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
          if (sponsor?.logoUrl) {
            const img = <img src={sponsor.logoUrl} alt={sponsor.name} loading="lazy" />
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
