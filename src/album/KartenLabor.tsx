import { useMemo, useState } from 'react'
import type { Karte, Katalog } from './api'
import { SvaKarte } from '../karten/SvaKarte'
import type { KartenDaten } from '../karten/typen'
import { kartenDaten, shinyDaten } from './kartenDaten'
import { name, plaetze, shinyPlaetze } from './model'
import './labor.css'

// ─────────────────────────────────────────────────────────────
// v22-A: Kartenlabor — ALLE Karten des Katalogs in allen Fassungen
// nebeneinander (Basis, Glanz, Gold, Spezial, limitiert, Partner, Kurve,
// Shiny, Geheim), Vorder-/Rückseite, Antippen = große Karte mit Holo-Neigung.
// Dazu Shiny-Vitrine und Geheimseite komplett gefüllt. Rein clientseitig —
// in der Vorführung mit Demo-Katalog, im Admin mit dem echten Katalog
// (nur gelesen, nichts wird gespeichert).
// ─────────────────────────────────────────────────────────────

type Filter = 'alle' | 'spieler' | 'glanz' | 'stab' | 'moment' | 'fan' | 'partner' | 'limitiert' | 'kult' | 'shiny' | 'geheim'
const FILTER: [Filter, string][] = [
  ['alle', 'Alle'],
  ['spieler', 'Spieler'],
  ['glanz', 'Glanz'],
  ['stab', 'Trainerstab'],
  ['moment', 'Momente'],
  ['fan', 'Kurve'],
  ['partner', 'Partner'],
  ['limitiert', 'Limitiert'],
  ['kult', 'Kult'],
  ['shiny', 'Shiny'],
  ['geheim', 'Geheim'],
]

interface Eintrag {
  key: string
  daten: KartenDaten
  label: string
  filter: Filter[]
}

export function KartenLabor({ katalog, geheim, onSchliessen }: { katalog: Katalog; geheim: Karte[]; onSchliessen?: () => void }) {
  const [filter, setFilter] = useState<Filter>('alle')
  const [hinten, setHinten] = useState(false)
  const [gross, setGross] = useState<Eintrag | null>(null)
  const ps = useMemo(() => plaetze(katalog, new Map()), [katalog])
  const nr = useMemo(() => new Map(ps.flatMap((p) => [...p.versionen, ...p.glanz].map((v) => [v.id, p.nr] as const))), [ps])
  const gesamt = ps.filter((p) => p.gruppe !== 'bonus').length

  const eintraege = useMemo(() => {
    const out: Eintrag[] = []
    for (const k of katalog.karten) {
      const d = kartenDaten(k, nr.get(k.id) || undefined, nr.get(k.id) ? gesamt : undefined, katalog.saison)
      const f: Filter[] = ['alle']
      if (k.kult) f.push('kult')
      else if (k.limitiert) f.push('limitiert')
      else if (k.variante) f.push('glanz')
      else if (k.typ === 'spieler') f.push('spieler')
      else if (k.typ === 'trainer') f.push('stab')
      else f.push(k.typ as Filter)
      out.push({ key: k.id, daten: d, label: `${name(k)} · ${k.kult ? 'Kabinen-Kult' : k.limitiert ? 'Limitiert' : k.variante ? 'Silber-Glanz' : { bronze: 'Kader', silber: 'Silber', gold: 'Gold', spezial: 'Spezial' }[k.seltenheit]}`, filter: f })
    }
    // Shiny-Fassung jeder Person (Basis-Karte)
    for (const sp of shinyPlaetze(ps, null)) {
      const d = kartenDaten(sp.karte, sp.nr || undefined, sp.nr ? gesamt : undefined, katalog.saison)
      out.push({ key: `${sp.karte.id}-shiny`, daten: shinyDaten(d, { name: 'Lena B.', at: new Date().toISOString() }), label: `${name(sp.karte)} · Shiny`, filter: ['alle', 'shiny'] })
    }
    for (const g of geheim) out.push({ key: g.id, daten: kartenDaten(g, undefined, undefined, katalog.saison), label: `${g.titel} · Geheimkarte`, filter: ['alle', 'geheim'] })
    return out
  }, [katalog, geheim, ps, nr, gesamt])
  const sichtbar = eintraege.filter((e) => e.filter.includes(filter))

  return (
    <section className={`kl${onSchliessen ? ' kl--vollbild' : ''}`} aria-label="Kartenlabor">
      <header className="kl__kopf">
        <div>
          <p className="kl__kicker">Kartenlabor · {katalog.saison}</p>
          <h2 className="kl__titel">Alle Karten, alle Fassungen</h2>
          <p className="kl__text">
            {eintraege.length} Karten · Antippen = groß mit Holo-Neigung (Maus/Gyro), dort Rückseite drehen. Nur Ansicht — nichts wird gespeichert.
          </p>
        </div>
        {onSchliessen && (
          <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={onSchliessen}>
            Schließen
          </button>
        )}
      </header>
      <div className="kl__leiste" role="toolbar" aria-label="Filter">
        {FILTER.map(([f, l]) => (
          <button key={f} type="button" className={`kl__f${filter === f ? ' is-aktiv' : ''}`} aria-pressed={filter === f} onClick={() => setFilter(f)}>
            {l}
            <small>{eintraege.filter((e) => e.filter.includes(f)).length}</small>
          </button>
        ))}
        <label className="kl__schalter">
          <input type="checkbox" checked={hinten} onChange={(e) => setHinten(e.target.checked)} /> Rückseiten
        </label>
      </div>
      <ul className="kl__raster">
        {sichtbar.map((e) => (
          <li key={e.key}>
            <button type="button" className="kl__karte" onClick={() => setGross(e)} aria-label={`${e.label} groß ansehen`}>
              <SvaKarte daten={e.daten} stufe="klein" seite={hinten ? 'hinten' : 'vorne'} className={e.daten.shiny ? 'is-schimmer' : undefined} />
            </button>
            <span className="kl__label">{e.label}</span>
          </li>
        ))}
      </ul>
      {gross && <Gross e={gross} onSchliessen={() => setGross(null)} />}
    </section>
  )
}

function Gross({ e, onSchliessen }: { e: Eintrag; onSchliessen: () => void }) {
  const [hinten, setHinten] = useState(false)
  return (
    <div className="kl-gross" role="dialog" aria-modal="true" aria-label={e.label} onClick={onSchliessen}>
      <div className="kl-gross__karte" onClick={(x) => x.stopPropagation()}>
        <SvaKarte daten={e.daten} stufe="gross" interaktiv lebend aufdecken seite={hinten ? 'hinten' : 'vorne'} onClick={() => setHinten((h) => !h)} eager />
      </div>
      <p className="kl-gross__label">{e.label}</p>
      <div className="kl-gross__knoepfe" onClick={(x) => x.stopPropagation()}>
        <button type="button" className="kl__f" onClick={() => setHinten((h) => !h)}>
          {hinten ? 'Vorderseite' : 'Rückseite'}
        </button>
        <button type="button" className="kl__f is-aktiv" onClick={onSchliessen}>
          Schließen
        </button>
      </div>
    </div>
  )
}
