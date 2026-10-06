import { useEffect, useRef, useState } from 'react'
import { animate, motion, useReducedMotion } from 'framer-motion'
import { Check, Minus, RotateCcw, Sparkles, X } from 'lucide-react'
import type { KaderSpieler, TippSpiel } from './api'
import { BONUS, POSTEN_LABEL, aufloesungGesehen, aufloesungMerken, bonusLabel, nachname } from './model'
import { SpielerGesicht } from './SpielerKarte'

// ─────────────────────────────────────────────────────────────
// v20-T: Auflösung nach der Wertung. Beim ersten Ansehen zählen die
// Punkte Zeile für Zeile hoch (Frage für Frage, Spieler für Spieler), die
// Summe läuft mit. Danach ruhig; „Nochmal ansehen“ spielt es erneut ab.
// Reduzierte Bewegung: sofort der Endstand.
// ─────────────────────────────────────────────────────────────

function Zaehler({ ziel, start, dauer = 0.7, vorzeichen = false }: { ziel: number; start: boolean; dauer?: number; vorzeichen?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null)
  const vorher = useRef(0)
  const ruhig = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fmt = (n: number) => `${vorzeichen && n > 0 ? '+' : ''}${n}`
    if (!start || ruhig) {
      el.textContent = fmt(ziel)
      vorher.current = ziel
      return
    }
    // vom zuletzt gezeigten Wert weiterzählen (nicht jedes Mal von 0)
    const a = animate(vorher.current, ziel, {
      duration: dauer,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = fmt(Math.round(v))),
      onComplete: () => (vorher.current = ziel),
    })
    return () => {
      a.stop()
      vorher.current = ziel
    }
  }, [ziel, start, dauer, ruhig, vorzeichen])
  return <span ref={ref}>{vorzeichen && ziel > 0 ? '+' : ''}{start && !ruhig ? 0 : ziel}</span>
}

interface Zeile {
  key: string
  titel: string
  detail?: string
  punkte: number
  status: 'ja' | 'nein' | 'offen' | 'info'
  spieler?: KaderSpieler
  posten?: string
  kapitaen?: boolean
}

export function Aufloesung({ spiel, kader, platz }: { spiel: TippSpiel; kader: Map<string, KaderSpieler>; platz?: { platz: number; von: number } }) {
  const p = spiel.meinePunkte
  const ruhig = useReducedMotion()
  const [lauf, setLauf] = useState(() => (aufloesungGesehen(spiel.id) || ruhig ? -1 : 0))

  const d = p?.details
  const t = spiel.meinTipp
  const zeilen: Zeile[] = []
  if (d?.tipp && t) {
    const tipp = spiel.heim ? `${t.toreSva}:${t.toreGegner}` : `${t.toreGegner}:${t.toreSva}`
    const art = { exakt: 'Exakt!', differenz: 'Tordifferenz', tendenz: 'Tendenz', daneben: 'Daneben', kein: '–' }[d.tipp.art]
    zeilen.push({ key: 'erg', titel: `Ergebnis ${tipp}`, detail: art, punkte: d.tipp.ergebnis, status: d.tipp.ergebnis > 0 ? 'ja' : 'nein' })
    if (t.ersterTorschuetze) {
      const k = kader.get(t.ersterTorschuetze)
      zeilen.push({ key: 'tor', titel: 'Erster Torschütze', detail: k ? nachname(k.name) : '–', punkte: d.tipp.torschuetze, status: d.tipp.torschuetze ? 'ja' : 'nein', spieler: k })
    }
    if (t.motm) {
      const k = kader.get(t.motm)
      zeilen.push({
        key: 'motm',
        titel: 'Spieler des Spiels',
        detail: spiel.motm ? (k ? nachname(k.name) : '–') : 'Wahl läuft auf Instagram',
        punkte: d.tipp.motm,
        status: !spiel.motm ? 'offen' : d.tipp.motm ? 'ja' : 'nein',
        spieler: k,
      })
    }
    for (const f of spiel.fragen) {
      const r = d.tipp.bonus?.[f.key]
      zeilen.push({
        key: `b-${f.key}`,
        titel: BONUS[f.key].kurz,
        detail: `${bonusLabel(f.key, t.bonus?.[f.key])}${spiel.aufloesung?.[f.key] ? ` · richtig: ${bonusLabel(f.key, spiel.aufloesung[f.key])}` : ''}`,
        punkte: r ?? 0,
        status: r == null ? 'offen' : r ? 'ja' : 'nein',
      })
    }
    if (d.tipp.joker) zeilen.push({ key: 'joker', titel: 'Joker', detail: `${d.tipp.summe} × 2`, punkte: d.tipp.summe, status: 'info' })
  }
  for (const e of d?.elf ?? []) {
    const k = kader.get(e.id)
    zeilen.push({
      key: `e-${e.id}`,
      titel: k ? nachname(k.name) : e.id,
      detail: e.eingesetzt ? e.posten.map((x) => `${POSTEN_LABEL[x.k]}${x.n && x.n > 1 ? ` ×${x.n}` : ''} ${x.p > 0 ? '+' : ''}${x.p}`).join(' · ') : 'nicht eingesetzt',
      punkte: e.gesamt,
      status: e.gesamt > 0 ? 'ja' : e.gesamt < 0 ? 'nein' : 'info',
      spieler: k,
      kapitaen: e.kapitaen,
    })
  }
  const anzahl = zeilen.length

  // Zeile für Zeile aufdecken
  useEffect(() => {
    if (lauf < 0) return
    if (lauf >= anzahl) {
      aufloesungMerken(spiel.id)
      return
    }
    const t = window.setTimeout(() => setLauf((n) => n + 1), lauf === 0 ? 450 : 380)
    return () => window.clearTimeout(t)
  }, [lauf, anzahl, spiel.id])

  if (!p) return null
  const fertig = lauf < 0 || lauf >= zeilen.length
  const bisher = fertig ? p.gesamt : zeilen.slice(0, lauf).reduce((a, z) => a + z.punkte, 0)

  return (
    <section className="tp-aufl" aria-labelledby="tp-h-aufl">
      <div className="tp-aufl__summe">
        <p className="tp-kicker" id="tp-h-aufl">
          Deine Punkte
        </p>
        <b className="tp-aufl__zahl" aria-live="polite">
          <Zaehler ziel={bisher} start={lauf >= 0} dauer={0.35} />
        </b>
        <p className="tp-aufl__teile">
          Tipp {p.joker ? `${p.tipp} × 2` : p.tipp} · Elf {p.elf}
          {platz && (
            <>
              {' '}· Platz <b>{platz.platz}</b> von {platz.von}
            </>
          )}
        </p>
      </div>
      <ul className="tp-aufl__liste">
        {zeilen.map((z, i) => {
          const sichtbar = lauf < 0 || i < lauf
          return (
            <motion.li
              key={z.key}
              className={`tp-aufl__zeile is-${z.status}${z.kapitaen ? ' is-kapitaen' : ''}${z.key.startsWith('e-') && !zeilen[i - 1]?.key.startsWith('e-') ? ' is-erste-elf' : ''}`}
              initial={false}
              animate={{ opacity: sichtbar ? 1 : 0.18, x: sichtbar ? 0 : -6 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {z.spieler ? <SpielerGesicht spieler={z.spieler} groesse={40} /> : <span className="tp-aufl__icon">{z.status === 'ja' ? <Check size={18} strokeWidth={2} /> : z.status === 'nein' ? <X size={18} strokeWidth={2} /> : z.key === 'joker' ? <Sparkles size={18} strokeWidth={1.5} /> : <Minus size={18} strokeWidth={2} />}</span>}
              <span className="tp-aufl__text">
                <b>
                  {z.titel}
                  {z.kapitaen && <span className="tp-binde tp-binde--klein">C ×2</span>}
                </b>
                {z.detail && <small>{z.detail}</small>}
              </span>
              <span className="tp-aufl__p">{sichtbar ? <Zaehler ziel={z.punkte} start={lauf >= 0} vorzeichen /> : ''}</span>
            </motion.li>
          )
        })}
      </ul>
      {fertig && zeilen.length > 0 && !ruhig && (
        <button type="button" className="tp-link" onClick={() => setLauf(0)}>
          <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" /> Nochmal ansehen
        </button>
      )}
    </section>
  )
}
