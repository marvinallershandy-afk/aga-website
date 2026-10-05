import { useEffect, useMemo, useRef, useState } from 'react'
import { packOeffnen, type Karte, type PackArt, type PackInhalt, type PartnerInfo, AlbumFehler } from './api'
import { Sticker, StickerRueckseite } from './Sticker'
import { SELTEN_LABEL, SELTEN_RANG, name, reduzierteBewegung } from './model'
import { InstagramZeile } from '../ui/InstagramZeile'

// ─────────────────────────────────────────────────────────────
// v17-A: Tütchen aufreißen wie bei Panini.
//   Tütchen (wackelt) → antippen → Folie reißt → Sticker einzeln:
//   Rückseite → (Gold/Spezial: kurze Spannung mit Lichtschein) → umdrehen.
// Der BESTE Sticker kommt zuletzt. Veredelung: Silber-Schimmer, Gold-Glanz
// mit Strahlen, Spezial-Glitzer + Konfetti. Am Ende „Einkleben“: das Heft
// klebt die neuen Sticker an ihren Platz (AlbumApp).
// Inhalt kommt vom Server (album_pack_oeffnen) — hier wird nichts gezogen.
// prefers-reduced-motion: kein Wackeln/Drehen/Konfetti, nur Einblenden.
// ─────────────────────────────────────────────────────────────

interface Props {
  packId: string
  art: PackArt
  gegner?: string
  partner?: PartnerInfo
  karten: Map<string, Karte>
  nummern: Map<string, number>
  saison?: string
  /** einkleben = Liste neuer Karten-IDs in Aufdeck-Reihenfolge */
  onFertig: (inhalt: PackInhalt | null, einkleben: string[]) => void
}

type Phase = 'laden' | 'pack' | 'reissen' | 'karte' | 'ende' | 'fehler'
type KartenPhase = 'rueck' | 'spannung' | 'vorne'

const ART_TEXT: Record<PackArt, string> = {
  checkin: 'Check-in-Tütchen',
  heimsieg: 'Heimsieg-Bonus',
  geschenk: 'Geschenk-Tütchen',
}

export function PackOpening({ packId, art, gegner, partner, karten, nummern, saison, onFertig }: Props) {
  const ruhig = useMemo(() => reduzierteBewegung(), [])
  const [phase, setPhase] = useState<Phase>('laden')
  const [inhalt, setInhalt] = useState<PackInhalt | null>(null)
  const [fehler, setFehler] = useState('')
  const [i, setI] = useState(0)
  const [kp, setKp] = useState<KartenPhase>('rueck')
  const [konfetti, setKonfetti] = useState(0)
  const weiterRef = useRef<HTMLButtonElement>(null)
  const timers = useRef<number[]>([])
  const later = (fn: () => void, ms: number) => timers.current.push(window.setTimeout(fn, ms))
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])

  useEffect(() => {
    let aktiv = true
    packOeffnen(packId)
      .then((r) => {
        if (!aktiv) return
        setInhalt(r)
        setPhase('pack')
      })
      .catch((e: unknown) => {
        if (!aktiv) return
        setFehler(e instanceof AlbumFehler ? e.message : 'Das Tütchen konnte nicht geöffnet werden.')
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
        .map((k, idx) => ({ ...k, idx, karte: karten.get(k.karteId) }))
        .filter((k): k is typeof k & { karte: Karte } => !!k.karte)
        .sort((a, b) => SELTEN_RANG[a.seltenheit] - SELTEN_RANG[b.seltenheit] || a.idx - b.idx),
    [inhalt, karten],
  )
  const aktuell = reihe[i]
  const neue = reihe.filter((k) => k.neu)

  const aufdecken = (s: string) => {
    setKp('vorne')
    if (s === 'spezial' && !ruhig) setKonfetti((x) => x + 1)
    later(() => weiterRef.current?.focus({ preventScroll: true }), 50)
  }
  const zeigeKarte = (n: number) => {
    setI(n)
    const k = reihe[n]
    if (!k) return
    if (ruhig) {
      setKp('vorne')
      return
    }
    setKp('rueck')
    if (k.seltenheit === 'gold' || k.seltenheit === 'spezial') {
      later(() => setKp('spannung'), 450)
      later(() => aufdecken(k.seltenheit), 1650)
    } else {
      later(() => aufdecken(k.seltenheit), 650)
    }
  }
  const oeffnen = () => {
    if (phase !== 'pack') return
    if (!reihe.length) {
      setPhase('ende')
      return
    }
    if (ruhig) {
      setPhase('karte')
      zeigeKarte(0)
      return
    }
    setPhase('reissen')
    later(() => {
      setPhase('karte')
      zeigeKarte(0)
    }, 750)
  }
  const weiter = () => {
    if (kp !== 'vorne') {
      timers.current.forEach((t) => window.clearTimeout(t))
      timers.current = []
      if (aktuell) aufdecken(aktuell.seltenheit)
      return
    }
    if (i + 1 < reihe.length) zeigeKarte(i + 1)
    else setPhase('ende')
  }

  return (
    <div className={`al-pack${ruhig ? ' al-pack--ruhig' : ''}`} role="dialog" aria-modal="true" aria-label="Tütchen öffnen">
      <div className="al-pack__bg" aria-hidden="true" data-selt={phase === 'karte' && kp !== 'rueck' ? aktuell?.seltenheit : undefined} />

      {(phase === 'laden' || phase === 'pack' || phase === 'reissen') && (
        <div className="al-pack__stage">
          <p className="al-pack__kicker">
            {ART_TEXT[art]}
            {gegner ? ` · ${gegner}` : ''}
          </p>
          <button
            type="button"
            className={`al-tuete${phase === 'reissen' ? ' is-reissen' : ''}${phase === 'laden' ? ' is-laden' : ''}`}
            onClick={oeffnen}
            disabled={phase !== 'pack'}
            aria-label={phase === 'laden' ? 'Tütchen wird vorbereitet' : 'Tütchen aufreißen'}
          >
            <span className="al-tuete__rand" aria-hidden="true" />
            <span className="al-tuete__koerper" aria-hidden="true">
              <img src="/brand/aga-logo.png" alt="" />
              <b>Sticker</b>
              <em>Stickerheft{saison ? ` ${saison}` : ''}</em>
              <small>{inhalt ? `${inhalt.karten.length} Sticker` : '…'}</small>
              {partner && (
                <span className="al-tuete__partner">
                  präsentiert von
                  {partner.logoUrl ? <img src={partner.logoUrl} alt={partner.name} /> : <strong>{partner.name}</strong>}
                </span>
              )}
            </span>
          </button>
          <p className="al-pack__hint" aria-live="polite">
            {phase === 'laden' ? 'Tütchen wird gemischt …' : phase === 'pack' ? 'Tippen zum Aufreißen' : ' '}
          </p>
        </div>
      )}

      {phase === 'karte' && aktuell && (
        <div className="al-pack__stage">
          <p className="al-pack__kicker">
            Sticker {i + 1} von {reihe.length}
          </p>
          <button
            type="button"
            className={`al-flip al-flip--${aktuell.seltenheit} is-${kp}`}
            onClick={weiter}
            aria-label={kp === 'vorne' ? 'Weiter' : 'Sticker umdrehen'}
          >
            <span className="al-flip__glow" aria-hidden="true" />
            <span className="al-flip__strahlen" aria-hidden="true" />
            <span className="al-flip__innen">
              <span className="al-flip__seite al-flip__vorne">
                <Sticker key={aktuell.karteId + i} karte={aktuell.karte} className="is-reveal" />
              </span>
              <span className="al-flip__seite al-flip__hinten">
                <StickerRueckseite nr={nummern.get(aktuell.karteId)} />
              </span>
            </span>
          </button>
          <div className="al-pack__info" aria-live="polite">
            {kp === 'vorne' && (
              <>
                <p className="al-pack__name">{name(aktuell.karte)}</p>
                <p>
                  <span className={`al-chip al-chip--${aktuell.seltenheit}`}>{SELTEN_LABEL[aktuell.seltenheit]}</span>{' '}
                  {aktuell.neu ? <span className="al-chip al-chip--neu">Neu!</span> : <span className="al-chip">Doppelt · ×{aktuell.anzahl}</span>}
                </p>
              </>
            )}
          </div>
          <button ref={weiterRef} type="button" className="al-btn al-btn--gross" onClick={weiter}>
            {kp !== 'vorne' ? 'Umdrehen' : i + 1 < reihe.length ? `Nächster Sticker (${i + 2}/${reihe.length})` : 'Alle ansehen'}
          </button>
        </div>
      )}

      {phase === 'ende' && (
        <div className="al-pack__stage al-pack__stage--ende">
          <p className="al-pack__kicker">Dein Tütchen</p>
          <h2 className="al-h2">
            {neue.length > 0 ? (
              <>
                {neue.length} <em>{neue.length === 1 ? 'neuer' : 'neue'}</em> Sticker
              </>
            ) : (
              <>
                Nur Doppelte — <em>tauschen</em> lohnt sich!
              </>
            )}
          </h2>
          <ul className="al-pack__liste">
            {reihe.map((k) => (
              <li key={k.karteId + k.idx}>
                <Sticker karte={k.karte} />
                <span className={k.neu ? 'al-chip al-chip--neu' : 'al-chip'}>{k.neu ? 'Neu' : `×${k.anzahl}`}</span>
              </li>
            ))}
          </ul>
          {(inhalt?.gutscheine ?? []).map((g) => (
            <p key={g.id} className="al-pack__gut">
              Belohnung freigeschaltet: <b>{g.titel}</b>
            </p>
          ))}
          {/* v19-S (Audit B §2.6): Album als Follower-Motor — Story-Impuls */}
          <p className="al-pack__story">Seltener Pull? Zeig ihn in deiner Story und markier uns.</p>
          <InstagramZeile text="In der Story markieren: @svagathenburg" />
          <button
            type="button"
            className="al-btn al-btn--gross"
            onClick={() => onFertig(inhalt, neue.map((k) => k.karteId))}
            autoFocus
          >
            {neue.length > 0 ? 'Ins Heft einkleben' : 'Zum Heft'}
          </button>
        </div>
      )}

      {phase === 'fehler' && (
        <div className="al-pack__stage">
          <p className="al-hinweis al-hinweis--fehler">{fehler}</p>
          <button type="button" className="al-btn al-btn--gross" onClick={() => onFertig(null, [])}>
            Schließen
          </button>
        </div>
      )}

      {konfetti > 0 && <Konfetti key={konfetti} />}
    </div>
  )
}

const FARBEN = ['#E91D29', '#E8C15A', '#ffffff', '#50dcff', '#ff50c8', '#a0ff78']
function Konfetti() {
  // einmalig beim Einblenden zufällig verteilt (Lazy-Init statt Render-Zufall)
  const [teile] = useState(() =>
      Array.from({ length: 70 }, (_, n) => ({
        x: Math.random() * 100,
        d: Math.random() * 0.5,
        t: 1.4 + Math.random() * 1.1,
        r: Math.random() * 720 - 360,
        s: 6 + Math.random() * 7,
        c: FARBEN[n % FARBEN.length],
        w: Math.random() * 40 - 20,
      })),
  )
  return (
    <div className="al-konfetti" aria-hidden="true">
      {teile.map((p, n) => (
        <i
          key={n}
          style={
            {
              left: `${p.x}%`,
              width: `${p.s}px`,
              height: `${p.s * 0.45}px`,
              background: p.c,
              animationDelay: `${p.d}s`,
              animationDuration: `${p.t}s`,
              '--r': `${p.r}deg`,
              '--w': `${p.w}vw`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )
}
