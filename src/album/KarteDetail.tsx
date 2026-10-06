import { useEffect, useRef, useState } from 'react'
import { RotateCw, Share2, Smartphone } from 'lucide-react'
import type { Karte, ShinyFund } from './api'
import { SvaKarte } from '../karten/SvaKarte'
import type { KartenDaten } from '../karten/typen'
import { gyroAnfragen, gyroBeobachten, gyroBrauchtErlaubnis } from '../karten/gyro'
import { kartenDaten, shinyDaten } from './kartenDaten'
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
  /** v22: Shiny dieser Person (falls gefunden) */
  shiny?: ShinyFund
  onSchliessen: () => void
}

const SHINY_ID = '__shiny__'
const datumLang = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' })

function useDialog(ref: React.RefObject<HTMLDivElement | null>, onSchliessen: () => void) {
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
  }, [onSchliessen, ref])
}

export function KarteDetail({ platz, besitz, gesamt, saison, fanName, shiny, onSchliessen }: Props) {
  const alle = [...platz.versionen, ...platz.glanz]
  const [aktivId, setAktivId] = useState<string>((platz.beste ?? platz.besterGlanz ?? platz.versionen[0]).id)
  const istShiny = aktivId === SHINY_ID && !!shiny
  const aktiv: Karte = alle.find((k) => k.id === aktivId) ?? platz.beste ?? platz.versionen[0]
  const [hinten, setHinten] = useState(false)
  const [gyro, setGyro] = useState(gyroBrauchtErlaubnis)
  const [teilt, setTeilt] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const n = istShiny ? shiny!.anzahl : besitz.get(aktiv.id) ?? 0
  const basisDaten = kartenDaten(aktiv, platz.nr || undefined, platz.nr ? gesamt : undefined, saison)
  const daten = istShiny ? shinyDaten(basisDaten, shiny!.erstfund) : basisDaten

  useEffect(() => gyroBeobachten(() => setGyro(gyroBrauchtErlaubnis())), [])
  useDialog(ref, onSchliessen)

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
            <SvaKarte key={daten.id} daten={daten} stufe="gross" interaktiv lebend aufdecken seite={hinten ? 'hinten' : 'vorne'} onClick={() => setHinten((h) => !h)} eager />
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
          {istShiny ? (
            <p className="al-lead">
              <b className="al-gold">Shiny.</b> {shiny!.erstfund ? (shiny!.erstfund.ich ? `Dein Erstfund vom ${datumLang(shiny!.erstfund.at)} — dein Name steht auf der Rückseite.` : `Erstfund von ${shiny!.erstfund.name} am ${datumLang(shiny!.erstfund.at)}.`) : ''}{' '}
              Reines Sammler-Glück: zählt nicht fürs Album{shiny!.anzahl > 1 ? ` · ×${shiny!.anzahl}` : ''}.
            </p>
          ) : n > 0 ? (
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
          {(alle.length > 1 || shiny) && (
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
                      setAktivId(v.id)
                      setHinten(false)
                    }}
                  >
                    {SELTEN_LABEL[v.seltenheit]}
                    {v.variante ? '-Glanz' : ''}
                    {m > 0 ? ` ×${m}` : ' · fehlt'}
                  </button>
                )
              })}
              {shiny && (
                <button
                  type="button"
                  className={`al-chip al-chip--shiny${istShiny ? ' is-aktiv' : ''}`}
                  aria-pressed={istShiny}
                  onClick={() => {
                    setAktivId(SHINY_ID)
                    setHinten(false)
                  }}
                >
                  Shiny{shiny.anzahl > 1 ? ` ×${shiny.anzahl}` : ''}
                </button>
              )}
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

/** v22: Große Karte ohne Platz (Shiny-Vitrine, Geheimseite, Kartenlabor). */
export function KarteBuehne({ daten, titel, text, onSchliessen }: { daten: KartenDaten; titel: string; text: string; onSchliessen: () => void }) {
  const [hinten, setHinten] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useDialog(ref, onSchliessen)
  return (
    <div className="al-detail" role="dialog" aria-modal="true" aria-label={titel} onClick={onSchliessen}>
      <div className="al-detail__panel" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="al-x" onClick={onSchliessen} aria-label="Schließen">
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </button>
        <div className="al-detail__karte">
          <SvaKarte key={daten.id} daten={daten} stufe="gross" interaktiv lebend aufdecken seite={hinten ? 'hinten' : 'vorne'} onClick={() => setHinten((h) => !h)} eager />
        </div>
        <div className="al-detail__info">
          <p className="al-kicker">{daten.shiny ? 'Shiny-Vitrine' : daten.geheim ? 'Geheime Seite' : 'Karte'}</p>
          <h2 className="al-h2">{titel}</h2>
          <p className="al-lead">{text}</p>
          <div className="al-detail__knoepfe">
            <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={() => setHinten((h) => !h)}>
              <RotateCw size={14} strokeWidth={1.5} aria-hidden="true" /> {hinten ? 'Vorderseite' : 'Rückseite'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
