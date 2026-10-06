import { useEffect, useRef, useState } from 'react'
import { RotateCw, Share2, Smartphone } from 'lucide-react'
import type { Karte } from './api'
import { SvaKarte } from '../karten/SvaKarte'
import { gyroAnfragen, gyroBeobachten, gyroBrauchtErlaubnis } from '../karten/gyro'
import { kartenDaten } from './kartenDaten'
import { SELTEN_LABEL, name, type Platz } from './model'

// ─────────────────────────────────────────────────────────────
// v20-K: Karten-Detail. Große, lebende Karte (Greenscreen-Loop, wenn da)
// mit Holo-Neigung (Maus; Handy per Gyro — iOS fragt nach einem Tipp auf
// „Mit dem Handy neigen"). Antippen dreht die Karte (Rückseite mit
// Steckbrief, Kartennummer, Saison, Credit). Varianten (Basis/Glanz) als
// Umschalter, „Karte teilen" als Story-Bild.
// ─────────────────────────────────────────────────────────────

interface Props {
  platz: Platz
  besitz: Map<string, number>
  gesamt: number
  saison: string
  fanName?: string
  onSchliessen: () => void
}

export function KarteDetail({ platz, besitz, gesamt, saison, fanName, onSchliessen }: Props) {
  const alle = [...platz.versionen, ...platz.glanz]
  const [aktiv, setAktiv] = useState<Karte>(platz.beste ?? platz.besterGlanz ?? platz.versionen[0])
  const [hinten, setHinten] = useState(false)
  const [gyro, setGyro] = useState(gyroBrauchtErlaubnis)
  const [teilt, setTeilt] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const n = besitz.get(aktiv.id) ?? 0
  const daten = kartenDaten(aktiv, platz.nr || undefined, platz.nr ? gesamt : undefined, saison)

  useEffect(() => gyroBeobachten(() => setGyro(gyroBrauchtErlaubnis())), [])
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

  const karteTeilen = async () => {
    setTeilt('…')
    try {
      const { pullBild, alsBlob, teilen } = await import('../karten/export/bild')
      const r = await teilen(await alsBlob(await pullBild([daten], fanName)), `sva-${name(aktiv).toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, 'Aus meinem SVA-Sammelalbum · aga-erste.de/album · @svagathenburg')
      setTeilt(r === 'fehler' ? 'Hat nicht geklappt.' : '')
    } catch {
      setTeilt('Hat nicht geklappt.')
    }
  }

  return (
    <div className="al-detail" role="dialog" aria-modal="true" aria-label={name(aktiv)} onClick={onSchliessen}>
      <div className="al-detail__panel" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="al-x" onClick={onSchliessen} aria-label="Schließen">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="al-detail__karte">
          {n > 0 ? (
            <SvaKarte key={aktiv.id} daten={daten} stufe="gross" interaktiv lebend aufdecken seite={hinten ? 'hinten' : 'vorne'} onClick={() => setHinten((h) => !h)} eager />
          ) : (
            <span className="hb-leer hb-leer--gross" role="img" aria-label="Noch nicht im Album">
              <span className="hb-leer__nr">{platz.nr ? String(platz.nr).padStart(2, '0') : ''}</span>
              <svg viewBox="0 0 100 140" className="hb-leer__form">
                <polygon points="6,0 94,0 100,6 100,131 50,140 0,131 0,6" />
              </svg>
              <span className="hb-leer__name">{name(aktiv)}</span>
            </span>
          )}
        </div>
        <div className="al-detail__info">
          <p className="al-kicker">
            {platz.nr ? `Nr. ${String(platz.nr).padStart(2, '0')}` : 'Bonus-Seite'}
            {aktiv.serie ? ` · ${aktiv.serie}` : aktiv.untertitel ? ` · ${aktiv.untertitel}` : ''}
          </p>
          <h2 className="al-h2">{name(aktiv)}</h2>
          {n > 0 ? (
            <p className="al-lead">
              {n === 1 ? 'Im Album.' : `Im Album — und ${n - 1}× doppelt zum Tauschen.`}
              {aktiv.variante && ' Glanz-Variante: Sammelstück, füllt keinen Platz.'}
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
            <p className="al-lead">Fehlt noch. Beim nächsten Heimspiel einchecken, tippen oder einen Story-Code einlösen.</p>
          )}
          {alle.length > 1 && (
            <div className="al-versionen" role="group" aria-label="Versionen">
              {alle.map((v) => {
                const m = besitz.get(v.id) ?? 0
                return (
                  <button
                    key={v.id}
                    type="button"
                    className={`al-chip al-chip--${v.seltenheit}${v.id === aktiv.id ? ' is-aktiv' : ''}${m === 0 ? ' is-fehlt' : ''}`}
                    aria-pressed={v.id === aktiv.id}
                    onClick={() => {
                      setAktiv(v)
                      setHinten(false)
                    }}
                  >
                    {SELTEN_LABEL[v.seltenheit]}
                    {v.variante ? '-Glanz' : ''}
                    {m > 0 ? ` ×${m}` : ' · fehlt'}
                  </button>
                )
              })}
            </div>
          )}
          {n > 0 && (
            <div className="al-detail__knoepfe">
              <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={() => setHinten((h) => !h)}>
                <RotateCw size={14} strokeWidth={1.5} aria-hidden="true" /> {hinten ? 'Vorderseite' : 'Rückseite'}
              </button>
              <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={() => void karteTeilen()} disabled={teilt === '…'}>
                <Share2 size={14} strokeWidth={1.5} aria-hidden="true" /> Karte teilen
              </button>
              {gyro && (
                <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={() => gyroAnfragen()}>
                  <Smartphone size={14} strokeWidth={1.5} aria-hidden="true" /> Mit dem Handy neigen
                </button>
              )}
            </div>
          )}
          {teilt && teilt !== '…' && <p className="hf-klein">{teilt}</p>}
        </div>
      </div>
    </div>
  )
}
