import { useEffect, useCallback } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FAN_PHOTOS } from '../data/club'
import { useStore } from '../store/useStore'

// ─────────────────────────────────────────────────────────────
// v-website-polish: gemeinsame Fanblock-Foto-Lightbox. Wird vom Store
// gesteuert (fanPhoto = Index in FAN_PHOTOS) und am App-Root gerendert —
// so kann sie sowohl von den 3D-Schildern im Fanblock (Canvas) als auch
// von den DOM-Kacheln (FanGallery) geöffnet werden. Nur Fotos mit `src`.
// Tastatur: Esc schließt, ← → blättern. Schließen-Button oben rechts.
// ─────────────────────────────────────────────────────────────

const PHOTOS = FAN_PHOTOS.filter((p) => !!p.src)

export function FanLightbox() {
  const openIdx = useStore((s) => s.fanPhoto)
  const setFanPhoto = useStore((s) => s.setFanPhoto)

  const close = useCallback(() => setFanPhoto(null), [setFanPhoto])
  const step = useCallback(
    (d: number) => {
      setFanPhoto(
        useStore.getState().fanPhoto === null
          ? null
          : (((useStore.getState().fanPhoto as number) + d) % PHOTOS.length + PHOTOS.length) % PHOTOS.length,
      )
    },
    [setFanPhoto],
  )

  useEffect(() => {
    if (openIdx === null) return
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
  }, [openIdx, close, step])

  const photo = openIdx === null ? null : PHOTOS[openIdx]

  return (
    <AnimatePresence>
      {photo?.src && (
        <motion.div
          className="lightbox"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <button
            className="lightbox__nav lightbox__nav--prev"
            onClick={(e) => { e.stopPropagation(); step(-1) }}
            aria-label="Vorheriges Foto"
          >
            ‹
          </button>
          <motion.figure
            className="lightbox__fig"
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <img src={photo.src} alt={photo.caption} />
            <figcaption>
              <b>{photo.tag}</b> · {photo.caption}
            </figcaption>
          </motion.figure>
          <button
            className="lightbox__nav lightbox__nav--next"
            onClick={(e) => { e.stopPropagation(); step(1) }}
            aria-label="Nächstes Foto"
          >
            ›
          </button>
          <button className="lightbox__close" onClick={close} aria-label="Schließen">×</button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
