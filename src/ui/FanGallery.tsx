import { motion } from 'framer-motion'
import { FAN_PHOTOS } from '../data/club'
import { useStore } from '../store/useStore'

// ─────────────────────────────────────────────────────────────
// v-website-polish: DOM-Kacheln der Fanblock-Fotos. Sie sind der zuverlässige
// (mobil gut tippbare) Zugang zu Neles echten Fotos — dieselbe Lightbox öffnen
// die 3D-Schilder in der Kurve. Beide Wege setzen `fanPhoto` im Store; die
// Lightbox selbst lebt am App-Root (FanLightbox). Nur Fotos mit echtem `src`.
// ─────────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.25 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

// Index in FAN_PHOTOS beibehalten (Lightbox/Schilder referenzieren ihn).
const PHOTOS = FAN_PHOTOS.map((p, i) => ({ ...p, i })).filter((p) => !!p.src)

export function FanGallery() {
  const setFanPhoto = useStore((s) => s.setFanPhoto)

  if (PHOTOS.length === 0) return null

  return (
    <motion.div className="fan-gallery" {...reveal}>
      {PHOTOS.map((p) => (
        <button
          key={p.i}
          className="fan-tile"
          onClick={() => setFanPhoto(p.i)}
          aria-label={`${p.tag}: ${p.caption} — Foto vergrößern`}
        >
          <img src={p.src} alt={p.caption} loading="lazy" />
          <span className="fan-tile__frame">
            <span className="fan-tile__tag">{p.tag}</span>
            <span className="fan-tile__cap">{p.caption}</span>
          </span>
        </button>
      ))}
    </motion.div>
  )
}
