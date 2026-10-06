import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  EMOJI_ZEICHEN,
  REAKTION_EMOJIS,
  type LiveData,
  type ReaktionEmoji,
  type ReactionSummen,
} from './model'
import { albumToken, mitEigener, meineReaktionen, reagieren, summeGesamt, ReaktionFehler } from './reaktionenApi'

// ─────────────────────────────────────────────────────────────
// v23-U: „Mitjubeln“ — 5 Emojis an Tor/Karte/Abpfiff. Angemeldete Fans (Token
// aus dem Album-Login) reagieren per fetch auf sva_reagieren; Gäste sehen die
// Summen und einen Hinweis „Mit Album-Konto mitjubeln“. Vorführung: lokal
// simuliert, kein Netz. Kein Supabase-SDK (siehe reaktionen.ts).
// ─────────────────────────────────────────────────────────────

const REDUCE = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

  // Token bei Sichtbarkeit aktualisieren (Login kann in anderem Tab passiert sein).
  useEffect(() => {
    if (demo) return
    const auf = () => document.visibilityState === 'visible' && setToken(albumToken())
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

  // Neue Server-Summen → optimistische Deltas verwerfen (Reconcile).
  useEffect(() => {
    if (!demo) setDelta(new Map())
  }, [server, demo])

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
      // optimistisch
      setMeine((m) => {
        const n = new Map(m)
        n.set(id, neu)
        return n
      })
      setDelta((m) => {
        const n = new Map(m)
        n.set(id, { alt, neu })
        return n
      })
      if (demo) return
      void reagieren(id, neu, token!)
        .then(() => {
          // kein harter Reconcile nötig — der nächste web_live-Abruf zieht nach
        })
        .catch((e) => {
          // zurückrollen
          setMeine((m) => {
            const n = new Map(m)
            n.set(id, alt)
            return n
          })
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

/** Reaktions-Leiste an einem Ereignis. */
export function ReaktionenLeiste({ id, nabe }: { id: string; nabe: ReaktionenNabe }) {
  const summen = nabe.summen(id)
  const meine = nabe.meine(id)
  const gesamt = summeGesamt(summen)
  return (
    <div className={`lv-reakt${nabe.gast ? ' lv-reakt--gast' : ''}`} role="group" aria-label="Mitjubeln">
      {REAKTION_EMOJIS.map((e) => {
        const n = summen[e] ?? 0
        const aktiv = meine === e
        return (
          <button
            key={e}
            type="button"
            className={`lv-reakt__btn${aktiv ? ' is-aktiv' : ''}`}
            aria-pressed={aktiv}
            aria-label={`${e} (${n})`}
            onClick={() => nabe.toggle(id, e)}
          >
            <span className="lv-reakt__emoji" aria-hidden="true">
              {EMOJI_ZEICHEN[e]}
            </span>
            {n > 0 && <b className="lv-reakt__n">{n}</b>}
          </button>
        )
      })}
      {nabe.gast && gesamt > 0 && <span className="lv-reakt__gastzahl">{gesamt}</span>}
    </div>
  )
}

/** Sheet für Gäste: „Mit deinem Album-Konto mitjubeln“. */
export function MitjubelnSheet({ offen, onClose }: { offen: boolean; onClose: () => void }) {
  if (!offen) return null
  return (
    <div className="lv-sheet" role="dialog" aria-modal="true" aria-label="Mitjubeln" onClick={onClose}>
      <div className="lv-sheet__box" onClick={(e) => e.stopPropagation()}>
        <h3 className="lv-sheet__titel">Mit deinem Album-Konto mitjubeln</h3>
        <p className="lv-sheet__text">Reaktionen gehören zu deinem Sammelalbum-Konto. Einmal anmelden — dann jubelst du überall mit.</p>
        <div className="lv-sheet__aktionen">
          <a className="lv-btn" href="/album?next=/live">
            Zum Album-Konto
          </a>
          <button type="button" className="lv-btn lv-btn--ghost" onClick={onClose}>
            Später
          </button>
        </div>
      </div>
    </div>
  )
}

/** Kurzer Emoji-Flug beim SVA-Tor (6–8 ⚽/🔥 steigen auf). reduced-motion → aus. */
export function JubelFlug({ ausloeser }: { ausloeser: number }) {
  const [an, setAn] = useState(false)
  const ersterRef = useRef(true)
  useEffect(() => {
    if (ersterRef.current) {
      ersterRef.current = false
      return
    }
    if (REDUCE) return
    setAn(true)
    const t = window.setTimeout(() => setAn(false), 1300)
    return () => window.clearTimeout(t)
  }, [ausloeser])
  const teile = useMemo(() => Array.from({ length: 7 }, (_, i) => i), [])
  if (!an) return null
  return (
    <div className="lv-jubel" aria-hidden="true">
      {teile.map((i) => (
        <span key={i} style={{ left: `${8 + i * 12}%`, animationDelay: `${i * 70}ms` }}>
          {i % 2 ? '🔥' : '⚽'}
        </span>
      ))}
    </div>
  )
}
