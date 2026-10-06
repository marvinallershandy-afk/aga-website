import { useEffect, useRef, useState } from 'react'
import type { VideoSources } from '../../data/playerMedia'
import { useTorErkennung } from './useTor'
import './tor.css'

// ─────────────────────────────────────────────────────────────
// v22-T: „TOR!“ — große Einblendung über allem (TV-Grafik / EA FC):
// Lichtstoß + Strahlen, Wort „TOR!“ knallt rein, der Torschütze als
// Freisteller steigt von unten ins Bild (hinter ihm die Rückennummer in
// Umriss), Bauchbinde mit Minute, Name/Nummer/Vorlage und neuem Spielstand.
// ~2,6 s, antippen schließt, Haptik. Gegentor: ruhige, dunkle Variante.
// Gemeinsam für /tippen (Live + Vorführung) und /live — bewusst OHNE
// framer-motion (nur CSS-Keyframes auf transform/opacity → 60 fps).
// Greenscreen-Video (playerMedia(id).jubel, sonst .loop) wird automatisch
// genutzt, sobald es da ist; sonst der Freisteller (playerMedia(id).figure).
// ─────────────────────────────────────────────────────────────

export interface TorDaten {
  /** eindeutig je Tor (für Wiederholungs-Schutz) */
  key: string
  art: 'tor' | 'gegentor'
  name?: string
  nummer?: number | null
  vorlage?: string
  /** z. B. „23′“ */
  minute?: string
  /** Anzeige-Reihenfolge (Heim zuerst) */
  heim: string
  gast: string
  toreHeim: number
  toreGast: number
  /** welche Seite hat gerade getroffen (für das Aufpoppen der Zahl) */
  heimTrifft: boolean
  figur?: string | null
  video?: VideoSources | null
  /** Gegner-Name für die Gegentor-Zeile */
  gegner?: string
}

const DAUER = { tor: 2600, gegentor: 1900 } as const

function ruhig(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function vibrieren(muster: number | number[]) {
  try {
    navigator.vibrate?.(muster)
  } catch {
    /* egal */
  }
}

// Funken: feste, „zufällig“ wirkende Verteilung (kein Math.random beim Rendern)
const FUNKEN = Array.from({ length: 16 }, (_, i) => ({ a: (i * 137.5) % 360, d: 26 + ((i * 53) % 34), t: 0.5 + ((i * 29) % 40) / 100, s: 4 + (i % 4) * 2 }))

export function TorJubel({ daten, onZu }: { daten: TorDaten | null; onZu: () => void }) {
  // „raus“ gilt je Tor (neues Tor → wieder rein, ohne setState im Effekt)
  const [rausKey, setRausKey] = useState<string | null>(null)
  const zuRef = useRef(onZu)
  useEffect(() => {
    zuRef.current = onZu
  })
  const key = daten?.key
  const art = daten?.art
  const raus = !!key && rausKey === key
  useEffect(() => {
    if (!key || !art) return
    vibrieren(art === 'tor' ? [30, 50, 30, 50, 90] : 24)
    const t1 = window.setTimeout(() => setRausKey(key), DAUER[art] - 320)
    const t2 = window.setTimeout(() => zuRef.current(), DAUER[art])
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
    }
  }, [key, art])
  const schliessen = () => {
    setRausKey(key ?? null)
    window.setTimeout(() => zuRef.current(), 220)
  }
  // Esc schließt (Tastatur)
  useEffect(() => {
    if (!key) return
    const f = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      setRausKey(key)
      window.setTimeout(() => zuRef.current(), 220)
    }
    window.addEventListener('keydown', f)
    return () => window.removeEventListener('keydown', f)
  }, [key])
  if (!daten) return null
  const tor = daten.art === 'tor'
  // TV-Bauchbinde: Nachname groß, Vorname klein
  const teile = (daten.name ?? '').trim().split(/\s+/).filter(Boolean)
  const nachname = teile.length ? teile[teile.length - 1] : undefined
  const vorname = teile.length > 1 ? teile.slice(0, -1).join(' ') : undefined
  const still = ruhig()
  const video = tor && !still ? daten.video : null
  return (
    <div
      className={`tj tj--${daten.art}${raus ? ' is-raus' : ''}${still ? ' is-ruhig' : ''}`}
      role="alert"
      aria-live="assertive"
      onClick={schliessen}
      data-tor={daten.key}
    >
      <div className="tj__scrim" aria-hidden="true" />
      {tor && (
        <>
          <div className="tj__strahlen" aria-hidden="true" />
          <div className="tj__streifen" aria-hidden="true">
            <i />
            <i />
            <i />
          </div>
          <div className="tj__blitz" aria-hidden="true" />
          {daten.nummer != null && (
            <span className="tj__nummer" aria-hidden="true">
              {daten.nummer}
            </span>
          )}
          {video ? (
            <video className="tj__figur tj__figur--video" autoPlay muted playsInline preload="auto" poster={video.poster} aria-hidden="true">
              <source src={video.mov} type='video/mp4; codecs="hvc1"' />
              <source src={video.webm} type="video/webm" />
            </video>
          ) : (
            daten.figur && <img className="tj__figur" src={daten.figur} alt="" decoding="async" aria-hidden="true" />
          )}
          <div className="tj__funken" aria-hidden="true">
            {FUNKEN.map((f, i) => (
              <i key={i} style={{ ['--a' as string]: `${f.a}deg`, ['--d' as string]: `${f.d}vmin`, ['--t' as string]: `${f.t}s`, ['--s' as string]: `${f.s}px` }} />
            ))}
          </div>
        </>
      )}
      {!tor && (
        <span className="tj__gegner" aria-hidden="true">
          {daten.heimTrifft ? daten.heim : daten.gast}
        </span>
      )}
      <p className="tj__wort" data-text={tor ? 'Tor!' : 'Gegentor'}>
        {tor ? 'Tor!' : 'Gegentor'}
      </p>
      <div className="tj__binde">
        <span className="tj__min">{daten.minute ?? ''}</span>
        <span className="tj__wer">
          {tor ? (
            <>
              <b>{nachname ?? 'SV Agathenburg-Dollern'}</b>
              <small>
                {[vorname, daten.nummer != null ? `#${daten.nummer}` : null, daten.vorlage ? `Vorlage ${daten.vorlage}` : null].filter(Boolean).join(' · ') || 'Tor für den SVA'}
              </small>
            </>
          ) : (
            <>
              <b>{daten.gegner ?? 'Gegner'}</b>
              <small>trifft · weiter geht’s</small>
            </>
          )}
        </span>
        <span className="tj__stand" aria-label={`Spielstand ${daten.heim} ${daten.toreHeim} zu ${daten.toreGast} ${daten.gast}`}>
          <small>{daten.heim}</small>
          <b className={daten.heimTrifft ? 'is-neu' : ''}>{daten.toreHeim}</b>
          <i>:</i>
          <b className={daten.heimTrifft ? '' : 'is-neu'}>{daten.toreGast}</b>
          <small>{daten.gast}</small>
        </span>
      </div>
      <span className="tj__zu" aria-hidden="true">
        Antippen zum Schließen
      </span>
    </div>
  )
}

/** Erkennt neue Tore (am Spielstand) und blendet „TOR!“ ein — eigener
 *  Zustand, damit beim Tor nicht die ganze Seite neu zeichnet. */
export function TorMelder({
  spielKey,
  toreSva,
  toreGegner,
  bauen,
}: {
  spielKey: string | null
  toreSva: number | null | undefined
  toreGegner: number | null | undefined
  bauen: (sva: boolean) => TorDaten | null | Promise<TorDaten | null>
}) {
  const [tor, zu] = useTorErkennung(spielKey, toreSva, toreGegner, bauen)
  return <TorJubel daten={tor} onZu={zu} />
}
