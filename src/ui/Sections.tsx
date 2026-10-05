import { NextMatchPill } from './NextMatchPill'
import { motion } from 'framer-motion'
import { useStore } from '../store/useStore'
import { MUSIK_VH, TEAM_N, TEAM_STEP_VH } from '../camera/tourPlan'
// P1: Sektionstexte/Website-Daten aus der Fassade (Overlay → sonst Seed).
import { SECTIONS, CONTACT, CLUB, TEAM_PHOTO, whatsappUrl, whatsappReady } from '../data/content'
import { PlayerCardGrid } from './PlayerCardGrid'
import { MusicSectionPlayer } from './MusicSection'
import { FussballWidget } from './FussballWidget'
import { PlatzFinden } from './PlatzFinden'
import { SponsorPitch } from './SponsorsStrip'
import { FanGallery } from './FanGallery'
import { AlbumTeaser } from './AlbumTeaser'
import { WaIcon, IgIcon, MailIcon } from './Icons'
// v18-A: Kalender-Abo + Probetraining-Assistent (src/alltag/)
import { KalenderKnopf } from '../alltag/Kalender'
import { ProbetrainingKnopf } from '../alltag/Probetraining'
import { AlltagFuss } from '../alltag/Fuss'

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
  // v18-R: Reihenfolge = Rundgang über das Gelände (docs/RUNDGANG.md) —
  // Verein → Mannschaft → Bande → Fans → Anzeigetafel → Partyraum → Mitmachen.
  const sec = (id: string) => SECTIONS.find((x) => x.id === id) ?? SECTIONS[0]
  const verein = sec('verein')
  const mannschaft = sec('mannschaft')
  const fanblock = sec('fanblock')
  const musik = sec('musik')
  const tabelle = sec('tabelle')
  const sponsoren = sec('sponsoren')
  const kontakt = sec('kontakt')
  const fallback = useStore((s) => s.fallback)

  return (
    <main className="scroll-root">
      <span id="top" />

      {/* 0 · VEREIN — v18-R: im 3D-Rundgang KEIN Text-Zwischenbild mehr. Der
          Rundgang beginnt in der Karten-Totale (Scroll 0 = Startseite), die
          Kamera fährt vom ersten Pixel an los. Die Sektion bleibt als ruhiger
          Anfang (Nav „Verein", Überschrift für Screenreader). */}
      {!fallback ? (
        <section id={verein.id} className="section section--karte" aria-label={verein.label}>
          <h1 className="sr-only">{verein.title.replace(/\n/g, ' ')}</h1>
        </section>
      ) : (
      <section id={verein.id} className="section section--center">
        <div className="section__scrim" />
        <Header kicker={verein.kicker} title={verein.title} body={verein.body} center h1 />
        <motion.p
          {...reveal}
          transition={{ ...reveal.transition, delay: 0.15 }}
          // v17-D: Claim als ruhiges Label statt roter Display-Zeile
          className="ds-label"
          style={{ marginTop: 'var(--s-6)', color: 'var(--c-white)' }}
        >
          {CLUB.claim}
        </motion.p>
        <NextMatchPill />
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
      )}

      {/* v18-R: Scroll-Polster für den Sinkflug Karte → hinter den Torwart
          (ohne Text, ohne Halt). Die Halte misst tourPlan.measureStopAnchors. */}
      <div id="anstoss-gap" aria-hidden="true" style={{ height: '80vh', pointerEvents: 'none' }} />

      {/* 1 · MANNSCHAFT — v18-R „Spieler zu Spieler": im 3D-Pfad eine Sticky-
          Strecke mit einem Halt je Spieler der Startelf (Torwart → Abwehr →
          Mittelfeld → Sturm), danach die Totale (Bank + Trainerstab). Die
          Kamera fährt per Scroll von Karte zu Karte (kein Snap, schnelles
          Scrollen überspringt), Name + Nummer stehen im Begleittext.
          Klick-durchlässig (passthrough), damit Taps die 3D-Karten erreichen.
          Fallback (kein WebGL / reduced-motion): normale Sektion mit
          statischem Taktik-Board + Karten-Raster. */}
      {fallback ? (
        <section id={mannschaft.id} className="section section--left">
          <div className="section__scrim" />
          <Header kicker={mannschaft.kicker} title={mannschaft.title} body={mannschaft.body} />
          <PlayerCardGrid />
        </section>
      ) : (
        <section
          id={mannschaft.id}
          className="section section--left section--snap-start section--team-fly section--passthrough"
          style={{ height: `calc(100svh + ${Math.round(TEAM_N * TEAM_STEP_VH * 100)}svh)` }}
        >
          <div className="team-sticky">
            <div className="section__scrim" />
            <Header kicker={mannschaft.kicker} title={mannschaft.title} body={mannschaft.body} />
            <PlayerCardGrid />
          </div>
          {/* Zweiter Ruhepunkt: die Totale am Ende der Strecke */}
          <div className="team-endstop" aria-hidden="true" />
        </section>
      )}

      {/* 2 · SPONSOREN — v18-R: direkt nach der Mannschaft; die Bande liegt an
          der Südlinie gleich hinter dem Unterstand —
          Banden-Zoom im 3D, hier die Argumente + WhatsApp-CTA + „dein Logo"-Slots. */}
      <section id={sponsoren.id} className="section section--left">
        <div className="section__scrim" />
        <Header kicker={sponsoren.kicker} title={sponsoren.title} body={sponsoren.body} />
        <SponsorPitch variante="rundgang" />
      </section>

      {/* 3 · FANBLOCK (v9-E2) — v18-R: nach der Bande, an der Süd-Linie weiter
          nach Osten in die Kurve — die Südkurve, emotionaler
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
        {/* v18-P: die Kurve → Sammelalbum (Check-in bei jedem Heimspiel) */}
        <AlbumTeaser variante="rundgang" />
      </section>

      {/* 4 · TABELLE / SAISON-COCKPIT — v18-R: Anzeigetafel am Vereinsheim,
          nächster Ort nach der Kurve, vor dem Partyraum —
          Live-Tabelle, Form, Top-Torschützen, letztes/nächstes Spiel. */}
      <section id={tabelle.id} className="section section--left section--snap-start">
        <div className="section__scrim" />
        <Header kicker={tabelle.kicker} title={tabelle.title} body={tabelle.body} />
        <FussballWidget />
        <div style={{ marginTop: 'var(--s-5)', maxWidth: 420, pointerEvents: 'auto' }}>
          <KalenderKnopf variante="zeile" adresse={CONTACT.address} />
        </div>
      </section>

      {/* 5 · MUSIK / PARTYRAUM — v18-R: die Sektion trägt VIER Halte (vor der
          Tür → im Raum → Raum verlassen → wieder vor der Tür, tourPlan.ts).
          Der Text lebt, solange die Kamera drinnen ist (Mitte ± 0.3 vh). */}
      <section id={musik.id} className="section section--left" style={{ minHeight: `${MUSIK_VH * 100}vh` }}>
        <div className="section__scrim" />
        <Header kicker={musik.kicker} title={musik.title} body={musik.body} />
        <MusicSectionPlayer />
      </section>

      {/* 6 · MITMACHEN/FINALE — v18-R: aus dem Partyraum zurück vor die Tür,
          dann steigt die Kamera in die Anfahrts-Karte auf. */}
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
            {/* v15-L: Trainingszeit + Trainingsort (≠ Spielort) */}
            <p className="wanted-card__when">
              {CONTACT.training}
              {CONTACT.trainingOrt ? <> · {CONTACT.trainingOrt.split(',')[0]}</> : null}
            </p>
            <ProbetrainingKnopf className="btn btn--primary" label="Probetraining: einfach da sein" icon={false} />
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
            <dd style={{ maxWidth: 260 }}>
              {CONTACT.training}
              {CONTACT.trainingOrt ? <><br />{CONTACT.trainingOrt}</> : null}
            </dd>
          </div>
          <div>
            <dt>Spielort</dt>
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
        <AlltagFuss />
        {/* Pflicht-Links: Impressum/Datenschutz müssen leicht erkennbar und
            unmittelbar erreichbar sein (§ 5 DDG). Bewusst echte <a>-Links auf
            statische HTML-Seiten statt In-App-Routen — die bleiben erreichbar,
            auch wenn WebGL fehlt oder das 3D-Bundle nicht lädt. Sie stehen im
            prerenderten .scroll-root, also auch ohne JS im Quelltext. */}
        <p style={{ marginTop: '3rem', fontSize: '0.72rem', letterSpacing: '0.1em' }}>
          <a href="/album" style={{ color: 'rgba(255,255,255,0.75)' }}>Sammelalbum</a>
          <span style={{ color: 'rgba(255,255,255,0.35)', margin: '0 0.6rem' }}>·</span>
          <a href="/impressum.html" style={{ color: 'rgba(255,255,255,0.75)' }}>Impressum</a>
          <span style={{ color: 'rgba(255,255,255,0.35)', margin: '0 0.6rem' }}>·</span>
          <a href="/datenschutz.html" style={{ color: 'rgba(255,255,255,0.75)' }}>Datenschutz</a>
        </p>
        <p style={{ marginTop: '0.9rem', fontSize: '0.7rem', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.55)' }}>
          © Seit {CLUB.founded} · {CLUB.name} e.V. · Mit Herz gebaut in Agathenburg.
        </p>
      </section>
    </main>
  )
}
