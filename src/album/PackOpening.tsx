import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { packOeffnen, type Karte, type PackArt, type PackInhalt, type PartnerInfo, AlbumFehler } from './api'
import { SvaKarte } from '../karten/SvaKarte'
import { KartenRuecken } from '../karten/Ruecken'
import { ruhigeBewegung, vibriere } from '../karten/medien'
import { POSITION_NAME, SELTEN_NAME, SELTEN_RANG, type KartenDaten, type Seltenheit } from '../karten/typen'
import { kartenDaten } from './kartenDaten'
import { InstagramZeile } from '../ui/InstagramZeile'
import './pack.css'

// ─────────────────────────────────────────────────────────────
// v20-K: Pack-Öffnen, neu inszeniert (Herzstück des Albums).
//
//  1. Tütchen: schwebt, Folie glänzt. Über die Lasche wischen → sie reißt
//     mit dem Finger auf; durch den Spalt leuchtet schon das Licht der
//     besten Karte (Farbe kündigt die Seltenheit an). Tipp/Knopf geht auch.
//  2. Karten steigen verdeckt aus dem Tütchen. Je Karte:
//       Kader/Silber: Licht in Seltenheitsfarbe baut sich auf → Karte dreht.
//       Gold/Spezial: „Walkout" — Bühne wird dunkel, Lichtblitz, Strahlen,
//       Kamerafahrt (Karte fliegt heran), dann blenden Hinweise ein
//       (Position → Nummer bzw. Serie), erst dann dreht sie.
//     Die beste Karte kommt zuletzt. Haptik per navigator.vibrate.
//  3. Übersicht: Neu-Badges, Doppelte gestapelt (×n), Ziele/Kapitel,
//     „Ins Album einkleben", „Zeig deinen Pull" (Story-Bild).
// Inhalt kommt vom Server (album_pack_oeffnen) — gezogen wird nichts hier.
// prefers-reduced-motion: kein Reißen/Drehen/Licht, Karten blenden ein.
// ─────────────────────────────────────────────────────────────

interface Props {
  packId: string
  art: PackArt
  gegner?: string
  titel?: string
  partner?: PartnerInfo
  karten: Map<string, Karte>
  nummern: Map<string, number>
  gesamt?: number
  saison?: string
  fanName?: string
  /** einkleben = Liste neuer Karten-IDs in Aufdeck-Reihenfolge */
  onFertig: (inhalt: PackInhalt | null, einkleben: string[]) => void
}

type Phase = 'laden' | 'tuete' | 'reissen' | 'karte' | 'ende' | 'fehler'
type KP = 'rein' | 'dunkel' | 'kamera' | 'hinweis' | 'dreh' | 'auf'

const ART_TEXT: Record<PackArt, string> = {
  checkin: 'Check-in-Pack',
  heimsieg: 'Heimsieg-Bonus',
  geschenk: 'Geschenk-Pack',
  starter: 'Starter-Pack',
  tipp: 'Tipp-Karte',
  story: 'Story-Code',
  partner: 'Partner-Pack',
  advent: 'Adventskalender',
  freund: 'Freundes-Bonus',
  kapitel: 'Kapitel-Bonus',
  wunsch: 'Wunschkarte',
  ziel: 'Sammelziel erreicht',
}

const HAPTIK: Record<Seltenheit, number | number[]> = {
  bronze: 12,
  silber: [14, 40, 14],
  gold: [24, 50, 40, 50, 90],
  spezial: [30, 40, 30, 40, 30, 60, 160],
}

function hinweise(d: KartenDaten): string[] {
  if (d.art === 'spieler') return [d.position ? POSITION_NAME[d.position] : 'Spieler', d.nummer != null ? `Nummer ${d.nummer}` : d.serie ?? 'SVA']
  if (d.art === 'trainer') return ['Trainerstab', d.rolle ?? '']
  if (d.art === 'partner') return ['Partner', d.partnerSeit ? `seit ${d.partnerSeit}` : 'des SVA']
  return [d.serie ?? (d.art === 'fan' ? 'Die Kurve' : 'Moment'), d.limitiert ? 'Limitiert' : SELTEN_NAME[d.seltenheit]]
}

export function PackOpening({ packId, art, gegner, titel, partner, karten, nummern, gesamt, saison, fanName, onFertig }: Props) {
  const ruhig = useMemo(() => ruhigeBewegung(), [])
  const [phase, setPhase] = useState<Phase>('laden')
  const [inhalt, setInhalt] = useState<PackInhalt | null>(null)
  const [fehler, setFehler] = useState('')
  const [i, setI] = useState(0)
  const [kp, setKp] = useState<KP>('rein')
  const [hinweisN, setHinweisN] = useState(0)
  const [teilt, setTeilt] = useState<'' | 'laeuft' | 'ok' | 'fehler'>('')
  const tueteRef = useRef<HTMLDivElement>(null)
  const weiterRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  const stopAlle = () => {
    timers.current.forEach((t) => window.clearTimeout(t))
    timers.current = []
  }
  useEffect(() => () => stopAlle(), [])

  useEffect(() => {
    let aktiv = true
    packOeffnen(packId)
      .then((r) => {
        if (!aktiv) return
        setInhalt(r)
        setPhase('tuete')
      })
      .catch((e: unknown) => {
        if (!aktiv) return
        setFehler(e instanceof AlbumFehler ? e.message : 'Das Pack konnte nicht geöffnet werden.')
        setPhase('fehler')
      })
    return () => {
      aktiv = false
    }
  }, [packId])

  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = prev
    }
  }, [])

  const reihe = useMemo(
    () =>
      (inhalt?.karten ?? [])
        .map((k, idx) => {
          const karte = karten.get(k.karteId)
          return karte ? { ...k, idx, karte, daten: kartenDaten(karte, nummern.get(k.karteId), gesamt, saison) } : null
        })
        .filter((k): k is NonNullable<typeof k> => !!k)
        // Spannung: schlechteste zuerst, beste zuletzt
        .sort((a, b) => SELTEN_RANG[a.seltenheit] - SELTEN_RANG[b.seltenheit] || Number(a.neu) - Number(b.neu) || a.idx - b.idx),
    [inhalt, karten, nummern, gesamt, saison],
  )
  const beste: Seltenheit = reihe.length ? reihe[reihe.length - 1].seltenheit : 'bronze'
  const aktuell = reihe[i]
  const neue = reihe.filter((k) => k.neu)

  // ── Karte zeigen: Ablauf je Seltenheit ─────────────────────
  const zeigeKarte = useCallback(
    (n: number) => {
      stopAlle()
      setI(n)
      setHinweisN(0)
      const k = reihe[n]
      if (!k) return
      if (ruhig) {
        setKp('auf')
        return
      }
      setKp('rein')
      const gross = k.seltenheit === 'gold' || k.seltenheit === 'spezial'
      if (!gross) {
        later(() => setKp('dreh'), 650)
        later(() => {
          setKp('auf')
          vibriere(HAPTIK[k.seltenheit])
        }, k.seltenheit === 'silber' ? 1350 : 1150)
        return
      }
      const lang = k.seltenheit === 'spezial' ? 1.15 : 1
      later(() => setKp('dunkel'), 450)
      later(() => {
        setKp('kamera')
        vibriere(18)
      }, 1050 * lang)
      later(() => {
        setKp('hinweis')
        setHinweisN(1)
        vibriere(10)
      }, 1900 * lang)
      later(() => {
        setHinweisN(2)
        vibriere(10)
      }, 2500 * lang)
      later(() => setKp('dreh'), 3150 * lang)
      later(() => {
        setKp('auf')
        vibriere(HAPTIK[k.seltenheit])
      }, 3850 * lang)
    },
    [reihe, ruhig],
  )
  useEffect(() => {
    if (kp === 'auf') weiterRef.current?.focus({ preventScroll: true })
  }, [kp, i])

  // ── Tütchen aufreißen ──────────────────────────────────────
  const riss = useRef({ x0: 0, aktiv: false, wert: 0, tick: 0 })
  const setzeRiss = (v: number) => {
    riss.current.wert = v
    tueteRef.current?.style.setProperty('--riss', v.toFixed(3))
    const t = Math.floor(v * 7)
    if (t > riss.current.tick) {
      riss.current.tick = t
      vibriere(6)
    }
  }
  const aufreissen = () => {
    if (phase !== 'tuete') return
    if (!reihe.length) {
      setPhase('ende')
      return
    }
    vibriere([20, 30, 40])
    if (ruhig) {
      setPhase('karte')
      zeigeKarte(0)
      return
    }
    setzeRiss(1)
    setPhase('reissen')
    later(() => {
      setPhase('karte')
      zeigeKarte(0)
    }, 1150)
  }
  const onDown = (e: React.PointerEvent) => {
    if (phase !== 'tuete' || ruhig) return
    riss.current = { x0: e.clientX, aktiv: true, wert: 0, tick: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    tueteRef.current?.classList.add('is-zieht')
  }
  const onMove = (e: React.PointerEvent) => {
    if (!riss.current.aktiv) return
    const w = tueteRef.current?.offsetWidth ?? 240
    setzeRiss(Math.max(0, Math.min(1, Math.abs(e.clientX - riss.current.x0) / (w * 0.72))))
  }
  const onUp = () => {
    if (!riss.current.aktiv) return
    riss.current.aktiv = false
    tueteRef.current?.classList.remove('is-zieht')
    if (riss.current.wert > 0.5) aufreissen()
    else {
      // kurzer Tipp ohne Wischen: Lasche zuckt als Hinweis
      if (riss.current.wert < 0.04) tueteRef.current?.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-2deg)' }, { transform: 'rotate(1.5deg)' }, { transform: 'rotate(0)' }], { duration: 380, easing: 'ease-out' })
      setzeRiss(0)
    }
  }

  // ── Weiter / Überspringen ──────────────────────────────────
  const weiter = () => {
    if (phase !== 'karte' || !aktuell) return
    if (kp !== 'auf') {
      stopAlle()
      setHinweisN(2)
      setKp('auf')
      vibriere(HAPTIK[aktuell.seltenheit])
      return
    }
    if (i + 1 < reihe.length) zeigeKarte(i + 1)
    else setPhase('ende')
  }
  const alleZeigen = () => {
    stopAlle()
    setPhase('ende')
  }

  const pullTeilen = async () => {
    setTeilt('laeuft')
    try {
      const { pullBild, alsBlob, teilen } = await import('../karten/export/bild')
      const c = await pullBild(
        reihe.map((k) => k.daten),
        fanName,
      )
      const r = await teilen(await alsBlob(c), 'sva-mein-pull.png', 'Mein Pull im SVA-Sammelalbum · aga-erste.de/album · @svagathenburg')
      setTeilt(r === 'fehler' ? 'fehler' : 'ok')
    } catch {
      setTeilt('fehler')
    }
  }

  const selt = phase === 'karte' && aktuell ? aktuell.seltenheit : phase === 'reissen' ? beste : undefined
  const walkout = phase === 'karte' && aktuell && (aktuell.seltenheit === 'gold' || aktuell.seltenheit === 'spezial') && kp !== 'rein'

  return (
    <div
      className={`po${ruhig ? ' po--ruhig' : ''}${walkout ? ' is-walkout' : ''} po--${phase}`}
      data-selt={selt}
      data-kp={phase === 'karte' ? kp : undefined}
      role="dialog"
      aria-modal="true"
      aria-label="Pack öffnen"
    >
      <div className="po__bg" aria-hidden="true">
        <i className="po__licht" />
        <i className="po__strahlen" />
        <i className="po__blitz" key={phase === 'karte' ? `b${i}-${kp === 'kamera' ? 1 : 0}` : phase} />
      </div>

      {(phase === 'laden' || phase === 'tuete' || phase === 'reissen') && (
        <div className="po__buehne">
          <p className="po__kicker">
            {titel ?? ART_TEXT[art]}
            {gegner ? ` · ${gegner}` : ''}
          </p>
          <div
            ref={tueteRef}
            className={`po-tuete${phase === 'reissen' ? ' is-auf' : ''}${phase === 'laden' ? ' is-laden' : ''}`}
            data-selt={beste}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            aria-hidden="true"
          >
            <div className="po-tuete__karten">
              {reihe.slice(0, 3).map((k) => (
                <KartenRuecken key={k.karteId + k.idx} />
              ))}
            </div>
            <div className="po-tuete__koerper">
              <span className="po-tuete__folie" />
              <img src="/brand/aga-logo.png" alt="" draggable={false} />
              <b>Sammelkarten</b>
              <em>Saison {saison ?? '2026/27'}</em>
              <small>{inhalt ? `${inhalt.karten.length} ${inhalt.karten.length === 1 ? 'Karte' : 'Karten'}` : '…'}</small>
              {partner && (
                <span className="po-tuete__partner">
                  präsentiert von
                  {partner.logoUrl ? <img src={partner.logoUrl} alt={partner.name} /> : <strong>{partner.name}</strong>}
                </span>
              )}
              <span className="po-tuete__kerbe po-tuete__kerbe--unten" />
            </div>
            <div className="po-tuete__lasche">
              <span className="po-tuete__folie" />
              <span className="po-tuete__kerbe" />
              <span className="po-tuete__perfo" />
            </div>
            <span className="po-tuete__spalt" />
          </div>
          <p className="po__hint" aria-live="polite">
            {phase === 'laden' ? 'Pack wird gemischt …' : phase === 'tuete' ? (ruhig ? ' ' : 'Über die Lasche wischen') : ' '}
          </p>
          <button type="button" className="al-btn al-btn--ghost po__auf" onClick={aufreissen} disabled={phase !== 'tuete'}>
            {ruhig ? 'Pack öffnen' : 'Aufreißen'}
          </button>
        </div>
      )}

      {phase === 'karte' && aktuell && (
        <div className="po__buehne po__buehne--karte" onClick={weiter}>
          <div className="po__kopf">
            <p className="po__kicker">
              Karte {i + 1} von {reihe.length}
            </p>
            <button
              type="button"
              className="po__skip"
              onClick={(e) => {
                e.stopPropagation()
                alleZeigen()
              }}
            >
              Alle zeigen
            </button>
          </div>
          <div className={`po__karte po__karte--${aktuell.seltenheit} is-${kp}`} key={aktuell.karteId + i}>
            <i className="po__glow" aria-hidden="true" />
            <div className="po__flip">
              <div className="po__seite po__seite--vorne">
                <SvaKarte daten={aktuell.daten} stufe="gross" interaktiv={kp === 'auf'} lebend aufdecken={kp === 'auf'} eager />
              </div>
              <div className="po__seite po__seite--hinten">
                <KartenRuecken />
              </div>
            </div>
            {walkout && kp !== 'auf' && (
              <ul className="po__hinweise" aria-hidden="true">
                {hinweise(aktuell.daten).map((h, n) => (
                  <li key={h + n} className={n < hinweisN ? 'is-da' : ''}>
                    {h}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="po__info" aria-live="polite">
            {kp === 'auf' && (
              <>
                <p className="po__name">{aktuell.daten.titel}</p>
                <p className="po__chips">
                  <span className={`al-chip al-chip--${aktuell.seltenheit}`}>
                    {SELTEN_NAME[aktuell.seltenheit]}
                    {aktuell.daten.variante ? '-Glanz' : ''}
                  </span>
                  {aktuell.daten.limitiert && <span className="al-chip">Limitiert</span>}
                  {aktuell.neu ? <span className="al-chip al-chip--neu">Neu</span> : <span className="al-chip">Doppelt · ×{aktuell.anzahl}</span>}
                </p>
              </>
            )}
          </div>
          <div className="po__punkte" aria-hidden="true">
            {reihe.map((k, n) => (
              <i key={n} className={`${n < i ? 'is-da' : ''}${n === i ? ' is-jetzt' : ''}`} data-selt={n < i || (n === i && kp === 'auf') ? k.seltenheit : undefined} />
            ))}
          </div>
          <button
            ref={weiterRef}
            type="button"
            className="al-btn al-btn--gross po__weiter"
            onClick={(e) => {
              e.stopPropagation()
              weiter()
            }}
          >
            {kp !== 'auf' ? 'Aufdecken' : i + 1 < reihe.length ? 'Nächste Karte' : 'Alle ansehen'}
          </button>
        </div>
      )}

      {phase === 'ende' && (
        <div className="po__buehne po__buehne--ende">
          <p className="po__kicker">{titel ?? ART_TEXT[art]}</p>
          <h2 className="al-h2">
            {neue.length > 0 ? `${neue.length} ${neue.length === 1 ? 'neue Karte' : 'neue Karten'}` : 'Nur Doppelte — ab zum Tauschen'}
          </h2>
          <ul className="po__liste">
            {reihe.map((k, n) => (
              <li key={k.karteId + k.idx} style={{ '--n': n } as React.CSSProperties} className={k.anzahl > 1 ? 'is-doppelt' : ''}>
                <SvaKarte daten={k.daten} stufe="klein" />
                <span className={k.neu ? 'al-chip al-chip--neu' : 'al-chip'}>{k.neu ? 'Neu' : `×${k.anzahl}`}</span>
              </li>
            ))}
          </ul>
          {(inhalt?.kapitel ?? []).map((k) => (
            <p key={k.kapitel} className="po__bonus">
              Kapitel komplett: <b>{k.kapitel}</b> — Bonus-Karte wartet
            </p>
          ))}
          {(inhalt?.ziele ?? []).map((z) => (
            <p key={z.titel} className="po__bonus">
              Sammelziel erreicht: <b>{z.titel}</b>
              {z.lose ? ` · ${z.lose} ${z.lose === 1 ? 'Los' : 'Lose'}` : ''}
            </p>
          ))}
          {(inhalt?.gutscheine ?? []).map((g) => (
            <p key={g.id} className="po__bonus po__bonus--gold">
              Belohnung freigeschaltet: <b>{g.titel}</b>
            </p>
          ))}
          <div className="po__aktionen">
            <button type="button" className="al-btn al-btn--gross" onClick={() => onFertig(inhalt, neue.map((k) => k.karteId))} autoFocus>
              {neue.length > 0 ? 'Ins Album einkleben' : 'Zum Album'}
            </button>
            <button type="button" className="al-btn al-btn--ghost al-btn--gross" onClick={() => void pullTeilen()} disabled={teilt === 'laeuft'}>
              {teilt === 'laeuft' ? 'Bild wird erstellt …' : 'Zeig deinen Pull'}
            </button>
          </div>
          {teilt === 'ok' && <p className="po__story">Bild ist fertig — ab in deine Story, markier uns.</p>}
          {teilt === 'fehler' && <p className="po__story">Das Bild hat nicht geklappt. Versuch es gleich noch einmal.</p>}
          <InstagramZeile text="In der Story markieren: @svagathenburg" />
        </div>
      )}

      {phase === 'fehler' && (
        <div className="po__buehne">
          <p className="al-hinweis al-hinweis--fehler">{fehler}</p>
          <button type="button" className="al-btn al-btn--gross" onClick={() => onFertig(null, [])}>
            Schließen
          </button>
        </div>
      )}
    </div>
  )
}
