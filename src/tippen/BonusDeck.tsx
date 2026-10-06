import { useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform, type PanInfo } from 'framer-motion'
import { Pencil } from 'lucide-react'
import type { BonusKey, TippSpiel } from './api'
import { BONUS, bonusLabel } from './model'

// ─────────────────────────────────────────────────────────────
// v20-T: Bonusfragen als Karten-Stapel. Antwort per Tipp — bei Ja/Nein-
// Fragen auch per Wisch (rechts = Ja/Mehr, links = Nein/Weniger). Die Karte
// fliegt raus, die nächste rückt nach. Danach eine ruhige Übersicht, jede
// Antwort ist bis zum Anpfiff änderbar.
// ─────────────────────────────────────────────────────────────

type Antworten = Partial<Record<BonusKey, string>>

function erstOffen(fragen: TippSpiel['fragen'], bonus: Antworten): number | null {
  const i = fragen.findIndex((f) => !bonus[f.key])
  return i === -1 ? null : i
}

export function BonusDeck({
  fragen,
  bonus,
  onAntwort,
  gesperrt,
}: {
  fragen: TippSpiel['fragen']
  bonus: Antworten
  onAntwort: (key: BonusKey, wert: string) => void
  gesperrt?: boolean
}) {
  const [aktiv, setAktiv] = useState<number | null>(() => erstOffen(fragen, bonus))
  const [flug, setFlug] = useState(0) // Richtung der rausfliegenden Karte

  const antworten = (i: number, wert: string, richtung: number) => {
    const f = fragen[i]
    setFlug(richtung)
    onAntwort(f.key, wert)
    const neu = { ...bonus, [f.key]: wert }
    // nächste offene Frage NACH dieser, sonst irgendeine offene, sonst Übersicht
    const danach = fragen.findIndex((g, j) => j > i && !neu[g.key])
    setAktiv(danach !== -1 ? danach : erstOffen(fragen, neu))
  }

  const beantwortet = fragen.filter((f) => bonus[f.key]).length

  if (aktiv === null || gesperrt) {
    return (
      <ul className="tp-bonusliste">
        {fragen.map((f, i) => {
          const def = BONUS[f.key]
          return (
            <li key={f.key}>
              <button type="button" onClick={() => !gesperrt && setAktiv(i)} disabled={gesperrt} aria-label={`${def.frage(f.linie)} Deine Antwort: ${bonusLabel(f.key, bonus[f.key])}. Ändern`}>
                <span className="tp-bonusliste__frage">{def.frage(f.linie)}</span>
                <span className={`tp-chip${bonus[f.key] ? ' is-an' : ''}`}>{bonusLabel(f.key, bonus[f.key])}</span>
                {!gesperrt && <Pencil size={14} strokeWidth={1.5} aria-hidden="true" className="tp-bonusliste__stift" />}
              </button>
            </li>
          )
        })}
      </ul>
    )
  }

  return (
    <div className="tp-deck" aria-live="polite">
      <div className="tp-deck__punkte" aria-label={`${beantwortet} von ${fragen.length} beantwortet`}>
        {fragen.map((f, i) => (
          <i key={f.key} className={bonus[f.key] ? 'is-an' : i === aktiv ? 'is-jetzt' : ''} />
        ))}
      </div>
      <div className="tp-deck__stapel">
        {/* Rückseiten der folgenden Karten (Tiefe) */}
        {fragen.length - beantwortet > 1 && <div className="tp-deck__hinten tp-deck__hinten--2" aria-hidden="true" />}
        {fragen.length - beantwortet > 2 && <div className="tp-deck__hinten tp-deck__hinten--3" aria-hidden="true" />}
        <AnimatePresence initial={false} custom={flug}>
          <FrageKarte key={fragen[aktiv].key} frage={fragen[aktiv]} nr={aktiv + 1} von={fragen.length} wert={bonus[fragen[aktiv].key]} flug={flug} onWahl={(w, r) => antworten(aktiv, w, r)} />
        </AnimatePresence>
      </div>
      {beantwortet === fragen.length && (
        <button type="button" className="tp-link" onClick={() => setAktiv(null)}>
          Fertig
        </button>
      )}
    </div>
  )
}

function FrageKarte({
  frage,
  nr,
  von,
  wert,
  flug,
  onWahl,
}: {
  frage: TippSpiel['fragen'][number]
  nr: number
  von: number
  wert?: string
  flug: number
  onWahl: (wert: string, richtung: number) => void
}) {
  const def = BONUS[frage.key]
  const zwei = def.optionen.length === 2
  const x = useMotionValue(0)
  const drehen = useTransform(x, [-200, 200], [-9, 9])
  const rechts = useTransform(x, [20, 110], [0, 1])
  const links = useTransform(x, [-110, -20], [1, 0])

  const ende = (_: unknown, info: PanInfo) => {
    if (!zwei) return
    const weit = Math.abs(info.offset.x) > 90 || Math.abs(info.velocity.x) > 600
    if (!weit) return
    if (info.offset.x > 0) onWahl(def.optionen[0].wert, 1)
    else onWahl(def.optionen[1].wert, -1)
  }

  return (
    <motion.div
      className="tp-frage"
      style={{ x, rotate: drehen }}
      drag={zwei ? 'x' : false}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={ende}
      initial={{ scale: 0.94, y: 14, opacity: 0 }}
      animate={{ scale: 1, y: 0, opacity: 1 }}
      exit={{ x: flug >= 0 ? 360 : -360, rotate: flug >= 0 ? 14 : -14, opacity: 0, transition: { duration: 0.32, ease: [0.4, 0, 0.6, 1] } }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="tp-frage__nr">
        Bonusfrage {nr}/{von} · +1 Punkt
      </p>
      <p className="tp-frage__text">{def.frage(frage.linie)}</p>
      {zwei && (
        <>
          <motion.span className="tp-frage__stempel tp-frage__stempel--rechts" style={{ opacity: rechts }} aria-hidden="true">
            {def.optionen[0].label}
          </motion.span>
          <motion.span className="tp-frage__stempel tp-frage__stempel--links" style={{ opacity: links }} aria-hidden="true">
            {def.optionen[1].label}
          </motion.span>
        </>
      )}
      <div className={`tp-frage__optionen tp-frage__optionen--${def.optionen.length}`}>
        {(zwei ? [def.optionen[1], def.optionen[0]] : def.optionen).map((o) => (
          <button
            key={o.wert}
            type="button"
            className={`tp-option${wert === o.wert ? ' is-an' : ''}`}
            onClick={() => onWahl(o.wert, zwei ? (o.wert === def.optionen[0].wert ? 1 : -1) : 1)}
          >
            {o.label}
          </button>
        ))}
      </div>
      {zwei && <p className="tp-frage__wisch">oder wischen</p>}
    </motion.div>
  )
}
