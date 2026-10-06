import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, HelpCircle } from 'lucide-react'
import type { GeheimZiel, Ziel, ZielKategorie } from './api'
import { Medaille, ZielSymbol } from './Medaille'
import { lohnText, metallVon, useImBild, useKippen } from './medaille-logik'
import { ruhigeBewegung, vibriere } from '../karten/medien'
import { zuSeiteBlaettern } from './blaettern'
import './ziele.css'

// ─────────────────────────────────────────────────────────────
// v21-A: Sammelziele als Medaillen-Vitrine.
// v26-Z2: eigene „Ziele“-Seite im Heft — großer Fortschrittsring, Filter-Chips
//   (Alle · Fast geschafft · Start · Platz & Check-in · Woche & Monat · Sammeln ·
//   Sets & Familien · Tipp-Liga · Sozial · Geheim), „fast geschafft“-Sortierung,
//   ???-Kacheln für geheime Ziele (nur Hinweis), Vitrine der Erfolge unten.
//   Auf „Sammeln“ bleibt nur eine kompakte „Top 3 fast geschafft“-Zeile mit Link.
// Gesehene Erfolge merkt sich der Browser ('sva-album-ziele-gesehen').
// ─────────────────────────────────────────────────────────────

const GESEHEN_KEY = 'sva-album-ziele-gesehen'

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

/** relativer Rest 0..1 (1 = noch nichts) für die „fast geschafft“-Reihung. */
function relRest(z: Ziel): number {
  const n = Math.max(1, z.benoetigt)
  return Math.max(0, n - Math.min(z.fortschritt, z.benoetigt)) / n
}
/** offene Ziele: offene Perioden ganz oben, dann kleinster Rest, 0-Fortschritt ans Ende. */
function sortFast(a: Ziel, b: Ziel): number {
  const g = (z: Ziel) => (z.periode && !z.erreicht ? 0 : z.fortschritt > 0 ? 1 : 2)
  const ga = g(a)
  const gb = g(b)
  if (ga !== gb) return ga - gb
  const ra = relRest(a)
  const rb = relRest(b)
  if (ra !== rb) return ra - rb
  return (a.titel || '').localeCompare(b.titel || '')
}

// Filter-Chips: ein Chip „woche“ deckt Woche + Monat ab.
type Filter = 'alle' | 'fast' | ZielKategorie
const CHIPS: { id: Filter; label: string }[] = [
  { id: 'alle', label: 'Alle' },
  { id: 'fast', label: 'Fast geschafft' },
  { id: 'start', label: 'Start' },
  { id: 'platz', label: 'Platz & Check-in' },
  { id: 'woche', label: 'Woche & Monat' },
  { id: 'sammeln', label: 'Sammeln' },
  { id: 'sets', label: 'Sets & Familien' },
  { id: 'tipp', label: 'Tipp-Liga' },
  { id: 'sozial', label: 'Sozial' },
  { id: 'geheim', label: 'Geheim' },
]
const katPasst = (z: Ziel, f: Filter) => (f === 'woche' ? z.kategorie === 'woche' || z.kategorie === 'monat' : z.kategorie === f)

function ZielKachel({ z, sichtbar, neu, index }: { z: Ziel; sichtbar: boolean; neu: boolean; index: number }) {
  const anteil = Math.min(z.fortschritt, z.benoetigt) / Math.max(1, z.benoetigt)
  const lohn = lohnText(z.belohnung)
  const offenePeriode = !!z.periode && !z.erreicht
  const mehrfach = z.wiederholbar && (z.anzahlErreicht ?? 0) > 0
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
      {mehrfach && <span className="zm-k__mal" aria-hidden="true">×{z.anzahlErreicht}</span>}
      <b className="zm-k__titel">{z.titel}</b>
      {z.beschreibung && <small className="zm-k__text">{z.beschreibung}</small>}
      {offenePeriode && <span className="zm-k__periode">diese Woche noch offen</span>}
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

/** v26: geheimes Ziel als ???-Kachel — nur der Hinweis, nie Titel/Bedingung. */
function GeheimKachel({ g, index }: { g: GeheimZiel; index: number }) {
  return (
    <li className="zm-k zm-k--geheim" data-kipp="" style={{ ['--i' as string]: index }} aria-label={`Geheimes Ziel: ${g.hinweis}`}>
      <Medaille metall="kupfer" erreicht={false} gesperrt>
        {null}
      </Medaille>
      <b className="zm-k__titel">???</b>
      <small className="zm-k__text zm-k__raetsel">{g.hinweis}</small>
    </li>
  )
}

/** v21-A (jetzt in die Ziele-Seite integriert): Vitrine der erreichten Ziele. */
function Vitrine({ erreicht, sichtbar, neu }: { erreicht: Ziel[]; sichtbar: boolean; neu: Set<string> }) {
  if (!erreicht.length) return null
  return (
    <>
      <p className="zm-zwischen">Deine Vitrine</p>
      <ul className="zm-vitrine hb-nicht-ziehen">
        {erreicht.map((z, i) => (
          <ZielKachel key={z.id} z={z} sichtbar={sichtbar} neu={sichtbar && neu.has(z.id)} index={i} />
        ))}
      </ul>
    </>
  )
}

/** v26-Z2: Die eigene „Ziele“-Seite im Heft. */
export function ZieleSeite({ ziele, geheimZiele }: { ziele: Ziel[]; geheimZiele?: GeheimZiel[] }) {
  const geheim = geheimZiele ?? []
  const [filter, setFilter] = useState<Filter>('alle')
  const [ref, sichtbar] = useImBild<HTMLDivElement>()
  const kippen = useKippen<HTMLDivElement>()
  const refs = useCallback(
    (el: HTMLDivElement | null) => {
      ref.current = el
      return kippen(el)
    },
    [ref, kippen],
  )

  const erreicht = useMemo(() => ziele.filter((z) => z.erreicht).sort((a, b) => (b.erreichtAt ?? '').localeCompare(a.erreichtAt ?? '')), [ziele])
  const offen = useMemo(() => ziele.filter((z) => !z.erreicht), [ziele])
  const gesamt = ziele.length + geheim.length
  const quote = gesamt ? erreicht.length / gesamt : 0

  // Neu = erreicht, aber in diesem Browser noch nie gesehen.
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

  // Zähler je Chip: erreicht/total
  const zaehler = useMemo(() => {
    const m: Record<string, { e: number; n: number }> = {}
    for (const c of CHIPS) m[c.id] = { e: 0, n: 0 }
    m.alle = { e: erreicht.length, n: gesamt }
    m.fast = { e: 0, n: offen.length }
    for (const z of ziele) {
      const k: Filter = z.kategorie === 'monat' ? 'woche' : (z.kategorie as Filter)
      if (k && m[k]) { m[k].n++; if (z.erreicht) m[k].e++ }
    }
    m.geheim.n += geheim.length // offene ???-Kacheln
    return m
  }, [ziele, erreicht.length, offen.length, geheim.length, gesamt])

  // sichtbare offene Ziele + Geheim-Kacheln nach Filter
  const offenGefiltert = useMemo(() => {
    const base = filter === 'alle' || filter === 'fast' ? offen : offen.filter((z) => katPasst(z, filter))
    return [...base].sort(sortFast)
  }, [offen, filter])
  const zeigeGeheim = filter === 'alle' || filter === 'fast' || filter === 'geheim'
  const erreichtGefiltert = useMemo(() => {
    if (filter === 'fast') return []
    if (filter === 'alle') return erreicht
    return erreicht.filter((z) => katPasst(z, filter))
  }, [erreicht, filter])

  return (
    <div className="sa-block zm zm--seite" ref={refs}>
      <div className="zm-kopf">
        <div className="zm-ring" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle className="zm-ring__spur" cx="60" cy="60" r="52" />
            <circle className="zm-ring__wert" cx="60" cy="60" r="52" style={{ strokeDashoffset: 327 * (1 - (sichtbar ? quote : 0)) }} />
          </svg>
          <span className="zm-ring__zahl">
            <b>{erreicht.length}</b>
            <small>von {gesamt}</small>
          </span>
        </div>
        <div className="zm-kopf__text">
          <h3 className="hf-zwischen">Deine Ziele</h3>
          <div className="zm-quote" aria-hidden="true">
            <i style={{ transform: `scaleX(${sichtbar ? quote : 0})` }} />
          </div>
          <p className="zm-kopf__unter">Jedes Ziel bringt Karten oder Lose — manche bleiben geheim, bis du sie knackst.</p>
        </div>
      </div>

      <div className="zm-chips" role="tablist" aria-label="Ziele filtern">
        {CHIPS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="tab"
            aria-pressed={filter === c.id}
            aria-selected={filter === c.id}
            className={`zm-chip${filter === c.id ? ' is-aktiv' : ''}`}
            onClick={() => setFilter(c.id)}
          >
            {c.label}
            <span className="zm-chip__n">{c.id === 'fast' ? zaehler.fast.n : `${zaehler[c.id].e}/${zaehler[c.id].n}`}</span>
          </button>
        ))}
      </div>

      {offenGefiltert.length > 0 && (
        <>
          {filter !== 'fast' && <p className="zm-zwischen">Als Nächstes</p>}
          <ul className="zm-raster">
            {offenGefiltert.map((z, i) => (
              <ZielKachel key={z.id} z={z} sichtbar={sichtbar} neu={false} index={i} />
            ))}
            {zeigeGeheim && geheim.map((g, i) => <GeheimKachel key={g.id} g={g} index={offenGefiltert.length + i} />)}
          </ul>
        </>
      )}
      {offenGefiltert.length === 0 && zeigeGeheim && geheim.length > 0 && (
        <ul className="zm-raster">
          {geheim.map((g, i) => (
            <GeheimKachel key={g.id} g={g} index={i} />
          ))}
        </ul>
      )}
      {offenGefiltert.length === 0 && !geheim.length && filter !== 'alle' && erreichtGefiltert.length > 0 && (
        <p className="zm-leer">Alles geschafft in dieser Gruppe — stark!</p>
      )}

      <Vitrine erreicht={erreichtGefiltert} sichtbar={sichtbar} neu={neu} />
    </div>
  )
}

/** v26-Z2: kompakte „Top 3 fast geschafft“-Zeile auf der Sammeln-Seite. */
export function ZieleTeaser({ ziele }: { ziele: Ziel[] }) {
  const [ref, sichtbar] = useImBild<HTMLDivElement>()
  const top = useMemo(() => ziele.filter((z) => !z.erreicht && z.fortschritt > 0).sort(sortFast).slice(0, 3), [ziele])
  const erreicht = ziele.filter((z) => z.erreicht).length
  return (
    <div className="sa-block zm-teaser" ref={ref}>
      <div className="zm-teaser__kopf">
        <h3 className="hf-zwischen">Deine Ziele <span>{erreicht}/{ziele.length}</span></h3>
        <button type="button" className="zm-teaser__link" onClick={() => zuSeiteBlaettern('ziele')}>
          Alle ansehen <ChevronRight size={16} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
      {top.length > 0 ? (
        <ul className="zm-teaser__liste">
          {top.map((z) => (
            <li key={z.id}>
              <Medaille metall={metallVon(z)} erreicht={false} anteil={z.fortschritt / Math.max(1, z.benoetigt)} sichtbar={sichtbar} groesse="s">
                <ZielSymbol z={z} size={14} />
              </Medaille>
              <span className="zm-teaser__t">
                <b>{z.titel}</b>
                <small>Noch {Math.max(0, z.benoetigt - z.fortschritt)}{lohnText(z.belohnung) ? ` · ${lohnText(z.belohnung)}` : ''}</small>
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="zm-teaser__leer">
          <HelpCircle size={15} strokeWidth={1.5} aria-hidden="true" /> Fang an zu sammeln — deine ersten Ziele warten schon.
        </p>
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
