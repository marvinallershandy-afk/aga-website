import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Ziel } from './api'
import { Medaille, ZielSymbol } from './Medaille'
import { lohnText, metallVon, useImBild, useKippen } from './medaille-logik'
import { ruhigeBewegung, vibriere } from '../karten/medien'
import './ziele.css'

// ─────────────────────────────────────────────────────────────
// v21-A: Sammelziele als Medaillen-Vitrine.
//   · „Geschafft“: Vitrine mit geprägten Medaillen (Metall nach Belohnung);
//     neu erreichte werden beim ersten Sehen „geprägt“ (Freischalt-Animation)
//   · „Als Nächstes“: offene Ziele mit Fortschrittsring, der sich beim
//     Hineinscrollen füllt; erst 6, dann alle
//   · Geheime Missionen: gesperrte Medaille
// Gesehene Erfolge merkt sich der Browser ('sva-album-ziele-gesehen').
// ─────────────────────────────────────────────────────────────

const GESEHEN_KEY = 'sva-album-ziele-gesehen'
const ERSTE = 6

function gesehenLesen(): Set<string> | null {
  try {
    const s = localStorage.getItem(GESEHEN_KEY)
    return s ? new Set(JSON.parse(s) as string[]) : null
  } catch {
    return new Set()
  }
}
function gesehenSchreiben(ids: string[]) {
  try {
    localStorage.setItem(GESEHEN_KEY, JSON.stringify(ids.slice(-200)))
  } catch {
    /* privat-Modus */
  }
}

const datum = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Berlin' }) : '')

function ZielKachel({ z, sichtbar, neu, index }: { z: Ziel; sichtbar: boolean; neu: boolean; index: number }) {
  const anteil = Math.min(z.fortschritt, z.benoetigt) / Math.max(1, z.benoetigt)
  const lohn = lohnText(z.belohnung)
  return (
    <li
      className={`zm-k${z.erreicht ? ' is-erreicht' : ''}${neu ? ' is-neu' : ''}`}
      data-kipp=""
      style={{ ['--i' as string]: index }}
      aria-label={`${z.titel}: ${z.erreicht ? 'geschafft' : `${Math.min(z.fortschritt, z.benoetigt)} von ${z.benoetigt}`}${lohn ? ` · Belohnung ${lohn}` : ''}`}
    >
      <Medaille metall={metallVon(z)} erreicht={z.erreicht} anteil={anteil} sichtbar={sichtbar} neu={neu}>
        <ZielSymbol z={z} />
      </Medaille>
      <b className="zm-k__titel">{z.titel}</b>
      {z.beschreibung && <small className="zm-k__text">{z.beschreibung}</small>}
      <span className="zm-k__fuss">
        {z.erreicht ? (
          <em className="zm-k__ok">{neu ? 'Neu freigeschaltet' : `Geschafft${z.erreichtAt ? ` · ${datum(z.erreichtAt)}` : ''}`}</em>
        ) : (
          <em className="zm-k__stand">
            <b>{Math.min(z.fortschritt, z.benoetigt)}</b>/{z.benoetigt}
          </em>
        )}
        {lohn && !z.erreicht && <span className="zm-k__lohn">{lohn}</span>}
      </span>
    </li>
  )
}

export function ZieleVitrine({ ziele }: { ziele: Ziel[] }) {
  const erreicht = useMemo(() => ziele.filter((z) => z.erreicht).sort((a, b) => (b.erreichtAt ?? '').localeCompare(a.erreichtAt ?? '')), [ziele])
  const offen = useMemo(() => ziele.filter((z) => !z.erreicht), [ziele])
  const [alle, setAlle] = useState(false)
  const [ref, sichtbar] = useImBild<HTMLDivElement>()
  const kippen = useKippen<HTMLDivElement>()
  const refs = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el
      return kippen(el)
    },
    [ref, kippen],
  )
  // Neu = erreicht, aber in diesem Browser noch nie gesehen. Beim allerersten
  // Besuch (kein Merker) werden höchstens die 3 jüngsten Erfolge gefeiert.
  const [neu] = useState<Set<string>>(() => {
    const g = gesehenLesen()
    const kandidaten = erreicht.filter((z) => !g?.has(z.id)).map((z) => z.id)
    return new Set(ruhigeBewegung() ? [] : g ? kandidaten.slice(0, 6) : kandidaten.slice(0, 3))
  })
  const gemerkt = useRef(false)
  useEffect(() => {
    if (!sichtbar || gemerkt.current) return
    gemerkt.current = true
    gesehenSchreiben([...(gesehenLesen() ?? []), ...erreicht.map((z) => z.id)])
    if (neu.size) vibriere([12, 60, 18])
  }, [sichtbar, erreicht, neu])

  const zeigen = alle ? offen : offen.slice(0, ERSTE)
  const quote = ziele.length ? erreicht.length / ziele.length : 0

  return (
    <div className="sa-block zm" ref={refs}>
      <h3 className="hf-zwischen">
        Sammelziele <span>{erreicht.length}/{ziele.length}</span>
      </h3>
      <div className="zm-quote" aria-hidden="true">
        <i style={{ transform: `scaleX(${sichtbar ? quote : 0})` }} />
      </div>

      {erreicht.length > 0 && (
        <>
          <p className="zm-zwischen">Deine Vitrine</p>
          <ul className="zm-vitrine hb-nicht-ziehen">
            {erreicht.map((z, i) => (
              <ZielKachel key={z.id} z={z} sichtbar={sichtbar} neu={sichtbar && neu.has(z.id)} index={i} />
            ))}
          </ul>
        </>
      )}

      {offen.length > 0 && (
        <>
          <p className="zm-zwischen">Als Nächstes</p>
          <ul className="zm-raster">
            {zeigen.map((z, i) => (
              <ZielKachel key={z.id} z={z} sichtbar={sichtbar} neu={false} index={i} />
            ))}
            <li className="zm-k zm-k--geheim" data-kipp="">
              <Medaille metall="kupfer" erreicht={false} gesperrt>
                {null}
              </Medaille>
              <b className="zm-k__titel">Geheime Mission</b>
              <small className="zm-k__text">Wird sichtbar, sobald du sie erreichst.</small>
            </li>
          </ul>
          {offen.length > ERSTE && (
            <button type="button" className="zm-mehr" onClick={() => setAlle((a) => !a)} aria-expanded={alle}>
              {alle ? 'Weniger zeigen' : `Alle ${offen.length} offenen Ziele`}
              <ChevronDown size={16} strokeWidth={1.5} aria-hidden="true" style={{ transform: alle ? 'rotate(180deg)' : undefined }} />
            </button>
          )}
        </>
      )}
    </div>
  )
}

/** „Nächstes Ziel"-Leiste oben im Album — mit Mini-Medaille. */
export function NaechstesZiel({ ziel }: { ziel?: Ziel | null }) {
  const [ref, sichtbar] = useImBild<HTMLDivElement>()
  if (!ziel) return null
  const rest = Math.max(0, ziel.benoetigt - ziel.fortschritt)
  const lohn = lohnText(ziel.belohnung)
  return (
    <div className="sa-ziel-leiste" role="status" ref={ref}>
      <Medaille metall={metallVon(ziel)} erreicht={false} anteil={ziel.fortschritt / Math.max(1, ziel.benoetigt)} sichtbar={sichtbar} groesse="s">
        <ZielSymbol z={ziel} size={14} />
      </Medaille>
      <span>
        <small>Nächstes Ziel</small>
        Noch <b>{rest}</b> bis „{ziel.titel}“{lohn ? <> → {lohn}</> : null}
      </span>
    </div>
  )
}
