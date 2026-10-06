import { useEffect, useMemo, useRef, useState } from 'react'
import { EMOJI_ZEICHEN, REAKTION_EMOJIS } from './model'
import { summeGesamt } from './reaktionenApi'
import type { ReaktionenNabe } from './useReaktionen'

// ─────────────────────────────────────────────────────────────
// v23-U: „Mitjubeln"-Komponenten (Leiste, Gast-Sheet, Jubel-Flug). Logik/State
// im Hook useReaktionen.ts. Kein Supabase-SDK (siehe reaktionenApi.ts).
// ─────────────────────────────────────────────────────────────

const REDUCE = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

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

/** Sheet für Gäste: „Mit deinem Album-Konto mitjubeln". */
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
