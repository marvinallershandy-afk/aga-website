import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import type { Galerie, GalerieBild } from '../data/galerie'
import { NELE } from '../data/club'

// v17-D: Vollbild-Lightbox der Galerien. Schwarz, Bild so groß wie möglich,
// Pfeile/←→/Wischen, Esc schließt, Zähler + Bildtext + Credit. Lädt das
// 2000-px-Bild des aktuellen Fotos und die Nachbarn vor. Ohne framer-motion
// (schlankes /galerie-Bundle): Einblenden per CSS (200–300 ms).

export function GalerieLightbox({
  galerie,
  bilder,
  index,
  onIndex,
  onClose,
}: {
  galerie: Galerie
  bilder: GalerieBild[]
  index: number
  onIndex: (i: number) => void
  onClose: () => void
}) {
  const n = bilder.length
  const go = (d: number) => onIndex((index + d + n) % n)
  const goRef = useRef(go)
  const closeRef = useRef(onClose)
  useEffect(() => {
    goRef.current = go
    closeRef.current = onClose
  })
  const touch = useRef<{ x: number; y: number } | null>(null)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null
    const html = document.documentElement
    const saved = html.style.overflow
    html.style.overflow = 'hidden'
    panel.current?.querySelector<HTMLElement>('.glb-lb__close')?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        closeRef.current()
      }
      if (e.key === 'ArrowRight') goRef.current(1)
      if (e.key === 'ArrowLeft') goRef.current(-1)
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      html.style.overflow = saved
      prev?.focus?.()
    }
  }, [])

  // Nachbarn vorladen
  useEffect(() => {
    for (const d of [1, -1]) {
      const img = new Image()
      img.src = bilder[(index + d + n) % n].src
    }
  }, [index, bilder, n])

  const b = bilder[index]
  if (typeof document === 'undefined') return null
  return createPortal(
    <div
      ref={panel}
      className="glb-lb"
      role="dialog"
      aria-modal="true"
      aria-label={`${galerie.titel} — Foto ${index + 1} von ${n}`}
      onClick={onClose}
      onTouchStart={(e) => {
        const t = e.touches[0]
        touch.current = t ? { x: t.clientX, y: t.clientY } : null
      }}
      onTouchEnd={(e) => {
        const t0 = touch.current
        const t = e.changedTouches[0]
        touch.current = null
        if (!t0 || !t) return
        const dx = t.clientX - t0.x
        const dy = t.clientY - t0.y
        if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) go(dx < 0 ? 1 : -1)
        else if (dy > 110 && Math.abs(dy) > Math.abs(dx) * 1.4) onClose()
      }}
    >
      <figure className="glb-lb__fig" onClick={(e) => e.stopPropagation()}>
        <img key={b.src} src={b.src} alt={b.alt} width={b.w} height={b.h} />
        <figcaption>
          <span className="glb-lb__count">
            {String(index + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
          </span>
          <span className="glb-lb__alt">{b.alt}</span>
          <span className="glb-lb__credit">
            Foto:{' '}
            <a href={galerie.fotografUrl ?? NELE.instagramUrl} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
              {galerie.fotograf}
            </a>
          </span>
        </figcaption>
      </figure>
      {n > 1 && (
        <>
          <button
            type="button"
            className="glb-lb__nav glb-lb__nav--prev"
            onClick={(e) => {
              e.stopPropagation()
              go(-1)
            }}
            aria-label="Vorheriges Foto"
          >
            <ChevronLeft size={22} strokeWidth={1.5} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="glb-lb__nav glb-lb__nav--next"
            onClick={(e) => {
              e.stopPropagation()
              go(1)
            }}
            aria-label="Nächstes Foto"
          >
            <ChevronRight size={22} strokeWidth={1.5} aria-hidden="true" />
          </button>
        </>
      )}
      <button type="button" className="glb-lb__close" onClick={onClose} aria-label="Schließen">
        <X size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </div>,
    document.body,
  )
}
