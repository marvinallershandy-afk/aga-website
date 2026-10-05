import { useState } from 'react'
import { AlbumFehler, codeBestaetigen, loginLinkSenden, type Katalog } from './api'

// ─────────────────────────────────────────────────────────────
// v17-A: Anmeldung ohne Passwort. E-Mail + Einwilligung → Login-Link
// (und 6-stelliger Code in derselben Mail, falls der Link in einem anderen
// Browser aufgeht). Einmalig — danach bleibt man auf dem Handy eingeloggt.
// ─────────────────────────────────────────────────────────────

export const EINWILLIGUNG_KEY = 'sva-album-einwilligung'

interface Props {
  katalog: Katalog | null
  /** offener Check-in (QR gescannt, aber noch nicht angemeldet) */
  checkinWartet: boolean
}

export function Login({ katalog, checkinWartet }: Props) {
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState(false)
  const [schritt, setSchritt] = useState<'email' | 'gesendet'>('email')
  const [code, setCode] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')

  const token = (() => {
    try {
      return localStorage.getItem('sva-album-c')
    } catch {
      return null
    }
  })()

  const senden = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    const m = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return setFehler('Diese E-Mail-Adresse sieht nicht richtig aus.')
    if (!ok) return setFehler('Bitte bestätige die Einwilligung, damit wir dein Album speichern dürfen.')
    setLaeuft(true)
    try {
      await loginLinkSenden(m, token)
      try {
        localStorage.setItem(EINWILLIGUNG_KEY, new Date().toISOString())
      } catch {
        /* privat-Modus */
      }
      setSchritt('gesendet')
    } catch (err) {
      setFehler(err instanceof AlbumFehler ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  const bestaetigen = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    const c = code.replace(/\D/g, '')
    if (c.length < 6) return setFehler('Bitte den Code aus der E-Mail eingeben.')
    setLaeuft(true)
    try {
      await codeBestaetigen(email.trim().toLowerCase(), c)
      // onAuthStateChange in AlbumApp übernimmt
    } catch (err) {
      setFehler(err instanceof AlbumFehler ? err.message : 'Das hat nicht geklappt.')
      setLaeuft(false)
    }
  }

  const belohnung = katalog?.regeln.belohnungen.find((b) => b.stufe === 'schwelle_1')
  const anzahl = katalog?.karten.length ?? 0

  return (
    <section className="al-login al-panel" id="login" aria-labelledby="h-login">
      <p className="al-kicker">{checkinWartet ? 'Check-in · fast geschafft' : `Saison ${katalog?.saison ?? ''}`}</p>
      <h1 className="al-h1 al-h1--klein" id="h-login">
        Dein <em>Stickerheft</em>
      </h1>
      {checkinWartet ? (
        <p className="al-lead">
          Du hast den QR-Code gescannt. Melde dich einmal mit deiner E-Mail an — danach wird dein Check-in gutgeschrieben und du
          reißt dein erstes Tütchen auf.
        </p>
      ) : (
        <p className="al-lead">
          Bei jedem Heimspiel am Eingang den QR-Code scannen, Sticker-Tütchen aufreißen, Heft vollkleben.
          {anzahl > 0 && <> {anzahl} Sticker warten auf dich.</>}
          {belohnung?.checkins && (
            <>
              {' '}
              Beim {belohnung.checkins}. Check-in: <b>{belohnung.titel}</b>.
            </>
          )}
        </p>
      )}

      {schritt === 'email' ? (
        <form className="al-form" onSubmit={senden} noValidate>
          <label className="al-feld">
            <span>E-Mail-Adresse</span>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="du@beispiel.de"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label className="al-check">
            <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
            <span>
              Ich bin einverstanden, dass der SV Agathenburg-Dollern meine E-Mail-Adresse, meinen Vornamen mit Initial sowie meine
              Check-ins, Sticker und Gutscheine für das Sammelalbum speichert. Keine Weitergabe, kein Newsletter ohne extra Häkchen.
              Widerruf jederzeit über „Konto löschen“. <a href="/datenschutz#album">Datenschutz</a>
            </span>
          </label>
          {fehler && <p className="al-hinweis al-hinweis--fehler" role="alert">{fehler}</p>}
          <button type="submit" className="al-btn al-btn--gross" disabled={laeuft}>
            {laeuft ? 'Wird gesendet …' : 'Login-Link schicken'}
          </button>
          <p className="al-klein">Kein Passwort. Du bekommst einen Link per E-Mail — einmal tippen, fertig. Danach bleibst du eingeloggt.</p>
        </form>
      ) : (
        <form className="al-form" onSubmit={bestaetigen} noValidate>
          <div className="al-hinweis al-hinweis--ok" role="status">
            <b>Schau in dein Postfach.</b> Wir haben dir an <b>{email.trim()}</b> einen Login-Link geschickt. Tipp ihn auf diesem Handy an.
          </div>
          <label className="al-feld">
            <span>Oder den 6-stelligen Code aus der Mail eingeben</span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={8}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="al-code-input"
            />
          </label>
          {fehler && <p className="al-hinweis al-hinweis--fehler" role="alert">{fehler}</p>}
          <button type="submit" className="al-btn al-btn--gross" disabled={laeuft}>
            {laeuft ? 'Wird geprüft …' : 'Code bestätigen'}
          </button>
          <button type="button" className="al-btn al-btn--ghost" onClick={() => { setSchritt('email'); setCode(''); setFehler('') }}>
            Andere E-Mail / neu senden
          </button>
          <p className="al-klein">Nichts angekommen? Schau im Spam-Ordner nach. Ein neuer Link geht nach einer Minute.</p>
        </form>
      )}
    </section>
  )
}
