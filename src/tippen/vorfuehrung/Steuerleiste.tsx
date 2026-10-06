import { useEffect, useState, useSyncExternalStore } from 'react'
import { motion } from 'framer-motion'
import { ClipboardCheck, FastForward, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { ENDE_MINUTE, PHASEN, naechstesEreignis, phaseSetzen, simAbo, simLesen, simSetzen, simVergessen, wertungAusloesen } from './store'
import { PACK_TYPEN_STANDARD, kartenWort, type PackTyp } from '../../album/packTypen'
import { uebergeben, uebergabeLeeren } from '../../album/vorfuehrung/uebergabe'
import { EREIGNIS_MINUTEN } from './sim'
import { haptik } from '../model'

// v21-UX (Befund 6): beim Runterscrollen klappt der Kopf ein (mehr Sichtfenster
// fürs Spiel). Nur am Handy — Desktop hat Platz genug.
function useKompakt(): boolean {
  const [k, setK] = useState(false)
  useEffect(() => {
    const f = () => setK(window.scrollY > 120 && window.innerWidth < 1024)
    f()
    window.addEventListener('scroll', f, { passive: true })
    window.addEventListener('resize', f)
    return () => {
      window.removeEventListener('scroll', f)
      window.removeEventListener('resize', f)
    }
  }, [])
  return k
}

// ─────────────────────────────────────────────────────────────
// v21-T: Steuerleiste der Vorführung — deutlich als „Vorführung“
// markiert. Phasen durchschalten; live: Pause/Weiter, nächstes Ereignis,
// Tempo. Alles nur im Browser.
// ─────────────────────────────────────────────────────────────

// v24-P: jeden Pack-Typ vorführen — Pack wird an die Album-Vorführung übergeben
// und dort sofort geöffnet (gleicher Weg wie das Tipp-Pack nach dem Tippen).
const ART: Record<PackTyp, string> = { tipp: 'tipp', spieltag: 'checkin', sieg: 'heimsieg', starter: 'starter', ziel: 'ziel', event: 'event' }
let packNr = 0
function packVorfuehren(typ: PackTyp) {
  const t = PACK_TYPEN_STANDARD.find((x) => x.typ === typ)!
  const p = uebergeben({ id: `vf-typ-${typ}-${Date.now().toString(36)}-${++packNr}`, art: ART[typ], typ, titel: typ === 'event' ? 'Event-Pack · MOTM-Woche' : t.titel, karten: t.karten, gegner: typ === 'spieltag' || typ === 'sieg' ? 'TuS Fischbek' : undefined })
  window.location.assign(`/album?vorfuehrung=1&oeffnen=${encodeURIComponent(p.id)}`)
}

export default function Steuerleiste() {
  const z = useSyncExternalStore(simAbo, simLesen)
  const kompakt = useKompakt()
  const minute = Math.min(90, Math.floor(z.minute))
  const nachspiel = z.minute > 90 ? Math.ceil(z.minute - 90) : 0
  return (
    <section className={`tp-steuer${kompakt ? ' is-kompakt' : ''}`} aria-label="Vorführung steuern">
      <div className="tp-steuer__kopf">
        <span className="tp-steuer__marke">
          <i aria-hidden="true" /> Vorführung
        </span>
        <span className="tp-steuer__info">Simulierte Daten · nichts wird gespeichert</span>
      </div>
      <div className="tp-steuer__phasen" role="tablist" aria-label="Phase">
        {PHASEN.map((p) => (
          <button
            key={p.id}
            type="button"
            role="tab"
            aria-selected={z.phase === p.id}
            onClick={() => {
              haptik(10)
              phaseSetzen(p.id)
            }}
          >
            {z.phase === p.id && <motion.i className="tp-steuer__mark" layoutId="tp-steuer-mark" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
            <span>{p.label}</span>
          </button>
        ))}
      </div>
      <div className="tp-steuer__packs" role="group" aria-label="Pack-Typen vorführen">
        <span className="tp-steuer__packs-label">Packs</span>
        {PACK_TYPEN_STANDARD.map((t) => (
          <button key={t.typ} type="button" className={`tp-steuer__pack tp-steuer__pack--${t.optik}`} onClick={() => packVorfuehren(t.typ)} title={`${t.titel} · ${kartenWort(t.karten)} — im Album öffnen`}>
            <i aria-hidden="true" />
            {t.titel.replace(/-?Pack$/, '')}
          </button>
        ))}
        <button
          type="button"
          className="tp-steuer__pack tp-steuer__pack--neu"
          onClick={() => {
            simVergessen()
            uebergabeLeeren()
            window.location.assign('/tippen?vorfuehrung=1')
          }}
          title="Vorführung von vorn (Tipp, Ligen, Packs)"
        >
          <RotateCcw size={13} strokeWidth={2} aria-hidden="true" /> Neu
        </button>
      </div>
      {z.phase === 'live' && (
        <div className="tp-steuer__live">
          <button type="button" className="tp-steuer__knopf" onClick={() => simSetzen({ laeuft: !z.laeuft })} aria-label={z.laeuft ? 'Anhalten' : 'Weiterlaufen lassen'} disabled={z.minute >= ENDE_MINUTE}>
            {z.laeuft ? <Pause size={16} strokeWidth={1.75} aria-hidden="true" /> : <Play size={16} strokeWidth={1.75} aria-hidden="true" />}
          </button>
          <button type="button" className="tp-steuer__knopf tp-steuer__knopf--text" onClick={() => naechstesEreignis(EREIGNIS_MINUTEN)}>
            <SkipForward size={16} strokeWidth={1.75} aria-hidden="true" /> Nächstes Ereignis
          </button>
          <button type="button" className={`tp-steuer__knopf${z.tempo === 3 ? ' is-an' : ''}`} onClick={() => simSetzen({ tempo: z.tempo === 3 ? 1 : 3 })} aria-label="Tempo" aria-pressed={z.tempo === 3}>
            <FastForward size={16} strokeWidth={1.75} aria-hidden="true" />
            <small>{z.tempo}×</small>
          </button>
          <span className="tp-steuer__uhr" aria-live="off">
            {minute}
            {nachspiel ? `+${nachspiel}` : ''}′
          </span>
          <span className="tp-steuer__balken" aria-hidden="true">
            <i style={{ transform: `scaleX(${Math.min(1, z.minute / ENDE_MINUTE)})` }} />
          </span>
        </div>
      )}
      {z.phase === 'abpfiff' && !z.gewertet && (
        <div className="tp-steuer__live">
          <span className="tp-steuer__wertung">
            <i aria-hidden="true" /> Spielbericht fehlt noch · nächster Spieltag gesperrt
          </span>
          <button type="button" className="tp-steuer__knopf tp-steuer__knopf--text" onClick={() => wertungAusloesen()}>
            <ClipboardCheck size={16} strokeWidth={1.75} aria-hidden="true" /> Jetzt werten
          </button>
        </div>
      )}
    </section>
  )
}
