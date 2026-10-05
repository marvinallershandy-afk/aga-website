// v17-D: scharfe Freisteller für die DOM-Karten (Galerie, Modal, Story).
// public/players/cutout/hd/*.webp = 960×1440 aus den Print-Originalen
// (Kanten entfärbt, kein Grünsaum). Die 640er unter cutout/ bleiben für
// kleine Gesichter (Taktik-Board), die 3D-Kartentextur und /live.
// Freisteller aus dem Admin (public/generated/…) haben keine HD-Fassung.
export function hdCutout<T extends string | null | undefined>(url: T): T {
  if (!url) return url
  return url.replace(/\/players\/cutout\/([^/?#]+\.webp)/, '/players/cutout/hd/$1') as T
}
