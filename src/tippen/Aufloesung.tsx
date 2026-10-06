import { useEffect, useRef, useState } from 'react'
import { animate, motion, useInView, useReducedMotion } from 'framer-motion'
import { Check, Minus, RotateCcw, Sparkles, X } from 'lucide-react'
import { IST_VORFUEHRUNG, type KaderSpieler, type TippSpiel } from './api'
import { BONUS, POSTEN_LABEL, aufloesungGesehen, aufloesungMerken, bonusLabel, haptik, nachname } from './model'
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

export function Aufloesung({ spiel, kader, platz, kompakt }: { spiel: TippSpiel; kader: Map<string, KaderSpieler>; platz?: { platz: number; von: number }; kompakt?: boolean }) {
  const p = spiel.meinePunkte
  const ruhig = useReducedMotion()
  // Vorführung: jedes Mal animiert (Phase „Abpfiff“ erneut wählen = nochmal ansehen)
  const [lauf, setLauf] = useState(() => (kompakt || ruhig || (!IST_VORFUEHRUNG && aufloesungGesehen(spiel.id)) ? -1 : 0))
  const [offen, setOffen] = useState(!kompakt)
  // erst hochzählen, wenn die Auflösung wirklich im Bild ist
  const sektion = useRef<HTMLElement>(null)
  const imBild = useInView(sektion, { once: true, amount: 0.25 })

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
    if (lauf < 0 || !imBild) return
    if (lauf >= anzahl) {
      if (!IST_VORFUEHRUNG) aufloesungMerken(spiel.id)
      haptik([14, 50, 24])
      return
    }
    const t = window.setTimeout(() => {
      setLauf((n) => n + 1)
      haptik(6)
    }, lauf === 0 ? 650 : 420)
    return () => window.clearTimeout(t)
  }, [lauf, anzahl, spiel.id, imBild])

  if (!p) return null
  const fertig = lauf < 0 || lauf >= zeilen.length
  const bisher = fertig ? p.gesamt : zeilen.slice(0, lauf).reduce((a, z) => a + z.punkte, 0)

  return (
    <section className={`tp-aufl${kompakt ? ' is-kompakt' : ''}`} aria-labelledby="tp-h-aufl" ref={sektion}>
      <div className="tp-aufl__summe">
        <p className="tp-aufl__label" id="tp-h-aufl">
          Deine Punkte
        </p>
        <b className={`tp-aufl__zahl${fertig && lauf >= 0 ? ' is-fertig' : ''}`} aria-live="polite">
          <Zaehler ziel={bisher} start={lauf >= 0} dauer={0.45} />
        </b>
        <p className="tp-aufl__teile">
          <span>
            Tipp <b>{p.joker ? `${p.tipp}×2` : p.tipp}</b>
          </span>
          <span>
            Elf <b>{p.elf}</b>
          </span>
          {platz && (
            <span>
              Platz <b>{platz.platz}</b>/{platz.von}
            </span>
          )}
        </p>
      </div>
      {kompakt && (
        <button type="button" className="tp-link" onClick={() => setOffen((x) => !x)} aria-expanded={offen}>
          {offen ? 'Details ausblenden' : 'So kamen die Punkte zustande'}
        </button>
      )}
      {offen && (
        <ul className="tp-aufl__liste">
          {zeilen.map((z, i) => {
            const sichtbar = lauf < 0 || i < lauf
            return (
              <motion.li
                key={z.key}
                className={`tp-aufl__zeile is-${z.status}${z.kapitaen ? ' is-kapitaen' : ''}${z.key.startsWith('e-') && !zeilen[i - 1]?.key.startsWith('e-') ? ' is-erste-elf' : ''}`}
                initial={false}
                animate={{ opacity: sichtbar ? 1 : 0.16, x: sichtbar ? 0 : -8 }}
                transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
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
      )}
      {offen && fertig && zeilen.length > 0 && !ruhig && !kompakt && (
        <button type="button" className="tp-link" onClick={() => setLauf(0)}>
          <RotateCcw size={14} strokeWidth={1.5} aria-hidden="true" /> Nochmal ansehen
        </button>
      )}
    </section>
  )
}
