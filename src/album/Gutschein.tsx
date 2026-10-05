import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { AlbumFehler, gutscheinEinloesen, type Gutschein } from './api'

// ─────────────────────────────────────────────────────────────
// v17-A Gutschein „Am Stand zeigen" · v17-D ohne PIN:
//  · großer Code, Vorname und eine LAUFENDE Uhr (kein Screenshot)
//  · „Einlösen" → Bestätigung „Wirklich einlösen? Danach ist der Gutschein
//    verbraucht." → Ja → eingelöst (Server setzt Status + Zeitstempel,
//    zweites Einlösen unmöglich). Danach großer Haken mit Datum/Uhrzeit —
//    darauf achtet der Helfer.
// ─────────────────────────────────────────────────────────────

interface Props {
  gutschein: Gutschein
  name?: string
  onSchliessen: () => void
  onEingeloest: () => void
}

const zeit = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Berlin' })
const datum = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', timeZone: 'Europe/Berlin' })
const uhr = (iso: string) => new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

export function GutscheinAnsicht({ gutschein, name, onSchliessen, onEingeloest }: Props) {
  const [jetzt, setJetzt] = useState(() => new Date())
  const [frage, setFrage] = useState(false)
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<string | null>(null)
  const [eingeloestAt, setEingeloestAt] = useState<string | null>(gutschein.status === 'eingeloest' ? gutschein.eingeloestAt ?? null : null)
  const jaRef = useRef<HTMLButtonElement>(null)
  const verlosung = gutschein.stufe === 'komplett'

  useEffect(() => {
    const t = window.setInterval(() => setJetzt(new Date()), 1000)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && onSchliessen()
    window.addEventListener('keydown', esc)
    return () => {
      window.clearInterval(t)
      document.body.style.overflow = prev
      window.removeEventListener('keydown', esc)
    }
  }, [onSchliessen])

  useEffect(() => {
    if (frage) jaRef.current?.focus()
  }, [frage])

  const einloesen = async () => {
    setLaeuft(true)
    setMeldung(null)
    try {
      const r = await gutscheinEinloesen(gutschein.id)
      if (r.ok) {
        setEingeloestAt(r.eingeloestAt)
        onEingeloest()
      } else if (r.grund === 'schon_eingeloest') {
        setEingeloestAt(r.eingeloestAt ?? new Date().toISOString())
      } else {
        setMeldung('Dieses Los nimmt an der Verlosung teil und wird nicht am Stand eingelöst.')
      }
      setFrage(false)
    } catch (err) {
      setMeldung(err instanceof AlbumFehler ? err.message : 'Keine Verbindung. Bitte noch einmal.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className={`al-gut${eingeloestAt ? ' is-eingeloest' : ''}`} role="dialog" aria-modal="true" aria-labelledby="al-gut-titel">
      <div className="al-gut__bg" aria-hidden="true" />
      <button type="button" className="al-x" onClick={onSchliessen} aria-label="Schließen">
        <X size={20} strokeWidth={1.5} aria-hidden="true" />
      </button>
      <div className="al-gut__karte">
        <p className="al-kicker">{verlosung ? 'Album komplett · Saison ' + gutschein.saison : eingeloestAt ? 'Gutschein verbraucht' : 'Am Stand zeigen'}</p>
        <h2 className="al-gut__titel" id="al-gut-titel">{gutschein.titel}</h2>
        {gutschein.partner && (
          <p className="al-gut__partner">
            präsentiert von
            {gutschein.partner.logoUrl ? <img src={gutschein.partner.logoUrl} alt={gutschein.partner.name} /> : <b>{gutschein.partner.name}</b>}
          </p>
        )}
        <p className="al-gut__code" aria-label={`Code ${gutschein.code.split('').join(' ')}`}>{gutschein.code}</p>
        {name && <p className="al-gut__name">für {name}</p>}
        <p className="al-gut__uhr" aria-hidden="true">
          <span className="al-gut__puls" /> live · {zeit(jetzt)}
        </p>

        {eingeloestAt ? (
          <div className="al-gut__stempel" role="status">
            <span className="al-gut__haken" aria-hidden="true">
              <Check size={56} strokeWidth={2} />
            </span>
            <b>Eingelöst</b>
            <span>
              am {datum(eingeloestAt)} um {uhr(eingeloestAt)} Uhr
            </span>
            <small>Nicht mehr gültig.</small>
          </div>
        ) : verlosung ? (
          <p className="al-hinweis al-hinweis--ok">Du bist in der Saison-Verlosung. Wir melden uns per E-Mail, wenn du gewinnst.</p>
        ) : frage ? (
          <div className="al-pin" role="alertdialog" aria-labelledby="al-frage-t" aria-describedby="al-frage-d">
            <p className="al-pin__frage" id="al-frage-t">Wirklich einlösen?</p>
            <p className="al-klein" id="al-frage-d">Danach ist der Gutschein verbraucht.</p>
            {meldung && <p className="al-hinweis al-hinweis--fehler" role="alert">{meldung}</p>}
            <div className="al-pin__btns">
              <button type="button" className="al-btn al-btn--ghost" onClick={() => { setFrage(false); setMeldung(null) }} disabled={laeuft}>
                Abbrechen
              </button>
              <button ref={jaRef} type="button" className="al-btn al-btn--hell" onClick={() => void einloesen()} disabled={laeuft}>
                {laeuft ? 'Löse ein …' : 'Ja, einlösen'}
              </button>
            </div>
          </div>
        ) : (
          <>
            {meldung && <p className="al-hinweis al-hinweis--fehler" role="alert">{meldung}</p>}
            <button type="button" className="al-btn al-btn--gross al-btn--hell" onClick={() => setFrage(true)}>
              Einlösen
            </button>
          </>
        )}
      </div>
    </div>
  )
}
