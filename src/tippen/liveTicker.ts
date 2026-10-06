import { useEffect, useState } from 'react'
import { fetchLive, liveKonfiguriert } from '../live/api'
import type { LiveData } from '../live/model'

// ─────────────────────────────────────────────────────────────
// v22-T: Während ein echtes Spiel läuft, holt /tippen alle 20 s den
// öffentlichen Live-Ticker (web_live, reines fetch — dieselbe Quelle wie
// /live): laufende Minute, aktueller Spielstand und Torschützen für die
// Live-Leiste und die TOR!-Einblendung. Versteckter Tab pausiert.
// ─────────────────────────────────────────────────────────────

const TAKT = 20_000

export function useLiveTicker(aktiv: boolean): LiveData | null {
  const [d, setD] = useState<LiveData | null>(null)
  useEffect(() => {
    if (!aktiv || !liveKonfiguriert) return
    let weg = false
    let t = 0
    const holen = async () => {
      window.clearTimeout(t)
      if (document.visibilityState === 'visible') {
        try {
          const x = await fetchLive()
          if (!weg) setD(x)
        } catch {
          /* nächster Versuch */
        }
      }
      if (!weg) t = window.setTimeout(() => void holen(), TAKT)
    }
    void holen()
    const sicht = () => document.visibilityState === 'visible' && void holen()
    document.addEventListener('visibilitychange', sicht)
    return () => {
      weg = true
      window.clearTimeout(t)
      document.removeEventListener('visibilitychange', sicht)
    }
  }, [aktiv])
  return aktiv ? d : null
}
