// ─────────────────────────────────────────────────────────────
// v20-K: Holo-Neigung per Gyro (Handy). Ein globaler Listener schreibt
// --gyroX/--gyroY (Grad) und --gyroMx/--gyroMy (−0.5…0.5) an <html>;
// jede Karte addiert sie zu ihrer Zeiger-Neigung. iOS verlangt die
// Erlaubnis aus einer Nutzergeste → gyroAnfragen() nur im Tipp-Handler.
// Ruhelage driftet langsam mit (egal, wie das Handy gehalten wird).
// prefers-reduced-motion oder kein Touch → aus.
// ─────────────────────────────────────────────────────────────

type Zustand = 'idle' | 'an' | 'aus' | 'fragt'
let zustand: Zustand = 'idle'
const hoerer = new Set<(z: Zustand) => void>()
const setze = (z: Zustand) => {
  zustand = z
  hoerer.forEach((f) => f(z))
}

type DOE = { requestPermission?: () => Promise<string> }
const doe = (): DOE | undefined =>
  typeof window === 'undefined' ? undefined : (window as unknown as { DeviceOrientationEvent?: DOE }).DeviceOrientationEvent

/** Braucht dieses Gerät einen Tipp für die Erlaubnis (iOS 13+)? */
export function gyroBrauchtErlaubnis(): boolean {
  return zustand === 'idle' && typeof doe()?.requestPermission === 'function' && gyroSinnvoll()
}
export function gyroSinnvoll(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(pointer: coarse)').matches && !window.matchMedia('(prefers-reduced-motion: reduce)').matches && !!doe()
}
export const gyroZustand = () => zustand
export function gyroBeobachten(f: (z: Zustand) => void): () => void {
  hoerer.add(f)
  return () => {
    hoerer.delete(f)
  }
}

/** Aus einer Nutzergeste aufrufen (Tipp auf Karte / Knopf „Bewegen"). */
export function gyroAnfragen(): void {
  if (zustand !== 'idle') return
  if (!gyroSinnvoll()) {
    setze('aus')
    return
  }
  const D = doe()!
  if (typeof D.requestPermission === 'function') {
    setze('fragt')
    D.requestPermission()
      .then((r) => (r === 'granted' ? starte() : setze('aus')))
      .catch(() => setze('aus'))
  } else {
    starte()
  }
}

/** Aktuelle Neigung in Grad (x = vor/zurück, y = seitlich). */
export const gyroWert = { x: 0, y: 0 }
const folger = new Set<() => void>()
/** Pro Frame (nur bei Änderung) aufgerufen — die Karte schreibt ihre
 *  eigenen CSS-Variablen (kein Stil-Neuaufbau des ganzen Dokuments). */
export function gyroFolgen(f: () => void) {
  folger.add(f)
  return () => folger.delete(f)
}

function starte() {
  setze('an')
  let b0: number | null = null
  let g0: number | null = null
  let raf = 0
  window.addEventListener(
    'deviceorientation',
    (e) => {
      if (e.beta == null || e.gamma == null) return
      b0 = b0 == null ? e.beta : b0 + (e.beta - b0) * 0.02
      g0 = g0 == null ? e.gamma : g0 + (e.gamma - g0) * 0.02
      gyroWert.x = Math.max(-12, Math.min(12, (b0 - e.beta) * 0.55))
      gyroWert.y = Math.max(-14, Math.min(14, (e.gamma - g0) * 0.65))
      if (!raf && folger.size) {
        raf = requestAnimationFrame(() => {
          raf = 0
          folger.forEach((f) => f())
        })
      }
    },
    { passive: true },
  )
}
