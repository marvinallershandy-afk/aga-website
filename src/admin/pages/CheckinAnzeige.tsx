import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { qrMatrix, zeichneQr } from '../lib/qr'
import { useCheckinCode, useAlbumEinstellungen, useAlbumStatistik } from '../lib/album'
import { useRoster, useSpiele } from '../lib/queries'
import type { SpielRow } from '../lib/db'
import { playerMedia } from '../../data/playerMedia'
import { hdCutout } from '../../ui/hdCutout'
import './checkin-anzeige.css'

// ─────────────────────────────────────────────────────────────────────────────
// v25-D / v26: „Check-in-Anzeige" — Premium-Vollbild-Bühne fürs iPad am Eingang.
// Drei Ebenen (alle nur CSS-Transform/Opacity, flüssig auf älterem iPad):
//   (1) Grund: dunkel + langsam wandernde Flutlicht-Kegel, dezentes Wappen.
//   (2) Spieler-Held: HD-Freisteller (playerMedia → hdCutout), Zwei-Slot-Crossfade
//       (max. 2 Bilder im DOM) alle 8 s mit Ken-Burns + leichter Parallax,
//       edles Namensschild (Rückennummer groß + Name).
//   (3) QR als Sammelkarte: Rot/Gold-Kante, Wappen + „Check-in"-Prägung,
//       Countdown-Ring + „neuer Code in m:ss", weicher Glanz-Wechsel.
// Kopf: Spieltag groß (SVA – Gegner), Anstoß bzw. Live-Stand mit Minute + Live-Badge.
// Zähler: große hochzählende Zahl „X Fans heute dabei" (Puls bei neuem Check-in),
// Fortschritt zur Belohnung, rotierende Info-Zeile (alle 30 s, kein Alkohol-Wording).
// Funktion unverändert: Rotation, 2-h-Offline-Puffer, Wake Lock, Datenquellen.
// prefers-reduced-motion wird respektiert. Ausstieg nur per langem Druck.
// ─────────────────────────────────────────────────────────────────────────────

interface LiveMini {
  match?: { status?: string; home?: boolean; opponent?: string; goalsFor?: number; goalsAgainst?: number; minute?: string } | null
}

// Belohnungs-Texte am Eingang bleiben familiengerecht (kein Alkohol-Wording).
const ALKOHOL = /freibier|\bbier\b|alkohol|schnaps|\bkorn\b|prosecco|\bsekt\b|\bwein\b|shot/i
const belohnungSauber = (text: string | null | undefined) => {
  const t = (text ?? '').trim()
  return !t || ALKOHOL.test(t) ? 'ein Getränk nach Wahl' : t
}

const mmss = (sek: number) => {
  const s = Math.max(0, sek)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function waehleSpiel(spiele: SpielRow[] | undefined): SpielRow | null {
  if (!spiele?.length) return null
  const heim = spiele.filter((s) => s.heim && !(s as { demo?: boolean }).demo)
  const live = heim.find((s) => s.status === 'live' || s.status === 'halbzeit')
  if (live) return live
  const heute = heim.find((s) => new Date(s.anstoss).toDateString() === new Date().toDateString())
  if (heute) return heute
  const jetzt = Date.now()
  const kommend = heim
    .filter((s) => new Date(s.anstoss).getTime() > jetzt - 3 * 3600_000)
    .sort((a, b) => +new Date(a.anstoss) - +new Date(b.anstoss))[0]
  if (kommend) return kommend
  return heim.sort((a, b) => +new Date(b.anstoss) - +new Date(a.anstoss))[0] ?? null
}

export default function CheckinAnzeige() {
  const navigate = useNavigate()
  const spieleQ = useSpiele()
  const rosterQ = useRoster()
  const einstQ = useAlbumEinstellungen()
  const spiel = useMemo(() => waehleSpiel(spieleQ.data), [spieleQ.data])
  const codeQ = useCheckinCode(spiel?.id ?? null)
  const statQ = useAlbumStatistik(true)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(t)
  }, [])

  const rotation = codeQ.data?.rotation !== false
  const intervallMs = Math.max(1, codeQ.data?.intervallMin ?? 3) * 60_000
  // aktiven Code aus der 2-h-Vorschau wählen (Offline-Puffer); sonst „jetzt"
  const aktiv = useMemo(() => {
    const codes = codeQ.data?.codes ?? []
    const jetzt = codes.find((c) => now >= +new Date(c.von) && now < +new Date(c.bis))
    return jetzt ?? (codeQ.data ? { code: codeQ.data.jetzt.code, von: new Date(now).toISOString(), bis: codeQ.data.jetzt.bis } : null)
  }, [codeQ.data, now])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = spiel && codeQ.data
    ? rotation && aktiv
      ? `${origin}/album?ci=${spiel.id}&rc=${aktiv.code}`
      : `${origin}/album?c=${codeQ.data.token}`
    : ''

  // QR zeichnen, wenn sich die URL ändert
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [wechsel, setWechsel] = useState(false)
  const letzteUrl = useRef('')
  useEffect(() => {
    if (!url || !canvasRef.current) return
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, c.width, c.height)
    zeichneQr(ctx, qrMatrix(url), 0, 0, c.width, '#17120f')
    if (letzteUrl.current && letzteUrl.current !== url) {
      setWechsel(true)
      const t = window.setTimeout(() => setWechsel(false), 900)
      return () => window.clearTimeout(t)
    }
    letzteUrl.current = url
  }, [url])

  // Countdown-Ring bis zum Wechsel
  const restMs = rotation && aktiv ? Math.max(0, +new Date(aktiv.bis) - now) : intervallMs
  const ringPct = rotation ? Math.max(0, Math.min(1, restMs / intervallMs)) : 1
  const restSek = Math.ceil(restMs / 1000)

  // Live-Stand / Status aus /api/live (ruhig, alle 15 s)
  const [live, setLive] = useState<LiveMini | null>(null)
  useEffect(() => {
    let aktivFlag = true
    const holen = async () => {
      try {
        const r = await fetch('/api/live', { cache: 'no-store' })
        if (r.ok && aktivFlag) setLive((await r.json()) as LiveMini)
      } catch {
        /* egal — Anstoß bleibt sichtbar */
      }
    }
    void holen()
    const t = window.setInterval(() => void holen(), 15_000)
    return () => {
      aktivFlag = false
      window.clearInterval(t)
    }
  }, [])

  // Spieler-Helden: HD-Freisteller (playerMedia → Greenscreen/HD zuerst, dann Foto)
  const helden = useMemo(
    () =>
      (rosterQ.data ?? [])
        .filter((r) => r.aktiv && r.rolle === 'spieler' && (r.freisteller_url || r.foto_url))
        .map((r) => {
          const m = playerMedia(r.slug, { cutoutUrl: r.freisteller_url, photoUrl: r.foto_url })
          const bild = m.figure ? hdCutout(m.figure) : r.foto_url
          return { bild: bild as string, cutout: m.cutout, name: r.name, nummer: r.nummer, position: r.position, kapitaen: r.kapitaen }
        })
        .filter((h) => h.bild),
    [rosterQ.data],
  )

  // Bilder vorladen → sofortiger Crossfade
  useEffect(() => {
    helden.forEach((h) => {
      const img = new Image()
      img.decoding = 'async'
      img.src = h.bild
    })
  }, [helden])

  // Zwei-Slot-Crossfade: nur der aktuelle + der vorige Held sind im DOM
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (helden.length < 2) return
    const t = window.setInterval(() => setTick((x) => x + 1), 8000)
    return () => window.clearInterval(t)
  }, [helden.length])
  const n = helden.length
  const curIdx = n ? tick % n : 0
  const prevIdx = n ? (tick - 1 + n) % n : 0
  const slotAIdx = tick % 2 === 0 ? curIdx : prevIdx
  const slotBIdx = tick % 2 === 1 ? curIdx : prevIdx
  const held = helden[curIdx] ?? null

  // Zähler hochzählen + Puls bei neuem Check-in
  const checkins = statQ.data?.spiele?.find((s) => s.spielId === spiel?.id)?.checkins ?? 0
  const [zeigeZahl, setZeigeZahl] = useState(checkins)
  const [puls, setPuls] = useState(false)
  const letzteZahl = useRef(checkins)
  useEffect(() => {
    if (checkins === letzteZahl.current) return
    const start = letzteZahl.current
    const ende = checkins
    letzteZahl.current = checkins
    if (ende > start) {
      setPuls(true)
      window.setTimeout(() => setPuls(false), 900)
    }
    const mm = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (mm?.matches) {
      setZeigeZahl(ende)
      return
    }
    const t0 = performance.now()
    const dauer = 750
    let raf = 0
    const lauf = (t: number) => {
      const p = Math.min(1, (t - t0) / dauer)
      const eased = 1 - Math.pow(1 - p, 3)
      setZeigeZahl(Math.round(start + (ende - start) * eased))
      if (p < 1) raf = requestAnimationFrame(lauf)
    }
    raf = requestAnimationFrame(lauf)
    return () => cancelAnimationFrame(raf)
  }, [checkins])

  // Rotierende Info-Zeile (alle 30 s)
  const schwelle = einstQ.data?.schwelle_1 ?? 3
  const belohnung = belohnungSauber(einstQ.data?.belohnung_1)
  const infos = useMemo(
    () => [`Beim ${schwelle}. Besuch: ${belohnung}`, 'Tipp fürs Spiel gleich abgeben', 'Folge @svagathenburg für alle Updates'],
    [schwelle, belohnung],
  )
  const [infoIdx, setInfoIdx] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setInfoIdx((i) => (i + 1) % infos.length), 30_000)
    return () => window.clearInterval(t)
  }, [infos.length])

  // Wake Lock (Bildschirm bleibt an)
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null
    const anfordern = async () => {
      try {
        const wl = (navigator as Navigator & { wakeLock?: { request: (t: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock
        if (wl) lock = await wl.request('screen')
      } catch {
        /* vom Browser abgelehnt (dann iPad „Automatische Sperre: Nie" nutzen) */
      }
    }
    void anfordern()
    const onVis = () => document.visibilityState === 'visible' && void anfordern()
    document.addEventListener('visibilitychange', onVis)
    return () => {
      document.removeEventListener('visibilitychange', onVis)
      void lock?.release().catch(() => {})
    }
  }, [])

  // Vollbild anfordern (braucht eine Geste → Start-Overlay)
  const [gestartet, setGestartet] = useState(false)
  const starten = useCallback(() => {
    setGestartet(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])

  // Ausstieg nur per langem Druck (1,2 s)
  const druck = useRef<number | null>(null)
  const beenden = useCallback(() => {
    document.exitFullscreen?.().catch(() => {})
    navigate('/album')
  }, [navigate])
  const druckStart = () => {
    druck.current = window.setTimeout(beenden, 1200)
  }
  const druckEnde = () => {
    if (druck.current) window.clearTimeout(druck.current)
    druck.current = null
  }

  const offline = codeQ.isError || (spieleQ.isError && !spieleQ.data)
  const stand = live?.match
  const liveLaeuft = stand?.status === 'live' || stand?.status === 'halbzeit'
  const fortschritt = Math.min(100, (zeigeZahl / Math.max(1, schwelle)) * 100)

  return (
    <div className="ca" onPointerDown={druckStart} onPointerUp={druckEnde} onPointerLeave={druckEnde} onPointerCancel={druckEnde}>
      {/* Ebene 1: dunkler Grund mit wandernden Flutlicht-Kegeln + dezentem Wappen */}
      <div className="ca-grund" aria-hidden="true">
        <span className="ca-grund__kegel ca-grund__kegel--a" />
        <span className="ca-grund__kegel ca-grund__kegel--b" />
        <span className="ca-grund__struktur" />
        <img className="ca-grund__wappen" src="/brand/wappen.png" alt="" />
        <span className="ca-grund__vignette" />
      </div>

      {/* Ebene 2: Spieler-Held (Zwei-Slot-Crossfade) */}
      <div className="ca-held" aria-hidden="true">
        {held && (
          <>
            <div key={`a-${slotAIdx}`} className={`ca-held__bild${tick % 2 === 0 ? ' is-da' : ''}`} style={{ backgroundImage: `url(${helden[slotAIdx]?.bild})` }} />
            <div key={`b-${slotBIdx}`} className={`ca-held__bild${tick % 2 === 1 ? ' is-da' : ''}`} style={{ backgroundImage: `url(${helden[slotBIdx]?.bild})` }} />
          </>
        )}
        <span className="ca-held__sockel" />
      </div>
      {held && (
        <div className="ca-schild" key={curIdx}>
          {held.nummer != null && <b className="ca-schild__nr">{held.nummer}</b>}
          <span className="ca-schild__txt">
            <b>{held.name}</b>
            {held.position && <i>{held.kapitaen ? `${held.position} · Kapitän` : held.position}</i>}
          </span>
        </div>
      )}

      <header className="ca-kopf">
        <img className="ca-wappen" src="/brand/wappen.png" alt="" width="64" height="64" />
        <div className="ca-kopf__txt">
          <span className="ca-kopf__kicker">Check-in am Eingang</span>
          <b className="ca-kopf__paar">
            SVA <span>–</span> {spiel ? spiel.gegner : 'Heimspiel'}
          </b>
          <span className="ca-kopf__zeile">
            {liveLaeuft ? (
              <>
                <i className="ca-live" aria-hidden="true" /> Live {stand?.minute ?? ''} ·{' '}
                {stand?.home ? `${stand?.goalsFor ?? 0}:${stand?.goalsAgainst ?? 0}` : `${stand?.goalsAgainst ?? 0}:${stand?.goalsFor ?? 0}`}
              </>
            ) : spiel ? (
              'Anstoß ' + new Date(spiel.anstoss).toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' Uhr'
            ) : (
              'Kein Heimspiel eingetragen'
            )}
          </span>
        </div>
        <span className={`ca-netz${offline ? ' is-weg' : ''}`} title={offline ? 'offline — Code aus dem Puffer' : 'online'} aria-hidden="true" />
      </header>

      <main className="ca-mitte">
        {/* Ebene 3: QR als Premium-Sammelkarte */}
        <div className="ca-karte-wrap">
          <svg className="ca-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="ca-ring__spur" cx="50" cy="50" r="48" />
            <circle className="ca-ring__lauf" cx="50" cy="50" r="48" style={{ strokeDashoffset: 301.6 * (1 - ringPct) }} />
          </svg>
          <div className={`ca-karte${wechsel ? ' is-wechsel' : ''}`}>
            <div className="ca-karte__innen">
              <div className="ca-karte__kopf">
                <img src="/brand/wappen.png" alt="" width="40" height="40" />
                <span>Check-in</span>
              </div>
              <div className="ca-karte__qr">
                {url ? (
                  <canvas ref={canvasRef} width={720} height={720} className="ca-karte__bild" aria-label="QR-Code zum Einchecken" />
                ) : (
                  <div className="ca-karte__leer">{spiel ? 'Erst einen QR-Code für dieses Spiel erzeugen (Album → Spieltage).' : 'Kein Heimspiel.'}</div>
                )}
              </div>
              <div className="ca-karte__fuss">Scannen · Pack holen · mitmachen</div>
            </div>
            <span className="ca-karte__glanz" aria-hidden="true" />
          </div>
          {rotation && url && (
            <span className="ca-karte__rest">
              neuer Code in <b>{mmss(restSek)}</b>
            </span>
          )}
        </div>

        <div className="ca-panel">
          <p className="ca-panel__claim">
            Sammelkarten wie früher Panini — <b>kostenlos</b>, nur fürs Dabeisein.
          </p>
          <div className="ca-zaehler">
            <b className={`ca-zaehler__zahl${puls ? ' is-puls' : ''}`}>{zeigeZahl}</b>
            <span className="ca-zaehler__wort">Fans heute dabei</span>
          </div>
          <div className="ca-fort" aria-hidden="true">
            <div className="ca-fort__balken" style={{ width: `${fortschritt}%` }} />
          </div>
          <p className="ca-fort__text">
            Beim {schwelle}. Besuch gibt’s {belohnung}.
          </p>
          <p className="ca-info" key={infoIdx}>
            {infos[infoIdx]}
          </p>
        </div>
      </main>

      {!gestartet && (
        <button type="button" className="ca-start" onClick={starten}>
          <span>Check-in-Anzeige starten</span>
          <small>Vollbild · Bildschirm bleibt an · Ausstieg per langem Druck</small>
        </button>
      )}
      <span className="ca-exit-hinweis" aria-hidden="true">lang drücken zum Beenden</span>
    </div>
  )
}
