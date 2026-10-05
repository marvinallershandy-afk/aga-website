import { useEffect, useState } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { Sheet } from './Sheet'
import { useSheetAusloeser } from './useSheetAusloeser'
import { MANNSCHAFTEN, POSITIONEN, anfrageLink, nachricht, trainingFuer, helferLink, helferNachricht, type Mannschaft, type Position } from './mitspielen'
import { zaehleEreignis } from '../statistik/zaehlen'
import { WaIcon, MailIcon } from '../ui/Icons'

// ─────────────────────────────────────────────────────────────
// v18-A: Probetraining in 2–3 Tipps — kein Formular, nichts wird
// gespeichert. Am Ende öffnet sich WhatsApp (oder E-Mail) mit einer
// fertigen Nachricht. 1) Mannschaft 2) Position (optional) 3) Vorname/
// Jahrgang (optional) + Vorschau → „In WhatsApp öffnen“.
// ─────────────────────────────────────────────────────────────

type Schritt = 1 | 2 | 3

export function ProbetrainingSheet({ open, onClose, start }: { open: boolean; onClose: () => void; start?: string }) {
  // Je Öffnen neu eingehängt (ProbetrainingKnopf) → Zustand startet frisch
  const [mannschaft, setMannschaft] = useState<Mannschaft | null>(
    () => MANNSCHAFTEN.find((m) => m.id === start) ?? (MANNSCHAFTEN.length === 1 ? MANNSCHAFTEN[0] : null),
  )
  const [schritt, setSchritt] = useState<Schritt>(() => (mannschaft ? 2 : 1))
  const [position, setPosition] = useState<Position | null>(null)
  const [vorname, setVorname] = useState('')
  const [jahrgang, setJahrgang] = useState('')
  // v19-K (Audit B §4.7): „Mithelfen am Spieltag" — Helfer-Seitenpfad
  const [helfer, setHelfer] = useState(false)
  const hlink = helferLink()

  useEffect(() => {
    zaehleEreignis('probetraining-start')
  }, [])

  const gesamt = MANNSCHAFTEN.length > 1 ? 3 : 2
  const nr = MANNSCHAFTEN.length > 1 ? schritt : schritt - 1
  const anfrage = mannschaft ? { mannschaft, position, vorname, jahrgang } : null
  const link = anfrage ? anfrageLink(anfrage) : null
  const tr = mannschaft ? trainingFuer(mannschaft) : null

  return (
    <Sheet open={open} onClose={onClose} kicker="Probetraining" titel="Komm vorbei" label="al-probe">
      {helfer ? (
        <>
          <p className="al-frage">Mithelfen am Spieltag</p>
          <p className="al-lead">
            Ein Verein lebt von Leuten, die anpacken — am Grill, an der Kasse, beim Auf- und Abbau. Sag kurz Bescheid,
            wir melden uns, wo gerade Hände fehlen.
          </p>
          <pre className="al-vorschau" aria-label="Deine Nachricht">
            {helferNachricht()}
          </pre>
          <div className="al-aktionen">
            <a
              className="ds-btn ds-btn--primary"
              href={hlink.href}
              target={hlink.kanal === 'whatsapp' ? '_blank' : undefined}
              rel={hlink.kanal === 'whatsapp' ? 'noopener' : undefined}
              data-kanal={hlink.kanal}
            >
              {hlink.kanal === 'whatsapp' ? <WaIcon size={18} /> : <MailIcon size={18} />}
              {hlink.kanal === 'whatsapp' ? 'In WhatsApp öffnen' : 'Per E-Mail senden'}
            </a>
            <button type="button" className="al-link" onClick={() => setHelfer(false)}>
              <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" /> Zurück
            </button>
          </div>
          <p className="al-note">
            Die Nachricht öffnet sich in {hlink.kanal === 'whatsapp' ? 'WhatsApp' : 'deinem Mail-Programm'} – du kannst sie
            vor dem Senden noch ändern. Wir speichern nichts.
          </p>
        </>
      ) : (
      <>
      <span className="al-schritt">
        Schritt {nr} von {gesamt}
      </span>

      {schritt === 1 && (
        <>
          <p className="al-frage">Wo willst du mitspielen?</p>
          <ul className="al-opts">
            {MANNSCHAFTEN.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="al-opt"
                  onClick={() => {
                    setMannschaft(m)
                    setSchritt(2)
                  }}
                >
                  <span className="al-opt__txt">
                    <b>{m.name}</b>
                    {m.hinweis && <small>{m.hinweis}</small>}
                  </span>
                  <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                </button>
              </li>
            ))}
            {/* v19-K (Audit B §4.7): vierte Option — ohne Fußball, fürs Ehrenamt */}
            <li>
              <button type="button" className="al-opt al-opt--helfer" onClick={() => setHelfer(true)}>
                <span className="al-opt__txt">
                  <b>Mithelfen am Spieltag</b>
                  <small>Grill, Getränke, Auf- und Abbau — kein Fußball nötig</small>
                </span>
                <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </li>
          </ul>
        </>
      )}

      {schritt === 2 && mannschaft && (
        <>
          <p className="al-frage">Wo spielst du am liebsten?</p>
          <div className="al-chips" role="group" aria-label="Position">
            {POSITIONEN.map((p) => (
              <button
                key={p}
                type="button"
                className="al-chip"
                aria-pressed={position === p}
                onClick={() => {
                  setPosition(p)
                  setSchritt(3)
                }}
              >
                {p === 'Egal' ? 'Weiß ich noch nicht' : p}
              </button>
            ))}
          </div>
          <div className="al-aktionen">
            {MANNSCHAFTEN.length > 1 && (
              <button type="button" className="al-link" onClick={() => setSchritt(1)}>
                <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" /> {mannschaft.name}
              </button>
            )}
            <button type="button" className="al-link" onClick={() => setSchritt(3)}>
              Überspringen <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
            </button>
          </div>
        </>
      )}

      {schritt === 3 && anfrage && link && tr && (
        <>
          <p className="al-frage">Fast fertig</p>
          <p className="al-lead">Name und Jahrgang sind freiwillig – damit weiß der Trainer gleich, wer kommt.</p>
          <div className="al-felder">
            <div className="al-feld">
              <label htmlFor="al-probe-vorname">Vorname</label>
              <input id="al-probe-vorname" value={vorname} onChange={(e) => setVorname(e.target.value.slice(0, 40))} autoComplete="given-name" enterKeyHint="next" />
            </div>
            <div className="al-feld">
              <label htmlFor="al-probe-jahrgang">Jahrgang</label>
              <input
                id="al-probe-jahrgang"
                value={jahrgang}
                onChange={(e) => setJahrgang(e.target.value.replace(/\D/g, '').slice(0, 4))}
                inputMode="numeric"
                placeholder="z. B. 2001"
                enterKeyHint="done"
              />
            </div>
          </div>
          <pre className="al-vorschau" aria-label="Deine Nachricht">
            {nachricht(anfrage)}
          </pre>
          <div className="al-aktionen">
            <a
              className="ds-btn ds-btn--primary"
              href={link.href}
              target={link.kanal === 'whatsapp' ? '_blank' : undefined}
              rel={link.kanal === 'whatsapp' ? 'noopener' : undefined}
              onClick={() => zaehleEreignis('probetraining')}
              data-kanal={link.kanal}
            >
              {link.kanal === 'whatsapp' ? <WaIcon size={18} /> : <MailIcon size={18} />}
              {link.kanal === 'whatsapp' ? 'In WhatsApp öffnen' : 'Per E-Mail senden'}
            </a>
            <button type="button" className="al-link" onClick={() => setSchritt(2)}>
              <ArrowLeft size={14} strokeWidth={1.5} aria-hidden="true" /> Zurück
            </button>
          </div>
          <dl className="al-training">
            <div>
              <dt>Wann</dt>
              <dd>{tr.wann}</dd>
            </div>
            {tr.wo && (
              <div>
                <dt>Wo</dt>
                <dd>{tr.wo}</dd>
              </div>
            )}
          </dl>
          <p className="al-note">Die Nachricht öffnet sich in {link.kanal === 'whatsapp' ? 'WhatsApp' : 'deinem Mail-Programm'} – du kannst sie vor dem Senden noch ändern. Wir speichern nichts.</p>
        </>
      )}
      </>
      )}
    </Sheet>
  )
}

/** Auslöser für den Assistenten. `mannschaft` = Vorauswahl (z. B. „jugend“). */
export function ProbetrainingKnopf({
  className = 'ds-btn ds-btn--primary',
  label = 'Probetraining anfragen',
  mannschaft,
  icon = true,
  autoOpen = false,
}: {
  className?: string
  label?: string
  mannschaft?: string
  icon?: boolean
  /** v19-K: beim Einstieg über /probetraining das Sheet sofort öffnen. */
  autoOpen?: boolean
}) {
  const { ausloeser, offen, auf, zu } = useSheetAusloeser()
  // v19-K (Audit B §2.5.1): /probetraining öffnet den Assistenten direkt.
  useEffect(() => {
    if (autoOpen) auf()
  }, [autoOpen, auf])
  return (
    <>
      <button type="button" className={className} ref={ausloeser} onClick={auf} aria-haspopup="dialog">
        {label}
        {icon && <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />}
      </button>
      {offen && <ProbetrainingSheet open onClose={zu} start={mannschaft} />}
    </>
  )
}
