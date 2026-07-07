import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FAN_PHOTOS } from '../data/club'

// ─────────────────────────────────────────────────────────────
// v11-E7: Meisterfeier-Foto-Kacheln im Fanblock + Lightbox-Zoom.
// Jede Kachel ist gerahmt („Meister 2024" / „Das letzte Tor" …).
// Echte Fotos trägt Marvin nach (FAN_PHOTOS[].src); leer → gestaltete
// „Foto folgt"-Kachel, damit die Galerie schon jetzt vollständig wirkt.
// ─────────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

export function FanGallery() {
  const [open, setOpen] = useState<number | null>(null)
  const has = (i: number) => !!FAN_PHOTOS[i]?.src

  const close = useCallback(() => setOpen(null), [])
  const step = useCallback((d: number) => {
    setOpen((v) => (v === null ? v : (v + d + FAN_PHOTOS.length) % FAN_PHOTOS.length))
  }, [])

  useEffect(() => {
    if (open === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, close, step])

  return (
    <>
      <motion.div className="fan-gallery" {...reveal}>
        {FAN_PHOTOS.map((p, i) => (
          <button
            key={i}
            className={`fan-tile${p.src ? '' : ' fan-tile--empty'}`}
            onClick={() => has(i) && setOpen(i)}
            aria-label={p.src ? `${p.tag}: ${p.caption} — vergrößern` : `${p.tag} — Foto folgt`}
          >
            {p.src ? (
              <img src={p.src} alt={p.caption} loading="lazy" />
            ) : (
              <span className="fan-tile__ph">Foto folgt</span>
            )}
            <span className="fan-tile__frame">
              <span className="fan-tile__tag">{p.tag}</span>
              <span className="fan-tile__cap">{p.caption}</span>
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence>
        {open !== null && FAN_PHOTOS[open]?.src && (
          <motion.div
            className="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={close}
          >
            <button className="lightbox__nav lightbox__nav--prev" onClick={(e) => { e.stopPropagation(); step(-1) }} aria-label="Zurück">‹</button>
            <motion.figure
              className="lightbox__fig"
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.94, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <img src={FAN_PHOTOS[open].src} alt={FAN_PHOTOS[open].caption} />
              <figcaption>
                <b>{FAN_PHOTOS[open].tag}</b> · {FAN_PHOTOS[open].caption}
              </figcaption>
            </motion.figure>
            <button className="lightbox__nav lightbox__nav--next" onClick={(e) => { e.stopPropagation(); step(1) }} aria-label="Weiter">›</button>
            <button className="lightbox__close" onClick={close} aria-label="Schließen">×</button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
