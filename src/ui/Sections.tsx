import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { SECTIONS, CONTACT, CLUB, TEAM_PHOTO, whatsappUrl, whatsappReady } from '../data/club'
import { PlayerCardGrid } from './PlayerCardGrid'
import { MusicSectionPlayer } from './MusicSection'
import { FussballWidget } from './FussballWidget'
import { PlatzFinden } from './PlatzFinden'
import { SponsorPitch } from './SponsorsStrip'
import { FanGallery } from './FanGallery'
import { WaIcon, IgIcon, MailIcon } from './Icons'

// v13-F3: Reveals leichter — weniger Hub, kürzer. 40px/0.7s fühlte sich
// bei jedem Vorbeiscrollen wie Gewicht an, das erst hochgestemmt wird.
const reveal = {
  initial: { opacity: 0, y: 22 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.4 },
  transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
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
  // v11-E5: Reihenfolge tabelle↔sponsoren getauscht (Array in club.ts entspr.)
  const [verein, mannschaft, fanblock, musik, tabelle, sponsoren, kontakt] = SECTIONS
  const fallback = useStore((s) => s.fallback)

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
        {/* Mannschaftsfoto-Slot (v8-E5): rendert nur mit echtem Bild —
            kein leerer Rahmen. Marvin liefert Stimmungsbild → TEAM_PHOTO. */}
        {TEAM_PHOTO && (
          <motion.img
            {...reveal}
            src={TEAM_PHOTO}
            alt="Die Mannschaft des SV Agathenburg-Dollern"
            style={{ marginTop: '2rem', maxWidth: 'min(560px, 82vw)', width: '100%', borderRadius: 12, border: '1px solid rgba(255,255,255,0.14)' }}
          />
        )}
      </section>

      {/* ANSTOSS-Beat (v8): KEINE eigene Sektion/Stopp mehr. Der Moment
          (Flutlicht flackert an, Ball rollt) lebt jetzt als NAHTLOSER
          Kamera-Übergang Hero→Mannschaft. Ein kurzes Scroll-Polster gibt
          dem Sturzflug Weg, ohne Text/Halt. Der Anker wird synthetisch
          zwischen Verein und Mannschaft gesetzt (useScrollProgress.ts). */}
      <div id="anstoss-gap" aria-hidden="true" style={{ height: '80vh', pointerEvents: 'none' }} />

      {/* 1 · MANNSCHAFT — im 3D-Pfad LEBEN die Karten auf dem Platz (PlayerCards3D).
          Die Sektion wird dann klick-durchlässig (pointer-events:none), damit Taps
          die 3D-Karten unter der Sektion erreichen; Text bleibt sichtbar & lesbar. */}
      <section
        id={mannschaft.id}
        className={`section section--left${fallback ? '' : ' section--passthrough'}`}
      >
        <div className="section__scrim" />
        <Header kicker={mannschaft.kicker} title={mannschaft.title} body={mannschaft.body} />
        <PlayerCardGrid />
      </section>

      {/* 2 · FANBLOCK (v9-E2, zurückgeholt) — die Südkurve, emotionaler
          Beat. Kamera-Station 3 schwenkt in die SO-Ecke auf die Fans +
          wehendes Banner (FanBlock.tsx). Linksbündig, rechts lebt die
          Kurve im 3D. */}
      {/* v-website-polish: passthrough → Klicks in den freien Sektionsflächen
          erreichen die 3D-Foto-Schilder in der Kurve (Raycast). Text ist
          non-interaktiv, die Foto-Kacheln (button) reaktivieren pointer-events
          selbst und bleiben mobil zuverlässig tippbar. */}
      <section id={fanblock.id} className="section section--left section--passthrough">
        <div className="section__scrim" />
        <Header kicker={fanblock.kicker} title={fanblock.title} body={fanblock.body} />
        {/* v11-E7: Meisterfeier-Kacheln + Lightbox — dieselbe Lightbox öffnen
            die 3D-Schilder (v-website-polish). Nur echte Fotos. */}
        <FanGallery />
      </section>

      {/* Trenn-Polster (v8): klare „reiner Platz"-Beat zwischen Fanblock und
          Partyraum-Anflug — muss geräumt sein, bevor der Vereinsheim-Anflug
          startet. Schiebt zugleich die Musik-Sektion nach unten → Anflug (an
          musik.top gekoppelt) startet später. */}
      <div id="team-musik-gap" aria-hidden="true" style={{ height: '60vh', pointerEvents: 'none' }} />

      {/* 3 · MUSIK / PARTYRAUM-DURCHFAHRT — v11-E3: die Sektion ist bewusst
          extra hoch (mehr Scroll-Puffer), damit der Vereinsheim-Schwenk rein
          UND raus sich streckt und ruhig liest (Audit #18). Anker misst sich
          aus dem DOM-Zentrum → Kamera-Station bleibt synchron. */}
      <section id={musik.id} className="section section--left" style={{ minHeight: '210vh' }}>
        <div className="section__scrim" />
        <Header kicker={musik.kicker} title={musik.title} body={musik.body} />
        <MusicSectionPlayer />
      </section>

      {/* 4 · TABELLE / SAISON-COCKPIT (v11-E5: jetzt VOR Sponsoren) —
          Live-Tabelle, Form, Top-Torschützen, letztes/nächstes Spiel. */}
      <section id={tabelle.id} className="section section--left section--snap-start">
        <div className="section__scrim" />
        <Header kicker={tabelle.kicker} title={tabelle.title} body={tabelle.body} />
        <FussballWidget />
      </section>

      {/* 5 · SPONSOREN (die Geld-Station, jetzt direkt vor „Mitmachen") —
          Banden-Zoom im 3D, hier die Argumente + WhatsApp-CTA + „dein Logo"-Slots. */}
      <section id={sponsoren.id} className="section section--left">
        <div className="section__scrim" />
        <Header kicker={sponsoren.kicker} title={sponsoren.title} body={sponsoren.body} />
        <SponsorPitch />
      </section>

      {/* 3 · MITMACHEN/FINALE — linksbündig, rechts lebt der Fanblock */}
      <section id={kontakt.id} className="section section--left section--snap-start">
        {/* v13-E3: sprechender Anker-Alias fürs Link-in-Bio —
            /#mitmachen landet direkt am CTA-Beat. Absolut an der Sektions-
            Oberkante, damit der native Anker-Sprung exakt am Snap-Ruhepunkt
            (offsetTop, .section--snap-start) landet statt hinterm Padding. */}
        <span id="mitmachen" aria-hidden="true" style={{ position: 'absolute', top: 0 }} />
        <div className="section__scrim" />
        <Header kicker={kontakt.kicker} title={kontakt.title} body={kontakt.body} />

        {/* v9-E5: direkter Draht ganz vorn — WhatsApp + Instagram prominent.
            v12-E7: NextMatch + Sponsoren-Karussell hier ENTFERNT (dupliziert die
            Tabelle-/Sponsoren-Station) → der Mitmachen-Snap zeigt jetzt komponiert
            die Kernaussage: Komm vorbei + WA/Insta + 3 Karten. */}
        <motion.div className="contact-actions" {...reveal}>
          {/* v13-E4: ohne echte Nummer wird der WA-Button ehrlich zum
              E-Mail-Button (whatsappUrl fällt auf mailto zurück). */}
          <a
            className={whatsappReady ? 'btn btn--wa' : 'btn btn--primary'}
            href={whatsappUrl('Hallo SV Agathenburg-Dollern! Ich habe eine Frage / will vorbeikommen.')}
            target={whatsappReady ? '_blank' : undefined}
            rel={whatsappReady ? 'noreferrer' : undefined}
          >
            {whatsappReady ? <WaIcon size={18} /> : <MailIcon size={18} />}
            {whatsappReady ? 'WhatsApp schreiben' : 'E-Mail schreiben'}
          </a>
          <a className="btn btn--ig" href={CONTACT.instagramUrl} target="_blank" rel="noreferrer">
            <IgIcon size={18} />
            {CONTACT.instagram} folgen
          </a>
        </motion.div>

        {/* Wen wir suchen — jeder Baustein mit nächstem Schritt */}
        <motion.div className="wanted-grid" {...reveal}>
          <div className="wanted-card">
            <h3>Spieler</h3>
            <p>Du kannst kicken? Oder glaubst es zumindest? Beides reicht für den Anfang.</p>
            <a
              className="btn btn--primary"
              href={whatsappUrl('Hallo! Ich würde gern beim Probetraining vorbeikommen.')}
              target={whatsappReady ? '_blank' : undefined}
              rel={whatsappReady ? 'noreferrer' : undefined}
            >
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
            <a
              className="btn btn--ghost"
              href={whatsappUrl('Hallo! Ich interessiere mich für eine Bande / Sponsoring.')}
              target={whatsappReady ? '_blank' : undefined}
              rel={whatsappReady ? 'noreferrer' : undefined}
            >
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

        {/* v12-E7: „Wo wir kicken" (Karte + Route) = zweiter Beat / Finale-Rauszoom. */}
        <PlatzFinden />
        <p style={{ marginTop: '3rem', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>
          © Seit {CLUB.founded} · {CLUB.name} e.V. · Mit Herz gebaut, Platzhalter ehrlich markiert.
        </p>
      </section>
    </main>
  )
}
