import { useStore } from '../store/useStore'
import { SECTIONS } from '../data/club'

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

export function Brandbar() {
  const active = useStore((s) => s.activeSection)
  const soundOn = useStore((s) => s.soundOn)
  const setSoundOn = useStore((s) => s.setSoundOn)
  return (
    <>
      <header className="brandbar">
        <a href="#top" className="brandbar__logo" style={{ textDecoration: 'none', pointerEvents: 'auto' }}>
          SV<b>A</b>
        </a>
        <nav className="brandbar__nav">
          {SECTIONS.map((s, i) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              data-active={active === i}
              // v12-E3: Reiter = Snap-Ziel. Statt an den Sektions-ANFANG zu
              // springen (native #-Navigation), zentrieren wir die Sektion →
              // exakt der komponierte Snap-Punkt (= Kamera-Pose der Station).
              onClick={(e) => {
                const el = document.getElementById(s.id)
                if (!el) return
                e.preventDefault()
                el.scrollIntoView({ behavior: 'smooth', block: 'center' })
              }}
            >
              {s.label}
            </a>
          ))}
        </nav>
      </header>

      {/* Ton an/aus — dezentes, permanent erreichbares Audio-Control */}
      <button
        className="audio-toggle"
        data-on={soundOn}
        onClick={() => setSoundOn(!soundOn)}
        aria-label={soundOn ? 'Ton aus' : 'Ton an'}
        title={soundOn ? 'Ton aus' : 'Ton an'}
      >
        <SpeakerIcon on={soundOn} />
      </button>
    </>
  )
}
