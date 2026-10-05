import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, CalendarPlus, Check, Copy } from 'lucide-react'
import { Sheet } from './Sheet'
import { useSheetAusloeser } from './useSheetAusloeser'
import {
  aboUrls,
  appleTerminUrl,
  erkenneGeraet,
  googleTerminUrl,
  outlookTerminUrl,
  reihenfolge,
  spielTitel,
  type Anbieter,
  type KalenderSpiel,
} from './kalenderLinks'
import { zaehleEreignis } from '../statistik/zaehlen'

// ─────────────────────────────────────────────────────────────
// v18-A: EINE Kalender-Komponente für die ganze Website (Spiel-Kärtchen,
// Spieltag-Panel, /live, Rundgang, Fußzeile).
//   <KalenderKnopf spiel={…} />  → „Dieses Spiel in den Kalender“
//   <KalenderKnopf />            → „Alle Heimspiele abonnieren“
// Ersetzt den alten Blob-Download (.ics-Datei, die sich am Handy nicht
// öffnen ließ): Google/Outlook per Web-Link (funktioniert sofort), Apple
// über eine echte ICS-Adresse der Edge Function (/kalender.ics).
// Gerät wird erkannt → passende Option zuerst und hervorgehoben.
// ─────────────────────────────────────────────────────────────

const STANDARD_ADRESSE = 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg'

const NAME: Record<Anbieter, string> = {
  apple: 'Apple Kalender',
  google: 'Google Kalender',
  outlook: 'Outlook',
}
const UNTER: Record<Anbieter, string> = {
  apple: 'iPhone, iPad, Mac',
  google: 'Android & PC',
  outlook: 'Windows & Outlook.com',
}
const HINWEIS_TERMIN: Record<Anbieter, string> = {
  apple: 'Öffnet den Termin – dann oben rechts auf „Hinzufügen“ tippen.',
  google: 'Öffnet Google Kalender – dort auf „Speichern“ tippen.',
  outlook: 'Öffnet Outlook im Browser – dort „Speichern“.',
}
const HINWEIS_ABO: Record<Anbieter, string> = {
  apple: 'Der Kalender fragt „Abonnieren?“ – bestätigen, dann „Hinzufügen“.',
  google: 'Google Kalender öffnet sich – „Hinzufügen“ tippen. Am Android-Handy danach in der Kalender-App unter Einstellungen den neuen Kalender auf „Synchronisieren“ stellen.',
  outlook: 'Outlook fragt nach dem Abonnieren – „Importieren“ bestätigen. In der Outlook-App: Kalender hinzufügen → Aus dem Internet abonnieren → Adresse unten einfügen.',
}

type Status = 'pruefe' | 'ok' | 'fehlt'

/** Gibt es die Kalender-Adresse schon (Edge Function deployt)? Einmal je Seite. */
let pruefung: Promise<Status> | null = null
function pruefeKalender(): Promise<Status> {
  pruefung ??= fetch('/kalender.ics', { method: 'HEAD', cache: 'no-store', credentials: 'omit' })
    .then((r): Status => (r.ok && (r.headers.get('content-type') || '').includes('text/calendar') ? 'ok' : 'fehlt'))
    .catch((): Status => 'fehlt')
  return pruefung
}

function useGeraetReihenfolge(): Anbieter[] {
  return useMemo(() => reihenfolge(typeof navigator === 'undefined' ? 'sonst' : erkenneGeraet(navigator.userAgent)), [])
}

function datumZeile(s: KalenderSpiel): string {
  const d = new Date(s.anstoss)
  if (Number.isNaN(d.getTime())) return ''
  const tag = d.toLocaleDateString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
  return `${tag} · ${zeit} Uhr · ${s.heim ? 'Heimspiel' : 'Auswärts'}`
}

function Option({ anbieter, href, primaer, hinweis, aus, onTap, extern }: { anbieter: Anbieter; href: string | null; primaer: boolean; hinweis: string; aus?: boolean; onTap: () => void; extern: boolean }) {
  return (
    <li>
      <a
        className={`al-opt${primaer ? ' al-opt--primaer' : ''}`}
        href={aus || !href ? undefined : href}
        aria-disabled={aus || !href ? 'true' : undefined}
        target={extern ? '_blank' : undefined}
        rel={extern ? 'noopener' : undefined}
        onClick={onTap}
        data-anbieter={anbieter}
      >
        <CalendarPlus size={20} strokeWidth={1.5} aria-hidden="true" />
        <span className="al-opt__txt">
          <b>
            {NAME[anbieter]} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {UNTER[anbieter]}</span>
          </b>
          <small>{hinweis}</small>
        </span>
        {primaer && <span className="al-opt__badge">Für dich</span>}
      </a>
    </li>
  )
}

export function KalenderSheet({ open, onClose, spiel, adresse = STANDARD_ADRESSE }: { open: boolean; onClose: () => void; spiel?: KalenderSpiel | null; adresse?: string }) {
  // Das Sheet wird je Öffnen neu eingehängt (KalenderKnopf) → frischer Zustand
  const [ansicht, setAnsicht] = useState<'spiel' | 'abo'>(spiel ? 'spiel' : 'abo')
  const [alle, setAlle] = useState(false)
  const [status, setStatus] = useState<Status>('pruefe')
  const [kopiert, setKopiert] = useState(false)
  const folge = useGeraetReihenfolge()
  const origin = typeof window === 'undefined' ? 'https://aga-erste.de' : window.location.origin

  useEffect(() => {
    let aktiv = true
    void pruefeKalender().then((s) => {
      if (aktiv) setStatus(s)
    })
    return () => {
      aktiv = false
    }
  }, [])

  const abo = aboUrls(origin, alle)
  const fehlt = status === 'fehlt'

  const kopieren = async () => {
    zaehleEreignis('kalender-link')
    try {
      await navigator.clipboard.writeText(abo.https)
      setKopiert(true)
    } catch {
      ;(document.getElementById('al-kal-adresse') as HTMLInputElement | null)?.select()
    }
  }

  if (ansicht === 'spiel' && spiel) {
    const links: Record<Anbieter, string | null> = {
      apple: appleTerminUrl(spiel, origin),
      google: googleTerminUrl(spiel, origin, adresse),
      outlook: outlookTerminUrl(spiel, origin, adresse),
    }
    return (
      <Sheet open={open} onClose={onClose} kicker="In den Kalender" titel={spielTitel(spiel)} label="al-kal">
        <p className="al-meta">{datumZeile(spiel)}</p>
        <ul className="al-opts">
          {folge.map((a) => (
            <Option
              key={a}
              anbieter={a}
              href={links[a]}
              // erste verfügbare Option hervorheben (ohne Function: Apple fällt aus)
              primaer={a === folge.find((x) => !(x === 'apple' && fehlt))}
              aus={a === 'apple' && fehlt}
              hinweis={a === 'apple' && fehlt ? 'Kommt in Kürze – nutze solange Google oder Outlook.' : HINWEIS_TERMIN[a]}
              extern={a !== 'apple'}
              onTap={() => zaehleEreignis('kalender-termin')}
            />
          ))}
        </ul>
        <hr className="al-trenner" />
        <button type="button" className="al-link" onClick={() => setAnsicht('abo')}>
          Lieber alle Heimspiele automatisch? Abonnieren
          <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </Sheet>
    )
  }

  const aboLinks: Record<Anbieter, string> = { apple: abo.webcal, google: abo.google, outlook: abo.outlook }
  return (
    <Sheet open={open} onClose={onClose} kicker="Kalender-Abo" titel={alle ? 'Alle Spiele in deinen Kalender' : 'Alle Heimspiele in deinen Kalender'} label="al-kal">
      <p className="al-lead">Einmal abonnieren – neue Termine und Verlegungen kommen von selbst nach. Kein Konto, keine Anmeldung.</p>
      <label className="al-schalter">
        <input type="checkbox" checked={alle} onChange={(e) => setAlle(e.target.checked)} />
        Auch Auswärtsspiele
      </label>
      {fehlt && <p className="al-hinweis">Das Kalender-Abo wird gerade eingerichtet. Einzelne Spiele kannst du schon jetzt über „In den Kalender“ beim nächsten Spiel eintragen.</p>}
      <ul className="al-opts">
        {folge.map((a, i) => (
          <Option
            key={a}
            anbieter={a}
            href={aboLinks[a]}
            primaer={i === 0 && !fehlt}
            aus={fehlt}
            hinweis={HINWEIS_ABO[a]}
            extern={a !== 'apple'}
            onTap={() => zaehleEreignis('kalender-abo')}
          />
        ))}
      </ul>
      <div className="al-feld">
        <label htmlFor="al-kal-adresse">Andere Kalender-App: diese Adresse abonnieren</label>
        <div className="al-adresse">
          <input id="al-kal-adresse" readOnly value={abo.https} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="ds-btn ds-btn--line" onClick={() => void kopieren()} disabled={fehlt} style={{ height: 44 }}>
            {kopiert ? <Check size={16} strokeWidth={1.5} aria-hidden="true" /> : <Copy size={16} strokeWidth={1.5} aria-hidden="true" />}
            {kopiert ? 'Kopiert' : 'Kopieren'}
          </button>
        </div>
      </div>
      <p className="al-note">Abo beenden: im Kalender den Kalender „{abo.name}“ löschen.</p>
    </Sheet>
  )
}

/** Auslöser. Ohne `spiel` → Abo aller Heimspiele. `variante="zeile"` = ruhige
 *  Zeile mit Untertitel (Panels), sonst Knopf mit eigener Klasse. */
export function KalenderKnopf({
  spiel,
  adresse,
  className,
  label,
  variante = 'knopf',
}: {
  spiel?: KalenderSpiel | null
  adresse?: string
  className?: string
  label?: string
  variante?: 'knopf' | 'zeile' | 'link'
}) {
  const { ausloeser, offen, auf, zu } = useSheetAusloeser()
  const text = label ?? (spiel ? 'In den Kalender' : 'Heimspiele abonnieren')
  return (
    <>
      {variante === 'zeile' ? (
        <button type="button" className="al-zeile" ref={ausloeser} onClick={auf} aria-haspopup="dialog">
          <CalendarPlus size={20} strokeWidth={1.5} aria-hidden="true" />
          <span className="al-zeile__txt">
            <b>{text}</b>
            <small>{spiel ? 'Google, Apple oder Outlook – ein Tipp.' : 'Alle Termine automatisch im Handy-Kalender.'}</small>
          </span>
          <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
      ) : variante === 'link' ? (
        <button type="button" className={className ?? 'al-link'} ref={ausloeser} onClick={auf} aria-haspopup="dialog">
          {text}
        </button>
      ) : (
        <button type="button" className={className ?? 'ds-btn ds-btn--line'} ref={ausloeser} onClick={auf} aria-haspopup="dialog">
          <CalendarPlus size={16} strokeWidth={1.5} aria-hidden="true" />
          {text}
        </button>
      )}
      {offen && <KalenderSheet open onClose={zu} spiel={spiel} adresse={adresse} />}
    </>
  )
}
