import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { AudioManager } from '../audio/AudioManager'
import { PARTY_HOP } from '../camera/partyPath'

// ─────────────────────────────────────────────────────────────
// Die Musik-Station IST der Partyraum — v5: echte DURCHFAHRT
// statt Dip-to-Black. Dieser Director übersetzt die Scroll-
// Position der Musik-Sektion in den Durchfahrts-Fortschritt
// p∈[0,1] (rein scroll-getrieben → exakt reversibel):
//   Einflug, wenn die Sektion von unten eintrifft,
//   Rückflug, wenn sie nach oben hinausläuft — min(pIn, pOut).
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
  const veilRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fallback || !gateOpen) return
    const { setPartyOpen, setPartyNear, setPartyProgress } = useStore.getState()
    let raf = 0
    let inParty = false

    const update = () => {
      raf = 0
      const el = document.getElementById('musik')
      const veil = veilRef.current
      if (!el || !veil) return
      const vh = window.innerHeight
      const rect = el.getBoundingClientRect()

      // Raum-Chunk vorladen, lange bevor die Durchfahrt beginnt
      if (rect.top < vh * 3) setPartyNear(true)

      // Durchfahrts-Fortschritt: Einflug- und Rückflug-Fenster.
      // v8: Einflug startet SPÄTER (rect.top < 0.95vh statt 1.9vh) — erst
      // wenn die Musik-Sektion wirklich eintritt und die Mannschaft-Karten
      // darüber weg sind (Marvins Überlappungs-Kritik). Fenster 1.15vh
      // bleibt großzügig (nicht zu schnell).
      // v11-E3 (Audit #18): Ein-/Ausflug-Fenster gestreckt (1.15→1.55, 0.8→1.05)
      // → der Schwenk zum/vom Vereinsheim läuft deutlich ruhiger. Die höhere
      // #musik-Sektion liefert den nötigen Scroll-Weg, damit p noch 1 erreicht.
      // v12-E4: Einflug-Fenster weiter gestreckt (1.55 → 2.05) → der Schwenk in
      // den Partyraum läuft nochmal deutlich langsamer/ruhiger. Die 210vh-Musik-
      // Sektion liefert genug Scroll-Weg, damit p am Snap (Sektions-Mitte) trotzdem
      // tief im Raum ankommt (s. samplePartyInside-Settle).
      const pIn = Math.min(1, Math.max(0, (vh * 0.95 - rect.top) / (vh * 2.05)))
      const pOut = Math.min(1, Math.max(0, (rect.bottom - vh * 0.3) / (vh * 1.05)))
      const p = Math.min(pIn, pOut)
      setPartyProgress(p)

      // P5-E4 (Katalog #5): Warme BLENDE um den Hop. Vorbefund: bei p≈0.46–0.48
      // (kurz vor dem Welt-Hop) sitzt die Kamera IM winzigen Windfang, die warme
      // Putzwand füllt den Screen → „durch die Wand"-Barriere. Die alte Blende
      // (0.75·Dreieck) tönte die ohnehin warme Wand nur, statt sie zu decken.
      // Jetzt ein PLATEAU nahe HOP (fast deckend, Exponent 1.6 hält die Mitte
      // hoch, fällt zu den Rändern weich): der Nahflug-Moment liest als warmer
      // Lichtschwall („ins warme Licht treten"), der Hop bleibt verdeckt — der
      // schöne Tür-Schwellen-Frame davor (p≈0.30, d groß) bleibt klar/blendfrei.
      const d = Math.abs(p - PARTY_HOP)
      veil.style.opacity = String(0.97 * (1 - Math.min(1, Math.pow(d / 0.085, 1.6))))

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
      setPartyProgress(0)
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
      ref={veilRef}
      aria-hidden="true"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 380,
        // P5-E4: wärmeres Zentrum (Bernstein statt dunkelbraun) → die Blende
        // liest als Licht, in das man eintritt, nicht als Abdunkeln.
        background: 'radial-gradient(ellipse at 50% 50%, #8a4c16 0%, #3a1f0c 55%, #1c0f06 78%)',
        opacity: 0,
        pointerEvents: 'none',
      }}
    />
  )
}
