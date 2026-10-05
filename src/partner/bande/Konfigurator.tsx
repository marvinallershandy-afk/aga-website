import { useEffect, useRef, useState } from 'react'
import { ArrowRight, Check, Download } from 'lucide-react'
import { EntwurfFelder } from './EntwurfFelder'
import { dateiname, entwurfAktiv, useEntwurf, type EntwurfZustand } from './entwurf'
import { schriftenBereit, zeichneTafel } from './tafel'
import { FOTO, ladeFoto, zeichneSpieltag, type Ausschnitt } from './foto'
import { BANDEN_PAKET, MEDIADATEN, plaetzeText, preisText, zahl, REICHWEITE_FALLBACK } from '../../data/partner'
import { CONTACT } from '../../data/content'
import { NELE } from '../../data/club'
import './bande.css'

// ─────────────────────────────────────────────────────────────
// v18-P: „Diese Bande sucht dich" auf /partner — der Verkaufs-Konfigurator.
// Name tippen, Logo wählen (bleibt lokal) → flache Tafel + echtes Spieltags-
// foto mit der Tafel an der freien Stelle der Bande. Daneben Paket/Preis,
// Reichweite (nur echte Zahlen) und „Mit diesem Entwurf anfragen".
// „Vorschau als Bild speichern" erzeugt ein PNG zum Weiterschicken.
// ─────────────────────────────────────────────────────────────

const PLATZHALTER = 'Dein Name hier'

function tafelInhalt(e: EntwurfZustand) {
  return entwurfAktiv(e)
    ? { name: e.name, zeile2: e.zeile2, logo: e.logo, grund: e.grund }
    : { name: PLATZHALTER, zeile2: e.zeile2, logo: null, grund: e.grund }
}

/** Tafel in ein neues Canvas zeichnen (Breite × Breite/Seite). */
function tafelCanvas(e: EntwurfZustand, breite: number, seite: number) {
  const cv = document.createElement('canvas')
  cv.width = breite
  cv.height = Math.round(breite / seite)
  zeichneTafel(cv.getContext('2d')!, 0, 0, cv.width, cv.height, tafelInhalt(e))
  return cv
}

export function Konfigurator({ onAnfragen }: { onAnfragen: () => void }) {
  const e = useEntwurf()
  const aktiv = entwurfAktiv(e)
  const [hinweis, setHinweis] = useState<string | null>(null)
  const anfragen = () => {
    if (!aktiv) {
      setHinweis('Tipp zuerst deinen Firmennamen ein — dann geht der Entwurf mit.')
      document.querySelector<HTMLInputElement>('#deine-bande [data-bande-name]')?.focus()
      return
    }
    setHinweis(null)
    onAnfragen()
  }
  return (
    <section id="deine-bande" className="pt-sec bk" aria-labelledby="h-bande">
      <div>
        <p className="pt-kicker">Probier’s aus · bleibt in deinem Browser</p>
        <h2 className="pt-h2" id="h-bande">
          Diese Bande sucht dich
        </h2>
        <p className="pt-lead pt-lead--sm">
          Am Waldsportplatz ist noch Platz. Tipp deinen Firmennamen ein, lad dein Logo hoch — und sieh sofort, wie deine Bande am Spieltag hängt.
        </p>
      </div>
      <div className="bk-grid">
        <div className="bk-steuer">
          <EntwurfFelder onEingabe={() => setHinweis(null)} />
          <FlachVorschau e={e} />
        </div>
        <SpieltagVorschau e={e} />
      </div>
      <Angebot aktiv={aktiv} onAnfragen={anfragen} hinweis={hinweis} e={e} />
    </section>
  )
}

function FlachVorschau({ e }: { e: EntwurfZustand }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    let ab = false
    schriftenBereit().then(() => {
      const cv = ref.current
      if (ab || !cv) return
      const ctx = cv.getContext('2d')!
      ctx.clearRect(0, 0, cv.width, cv.height)
      zeichneTafel(ctx, 0, 0, cv.width, cv.height, tafelInhalt(e))
    })
    return () => {
      ab = true
    }
  }, [e])
  return (
    <div className="bk-flach">
      <span className="bk-flach__label">Deine Tafel</span>
      <canvas ref={ref} className="ptafel" width={1040} height={400} role="img" aria-label={`Bandentafel: ${e.name || PLATZHALTER}`} />
    </div>
  )
}

function SpieltagVorschau({ e }: { e: EntwurfZustand }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const [aus, setAus] = useState<Ausschnitt>('nah')
  const [foto, setFoto] = useState<HTMLImageElement | null>(null)
  const [sichtbar, setSichtbar] = useState(() => typeof IntersectionObserver === 'undefined')

  // Foto erst laden, wenn der Abschnitt in die Nähe kommt
  useEffect(() => {
    const el = box.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver((es) => es.some((x) => x.isIntersecting) && setSichtbar(true), { rootMargin: '600px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!sichtbar) return
    const gross = window.innerWidth * (window.devicePixelRatio || 1) > 1100
    let ab = false
    ladeFoto(gross)
      .then((f) => !ab && setFoto(f))
      .catch(() => {})
    return () => {
      ab = true
    }
  }, [sichtbar])

  useEffect(() => {
    const cv = ref.current
    if (!cv || !foto) return
    let ab = false
    const raf = requestAnimationFrame(() => {
      schriftenBereit().then(() => {
        if (ab) return
        const a = FOTO.ausschnitt[aus]
        const k = foto.naturalWidth / FOTO.breite
        cv.width = Math.round(a.w * k * (aus === 'nah' ? 1.5 : 1))
        cv.height = Math.round(cv.width / 1.5)
        zeichneSpieltag(cv, foto, tafelCanvas(e, 780, FOTO.tafelSeite), aus)
      })
    })
    return () => {
      ab = true
      cancelAnimationFrame(raf)
    }
  }, [e, foto, aus])

  return (
    <div className="bk-buehne" ref={box}>
      <div className="bk-buehne__kopf">
        <span className="bk-buehne__label">So sieht’s am Spieltag aus</span>
        <div className="bk-seg" role="radiogroup" aria-label="Bildausschnitt">
          {(
            [
              ['nah', 'Nah dran'],
              ['totale', 'Ganzes Bild'],
            ] as [Ausschnitt, string][]
          ).map(([v, l]) => (
            <label key={v} className="bk-seg__opt">
              <input type="radio" name="bk-ausschnitt" value={v} checked={aus === v} onChange={() => setAus(v)} />
              <span>{l}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="bk-foto">
        <canvas ref={ref} width={1230} height={820} role="img" aria-label={`Spieltagsfoto vom Waldsportplatz mit der Bande ${e.name || PLATZHALTER}`} />
        {!foto && <span className="bk-foto__laden">Foto lädt …</span>}
      </div>
      <div className="bk-foto__fuss">
        <p className="ds-credit">
          Foto:{' '}
          <a href={NELE.instagramUrl} target="_blank" rel="noreferrer">
            {NELE.name}
          </a>{' '}
          · Waldsportplatz, Meisterspieltag 2026 · Entwurf zur Ansicht
        </p>
        <a className="bk-knopf bk-knopf--text" href="/#partner">
          Auch auf der 3D-Bande ansehen <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </a>
      </div>
    </div>
  )
}

function Angebot({ aktiv, onAnfragen, hinweis, e }: { aktiv: boolean; onAnfragen: () => void; hinweis: string | null; e: EntwurfZustand }) {
  const p = BANDEN_PAKET
  const plaetze = p ? plaetzeText(p) : null
  const knapp = p?.frei != null && p.frei > 0 && p.frei <= 2
  const [speichert, setSpeichert] = useState(false)
  const speichern = async () => {
    setSpeichert(true)
    try {
      await bildSpeichern(e)
    } finally {
      setSpeichert(false)
    }
  }
  return (
    <div className="bk-angebot">
      {p && (
        <div className="bk-paket">
          <p className="pt-kicker">Das Paket dazu</p>
          <h3 className="bk-paket__name">{p.name}</h3>
          <p className="bk-paket__preis">{preisText(p)}</p>
          {plaetze && <p className={`bk-paket__plaetze${knapp ? ' is-knapp' : ''}`}>{plaetze}</p>}
          {p.leistungen.length > 0 && (
            <ul>
              {p.leistungen.slice(0, 4).map((l) => (
                <li key={l}>
                  <Check size={14} strokeWidth={1.5} aria-hidden="true" /> {l}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <Reichweite />
      <div className="bk-angebot__aktionen">
        <button type="button" className="bk-knopf bk-knopf--rot" onClick={onAnfragen}>
          Mit diesem Entwurf anfragen
        </button>
        <button type="button" className="bk-knopf bk-knopf--linie" onClick={() => void speichern()} disabled={speichert}>
          <Download size={16} strokeWidth={1.5} aria-hidden="true" />
          {speichert ? 'Bild wird erstellt …' : 'Vorschau als Bild speichern'}
        </button>
        {hinweis && (
          <p className="bk-fehler" role="status">
            {hinweis}
          </p>
        )}
        {!aktiv && !hinweis && <p className="bk-hinweis">Das Bild kannst du z. B. an deinen Chef oder dein Team schicken.</p>}
      </div>
    </div>
  )
}

/** Reichweite — nur echte Zahlen (Admin-Mediadaten bzw. Vereinsangabe). */
function Reichweite() {
  const m = MEDIADATEN
  const fakten: { dt: string; dd: string; sub?: string }[] = []
  const follower = m.instagramFollower ?? REICHWEITE_FALLBACK.instagramFollower
  if (follower != null) fakten.push({ dt: m.instagramFollower != null ? zahl(follower) : `${zahl(follower)}+`, dd: 'Follower auf Instagram', sub: CONTACT.instagram })
  if (m.reichweiteMonat != null) fakten.push({ dt: zahl(m.reichweiteMonat), dd: 'erreichte Konten pro Monat', sub: 'Instagram' })
  if (m.zuschauerHeim != null) fakten.push({ dt: zahl(m.zuschauerHeim), dd: 'Ø Zuschauer pro Heimspiel', sub: 'am Waldsportplatz' })
  else if (m.checkinsSchnitt != null && m.checkinsSpiele) fakten.push({ dt: zahl(m.checkinsSchnitt), dd: 'Ø digitale Check-ins pro Heimspiel', sub: 'gezählt per Sammelalbum' })
  if (m.heimspieleSaison != null) fakten.push({ dt: zahl(m.heimspieleSaison), dd: 'Heimspiele pro Saison', sub: 'jedes Mal hängt deine Bande' })
  if (m.websiteBesucheMonat != null) fakten.push({ dt: zahl(m.websiteBesucheMonat), dd: 'Website-Besuche pro Monat', sub: 'inkl. 3D-Bande' })
  else fakten.push({ dt: '3D', dd: 'Deine Bande auch online', sub: 'auf der Vereinsseite, rund um die Uhr' })
  return (
    <div>
      <p className="pt-kicker">Wer sie sieht</p>
      <dl className="bk-fakten">
        {fakten.map((f) => (
          <div key={f.dd}>
            <dt>{f.dt}</dt>
            <dd>
              {f.dd}
              {f.sub && <small>{f.sub}</small>}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ── PNG zum Weiterschicken ──────────────────────────────────
const EXPORT = { x: 560, y: 180, w: 1440, h: 960 }

async function bildSpeichern(e: EntwurfZustand) {
  await schriftenBereit()
  const foto = await ladeFoto(true)
  const W = 1440
  const FH = 960
  const UH = 360
  const cv = document.createElement('canvas')
  cv.width = W
  cv.height = FH + UH
  const ctx = cv.getContext('2d')!
  // Foto-Ausschnitt mit Tafel (eigener Ausschnitt fürs Bild)
  const szene = document.createElement('canvas')
  szene.width = W
  szene.height = FH
  zeichneSpieltag(szene, foto, tafelCanvas(e, 780, FOTO.tafelSeite), EXPORT)
  ctx.drawImage(szene, 0, 0)
  // Unterteil
  ctx.fillStyle = '#0B0A0B'
  ctx.fillRect(0, FH, W, UH)
  ctx.fillStyle = '#E91D29'
  ctx.fillRect(0, FH, W, 6)
  const pad = 64
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = 'left'
  ctx.fillStyle = '#E91D29'
  ctx.font = '700 22px "Archivo Variable", Archivo, sans-serif'
  ctx.fillText('ENTWURF · BANDE AM WALDSPORTPLATZ', pad, FH + 78)
  ctx.fillStyle = '#F4F2EF'
  const name = (e.name.trim() || PLATZHALTER).toUpperCase()
  let px = 76
  ctx.font = `400 ${px}px Anton, sans-serif`
  while (ctx.measureText(name).width > 640 && px > 30) {
    px -= 2
    ctx.font = `400 ${px}px Anton, sans-serif`
  }
  ctx.fillText(name, pad, FH + 78 + 18 + px)
  ctx.fillStyle = 'rgba(244,242,239,.7)'
  ctx.font = '500 24px "Archivo Variable", Archivo, sans-serif'
  ctx.fillText('SV Agathenburg-Dollern · Kreisliga Stade', pad, FH + 250)
  ctx.fillStyle = 'rgba(244,242,239,.48)'
  ctx.font = '500 18px "Archivo Variable", Archivo, sans-serif'
  ctx.fillText(`Foto: ${NELE.name} · Entwurf zur Ansicht, Gestaltung und Maße nach Absprache`, pad, FH + UH - 40)
  // flache Tafel rechts
  const tw = 600
  const tafel = tafelCanvas(e, tw * 2, 2.6)
  const th = tw / 2.6
  ctx.drawImage(tafel, W - pad - tw, FH + 66, tw, th)
  ctx.strokeStyle = 'rgba(244,242,239,.12)'
  ctx.lineWidth = 1
  ctx.strokeRect(W - pad - tw + 0.5, FH + 66 + 0.5, tw - 1, th - 1)
  const blob = await new Promise<Blob | null>((r) => cv.toBlob(r, 'image/png'))
  if (!blob) return
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = dateiname(e.name)
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 4000)
}
