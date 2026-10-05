// ─────────────────────────────────────────────────────────────
// v16-K: Poster-Standbilder der Karten-Totale (public/map/poster-*.webp)
// und die dazu passenden Marker-Positionen (Anteil 0..1 der Bildfläche).
// Kamera-Zahlen = Quelle der Wahrheit für die Live-Totale (mapCamera.ts).
// AUTO-GENERIERT von scripts/map-poster.mjs — nicht von Hand pflegen.
// ─────────────────────────────────────────────────────────────

import type { PlaceId } from './places'

export interface PosterClass {
  aspect: number
  src: string
  cam: { pos: [number, number, number]; look: [number, number, number]; fov: number }
  markers: Record<PlaceId, [number, number]>
}

export const MAP_POSTER: Record<'wide' | 'tall', PosterClass> = {
  wide: {
    aspect: 16 / 9,
    src: '/map/poster-wide.webp',
    cam: { pos: [4.6, 21.5, 21.2], look: [1.5, 0, 0.9], fov: 30 },
    markers: {
      spieltag: [0.6702, 0.4398],
      training: [0.1579, 0.5381],
      mannschaft: [0.4038, 0.4088],
      fans: [0.5593, 0.6849],
      musik: [0.7207, 0.328],
      partner: [0.3437, 0.6103],
      anfahrt: [0.7886, 0.684],
    },
  },
  tall: {
    aspect: 9 / 19.5,
    src: '/map/poster-tall.webp',
    cam: { pos: [-27.5, 36.5, 7.1], look: [2.2, 0, 0.6], fov: 34 },
    markers: {
      spieltag: [0.494, 0.3795],
      training: [0.5556, 0.8059],
      mannschaft: [0.3443, 0.5926],
      fans: [0.8213, 0.4771],
      musik: [0.3328, 0.3303],
      partner: [0.6954, 0.6365],
      anfahrt: [0.8079, 0.3398],
    },
  },
}
