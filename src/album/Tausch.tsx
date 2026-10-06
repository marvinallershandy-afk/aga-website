import { useEffect, useState } from 'react'
import { ArrowLeftRight } from 'lucide-react'
import { AlbumFehler, tauschAnnehmen, tauschAnsehen, type Karte, type TauschAnsicht } from './api'
import { SvaKarte } from '../karten/SvaKarte'
import { kartenDaten } from './kartenDaten'
import { vibriere } from '../karten/medien'
import { name } from './model'

// v20-K: Tausch-Angebot aus einem Link (/album?t=CODE) ansehen und annehmen.
const GRUND: Record<string, string> = {
  keine_doppelte: 'Für diesen Tausch brauchst du die gewünschte Karte doppelt.',
  zu_neu: 'Tauschen geht ab einer Woche im Album.',
  limit: 'Diese Woche sind schon fünf Tausche gelaufen.',
  abgelaufen: 'Dieses Angebot ist abgelaufen.',
  eigen: 'Das ist dein eigenes Angebot — schick den Link an einen Freund.',
}

export function TauschDialog({ code, karten, saison, onSchliessen, onErledigt }: { code: string; karten: Map<string, Karte>; saison: string; onSchliessen: () => void; onErledigt: () => void }) {
  const [t, setT] = useState<TauschAnsicht | null>(null)
  const [text, setText] = useState('')
  const [fertig, setFertig] = useState(false)
  useEffect(() => {
    tauschAnsehen(code)
      .then(setT)
      .catch((e) => setText(e instanceof AlbumFehler ? e.message : 'Dieses Angebot konnte nicht geladen werden.'))
  }, [code])
  const biete = t ? karten.get(t.biete) : undefined
  const wunsch = t ? karten.get(t.wunsch) : undefined
  const annehmen = async () => {
    try {
      await tauschAnnehmen(code)
      vibriere([16, 40, 30])
      setFertig(true)
      onErledigt()
    } catch (e) {
      setText(e instanceof AlbumFehler ? e.message : 'Der Tausch hat nicht geklappt.')
    }
  }
  return (
    <div className="al-detail" role="dialog" aria-modal="true" aria-label="Tausch-Angebot" onClick={onSchliessen}>
      <div className="al-detail__panel al-tausch" onClick={(e) => e.stopPropagation()}>
        <p className="al-kicker">Tausch-Angebot</p>
        {t && biete && wunsch ? (
          <>
            <h2 className="al-h2">{t.eigen ? 'Dein Angebot' : `${t.von} tauscht mit dir`}</h2>
            <div className={`al-tausch__karten${fertig ? ' is-fertig' : ''}`}>
              <figure>
                <SvaKarte daten={kartenDaten(biete, undefined, undefined, saison)} stufe="normal" eager />
                <figcaption>Du bekommst {name(biete)}</figcaption>
              </figure>
              <ArrowLeftRight size={28} strokeWidth={1.5} aria-hidden="true" />
              <figure>
                <SvaKarte daten={kartenDaten(wunsch, undefined, undefined, saison)} stufe="normal" eager />
                <figcaption>Du gibst {name(wunsch)}</figcaption>
              </figure>
            </div>
            {fertig ? (
              <p className="al-hinweis al-hinweis--ok">Getauscht! Die Karte ist in deinem Album.</p>
            ) : t.status !== 'offen' ? (
              <p className="al-hinweis">Dieses Angebot ist nicht mehr offen.</p>
            ) : t.kannAnnehmen ? (
              <button type="button" className="al-btn al-btn--gross" onClick={() => void annehmen()}>
                Tausch annehmen
              </button>
            ) : (
              <p className="al-hinweis">{GRUND[t.grund ?? ''] ?? 'Dieser Tausch geht gerade nicht.'}</p>
            )}
          </>
        ) : (
          !text && <p className="al-lead">Angebot wird geladen …</p>
        )}
        {text && <p className="al-hinweis al-hinweis--fehler">{text}</p>}
        <button type="button" className="al-btn al-btn--ghost" onClick={onSchliessen}>
          {fertig ? 'Zum Album' : 'Schließen'}
        </button>
      </div>
    </div>
  )
}
