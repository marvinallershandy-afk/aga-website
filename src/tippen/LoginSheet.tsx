import { useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { Sheet } from '../alltag/Sheet'
import { beitreten, codeBestaetigen, loginLinkSenden, TippFehler, type Lage } from './api'
import { EINWILLIGUNG_KEY } from '../album/Login'
import { RanglistenVorschau } from './ProfilTab'

// ─────────────────────────────────────────────────────────────
// v20-T: Einmal anmelden — dasselbe Konto wie das Sammelalbum.
// 1) E-Mail → Link/6-stelliger Code (kein Passwort)  2) Vorname + Initial,
// Teilnahmebedingungen, freiwillig „öffentlich zeigen“.
// ─────────────────────────────────────────────────────────────

function einwilligungDa(): boolean {
  try {
    return !!localStorage.getItem(EINWILLIGUNG_KEY)
  } catch {
    return false
  }
}

export function LoginSheet({
  offen,
  grund,
  session,
  lage,
  onZu,
  onFertig,
}: {
  offen: boolean
  grund: 'tipp' | 'allgemein' | 'liga'
  session: Session | null
  lage: Lage | null
  onZu: () => void
  onFertig: () => Promise<void>
}) {
  const schritt = !session ? 'email' : !lage?.ich?.teilnehmer ? 'profil' : 'fertig'
  const titel = schritt === 'email' ? (grund === 'tipp' ? 'Nur noch kurz anmelden' : 'Anmelden') : 'Fast geschafft'
  return (
    <Sheet open={offen && schritt !== 'fertig'} onClose={onZu} label="tp-login" kicker={grund === 'tipp' ? 'Dein Tipp ist gemerkt' : 'SVA Tipp-Liga'} titel={titel}>
      {schritt === 'email' && <EmailSchritt />}
      {schritt === 'profil' && <ProfilSchritt lage={lage} onFertig={onFertig} />}
    </Sheet>
  )
}

function EmailSchritt() {
  const [email, setEmail] = useState('')
  const [ok, setOk] = useState(einwilligungDa)
  const [gesendet, setGesendet] = useState(false)
  const [code, setCode] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')

  const senden = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    const m = email.trim().toLowerCase()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(m)) return setFehler('Diese E-Mail-Adresse sieht nicht richtig aus.')
    if (!ok) return setFehler('Bitte bestätige die Einwilligung, damit wir deine Tipps speichern dürfen.')
    setLaeuft(true)
    try {
      await loginLinkSenden(m, '/tippen')
      try {
        localStorage.setItem(EINWILLIGUNG_KEY, new Date().toISOString())
      } catch {
        /* privat */
      }
      setGesendet(true)
    } catch (err) {
      setFehler(err instanceof TippFehler ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }
  const bestaetigen = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    const c = code.replace(/\D/g, '')
    if (c.length < 6) return setFehler('Bitte den 6-stelligen Code aus der E-Mail eingeben.')
    setLaeuft(true)
    try {
      await codeBestaetigen(email.trim().toLowerCase(), c)
    } catch (err) {
      setFehler(err instanceof Error ? err.message : 'Der Code passt nicht.')
      setLaeuft(false)
    }
  }

  if (gesendet) {
    return (
      <form className="tp-form" onSubmit={bestaetigen} noValidate>
        <p className="tp-hinweis tp-hinweis--ok" role="status">
          <b>Schau in dein Postfach.</b> Link an <b>{email.trim()}</b> ist raus — antippen, fertig. Oder den Code hier eingeben:
        </p>
        <label className="tp-feld">
          <span>Code aus der E-Mail</span>
          <input className="tp-feld__code" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="123456" value={code} onChange={(e) => setCode(e.target.value)} />
        </label>
        {fehler && (
          <p className="tp-hinweis tp-hinweis--fehler" role="alert">
            {fehler}
          </p>
        )}
        <button type="submit" className="tp-btn tp-btn--gross" disabled={laeuft}>
          {laeuft ? 'Wird geprüft …' : 'Code bestätigen'}
        </button>
        <button type="button" className="tp-btn tp-btn--text" onClick={() => setGesendet(false)}>
          Andere E-Mail / neu senden
        </button>
      </form>
    )
  }
  return (
    <form className="tp-form" onSubmit={senden} noValidate>
      <p className="tp-lead">Ein Konto für Tipp-Liga und Sammelalbum. Kein Passwort — du bekommst einen Link per E-Mail.</p>
      <label className="tp-feld">
        <span>E-Mail-Adresse</span>
        <input type="email" inputMode="email" autoComplete="email" placeholder="du@beispiel.de" value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="tp-check">
        <input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} />
        <span>
          Ich bin einverstanden, dass der SV Agathenburg-Dollern meine E-Mail-Adresse, meinen Vornamen mit Initial sowie meine Tipps, Punkte und
          Ligen für Tipp-Liga und Sammelalbum speichert. Keine Weitergabe, kein Newsletter. Widerruf jederzeit über „Konto löschen“.{' '}
          <a href="/datenschutz#tippliga">Datenschutz</a>
        </span>
      </label>
      {fehler && (
        <p className="tp-hinweis tp-hinweis--fehler" role="alert">
          {fehler}
        </p>
      )}
      <button type="submit" className="tp-btn tp-btn--gross" disabled={laeuft}>
        {laeuft ? 'Wird gesendet …' : 'Login-Link schicken'}
      </button>
    </form>
  )
}

function ProfilSchritt({ lage, onFertig }: { lage: Lage | null; onFertig: () => Promise<void> }) {
  const profil = lage?.ich?.profil
  const [vorname, setVorname] = useState(profil?.vorname ?? '')
  const [initial, setInitial] = useState(profil?.initial ?? '')
  const [sichtbar, setSichtbar] = useState(false)
  const [bed, setBed] = useState(false)
  const [einw, setEinw] = useState(einwilligungDa)
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')

  const los = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    if (!bed) return setFehler('Bitte bestätige die Teilnahmebedingungen.')
    if (!profil && !einw) return setFehler('Bitte bestätige die Einwilligung, damit wir deine Tipps speichern dürfen.')
    setLaeuft(true)
    try {
      await beitreten({ vorname: vorname.trim(), initial: initial.trim(), sichtbar, bedingungen: true, einwilligung: !profil && einw })
      await onFertig()
    } catch (err) {
      setFehler(err instanceof TippFehler ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <form className="tp-form" onSubmit={los} noValidate>
      {profil ? (
        <p className="tp-lead">
          Hallo {profil.vorname}! Du hast schon ein Album — wir nehmen dasselbe Konto. Nur noch bestätigen:
        </p>
      ) : (
        <div className="tp-zeile">
          <label className="tp-feld tp-feld--gross">
            <span>Vorname</span>
            <input value={vorname} onChange={(e) => setVorname(e.target.value)} autoComplete="given-name" maxLength={24} placeholder="Lena" />
          </label>
          <label className="tp-feld tp-feld--initial">
            <span>Initial</span>
            <input value={initial} onChange={(e) => setInitial(e.target.value.slice(0, 1))} maxLength={1} placeholder="K" />
          </label>
        </div>
      )}
      <label className="tp-schalter">
        <input type="checkbox" checked={sichtbar} onChange={(e) => setSichtbar(e.target.checked)} />
        <span>
          <b>In öffentlichen Ranglisten zeigen</b>
          <small>Feier deine Siege sichtbar mit — oder bleib privat. Freiwillig, jederzeit änderbar; in deinen Ligen kennen dich die Mitglieder ohnehin.</small>
        </span>
      </label>
      <RanglistenVorschau sichtbar={sichtbar} vorname={vorname || profil?.vorname || ''} initial={initial || profil?.initial || ''} />
      <label className="tp-check">
        <input type="checkbox" checked={bed} onChange={(e) => setBed(e.target.checked)} />
        <span>
          Ich habe die <a href="/teilnahmebedingungen" target="_blank" rel="noopener">Teilnahmebedingungen</a> gelesen. Mitspielen ist kostenlos.
        </span>
      </label>
      {!profil && !einwilligungDa() && (
        <label className="tp-check">
          <input type="checkbox" checked={einw} onChange={(e) => setEinw(e.target.checked)} />
          <span>
            Ich bin einverstanden, dass meine E-Mail, mein Vorname mit Initial und meine Tipps gespeichert werden. <a href="/datenschutz#tippliga">Datenschutz</a>
          </span>
        </label>
      )}
      {fehler && (
        <p className="tp-hinweis tp-hinweis--fehler" role="alert">
          {fehler}
        </p>
      )}
      <button type="submit" className="tp-btn tp-btn--gross" disabled={laeuft}>
        {laeuft ? 'Einen Moment …' : 'Mitmachen'}
      </button>
    </form>
  )
}
