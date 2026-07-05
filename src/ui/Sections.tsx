import { motion } from 'framer-motion'
import { SECTIONS, CONTACT, CLUB } from '../data/club'
import { PlayerCardGrid } from './PlayerCardGrid'
import { FussballWidget } from './FussballWidget'

const reveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.4 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

function Header({ kicker, title, body, center }: { kicker: string; title: string; body: string; center?: boolean }) {
  return (
    <motion.div {...reveal} style={center ? { maxWidth: 720 } : undefined}>
      <span className="section__kicker">{kicker}</span>
      <h2 className="section__title">{title}</h2>
      <p className="section__body" style={center ? { marginLeft: 'auto', marginRight: 'auto' } : undefined}>
        {body}
      </p>
    </motion.div>
  )
}

export function Sections() {
  const [verein, mannschaft, tabelle, kontakt] = SECTIONS

  return (
    <main className="scroll-root">
      <span id="top" />

      {/* 0 · VEREIN */}
      <section id={verein.id} className="section section--center">
        <div className="section__scrim" />
        <Header kicker={verein.kicker} title={verein.title} body={verein.body} center />
        <motion.p
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.15 }}
          style={{ marginTop: '2rem', fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem,2.4vw,1.6rem)', color: 'var(--red)', letterSpacing: '0.05em' }}
        >
          {CLUB.claim}
        </motion.p>
      </section>

      {/* ANSTOSS — leere Beat-Sektion: hier gehört die Bühne der Kamera
          (Sturzflug, Flutlicht-Flacker, Ball) — kein Inhalt davor. */}
      <section id="anstoss" aria-hidden="true" style={{ minHeight: '150vh', pointerEvents: 'none' }} />

      {/* 1 · MANNSCHAFT */}
      <section id={mannschaft.id} className="section section--left">
        <div className="section__scrim" />
        <Header kicker={mannschaft.kicker} title={mannschaft.title} body={mannschaft.body} />
        <PlayerCardGrid />
      </section>

      {/* 2 · TABELLE */}
      <section id={tabelle.id} className="section section--left">
        <div className="section__scrim" />
        <Header kicker={tabelle.kicker} title={tabelle.title} body={tabelle.body} />
        <FussballWidget />
      </section>

      {/* 3 · MITMACHEN/FINALE — linksbündig, rechts lebt der Fanblock */}
      <section id={kontakt.id} className="section section--left">
        <div className="section__scrim" />
        <Header kicker={kontakt.kicker} title={kontakt.title} body={kontakt.body} />

        {/* Wen wir suchen — jeder Baustein mit nächstem Schritt */}
        <motion.div className="wanted-grid" {...reveal}>
          <div className="wanted-card">
            <h3>Spieler</h3>
            <p>Du kannst kicken? Oder glaubst es zumindest? Beides reicht für den Anfang.</p>
            <a className="btn btn--primary" href={`mailto:${CONTACT.email}?subject=Probetraining`}>
              Probetraining: einfach da sein
            </a>
          </div>
          <div className="wanted-card">
            <h3>Helfer & Fans</h3>
            <p>Bande streichen, Grill anwerfen, laut sein — ein Verein lebt von Leuten, die einfach da sind.</p>
            <a
              className="btn btn--ghost"
              href={`https://maps.apple.com/?q=${encodeURIComponent(CONTACT.address)}`}
              target="_blank"
              rel="noreferrer"
            >
              Sonntag vorbeikommen
            </a>
          </div>
          <div className="wanted-card">
            <h3>Sponsoren</h3>
            <p>Deine Bande wartet schon, wir haben sie extra freigelassen. Logo am Platz, Reichweite im Dorf, Herz inklusive.</p>
            <a className="btn btn--ghost" href={`mailto:${CONTACT.email}?subject=Bande%20sichern`}>
              Bande sichern
            </a>
          </div>
        </motion.div>

        <motion.dl className="contact-grid" {...reveal} style={{ maxWidth: 620 }}>
          <div>
            <dt>Training</dt>
            <dd>{CONTACT.training}</dd>
          </div>
          <div>
            <dt>Platz</dt>
            <dd style={{ maxWidth: 260 }}>{CONTACT.address}</dd>
          </div>
          <div>
            <dt>E-Mail</dt>
            <dd><a href={`mailto:${CONTACT.email}`} style={{ color: '#fff' }}>{CONTACT.email}</a></dd>
          </div>
          <div>
            <dt>Instagram</dt>
            <dd>{CONTACT.instagram}</dd>
          </div>
        </motion.dl>
        <p style={{ marginTop: '3rem', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)' }}>
          © Seit {CLUB.founded} · {CLUB.name} e.V. · Mit Herz gebaut, Platzhalter ehrlich markiert.
        </p>
      </section>
    </main>
  )
}
