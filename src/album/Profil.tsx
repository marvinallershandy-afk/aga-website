import { useState } from 'react'
import { AlbumFehler, profilSpeichern, type Profil } from './api'
import { EINWILLIGUNG_KEY } from './Login'

// ─────────────────────────────────────────────────────────────
// v17-A: Profil — nur Vorname + Initial (Gutschein, Rangliste).
// Rangliste und Spieltags-Erinnerung sind freiwillig und starten AUS.
// Die Einwilligung fürs Speichern kommt vom Login-Formular; fehlt sie
// (z. B. Link in anderem Browser geöffnet), wird sie hier abgefragt.
// ─────────────────────────────────────────────────────────────

interface Props {
  profil: Profil | null
  email?: string
  onGespeichert: () => void
  /** Konto-Ansicht: kompakter, ohne Begrüßung */
  kompakt?: boolean
}

export function ProfilForm({ profil, email, onGespeichert, kompakt }: Props) {
  const einwilligungDa = (() => {
    try {
      return !!localStorage.getItem(EINWILLIGUNG_KEY)
    } catch {
      return false
    }
  })()
  const [vorname, setVorname] = useState(profil?.vorname ?? '')
  const [initial, setInitial] = useState(profil?.initial ?? '')
  const [rangliste, setRangliste] = useState(profil?.rangliste ?? false)
  const [erinnerung, setErinnerung] = useState(profil?.erinnerung ?? false)
  const [ok, setOk] = useState(!!profil || einwilligungDa)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [gespeichert, setGespeichert] = useState(false)

  const speichern = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    setGespeichert(false)
    if (!profil && !ok) return setFehler('Bitte bestätige die Einwilligung, damit wir dein Album speichern dürfen.')
    setLaeuft(true)
    try {
      await profilSpeichern({ vorname: vorname.trim(), initial: initial.trim(), rangliste, erinnerung, einwilligung: !profil && ok })
      setGespeichert(true)
      onGespeichert()
    } catch (err) {
      setFehler(err instanceof AlbumFehler ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <form className="al-form" onSubmit={speichern} noValidate>
      {!kompakt && (
        <>
          <p className="al-kicker">Willkommen{email ? ` · ${email}` : ''}</p>
          <h1 className="al-h1 al-h1--klein">
            Wie dürfen wir dich <em>nennen?</em>
          </h1>
          <p className="al-lead">Dein Vorname steht auf deinen Gutscheinen. Vom Nachnamen speichern wir nur den ersten Buchstaben.</p>
        </>
      )}
      <div className="al-zeile">
        <label className="al-feld al-feld--gross">
          <span>Vorname</span>
          <input autoComplete="given-name" value={vorname} onChange={(e) => setVorname(e.target.value)} maxLength={24} required />
        </label>
        <label className="al-feld al-feld--initial">
          <span>Nachname</span>
          <input
            autoComplete="family-name"
            value={initial}
            onChange={(e) => setInitial(e.target.value.slice(0, 1).toUpperCase())}
            maxLength={1}
            placeholder="A"
            aria-describedby="al-initial-hint"
            required
          />
        </label>
      </div>
      <p className="al-klein" id="al-initial-hint">Nur der Anfangsbuchstabe, z. B. „Marvin A.“</p>
      <label className="al-schalter">
        <input type="checkbox" checked={rangliste} onChange={(e) => setRangliste(e.target.checked)} />
        <span>
          <b>In der Rangliste „Treueste Fans“ zeigen</b>
          <small>als „{vorname.trim() || 'Vorname'} {initial || 'A'}.“ — freiwillig, jederzeit abschaltbar</small>
        </span>
      </label>
      <label className="al-schalter">
        <input type="checkbox" checked={erinnerung} onChange={(e) => setErinnerung(e.target.checked)} />
        <span>
          <b>Erinnerung vor Heimspielen per E-Mail</b>
          <small>höchstens eine Mail pro Heimspiel — freiwillig, jederzeit abbestellbar</small>
        </span>
      </label>
      {!profil && !einwilligungDa && (
        <label className="al-check">
          <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
          <span>
            Ich bin einverstanden, dass der SVA meine E-Mail-Adresse, meinen Vornamen mit Initial sowie Check-ins, Sticker und Gutscheine
            für das Sammelalbum speichert. <a href="/datenschutz#album">Datenschutz</a>
          </span>
        </label>
      )}
      {fehler && <p className="al-hinweis al-hinweis--fehler" role="alert">{fehler}</p>}
      {gespeichert && kompakt && <p className="al-hinweis al-hinweis--ok" role="status">Gespeichert.</p>}
      <button type="submit" className="al-btn al-btn--gross" disabled={laeuft}>
        {laeuft ? 'Wird gespeichert …' : profil ? 'Speichern' : 'Weiter zum Album'}
      </button>
    </form>
  )
}
