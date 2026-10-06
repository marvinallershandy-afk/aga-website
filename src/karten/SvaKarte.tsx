import { memo, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react'
import './karten.css'
import { FENSTER, FIGUR_KONVENTION, INNEN, LAYOUT, UMRISS, clipPolygon, einruecken, nachnameGroesse, svgPunkte } from './geometrie'
import { figurMassBekannt, figurMessen, hevcZuerst, ruhigeBewegung, type FigurMass } from './medien'
import { gyroAnfragen, gyroFolgen, gyroWert, gyroZustand } from './gyro'
import { muster, SYMBOL_PFAD } from './muster'
import { ART_NAME, POSITION_NAME, SELTEN_NAME, kartenNummer, teileName, type KartenDaten, type Seltenheit } from './typen'
import { standardWerteText } from './werte'

// ─────────────────────────────────────────────────────────────
// v20-K: <SvaKarte/> — DIE Sammelkarte des SVA (Album, Spielerkarten der
// Website, Tipp-Liga). Öffentliche, dokumentierte Komponente (docs/KARTEN.md).
//
//   <SvaKarte daten={kartenDaten} />                      Raster (ruhig)
//   <SvaKarte daten={d} stufe="gross" interaktiv lebend /> Bühne mit Holo-Neigung
//   <SvaKarte daten={d} seite={gedreht ? 'hinten' : 'vorne'} />  mit Rückseite + Dreh
//
// Aufbau (alles transform/opacity, keine Layout-Animation):
//   Körper (Schild-Form per clip-path): Material je Seltenheit, Prägung,
//   Wasserzeichen-Nummer, Foto/Logo, Metall-Rahmen (SVG), Folie (Blend).
//   Freisteller darüber (darf oben aus dem Rahmen ragen, Parallaxe),
//   Text-Ebene, Glanz. Rückseite: Steckbrief, Kartennummer, Saison, Credit.
// Material: Kader = mattes Schwarz-Rot mit Blindprägung · Silber =
// gebürstetes Metall · Gold = Gravur (Guilloche) + Goldfolie · Spezial =
// lebender Hintergrund + Holo-Folie mit Funkeln.
// stufe="klein" lässt Folie/Glanz/Video weg (Album-Raster: 40+ Karten).
// prefers-reduced-motion: keine Neigung, keine Dauer-Animation.
// ─────────────────────────────────────────────────────────────

export interface SvaKarteProps {
  daten: KartenDaten
  /** Mit Rückseite rendern; Wechsel dreht die Karte (0,8 s). */
  seite?: 'vorne' | 'hinten'
  /** Zeiger- und Gyro-Neigung mit Holo-Glanz (nur für EINE große Karte). */
  interaktiv?: boolean
  /** Lebende Karte: Greenscreen-Loop statt Standbild, wenn vorhanden. */
  lebend?: boolean
  /** klein = Raster ohne Folien-Ebenen · normal · gross = Bühne */
  stufe?: 'klein' | 'normal' | 'gross'
  /** Einmaliger Licht-Streif über die Folie (Aufdecken/Einkleben). */
  aufdecken?: boolean
  /** Bilder sofort laden (erste Ansicht, Export-Vorschau). */
  eager?: boolean
  className?: string
  style?: React.CSSProperties
  onClick?: () => void
  /** Bildschirmleser-Text; Standard: Name + Seltenheit */
  ariaLabel?: string
}

const SEL_FARBEN: Record<Seltenheit, [string, string, string, string]> = {
  bronze: ['#ff6a72', '#E91D29', '#6d0b12', '#c4161f'],
  silber: ['#ffffff', '#8b929b', '#eef1f5', '#646b74'],
  gold: ['#fff1bd', '#c4952f', '#ffe7a0', '#8f6a1f'],
  spezial: ['#ffe9a8', '#ff7aa8', '#8fdcff', '#c9ffb8'],
}
const RAND_AUSSEN = einruecken(UMRISS, 0.45)
const RAND_BAND = einruecken(UMRISS, 1.9)
const CLIP = clipPolygon(UMRISS)
const CLIP_FENSTER = clipPolygon(FENSTER)

function useNeigung(ref: React.RefObject<HTMLDivElement | null>, aktiv: boolean) {
  useEffect(() => {
    const el = ref.current
    if (!el || !aktiv || ruhigeBewegung()) return
    let maus = { x: 0, y: 0, an: false }
    let raf = 0
    const schreibe = () => {
      raf = 0
      const gx = gyroZustand() === 'an' ? gyroWert.x : 0
      const gy = gyroZustand() === 'an' ? gyroWert.y : 0
      const ry = maus.x * 16 + gy
      const rx = -maus.y * 13 - gx
      const mx = Math.max(-0.5, Math.min(0.5, maus.x + gy / 28))
      const my = Math.max(-0.5, Math.min(0.5, maus.y - gx / 24))
      el.style.setProperty('--ry', `${ry.toFixed(2)}deg`)
      el.style.setProperty('--rx', `${rx.toFixed(2)}deg`)
      el.style.setProperty('--mx', (mx + 0.5).toFixed(3))
      el.style.setProperty('--my', (my + 0.5).toFixed(3))
      el.style.setProperty('--hx', mx.toFixed(3))
      el.style.setProperty('--hy', my.toFixed(3))
      el.style.setProperty('--licht', maus.an || gyroZustand() === 'an' ? '1' : '0')
    }
    const plane = () => {
      if (!raf) raf = requestAnimationFrame(schreibe)
    }
    const move = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return
      const r = el.getBoundingClientRect()
      maus = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5, an: true }
      el.classList.add('is-zeiger')
      plane()
    }
    const leave = () => {
      maus = { x: 0, y: 0, an: false }
      el.classList.remove('is-zeiger')
      plane()
    }
    el.addEventListener('pointermove', move)
    el.addEventListener('pointerleave', leave)
    const ab = gyroFolgen(plane)
    return () => {
      el.removeEventListener('pointermove', move)
      el.removeEventListener('pointerleave', leave)
      ab()
      if (raf) cancelAnimationFrame(raf)
    }
  }, [ref, aktiv])
}

function Symbol({ s }: { s: Seltenheit }) {
  return (
    <svg className="sk__symbol" viewBox="0 0 10 10" aria-hidden="true">
      <path d={SYMBOL_PFAD[s]} />
    </svg>
  )
}

function Rahmen({ s, id }: { s: Seltenheit; id: string }) {
  const [a, b, c, d] = SEL_FARBEN[s]
  return (
    <svg className="sk__rahmen" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1.2">
          <stop offset="0" stopColor={a} />
          <stop offset=".34" stopColor={b} />
          <stop offset=".52" stopColor={c} />
          <stop offset=".78" stopColor={d} />
          <stop offset="1" stopColor={a} />
        </linearGradient>
      </defs>
      {/* Metall-Band außen (zwischen Kontur und Band-Innenkante) */}
      <path className="sk__band" d={`M${svgPunkte(RAND_AUSSEN).replace(/ /g, 'L')}Z M${svgPunkte(RAND_BAND).replace(/ /g, 'L')}Z`} fill={`url(#${id}g)`} fillRule="evenodd" />
      <polygon className="sk__linie" points={svgPunkte(INNEN)} fill="none" stroke={`url(#${id}g)`} />
      <polygon className="sk__kante" points={svgPunkte(RAND_AUSSEN)} fill="none" />
    </svg>
  )
}

function Figur({ d, lebend, eager, klein }: { d: KartenDaten; lebend: boolean; eager?: boolean; klein?: boolean }) {
  // Raster: 640er-Freisteller statt HD (gleiche Geometrie, ¼ der Pixel)
  const src = klein ? d.figur!.replace('/players/cutout/hd/', '/players/cutout/') : d.figur!
  const [mass, setMass] = useState<FigurMass | null>(() => figurMassBekannt(src))
  const [videoKaputt, setVideoKaputt] = useState(false)
  const kopfZiel = d.art === 'trainer' ? LAYOUT.figurKopfStab : LAYOUT.figurKopf
  const B = LAYOUT.figurBreite
  const video = lebend && d.loop && !videoKaputt && !ruhigeBewegung() ? d.loop : null
  // Lage: Standbild nach Messung; Video nach Loop-Geometrie (Scheitel headY)
  let top: number
  let hoehe = B * (mass?.ratio ?? 1.5)
  let breite = B
  if (video && d.loopGeo) {
    // Loop ist 1:2 und zeigt den ganzen Körper → größer skalieren, damit
    // Kopf/Oberkörper wie beim Standbild sitzen
    breite = B * 1.32
    hoehe = breite * (d.loopGeo.h / d.loopGeo.w)
    top = kopfZiel - d.loopGeo.headY * hoehe
  } else {
    // bis zur Messung: Konvention (Scheitel 18,5 %) — unsichtbar, aber mit
    // Größe, damit loading="lazy" greift
    top = kopfZiel - (mass?.kopf ?? FIGUR_KONVENTION.kopf) * hoehe
  }
  const fadeVon = (LAYOUT.figurAusVon * 140 - top) / hoehe
  const fadeBis = (LAYOUT.figurAusBis * 140 - top) / hoehe
  const maske = `linear-gradient(180deg, #000 ${(fadeVon * 100).toFixed(1)}%, transparent ${(fadeBis * 100).toFixed(1)}%)`
  const stil: React.CSSProperties = {
    top: `${top.toFixed(2)}cqw`,
    left: `${((100 - breite) / 2 + LAYOUT.figurVersatz).toFixed(2)}cqw`,
    width: `${breite.toFixed(2)}cqw`,
    aspectRatio: video ? undefined : `1 / ${mass?.ratio ?? FIGUR_KONVENTION.ratio}`,
    WebkitMaskImage: maske,
    maskImage: maske,
    opacity: video || mass ? undefined : 0,
  }
  return (
    <div className="sk__figur" aria-hidden="true">
      {video ? (
        <video
          className="sk__figur-el"
          style={stil}
          poster={video.poster}
          muted
          loop
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          tabIndex={-1}
          onError={() => setVideoKaputt(true)}
          ref={(v) => {
            if (!v) return
            v.muted = true
            v.addEventListener('error', () => setVideoKaputt(true), { capture: true, once: true })
          }}
        >
          {hevcZuerst()
            ? [<source key="m" src={video.mov} type='video/mp4; codecs="hvc1"' />, <source key="w" src={video.webm} type='video/webm; codecs="vp9"' />]
            : [<source key="w" src={video.webm} type='video/webm; codecs="vp9"' />, <source key="m" src={video.mov} type='video/mp4; codecs="hvc1"' />]}
        </video>
      ) : (
        <img
          className="sk__figur-el"
          src={src}
          alt=""
          draggable={false}
          loading={eager ? 'eager' : 'lazy'}
          decoding="async"
          style={stil}
          onLoad={(e) => setMass(figurMessen(e.currentTarget))}
        />
      )}
    </div>
  )
}

function Vorderseite({ d, id, stufe, lebend, eager }: { d: KartenDaten; id: string; stufe: string; lebend: boolean; eager?: boolean }) {
  const m = muster()
  const person = d.art === 'spieler' || d.art === 'trainer'
  const mitFigur = person && !!d.figur
  const fotoKarte = !person && d.art !== 'partner' && !!d.foto
  const personFoto = person && !d.figur && !!d.foto
  const { vorname, nachname } = teileName(d.titel)
  const klein = stufe === 'klein'
  const meister = /meister/i.test(d.serie ?? '')
  const titelGross = (d.art === 'fan' && !d.foto) || (d.art === 'partner' && !d.logo)

  return (
    <div className="sk__seite sk__vorne">
      <div className="sk__koerper" style={{ clipPath: CLIP }}>
        <div className="sk__grund" />
        {d.seltenheit === 'spezial' && (
          <div className="sk__aurora" aria-hidden="true">
            <i />
            <b />
          </div>
        )}
        <div
          className="sk__muster"
          style={{
            backgroundImage: `url("${d.seltenheit === 'gold' ? m.guilloche : d.seltenheit === 'silber' ? m.buerstung : m.rauten}")`,
          }}
        />
        {(person || titelGross || d.art === 'partner') && <div className="sk__praegung" />}
        {mitFigur && d.nummer != null && d.art === 'spieler' && <div className="sk__wasser">{d.nummer}</div>}
        {(fotoKarte || personFoto) && (
          <div className="sk__foto" style={{ clipPath: CLIP_FENSTER }}>
            <img
              src={d.foto!}
              srcSet={fotoSrcSet(d.foto!)}
              sizes={stufe === 'klein' ? '180px' : stufe === 'gross' ? '520px' : '360px'}
              alt=""
              draggable={false}
              loading={eager ? 'eager' : 'lazy'}
              decoding="async"
              style={{ objectPosition: d.fokus ?? '50% 35%' }}
            />
          </div>
        )}
        {d.art === 'partner' && d.logo && (
          <div className="sk__tafel">
            <img src={d.logo} alt="" draggable={false} loading={eager ? 'eager' : 'lazy'} decoding="async" />
          </div>
        )}
        <div className="sk__platte" />
        <Rahmen s={d.seltenheit} id={id} />
        {!klein && <div className="sk__folie" />}
        {!klein && d.seltenheit === 'spezial' && <div className="sk__funken" style={{ WebkitMaskImage: `url("${m.funkeln}")`, maskImage: `url("${m.funkeln}")` }} />}
      </div>

      {mitFigur && <Figur d={d} lebend={lebend && !klein} eager={eager} klein={klein} />}

      <div className="sk__inhalt" aria-hidden="true">
        {person ? (
          <div className="sk__spalte">
            {d.art === 'spieler' ? (
              <>
                {d.nummer != null && <b className="sk__nummer">{d.nummer}</b>}
                {d.position && <span className="sk__pos">{d.position}</span>}
              </>
            ) : (
              <span className="sk__rolle">{(d.rolle ?? 'Trainerstab').toUpperCase()}</span>
            )}
            <img className="sk__wappen" src="/brand/aga-logo.png" alt="" draggable={false} />
            {d.kapitaen && d.art === 'spieler' && <span className="sk__c">C</span>}
          </div>
        ) : (
          <div className="sk__kopf">
            <span className={`sk__serie${meister ? ' is-gold' : ''}`}>{(d.serie ?? ART_NAME[d.art]).toUpperCase()}</span>
            <img className="sk__wappen-k" src="/brand/aga-logo.png" alt="" draggable={false} />
          </div>
        )}
        {(d.variante || d.limitiert || d.neuzugang) && (
          <span className={`sk__tag${d.limitiert ? ' is-limit' : ''}`}>{d.limitiert ? 'Limitiert' : d.variante ? 'Glanz' : 'Neu'}</span>
        )}

        {titelGross ? (
          <div className="sk__gross">
            {d.titel.split(/\s+/).map((w, i) => (
              <b key={i}>{w}</b>
            ))}
          </div>
        ) : null}

        <div className="sk__name">
          {person ? (
            <>
              {vorname && <small>{vorname}</small>}
              <b style={{ fontSize: `${nachnameGroesse(nachname).toFixed(2)}cqw` }}>{nachname}</b>
            </>
          ) : (
            <>
              {d.untertitel && !titelGross && <small>{d.untertitel}</small>}
              {!titelGross && <b style={{ fontSize: `${nachnameGroesse(d.titel, 12.5, 84).toFixed(2)}cqw` }}>{d.titel}</b>}
              {titelGross && d.untertitel && <small>{d.untertitel}</small>}
            </>
          )}
          <i />
          <span className="sk__info">{infoZeile(d)}</span>
        </div>
        {d.credit && (fotoKarte || personFoto) && <span className="sk__credit">Foto: {d.credit}</span>}
        <div className="sk__fuss">
          <span>{kartenNummer(d) ?? 'SVA'}</span>
          <Symbol s={d.seltenheit} />
          <span>{d.saison ?? ''}</span>
        </div>
      </div>
      {!klein && <div className="sk__glanz" style={{ clipPath: CLIP }} />}
    </div>
  )
}

/** Kartenfotos unter /karten/ gibt es in zwei Größen (scripts/karten-fotos.mjs). */
function fotoSrcSet(url: string): string | undefined {
  const m = /^(\/karten\/[^/?#]+)\.webp$/.exec(url)
  return m ? `${m[1]}-640.webp 640w, ${url} 1400w` : undefined
}

function infoZeile(d: KartenDaten): string {
  if (d.art === 'spieler') {
    const t = [d.position ? POSITION_NAME[d.position] : null, d.kapitaen ? 'Kapitän' : null].filter(Boolean)
    return (t.length ? t.join(' · ') : 'SV Agathenburg-Dollern').toUpperCase()
  }
  if (d.art === 'trainer') return 'SV AGATHENBURG-DOLLERN'
  if (d.art === 'partner') return d.partnerSeit ? `PARTNER SEIT ${d.partnerSeit}` : 'PARTNER DES SVA'
  if (d.praesentiertVon) return `PRÄSENTIERT VON ${d.praesentiertVon.name.toUpperCase()}`
  return d.art === 'fan' ? 'DIE KURVE · SVA' : 'SV AGATHENBURG-DOLLERN'
}

function Rueckseite({ d, id }: { d: KartenDaten; id: string }) {
  const m = muster()
  const werte = d.werte ?? standardWerteText(d)
  return (
    <div className="sk__seite sk__hinten" aria-hidden="true">
      <div className="sk__koerper" style={{ clipPath: CLIP }}>
        <div className="sk__grund sk__grund--hinten" />
        <div className="sk__muster" style={{ backgroundImage: `url("${m.rauten}")` }} />
        <div className="sk__praegung sk__praegung--hinten" />
        <Rahmen s={d.seltenheit} id={`${id}h`} />
      </div>
      <div className="sk__rueck">
        <div className="sk__rueck-kopf">
          <img src="/brand/aga-logo.png" alt="" draggable={false} />
          <span>
            SV Agathenburg-Dollern
            <small>Sammelkarte · Saison {d.saison ?? '2026/27'}</small>
          </span>
        </div>
        <p className="sk__rueck-art">
          {d.art === 'spieler' && d.position ? POSITION_NAME[d.position] : d.art === 'trainer' ? d.rolle ?? 'Trainerstab' : d.serie ?? ART_NAME[d.art]}
        </p>
        <h3 className="sk__rueck-titel" style={{ fontSize: `${Math.min(11, 150 / Math.max(8, d.titel.length)).toFixed(2)}cqw` }}>
          {d.titel}
        </h3>
        {werte.length > 0 && (
          <dl className="sk__werte">
            {werte.slice(0, 5).map((w) => (
              <div key={w.label}>
                <dt>{w.label}</dt>
                <dd>{w.wert}</dd>
              </div>
            ))}
          </dl>
        )}
        {d.rueckseite && <p className="sk__steckbrief">{d.rueckseite}</p>}
        <div className="sk__rueck-fuss">
          <b>{kartenNummer(d) ?? '—'}</b>
          <span>
            <Symbol s={d.seltenheit} />
            {SELTEN_NAME[d.seltenheit]}
            {d.variante ? ' · Glanz' : ''}
            {d.limitiert ? ' · Limitiert' : ''}
          </span>
          {d.credit && <small>Foto: {d.credit}</small>}
        </div>
      </div>
    </div>
  )
}

function SvaKarteRoh({ daten, seite, interaktiv = false, lebend = false, stufe = 'normal', aufdecken, eager, className, style, onClick, ariaLabel }: SvaKarteProps) {
  const ref = useRef<HTMLDivElement>(null)
  const id = useId().replace(/[^a-zA-Z0-9]/g, '')
  useNeigung(ref, interaktiv && stufe !== 'klein')
  const label = useMemo(
    () =>
      ariaLabel ??
      [
        daten.titel,
        daten.art === 'spieler' && daten.nummer != null ? `Nummer ${daten.nummer}` : null,
        daten.position ? POSITION_NAME[daten.position] : daten.art !== 'spieler' ? ART_NAME[daten.art] : null,
        SELTEN_NAME[daten.seltenheit] + (daten.variante ? '-Glanz' : ''),
      ]
        .filter(Boolean)
        .join(', '),
    [ariaLabel, daten],
  )
  // Streif nach jedem neuen „aufdecken" neu starten
  const [streif, setStreif] = useState(0)
  useLayoutEffect(() => {
    if (aufdecken) setStreif((n) => n + 1)
  }, [aufdecken, daten.id])

  return (
    <div
      ref={ref}
      className={[
        'sk',
        `sk--${daten.seltenheit}`,
        `sk--${daten.art}`,
        `sk--${stufe}`,
        daten.figur && (daten.art === 'spieler' || daten.art === 'trainer') ? 'sk--figur' : '',
        interaktiv ? 'is-interaktiv' : '',
        seite === 'hinten' ? 'is-hinten' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
      style={style}
      role={onClick ? 'button' : 'img'}
      tabIndex={onClick ? 0 : undefined}
      aria-label={label}
      onClick={
        onClick || interaktiv
          ? () => {
              if (interaktiv) gyroAnfragen()
              onClick?.()
            }
          : undefined
      }
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick()) : undefined}
    >
      {stufe !== 'klein' && <div className="sk__schatten" aria-hidden="true" />}
      <div className="sk__buehne">
        <div className={`sk__dreh${streif ? ' is-streif' : ''}`} key={streif}>
          <Vorderseite d={daten} id={id} stufe={stufe} lebend={lebend} eager={eager} />
          {seite && <Rueckseite d={daten} id={id} />}
        </div>
      </div>
    </div>
  )
}

/** Die Sammelkarte. Siehe Kopfkommentar + docs/KARTEN.md. */
export const SvaKarte = memo(SvaKarteRoh)
