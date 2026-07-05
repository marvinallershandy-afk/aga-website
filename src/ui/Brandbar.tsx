import { useStore } from '../store/useStore'
import { SECTIONS } from '../data/club'

export function Brandbar() {
  const active = useStore((s) => s.activeSection)
  const soundOn = useStore((s) => s.soundOn)
  const setSoundOn = useStore((s) => s.setSoundOn)
  return (
    <header className="brandbar">
      <a href="#top" className="brandbar__logo" style={{ textDecoration: 'none', pointerEvents: 'auto' }}>
        SV<b>A</b>
      </a>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'clamp(0.8rem, 2vw, 1.8rem)' }}>
        <nav className="brandbar__nav">
          {SECTIONS.map((s, i) => (
            <a key={s.id} href={`#${s.id}`} data-active={active === i}>
              {s.label}
            </a>
          ))}
        </nav>
        {/* Mute-Toggle: dezent, permanent erreichbar */}
        <button
          onClick={() => setSoundOn(!soundOn)}
          aria-label={soundOn ? 'Ton aus' : 'Ton an'}
          title={soundOn ? 'Ton aus' : 'Ton an'}
          style={{
            pointerEvents: 'auto',
            width: 34,
            height: 34,
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.35)',
            background: 'rgba(255,255,255,0.08)',
            color: '#fff',
            fontSize: 15,
            lineHeight: 1,
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          {soundOn ? '🔊' : '🔇'}
        </button>
      </div>
    </header>
  )
}
