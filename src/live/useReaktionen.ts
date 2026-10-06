import { useCallback, useEffect, useRef, useState } from 'react'
import { REAKTION_EMOJIS, type LiveData, type ReaktionEmoji, type ReactionSummen } from './model'
import { albumToken, meineReaktionen, mitEigener, reagieren, ReaktionFehler } from './reaktionenApi'

// ─────────────────────────────────────────────────────────────
// v23-U: Zustand/Logik des Mitjubelns (getrennt von den Komponenten in
// Reaktionen.tsx, damit Fast-Refresh sauber bleibt). Kein Supabase-SDK.
// ─────────────────────────────────────────────────────────────

/** Deterministische Start-Summen für die Vorführung (wachsende Zähler). */
function demoSeed(id: string): Partial<Record<ReaktionEmoji, number>> {
  let h = 0
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0
  const s: Partial<Record<ReaktionEmoji, number>> = {}
  REAKTION_EMOJIS.forEach((e, i) => {
    const n = (h >> (i * 3)) % 9
    if (n > 0) s[e] = n
  })
  return s
}

export interface ReaktionenNabe {
  aktiv: boolean
  gast: boolean
  summen: (id: string) => Partial<Record<ReaktionEmoji, number>>
  meine: (id: string) => ReaktionEmoji | null
  toggle: (id: string, emoji: ReaktionEmoji) => void
  loginOffen: boolean
  schliesseLogin: () => void
  fehler: string | null
}

export function useReaktionen(d: LiveData | null, demo: boolean): ReaktionenNabe {
  const server: ReactionSummen | null | undefined = d?.reactions
  const spielId = d?.match?.id ?? null
  // reaktionen_an: im Echtbetrieb liefert web_live `reactions` (auch {} wenn an,
  // aber null bei aus). In der Vorführung immer an.
  const aktiv = demo || server !== undefined
  const [token, setToken] = useState<string | null>(() => (demo ? null : albumToken()))
  const gast = !demo && !token
  const [meineMap, setMeine] = useState<Map<string, ReaktionEmoji | null>>(new Map())
  const [delta, setDelta] = useState<Map<string, { alt: ReaktionEmoji | null; neu: ReaktionEmoji | null }>>(new Map())
  const [loginOffen, setLoginOffen] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const seedRef = useRef(new Map<string, Partial<Record<ReaktionEmoji, number>>>())

  // Reconcile: beim Eintreffen neuer Server-Summen die optimistischen Deltas
  // verwerfen (der nächste web_live-Abruf zählt die eigene Reaktion dann mit).
  useEffect(() => {
    if (!demo) setDelta(new Map())
  }, [server, demo])

  // Token bei Sichtbarkeit aktualisieren (Login kann in anderem Tab passiert sein).
  useEffect(() => {
    if (demo) return
    const auf = () => {
      if (document.visibilityState === 'visible') setToken(albumToken())
    }
    document.addEventListener('visibilitychange', auf)
    return () => document.removeEventListener('visibilitychange', auf)
  }, [demo])

  // Meine gesetzten Reaktionen laden (einmal pro Spiel/Token).
  useEffect(() => {
    if (demo || !token || !spielId) return
    let weg = false
    void meineReaktionen(spielId, token).then((m) => {
      if (!weg) setMeine(new Map(m))
    })
    return () => {
      weg = true
    }
  }, [demo, token, spielId])

  const summen = useCallback(
    (id: string): Partial<Record<ReaktionEmoji, number>> => {
      let basis: Partial<Record<ReaktionEmoji, number>>
      if (demo) {
        if (!seedRef.current.has(id)) seedRef.current.set(id, demoSeed(id))
        basis = seedRef.current.get(id)!
      } else {
        basis = server?.[id] ?? {}
      }
      const dd = delta.get(id)
      return dd ? mitEigener({ [id]: basis }, id, dd.alt, dd.neu) : { ...basis }
    },
    [demo, server, delta],
  )

  const meine = useCallback((id: string) => meineMap.get(id) ?? null, [meineMap])

  const toggle = useCallback(
    (id: string, emoji: ReaktionEmoji) => {
      setFehler(null)
      if (gast) {
        setLoginOffen(true)
        return
      }
      const alt = meineMap.get(id) ?? null
      const neu = alt === emoji ? null : emoji
      setMeine((m) => new Map(m).set(id, neu))
      setDelta((m) => new Map(m).set(id, { alt, neu }))
      if (demo) return
      void reagieren(id, neu, token!)
        .then(() => {
          // kein harter Reconcile nötig — der nächste web_live-Abruf zieht nach
        })
        .catch((e) => {
          setMeine((m) => new Map(m).set(id, alt))
          setDelta((m) => {
            const n = new Map(m)
            n.delete(id)
            return n
          })
          setFehler(e instanceof ReaktionFehler ? e.message : 'Das hat gerade nicht geklappt.')
          window.setTimeout(() => setFehler(null), 3200)
        })
    },
    [gast, demo, token, meineMap],
  )

  return { aktiv, gast, summen, meine, toggle, loginOffen, schliesseLogin: () => setLoginOffen(false), fehler }
}
