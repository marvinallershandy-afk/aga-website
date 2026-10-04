import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { CLUB } from '../data/club'

// ─────────────────────────────────────────────────────────────
// Eingangstor v14: kein Klick-Zwang mehr. Wappen + Claim + Ladefortschritt,
// sobald die Szene bereit ist (oder spätestens nach MAX_WAIT_MS) öffnet der
// Vorhang automatisch — STUMM. Ton gibt's über den „Ton an"-Pill unten
// rechts (Brandbar), der in den ersten Sekunden ausgeklappt einlädt.
// Warum: Besucher aus der IG-Story landen im In-App-Browser; jeder
// Pflicht-Klick vor dem ersten Bild kostet Absprünge. Autoplay mit Ton geht
// ohne Geste ohnehin nicht.
// reduced-motion: Fade statt Vorhang.
// ─────────────────────────────────────────────────────────────

type Phase = 'loading' | 'opening' | 'done'

/** Spätestens dann geht das Tor auf — auch wenn die 3D-Szene noch lädt
 *  oder hängt. Inhalt (DOM-Sektionen) ist dann sofort erreichbar. */
const MAX_WAIT_MS = 9000
/** Mindest-Standzeit, damit das Wappen nicht nur flackert. */
const MIN_SHOW_MS = 650

export function EntranceGate() {
  const ready = useStore((s) => s.ready)
  const progress = useStore((s) => s.loadProgress)
  const fallback = useStore((s) => s.fallback)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const setGateOpen = useStore((s) => s.setGateOpen)

  const [phase, setPhase] = useState<Phase>('loading')
  const [minShown, setMinShown] = useState(false)
  const [timedOut, setTimedOut] = useState(false)

  useEffect(() => {
    const a = window.setTimeout(() => setMinShown(true), MIN_SHOW_MS)
    const b = window.setTimeout(() => setTimedOut(true), MAX_WAIT_MS)
    return () => {
      window.clearTimeout(a)
      window.clearTimeout(b)
    }
  }, [])

  // Scroll sperren, solange das Tor zu ist
  useEffect(() => {
    if (phase === 'done') return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [phase])

  useEffect(() => {
    if (phase !== 'loading' || !minShown) return
    if (!ready && !fallback && !timedOut) return
    setPhase('opening')
    setGateOpen(true)
  }, [phase, minShown, ready, fallback, timedOut, setGateOpen])

  // Eigener Effekt fürs Abbauen: läge der Timer im Öffnen-Effekt, räumte
  // dessen Cleanup ihn beim Phasenwechsel sofort wieder ab.
  useEffect(() => {
    if (phase !== 'opening') return
    const t = window.setTimeout(() => setPhase('done'), reducedMotion ? 500 : 1050)
    return () => window.clearTimeout(t)
  }, [phase, reducedMotion])

  if (phase === 'done') return null

  const opening = phase === 'opening'
  const panelStyle = (dir: -1 | 1): React.CSSProperties => ({
    position: 'absolute',
    left: 0,
    right: 0,
    height: '50.5%',
    top: dir === -1 ? 0 : undefined,
    bottom: dir === 1 ? 0 : undefined,
    background:
      dir === -1
        ? 'linear-gradient(180deg, #0b0708 0%, #1a0c0e 78%, #2a1013 100%)'
        : 'linear-gradient(0deg, #0b0708 0%, #180b0d 78%, #2a1013 100%)',
    transform: opening && !reducedMotion ? `translateY(${dir * 102}%)` : 'translateY(0)',
    opacity: opening && reducedMotion ? 0 : 1,
    transition: reducedMotion ? 'opacity .45s ease' : 'transform 1s cubic-bezier(.72,0,.18,1)',
    willChange: 'transform',
  })

  const pct = Math.round(progress)

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: opening ? 'none' : 'auto' }}
      data-testid="gate"
      role="status"
      aria-live="polite"
      aria-label={`${CLUB.name} wird geladen`}
    >
      <div style={panelStyle(-1)} />
      <div style={panelStyle(1)} />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1.3rem',
          textAlign: 'center',
          padding: '1.5rem',
          opacity: opening ? 0 : 1,
          transition: 'opacity .35s ease',
        }}
      >
        <img
          src="/brand/wappen.png"
          alt=""
          style={{
            width: 'clamp(110px, 22vw, 170px)',
            filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.65)) drop-shadow(0 0 40px rgba(233,29,41,.25))',
            animation: reducedMotion ? undefined : 'gatePulse 1.1s ease-in-out infinite',
          }}
        />
        <div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(1.6rem, 5vw, 2.6rem)', letterSpacing: '.03em', lineHeight: 1 }}>
            SV<span style={{ color: 'var(--red)' }}> AGATHENBURG-DOLLERN</span>
          </div>
          <div style={{ marginTop: '.55rem', fontSize: '.72rem', letterSpacing: '.32em', textTransform: 'uppercase', color: 'rgba(255,255,255,.55)' }}>
            {CLUB.claim}
          </div>
        </div>
        <div style={{ width: 'min(220px, 60vw)', height: 2, background: 'rgba(255,255,255,.1)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ width: `${ready || fallback ? 100 : Math.max(6, pct)}%`, height: '100%', background: 'var(--red)', transition: 'width .3s ease' }} />
        </div>
        <div style={{ fontSize: '.66rem', letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)', marginTop: '-.6rem' }}>
          Flutlicht an
        </div>
      </div>
      <style>{`@keyframes gatePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }`}</style>
    </div>
  )
}
