import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { GALERIEN, coverOf, galerieDatum, type Galerie } from '../data/galerie'
import { CLUB, NELE } from '../data/club'
import { GalerieView, NeleCredit } from './GalerieView'
import { InstagramZeile } from '../ui/InstagramZeile'

// ─────────────────────────────────────────────────────────────
// v17-D: Seite /galerie (galerie.html, eigenes schlankes Bundle wie
// /partner: kein three.js, kein Supabase — Galerien sind zur Build-Zeit
// eingebacken). /galerie#<slug> öffnet eine bestimmte Galerie.
// Aufbau: großes Titelbild mit Titel → Raster → weitere Galerien →
// die Fotografin.
// ─────────────────────────────────────────────────────────────

function fromHash(): Galerie {
  const slug = typeof window === 'undefined' ? '' : decodeURIComponent(window.location.hash.replace(/^#/, ''))
  return GALERIEN.find((g) => g.slug === slug) ?? GALERIEN[0]
}

export function GalerieApp() {
  const [g, setG] = useState<Galerie>(fromHash)
  useEffect(() => {
    const on = () => {
      setG(fromHash())
      window.scrollTo({ top: 0 })
    }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  useEffect(() => {
    document.title = `${g.titel} · Galerie · ${CLUB.name}`
  }, [g])

  const cover = coverOf(g)
  const datum = galerieDatum(g)
  const andere = GALERIEN.filter((x) => x.slug !== g.slug)

  return (
    <div className="gpage">
      <header className="gpage__bar">
        <a className="gpage__brand" href="/">
          <img src="/brand/aga-logo.png" alt="" width="28" height="33" />
          <span>{CLUB.name}</span>
        </a>
        <a className="gpage__back" href="/">
          <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" />
          Zur Vereinsseite
        </a>
      </header>

      <section className="gpage__hero">
        <img src={cover.src} srcSet={`${cover.preview} 800w, ${cover.src} 2000w`} sizes="100vw" alt={cover.alt} fetchPriority="high" />
        <div className="gpage__heroText">
          <span className="ds-label ds-label--red">Spieltag in Bildern{datum && <> · {datum}</>}</span>
          <h1 className="gpage__title">{g.titel}</h1>
          {g.untertitel && <p className="gpage__lead">{g.untertitel}</p>}
          <NeleCredit />
        </div>
      </section>

      <main className="gpage__main">
        <GalerieView galerie={g} variant="page" />

        {andere.length > 0 && (
          <section className="gpage__more" aria-label="Weitere Galerien">
            <h2 className="gpage__h2">Weitere Galerien</h2>
            <div className="gpage__list">
              {andere.map((x) => {
                const c = coverOf(x)
                return (
                  <a key={x.slug} className="gpage__card" href={`#${x.slug}`}>
                    <img src={c.preview} alt="" loading="lazy" />
                    <span className="ds-label">{galerieDatum(x)}</span>
                    <b>{x.titel}</b>
                  </a>
                )
              })}
            </div>
          </section>
        )}

        <section className="gpage__nele" aria-label="Die Fotografin">
          <img src={NELE.logo} alt="picture by Nele" width="120" height="96" />
          <div>
            <span className="ds-label ds-label--red">{NELE.rolle}</span>
            <h2 className="gpage__h2">{NELE.name}</h2>
            <p>
              Spieltage, Turniere, Feiern: Nele hält fest, was am Platz passiert. Alle Fotos auf dieser Seite sind von
              ihr — teilen gern, aber bitte mit Namen.
            </p>
            <a className="ds-btn ds-btn--line" href={NELE.instagramUrl} target="_blank" rel="noreferrer">
              {NELE.instagram} auf Instagram
              <ArrowUpRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </a>
            <p className="gpage__nele-sva">
              <InstagramZeile text="Mehr vom Spieltag: @svagathenburg" />
            </p>
          </div>
        </section>
      </main>

      <footer className="gpage__foot">
        <a href="/">Zur Vereinsseite</a>
        <a href="/live">Spieltag</a>
        <a href="/partner">Partner werden</a>
        <a href="/impressum.html">Impressum</a>
        <a href="/datenschutz.html">Datenschutz</a>
      </footer>
    </div>
  )
}
