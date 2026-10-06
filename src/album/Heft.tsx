import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, ChevronLeft, ChevronRight, Lock } from 'lucide-react'
import type { GeheimPlatz, Gutschein, Katalog, Mein, RanglistenEintrag } from './api'
import { SvaKarte } from '../karten/SvaKarte'
import type { KartenDaten } from '../karten/typen'
import { kartenDaten, shinyDaten } from './kartenDaten'
import { BLAETTERN_EREIGNIS, BLAETTERN_MS } from './blaettern'
import { GRUPPEN, KAPITEL_NAME, MEILENSTEINE, name, shinyPlaetze, type Fortschritt, type Gruppe, type Platz, type ShinyPlatz, type Treue } from './model'
import { Balken, Zaehler } from './Zaehler'
import { ruhigeBewegung, vibriere } from '../karten/medien'
import { Medaille } from './Medaille'
import { useKippen } from './medaille-logik'
import './heft.css'
import { garantieText, packTypInfo, packZeile } from './packTypen'

// ─────────────────────────────────────────────────────────────
// v20-K: Das Album als Buch. Kapitel (Tor, Abwehr, Mittelfeld, Sturm,
// Trainerstab, Momente, Kurve, Partner) + Bonus-Seite (limitierte Karten)
// + Start-, Sammel- und Fans-Seite. Handy: eine Seite, Desktop (≥ 960 px):
// Doppelseite. Umblättern ist ein echtes Blatt, das sich um den Rücken
// dreht — per Wischen (folgt dem Finger), Pfeiltasten, Reiter oder Knopf.
// Plätze: Karte (SvaKarte, klein) bzw. leerer Umriss mit Nummer; Doppelte
// als Stapelkante + ×n, Glanz-Variante als Glanz-Ecke, „Neu"-Badge.
// ─────────────────────────────────────────────────────────────

export interface SeiteDef {
  id: string
  titel: string
  kurz: string
  gruppe?: Gruppe
}

interface Props {
  ps: Platz[]
  katalog: Katalog
  mein: Mein
  fs: Fortschritt
  tr: Treue
  frisch: Set<string>
  rangliste: RanglistenEintrag[] | null
  onPlatz: (p: Platz) => void
  onGutschein: (g: Gutschein) => void
  onKonto: () => void
  /** v22: große Karte zeigen (Shiny-Vitrine, Geheimseite) */
  onKarte?: (d: KartenDaten, info: { titel: string; text: string }) => void
  /** Inhalt der Start- und Sammel-Seite (kommt aus AlbumApp) */
  start: React.ReactNode
  sammeln: React.ReactNode
  /** v26-Z2: Inhalt der Ziele-Seite */
  ziele: React.ReactNode
  /** v26-E: Goldene Abschluss-Seite (nur bei 100 %) */
  komplett?: React.ReactNode
}

const DOPPEL = '(min-width: 960px)'
function useDoppel() {
  const [d, setD] = useState(() => typeof window !== 'undefined' && window.matchMedia(DOPPEL).matches)
  useEffect(() => {
    const mq = window.matchMedia(DOPPEL)
    const f = () => setD(mq.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return d
}

type Blatt = { von: number; nach: number; vor: boolean; winkel: number; laeuft: boolean }

export function Heft(props: Props) {
  const { ps, katalog, mein, fs, tr, frisch, rangliste, onPlatz, onGutschein, onKonto, onKarte, start, sammeln, ziele, komplett } = props
  const doppel = useDoppel()
  const ruhig = useMemo(() => ruhigeBewegung(), [])
  const gesamt = fs.gesamt

  const seiten: SeiteDef[] = useMemo(
    () => [
      { id: 'start', titel: 'Mein Album', kurz: 'Start' },
      ...GRUPPEN.filter((g) => ps.some((p) => p.gruppe === g.id)).map((g) => ({ id: g.id, titel: g.titel, kurz: g.kurz, gruppe: g.id })),
      ...(ps.some((p) => p.gruppe === 'bonus') ? [{ id: 'bonus', titel: 'Bonus-Seite', kurz: 'Bonus', gruppe: 'bonus' as Gruppe }] : []),
      // v22: Shiny-Vitrine + Geheime Seite — Bonus, zählen nicht fürs Album
      { id: 'shiny', titel: 'Shiny-Vitrine', kurz: 'Shiny' },
      ...((mein.geheim?.length ?? 0) > 0 ? [{ id: 'geheim', titel: 'Geheime Seite', kurz: '???' }] : []),
      { id: 'ziele', titel: 'Ziele', kurz: 'Ziele' },
      { id: 'sammeln', titel: 'Sammeln & Tauschen', kurz: 'Sammeln' },
      { id: 'fans', titel: 'Treueste Fans', kurz: 'Fans' },
      ...(mein.komplett ? [{ id: 'komplett', titel: 'Album komplett', kurz: '100 %' }] : []),
    ],
    [ps, mein.geheim?.length, mein.komplett],
  )
  const vitrine = useMemo(() => shinyPlaetze(ps, mein), [ps, mein])
  const schritt = doppel ? 2 : 1
  const [ansicht, setAnsicht] = useState(0) // erste sichtbare Seite
  const [blatt, setBlatt] = useState<Blatt | null>(null)
  const ausrichten = (n: number) => Math.max(0, Math.min(seiten.length - 1, doppel ? n - (n % 2) : n))
  const aktuell = ausrichten(ansicht)

  // ── Umblättern ─────────────────────────────────────────────
  const blatRef = useRef<Blatt | null>(null)
  useEffect(() => {
    blatRef.current = blatt
  }, [blatt])
  const fertig = useCallback(() => {
    const b = blatRef.current
    if (!b) return
    setAnsicht(b.winkel === (b.vor ? -180 : 0) ? b.nach : b.von)
    setBlatt(null)
  }, [])
  const blaettern = useCallback(
    (ziel: number) => {
      const nach = ausrichten(ziel)
      if (nach === aktuell || blatRef.current) return
      if (ruhig) {
        setAnsicht(nach)
        return
      }
      const vor = nach > aktuell
      setBlatt({ von: aktuell, nach, vor, winkel: vor ? 0 : -180, laeuft: false })
      vibriere(8)
      requestAnimationFrame(() =>
        requestAnimationFrame(() => setBlatt((b) => (b ? { ...b, winkel: vor ? -180 : 0, laeuft: true } : b))),
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [aktuell, ruhig, doppel, seiten.length],
  )

  // Wischen: das Blatt folgt dem Finger
  const zug = useRef<{ x: number; y: number; w: number; aktiv: boolean; entschieden: boolean; vor: boolean } | null>(null)
  const buch = useRef<HTMLDivElement>(null)
  const onDown = (e: React.PointerEvent) => {
    if (blatRef.current || ruhig || e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as HTMLElement).closest('input, textarea, select, .hb-nicht-ziehen')) return
    zug.current = { x: e.clientX, y: e.clientY, w: buch.current?.offsetWidth ?? 360, aktiv: true, entschieden: false, vor: true }
  }
  const onMove = (e: React.PointerEvent) => {
    const z = zug.current
    if (!z?.aktiv) return
    const dx = e.clientX - z.x
    const dy = e.clientY - z.y
    if (!z.entschieden) {
      if (Math.abs(dx) < 12 && Math.abs(dy) < 12) return
      if (Math.abs(dy) > Math.abs(dx)) {
        zug.current = null
        return
      }
      const vor = dx < 0
      const nach = ausrichten(aktuell + (vor ? schritt : -schritt))
      if (nach === aktuell) {
        zug.current = null
        return
      }
      z.entschieden = true
      z.vor = vor
      ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
      setBlatt({ von: aktuell, nach, vor, winkel: vor ? 0 : -180, laeuft: false })
    }
    const breite = doppel ? z.w / 2 : z.w
    const p = Math.max(0, Math.min(1, (z.vor ? -dx : dx) / (breite * 0.9)))
    setBlatt((b) => (b ? { ...b, winkel: z.vor ? -180 * p : -180 + 180 * p } : b))
  }
  const onUp = () => {
    const z = zug.current
    zug.current = null
    if (!z?.entschieden) return
    setBlatt((b) => {
      if (!b) return b
      const p = b.vor ? -b.winkel / 180 : (b.winkel + 180) / 180
      const weiter = p > 0.3
      if (weiter) vibriere(8)
      return { ...b, winkel: weiter ? (b.vor ? -180 : 0) : b.vor ? 0 : -180, laeuft: true }
    })
  }

  // Einkleben: zur Seite eines Platzes blättern
  useEffect(() => {
    const f = (e: Event) => {
      const { key, seite: ziel } = (e as CustomEvent<{ key?: string; seite?: string }>).detail
      if (ziel) {
        const idx = seiten.findIndex((s) => s.id === ziel)
        if (idx >= 0) blaettern(idx)
        return
      }
      const p = ps.find((x) => x.key === key)
      const idx = p ? seiten.findIndex((s) => s.gruppe === p.gruppe) : -1
      if (idx >= 0) blaettern(idx)
    }
    window.addEventListener(BLAETTERN_EREIGNIS, f)
    return () => window.removeEventListener(BLAETTERN_EREIGNIS, f)
  }, [ps, seiten, blaettern])

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea, [role="dialog"]')) return
      if (e.key === 'ArrowRight') blaettern(aktuell + schritt)
      if (e.key === 'ArrowLeft') blaettern(aktuell - schritt)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [aktuell, schritt, blaettern])

  // Sicherheitsnetz: Ende der Animation auch ohne transitionend
  useEffect(() => {
    if (!blatt?.laeuft) return
    const t = window.setTimeout(fertig, BLAETTERN_MS + 120)
    return () => window.clearTimeout(t)
  }, [blatt?.laeuft, blatt?.winkel, fertig])

  const seite = (i: number, wo: string) => {
    const s = seiten[i]
    if (!s) return <div className={`hb-seite hb-seite--leer hb-seite--${wo}`} key={`leer-${wo}`} />
    return (
      <section key={`${s.id}-${wo}`} className={`hb-seite hb-seite--${s.gruppe ?? s.id} hb-seite--${wo}`} aria-labelledby={`hb-t-${s.id}-${wo}`}>
        <SeitenInhalt
          s={s}
          nr={i + 1}
          wo={wo}
          ps={ps}
          fs={fs}
          gesamt={gesamt}
          saison={katalog.saison}
          frisch={frisch}
          abzeichen={mein.abzeichen ?? []}
          onPlatz={onPlatz}
          start={start}
          sammeln={sammeln}
          ziele={ziele}
          komplett={komplett}
          shiny={<ShinyVitrine plaetze={vitrine} gesamt={gesamt} saison={katalog.saison} chance={katalog.regeln.shinyChance} blatt={wo === 'blatt'} onKarte={onKarte} />}
          geheim={<GeheimSeite plaetze={mein.geheim ?? []} saison={katalog.saison} blatt={wo === 'blatt'} onKarte={onKarte} />}
          fans={<FansSeite katalog={katalog} liste={rangliste} mitmachen={!!mein.profil?.rangliste} onKonto={onKonto} />}
          treue={<TreuePass tr={tr} gutscheine={mein.gutscheine.filter((g) => g.saison === mein.saison || g.status === 'offen')} onGutschein={onGutschein} />}
        />
      </section>
    )
  }

  // Ebenen: unten die Zielansicht (bzw. die Seiten, die unter dem Blatt liegen)
  let unten: React.ReactNode
  let blattVorne: React.ReactNode = null
  let blattHinten: React.ReactNode = null
  if (!blatt) {
    unten = doppel ? [seite(aktuell, 'links'), seite(aktuell + 1, 'rechts')] : seite(aktuell, 'einzel')
  } else if (doppel) {
    const { von, nach, vor } = blatt
    unten = vor ? [seite(von, 'links'), seite(nach + 1, 'rechts')] : [seite(nach, 'links'), seite(von + 1, 'rechts')]
    blattVorne = vor ? seite(von + 1, 'blatt') : seite(nach + 1, 'blatt')
    blattHinten = vor ? seite(nach, 'blatt') : seite(von, 'blatt')
  } else {
    const { von, nach, vor } = blatt
    unten = seite(vor ? nach : von, 'einzel')
    blattVorne = seite(vor ? von : nach, 'blatt')
    blattHinten = <div className="hb-seite hb-seite--papier" />
  }
  const schatten = blatt ? Math.sin((Math.abs(blatt.winkel) * Math.PI) / 180) : 0

  return (
    <div className="hb">
      <nav className="hf-reiter hb-nicht-ziehen" aria-label="Kapitel">
        {seiten.map((s, i) => {
          const k = s.gruppe ? fs.kapitel.find((x) => x.id === s.gruppe) : undefined
          const sichtbar = i === aktuell || (doppel && i === aktuell + 1)
          return (
            <button key={s.id} type="button" className={`hf-reiter__b${sichtbar ? ' is-aktiv' : ''}${k?.komplett ? ' is-komplett' : ''}`} aria-current={sichtbar ? 'page' : undefined} onClick={() => blaettern(i)}>
              {s.kurz}
              {k && (
                <small>
                  {k.belegt}/{k.gesamt}
                </small>
              )}
            </button>
          )
        })}
      </nav>

      <div
        ref={buch}
        className={`hb-buch${doppel ? ' hb-buch--doppel' : ''}`}
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
        aria-roledescription="Album"
      >
        <div className="hb-lage">{unten}</div>
        {blatt && (
          <div
            className={`hb-blatt${blatt.laeuft ? ' is-laeuft' : ''}`}
            inert
            style={{ transform: `rotateY(${blatt.winkel}deg)`, ['--schatten' as string]: schatten.toFixed(3) }}
            onTransitionEnd={(e) => e.target === e.currentTarget && fertig()}
          >
            <div className="hb-blatt__seite hb-blatt__vorne">{blattVorne}</div>
            <div className="hb-blatt__seite hb-blatt__hinten">{blattHinten}</div>
          </div>
        )}
        {doppel && <i className="hb-ruecken" aria-hidden="true" />}
      </div>

      <div className="hf-blaettern hb-nicht-ziehen">
        <button type="button" className="al-iconbtn" onClick={() => blaettern(aktuell - schritt)} disabled={aktuell === 0} aria-label="Vorherige Seite">
          <ChevronLeft size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
        <span>
          {doppel && aktuell + 1 < seiten.length ? `Seiten ${aktuell + 1}–${aktuell + 2}` : `Seite ${aktuell + 1}`} von {seiten.length} · wischen zum Blättern
        </span>
        <button type="button" className="al-iconbtn" onClick={() => blaettern(aktuell + schritt)} disabled={aktuell + schritt > seiten.length - 1} aria-label="Nächste Seite">
          <ChevronRight size={20} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </div>
  )
}

// ── Seiteninhalt ─────────────────────────────────────────────
function SeitenInhalt({
  s,
  nr,
  wo,
  ps,
  fs,
  gesamt,
  saison,
  frisch,
  abzeichen,
  onPlatz,
  start,
  sammeln,
  ziele,
  komplett,
  shiny,
  geheim,
  fans,
  treue,
}: {
  s: SeiteDef
  nr: number
  wo: string
  ps: Platz[]
  fs: Fortschritt
  gesamt: number
  saison: string
  frisch: Set<string>
  abzeichen: string[]
  onPlatz: (p: Platz) => void
  start: React.ReactNode
  sammeln: React.ReactNode
  ziele: React.ReactNode
  komplett?: React.ReactNode
  shiny: React.ReactNode
  geheim: React.ReactNode
  fans: React.ReactNode
  treue: React.ReactNode
}) {
  const kap = s.gruppe ? fs.kapitel.find((k) => k.id === s.gruppe) : undefined
  const plaetze = s.gruppe ? ps.filter((p) => p.gruppe === s.gruppe) : []
  const blatt = wo === 'blatt'
  return (
    <div className="hb-papier">
      <span className="hf-kopf" aria-hidden="true">
        <span>Seite {nr}</span>
        {kap && (
          <span>
            {kap.belegt}/{kap.gesamt}
          </span>
        )}
      </span>
      <h2 className="hf-titel" id={`hb-t-${s.id}-${wo}`}>
        {s.titel}
      </h2>
      {kap && (
        <div className={`hb-kapitel${kap.komplett ? ' is-komplett' : ''}`}>
          <Balken prozent={(100 * kap.belegt) / Math.max(1, kap.gesamt)} />
          {kap.komplett || abzeichen.includes(kap.id) ? (
            <span className="hb-abzeichen" title="Kapitel komplett">
              <Medaille metall="gold" erreicht groesse="s">
                <BookOpen size={14} strokeWidth={1.5} />
              </Medaille>
              Kapitel komplett · Abzeichen
            </span>
          ) : (
            <span className="hb-kapitel__rest">
              Noch {kap.gesamt - kap.belegt} bis zum Abzeichen + Bonus-Karte
            </span>
          )}
        </div>
      )}
      {s.gruppe === 'bonus' && <p className="hb-hinweis">Limitierte Karten — nur kurz ziehbar, zählen nicht fürs volle Album.</p>}
      {s.gruppe === 'kult' && <p className="hb-hinweis">Kabinen-Kult — Insider-Karten aus der Kabine. Gibt's nur am Spieltag, zählen nicht fürs volle Album.</p>}

      {s.id === 'start' && start}
      {s.id === 'ziele' && ziele}
      {s.id === 'komplett' && komplett}
      {s.id === 'shiny' && shiny}
      {s.id === 'geheim' && geheim}
      {s.id === 'sammeln' && sammeln}
      {s.id === 'fans' && (
        <>
          {treue}
          {fans}
        </>
      )}
      {s.gruppe && <PlatzListe gruppe={s.gruppe} plaetze={plaetze} gesamt={gesamt} saison={saison} frisch={frisch} blatt={blatt} onPlatz={onPlatz} />}
    </div>
  )
}

/** v21-A: Platz-Raster mit Zeiger-Neigung + Licht (Desktop), ein Listener je Seite. */
function PlatzListe({ gruppe, plaetze, gesamt, saison, frisch, blatt, onPlatz }: { gruppe: Gruppe; plaetze: Platz[]; gesamt: number; saison: string; frisch: Set<string>; blatt: boolean; onPlatz: (p: Platz) => void }) {
  const ref = useKippen<HTMLUListElement>()
  return (
    <ul className={`hf-plaetze hf-plaetze--${gruppe}`} ref={blatt ? undefined : ref}>
      {plaetze.map((p, i) => (
        <PlatzView key={p.key} p={p} i={i} gesamt={gesamt} saison={saison} frisch={!blatt && frisch.has(p.key)} onPlatz={blatt ? undefined : onPlatz} />
      ))}
    </ul>
  )
}

function PlatzView({ p, i, gesamt, saison, frisch, onPlatz }: { p: Platz; i: number; gesamt: number; saison: string; frisch: boolean; onPlatz?: (p: Platz) => void }) {
  const k = p.beste ?? p.versionen[0]
  const doppelt = p.anzahl - (p.beste ? 1 : 0) - (p.besterGlanz ? 1 : 0)
  const daten = useMemo(() => (p.beste ? kartenDaten(p.beste, p.nr || undefined, p.nr ? gesamt : undefined, saison) : null), [p.beste, p.nr, gesamt, saison])
  const ref = useRef<HTMLLIElement>(null)
  useLayoutEffect(() => {
    if (frisch) vibriere(10)
  }, [frisch])
  return (
    <li ref={ref} className={`hf-platz${frisch ? ' is-frisch' : ''}${doppelt > 0 ? ' is-doppelt' : ''}${p.besterGlanz ? ' is-glanz' : ''}${p.beste ? ' is-belegt' : ' is-leer'}`} style={{ ['--i' as string]: i }}>
      <button
        type="button"
        data-kipp=""
        className="hf-platz__btn"
        data-platz={p.key}
        onClick={onPlatz ? () => onPlatz(p) : undefined}
        tabIndex={onPlatz ? 0 : -1}
        aria-label={`${p.nr ? `Nr. ${p.nr}: ` : ''}${name(k)}${p.beste ? '' : ', fehlt noch'}${doppelt > 0 ? `, ${doppelt} doppelt` : ''}`}
      >
        {daten ? (
          <>
            <SvaKarte daten={daten} stufe="klein" aufdecken={frisch} />
            <span className="hf-platz__licht" aria-hidden="true" />
          </>
        ) : (
          <span className="hb-leer" aria-hidden="true">
            <span className="hb-leer__nr">{p.nr ? String(p.nr).padStart(2, '0') : <Lock size={18} strokeWidth={1.5} />}</span>
            <svg viewBox="0 0 100 140" className="hb-leer__form">
              <polygon points="6,0 94,0 100,6 100,131 50,140 0,131 0,6" />
            </svg>
            <span className="hb-leer__name">{name(k)}</span>
          </span>
        )}
        {doppelt > 0 && <span className="hf-platz__n">×{doppelt + 1}</span>}
        {frisch && <span className="hf-platz__neu">Neu</span>}
        {p.besterGlanz && <span className="hf-platz__glanz">Glanz</span>}
      </button>
    </li>
  )
}

// ── v22: Shiny-Vitrine ───────────────────────────────────────
const datumKurz = (iso: string) => new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric', year: '2-digit', timeZone: 'Europe/Berlin' })
function ShinyVitrine({ plaetze, gesamt, saison, chance, blatt, onKarte }: { plaetze: ShinyPlatz[]; gesamt: number; saison: string; chance?: number; blatt: boolean; onKarte?: Props['onKarte'] }) {
  const ref = useKippen<HTMLUListElement>()
  const n = plaetze.filter((p) => p.fund).length
  return (
    <div className="sv">
      <p className="hb-hinweis">
        Extrem selten: Jede Spieler- oder Trainerkarte kann beim Ziehen als <b>Shiny</b> erscheinen
        {chance ? ` (Chance 1 : ${chance} je Karte)` : ''}. Kein Vorteil im Spiel, zählt nicht fürs Album — nur Glück und Glanz. Wer eine Person als Erste(r) findet,
        steht für immer auf der Karte.
      </p>
      <p className="sv-stand">
        <b>{n}</b> von {plaetze.length} Shinys in deiner Vitrine
      </p>
      <ul className="hf-plaetze sv-raster" ref={blatt ? undefined : ref}>
        {plaetze.map((p, i) => {
          const basis = kartenDaten(p.karte, p.nr || undefined, p.nr ? gesamt : undefined, saison)
          const d = p.fund ? shinyDaten(basis, p.erstfund) : null
          return (
            <li key={p.key} className={`hf-platz sv-platz${p.fund ? ' is-belegt is-shiny' : ' is-leer'}`} style={{ ['--i' as string]: i }}>
              <button
                type="button"
                data-kipp=""
                className="hf-platz__btn"
                tabIndex={blatt || !d ? -1 : 0}
                disabled={!d}
                onClick={d && onKarte ? () => onKarte(d, { titel: `Shiny · ${name(p.karte)}`, text: p.erstfund ? `Erstfund von ${p.erstfund.name} am ${datumKurz(p.erstfund.at)}${p.fund && p.fund.anzahl > 1 ? ` · ×${p.fund.anzahl} in deiner Vitrine` : ''}` : 'Zählt nicht fürs Album.' }) : undefined}
                aria-label={`${name(p.karte)}: ${p.fund ? 'Shiny gefunden' : 'noch kein Shiny'}${p.erstfund ? `, Erstfund ${p.erstfund.name}` : ''}`}
              >
                {d ? (
                  <SvaKarte daten={d} stufe="klein" className="is-schimmer" />
                ) : (
                  <span className="hb-leer sv-leer" aria-hidden="true">
                    <span className="hb-leer__nr">✦</span>
                    <svg viewBox="0 0 100 140" className="hb-leer__form">
                      <polygon points="6,0 94,0 100,6 100,131 50,140 0,131 0,6" />
                    </svg>
                    <span className="hb-leer__name">{name(p.karte)}</span>
                    {p.erstfund && <span className="sv-gesehen">entdeckt von {p.erstfund.name}</span>}
                  </span>
                )}
                {p.fund && p.fund.anzahl > 1 && <span className="hf-platz__n">×{p.fund.anzahl}</span>}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── v22: Geheime Seite ───────────────────────────────────────
function GeheimSeite({ plaetze, saison, blatt, onKarte }: { plaetze: GeheimPlatz[]; saison: string; blatt: boolean; onKarte?: Props['onKarte'] }) {
  const n = plaetze.filter((p) => p.gefunden).length
  return (
    <div className="gs">
      <p className="hb-hinweis">Diese Karten bekommt man nicht in Tütchen. Man muss sie finden. Mehr verraten wir nicht.</p>
      <p className="sv-stand">
        <b>{n}</b> von {plaetze.length} entdeckt
      </p>
      <ul className="gs-liste">
        {plaetze.map((p) => {
          const d = p.gefunden && p.karte ? kartenDaten(p.karte, undefined, undefined, saison) : null
          return (
            <li key={p.nr} className={`gs-platz${d ? ' is-gefunden' : ''}`}>
              <button
                type="button"
                className="gs-platz__btn"
                disabled={!d}
                tabIndex={blatt || !d ? -1 : 0}
                onClick={d && onKarte ? () => onKarte(d, { titel: d.titel, text: p.raetsel }) : undefined}
                aria-label={d ? `${d.titel} — gefunden` : `Geheimkarte ${p.nr}: noch nicht entdeckt`}
              >
                {d ? (
                  <SvaKarte daten={d} stufe="klein" />
                ) : (
                  <span className="gs-silhouette" aria-hidden="true">
                    <svg viewBox="0 0 100 140">
                      <polygon points="6,0 94,0 100,6 100,131 50,140 0,131 0,6" />
                    </svg>
                    <b>???</b>
                  </span>
                )}
              </button>
              <p className="gs-raetsel">„{p.raetsel}“</p>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ── Treue-Pass + Gutscheine (Fans-Seite) ────────────────────
function TreuePass({ tr, gutscheine, onGutschein }: { tr: Treue; gutscheine: Gutschein[]; onGutschein: (g: Gutschein) => void }) {
  if (!tr.stufen.length && !gutscheine.length) return null
  return (
    <div className="hf-treue" aria-labelledby="hf-treue-t">
      <h3 id="hf-treue-t">
        Treue-Pass <span>{tr.checkins} {tr.checkins === 1 ? 'Heimspiel' : 'Heimspiele'}</span>
      </h3>
      <ol className="hf-stempel" aria-label={`${tr.checkins} von ${tr.max} Stempeln`}>
        {Array.from({ length: tr.max }, (_, n) => {
          const stufe = tr.stufen.find((s) => s.checkins === n + 1)
          return (
            <li key={n} className={`${n < tr.checkins ? 'is-da' : ''}${stufe ? ' is-preis' : ''}`}>
              {n < tr.checkins ? <img src="/brand/aga-logo.png" alt="" /> : <span>{n + 1}</span>}
            </li>
          )
        })}
      </ol>
      <p className="hf-treue__text">
        {tr.naechste ? (
          <>
            Noch <b>{tr.naechste.fehlen}</b> {tr.naechste.fehlen === 1 ? 'Heimspiel' : 'Heimspiele'} bis <b>{tr.naechste.titel}</b>
            {tr.naechste.partner && <> · präsentiert von {tr.naechste.partner.name}</>}
          </>
        ) : (
          <>Alle Treue-Belohnungen dieser Saison geholt — stark!</>
        )}
      </p>
      {gutscheine.length > 0 && (
        <ul className="hf-gutscheine" aria-label="Deine Gutscheine">
          {gutscheine.map((g) => (
            <li key={g.id}>
              <button type="button" className={`hf-gut${g.status === 'eingeloest' ? ' is-eingeloest' : ''}`} onClick={() => onGutschein(g)}>
                <b>{g.titel}</b>
                <span>{g.code}</span>
                <em>{g.stufe === 'komplett' || g.stufe === 'schwelle_3' ? 'Verlosung' : g.status === 'eingeloest' ? 'Eingelöst' : 'Am Stand zeigen'}</em>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function FansSeite({ katalog, liste, mitmachen, onKonto }: { katalog: Katalog; liste: RanglistenEintrag[] | null; mitmachen: boolean; onKonto: () => void }) {
  const r = katalog.regeln
  const komplett = r.belohnungen.find((b) => b.stufe === 'komplett')
  return (
    <div className="hf-letzte">
      <h3 className="hf-zwischen">Rangliste</h3>
      {liste === null ? (
        <p className="hf-klein">Lädt …</p>
      ) : liste.length === 0 ? (
        <p className="hf-klein">Noch niemand in der Rangliste — die ersten Check-ins entscheiden.</p>
      ) : (
        <ol className="hf-rang">
          {liste.slice(0, 10).map((e) => (
            <li key={`${e.platz}-${e.name}`} className={e.ich ? 'is-ich' : undefined}>
              <span className="hf-rang__p">{e.platz}.</span>
              <span className="hf-rang__n">
                {e.name}
                {e.ich && <small> (du)</small>}
              </span>
              <span className="hf-rang__w">{e.checkins} Spiele</span>
            </li>
          ))}
        </ol>
      )}
      {!mitmachen && (
        <p className="hf-klein">
          Du stehst nicht in der Liste.{' '}
          <button type="button" className="hf-link" onClick={onKonto}>
            Mitmachen
          </button>
        </p>
      )}
      <h3 className="hf-zwischen">So funktioniert’s</h3>
      <ol className="hf-regeln">
        <li>
          <b>Anmelden:</b> {packZeile(packTypInfo('starter', r.packTypen)!)}.
        </li>
        <li>
          <b>Am Platz:</b> Bei jedem Heimspiel QR-Code scannen — {packZeile(packTypInfo('spieltag', r.packTypen)!)} ({garantieText(packTypInfo('spieltag', r.packTypen))})
          {r.bonusHeimsieg && `, bei einem Heimsieg ein ${packZeile(packTypInfo('sieg', r.packTypen)!)} (${garantieText(packTypInfo('sieg', r.packTypen))}) — auch für alle, die getippt haben`}. Checkt ein Freund beim selben Spiel ein, gibt es für beide eine Extra-Karte.
        </li>
        <li>
          <b>Unter der Woche:</b> Tipp abgeben ({packZeile(packTypInfo('tipp', r.packTypen)!)}), Story-Codes auf Instagram, Event-Codes (Derby, MOTM-Woche), Partner-Codes im Laden.
        </li>
        <li>
          <b>Belohnungen:</b>{' '}
          {r.belohnungen
            .filter((b) => b.checkins)
            .map((b) => `${b.checkins}. Heimspiel: ${b.titel}`)
            .join(' · ')}
          {komplett && ` · Mannschaft komplett: ${komplett.titel}`}.
        </li>
      </ol>
      <dl className="hf-chancen" aria-label="Chance pro Karte">
        {(
          [
            ['bronze', 'Kader'],
            ['silber', 'Silber'],
            ['gold', 'Gold'],
            ['spezial', 'Spezial'],
          ] as const
        ).map(([s, l]) => (
          <div key={s} className={`hf-chancen__s hf-chancen__s--${s}`}>
            <dt>{l}</dt>
            <dd>{String(r.chancen[s]).replace('.', ',')} %</dd>
          </div>
        ))}
      </dl>
      <p className="hf-klein">
        Chance je Karte. Die erste Karte jedes Packs ist eine, die dir noch fehlt. Kostet nichts, nichts zu kaufen — nur Dabeisein zählt.
      </p>
    </div>
  )
}

/** Start-Seite: Gesamtfortschritt mit Meilensteinen + Kapitel-Balken. */
export function Gesamtstand({ fs, name: wer, onKapitel }: { fs: Fortschritt; name?: string; onKapitel?: (id: Gruppe) => void }) {
  const naechster = MEILENSTEINE.find((m) => fs.prozent < m)
  return (
    <div className="hb-stand">
      {wer && (
        <p className="hf-gehoert">
          Dieses Album gehört <b>{wer}</b>
        </p>
      )}
      <p className="hb-stand__zahl" aria-label={`${fs.belegt} von ${fs.gesamt} Karten`}>
        <b>
          <Zaehler wert={fs.belegt} />
        </b>
        <span>/{fs.gesamt}</span>
        <small>{fs.prozent} %</small>
      </p>
      <Balken prozent={(100 * fs.belegt) / Math.max(1, fs.gesamt)} kerben={MEILENSTEINE.slice(0, -1)} className="bk--gross" />
      <p className="hf-stand__sub">
        {naechster ? (
          <>
            Nächster Meilenstein: <b>{naechster} %</b> — noch {Math.max(1, Math.ceil((naechster / 100) * fs.gesamt) - fs.belegt)} Karten
          </>
        ) : (
          <b>Album komplett!</b>
        )}
        {fs.doppelte > 0 && <> · {fs.doppelte} Doppelte</>}
        {fs.glanz > 0 && <> · {fs.glanz} Glanz</>}
      </p>
      <ul className="hb-kapitelliste">
        {fs.kapitel.map((k) => (
          <li key={k.id} className={k.komplett ? 'is-komplett' : undefined}>
            <button type="button" className="hb-kapitelliste__b" onClick={onKapitel ? () => onKapitel(k.id) : undefined} disabled={!onKapitel} aria-label={`${KAPITEL_NAME[k.id] ?? k.titel}: ${k.belegt} von ${k.gesamt} — aufschlagen`}>
              <span>{KAPITEL_NAME[k.id] ?? k.titel}</span>
              <Balken prozent={(100 * k.belegt) / Math.max(1, k.gesamt)} />
              <em>
                {k.belegt}/{k.gesamt}
              </em>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
