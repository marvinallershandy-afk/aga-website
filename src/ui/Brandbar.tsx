import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
// P1: Sektionstexte aus der Fassade (sm_website_content-Overlay → sonst Seed).
import { SECTIONS } from '../data/content'
import { toMap } from '../map/nav'

// v10-E4: Ton-Steuerung als eigenes, dezentes Fixed-Control unten rechts —
// NICHT mehr als Emoji in der Nav-Zeile (die unter mix-blend-mode:difference
// liegt und das Emoji „billig" aussehen ließ). Sauberes SVG, CI-nah.
function SpeakerIcon({ on }: { on: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
      {on ? (
        <>
          <path d="M16 8.5a4 4 0 0 1 0 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
          <path d="M18.5 6a7 7 0 0 1 0 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </>
      ) : (
        <path d="M17 9.5l4 5M21 9.5l-4 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      )}
    </svg>
  )
}

// v13-E3: Sprung zu einer Sektion — an ihren Snap-Ruhepunkt (Start-Snap-
// Sektionen: offsetTop, sonst Mitte). Chromium bricht lange Smooth-Scrolls
// auf Snap-Containern gern hunderte Pixel vorm Ziel ab (Snap-Interferenz),
// deshalb: nach jeder Ruhephase Rest-Distanz prüfen und nachziehen.
export function jumpToSection(id: string) {
  const el = document.getElementById(id)
  if (!el) return
  const target = () =>
    el.classList.contains('section--snap-start')
      ? el.offsetTop
      : Math.round(el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2)
  let tries = 0
  const settle = () => {
    let last = window.scrollY
    const check = () => {
      if (Math.abs(window.scrollY - last) > 2) {
        last = window.scrollY
        setTimeout(check, 180)
        return
      }
      if (Math.abs(window.scrollY - target()) > 8 && tries < 6) {
        tries++
        // Letzter Versuch: instant statt smooth — auf sehr langsamen
        // Geräten kriecht der Smooth-Scroll und die Versuche verhungern.
        window.scrollTo({ top: target(), behavior: tries >= 5 ? 'auto' : 'smooth' })
        setTimeout(check, 400)
      }
    }
    setTimeout(check, 400)
  }
  window.scrollTo({ top: target(), behavior: 'smooth' })
  settle()
}

// v13-E3: Mobil hat keine Nav-Zeile (display:none ≤640px) — IG-/TikTok-
// Traffic musste bisher 7 Stationen durchscrollen, um zu „Mitmachen" zu
// kommen. Das Dock ist die daumen-erreichbare Antwort: Kapitel-Punkte
// (aktiver Punkt zeigt sein Label) + permanente rote „Mitmachen"-Pill.
function MobileDock() {
  const active = useStore((s) => s.activeSection)
  const jump = jumpToSection
  const dots = SECTIONS.slice(0, -1)
  const mitmachen = SECTIONS[SECTIONS.length - 1]
  return (
    <nav className="mobile-dock" aria-label="Kapitel">
      {/* v16-K: zurück zur Vereinsgelände-Karte */}
      <button className="mobile-dock__map" onClick={() => toMap()} aria-label="Zur Karte">
        Karte
      </button>
      {dots.map((s, i) => (
        <button
          key={s.id}
          className="mobile-dock__dot"
          data-active={active === i}
          aria-label={s.label}
          aria-current={active === i ? 'true' : undefined}
          onClick={() => jump(s.id)}
        >
          <span className="mobile-dock__pt" aria-hidden="true" />
          <span className="mobile-dock__label">{s.label}</span>
        </button>
      ))}
      <button className="mobile-dock__cta" onClick={() => jump(mitmachen.id)}>
        {mitmachen.label}
      </button>
    </nav>
  )
}

export function Brandbar() {
  const active = useStore((s) => s.activeSection)
  const soundOn = useStore((s) => s.soundOn)
  const setSoundOn = useStore((s) => s.setSoundOn)
  const gateOpen = useStore((s) => s.gateOpen)
  const tour = useStore((s) => s.mode === 'tour')
  // v14: Tor öffnet stumm → der Ton-Knopf lädt die ersten Sekunden
  // ausgeklappt („Ton an") ein und schrumpft dann aufs Icon.
  const [hint, setHint] = useState(false)
  useEffect(() => {
    if (!gateOpen) return
    setHint(true)
    const t = window.setTimeout(() => setHint(false), 9000)
    return () => window.clearTimeout(t)
  }, [gateOpen])
  return (
    <>
      {/* v16-K: Kopf + Kapitel-Navigation nur im Rundgang — auf der Karte
          sind die Marker die Navigation. */}
      {tour && (
      <header className="brandbar">
        <a
          href="/"
          className="brandbar__logo"
          style={{ textDecoration: 'none', pointerEvents: 'auto' }}
          onClick={(e) => {
            e.preventDefault()
            toMap()
          }}
          title="Zur Karte"
        >
          SV<b>A</b>
        </a>
        <nav className="brandbar__nav">
          <a
            href="/"
            className="brandbar__map"
            onClick={(e) => {
              e.preventDefault()
              toMap()
            }}
          >
            ← Karte
          </a>
          {SECTIONS.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              data-active={active === i}
              // v12-E3: Reiter = Snap-Ziel (komponierter Snap-Punkt der
              // Station). v13-E3: gemeinsamer jumpToSection-Helper — Start-
              // Snap-Sektionen an den Anfang, Rest mittig, mit Nachzieh-
              // Korrektur gegen Chromiums Snap/Smooth-Abbrüche.
              onClick={(e) => {
                e.preventDefault()
                jumpToSection(s.id)
              }}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>
      )}

      {/* Ton an/aus — dezentes, permanent erreichbares Audio-Control */}
      <button
        className="audio-toggle"
        data-on={soundOn}
        data-hint={hint && !soundOn}
        onClick={() => {
          setHint(false)
          setSoundOn(!soundOn)
        }}
        aria-label={soundOn ? 'Ton aus' : 'Ton an'}
        title={soundOn ? 'Ton aus' : 'Ton an'}
      >
        <SpeakerIcon on={soundOn} />
        <span className="audio-toggle__label" aria-hidden="true">Ton an</span>
      </button>

      {tour && <MobileDock />}
    </>
  )
}
