import { useState } from 'react'
import { useStore } from '../store/useStore'
import { AudioManager } from '../audio/AudioManager'

// „Reinkommen?" am Vereinsheim (Tabellen-Station) → Dip-to-Black →
// Partyraum. Drinnen: Musik in den Vordergrund (Party-Pegel),
// klarer Zurück-Weg. Raum-Chunk lädt erst beim ersten Klick.
export function PartyUI() {
  const gateOpen = useStore((s) => s.gateOpen)
  const partyOpen = useStore((s) => s.partyOpen)
  const activeSection = useStore((s) => s.activeSection)
  const fallback = useStore((s) => s.fallback)
  const setPartyOpen = useStore((s) => s.setPartyOpen)
  const [dip, setDip] = useState(false)

  if (fallback || !gateOpen) return null

  const transition = (open: boolean) => {
    setDip(true)
    window.setTimeout(() => {
      setPartyOpen(open)
      AudioManager.setMode(open ? 'party' : 'ambient')
      document.body.style.overflow = open ? 'hidden' : ''
      document.body.classList.toggle('in-party', open)
      window.setTimeout(() => setDip(false), 60)
    }, 320)
  }

  const showEnter = !partyOpen && activeSection === 2

  return (
    <>
      {showEnter && (
        <button
          className="btn btn--primary"
          onClick={() => transition(true)}
          style={{
            position: 'fixed',
            bottom: 'clamp(1rem, 4vh, 2.4rem)',
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 240,
            boxShadow: '0 8px 30px rgba(233,29,41,.4)',
          }}
        >
          🍺 Auf ein Bier? Reinkommen
        </button>
      )}
      {partyOpen && (
        <>
          <button
            className="btn btn--ghost"
            onClick={() => transition(false)}
            style={{
              position: 'fixed',
              top: 'clamp(4rem, 10vh, 6rem)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 240,
              background: 'rgba(12,10,14,.75)',
              border: '1px solid rgba(255,255,255,.25)',
            }}
          >
            ← Zurück zum Platz
          </button>
          <div
            style={{
              position: 'fixed',
              bottom: 'clamp(1rem, 4vh, 2.2rem)',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 235,
              fontSize: '.66rem',
              letterSpacing: '.28em',
              textTransform: 'uppercase',
              color: 'rgba(255,255,255,.55)',
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            Partyraum · Musik läuft — Track-Wahl unten rechts
          </div>
        </>
      )}
      {/* Dip-to-Black Übergang */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 380,
          background: '#060508',
          opacity: dip ? 1 : 0,
          pointerEvents: 'none',
          transition: 'opacity .3s ease',
        }}
      />
    </>
  )
}
