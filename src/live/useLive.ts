import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { fetchLive } from './api'
import type { LiveData } from './model'

// ─────────────────────────────────────────────────────────────
// v15-L: Polling von web_live().
//   · Intervall hängt vom Stand ab (live/halbzeit kurz, sonst lang)
//   · pausiert, solange der Tab versteckt ist; beim Zurückkehren sofort neu
//   · Uhr-Versatz Gerät ↔ Server, damit die Minute auch bei falsch gehender
//     Handy-Uhr stimmt
// ─────────────────────────────────────────────────────────────

export interface LiveState {
  data: LiveData | null
  error: string | null
  loading: boolean
  /** Server-Zeit minus Gerätezeit (ms) */
  offset: number
  /** Zeitpunkt des letzten ERFOLGREICHEN Abrufs (ms) oder null. */
  letzteAktualisierung: number | null
  /** Zeitpunkt des letzten Versuchs (ms) — auch bei Fehlern gesetzt. */
  letzterVersuch: number | null
  refresh: () => void
}

// v19-S: Retry mit Backoff nach Fehlern (statt 5-min-Intervall), damit die
// Seite am Spieltag schnell wieder hochkommt. 3 → 6 → 12 → 24 → 48 → 60 s.
function backoffMs(fails: number): number {
  return Math.min(3000 * 2 ** (fails - 1), 60_000)
}

export function useLive(intervall: (d: LiveData | null) => number, enabled = true, demo = false): LiveState {
  const [data, setData] = useState<LiveData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [offset, setOffset] = useState(0)
  const [letzte, setLetzte] = useState<number | null>(null)
  const [versuch, setVersuch] = useState<number | null>(null)
  const timer = useRef<number | null>(null)
  const dataRef = useRef<LiveData | null>(null)
  const failsRef = useRef(0)
  const intervallRef = useRef(intervall)
  useLayoutEffect(() => {
    intervallRef.current = intervall
  })
  const tickRef = useRef<() => void>(() => {})

  const planen = useCallback(() => {
    if (timer.current) window.clearTimeout(timer.current)
    timer.current = null
    if (document.visibilityState === 'hidden') return
    const wartezeit = failsRef.current > 0 ? backoffMs(failsRef.current) : intervallRef.current(dataRef.current)
    timer.current = window.setTimeout(() => tickRef.current(), wartezeit)
  }, [])

  const tick = useCallback(async () => {
    const ctrl = new AbortController()
    const t = window.setTimeout(() => ctrl.abort(), 10_000)
    try {
      const d = await fetchLive(ctrl.signal, demo)
      dataRef.current = d
      failsRef.current = 0
      setData(d)
      setError(null)
      setOffset(new Date(d.serverNow).getTime() - Date.now())
      setLetzte(Date.now())
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) failsRef.current += 1
      setError(e instanceof Error && e.name !== 'AbortError' ? e.message : 'Keine Verbindung')
    } finally {
      window.clearTimeout(t)
      setLoading(false)
      setVersuch(Date.now())
      planen()
    }
  }, [planen, demo])
  useLayoutEffect(() => {
    tickRef.current = () => void tick()
  }, [tick])

  useEffect(() => {
    if (!enabled) return
    void tick()
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick()
      else if (timer.current) {
        window.clearTimeout(timer.current)
        timer.current = null
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      if (timer.current) window.clearTimeout(timer.current)
    }
  }, [enabled, tick])

  return { data, error, loading, offset, letzteAktualisierung: letzte, letzterVersuch: versuch, refresh: () => void tick() }
}

/** Sekundentakt (bzw. gröber) für Countdown/Minute — respektiert versteckte Tabs. */
export function useNow(stepMs = 1000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState !== 'hidden') setNow(Date.now())
    }, stepMs)
    return () => window.clearInterval(t)
  }, [stepMs])
  return now
}
