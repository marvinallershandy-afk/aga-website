import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import type { EntwurfZustand } from './bande/entwurf'
import { schriftenBereit, zeichneTafel } from './bande/tafel'
import { PARTNER_PAKETE, PAKETE_AUS_ADMIN } from '../data/partner'
import { CONTACT, whatsappReady, whatsappUrl } from '../data/content'
import { AnfrageFehler, anfrageKonfiguriert, feldText, quelleAusUrl, sendeAnfrage, type Feld } from './api'

// ─────────────────────────────────────────────────────────────
// v16-S: Anfrage-Formular. Speichert über die RPC partner_anfrage()
// (Admin → Partner → Anfragen). Danach Danke-Zustand + „Direkt per
// WhatsApp". Ist das Formular nicht erreichbar (keine Env, RPC fehlt,
// Limit), bleibt die Anfrage nicht hängen: vorbefüllte WhatsApp/E-Mail.
// ─────────────────────────────────────────────────────────────

const UNSICHER = 'unsicher'

interface Werte {
  firma: string
  name: string
  email: string
  telefon: string
  nachricht: string
  datenschutz: boolean
  website: string
}
const LEER: Werte = { firma: '', name: '', email: '', telefon: '', nachricht: '', datenschutz: false, website: '' }

function pruefe(w: Werte): Partial<Record<Feld, string>> {
  const f: Partial<Record<Feld, string>> = {}
  if (w.firma.trim().length < 2) f.firma = feldText('firma')
  if (w.name.trim().length < 2) f.name = feldText('name')
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(w.email.trim())) f.email = feldText('email')
  if (w.telefon.trim() && !/^[0-9 +()/.-]{4,40}$/.test(w.telefon.trim())) f.telefon = feldText('telefon')
  if (w.nachricht.length > 2000) f.nachricht = feldText('nachricht')
  if (!w.datenschutz) f.datenschutz = feldText('datenschutz')
  return f
}

/** v18-P: Banden-Entwurf als Text für die Nachricht (die RPC nimmt keine Bilder). */
function entwurfText(e: EntwurfZustand): string {
  return [
    '— Banden-Entwurf (Konfigurator auf /partner) —',
    `Name auf der Bande: „${e.name.trim()}“`,
    e.zeile2.trim() ? `Zweite Zeile: „${e.zeile2.trim()}“` : '',
    `Untergrund: ${e.grund === 'auto' ? 'automatisch' : e.grund}`,
    e.logoDataUrl ? 'Logo: eigenes Logo im Entwurf (Datei wird per E-Mail nachgereicht)' : 'Logo: keins im Entwurf',
  ]
    .filter(Boolean)
    .join('\n')
}

export function Anfrage({
  interesse,
  onInteresse,
  entwurf,
  onOhneEntwurf,
}: {
  interesse: string
  onInteresse: (v: string) => void
  entwurf?: EntwurfZustand | null
  onOhneEntwurf?: () => void
}) {
  const [start] = useState(() => performance.now())
  const [w, setW] = useState<Werte>(() => (entwurf?.name.trim() ? { ...LEER, firma: entwurf.name.trim().slice(0, 120) } : LEER))
  const [logoDabei, setLogoDabei] = useState(false)
  // Entwurf kommt dazu (Knopf im Konfigurator) → Firmenname übernehmen, wenn leer
  // (während des Renderns abgeglichen statt per Effekt — React-Muster für abgeleiteten Zustand)
  const entwurfName = entwurf?.name.trim() ?? ''
  const [vorName, setVorName] = useState(entwurfName)
  if (entwurfName !== vorName) {
    setVorName(entwurfName)
    if (entwurfName && !w.firma.trim()) setW({ ...w, firma: entwurfName.slice(0, 120) })
  }
  const [fehler, setFehler] = useState<Partial<Record<Feld, string>>>({})
  const [status, setStatus] = useState<'bereit' | 'sendet' | 'danke'>('bereit')
  const [problem, setProblem] = useState<{ text: string; direkt: boolean } | null>(null)
  const set = <K extends keyof Werte>(k: K, v: Werte[K]) => {
    setW((x) => ({ ...x, [k]: v }))
    if (fehler[k as Feld]) setFehler((f) => ({ ...f, [k]: undefined }))
  }

  const paket = PARTNER_PAKETE.find((p) => p.id === interesse) ?? null
  const interesseText = paket ? paket.name : interesse === UNSICHER ? 'Noch unsicher, bitte beraten' : ''

  const direktText = () =>
    [
      `Hallo SV Agathenburg-Dollern, hier ist ${w.name.trim() || '…'}${w.firma.trim() ? ` von ${w.firma.trim()}` : ''}.`,
      interesseText ? `Ich interessiere mich für: ${interesseText}.` : 'Ich interessiere mich für eine Partnerschaft.',
      w.nachricht.trim(),
      w.telefon.trim() ? `Telefon: ${w.telefon.trim()}` : '',
      entwurf ? `\n${entwurfText(entwurf)}` : '',
    ]
      .filter(Boolean)
      .join('\n')
  const mailUrl = () =>
    `mailto:${CONTACT.email}?subject=${encodeURIComponent(`Partner-Anfrage${w.firma.trim() ? `: ${w.firma.trim()}` : ''}`)}&body=${encodeURIComponent(direktText())}`

  const absenden = async (e: FormEvent) => {
    e.preventDefault()
    if (status === 'sendet') return
    const f = pruefe(w)
    setFehler(f)
    setProblem(null)
    const erstes = (Object.keys(f) as Feld[])[0]
    if (erstes) {
      document.getElementById(`pt-${erstes}`)?.focus()
      return
    }
    if (!anfrageKonfiguriert) {
      setProblem({ text: 'Das Formular ist auf dieser Seite noch nicht verbunden. Schick uns deine Anfrage direkt, deine Angaben sind schon eingetragen:', direkt: true })
      return
    }
    setStatus('sendet')
    try {
      // Ohne Admin-Pakete (Seed) geht das Interesse als Text mit.
      let nachricht = !PAKETE_AUS_ADMIN && interesseText ? `Interesse: ${interesseText}\n\n${w.nachricht.trim()}`.trim() : w.nachricht.trim()
      // v18-P: Entwurf als Text anhängen (max. 2000 Zeichen gesamt)
      if (entwurf) {
        const anhang = entwurfText(entwurf)
        nachricht = `${nachricht.slice(0, 1990 - anhang.length - 40)}${nachricht ? '\n\n' : ''}${anhang}`
      }
      setLogoDabei(!!entwurf?.logoDataUrl)
      await sendeAnfrage({
        firma: w.firma.trim(),
        name: w.name.trim(),
        email: w.email.trim(),
        telefon: w.telefon.trim(),
        paketId: paket && PAKETE_AUS_ADMIN ? paket.id : null,
        nachricht: interesse === UNSICHER && PAKETE_AUS_ADMIN ? `[Noch unsicher, bitte beraten]\n${nachricht}`.trim() : nachricht,
        datenschutz: w.datenschutz,
        website: w.website,
        dauerMs: performance.now() - start,
        quelle: quelleAusUrl() ?? (entwurf ? 'bande-konfigurator' : null),
      })
      setStatus('danke')
      window.setTimeout(() => document.getElementById('pt-danke')?.focus(), 50)
    } catch (err) {
      setStatus('bereit')
      if (err instanceof AnfrageFehler && err.art === 'feld' && err.feld) {
        setFehler({ [err.feld]: err.message })
        document.getElementById(`pt-${err.feld}`)?.focus()
      } else {
        const text = err instanceof Error ? err.message : 'Das hat nicht geklappt.'
        setProblem({ text: `${text} Mit einem Tipp geht sie direkt raus, deine Angaben sind schon eingetragen:`, direkt: true })
      }
    }
  }

  if (status === 'danke') {
    return (
      <div className="pt-danke" id="pt-danke" tabIndex={-1} role="status">
        <p className="pt-danke__titel">Danke, {w.name.trim().split(' ')[0]}!</p>
        <p>
          Deine Anfrage{w.firma.trim() ? ` für ${w.firma.trim()}` : ''} ist bei uns angekommen. Wir melden uns in den nächsten Tagen
          persönlich{w.telefon.trim() ? ' — per Telefon oder' : ' per'} E-Mail an <b>{w.email.trim()}</b>.
        </p>
        {logoDabei && (
          <p>
            Dein Logo ist nur auf deinem Gerät. Schick uns die Datei gern direkt an{' '}
            <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent(`Logo für die Bande: ${w.firma.trim()}`)}`}>{CONTACT.email}</a> — dann bauen wir die
            Bande damit.
          </p>
        )}
        <p className="pt-danke__sub">Schneller geht’s direkt:</p>
        <div className="pt-actions">
          {whatsappReady ? (
            <a className="pt-btn pt-btn--wa" href={whatsappUrl(`${direktText()}\n(Anfrage über die Website ist raus.)`)} target="_blank" rel="noreferrer">
              Direkt per WhatsApp
            </a>
          ) : (
            <a className="pt-btn" href={mailUrl()}>
              Direkt per E-Mail
            </a>
          )}
          <a className="pt-btn pt-btn--ghost" href="/">
            Zur Vereinsseite
          </a>
        </div>
      </div>
    )
  }

  const fehlerListe = Object.values(fehler).filter(Boolean)
  return (
    <form className="pt-form" onSubmit={absenden} noValidate>
      {fehlerListe.length > 1 && (
        <p className="pt-form__summary" role="alert">
          Bitte prüf die markierten Felder ({fehlerListe.length}).
        </p>
      )}
      <div className="pt-grid2">
        <Feldzeile id="firma" label="Unternehmen" pflicht fehler={fehler.firma}>
          <input id="pt-firma" autoComplete="organization" value={w.firma} onChange={(e) => set('firma', e.target.value)} maxLength={120} aria-invalid={!!fehler.firma} aria-describedby={fehler.firma ? 'pt-firma-err' : undefined} />
        </Feldzeile>
        <Feldzeile id="name" label="Ansprechpartner" pflicht fehler={fehler.name}>
          <input id="pt-name" autoComplete="name" value={w.name} onChange={(e) => set('name', e.target.value)} maxLength={80} aria-invalid={!!fehler.name} aria-describedby={fehler.name ? 'pt-name-err' : undefined} />
        </Feldzeile>
        <Feldzeile id="email" label="E-Mail" pflicht fehler={fehler.email}>
          <input id="pt-email" type="email" inputMode="email" autoComplete="email" value={w.email} onChange={(e) => set('email', e.target.value)} maxLength={200} aria-invalid={!!fehler.email} aria-describedby={fehler.email ? 'pt-email-err' : undefined} />
        </Feldzeile>
        <Feldzeile id="telefon" label="Telefon" hinweis="optional" fehler={fehler.telefon}>
          <input id="pt-telefon" type="tel" inputMode="tel" autoComplete="tel" value={w.telefon} onChange={(e) => set('telefon', e.target.value)} maxLength={40} aria-invalid={!!fehler.telefon} aria-describedby={fehler.telefon ? 'pt-telefon-err' : undefined} />
        </Feldzeile>
      </div>
      <Feldzeile id="interesse" label="Interesse">
        <select id="pt-interesse" value={interesse} onChange={(e) => onInteresse(e.target.value)}>
          <option value="">Bitte wählen …</option>
          {PARTNER_PAKETE.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
              {p.frei != null && p.frei <= 0 ? ' (Warteliste)' : ''}
            </option>
          ))}
          <option value={UNSICHER}>Noch unsicher — berate mich</option>
        </select>
      </Feldzeile>
      <Feldzeile id="nachricht" label="Nachricht" hinweis="optional" fehler={fehler.nachricht}>
        <textarea id="pt-nachricht" rows={4} value={w.nachricht} onChange={(e) => set('nachricht', e.target.value)} maxLength={2000} placeholder="z. B. Budget, Wunschfläche, Start ab …" aria-invalid={!!fehler.nachricht} />
      </Feldzeile>

      {entwurf && (
        <div className="pt-entwurf">
          <EntwurfMini e={entwurf} />
          <div>
            <p className="pt-entwurf__titel">Dein Banden-Entwurf geht mit</p>
            <p className="pt-entwurf__text">
              Name{entwurf.zeile2.trim() ? ', zweite Zeile' : ''} und Untergrund gehen als Text mit.
              {entwurf.logoDataUrl ? ' Dein Logo bleibt auf deinem Gerät — die Datei schickst du uns nach der Anfrage per E-Mail.' : ''}
            </p>
            <button type="button" className="pt-entwurf__weg" onClick={onOhneEntwurf}>
              Ohne Entwurf anfragen
            </button>
          </div>
        </div>
      )}

      {/* Honeypot: für Menschen unsichtbar, Bots füllen es aus → still verworfen */}
      <div className="pt-hp" aria-hidden="true">
        <label htmlFor="pt-website">Website (bitte leer lassen)</label>
        <input id="pt-website" tabIndex={-1} autoComplete="off" value={w.website} onChange={(e) => set('website', e.target.value)} />
      </div>

      <div className={`pt-check${fehler.datenschutz ? ' is-fehler' : ''}`}>
        <input id="pt-datenschutz" type="checkbox" checked={w.datenschutz} onChange={(e) => set('datenschutz', e.target.checked)} aria-invalid={!!fehler.datenschutz} aria-describedby="pt-datenschutz-text" />
        <label htmlFor="pt-datenschutz" id="pt-datenschutz-text">
          Ich bin einverstanden, dass der SV Agathenburg-Dollern meine Angaben speichert, um meine Anfrage zu beantworten. Mehr dazu in der{' '}
          <a href="/datenschutz#partner-anfrage" target="_blank" rel="noreferrer">
            Datenschutzerklärung
          </a>
          . *
        </label>
      </div>
      {fehler.datenschutz && (
        <p className="pt-feld__err" role="alert">
          {fehler.datenschutz}
        </p>
      )}

      {problem && (
        <div className="pt-problem" role="alert">
          <p>{problem.text}</p>
          {problem.direkt && (
            <div className="pt-actions">
              {whatsappReady && (
                <a className="pt-btn pt-btn--wa" href={whatsappUrl(direktText())} target="_blank" rel="noreferrer">
                  Per WhatsApp senden
                </a>
              )}
              <a className={`pt-btn${whatsappReady ? ' pt-btn--ghost' : ''}`} href={mailUrl()}>
                Per E-Mail senden
              </a>
            </div>
          )}
        </div>
      )}

      <button type="submit" className="pt-btn pt-btn--gross" disabled={status === 'sendet'}>
        {status === 'sendet' ? 'Wird gesendet …' : 'Anfrage senden'}
      </button>
      <p className="pt-form__alt">
        Lieber direkt?{' '}
        {whatsappReady && (
          <>
            <a href={whatsappUrl('Hallo SV Agathenburg-Dollern! Ich interessiere mich für eine Partnerschaft.')} target="_blank" rel="noreferrer">
              WhatsApp
            </a>{' '}
            ·{' '}
          </>
        )}
        <a href={`mailto:${CONTACT.email}?subject=${encodeURIComponent('Partner-Anfrage')}`}>{CONTACT.email}</a>
      </p>
    </form>
  )
}

function EntwurfMini({ e }: { e: EntwurfZustand }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let ab = false
    schriftenBereit().then(() => {
      const cv = ref.current
      if (ab || !cv) return
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      zeichneTafel(ctx, 0, 0, cv.width, cv.height, { name: e.name, zeile2: e.zeile2, logo: e.logo, grund: e.grund })
    })
    return () => {
      ab = true
    }
  }, [e])
  return <canvas ref={ref} className="ptafel pt-entwurf__tafel" width={416} height={160} role="img" aria-label={`Entwurf: ${e.name}`} />
}

function Feldzeile({
  id,
  label,
  pflicht,
  hinweis,
  fehler,
  children,
}: {
  id: string
  label: string
  pflicht?: boolean
  hinweis?: string
  fehler?: string
  children: ReactNode
}) {
  return (
    <div className={`pt-feld${fehler ? ' is-fehler' : ''}`}>
      <label htmlFor={`pt-${id}`}>
        {label}
        {pflicht && <span aria-hidden="true"> *</span>}
        {hinweis && <small> · {hinweis}</small>}
      </label>
      {children}
      {fehler && (
        <p className="pt-feld__err" id={`pt-${id}-err`}>
          {fehler}
        </p>
      )}
    </div>
  )
}
