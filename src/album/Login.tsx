import { useState } from 'react'
import { AlbumFehler, checkinVormerken, codeBestaetigen, loginLinkSenden, type Katalog } from './api'

// ─────────────────────────────────────────────────────────────
// v17-A: Anmeldung ohne Passwort. E-Mail + Einwilligung → Login-Link
// (und 6-stelliger Code in derselben Mail, falls der Link in einem anderen
// Browser aufgeht). Einmalig — danach bleibt man auf dem Handy eingeloggt.
//
// v25-D: Scan-Landing für Neulinge (checkinWartet): große Schrift, einfache
// Sprache (Panini), „Schritt X von 3", ein Schritt pro Bildschirm, klarer Nutzen.
// Bei E-Mail-Eingabe wird der Check-in SERVERSEITIG vorgemerkt (rotSpiel/rotCode),
// damit er einen Login im fremden Browser (Magic-Link) überlebt.
// ─────────────────────────────────────────────────────────────

export const EINWILLIGUNG_KEY = 'sva-album-einwilligung'

interface Props {
  katalog: Katalog | null
  /** offener Check-in (QR gescannt, aber noch nicht angemeldet) */
  checkinWartet: boolean
  /** v25-D: rotierender Check-in (für die Vormerkung) */
  rotSpiel?: string | null
  rotCode?: string | null
}

export function Login({ katalog, checkinWartet, rotSpiel, rotCode }: Props) {
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
      // v25-D: Check-in SOFORT vormerken — so geht er nicht verloren, falls der
      // Login-Link in einem anderen Browser aufgeht. Fehler hier nie blockierend.
      if (rotSpiel && rotCode) {
        try {
          await checkinVormerken(rotSpiel, m, rotCode)
        } catch {
          /* egal — nach dem Login wird trotzdem versucht einzuchecken */
        }
      }
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
  const schrittNr = schritt === 'email' ? 1 : 2

  return (
    <section className={`al-login al-panel${checkinWartet ? ' al-login--neu' : ''}`} id="login" aria-labelledby="h-login">
      {checkinWartet ? (
        <>
          <p className="al-login__fortschritt" aria-label={`Schritt ${schrittNr} von 3`}>
            <span className={schrittNr >= 1 ? 'is-da' : ''} />
            <span className={schrittNr >= 2 ? 'is-da' : ''} />
            <span />
            <b>Schritt {schrittNr} von 3</b>
          </p>
          <h1 className="al-h1 al-h1--klein" id="h-login">
            Du bist beim <em>SVA</em>!
          </h1>
          <p className="al-lead al-lead--gross">
            Hol dir dein Spieltags-Pack — <b>kostenlos</b>, dauert 30 Sekunden. Sammelkarten wie früher Panini, nur fürs Dabeisein.
          </p>
          <ul className="al-neu-nutzen">
            <li>Jedes Heimspiel neue Karten fürs Album</li>
            <li>Beim 3. Besuch ein Getränk, beim 6. Bratwurst — verlost unter allen</li>
            <li>Unter der Woche tippen, am Sonntag live mitfiebern</li>
          </ul>
        </>
      ) : (
        <>
          <p className="al-kicker">{`Saison ${katalog?.saison ?? ''}`}</p>
          <h1 className="al-h1 al-h1--klein" id="h-login">
            Dein <em>Sammelalbum</em>
          </h1>
          <p className="al-lead">
            Anmelden, Starter-Pack öffnen, Album füllen: bei jedem Heimspiel am Eingang den QR-Code scannen, unter der Woche tippen und Story-Codes einlösen.
            {anzahl > 0 && <> {anzahl} Karten warten auf dich.</>}
            {belohnung?.checkins && (
              <>
                {' '}
                Beim {belohnung.checkins}. Check-in: <b>{belohnung.titel}</b>.
              </>
            )}
          </p>
        </>
      )}

      {schritt === 'email' ? (
        <form className="al-form" onSubmit={senden} noValidate>
          <label className="al-feld">
            <span>{checkinWartet ? 'Deine E-Mail-Adresse' : 'E-Mail-Adresse'}</span>
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
              Check-ins, Karten und Gutscheine für das Sammelalbum speichert. Keine Weitergabe, kein Newsletter ohne extra Häkchen.
              Widerruf jederzeit über „Konto löschen“. <a href="/datenschutz#album">Datenschutz</a>
            </span>
          </label>
          {fehler && <p className="al-hinweis al-hinweis--fehler" role="alert">{fehler}</p>}
          <button type="submit" className="al-btn al-btn--gross" disabled={laeuft}>
            {laeuft ? 'Einen Moment …' : 'Weiter'}
          </button>
          <p className="al-klein">Kein Passwort. Du bekommst gleich eine E-Mail mit einem Zahlen-Code — den tippst du hier ein. Danach bleibst du angemeldet.</p>
        </form>
      ) : (
        <form className="al-form" onSubmit={bestaetigen} noValidate>
          <div className="al-hinweis al-hinweis--ok" role="status">
            <b>Schau in dein Postfach.</b> Wir haben dir an <b>{email.trim()}</b> eine E-Mail geschickt. Tippe hier den <b>6-stelligen Code</b> aus der Mail ein — dann bleibst du in diesem Fenster.
          </div>
          <label className="al-feld">
            <span>Code aus der E-Mail</span>
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
          <p className="al-klein">Nichts angekommen? Schau im Spam-Ordner nach. Ein neuer Code geht nach einer Minute. In der Mail ist auch ein Link — der tut es auch.</p>
        </form>
      )}
    </section>
  )
}
