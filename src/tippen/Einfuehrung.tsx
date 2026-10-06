import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight, Crown, Plus, Trophy, Users } from 'lucide-react'
import type { Preis } from './api'
import { BELOHNUNGEN, haptik, reduzierteBewegung } from './model'
import { EASE, T_LANG } from './bewegung'
import './einfuehrung.css'

// ─────────────────────────────────────────────────────────────
// v22-T: „So funktioniert’s“ als animierter Trailer (EA-FC-Intro-Gefühl):
// fünf Mini-Szenen à 3,6 s (zusammen 18 s), Fortschrittsbalken oben wie
// in einer Story, automatisch weiter, Tippen rechts/links = vor/zurück,
// „Überspringen“ jederzeit. Danach eine ruhige Seite „Das bekommst du“
// (Belohnungstabelle). Einmal beim ersten Besuch, jederzeit über
// „So funktioniert’s“ (Nächster-Schritt-„?“, Profil, Fuß).
//   1 Ergebnis tippen → 2 Karte fliegt ins Album → 3 Punkte zählen hoch
//   → 4 Rangliste steigt → 5 Preis winkt
// Bewegung: CSS-Keyframes (transform/opacity), Szene startet beim Einblenden
// neu. Reduzierte Bewegung: Endbild jeder Szene, kein Auto-Weiter.
// ─────────────────────────────────────────────────────────────

const SZENE_MS = 3600
const SZENEN = [
  { key: 'tipp', kicker: 'Vor dem Anpfiff', titel: 'Tipp das Ergebnis', text: 'Ergebnis, drei Bonusfragen, deine Elf mit Kapitän — in 20 Sekunden.' },
  { key: 'album', kicker: 'Sofort', titel: 'Jeder Tipp füllt dein Album', text: '+1 Karte fürs Sammelalbum — gleiches Konto, ein Login.' },
  { key: 'punkte', kicker: 'Während des Spiels', titel: 'Deine Punkte zählen live mit', text: 'Tor, Karte, Kapitän: die Hochrechnung läuft mit. Nach dem Spielbericht steht die Auflösung.' },
  { key: 'rang', kicker: 'Nach der Auflösung', titel: 'Du kletterst in der Rangliste', text: 'Spieltag, Monat, Saison — und in deiner eigenen Liga mit Freunden.' },
  { key: 'preis', kicker: 'Am Ende', titel: 'Oben warten Preise', text: 'Für die Besten der Saison und des Monats — kostenlos mitspielen.' },
] as const
type Szene = (typeof SZENEN)[number]['key']

export function Einfuehrung({ offen, onZu, preise, figur }: { offen: boolean; onZu: () => void; preise?: Preis[]; figur?: string }) {
  const [i, setI] = useState(0) // 0..4 Szenen, 5 = „Das bekommst du“
  const [pause, setPause] = useState(false)
  const ruhig = reduzierteBewegung()
  const ende = i >= SZENEN.length
  const gehe = useCallback(
    (d: number) => {
      setI((x) => Math.max(0, Math.min(SZENEN.length, x + d)))
      haptik(5)
    },
    [],
  )
  // automatisch weiter (nicht bei reduzierter Bewegung, nicht pausiert)
  useEffect(() => {
    if (!offen || ende || ruhig || pause) return
    const t = window.setTimeout(() => setI((x) => x + 1), SZENE_MS)
    return () => window.clearTimeout(t)
  }, [offen, i, ende, ruhig, pause])
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
  }, [offen, gehe, onZu])

  // Tippen auf die Bühne: rechts = weiter, links = zurück; gedrückt halten = Pause
  const druck = useRef(0)
  const tippBuehne = (e: React.PointerEvent<HTMLDivElement>) => {
    if (Date.now() - druck.current > 400) return // langes Halten = nur Pause
    const r = e.currentTarget.getBoundingClientRect()
    gehe(e.clientX - r.left < r.width * 0.3 ? -1 : 1)
  }

  const preis = preise?.find((p) => p.wertung === 'saison' && p.platz === 1) ?? preise?.[0]
  return (
    <AnimatePresence onExitComplete={() => setI(0)}>
      {offen && (
        <motion.div className="tp-einf ti" role="dialog" aria-modal="true" aria-labelledby="tp-einf-titel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }}>
          <motion.div className="tp-einf__inner ti__inner" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }} transition={T_LANG}>
            <div className="ti__balken" aria-hidden="true">
              {SZENEN.map((s, j) => (
                <i key={s.key} className={j < i ? 'is-war' : j === i ? (ruhig ? 'is-war' : 'is-an') : ''} style={j === i && pause ? { animationPlayState: 'paused' } : undefined}>
                  <b style={j === i && !ruhig ? { animationDuration: `${SZENE_MS}ms`, animationPlayState: pause ? 'paused' : 'running' } : undefined} />
                </i>
              ))}
            </div>
            <div className="tp-einf__kopf">
              <span className="tp-einf__nr">{ende ? 'So funktioniert’s' : `${i + 1}/${SZENEN.length}`}</span>
              <button type="button" className="tp-btn tp-btn--text tp-btn--sm" onClick={onZu}>
                {ende ? 'Schließen' : 'Überspringen'}
              </button>
            </div>

            {!ende ? (
              <>
                <div
                  className={`ti__buehne${ruhig ? ' is-ruhig' : ''}`}
                  onPointerDown={() => {
                    druck.current = Date.now()
                    setPause(true)
                  }}
                  onPointerUp={(e) => {
                    setPause(false)
                    tippBuehne(e)
                  }}
                  onPointerLeave={() => setPause(false)}
                  onPointerCancel={() => setPause(false)}
                  aria-hidden="true"
                >
                  <SzeneBild key={`${SZENEN[i].key}-${i}`} szene={SZENEN[i].key} preis={preis} figur={figur} />
                </div>
                <div className="ti__text" aria-live="polite">
                  <AnimatePresence mode="wait" initial={false}>
                    <motion.div key={SZENEN[i].key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.28, ease: EASE }}>
                      <p className="tp-kicker">{SZENEN[i].kicker}</p>
                      <h2 className="tp-titel" id="tp-einf-titel">
                        {SZENEN[i].titel}
                      </h2>
                      <p className="tp-lead">{SZENEN[i].text}</p>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <div className="tp-einf__fuss">
                  <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => setI(SZENEN.length)}>
                    Alles auf einen Blick
                  </button>
                  <button type="button" className="tp-btn tp-einf__weiter" onClick={() => gehe(1)}>
                    Weiter <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              </>
            ) : (
              <motion.div className="ti__ende" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={T_LANG}>
                <p className="tp-kicker">Kostenlos · für alle Fans</p>
                <h2 className="tp-titel" id="tp-einf-titel">
                  Das bekommst du
                </h2>
                <ul className="tp-belohnungen">
                  {BELOHNUNGEN.map((b) => (
                    <li key={b.wann} className={`is-${b.art}`}>
                      <span>{b.wann}</span>
                      <b>{b.was}</b>
                    </li>
                  ))}
                </ul>
                <p className="tp-einf__ligen">
                  <Users size={16} strokeWidth={1.5} aria-hidden="true" /> Gründe eine Liga mit Freunden — und schlagt gemeinsam die Kabine.
                </p>
                <div className="tp-einf__fuss">
                  <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => setI(0)}>
                    Nochmal ansehen
                  </button>
                  <button type="button" className="tp-btn tp-einf__weiter" onClick={onZu}>
                    Los geht’s <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
                  </button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** Zahl zählt in der Szene hoch (rAF, startet verzögert). */
function Zahl({ bis, ab = 0, start = 0, dauer = 1200 }: { bis: number; ab?: number; start?: number; dauer?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduzierteBewegung()) {
      el.textContent = String(bis)
      return
    }
    let raf = 0
    const t0 = performance.now() + start
    const lauf = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - t0) / dauer))
      const e = 1 - Math.pow(1 - p, 3)
      el.textContent = String(Math.round(ab + (bis - ab) * e))
      if (p < 1) raf = requestAnimationFrame(lauf)
    }
    raf = requestAnimationFrame(lauf)
    return () => cancelAnimationFrame(raf)
  }, [bis, ab, start, dauer])
  return <span ref={ref}>{ab}</span>
}

function SzeneBild({ szene, preis, figur }: { szene: Szene; preis?: Preis; figur?: string }) {
  switch (szene) {
    case 'tipp':
      return (
        <div className="ti-s ti-tipp">
          <div className="ti-tipp__stepper">
            <span className="ti-tipp__team">SVA</span>
            <span className="ti-tipp__zahl">
              <i className="ti-roll ti-roll--a">
                <b>–</b>
                <b>1</b>
                <b>2</b>
              </i>
            </span>
            <span className="ti-tipp__dp">:</span>
            <span className="ti-tipp__zahl">
              <i className="ti-roll ti-roll--b">
                <b>–</b>
                <b>1</b>
              </i>
            </span>
            <span className="ti-tipp__team">FIS</span>
          </div>
          <span className="ti-finger ti-finger--a" />
          <span className="ti-plus ti-plus--a">
            <Plus size={16} strokeWidth={2} />
          </span>
          <div className="ti-tipp__chips">
            <b className="ti-chip ti-chip--1">Gelb 1–2 ✓</b>
            <b className="ti-chip ti-chip--2">Elfmeter? Ja ✓</b>
            <b className="ti-chip ti-chip--3">
              <Crown size={11} strokeWidth={2.5} /> Kapitän
            </b>
          </div>
          <span className="ti-knopf">Tipp abgeben</span>
        </div>
      )
    case 'album':
      return (
        <div className="ti-s ti-album">
          <div className="ti-album__seite">
            {Array.from({ length: 8 }, (_, j) => (
              <i key={j} className={j === 5 ? 'is-ziel' : j < 3 ? 'is-voll' : ''} />
            ))}
          </div>
          <div className="ti-album__karte">
            {figur ? <img src={figur} alt="" /> : <img src="/brand/aga-logo.png" alt="" className="is-logo" />}
            <span>+1</span>
          </div>
          <span className="ti-album__plus">+1 Karte fürs Album</span>
        </div>
      )
    case 'punkte':
      return (
        <div className="ti-s ti-punkte">
          <div className="ti-punkte__bug">
            <i>● Live 67′</i>
            <b>
              2<em>:</em>1
            </b>
          </div>
          <div className="ti-punkte__zahl">
            <Zahl bis={34} start={500} dauer={1700} />
            <small>Punkte live</small>
          </div>
          <span className="ti-pop ti-pop--1">Tendenz +2</span>
          <span className="ti-pop ti-pop--2">Kapitän trifft +10</span>
          <span className="ti-pop ti-pop--3">Bonus +1</span>
        </div>
      )
    case 'rang':
      return (
        <div className="ti-s ti-rang">
          {[
            ['Svenja L.', 52],
            ['Ole M.', 47],
            ['Henrik D.', 45],
            ['Mia B.', 41],
          ].map(([n, p], j) => (
            <div key={n} className={`ti-rang__zeile ti-rang__zeile--${j}`}>
              <span className="ti-rang__platz">
                {j === 0 ? (
                  1
                ) : (
                  <>
                    <span className="ti-rang__alt">{j + 1}</span>
                    <span className="ti-rang__neu is-grau">{j + 2}</span>
                  </>
                )}
              </span>
              <span>{n}</span>
              <b>{p}</b>
            </div>
          ))}
          <div className="ti-rang__zeile ti-rang__ich">
            <span className="ti-rang__platz">
              <span className="ti-rang__alt">6</span>
              <span className="ti-rang__neu">2</span>
            </span>
            <span>Du</span>
            <span className="ti-rang__pfeil">▲ 4</span>
            <b>
              <Zahl ab={31} bis={49} start={700} dauer={1200} />
            </b>
          </div>
        </div>
      )
    case 'preis':
      return (
        <div className="ti-s ti-preis">
          <div className="ti-preis__licht" />
          <div className="ti-preis__podest">
            <span className="ti-preis__stufe ti-preis__stufe--2">2</span>
            <span className="ti-preis__stufe ti-preis__stufe--1">
              <Trophy size={30} strokeWidth={1.5} />1
            </span>
            <span className="ti-preis__stufe ti-preis__stufe--3">3</span>
          </div>
          <div className="ti-preis__karte">
            <small>{preis ? (preis.wertung === 'saison' ? `Saison · Platz ${preis.platz}` : 'Monatssieger') : 'Saison · Platz 1'}</small>
            <b>{preis?.titel ?? 'Preise von Partnern'}</b>
            {preis?.partner && <span>präsentiert von {preis.partner.name}</span>}
          </div>
        </div>
      )
  }
}
