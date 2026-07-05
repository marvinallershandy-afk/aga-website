import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store/useStore'
import { CLUB } from '../data/club'

// ─────────────────────────────────────────────────────────────
// Das Sound-Eingangstor: Dämmerungs-Screen mit Wappen + Claim und
// der Wahl „Mit Ton betreten" / „Ohne Ton". Der Klick ist zugleich
// die Browser-Geste, die Audio freischaltet. Danach Vorhang-Reveal
// (Fläche teilt sich horizontal). Entscheidung wird gemerkt —
// Wiederkehrer sehen ein verkürztes Tor (Logo-Blitz → Vorhang).
// reduced-motion: einfacher Fade, nie Auto-Audio.
// ─────────────────────────────────────────────────────────────

type Phase = 'choice' | 'flash' | 'opening' | 'done'

function storedChoice(): 'on' | 'off' | null {
  try {
    const v = localStorage.getItem('sva-sound')
    return v === 'on' || v === 'off' ? v : null
  } catch {
    return null
  }
}

export function EntranceGate() {
  const ready = useStore((s) => s.ready)
  const progress = useStore((s) => s.loadProgress)
  const fallback = useStore((s) => s.fallback)
  const reducedMotion = useStore((s) => s.reducedMotion)
  const setGateOpen = useStore((s) => s.setGateOpen)
  const setSoundOn = useStore((s) => s.setSoundOn)

  const returning = useRef<'on' | 'off' | null>(storedChoice())
  // reduced-motion: immer volle Wahl (kein Auto-Audio), sonst Kurz-Tor
  const [phase, setPhase] = useState<Phase>(
    returning.current && !reducedMotion ? 'flash' : 'choice',
  )

  // Scroll sperren, solange das Tor zu ist
  useEffect(() => {
    if (phase === 'done') return
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [phase])

  const open = (sound: boolean) => {
    setSoundOn(sound)
    setPhase('opening')
    setGateOpen(true)
    window.setTimeout(() => setPhase('done'), reducedMotion ? 500 : 1050)
  }

  // Kurz-Tor: Logo-Blitz, dann automatisch Vorhang (gemerkte Wahl)
  useEffect(() => {
    if (phase !== 'flash') return
    if (!ready && !fallback) return // warten bis geladen, Blitz läuft solange
    const t = window.setTimeout(() => open(returning.current === 'on'), 700)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, ready, fallback])

  if (phase === 'done') return null

  const loading = !ready && !fallback
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
        ? 'linear-gradient(180deg, #0a0c1a 0%, #181430 80%, #241a33 100%)'
        : 'linear-gradient(0deg, #0a0c1a 0%, #171128 80%, #241a33 100%)',
    transform: opening && !reducedMotion ? `translateY(${dir * 102}%)` : 'translateY(0)',
    opacity: opening && reducedMotion ? 0 : 1,
    transition: reducedMotion
      ? 'opacity .45s ease'
      : 'transform 1s cubic-bezier(.72,0,.18,1)',
    willChange: 'transform',
  })

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 400, pointerEvents: opening ? 'none' : 'auto' }} data-testid="gate">
      <div style={panelStyle(-1)} />
      <div style={panelStyle(1)} />
      {/* Inhalt */}
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
          alt={CLUB.name}
          style={{
            width: 'clamp(110px, 22vw, 170px)',
            filter: 'drop-shadow(0 18px 30px rgba(0,0,0,.65)) drop-shadow(0 0 40px rgba(233,29,41,.25))',
            animation: phase === 'flash' ? 'gatePulse 1.1s ease-in-out infinite' : undefined,
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

        {phase === 'choice' && (
          <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', justifyContent: 'center', marginTop: '.5rem' }}>
            <button className="btn btn--primary" disabled={loading} onClick={() => open(true)}>
              {loading ? `Rasen wird gemäht … ${Math.round(progress)}%` : 'Mit Ton betreten'}
            </button>
            <button className="btn btn--ghost" disabled={loading} onClick={() => open(false)}>
              Lieber leise
            </button>
          </div>
        )}
        {phase === 'flash' && (
          <div style={{ fontSize: '.68rem', letterSpacing: '.28em', textTransform: 'uppercase', color: 'rgba(255,255,255,.45)' }}>
            {loading ? `Flutlicht an … ${Math.round(progress)}%` : 'Willkommen zurück am Platz'}
          </div>
        )}
      </div>
      <style>{`@keyframes gatePulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.045); } }`}</style>
    </div>
  )
}
