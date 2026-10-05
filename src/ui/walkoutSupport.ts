import { useState } from 'react'
import { WALKOUT } from '../data/walkout'

// v16-W: Helfer der Walkout-Videos (eigene Datei wegen Fast Refresh).

let hevcFirst: boolean | null = null
/** WebKit (Safari, alle iOS-Browser) kann HEVC mit Alpha, aber kein VP9-Alpha. */
export function prefersHevcAlpha(): boolean {
  if (hevcFirst != null) return hevcFirst
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  const desktopSafari = /Macintosh/.test(ua) && /Safari\//.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua)
  hevcFirst = ios || desktopSafari
  return hevcFirst
}

/** Hat die id ein Walkout? Nach einem Ladefehler (fail) fällt die Karte aufs Foto zurück. */
export function useWalkout(id: string) {
  const [failed, setFailed] = useState(false)
  return { has: !!WALKOUT[id] && !failed, fail: () => setFailed(true) }
}
