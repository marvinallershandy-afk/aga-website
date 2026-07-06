import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioManager } from '../audio/AudioManager'

// ─────────────────────────────────────────────────────────────
// Die Musik-Station IST der Partyraum (Kurskorrektur v4):
// Sobald die Musik-Sektion die Viewport-Mitte deckt, schneidet
// die Kamera ins Vereinsheim (Dip-to-Black) — rein scroll-
// getrieben, also exakt reversibel: zurückscrollen = wieder
// draußen. Nav „Musik" und Scroll führen denselben Weg.
// Der schwarze Dip ist eine reine Funktion der Scroll-Position
// (Dreieck um die Sektionskante) und deckt den Kamera-Schnitt.
// ─────────────────────────────────────────────────────────────

export function PartyDirector() {
  const gateOpen = useStore((s) => s.gateOpen)
  const fallback = useStore((s) => s.fallback)
  const dipRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fallback || !gateOpen) return
    const { setPartyOpen, setPartyNear } = useStore.getState()
    let raf = 0
    let inParty = false

    const update = () => {
      raf = 0
      const el = document.getElementById('musik')
      const dip = dipRef.current
      if (!el || !dip) return
      const vh = window.innerHeight
      const rect = el.getBoundingClientRect()
      // s > 0 ⇔ Sektion deckt die Viewport-Mitte → wir sind drin
      const s = Math.min(vh / 2 - rect.top, rect.bottom - vh / 2)
      dip.style.opacity = String(Math.min(1, Math.max(0, 1 - Math.abs(s) / (vh * 0.22))))
      // Raum-Chunk vorladen, lange bevor der Schnitt kommt
      if (rect.top < vh * 3) setPartyNear(true)
      const open = s > 0
      if (open !== inParty) {
        inParty = open
        setPartyOpen(open)
        AudioManager.setMode(open ? 'party' : 'ambient')
        document.body.classList.toggle('in-party', open)
      }
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
      if (inParty) {
        setPartyOpen(false)
        AudioManager.setMode('ambient')
        document.body.classList.remove('in-party')
      }
    }
  }, [fallback, gateOpen])

  if (fallback) return null

  return (
    <div
      ref={dipRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 380,
        background: '#060508',
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
