import { useEffect, useRef } from 'react'
import { ladeLogo, type Logo } from './logo'
import { schriftenBereit, zeichneTafel } from './tafel'

// ─────────────────────────────────────────────────────────────
// v18-P: Ein Partner im DOM = seine Bandentafel. Dieselbe Zeichnung wie
// auf der 3D-Bande (getrimmt, Fläche normiert, Kontrast-Untergrund, Name
// neben reinen Bildzeichen) — Partner-Wand, „Schon dabei", Konfigurator.
// Canvas in fester Auflösung (2× der größten Anzeige), CSS skaliert.
// ─────────────────────────────────────────────────────────────

export const TAFEL_SEITE = 2.6

export function PartnerTafel({
  name,
  logoUrl,
  breite = 520,
  className,
}: {
  name: string
  logoUrl?: string
  /** interne Pixelbreite (Höhe = Breite / 2.6) */
  breite?: number
  className?: string
}) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const cv = ref.current
    if (!cv) return
    let aktiv = true
    const male = (logo: Logo | null) => {
      const ctx = cv.getContext('2d')
      if (!ctx || !aktiv) return
      ctx.clearRect(0, 0, cv.width, cv.height)
      zeichneTafel(ctx, 0, 0, cv.width, cv.height, { name, logo })
    }
    schriftenBereit().then(() => {
      if (!logoUrl) return male(null)
      ladeLogo(logoUrl)
        .then(male)
        .catch(() => male(null))
    })
    return () => {
      aktiv = false
    }
  }, [name, logoUrl])
  return (
    <canvas
      ref={ref}
      className={`ptafel${className ? ` ${className}` : ''}`}
      width={breite}
      height={Math.round(breite / TAFEL_SEITE)}
      role="img"
      aria-label={name}
    />
  )
}
