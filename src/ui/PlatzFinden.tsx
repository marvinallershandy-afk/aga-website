import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { CONTACT } from '../data/club'

// ─────────────────────────────────────────────────────────────
// „Platz finden" (v6-E4) — Nordstern-Feature: Fans/Spieler/Sponsoren
// finden den echten Ort. Stilisierte Mini-Karte (SVG, kein externer
// Tile-Dienst → CSP-sicher, offline) mit Marker auf dem Waldsportplatz
// + plattform-bewusster Route-Button:
//   iOS  → Apple Karten (maps.apple.com, dirflg=d)
//   sonst→ Google Maps (dir/?api=1)
// URL erst nach Hydration (kein Prerender-Mismatch, kein Device-Bake).
// ─────────────────────────────────────────────────────────────

function routeUrl(apple: boolean): string {
  const dest = encodeURIComponent(CONTACT.mapsQuery)
  return apple
    ? `https://maps.apple.com/?daddr=${dest}&dirflg=d`
    : `https://www.google.com/maps/dir/?api=1&destination=${dest}`
}

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, amount: 0.4 },
  transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as const },
}

export function PlatzFinden() {
  // Default Google (SSR/Prerender); nach Mount ggf. auf Apple wechseln.
  const [apple, setApple] = useState(false)
  useEffect(() => {
    const ua = navigator.userAgent
    const iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    // Bewusst: Client-only-Erkennung NACH Prerender (Hydration-sicher) —
    // deshalb setState im Effect statt beim ersten Render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setApple(iOS)
  }, [])

  return (
    <motion.div className="platz-finden" {...reveal}>
      <div className="platz-finden__map" aria-hidden="true">
        <svg viewBox="0 0 320 180" width="100%" height="100%" role="img" aria-label="Lageplan Waldsportplatz">
          <rect x="0" y="0" width="320" height="180" fill="#12140f" />
          {/* Waldrand-Flächen (der Platz liegt am Wald) */}
          <path d="M0 0 H320 V54 C250 60 190 40 120 52 C70 60 30 48 0 58 Z" fill="#16241a" />
          <path d="M0 180 H320 V150 C240 140 180 162 110 150 C60 142 26 156 0 148 Z" fill="#16241a" />
          {/* Straße „Zur Mehrzweckhalle" */}
          <path d="M-10 120 C90 118 120 96 200 92 C250 90 300 96 330 92" stroke="#3a3d42" strokeWidth="9" fill="none" />
          <path d="M-10 120 C90 118 120 96 200 92 C250 90 300 96 330 92" stroke="#5a5e66" strokeWidth="1.4" strokeDasharray="7 7" fill="none" />
          {/* der Platz selbst */}
          <g transform="translate(150 96)">
            <rect x="-46" y="-26" width="92" height="52" rx="4" fill="#2f6a2a" stroke="#f2f5f8" strokeWidth="1.4" />
            <line x1="0" y1="-26" x2="0" y2="26" stroke="#f2f5f8" strokeWidth="1.1" />
            <circle cx="0" cy="0" r="9" fill="none" stroke="#f2f5f8" strokeWidth="1.1" />
            {/* Mähstreifen */}
            {[-34, -22, -10, 2, 14, 26, 38].map((x) => (
              <rect key={x} x={x} y="-26" width="6" height="52" fill="#000" opacity="0.06" />
            ))}
          </g>
          {/* Marker */}
          <g transform="translate(150 62)">
            <path d="M0 26 C-11 8 -12 -2 -12 -7 A12 12 0 1 1 12 -7 C12 -2 11 8 0 26 Z" fill="#E91D29" stroke="#14100f" strokeWidth="1.6" />
            <circle cx="0" cy="-7" r="4.4" fill="#14100f" />
          </g>
        </svg>
      </div>

      <div className="platz-finden__body">
        <h3>Wo wir kicken</h3>
        <p>{CONTACT.address}</p>
        <a
          className="btn btn--primary"
          href={routeUrl(apple)}
          target="_blank"
          rel="noreferrer"
          data-maps={apple ? 'apple' : 'google'}
        >
          Route öffnen →
        </a>
      </div>
    </motion.div>
  )
}
