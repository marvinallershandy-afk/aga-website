import { useState } from 'react'
import { motion } from 'framer-motion'
import { SPONSORS, SPONSOR_PLACEHOLDER_SLOTS, NEXT_MATCH, CONTACT, whatsappUrl, whatsappReady } from '../data/club'
import { useStore } from '../store/useStore'

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

// v12-E6: kompakte Vorteils-Pills statt drei Text-Kästen (weniger Text).
const SPONSOR_PILLS = ['Logo am Spielfeldrand', 'Reichweite im Dorf & in der Story', 'Kein Preisschild — einfach fragen']

// Die Claims der leeren Banden-Tafeln (in Sync mit Barrier.tsx-Slots).
const BAND_CLAIMS = ['Diese Bande sucht dich', 'Hier fehlst noch du', 'Dein Logo am Spielfeld', 'Werde Teil der Kurve']

// v12-E6: Das KARUSSELL LEBT JETZT AUF DER 3D-BANDE. Die Pfeile hier fahren die
// Kamera an der Bande entlang von Tafel zu Tafel (Store: sponsorFocus). Der DOM
// bleibt bewusst schlank: kurzer Pitch, Pfeile + Punkte, zwei CTAs.
export function SponsorPitch() {
  const focus = useStore((s) => s.sponsorFocus)
  const count = useStore((s) => s.sponsorCount)
  const setFocus = useStore((s) => s.setSponsorFocus)

  return (
    <>
      <motion.div className="sponsor-pills" {...reveal}>
        {SPONSOR_PILLS.map((p) => (
          <span className="sponsor-pill" key={p}>{p}</span>
        ))}
      </motion.div>

      {/* Banden-Karussell-Steuerung → fährt die 3D-Kamera an der Bande entlang */}
      <motion.div className="band-nav" {...reveal}>
        <button className="band-nav__arrow" onClick={() => setFocus(focus - 1)} aria-label="Bande davor">‹</button>
        <div className="band-nav__center">
          <span className="band-nav__claim">{BAND_CLAIMS[focus % BAND_CLAIMS.length]}</span>
          <span className="band-nav__count">Bande {focus + 1} / {count} · an der Kamera vorbei</span>
          <div className="band-nav__dots">
            {Array.from({ length: count }, (_, k) => (
              <button
                key={k}
                className={`carousel__dot${k === focus ? ' is-active' : ''}`}
                onClick={() => setFocus(k)}
                aria-label={`Bande ${k + 1}`}
              />
            ))}
          </div>
        </div>
        <button className="band-nav__arrow" onClick={() => setFocus(focus + 1)} aria-label="Nächste Bande">›</button>
      </motion.div>

      {/* v13-E4: ohne echte WA-Nummer gäbe es hier zwei E-Mail-Buttons —
          dann nur EINEN ehrlichen primären E-Mail-CTA zeigen. */}
      <motion.div className="sponsor-ctas" {...reveal}>
        {whatsappReady ? (
          <>
            <a className="btn btn--wa" href={whatsappUrl(WA_TEXT)} target="_blank" rel="noreferrer">
              Bande sichern · WhatsApp
            </a>
            <a className="btn btn--ghost" href={mailtoUrl}>
              E-Mail
            </a>
          </>
        ) : (
          <a className="btn btn--primary" href={mailtoUrl}>
            Bande sichern · E-Mail
          </a>
        )}
      </motion.div>
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
                {whatsappReady && (
                  <a className="btn btn--wa btn--sm" href={whatsappUrl(WA_TEXT)} target="_blank" rel="noreferrer">WhatsApp</a>
                )}
                <a className={`btn btn--sm ${whatsappReady ? 'btn--ghost' : 'btn--primary'}`} href={mailtoUrl}>E-Mail</a>
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
