import { useState, useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FAN_PHOTOS } from '../data/club'

// ─────────────────────────────────────────────────────────────
// v11-E7 / v12-E1: Meisterfeier-Foto-Kacheln im Fanblock + Lightbox.
// Jede Kachel ist gerahmt („Meister 2024" / „Das letzte Tor" …).
// v12-E1: KEINE „Foto folgt"-Platzhalterkacheln mehr — es werden NUR
// Kacheln mit echtem Foto (src) gerendert. Solange Marvin noch keine
// Bilder geliefert hat, bleibt die Galerie unsichtbar (kein leerer Rahmen,
// kein Platzhalter-Text). Sobald FAN_PHOTOS[].src gesetzt ist, erscheint
// die Kachel automatisch — anklickbar → Lightbox-Zoom.
// ─────────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

// Nur Fotos mit echtem Bild — Reihenfolge/Rahmung bleibt erhalten.
const PHOTOS = FAN_PHOTOS.filter((p) => !!p.src)

export function FanGallery() {
  const [open, setOpen] = useState<number | null>(null)

  const close = useCallback(() => setOpen(null), [])
  const step = useCallback((d: number) => {
    setOpen((v) => (v === null ? v : (v + d + PHOTOS.length) % PHOTOS.length))
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

  // Noch keine echten Fotos → Galerie bleibt komplett unsichtbar.
  if (PHOTOS.length === 0) return null

  return (
    <>
      <motion.div className="fan-gallery" {...reveal}>
        {PHOTOS.map((p, i) => (
          <button
            key={i}
            className="fan-tile"
            onClick={() => setOpen(i)}
            aria-label={`${p.tag}: ${p.caption} — vergrößern`}
          >
            <img src={p.src} alt={p.caption} loading="lazy" />
            <span className="fan-tile__frame">
              <span className="fan-tile__tag">{p.tag}</span>
              <span className="fan-tile__cap">{p.caption}</span>
            </span>
          </button>
        ))}
      </motion.div>

      <AnimatePresence>
        {open !== null && PHOTOS[open]?.src && (
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
              <img src={PHOTOS[open].src} alt={PHOTOS[open].caption} />
              <figcaption>
                <b>{PHOTOS[open].tag}</b> · {PHOTOS[open].caption}
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
