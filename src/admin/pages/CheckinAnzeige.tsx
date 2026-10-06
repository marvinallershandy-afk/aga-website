import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { qrMatrix, zeichneQr } from '../lib/qr'
import { useCheckinCode, useAlbumEinstellungen, useAlbumStatistik } from '../lib/album'
import { useRoster, useSpiele } from '../lib/queries'
import type { SpielRow } from '../lib/db'
import './checkin-anzeige.css'

// ─────────────────────────────────────────────────────────────────────────────
// v25-D: „Check-in-Anzeige" — Vollbild-Bühne fürs iPad am Eingang/an der Kasse.
// Großer QR mit Countdown-Ring (rotierender Code, docs weiter in BUILD_LOG_V25),
// ruhig wechselnde Spieler-Freisteller (Ken-Burns, nur CSS-Transforms), Spieltags-
// Kopf (SVA – Gegner, Anstoß bzw. Live-Stand aus /api/live), Live-Zähler
// „heute schon X eingecheckt" + Fortschritt zur 1. Belohnung. Bildschirm bleibt an
// (Wake Lock). Kein Admin-UI; Ausstieg nur per langem Druck. Die Codes der nächsten
// 2 h liegen vor (Offline-Puffer) — kurze WLAN-Aussetzer tun nichts.
// ─────────────────────────────────────────────────────────────────────────────

interface LiveMini {
  match?: { status?: string; home?: boolean; opponent?: string; goalsFor?: number; goalsAgainst?: number; minute?: string } | null
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
      const t = window.setTimeout(() => setWechsel(false), 650)
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

  // Ken-Burns-Hintergrund: aktive Spieler mit Foto, alle 9 s wechseln
  const fotos = useMemo(
    () => (rosterQ.data ?? []).filter((r) => r.aktiv && r.rolle === 'spieler' && r.foto_url).map((r) => ({ foto: r.foto_url as string, name: r.name, nummer: r.nummer })),
    [rosterQ.data],
  )
  const [bgIdx, setBgIdx] = useState(0)
  useEffect(() => {
    if (fotos.length < 2) return
    const t = window.setInterval(() => setBgIdx((i) => (i + 1) % fotos.length), 9000)
    return () => window.clearInterval(t)
  }, [fotos.length])

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
  const checkins = statQ.data?.spiele?.find((s) => s.spielId === spiel?.id)?.checkins ?? 0
  const schwelle = einstQ.data?.schwelle_1 ?? 3
  const stand = live?.match
  const liveLaeuft = stand?.status === 'live' || stand?.status === 'halbzeit'

  return (
    <div className="ca" onPointerDown={druckStart} onPointerUp={druckEnde} onPointerLeave={druckEnde} onPointerCancel={druckEnde}>
      {/* Hintergrund: Ken-Burns-Spielerbilder */}
      <div className="ca-bg" aria-hidden="true">
        {fotos.map((p, i) => (
          <div key={p.foto} className={`ca-bg__bild${i === bgIdx ? ' is-da' : ''}`} style={{ backgroundImage: `url(${p.foto})` }} />
        ))}
        <div className="ca-bg__flor" />
      </div>

      <header className="ca-kopf">
        <img className="ca-wappen" src="/brand/wappen.png" alt="" width="64" height="64" />
        <div className="ca-kopf__txt">
          <span className="ca-kopf__kicker">Check-in am Eingang</span>
          <b className="ca-kopf__paar">SV Agathenburg-Dollern{spiel ? ` – ${spiel.gegner}` : ''}</b>
          <span className="ca-kopf__zeile">
            {liveLaeuft ? (
              <>
                <i className="ca-live" aria-hidden="true" /> {stand?.minute ?? 'Live'} · {stand?.home ? `${stand?.goalsFor ?? 0}:${stand?.goalsAgainst ?? 0}` : `${stand?.goalsAgainst ?? 0}:${stand?.goalsFor ?? 0}`}
              </>
            ) : spiel ? (
              new Date(spiel.anstoss).toLocaleString('de-DE', { weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit' }) + ' Uhr'
            ) : (
              'Kein Heimspiel eingetragen'
            )}
          </span>
        </div>
        <span className={`ca-netz${offline ? ' is-weg' : ''}`} title={offline ? 'offline — Code aus dem Puffer' : 'online'} aria-hidden="true" />
      </header>

      <main className="ca-mitte">
        <div className={`ca-qr${wechsel ? ' is-wechsel' : ''}`}>
          <svg className="ca-ring" viewBox="0 0 100 100" aria-hidden="true">
            <circle className="ca-ring__spur" cx="50" cy="50" r="47" />
            <circle className="ca-ring__lauf" cx="50" cy="50" r="47" style={{ strokeDashoffset: 295.3 * (1 - ringPct) }} />
          </svg>
          <div className="ca-qr__rahmen">
            {url ? (
              <canvas ref={canvasRef} width={720} height={720} className="ca-qr__bild" aria-label="QR-Code zum Einchecken" />
            ) : (
              <div className="ca-qr__leer">{spiel ? 'Erst einen QR-Code für dieses Spiel erzeugen (Album → Spieltage).' : 'Kein Heimspiel.'}</div>
            )}
          </div>
          {rotation && url && <span className="ca-qr__rest">wechselt in {restSek}s</span>}
        </div>

        <div className="ca-text">
          <p className="ca-schritte">Scannen · Pack holen · mitmachen</p>
          <p className="ca-sub">Sammelkarten wie früher Panini — kostenlos, nur fürs Dabeisein.</p>
          <div className="ca-zaehler">
            <b>{checkins}</b>
            <span>heute schon eingecheckt</span>
          </div>
          <div className="ca-fort" aria-hidden="true">
            <div className="ca-fort__balken" style={{ width: `${Math.min(100, (checkins / Math.max(1, schwelle)) * 100)}%` }} />
          </div>
          <p className="ca-fort__text">
            Beim {schwelle}. Heimspiel gibt’s {einstQ.data?.belohnung_1 ?? 'ein Getränk nach Wahl'}.
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
