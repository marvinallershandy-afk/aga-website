import { useState } from 'react'
import { motion } from 'framer-motion'
import { SPONSORS, SPONSOR_PLACEHOLDER_SLOTS, NEXT_MATCH, CONTACT, whatsappUrl } from '../data/club'

// ─────────────────────────────────────────────────────────────
// Sponsoren-Station (Geld-Station). v11-E6: die Partner/„dein-Logo"-
// Slots leben in einem KARUSSELL (Pfeile zum Durchblättern). Leere
// Slots im CI-Look mit einladendem Claim (kein Preis) + WhatsApp UND
// E-Mail als CTA.
// ─────────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 20 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

const WA_TEXT = 'Hallo SV Agathenburg-Dollern! Ich interessiere mich für eine Bande / ein Sponsoring. Erzählt mir mehr?'
const MAIL_SUBJECT = 'Sponsoring / Bande beim SV Agathenburg-Dollern'
const MAIL_BODY = 'Hallo SV Agathenburg-Dollern,\n\nich interessiere mich für eine Bande / ein Sponsoring. Bitte meldet euch mit den Infos.\n\nViele Grüße'
const mailtoUrl = `mailto:${CONTACT.email}?subject=${encodeURIComponent(MAIL_SUBJECT)}&body=${encodeURIComponent(MAIL_BODY)}`

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

const SPONSOR_ARGS = [
  { h: 'Reichweite', p: 'Jeden Sonntag am Platz, jede Woche in der Story. Dein Logo sieht das halbe Dorf.' },
  { h: 'Echtes Herz', p: 'Kein anonymes Banner an der Autobahn — ein Verein, den hier alle kennen und lieben.' },
  { h: 'Logo am Platz', p: 'Deine Bande direkt am Spielfeldrand. Wir haben extra eine für dich freigelassen.' },
]

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
      <motion.div className="sponsor-ctas" {...reveal}>
        <a className="btn btn--wa" href={whatsappUrl(WA_TEXT)} target="_blank" rel="noreferrer">
          Bande sichern · WhatsApp
        </a>
        <a className="btn btn--ghost" href={mailtoUrl}>
          Per E-Mail anfragen
        </a>
      </motion.div>
      <SponsorCarousel />
    </>
  )
}

// v11-E6: Karussell durch die Partner-/„dein-Logo"-Slots.
type Slot = { kind: 'logo'; name: string; logoUrl: string; url?: string } | { kind: 'empty'; claim: string }

function buildSlots(): Slot[] {
  const withLogos = SPONSORS.filter((s) => s.logoUrl).map(
    (s) => ({ kind: 'logo', name: s.name, logoUrl: s.logoUrl!, url: s.url } as Slot),
  )
  const emptyCount = Math.max(SPONSOR_PLACEHOLDER_SLOTS - withLogos.length, withLogos.length ? 1 : SPONSOR_PLACEHOLDER_SLOTS)
  const claims = ['Diese Bande sucht dich', 'Hier fehlst noch du', 'Dein Logo am Spielfeld', 'Werde Teil der Kurve']
  const empties: Slot[] = Array.from({ length: emptyCount }, (_, i) => ({ kind: 'empty', claim: claims[i % claims.length] }))
  return [...withLogos, ...empties]
}

// Alias: die Mitmachen-Sektion zeigt weiterhin „Unsere Partner" (als Karussell).
export { SponsorCarousel as SponsorsStrip }

export function SponsorCarousel() {
  const slots = buildSlots()
  const [i, setI] = useState(0)
  const n = slots.length
  const go = (d: number) => setI((v) => (v + d + n) % n)
  const slot = slots[i]

  return (
    <motion.div className="sponsors" {...reveal}>
      <span className="sponsors__label">Unsere Partner</span>
      <div className="carousel">
        <button className="carousel__arrow" onClick={() => go(-1)} aria-label="Vorheriger Slot">‹</button>

        <div className="carousel__stage">
          {slot.kind === 'logo' ? (
            <div className="carousel__slot carousel__slot--logo">
              {slot.url ? (
                <a href={slot.url} target="_blank" rel="noreferrer"><img src={slot.logoUrl} alt={slot.name} /></a>
              ) : (
                <img src={slot.logoUrl} alt={slot.name} />
              )}
            </div>
          ) : (
            <div className="carousel__slot carousel__slot--empty">
              <span className="carousel__claim">{slot.claim}</span>
              <span className="carousel__sub">Deine Bande direkt am Platz — kein Preisschild, einfach fragen.</span>
              <div className="carousel__ctas">
                <a className="btn btn--wa btn--sm" href={whatsappUrl(WA_TEXT)} target="_blank" rel="noreferrer">WhatsApp</a>
                <a className="btn btn--ghost btn--sm" href={mailtoUrl}>E-Mail</a>
              </div>
            </div>
          )}
        </div>

        <button className="carousel__arrow" onClick={() => go(1)} aria-label="Nächster Slot">›</button>
      </div>
      <div className="carousel__dots">
        {slots.map((_, k) => (
          <button
            key={k}
            className={`carousel__dot${k === i ? ' is-active' : ''}`}
            onClick={() => setI(k)}
            aria-label={`Slot ${k + 1}`}
          />
        ))}
      </div>
    </motion.div>
  )
}
