// ─────────────────────────────────────────────────────────────
// v18-A: reine Hilfen der Zählung (Node-Test: quelle.test.mjs).
// Feste Listen = supabase/migrations/20261009100000_sva_statistik.sql.
// ─────────────────────────────────────────────────────────────

export const ORTE = ['rundgang', 'spieltag', 'training', 'mannschaft', 'fans', 'musik', 'partner', 'anfahrt']
export const SEITEN = ['live', 'partner', 'album', 'galerie', 'impressum', 'datenschutz']
export const QUELLEN = ['instagram', 'facebook', 'google', 'whatsapp', 'qr', 'direkt', 'intern', 'sonstige']
export const MEDIEN = ['bio', 'story', 'post', 'reel', 'platz', 'plakat', 'flyer', 'status', 'gruppe']

export function istBotUa(ua: string): boolean {
  return /bot|crawl|spider|slurp|headless|lighthouse|prerender/i.test(ua)
}

/** Seite/Ort als feste Pfad-Kennung (nie die volle URL). */
export function pfadAusAdresse(pathname: string, hash: string): string {
  const seg = pathname.replace(/\.html$/, '').replace(/^\/+|\/+$/g, '').toLowerCase()
  if (seg && SEITEN.includes(seg)) return `/${seg}`
  const h = hash.replace(/^#/, '').toLowerCase()
  if (ORTE.includes(h)) return `/#${h}`
  if (h === 'tour') return '/#rundgang'
  if (ORTE.includes(seg)) return `/#${seg}`
  return '/'
}

function wort(v: string | null): string {
  return (v || '').toLowerCase().trim().replace(/[^a-z0-9-]/g, '').slice(0, 20)
}

/** Herkunft: utm_source/utm_medium, sonst grob aus dem Referrer. */
export function quelleErmitteln(search: string, referrer: string, eigenerHost: string, ua: string): string {
  const p = new URLSearchParams(search)
  const src = wort(p.get('utm_source'))
  const med = wort(p.get('utm_medium'))
  if (src) {
    const s =
      src === 'ig' || src.startsWith('insta') ? 'instagram'
        : src === 'fb' || src.startsWith('face') ? 'facebook'
          : src === 'wa' || src.startsWith('whats') ? 'whatsapp'
            : QUELLEN.includes(src) ? src : 'sonstige'
    return MEDIEN.includes(med) ? `${s}:${med}` : s
  }
  if (referrer) {
    let host: string
    try {
      host = new URL(referrer).hostname.toLowerCase()
    } catch {
      host = referrer.toLowerCase()
    }
    if (host && eigenerHost && host === eigenerHost.split(':')[0].toLowerCase()) return 'intern'
    if (host.includes('instagram')) return 'instagram'
    if (host.includes('facebook') || host === 'fb.me' || host.endsWith('.fb.com')) return 'facebook'
    if (/(^|\.)google\./.test(host) || host.includes('googlequicksearchbox')) return 'google'
    if (host.includes('whatsapp') || host === 'wa.me') return 'whatsapp'
    if (host) return 'sonstige'
  }
  // In-App-Browser schicken oft keinen Referrer — grob am UA erkennen
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook'
  return 'direkt'
}
