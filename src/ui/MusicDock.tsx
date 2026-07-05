import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore'
import { AudioManager } from '../audio/AudioManager'
import { TRACKS, COVER_URL, ALBUM_TITLE } from '../audio/tracks'

// ─────────────────────────────────────────────────────────────
// Musik-Menü: dezenter Player-Chip unten rechts (Cover, Track,
// Play/Pause/Weiter), aufklappbare Trackliste. Marvins Album.
// Erscheint erst nach dem Tor und nur bei Ton an.
// ─────────────────────────────────────────────────────────────

export function MusicDock() {
  const gateOpen = useStore((s) => s.gateOpen)
  const soundOn = useStore((s) => s.soundOn)
  const [, force] = useState(0)
  const [open, setOpen] = useState(false)

  // AudioManager an den Ton-Schalter koppeln + UI-Updates abonnieren
  useEffect(() => {
    AudioManager.onChange = () => force((n) => n + 1)
    return () => {
      AudioManager.onChange = null
    }
  }, [])
  useEffect(() => {
    if (!gateOpen) return
    AudioManager.setEnabled(soundOn)
  }, [gateOpen, soundOn])

  if (!gateOpen || !soundOn) return null
  const t = AudioManager.current

  return (
    <div
      style={{
        position: 'fixed',
        right: 'clamp(0.8rem, 2.5vw, 1.6rem)',
        bottom: 'clamp(0.8rem, 2.5vw, 1.6rem)',
        zIndex: 250,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: '.5rem',
        fontFamily: 'var(--font-body)',
      }}
    >
      {open && (
        <div
          style={{
            width: 'min(78vw, 280px)',
            maxHeight: '46vh',
            overflowY: 'auto',
            background: 'rgba(12,10,14,.92)',
            backdropFilter: 'blur(8px)',
            border: '1px solid rgba(255,255,255,.12)',
            borderRadius: 12,
            padding: '.5rem',
          }}
        >
          <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center', padding: '.3rem .4rem .6rem' }}>
            <img src={COVER_URL} alt="" style={{ width: 44, height: 44, borderRadius: 6, objectFit: 'cover' }} />
            <div style={{ fontSize: '.68rem', letterSpacing: '.06em', color: 'rgba(255,255,255,.75)', lineHeight: 1.4 }}>
              {ALBUM_TITLE}
              <div style={{ color: 'rgba(255,255,255,.4)', fontSize: '.6rem' }}>von Marvin — für den Verein</div>
            </div>
          </div>
          {TRACKS.map((tr, i) => {
            const active = i === AudioManager.trackIndex
            return (
              <button
                key={tr.slug}
                onClick={() => AudioManager.play(i)}
                style={{
                  display: 'flex',
                  width: '100%',
                  alignItems: 'center',
                  gap: '.5rem',
                  padding: '.42rem .5rem',
                  borderRadius: 8,
                  border: 'none',
                  cursor: 'pointer',
                  background: active ? 'rgba(233,29,41,.18)' : 'transparent',
                  color: active ? '#fff' : 'rgba(255,255,255,.72)',
                  fontSize: '.78rem',
                  textAlign: 'left',
                }}
              >
                <span style={{ width: 14, color: active ? 'var(--red)' : 'rgba(255,255,255,.35)', fontSize: '.65rem' }}>
                  {active && AudioManager.playing ? '▶' : i + 1}
                </span>
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tr.title}</span>
                <span style={{ fontSize: '.62rem', color: 'rgba(255,255,255,.35)', fontVariantNumeric: 'tabular-nums' }}>{tr.duration}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Player-Chip */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '.55rem',
          background: 'rgba(12,10,14,.88)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,255,255,.12)',
          borderRadius: 999,
          padding: '.35rem .5rem .35rem .35rem',
        }}
      >
        <button
          onClick={() => setOpen(!open)}
          aria-label="Trackliste"
          style={{ border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', lineHeight: 0 }}
        >
          <img src={COVER_URL} alt={ALBUM_TITLE} style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover' }} />
        </button>
        <div style={{ maxWidth: 130, overflow: 'hidden' }}>
          <div style={{ fontSize: '.68rem', color: '#fff', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>{t.title}</div>
          <div style={{ fontSize: '.55rem', letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,.4)' }}>
            {AudioManager.playing ? 'läuft' : 'Pause'}
          </div>
        </div>
        <button onClick={() => AudioManager.toggle()} aria-label={AudioManager.playing ? 'Pause' : 'Abspielen'} style={chipBtn}>
          {AudioManager.playing ? '❚❚' : '▶'}
        </button>
        <button onClick={() => AudioManager.next()} aria-label="Nächster Track" style={chipBtn}>
          ≫
        </button>
      </div>
    </div>
  )
}

const chipBtn: React.CSSProperties = {
  width: 30,
  height: 30,
  borderRadius: '50%',
  border: '1px solid rgba(255,255,255,.2)',
  background: 'rgba(255,255,255,.08)',
  color: '#fff',
  fontSize: 11,
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center',
}
