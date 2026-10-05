import { useEffect, useRef, useState } from 'react'
import { AlbumFehler, gutscheinEinloesen, type Gutschein } from './api'

// ─────────────────────────────────────────────────────────────
// v17-A: Gutschein-Ansicht „Am Stand zeigen". Großer Code, Vorname und
// eine LAUFENDE Uhr + bewegter Hintergrund — so sieht der Helfer, dass es
// kein Screenshot ist. Einlösen: Helfer tippt die 4-stellige Stand-PIN auf
// dem Handy des Fans. Nach 5 Fehlversuchen 15 min Sperre (serverseitig).
// ─────────────────────────────────────────────────────────────

interface Props {
  gutschein: Gutschein
  name?: string
  onSchliessen: () => void
  onEingeloest: () => void
}

const zeit = (d: Date) => d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Europe/Berlin' })

export function GutscheinAnsicht({ gutschein, name, onSchliessen, onEingeloest }: Props) {
  const [jetzt, setJetzt] = useState(() => new Date())
  const [pinOffen, setPinOffen] = useState(false)
  const [pin, setPin] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [meldung, setMeldung] = useState<{ art: 'fehler' | 'ok'; text: string } | null>(null)
  const [eingeloestAt, setEingeloestAt] = useState<string | null>(gutschein.status === 'eingeloest' ? gutschein.eingeloestAt ?? null : null)
  const pinRef = useRef<HTMLInputElement>(null)
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
    if (pinOffen) pinRef.current?.focus()
  }, [pinOffen])

  const einloesen = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^\d{4}$/.test(pin)) return setMeldung({ art: 'fehler', text: 'Die Stand-PIN hat 4 Ziffern.' })
    setLaeuft(true)
    setMeldung(null)
    try {
      const r = await gutscheinEinloesen(gutschein.id, pin)
      if (r.ok) {
        setEingeloestAt(r.eingeloestAt)
        setPinOffen(false)
        onEingeloest()
      } else if (r.grund === 'pin_falsch') {
        setMeldung({ art: 'fehler', text: r.versuche > 0 ? `PIN falsch. Noch ${r.versuche} ${r.versuche === 1 ? 'Versuch' : 'Versuche'}.` : 'PIN falsch. Jetzt 15 Minuten gesperrt.' })
        setPin('')
      } else if (r.grund === 'gesperrt') {
        setMeldung({ art: 'fehler', text: 'Zu viele falsche PINs. Bitte in 15 Minuten noch einmal.' })
      } else if (r.grund === 'keine_pin') {
        setMeldung({ art: 'fehler', text: 'Für den Stand ist noch keine PIN eingerichtet. Bitte beim Vorstand melden.' })
      } else if (r.grund === 'schon_eingeloest') {
        setEingeloestAt(r.eingeloestAt ?? new Date().toISOString())
        setPinOffen(false)
      } else {
        setMeldung({ art: 'fehler', text: 'Dieses Los nimmt an der Verlosung teil und wird nicht am Stand eingelöst.' })
      }
    } catch (err) {
      setMeldung({ art: 'fehler', text: err instanceof AlbumFehler ? err.message : 'Keine Verbindung. Bitte noch einmal.' })
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <div className={`al-gut${eingeloestAt ? ' is-eingeloest' : ''}`} role="dialog" aria-modal="true" aria-labelledby="al-gut-titel">
      <div className="al-gut__bg" aria-hidden="true" />
      <button type="button" className="al-x" onClick={onSchliessen} aria-label="Schließen">
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" /></svg>
      </button>
      <div className="al-gut__karte">
        <p className="al-kicker">{verlosung ? 'Album komplett · Saison ' + gutschein.saison : eingeloestAt ? 'Eingelöst' : 'Am Stand zeigen'}</p>
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
            <svg viewBox="0 0 24 24" width="34" height="34" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Eingelöst am {new Date(eingeloestAt).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', timeZone: 'Europe/Berlin' })} um{' '}
            {new Date(eingeloestAt).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })} Uhr
          </div>
        ) : verlosung ? (
          <p className="al-hinweis al-hinweis--ok">Du bist in der Saison-Verlosung. Wir melden uns per E-Mail, wenn du gewinnst.</p>
        ) : pinOffen ? (
          <form className="al-pin" onSubmit={einloesen}>
            <label>
              <span>Für Helfer: Stand-PIN eingeben</span>
              <input
                ref={pinRef}
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                maxLength={4}
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                aria-describedby="al-pin-hint"
              />
            </label>
            <p className="al-klein" id="al-pin-hint">Die PIN kennt nur das Stand-Team.</p>
            {meldung && <p className={`al-hinweis al-hinweis--${meldung.art}`} role="alert">{meldung.text}</p>}
            <div className="al-pin__btns">
              <button type="button" className="al-btn al-btn--ghost" onClick={() => { setPinOffen(false); setPin(''); setMeldung(null) }}>
                Abbrechen
              </button>
              <button type="submit" className="al-btn" disabled={laeuft || pin.length !== 4}>
                {laeuft ? 'Prüfe …' : 'Einlösen'}
              </button>
            </div>
          </form>
        ) : (
          <button type="button" className="al-btn al-btn--gross al-btn--hell" onClick={() => setPinOffen(true)}>
            Helfer: jetzt einlösen
          </button>
        )}
      </div>
    </div>
  )
}
