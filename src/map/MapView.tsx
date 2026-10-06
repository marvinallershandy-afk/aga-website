import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { CLUB, CONTACT } from '../data/content'
import { PLACES, type Place, type PlaceId } from './places'
import { MAP_POSTER } from './posterData'
import { registerMarker, markerLayer, mapWorld } from './mapWorld'
import { openPlace, closePlace, startTour } from './nav'
import { PlaceIcon } from './MarkerIcons'
import { useMatchStatus, heimspielFenster } from './matchStatus'
import { PLACE_SEO } from './panelText'
import { ArrowRight, Map as MapIcon, Target } from 'lucide-react'
import { useMapScrollToTour } from './intro'
import { AlbumTeaser } from '../ui/AlbumTeaser'
import { TippTeaser } from '../ui/TippTeaser'
import { InstagramZeile } from '../ui/InstagramZeile'
import { HeimspielHinweis } from '../ui/HeimspielHinweis'
// map.css kommt direkt aus index.html (vor dem JS verfügbar, s. dort)

// ─────────────────────────────────────────────────────────────
// v16-K „Vereinsgelände-Karte" — die Startseite.
// Ebenen (von unten): 3D-Canvas (Stage) · Poster-Standbild (bis die Live-
// Karte steht; Fallback dauerhaft) · Marker · Kopf/Dock/Fuß · Panel.
// Die Marker sind echte Links (/#ort) — im vorgerenderten HTML schon VOR
// dem JavaScript klickbar; React übernimmt danach (Kamera + Panel).
// ─────────────────────────────────────────────────────────────

const TRAINING_SHORT = CONTACT.training.replace(/,?\s*ab\s*/i, ' · ').replace(':00 Uhr', ' Uhr')

function subline(id: PlaceId, matchLine: string): string {
  switch (id) {
    case 'spieltag':
      return matchLine
    case 'training':
      return TRAINING_SHORT
    case 'mannschaft':
      return '1. Herren · Kader'
    case 'fans':
      return 'Meister 2026'
    case 'musik':
      // v18-P: „Album" hieß hier die Musik — nicht mit dem Sammelalbum verwechseln
      return 'Partyraum · Musik'
    case 'partner':
      return 'Bande sichern'
    case 'anfahrt':
      return 'Route & Kontakt'
  }
}

function Marker({ place, line, state }: { place: Place; line: string; state?: string }) {
  const ref = useRef<HTMLAnchorElement>(null)
  useEffect(() => {
    registerMarker(place.id, ref.current)
    return () => registerMarker(place.id, null)
  }, [place.id])
  const w = MAP_POSTER.wide.markers[place.id]
  const t = MAP_POSTER.tall.markers[place.id]
  const style = {
    '--xw': w[0],
    '--yw': w[1],
    '--xt': t[0],
    '--yt': t[1],
  } as React.CSSProperties
  return (
    <a
      ref={ref}
      href={`/#${place.id}`}
      className={`kmark kmark--${place.tone}`}
      data-place={place.id}
      data-state={state}
      style={style}
      aria-label={`${place.label}: ${line}`}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return
        e.preventDefault()
        openPlace(place.id)
      }}
    >
      <span className="kmark__base" aria-hidden="true" />
      <span className="kmark__stem" aria-hidden="true" />
      <span className="kmark__float">
        {place.tone === 'sign' ? (
          <span className="kmark__sign">
            <span className="kmark__signIcon">
              <PlaceIcon id={place.id} size={16} />
            </span>
            <span className="kmark__signText">
              <b>Trainingsplatz B73</b>
              <small>{place.label} · {line}</small>
            </span>
            <span className="kmark__signArrow" aria-hidden="true">
              <ArrowRight size={16} strokeWidth={1.5} />
            </span>
          </span>
        ) : (
          <>
            <span className="kmark__pin">
              <PlaceIcon id={place.id} />
              {state === 'live' && <i className="kmark__liveDot" aria-hidden="true" />}
            </span>
            <span className="kmark__label">
              <b>{place.label}</b>
              <small>{line}</small>
            </span>
          </>
        )}
      </span>
    </a>
  )
}

function MapMarkers() {
  const ms = useMatchStatus()
  const layerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    markerLayer.el = layerRef.current
    // Live-Zustand überlebt Re-Mounts (Rundgang → Karte)
    if (mapWorld.live) layerRef.current?.classList.add('is-live')
    return () => {
      markerLayer.el = null
    }
  }, [])
  return (
    <nav className="kmap__markers" ref={layerRef} aria-label="Orte auf dem Vereinsgelände">
      <div className="kmap__cover">
        {PLACES.map((p) => (
          <Marker
            key={p.id}
            place={p}
            line={subline(p.id, ms.line)}
            state={p.id === 'spieltag' ? ms.state : undefined}
          />
        ))}
      </div>
    </nav>
  )
}

/** Poster-Standbild der Karten-Totale (bis die Live-Karte steht). */
export function MapPoster() {
  const stageLive = useStore((s) => s.stageLive)
  const fallback = useStore((s) => s.fallback)
  const hide = stageLive && !fallback
  return (
    <div className="kmap__poster" data-hide={hide || undefined} aria-hidden="true">
      <picture>
        <source media="(max-aspect-ratio: 1/1)" srcSet={MAP_POSTER.tall.src} />
        <img src={MAP_POSTER.wide.src} alt="" fetchPriority="high" />
      </picture>
    </div>
  )
}

function MapLoader() {
  const stageLive = useStore((s) => s.stageLive)
  const fallback = useStore((s) => s.fallback)
  if (fallback) return null
  return (
    <div className="kmap__loader" data-hide={stageLive || undefined} role="status" aria-live="polite">
      <span className="kmap__loaderDot" aria-hidden="true" />
      {stageLive ? 'Flutlicht an' : 'Flutlicht geht an …'}
    </div>
  )
}

function MapDock() {
  const place = useStore((s) => s.place)
  return (
    <nav className="kdock" aria-label="Schnellwahl">
      <button className="kdock__btn" data-active={!place} onClick={() => closePlace()}>
        <MapIcon size={18} strokeWidth={1.5} aria-hidden="true" />
        Karte
      </button>
      <button className="kdock__btn" data-active={place === 'spieltag'} onClick={() => openPlace('spieltag')}>
        <PlaceIcon id="spieltag" size={18} />
        Live
      </button>
      {/* v21-UX (Befund 1): Tipp-Liga als vierter Einstieg in der Daumenzone */}
      <a className="kdock__btn" href="/tippen">
        <Target size={18} strokeWidth={1.5} aria-hidden="true" />
        Tippen
      </a>
      <button className="kdock__btn kdock__btn--cta" data-active={place === 'training'} onClick={() => openPlace('training')}>
        <PlaceIcon id="training" size={18} />
        Mitspielen
      </button>
    </nav>
  )
}

/** SEO/Linkvorschau: Kerninhalt jedes Ortes als semantisches HTML —
 *  visuell verborgen (das offene Panel zeigt die reiche Fassung). */
function PlaceSeo() {
  return (
    <div className="kmap__seo">
      {PLACES.map((p) => {
        const seo = PLACE_SEO[p.id]
        return (
          <article key={p.id} id={`ort-${p.id}`}>
            <h2>{p.title}</h2>
            {seo.map((line, i) => (
              <p key={i}>{line}</p>
            ))}
            <a href={`/#${p.id}`}>{p.label} öffnen</a>
          </article>
        )
      })}
    </div>
  )
}

export function MapView() {
  const place = useStore((s) => s.place)
  const intro = useStore((s) => s.intro)
  const veilRef = useRef<HTMLDivElement>(null)

  // v17-D: Scrollen auf der Karte startet nahtlos den Rundgang
  useMapScrollToTour(!place && intro === 'off')

  // v19-K (Audit B §2.1.2): Heimspiel innerhalb 72 h → ruhiger Hinweis.
  // Minutengenauigkeit ist für ein 72-h-Fenster unnötig; bei jedem Render neu
  // berechnet (Panel öffnen/schließen rendert MapView ohnehin).
  const heimKickoff = heimspielFenster(Date.now())

  // Schleier (Schnitt aus dem Partyraum) folgt mapWorld.veil
  useEffect(() => {
    let raf = 0
    let last = -1
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const v = mapWorld.veil
      if (Math.abs(v - last) > 0.002 && veilRef.current) {
        last = v
        veilRef.current.style.opacity = v.toFixed(3)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  // Karte = kein Dokument-Scroll (Panel scrollt in sich)
  useEffect(() => {
    document.documentElement.classList.add('is-map')
    return () => document.documentElement.classList.remove('is-map')
  }, [])

  return (
    <div className="kmap" data-open={place ?? undefined} data-intro={intro !== 'off' || undefined} data-heimspiel={heimKickoff ? '' : undefined}>
      <header className="kmap__head">
        <a className="kmap__brand" href="/" onClick={(e) => { e.preventDefault(); closePlace() }}>
          <img src="/brand/aga-logo.png" alt="" width="36" height="42" />
          <span>
            <b>{CLUB.name}</b>
            <small>{CLUB.claim}</small>
          </span>
        </a>
        <button className="kmap__tour" onClick={() => startTour()}>
          <span className="kmap__tourLong">Rundgang starten</span>
          <span className="kmap__tourShort">Rundgang</span>
          <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </header>

      <h1 className="kmap__h1">
        {CLUB.name}: Fußball am Waldsportplatz Agathenburg
      </h1>

      <MapMarkers />
      <p className="kmap__hint" aria-hidden="true">
        <span className="kmap__hintD">Ort wählen · scrollen für den Rundgang</span>
        <span className="kmap__hintM">Ort antippen · wischen für den Rundgang</span>
        <span className="kmap__hintLine" />
      </p>
      <MapLoader />
      <MapDock />
      {/* v19-K: Heimspiel-Hinweis ab 72 h (rechts, verdrängt mobil den Teaser-Stapel) */}
      {heimKickoff && <HeimspielHinweis kickoff={heimKickoff} />}
      {/* v21-UX (Befund 1) + v18-P: Einstiege Tipp-Liga + Sammelalbum, gestapelt
          unten links, gleicher Stil, ohne Überlappung. */}
      <div className="kmap__ecke">
        <TippTeaser />
        <AlbumTeaser variante="karte" />
      </div>
      <footer className="kmap__foot">
        <InstagramZeile className="ig-zeile--karte" />
        <span className="kmap__foot-links">
          <a href="/album">Sammelalbum</a>
          <span aria-hidden="true">·</span>
          <a href="/impressum.html">Impressum</a>
          <span aria-hidden="true">·</span>
          <a href="/datenschutz.html">Datenschutz</a>
        </span>
      </footer>
      <PlaceSeo />
      <div ref={veilRef} className="kmap__veil" aria-hidden="true" />
    </div>
  )
}

