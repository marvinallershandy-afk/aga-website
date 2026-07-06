import { motion } from 'framer-motion'
import { SECTIONS, CONTACT, CLUB } from '../data/club'
import { PlayerCardGrid } from './PlayerCardGrid'
import { MusicSectionPlayer } from './MusicSection'
import { FussballWidget } from './FussballWidget'
import { PlatzFinden } from './PlatzFinden'

const reveal = {
  initial: { opacity: 0, y: 40 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.4 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

function Header({ kicker, title, body, center, h1 }: { kicker: string; title: string; body: string; center?: boolean; h1?: boolean }) {
  const Tag = h1 ? 'h1' : 'h2'
  return (
    <motion.div {...reveal} style={center ? { maxWidth: 720 } : undefined}>
      <span className="section__kicker">{kicker}</span>
      <Tag className="section__title">{title}</Tag>
      <p className="section__body" style={center ? { marginLeft: 'auto', marginRight: 'auto' } : undefined}>
        {body}
      </p>
    </motion.div>
  )
}

export function Sections() {
  const [verein, mannschaft, musik, tabelle, kontakt] = SECTIONS

  return (
    <main className="scroll-root">
      <span id="top" />

      {/* 0 · VEREIN */}
      <section id={verein.id} className="section section--center">
        <div className="section__scrim" />
        <Header kicker={verein.kicker} title={verein.title} body={verein.body} center h1 />
        <motion.p
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.15 }}
          style={{ marginTop: '2rem', fontFamily: 'var(--font-display)', fontSize: 'clamp(1rem,2.4vw,1.6rem)', color: 'var(--red)', letterSpacing: '0.05em' }}
        >
          {CLUB.claim}
        </motion.p>
      </section>

      {/* ANSTOSS-Beat (v8): KEINE eigene Sektion/Stopp mehr. Der Moment
          (Flutlicht flackert an, Ball rollt) lebt jetzt als NAHTLOSER
          Kamera-Übergang Hero→Mannschaft. Ein kurzes Scroll-Polster gibt
          dem Sturzflug Weg, ohne Text/Halt. Der Anker wird synthetisch
          zwischen Verein und Mannschaft gesetzt (useScrollProgress.ts). */}
      <div id="anstoss-gap" aria-hidden="true" style={{ height: '80vh', pointerEvents: 'none' }} />

      {/* 1 · MANNSCHAFT */}
      <section id={mannschaft.id} className="section section--left">
        <div className="section__scrim" />
        <Header kicker={mannschaft.kicker} title={mannschaft.title} body={mannschaft.body} />
        <PlayerCardGrid />
      </section>

      {/* Trenn-Polster (v8): klare „reiner Platz"-Beat zwischen Karten und
          Partyraum-Anflug — die Mannschaft muss vollständig geräumt sein,
          bevor der Vereinsheim-Anflug startet (Marvins Überlappungs-Kritik).
          Schiebt zugleich die Musik-Sektion nach unten → Anflug (an musik.top
          gekoppelt) startet später. */}
      <div id="team-musik-gap" aria-hidden="true" style={{ height: '70vh', pointerEvents: 'none' }} />

      {/* 2 · MUSIK — AGA URKNALL, der Vereins-Soundtrack */}
      <section id={musik.id} className="section section--left">
        <div className="section__scrim" />
        <Header kicker={musik.kicker} title={musik.title} body={musik.body} />
        <MusicSectionPlayer />
      </section>

      {/* 3 · TABELLE */}
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
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(CONTACT.mapsQuery)}`}
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
            <dd>
              <a href={CONTACT.instagramUrl} target="_blank" rel="noreferrer" style={{ color: '#fff' }}>
                {CONTACT.instagram}
              </a>
            </dd>
          </div>
        </motion.dl>

        <PlatzFinden />
        <p style={{ marginTop: '3rem', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>
          © Seit {CLUB.founded} · {CLUB.name} e.V. · Mit Herz gebaut, Platzhalter ehrlich markiert.
        </p>
      </section>
    </main>
  )
}
