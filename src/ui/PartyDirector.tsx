import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioManager } from '../audio/AudioManager'
import { PARTY_HOP } from '../camera/rigState'

// ─────────────────────────────────────────────────────────────
// Die Musik-Station IST der Partyraum — v5: echte DURCHFAHRT
// statt Dip-to-Black. v18-R: den Durchfahrts-Fortschritt p∈[0,1]
// schreibt der CameraRig (Rundgang: Etappen vor der Tür → Raum →
// zurück vor die Tür; Karte: Ritt rein/raus). Dieser Director setzt
// Schleier, Audio und „drin"-Zustand und lädt den Raum vor.
// Der Welt-Hop (Kamera-Teleport in die Pocket-Dimension) liegt
// bei PARTY_HOP und wird 3D-seitig von der glühenden Türöffnung
// verdeckt; als Sicherheitsnetz legt sich hier ein kurzer WARMER
// Licht-Schleier (kein Schwarz!) über den Hop-Moment.
// Audio-Crossfade (Atmo→Musik) folgt p — an die Fahrt gekoppelt.
// Fallback/reduced-motion: kein 3D → Director inaktiv (statische
// Seite mit sanftem DOM-Übergang).
// ─────────────────────────────────────────────────────────────

export function PartyDirector() {
  const gateOpen = useStore((s) => s.gateOpen)
  const fallback = useStore((s) => s.fallback)
  const mode = useStore((s) => s.mode)
  const veilRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fallback || !gateOpen) return
    const { setPartyOpen, setPartyNear, setPartyProgress } = useStore.getState()
    let raf = 0
    let inParty = false

    // Schleier, Audio und „drin"-Zustand folgen p — gleich für beide Modi.
    const apply = (p: number) => {
      const veil = veilRef.current
      if (veil) {
        // Warmer Schleier als Hop-Sicherheitsnetz (Dreieck um PARTY_HOP)
        const d = Math.abs(p - PARTY_HOP)
        veil.style.opacity = String(Math.max(0, 0.75 * (1 - d / 0.09)))
      }
      // Audio folgt der Fahrt; Playback-Umschaltung am Hop
      AudioManager.setPartyBlend(p)
      const open = p >= PARTY_HOP
      if (open !== inParty) {
        inParty = open
        setPartyOpen(open)
        AudioManager.setMode(open ? 'party' : 'ambient')
        document.body.classList.toggle('in-party', open)
      }
    }
    const cleanup = () => {
      if (inParty) {
        setPartyOpen(false)
        AudioManager.setMode('ambient')
        document.body.classList.remove('in-party')
      }
    }

    // v16-K/v18-R: In BEIDEN Modi treibt die Kamera (CameraRig) p über den
    // Store — im Rundgang sind „vor der Tür → rein → verweilen → raus" eigene
    // Etappen der Route (tourRoute.ts), gedämpft wie jede andere Fahrt. Vorher
    // rechnete dieser Director p direkt aus dem Scroll (ungedämpft) → der
    // Rückweg aus dem Raum lief abrupt.
    apply(useStore.getState().partyProgress)
    const unsub = useStore.subscribe((s, prev) => {
      if (s.partyProgress !== prev.partyProgress) apply(s.partyProgress)
    })
    if (mode === 'map') {
      return () => {
        unsub()
        cleanup()
      }
    }

    // Rundgang: Raum-Chunk vorladen, lange bevor die Tür erreicht ist
    const update = () => {
      raf = 0
      const el = document.getElementById('musik')
      if (!el) return
      if (el.getBoundingClientRect().top < window.innerHeight * 3) setPartyNear(true)
    }
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update)
    }
    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    return () => {
      unsub()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      if (raf) cancelAnimationFrame(raf)
      setPartyProgress(0)
      cleanup()
    }
  }, [fallback, gateOpen, mode])

  if (fallback) return null

  return (
    <div
      ref={veilRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 380,
        background: 'radial-gradient(ellipse at 50% 52%, #3a1f0c 0%, #1c0f06 70%)',
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
