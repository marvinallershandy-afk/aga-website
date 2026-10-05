import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { cameraState, KICKOFF_U } from '../camera/rigState'

// ─────────────────────────────────────────────────────────────
// Letterbox-Balken (21:9) für den Anstoß-Beat (v5 Kino-Ebene):
// fahren sanft ein, wenn die Fahrt den Sturzflug erreicht, und
// verschwinden danach wieder. Pure Funktion von cameraState.u
// (rAF-Leser, kein React-Rerender) → exakt scroll-reversibel.
// ─────────────────────────────────────────────────────────────

const BAR = 11 // vh je Balken → ergibt ~21:9 auf 16:9-Viewports

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)))
  return t * t * (3 - 2 * t)
}

export function Letterbox() {
  const fallback = useStore((s) => s.fallback)
  const enabled = useStore((s) => s.cinemaFx.letterbox)
  const topRef = useRef<HTMLDivElement>(null)
  const botRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (fallback || !enabled) return
    let raf = 0
    const tick = () => {
      const u = cameraState.u
      // Fenster um den Anstoß-Beat. v14: aus KICKOFF_U abgeleitet — vorher hart
      // auf 0.25 verdrahtet (real 1/7), dadurch lagen die Balken über der
      // Mannschafts-Station statt über dem Anstoß.
      const presence = smoothstep(KICKOFF_U - 0.07, KICKOFF_U - 0.02, u) * (1 - smoothstep(KICKOFF_U + 0.01, KICKOFF_U + 0.05, u))
      if (topRef.current && botRef.current) {
        topRef.current.style.transform = `translateY(${(presence - 1) * 100}%)`
        botRef.current.style.transform = `translateY(${(1 - presence) * 100}%)`
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [fallback, enabled])

  if (fallback || !enabled) return null

  const base: React.CSSProperties = {
    position: 'fixed',
    left: 0,
    right: 0,
    height: `${BAR}vh`,
    background: '#050407',
    zIndex: 360,
    pointerEvents: 'none',
    transform: 'translateY(-100%)',
    willChange: 'transform',
  }
  return (
    <>
      <div ref={topRef} aria-hidden="true" style={{ ...base, top: 0 }} />
      <div ref={botRef} aria-hidden="true" style={{ ...base, top: 'auto', bottom: 0, transform: 'translateY(100%)' }} />
    </>
  )
}
