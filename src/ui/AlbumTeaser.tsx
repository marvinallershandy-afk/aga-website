import { ArrowRight } from 'lucide-react'
import { ALBUM_LINK } from '../data/club'
import './album-teaser.css'

// ─────────────────────────────────────────────────────────────
// v18-P: ruhiger Zugang zum Sammelalbum (/album) — ein Satz Nutzen + CTA.
// Kein Popup, kein Zähler, keine Animation. Varianten:
//   karte    — Startseite (Karte), unten links, nach dem Intro
//   panel    — Orts-Panels (Fans, Vereinsheim)
//   rundgang — Fans-Station im Rundgang
// Bewusst ohne Store/three → auch in /live nutzbar.
// ─────────────────────────────────────────────────────────────

export function AlbumTeaser({ variante = 'panel' }: { variante?: 'karte' | 'panel' | 'rundgang' }) {
  if (variante === 'karte') {
    return (
      <a className="alb-t alb-t--karte" href={ALBUM_LINK.href}>
        <img src={ALBUM_LINK.bild} alt="" width="72" height="56" loading="lazy" decoding="async" />
        <span className="alb-t__text">
          <b>{ALBUM_LINK.titel}</b>
          <small>{ALBUM_LINK.kurzNutzen}</small>
        </span>
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </a>
    )
  }
  return (
    <a className={`alb-t alb-t--${variante}`} href={ALBUM_LINK.href}>
      <img src={ALBUM_LINK.bild} alt="" width="108" height="84" loading="lazy" decoding="async" />
      <span className="alb-t__text">
        <span className="alb-t__kicker">Sammelalbum</span>
        <b>{ALBUM_LINK.titel}</b>
        <small>{ALBUM_LINK.nutzen}</small>
        <span className="alb-t__cta">
          {ALBUM_LINK.cta} <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </span>
    </a>
  )
}
