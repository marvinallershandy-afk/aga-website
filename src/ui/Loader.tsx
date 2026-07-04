import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { CLUB } from '../data/club'

// Kurzer, markiger Loader statt weißer Fläche. Fortschritt kommt aus
// dem Store (vom R3F-Tree gemeldet) — kein drei-Import im Haupt-Bundle.
export function Loader() {
  const ready = useStore((s) => s.ready)
  const progress = useStore((s) => s.loadProgress)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!ready) return
    const t = setTimeout(() => setHidden(true), 650)
    return () => clearTimeout(t)
  }, [ready])

  if (hidden) return null
  const pct = ready ? 100 : Math.round(progress)

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 200,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: '1.4rem',
        background: 'radial-gradient(ellipse at center, #14101c 0%, #0E0D0D 70%)',
        transition: 'opacity .6s ease',
        opacity: ready ? 0 : 1,
        pointerEvents: ready ? 'none' : 'all',
      }}
    >
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(2.5rem, 10vw, 5rem)', letterSpacing: '0.04em', lineHeight: 1 }}>
        SV<span style={{ color: 'var(--red)' }}>A</span>
      </div>
      <div style={{ fontSize: '0.72rem', letterSpacing: '0.35em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
        {CLUB.name}
      </div>
      <div style={{ width: 'min(60vw, 240px)', height: 2, background: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: 'var(--red)', transition: 'width .3s ease' }} />
      </div>
      <div style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.4)', fontVariantNumeric: 'tabular-nums' }}>
        Flutlicht an … {pct}%
      </div>
    </div>
  )
}
