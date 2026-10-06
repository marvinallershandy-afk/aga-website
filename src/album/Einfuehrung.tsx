import { useEffect, useRef, useState } from 'react'
import { BookOpen, Gift, Medal, Sparkles, Ticket, X, Hand, QrCode, Trophy, Smartphone } from 'lucide-react'
import { IgIcon } from '../ui/Icons'
import type { Katalog } from './api'
import { einfuehrungMerken as merken } from './einfuehrung-logik'
import './einfuehrung.css'

// ─────────────────────────────────────────────────────────────
// v22-A: „So funktioniert’s“ — Einführung für neue Fans (einmal nach dem
// ersten Aufschlagen, danach über den Fragezeichen-Knopf). Beantwortet die
// Fragen aus der Sichtung: Was bekomme ich wann? Wie öffne ich Tütchen?
// Was ist ein Kapitel / Ziel / Los? Was sind Glanz, Shiny, Geheimkarten?
// Zahlen kommen aus den Regeln (Admin), nicht hart verdrahtet.
// ─────────────────────────────────────────────────────────────

export function KartenQuellen({ katalog, onMehr }: { katalog: Katalog; onMehr: () => void }) {
  const r = katalog.regeln
  const zeilen: [React.ReactNode, string, string][] = [
    [<QrCode key="q" size={18} strokeWidth={1.5} />, 'Heimspiel: QR-Code am Eingang', `${r.kartenProPack} Karten${r.bonusHeimsieg ? ` · Heimsieg +${r.kartenHeimsieg ?? 1}` : ''}`],
    [<Trophy key="t" size={18} strokeWidth={1.5} />, 'Tipp in der Tipp-Liga', `${r.kartenTipp ?? 1} Karte je Tipp`],
    [<IgIcon key="i" size={17} />, 'Code aus unserer Story', `${r.kartenStory ?? 1} Karte`],
    [<Medal key="m" size={18} strokeWidth={1.5} />, 'Ziel oder Kapitel geschafft', 'Bonus-Karte + Medaille'],
  ]
  return (
    <div className="kq">
      <h3 className="hf-zwischen">So kommst du an Karten</h3>
      <ul className="kq__liste">
        {zeilen.map(([icon, was, wieviel]) => (
          <li key={was}>
            <span className="kq__icon" aria-hidden="true">
              {icon}
            </span>
            <span className="kq__was">{was}</span>
            <b className="kq__wieviel">{wieviel}</b>
          </li>
        ))}
      </ul>
      <button type="button" className="hf-link kq__mehr" onClick={onMehr}>
        Wie funktioniert das Album? Kurz erklärt
      </button>
    </div>
  )
}

export function Einfuehrung({ katalog, onZu }: { katalog: Katalog; onZu: () => void }) {
  const r = katalog.regeln
  const [n, setN] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const schritte: { icon: React.ReactNode; kicker: string; titel: string; text: React.ReactNode; chips?: string[] }[] = [
    {
      icon: <BookOpen size={30} strokeWidth={1.5} />,
      kicker: 'Willkommen im Album',
      titel: 'Sammel deinen SVA',
      text: <>Jeder Platz im Album ist ein Spieler, ein Trainer, ein Moment, die Kurve oder ein Partner. Zum Start bekommst du {r.kartenStarter ?? 5} Karten geschenkt.</>,
      chips: ['Kostenlos', 'Nichts zu kaufen', 'Nur Dabeisein zählt'],
    },
    {
      icon: <Gift size={30} strokeWidth={1.5} />,
      kicker: 'Was bekomme ich wann?',
      titel: 'Karten kommen in Tütchen',
      text: (
        <>
          Bei jedem Heimspiel scannst du am Eingang den QR-Code: {r.kartenProPack} Karten{r.bonusHeimsieg ? `, bei einem Heimsieg +${r.kartenHeimsieg ?? 1}` : ''}. Dazu {r.kartenTipp ?? 1} Karte je Tipp in der Tipp-Liga und
          Codes aus unserer Instagram-Story. Die erste Karte jedes Tütchens fehlt dir garantiert noch.
        </>
      ),
      chips: [`Heimspiel ${r.kartenProPack}`, `Tipp ${r.kartenTipp ?? 1}`, `Story ${r.kartenStory ?? 1}`],
    },
    {
      icon: <Hand size={30} strokeWidth={1.5} />,
      kicker: 'Tütchen öffnen',
      titel: 'Antippen, aufreißen, staunen',
      text: <>Das rote Tütchen oben rechts zeigt, wie viele warten. Antippen, mit dem Finger über die Lasche wischen (oder „Aufreißen“) und die Karten aufdecken. Neue Karten fliegen danach von selbst an ihren Platz.</>,
    },
    {
      icon: <Medal size={30} strokeWidth={1.5} />,
      kicker: 'Kapitel · Ziele · Doppelte',
      titel: 'Seiten füllen, Medaillen holen',
      text: (
        <>
          Ein <b>Kapitel</b> ist eine Seite (Tor, Abwehr, Momente …) — komplett gibt es ein Abzeichen und eine Bonus-Karte. <b>Ziele</b> sind kleine Missionen wie „Die Zwillinge“, dafür gibt es Medaillen. <b>Doppelte</b> tauschst
          du mit Freunden oder machst aus {r.wunschKosten ?? 3} Doppelten eine Wunschkarte.
        </>
      ),
    },
    {
      icon: <Ticket size={30} strokeWidth={1.5} />,
      kicker: 'Lose & Belohnungen',
      titel: 'Treue zahlt sich aus',
      text: (
        <>
          {r.belohnungen
            .filter((b) => b.checkins && !(b.stufe === 'schwelle_3'))
            .map((b) => `${b.checkins}. Heimspiel: ${b.titel}`)
            .join(' · ')}
          . Jeder Check-in und viele Ziele bringen <b>Lose</b> — je mehr Lose, desto besser deine Chance bei unseren Verlosungen.
        </>
      ),
    },
    {
      icon: <Sparkles size={30} strokeWidth={1.5} />,
      kicker: 'Selten & geheim',
      titel: 'Glanz, Shiny und Geheimnisse',
      text: (
        <>
          <b>Glanz</b> ist eine schönere Fassung derselben Person — Seltenheit bewertet nie einen Spieler. Ganz selten ({r.shinyChance ? `1 : ${r.shinyChance}` : 'sehr selten'}) erscheint eine Karte als <b>Shiny</b> in
          Schwarz-Gold: reines Glück, eigene Vitrine, wer zuerst zieht, steht auf der Karte. Und ein paar <b>Geheimkarten</b> bekommt man nur durch Entdecken …
        </>
      ),
    },
  ]
  const s = schritte[n]
  const letzte = n === schritte.length - 1
  const zu = () => {
    merken()
    onZu()
  }
  useEffect(() => {
    ref.current?.focus()
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') zu()
      if (e.key === 'ArrowRight') setN((x) => Math.min(schritte.length - 1, x + 1))
      if (e.key === 'ArrowLeft') setN((x) => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="ef" role="dialog" aria-modal="true" aria-label="So funktioniert das Album" onClick={zu}>
      <div className="ef__blatt" ref={ref} tabIndex={-1} onClick={(e) => e.stopPropagation()}>
        <button type="button" className="ef__x" onClick={zu} aria-label="Einführung schließen">
          <X size={18} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <div className="ef__inhalt" key={n}>
          <span className="ef__icon" aria-hidden="true">
            {s.icon}
          </span>
          <p className="ef__kicker">
            {n + 1}/{schritte.length} · {s.kicker}
          </p>
          <h2 className="ef__titel">{s.titel}</h2>
          <p className="ef__text">{s.text}</p>
          {s.chips && (
            <p className="ef__chips">
              {s.chips.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </p>
          )}
        </div>
        <div className="ef__fuss">
          <span className="ef__punkte" aria-hidden="true">
            {schritte.map((_, i) => (
              <i key={i} className={i === n ? 'is-jetzt' : i < n ? 'is-da' : ''} />
            ))}
          </span>
          {n > 0 && (
            <button type="button" className="al-btn al-btn--ghost al-btn--sm" onClick={() => setN(n - 1)}>
              Zurück
            </button>
          )}
          <button type="button" className="al-btn al-btn--sm" onClick={() => (letzte ? zu() : setN(n + 1))}>
            {letzte ? 'Los geht’s' : 'Weiter'}
          </button>
        </div>
        <p className="ef__tipp">
          <Smartphone size={14} strokeWidth={1.5} aria-hidden="true" /> Tipp: Karten antippen = groß ansehen, nochmal tippen = Rückseite.
        </p>
      </div>
    </div>
  )
}
