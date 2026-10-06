// v21-A: Logik + Hooks zu den Medaillen (getrennt von den Komponenten,
// damit Fast Refresh sauber bleibt). Siehe Medaille.tsx / Ziele.tsx.
import { useCallback, useEffect, useRef, useState } from 'react'
import type { Seltenheit, Ziel } from './api'
import { ruhigeBewegung } from '../karten/medien'

export type Metall = 'kupfer' | 'silber' | 'gold' | 'holo' | 'rot'

/** Metall nach Belohnung bzw. Art des Ziels. */
export function metallVon(z: Pick<Ziel, 'schluessel' | 'typ' | 'belohnung'>): Metall {
  if (z.schluessel === 'rote_familie') return 'rot'
  const m: Seltenheit | undefined = z.belohnung.minSeltenheit
  if (m === 'spezial') return 'holo'
  if (m === 'gold') return 'gold'
  if (m === 'silber') return 'silber'
  if (z.typ === 'meilenstein') return (z.belohnung.lose ?? 0) >= 2 ? 'gold' : 'silber'
  if (z.typ === 'kapitel' || z.typ.startsWith('serie')) return 'silber'
  return 'kupfer'
}


export function lohnText(b: Ziel['belohnung']): string {
  const teile: string[] = []
  if (b.karten) teile.push(b.karten === 1 ? '1 Karte' : `${b.karten} Karten`)
  if (b.minSeltenheit && b.minSeltenheit !== 'bronze') teile.push(`mind. ${b.minSeltenheit === 'spezial' ? 'Spezial' : b.minSeltenheit === 'gold' ? 'Gold' : 'Silber'}`)
  if (b.lose) teile.push(`${b.lose} ${b.lose === 1 ? 'Los' : 'Lose'}`)
  return teile.join(' · ')
}


/** Sichtbar-Merker (einmal true, sobald im Bild) — für Ring-Füllung und Freischalten. */
export function useImBild<T extends Element>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null)
  const [da, setDa] = useState(() => ruhigeBewegung() || typeof IntersectionObserver === 'undefined')
  useEffect(() => {
    const el = ref.current
    if (!el || da) return
    const io = new IntersectionObserver(
      (e) => {
        if (e.some((x) => x.isIntersecting)) {
          setDa(true)
          io.disconnect()
        }
      },
      { threshold: 0.25 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [da])
  return [ref, da]
}

/** Zeiger-Neigung für alle [data-kipp]-Kinder (ein Listener, rAF, nur Maus/Stift).
 *  Callback-Ref (React 19: mit Aufräumen) — greift auch bei später gemounteten Elementen. */
export function useKippen<T extends HTMLElement>(): (el: T | null) => (() => void) | undefined {
  return useCallback((el: T | null) => {
    if (!el || ruhigeBewegung() || !window.matchMedia?.('(hover: hover)').matches) return undefined
    let aktiv: HTMLElement | null = null
    let rect: DOMRect | null = null
    let raf = 0
    let x = 0.5
    let y = 0.5
    const schreibe = () => {
      raf = 0
      if (!aktiv) return
      aktiv.style.setProperty('--kx', x.toFixed(3))
      aktiv.style.setProperty('--ky', y.toFixed(3))
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const t = (e.target as HTMLElement).closest<HTMLElement>('[data-kipp]')
      if (t !== aktiv) {
        aktiv?.classList.remove('is-kipp')
        aktiv?.style.removeProperty('--kx')
        aktiv?.style.removeProperty('--ky')
        aktiv = t
        // Maß beim Betreten (vor der Neigung) — sonst zittert die Rechnung
        rect = aktiv?.getBoundingClientRect() ?? null
      }
      if (!aktiv || !rect) return
      if (!aktiv.classList.contains('is-kipp')) aktiv.classList.add('is-kipp')
      x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
      if (!raf) raf = requestAnimationFrame(schreibe)
    }
    const leave = () => {
      aktiv?.classList.remove('is-kipp')
      aktiv?.style.removeProperty('--kx')
      aktiv?.style.removeProperty('--ky')
      aktiv = null
      rect = null
    }
    const scroll = () => {
      rect = aktiv?.getBoundingClientRect() ?? null
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    window.addEventListener('scroll', scroll, { passive: true })
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      window.removeEventListener('scroll', scroll)
      if (raf) cancelAnimationFrame(raf)
    }
  }, [])
}
