import { useEffect, useRef, useState } from 'react'
import type { Karte } from './api'
import { Sticker } from './Sticker'
import { SELTEN_LABEL, name, type Platz } from './model'

// ─────────────────────────────────────────────────────────────
// v17-A: Sticker-Detail. Groß, mit Walkout-Video falls hinterlegt (fällt
// bei Ladefehler sauber auf das Foto zurück). Bei Spielern alle
// Veredelungen (Kader/Silber/Gold/Glitzer) als Umschalter.
// ─────────────────────────────────────────────────────────────

interface Props {
  platz: Platz
  besitz: Map<string, number>
  onSchliessen: () => void
}

export function KarteDetail({ platz, besitz, onSchliessen }: Props) {
  const [aktiv, setAktiv] = useState<Karte>(platz.beste ?? platz.versionen[0])
  const ref = useRef<HTMLDivElement>(null)
  const n = besitz.get(aktiv.id) ?? 0

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen()
    window.addEventListener('keydown', esc)
    ref.current?.focus()
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', esc)
    }
  }, [onSchliessen])

  const s = aktiv.spieler
  return (
    <div className="al-detail" role="dialog" aria-modal="true" aria-label={name(aktiv)} onClick={onSchliessen}>
      <div className="al-detail__panel" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="al-x" onClick={onSchliessen} aria-label="Schließen">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
        </button>
        <div className="al-detail__karte">
          {n > 0 ? (
            <Sticker key={aktiv.id} karte={aktiv} walkout />
          ) : (
            <div className="hf-leer hf-leer--gross" aria-label="Noch nicht eingeklebt" role="img">
              <span className="hf-leer__nr">{platz.nr}</span>
            </div>
          )}
        </div>
        <div className="al-detail__info">
          <p className="al-kicker">
            Nr. {platz.nr}
            {s?.nummer != null && aktiv.typ === 'spieler' ? ` · Trikot ${s.nummer}` : ''}
            {aktiv.untertitel ? ` · ${aktiv.untertitel}` : ''}
          </p>
          <h2 className="al-h2">{name(aktiv)}</h2>
          {n > 0 ? (
            <p className="al-lead">
              {n === 1 ? 'Eingeklebt.' : `Eingeklebt — und ${n - 1}× doppelt zum Tauschen.`}
              {aktiv.partner?.url && (
                <>
                  {' '}
                  <a href={aktiv.partner.url} target="_blank" rel="noopener noreferrer">
                    Zu {aktiv.partner.name}
                  </a>
                </>
              )}
            </p>
          ) : (
            <p className="al-lead">Fehlt noch. Beim nächsten Heimspiel einchecken — vielleicht steckt der Sticker im Tütchen.</p>
          )}
          {platz.versionen.length > 1 && (
            <div className="al-versionen" role="group" aria-label="Veredelungen">
              {platz.versionen.map((v) => {
                const m = besitz.get(v.id) ?? 0
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`al-chip al-chip--${v.seltenheit}${v.id === aktiv.id ? ' is-aktiv' : ''}${m === 0 ? ' is-fehlt' : ''}`}
                    aria-pressed={v.id === aktiv.id}
                    onClick={() => setAktiv(v)}
                  >
                    {SELTEN_LABEL[v.seltenheit]}
                    {m > 0 ? ` ×${m}` : ' · fehlt'}
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
