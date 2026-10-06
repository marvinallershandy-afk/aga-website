import { useEffect, useState } from 'react'
import { AnimatePresence, motion, type PanInfo } from 'framer-motion'
import { ArrowRight, Crown, Radio, Ticket, Users } from 'lucide-react'
import { BELOHNUNGEN, haptik } from './model'
import { EASE, T_LANG } from './bewegung'

// ─────────────────────────────────────────────────────────────
// v21-T: „So funktioniert’s“ — 3 Schritte, beim ersten Besuch einmal
// (überspringbar), danach jederzeit über das „?“ in der Nächster-Schritt-
// Zeile, im Profil und im Fuß. Wischen oder „Weiter“.
// ─────────────────────────────────────────────────────────────

const SCHRITTE = ['tippen', 'belohnung', 'live'] as const

export function Einfuehrung({ offen, onZu }: { offen: boolean; onZu: () => void }) {
  const [i, setI] = useState(0)
  const [richtung, setRichtung] = useState(1)
  useEffect(() => {
    if (!offen) return
    const k = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onZu()
      if (e.key === 'ArrowRight') gehe(1)
      if (e.key === 'ArrowLeft') gehe(-1)
    }
    window.addEventListener('keydown', k)
    const vorher = document.documentElement.style.overflow
    document.documentElement.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', k)
      document.documentElement.style.overflow = vorher
    }
  })
  const gehe = (d: number) => {
    const n = i + d
    if (n < 0) return
    if (n >= SCHRITTE.length) return onZu()
    setRichtung(d)
    setI(n)
    haptik(6)
  }
  const ende = (_: unknown, info: PanInfo) => {
    if (Math.abs(info.offset.x) < 60 && Math.abs(info.velocity.x) < 500) return
    gehe(info.offset.x < 0 ? 1 : -1)
  }
  return (
    <AnimatePresence onExitComplete={() => setI(0)}>
      {offen && (
        <motion.div className="tp-einf" role="dialog" aria-modal="true" aria-labelledby="tp-einf-titel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
          <motion.div className="tp-einf__inner" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={T_LANG}>
            <div className="tp-einf__kopf">
              <span className="tp-einf__nr">
                {i + 1}/{SCHRITTE.length}
              </span>
              <button type="button" className="tp-btn tp-btn--text tp-btn--sm" onClick={onZu}>
                Überspringen
              </button>
            </div>
            <div className="tp-einf__buehne">
              <AnimatePresence initial={false} custom={richtung} mode="popLayout">
                <motion.div
                  key={SCHRITTE[i]}
                  className="tp-einf__schritt"
                  custom={richtung}
                  variants={{ rein: (r: number) => ({ x: r * 60, opacity: 0 }), da: { x: 0, opacity: 1 }, raus: (r: number) => ({ x: r * -60, opacity: 0 }) }}
                  initial="rein"
                  animate="da"
                  exit="raus"
                  transition={T_LANG}
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.35}
                  onDragEnd={ende}
                >
                  {SCHRITTE[i] === 'tippen' && <SchrittTippen />}
                  {SCHRITTE[i] === 'belohnung' && <SchrittBelohnung />}
                  {SCHRITTE[i] === 'live' && <SchrittLive />}
                </motion.div>
              </AnimatePresence>
            </div>
            <div className="tp-einf__fuss">
              <div className="tp-einf__punkte" aria-hidden="true">
                {SCHRITTE.map((s, j) => (
                  <i key={s} className={j === i ? 'is-an' : j < i ? 'is-war' : ''} />
                ))}
              </div>
              <button type="button" className="tp-btn tp-einf__weiter" onClick={() => gehe(1)}>
                {i < SCHRITTE.length - 1 ? 'Weiter' : 'Los geht’s'} <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

function SchrittTippen() {
  return (
    <>
      <div className="tp-einf__bild tp-einf__bild--tipp" aria-hidden="true">
        <span className="tp-einf__stand">
          2<i>:</i>1
        </span>
        <span className="tp-einf__chips">
          <b>Gelb 1–2</b>
          <b>Tor vor der 20.? Nein</b>
          <b>Elfmeter? Ja</b>
        </span>
        <span className="tp-einf__elf">
          {['TW', 'ABW', 'MIT', 'MIT', 'ANG'].map((p, j) => (
            <i key={j} className={j === 4 ? 'is-kap' : ''}>
              {j === 4 ? <Crown size={12} strokeWidth={2} /> : p}
            </i>
          ))}
        </span>
      </div>
      <p className="tp-kicker">Schritt 1 · 20 Sekunden</p>
      <h2 className="tp-titel" id="tp-einf-titel">
        Tippen bis zum Anpfiff
      </h2>
      <p className="tp-lead">
        Ergebnis, drei Bonusfragen und deine Elf: 1 Torwart, 1 Abwehr, 2 Mittelfeld, 1 Angriff. Tipp die Binde „C“ an — dein Kapitän zählt doppelt. Alles bleibt bis zum Anpfiff änderbar.
      </p>
    </>
  )
}

function SchrittBelohnung() {
  return (
    <>
      <div className="tp-einf__bild tp-einf__bild--karte" aria-hidden="true">
        <span className="tp-einf__karte">
          <img src="/brand/aga-logo.png" alt="" width="40" height="47" />
          <b>+1</b>
        </span>
        <span className="tp-einf__lose">
          <Ticket size={22} strokeWidth={1.5} />
          <Ticket size={22} strokeWidth={1.5} />
        </span>
      </div>
      <p className="tp-kicker">Schritt 2 · Was du bekommst</p>
      <h2 className="tp-titel">Jeder Tipp füllt dein Album</h2>
      <ul className="tp-belohnungen">
        {BELOHNUNGEN.map((b) => (
          <li key={b.wann} className={`is-${b.art}`}>
            <span>{b.wann}</span>
            <b>{b.was}</b>
          </li>
        ))}
      </ul>
    </>
  )
}

function SchrittLive() {
  return (
    <>
      <div className="tp-einf__bild tp-einf__bild--live" aria-hidden="true">
        <span className="tp-einf__bug">
          <i>
            <Radio size={12} strokeWidth={2} /> Live 67′
          </i>
          <b>2:1</b>
        </span>
        <span className="tp-einf__pkt">
          <b>34</b>
          <small>Punkte live</small>
        </span>
      </div>
      <p className="tp-kicker">Schritt 3 · Am Spieltag</p>
      <h2 className="tp-titel">Punkte live, Auflösung am Abend</h2>
      <p className="tp-lead">
        Während des Spiels rechnen deine Punkte live mit. Nach dem Spielbericht (meist am selben Abend) zählt die Auflösung hoch, am Montag kommen die
        Punkte für den Spieler des Spiels dazu.
      </p>
      <p className="tp-einf__ligen">
        <Users size={16} strokeWidth={1.5} aria-hidden="true" /> Gründe eine Liga mit Freunden — und schlagt gemeinsam die Kabine.
      </p>
    </>
  )
}
