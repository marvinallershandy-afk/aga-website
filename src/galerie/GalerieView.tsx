import { useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { coverOf, galerieDatum, type Galerie } from '../data/galerie'
import { NELE } from '../data/club'
import { GalerieLightbox } from './GalerieLightbox'
import './galerie.css'

// ─────────────────────────────────────────────────────────────
// v17-D „Spieltag in Bildern“: Foto-Raster einer Galerie + Vollbild-
// Lightbox. Zwei Bauformen:
//   panel — im Fans-Panel der Karte (Titelbild randlos, darunter 2 Spalten)
//   page  — auf /galerie (großes Raster, Hoch-/Querformate gemischt)
// Bilder: 800-px-Vorschau im Raster, 2000 px erst in der Lightbox.
// Fotografie trägt: keine Rahmen, keine Schatten, Hover = 3 % Zoom.
// ─────────────────────────────────────────────────────────────

export function NeleCredit({ className = '' }: { className?: string }) {
  return (
    <p className={`ds-credit ${className}`}>
      Fotos:{' '}
      <a href={NELE.instagramUrl} target="_blank" rel="noreferrer">
        {NELE.name}
      </a>{' '}
      · {NELE.rolle}
    </p>
  )
}

export function GalerieView({ galerie, variant, moreHref }: { galerie: Galerie; variant: 'panel' | 'page'; moreHref?: string }) {
  const [open, setOpen] = useState<number | null>(null)
  const cover = coverOf(galerie)
  // Titelbild zuerst, dann die übrigen in gepflegter Reihenfolge
  const ordered = [cover, ...galerie.bilder.filter((b) => b !== cover)]
  const datum = galerieDatum(galerie)

  return (
    <section className={`glb glb--${variant}`} aria-label={`Galerie: ${galerie.titel}`}>
      {variant === 'panel' && (
        <header className="glb__head">
          <span className="ds-label ds-label--red">Spieltag in Bildern</span>
          <h3 className="glb__title">{galerie.titel}</h3>
          <p className="glb__meta">
            {datum && <>{datum} · </>}
            {galerie.bilder.length} Fotos
          </p>
        </header>
      )}
      <div className="glb__grid">
        {ordered.map((b, i) => (
          <button
            key={b.src}
            type="button"
            className={`glb__tile${b.w < b.h ? ' is-tall' : ''}${i === 0 ? ' is-cover' : ''}`}
            onClick={() => setOpen(i)}
            aria-label={`${b.alt} — Foto ${i + 1} von ${ordered.length} vergrößern`}
          >
            <img
              src={b.preview}
              alt={b.alt}
              width={b.w}
              height={b.h}
              loading={i < 3 ? 'eager' : 'lazy'}
              decoding="async"
            />
          </button>
        ))}
      </div>
      <div className="glb__foot">
        <NeleCredit />
        {moreHref && (
          <a className="glb__more" href={moreHref}>
            Alle Galerien
            <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
          </a>
        )}
      </div>
      {open !== null && (
        <GalerieLightbox galerie={galerie} bilder={ordered} index={open} onIndex={setOpen} onClose={() => setOpen(null)} />
      )}
    </section>
  )
}
