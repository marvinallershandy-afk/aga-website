import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { qrMatrix, zeichneQr } from '../lib/qr'
import { useCheckinCode, useAlbumEinstellungen, useAlbumStatistik, useCodeErzeugen } from '../lib/album'
import { useRoster, useSpiele } from '../lib/queries'
import type { RosterRow, SpielRow } from '../lib/db'
import { fetchLive } from '../../live/api'
import type { LiveEvent, LiveMatch } from '../../live/model'
import { SvaKarte } from '../../karten/SvaKarte'
import { vonAlbumKarte } from '../../karten/adapter'
import type { KartenDaten, Position } from '../../karten/typen'
import { playerMedia } from '../../data/playerMedia'
import { TorJubel, type TorDaten } from '../../ui/tor/TorJubel'
import { useTorErkennung, teamKurz, vorladen } from '../../ui/tor/useTor'
import { VORF_DREHBUCH, vorfuehrStand } from './checkinVorfuehrung'
import './checkin-anzeige.css'

// ─────────────────────────────────────────────────────────────────────────────
// v26: „Check-in-Anzeige" — Premium-Schaustück fürs iPad am Eingang/an der Theke.
//
// LINKS  ruhige QR-Zone: Premium-Sammelkarten-Rahmen mit Wappen, QR ≥ 45 % der
//        kurzen Seite, immer voll sichtbar, Glanz-Sweep nur auf dem Rahmen.
//        Code tauscht STILL (weicher Übergang) — kein Countdown, kein Ring.
// OBEN   Scorebug (TV-Anzeigetafel, Stil src/ui/tor): SVA-Wappen ↔ Gegner-Kürzel,
//        großer Stand in Display-Schrift, Minute mit Live-Punkt / Anstoßzeit /
//        „Endstand". Immer sichtbar über allen Szenen. Minute rollt (Ziffern).
// RECHTS Bühne mit filmischen Szenen (~8,5 s): Karten-Showcase (echte <SvaKarte/>),
//        Team-Wand (Kachelwand + Zoom), Heute (Fan-Zähler + Belohnung),
//        Shiny-Moment. Nach einem SVA-Tor eine „Torschütze"-Szene.
// TOR    nutzt die vorhandene TOR!-Einblendung (src/ui/tor), Vollbild, Auto-Dismiss.
//        Datenquelle web_live über fetchLive (/api/live + RPC-Fallback),
//        Polling 15 s nur bei live/halbzeit, sonst langsamer. Dedupe via
//        sessionStorage, nie beim ersten Laden.
// ABPFIFF eigener Schlusspfiff-Moment (Endstand, Sieg-Glanz, Danke) — einmal beim
//        Status-Wechsel auf „beendet" (echt + Vorführung).
// VORFÜHRUNG  /admin/checkin-anzeige?vorfuehrung=1 — komplett lokal simuliert
//        (Drehbuch in checkinVorfuehrung.ts), Platzhalter-QR, „Vorführung"-Hinweis.
//
// Nur transform/opacity (GPU), Bilder vorladen, prefers-reduced-motion. Funktion
// unverändert: Rotation/Codes, Offline-Puffer, Wake Lock, useCodeErzeugen,
// Langdruck-Ausstieg, Daten aus useSpiele/useRoster/useAlbumStatistik.
// ─────────────────────────────────────────────────────────────────────────────

interface LiveMini {
  match?: LiveMatch | null
  events?: LiveEvent[]
  /** fertig formatierte Minute (Vorführung: inkl. Nachspielzeit) */
  minuteTxt?: string
}

// Belohnungs-Texte am Eingang bleiben familiengerecht (kein Alkohol-Wording).
const ALKOHOL = /freibier|\bbier\b|alkohol|schnaps|\bkorn\b|prosecco|\bsekt\b|\bwein\b|shot/i
const belohnungSauber = (text: string | null | undefined) => {
  const t = (text ?? '').trim()
  return !t || ALKOHOL.test(t) ? 'ein Getränk nach Wahl' : t
}

const POS: Record<string, Position> = { TW: 'TW', TORWART: 'TW', ABW: 'ABW', ABWEHR: 'ABW', MIT: 'MIT', MITTELFELD: 'MIT', ANG: 'ANG', STURM: 'ANG', ANGRIFF: 'ANG' }
const posCode = (p: string | null | undefined): Position => POS[(p ?? '').toUpperCase()] ?? 'MIT'
const nachname = (name: string) => name.trim().split(/\s+/).slice(-1)[0] ?? ''
const minuteEv = (min?: number | null, extra?: number | null) => `${min ?? 0}${extra ? `+${extra}` : ''}′`

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

/** Roster-Zeile → Sammelkarte (echte Daten/Assets über den Karten-Adapter). */
function karteVonRoster(r: RosterRow): KartenDaten {
  return vonAlbumKarte(
    {
      id: `ci:${r.id}`,
      typ: 'spieler',
      titel: r.name,
      seltenheit: r.kapitaen ? 'gold' : 'bronze',
      spieler: {
        slug: r.slug,
        name: r.name,
        nummer: r.nummer ?? undefined,
        position: posCode(r.position),
        fotoUrl: r.foto_url ?? undefined,
        cutoutUrl: r.freisteller_url ?? undefined,
        kapitaen: r.kapitaen || undefined,
        seit: r.im_verein_seit ?? undefined,
        neuzugang: r.neuzugang || undefined,
      },
    },
    { saison: '2026/27' },
  )
}

// Feste Staub-Partikel im Flutlicht (kein Math.random beim Rendern)
const STAUB = Array.from({ length: 14 }, (_, i) => ({
  x: (i * 61.8) % 100,
  y: (i * 37.5) % 100,
  s: 2 + (i % 3),
  d: 18 + ((i * 7) % 16),
  t: (i * 1.7) % 9,
}))

const SZENE_MS = 8500
type SzeneTyp = 'showcase' | 'team' | 'heute' | 'shiny' | 'scorer'

export default function CheckinAnzeige() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const vorfuehrung = params.get('vorfuehrung') === '1'

  const spieleQ = useSpiele()
  const rosterQ = useRoster()
  const einstQ = useAlbumEinstellungen()
  const spiel = useMemo(() => waehleSpiel(spieleQ.data), [spieleQ.data])

  // ── Codes / QR ──────────────────────────────────────────────
  // In der Vorführung werden KEINE echten Codes geholt (spielId = null).
  const codeQ = useCheckinCode(vorfuehrung ? null : spiel?.id ?? null)
  const erzeugen = useCodeErzeugen()
  const versucht = useRef<string | null>(null)
  useEffect(() => {
    if (vorfuehrung || !spiel || codeQ.data || !codeQ.error || versucht.current === spiel.id) return
    if (!String((codeQ.error as { message?: string }).message ?? '').includes('album_kein_spielcode')) return
    versucht.current = spiel.id
    erzeugen.mutate({ spielId: spiel.id, partnerId: null, neu: false }, { onSuccess: () => void codeQ.refetch() })
  }, [vorfuehrung, spiel, codeQ, erzeugen])

  const statQ = useAlbumStatistik(!vorfuehrung)

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  const rotation = codeQ.data?.rotation !== false
  // aktiven Code aus der 2-h-Vorschau wählen (Offline-Puffer); sonst „jetzt"
  const aktiv = useMemo(() => {
    const codes = codeQ.data?.codes ?? []
    const jetzt = codes.find((c) => now >= +new Date(c.von) && now < +new Date(c.bis))
    return jetzt ?? (codeQ.data ? { code: codeQ.data.jetzt.code, von: new Date(now).toISOString(), bis: codeQ.data.jetzt.bis } : null)
  }, [codeQ.data, now])

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = vorfuehrung
    ? `${origin}/album?demo=1`
    : spiel && codeQ.data
      ? rotation && aktiv
        ? `${origin}/album?ci=${spiel.id}&rc=${aktiv.code}`
        : `${origin}/album?c=${codeQ.data.token}`
      : ''

  // QR zeichnen; stiller, weicher Übergang beim Code-Wechsel (Glanz nur am Rahmen)
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
      letzteUrl.current = url
      return () => window.clearTimeout(t)
    }
    letzteUrl.current = url
  }, [url])

  // ── Kader & Karten (echte Daten/Assets) ─────────────────────
  const spielerRows = useMemo(
    () => (rosterQ.data ?? []).filter((r) => r.aktiv && r.rolle === 'spieler' && (r.freisteller_url || r.foto_url)),
    [rosterQ.data],
  )
  const karten = useMemo(() => spielerRows.map(karteVonRoster), [spielerRows])
  const kader = useMemo(() => new Map(spielerRows.map((r) => [r.slug, r])), [spielerRows])
  const scorerSlugs = useMemo(() => {
    const ang = spielerRows.filter((r) => posCode(r.position) === 'ANG').map((r) => r.slug)
    const alle = spielerRows.map((r) => r.slug)
    const reihe = [...new Set([...ang, ...alle])]
    return [reihe[0] ?? '', reihe[1] ?? reihe[0] ?? '']
  }, [spielerRows])

  // Karten-Figuren vorladen → weiche Szenenwechsel
  useEffect(() => {
    karten.forEach((k) => {
      if (!k.figur) return
      const img = new Image()
      img.decoding = 'async'
      img.src = k.figur
    })
  }, [karten])

  // ── Live-Daten ──────────────────────────────────────────────
  const [live, setLive] = useState<LiveMini | null>(null)

  // Echtbetrieb: web_live (fetchLive = /api/live + RPC-Fallback), adaptives Polling
  useEffect(() => {
    if (vorfuehrung) return
    let aktivFlag = true
    let timer = 0
    const tick = async () => {
      try {
        const d = await fetchLive()
        if (!aktivFlag) return
        setLive(d)
        const st = d?.match?.status
        timer = window.setTimeout(tick, st === 'live' || st === 'halbzeit' ? 15_000 : 60_000)
      } catch {
        if (aktivFlag) timer = window.setTimeout(tick, 60_000)
      }
    }
    void tick()
    return () => {
      aktivFlag = false
      window.clearTimeout(timer)
    }
  }, [vorfuehrung])

  // Vorführung: reine lokale Simulation nach Drehbuch (nichts ins Netz, nichts in die DB)
  const [simFans, setSimFans] = useState(VORF_DREHBUCH.startFans)
  const simStart = useRef(0)
  useEffect(() => {
    if (!vorfuehrung) return
    simStart.current = performance.now()
    const opp = spiel?.gegner ?? VORF_DREHBUCH.gegnerFallback
    const kick = (() => {
      const d = new Date()
      d.setHours(Number(VORF_DREHBUCH.anstossText.slice(0, 2)), Number(VORF_DREHBUCH.anstossText.slice(3, 5)), 0, 0)
      return d.toISOString()
    })()
    const loopMs = VORF_DREHBUCH.loopSek * 1000
    const tick = () => {
      const st = vorfuehrStand(performance.now() - simStart.current)
      const match: LiveMatch = {
        id: 'vorf',
        opponent: opp,
        home: true,
        kickoff: kick,
        status: st.cur.status,
        minute: st.cur.minute,
        goalsFor: st.cur.sva,
        goalsAgainst: st.cur.geg,
        demo: true,
      }
      const events: LiveEvent[] = st.tore
        .map((e, i) => ({
          id: `vf-${st.durchlauf}-${i}`,
          type: (e.tor === 'sva' ? 'tor' : 'gegentor') as LiveEvent['type'],
          minute: e.minute,
          extra: e.nachspiel ?? null,
          player: e.tor === 'sva' ? scorerSlugs[e.schuetze ?? 0] : undefined,
          at: new Date(simStart.current + st.durchlauf * loopMs + e.bei * 1000).toISOString(),
        }))
        .reverse()
      const minuteTxt = st.cur.status === 'geplant' ? '' : minuteEv(st.cur.minute, st.cur.nachspiel)
      setLive({ match, events, minuteTxt })
      setSimFans(st.fans)
    }
    tick()
    const t = window.setInterval(tick, 250)
    return () => window.clearInterval(t)
  }, [vorfuehrung, spiel?.gegner, scorerSlugs])

  // ── Scorebug-Ableitung (echt + Vorführung) ──────────────────
  const m = live?.match
  const status = (m?.status ?? spiel?.status ?? null) as string | null
  const liveLaeuft = status === 'live' || status === 'halbzeit'
  const beendet = status === 'beendet'
  const svaTore = m ? m.goalsFor : spiel?.tore_sva ?? null
  const gegTore = m ? m.goalsAgainst : spiel?.tore_gegner ?? null
  const gegner = m?.opponent ?? spiel?.gegner ?? 'Gegner'
  const gegnerKurz = teamKurz(gegner)
  const anstossZeit = vorfuehrung
    ? VORF_DREHBUCH.anstossText
    : spiel
      ? new Date(spiel.anstoss).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      : '15:00'
  const minuteTxt = status === 'halbzeit' ? 'Halbzeit' : live?.minuteTxt ?? (m?.minute != null ? minuteEv(m.minute) : '')

  // ── TOR-Erkennung (vorhandene Einblendung aus src/ui/tor) ────
  const spielKeyTor = liveLaeuft && (m?.id || spiel?.id) ? (m?.id ?? spiel?.id ?? null) : null
  const scorerPending = useRef<string | null>(null)
  const torBauen = useCallback(
    async (sva: boolean): Promise<TorDaten | null> => {
      const a = svaTore ?? 0
      const b = gegTore ?? 0
      const key = `${spielKeyTor}-${a}-${b}`
      if (!vorfuehrung && typeof sessionStorage !== 'undefined') {
        if (sessionStorage.getItem('ca-tor') === key) return null
        sessionStorage.setItem('ca-tor', key)
      }
      const ev = (live?.events ?? []).find((e) => e.type === (sva ? 'tor' : 'gegentor'))
      const sid = ev?.player ?? undefined
      const k = sid ? kader.get(sid) : undefined
      const media = sid ? playerMedia(sid, { cutoutUrl: k?.freisteller_url, photoUrl: k?.foto_url }) : null
      if (sva) {
        await vorladen(media?.figure ?? media?.bild)
        scorerPending.current = k ? sid ?? null : null
      }
      return {
        key,
        art: sva ? 'tor' : 'gegentor',
        name: k?.name,
        nummer: k?.nummer ?? null,
        vorlage: ev?.player2 ? nachname(kader.get(ev.player2)?.name ?? '') || undefined : undefined,
        minute: ev ? minuteEv(ev.minute, ev.extra) : live?.minuteTxt || undefined,
        heim: 'SVA',
        gast: gegnerKurz,
        toreHeim: a,
        toreGast: b,
        heimTrifft: sva,
        figur: media?.figure ?? media?.bild ?? null,
        video: media?.jubel ?? media?.loop ?? null,
        gegner,
      }
    },
    [svaTore, gegTore, spielKeyTor, vorfuehrung, live, kader, gegner, gegnerKurz],
  )
  const [tor, torZu] = useTorErkennung(spielKeyTor, svaTore, gegTore, torBauen)

  // ── Szenen-Maschine ─────────────────────────────────────────
  const szenen = useMemo<SzeneTyp[]>(() => {
    const s: SzeneTyp[] = []
    if (karten.length >= 1) s.push('showcase')
    if (karten.length >= 4) s.push('team')
    s.push('heute')
    if (karten.length >= 1) s.push('shiny')
    return s
  }, [karten.length])
  const [szeneTick, setSzeneTick] = useState(0)
  const [scorerSlug, setScorerSlug] = useState<string | null>(null)
  useEffect(() => {
    const t = window.setInterval(() => setSzeneTick((x) => x + 1), SZENE_MS)
    return () => window.clearInterval(t)
  }, [])
  // Nach einem SVA-Tor: die Karte des Torschützen zeigen (Torschütze-Szene)
  useEffect(() => {
    if (tor?.art !== 'tor') return
    const sid = scorerPending.current
    if (!sid || !kader.has(sid)) return
    setScorerSlug(sid)
    const t = window.setTimeout(() => setScorerSlug(null), 11_000)
    return () => window.clearTimeout(t)
  }, [tor, kader])

  const szene: SzeneTyp = scorerSlug ? 'scorer' : szenen[szeneTick % Math.max(1, szenen.length)] ?? 'heute'
  const szeneKey = szene === 'scorer' ? `scorer-${scorerSlug}` : `${szene}-${szeneTick}`

  // (Team-Wand: Aufbau-Stagger + Zoom auf einen Spieler rein per CSS-Timing)

  // ── Abpfiff-Moment (echt + Vorführung) ──────────────────────
  const [abpfiff, setAbpfiff] = useState<null | { gast: string; th: number; tg: number; sieg: boolean }>(null)
  const letzterStatus = useRef<string | null>(null)
  useEffect(() => {
    const prev = letzterStatus.current
    letzterStatus.current = status
    if (status === 'beendet' && prev && prev !== 'beendet' && svaTore != null && gegTore != null) {
      setAbpfiff({ gast: gegnerKurz, th: svaTore, tg: gegTore, sieg: svaTore > gegTore })
      const t = window.setTimeout(() => setAbpfiff(null), 8000)
      return () => window.clearTimeout(t)
    }
  }, [status, svaTore, gegTore, gegnerKurz])

  // ── Fan-Zähler (hochzählen + Puls) ──────────────────────────
  const checkins = vorfuehrung ? simFans : statQ.data?.spiele?.find((s) => s.spielId === spiel?.id)?.checkins ?? 0
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
    const t0 = performance.now()
    const dauer = mm?.matches ? 0 : 750
    let raf = 0
    const lauf = (t: number) => {
      const p = dauer <= 0 ? 1 : Math.min(1, (t - t0) / dauer)
      const eased = 1 - Math.pow(1 - p, 3)
      setZeigeZahl(Math.round(start + (ende - start) * eased))
      if (p < 1) raf = requestAnimationFrame(lauf)
    }
    raf = requestAnimationFrame(lauf)
    return () => cancelAnimationFrame(raf)
  }, [checkins])

  const schwelle = einstQ.data?.schwelle_1 ?? 3
  const belohnung = belohnungSauber(einstQ.data?.belohnung_1)
  const ziel = Math.max(25, Math.ceil((zeigeZahl + 1) / 25) * 25)
  const fortschritt = Math.min(100, (zeigeZahl / ziel) * 100)
  const fortText = zeigeZahl >= ziel ? `Starker Spieltag — schon ${zeigeZahl} dabei!` : `Noch ${ziel - zeigeZahl} bis ${ziel} Fans heute`

  // ── Wake Lock ───────────────────────────────────────────────
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

  // ── Start-Karte (Geste für Vollbild) + Vorführ-Umschaltung ──
  const [gestartet, setGestartet] = useState(false)
  const starten = useCallback(() => {
    setGestartet(true)
    document.documentElement.requestFullscreen?.().catch(() => {})
  }, [])
  const echtStarten = useCallback(() => {
    if (vorfuehrung) {
      const np = new URLSearchParams(params)
      np.delete('vorfuehrung')
      setParams(np, { replace: true })
    }
    starten()
  }, [vorfuehrung, params, setParams, starten])
  const vorfuehrStarten = useCallback(() => {
    if (!vorfuehrung) {
      const np = new URLSearchParams(params)
      np.set('vorfuehrung', '1')
      setParams(np, { replace: true })
    }
    starten()
  }, [vorfuehrung, params, setParams, starten])

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

  const offline = !vorfuehrung && (codeQ.isError || (spieleQ.isError && !spieleQ.data))

  // Szenen-Karten
  const n = karten.length
  const showStart = n ? (szeneTick * 3) % n : 0
  const showFocus = karten[showStart]
  const showBehind = n > 1 ? [karten[(showStart + 1) % n], karten[(showStart + 2) % n]] : []
  const wall = karten.slice(0, 15)
  const wallHeld = wall.length ? szeneTick % wall.length : 0
  const shinyKarte = n ? { ...karten[szeneTick % n], shiny: true, variante: false } : null
  const scorerKarte = scorerSlug && kader.has(scorerSlug) ? karteVonRoster(kader.get(scorerSlug)!) : null

  return (
    <div className="ca" onPointerDown={druckStart} onPointerUp={druckEnde} onPointerLeave={druckEnde} onPointerCancel={druckEnde}>
      {/* Ebene 1: dunkler Grund mit wandernden Flutlicht-Kegeln + Staub + Wappen */}
      <div className="ca-grund" aria-hidden="true">
        <span className="ca-grund__kegel ca-grund__kegel--a" />
        <span className="ca-grund__kegel ca-grund__kegel--b" />
        <span className="ca-grund__struktur" />
        <div className="ca-staub">
          {STAUB.map((p, i) => (
            <i key={i} style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.s, height: p.s, animationDuration: `${p.d}s`, animationDelay: `-${p.t}s` }} />
          ))}
        </div>
        <img className="ca-grund__wappen" src="/brand/wappen.png" alt="" />
        <span className="ca-grund__vignette" />
      </div>

      {/* LINKS: QR-Zone als Premium-Sammelkarte */}
      <aside className="ca-qr">
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
                <div className="ca-karte__leer">{spiel ? (erzeugen.isPending ? 'QR-Code wird angelegt …' : 'Erst einen QR-Code für dieses Spiel erzeugen (Album → Spieltage).') : 'Kein Heimspiel.'}</div>
              )}
            </div>
            <div className="ca-karte__fuss">Scannen · Pack holen · mitmachen</div>
            {vorfuehrung && <div className="ca-karte__demo">Vorführung — dieser Code checkt nicht ein</div>}
          </div>
          <span className="ca-karte__glanz" aria-hidden="true" />
        </div>
      </aside>

      {/* RECHTS: Bühne mit Scorebug + Szenen */}
      <main className="ca-stage">
        {/* Scorebug — TV-Anzeigetafel, immer sichtbar über allen Szenen */}
        <header className={`ca-score${liveLaeuft ? ' is-live' : ''}${beendet ? ' is-ende' : ''}`} data-status={status ?? 'geplant'}>
          <span className="ca-score__kick">Check-in am Eingang</span>
          <div className="ca-score__tafel">
            <div className="ca-score__team ca-score__team--heim">
              <img className="ca-score__wappen" src="/brand/wappen.png" alt="" width="54" height="54" />
              <b>SVA</b>
            </div>
            <div className="ca-score__mitte">
              {beendet || liveLaeuft ? (
                <span className="ca-score__stand">
                  <b key={`h-${svaTore}`} className="ca-score__zahl">{svaTore ?? 0}</b>
                  <i>:</i>
                  <b key={`g-${gegTore}`} className="ca-score__zahl">{gegTore ?? 0}</b>
                </span>
              ) : (
                <span className="ca-score__anstoss">
                  <b key={anstossZeit}>{anstossZeit}</b>
                </span>
              )}
            </div>
            <div className="ca-score__team ca-score__team--gast">
              <span className="ca-score__kuerzel" aria-hidden="true">{gegnerKurz.slice(0, 1)}</span>
              <b>{gegnerKurz}</b>
            </div>
          </div>
          <span className="ca-score__zeile">
            {liveLaeuft ? (
              <>
                <i className="ca-score__punkt" aria-hidden="true" />
                {status === 'halbzeit' ? 'Halbzeit' : <b key={minuteTxt} className="ca-score__min">{minuteTxt}</b>}
              </>
            ) : beendet ? (
              'Endstand'
            ) : spiel || vorfuehrung ? (
              'Anstoß heute'
            ) : (
              'Kein Heimspiel eingetragen'
            )}
          </span>
        </header>

        {/* Szenen-Bühne */}
        <section className="ca-szene" key={szeneKey} data-szene={szene}>
          {szene === 'showcase' && showFocus && (
            <div className="ca-show">
              <span className="ca-show__kicker">Deine Sammelkarten · wie früher Panini</span>
              <div className="ca-show__bank">
                {showBehind[0] && (
                  <div className="ca-card ca-show__card ca-show__card--links">
                    <SvaKarte daten={showBehind[0]} stufe="gross" eager />
                  </div>
                )}
                {showBehind[1] && (
                  <div className="ca-card ca-show__card ca-show__card--rechts">
                    <SvaKarte daten={showBehind[1]} stufe="gross" eager />
                  </div>
                )}
                <div className="ca-card ca-show__card ca-show__card--focus">
                  <SvaKarte daten={showFocus} stufe="gross" eager aufdecken />
                </div>
              </div>
            </div>
          )}

          {szene === 'team' && (
            <div className="ca-wall" style={{ ['--held' as string]: String(wallHeld) }}>
              <span className="ca-show__kicker">Das Team · {wall.length} Karten zum Sammeln</span>
              <div className="ca-wall__grid">
                {wall.map((k, i) => (
                  <div key={k.id} className={`ca-card ca-wall__card${i === wallHeld ? ' is-held' : ''}`} style={{ ['--i' as string]: String(i) }}>
                    <SvaKarte daten={k} stufe="klein" eager={i === wallHeld} />
                  </div>
                ))}
              </div>
            </div>
          )}

          {szene === 'heute' && (
            <div className="ca-heute">
              <span className="ca-show__kicker">Heute am Waldsportplatz</span>
              <div className="ca-heute__zaehler">
                <b className={`ca-heute__zahl${puls ? ' is-puls' : ''}`}>{zeigeZahl}</b>
                <span className="ca-heute__wort">Fans heute dabei</span>
              </div>
              <div className="ca-heute__fort" aria-hidden="true">
                <div className="ca-heute__balken" style={{ width: `${fortschritt}%` }} />
              </div>
              <p className="ca-heute__ftext">{fortText}</p>
              <div className="ca-heute__belohnung">
                <span className="ca-heute__schwelle">{schwelle}.</span>
                <span className="ca-heute__btxt">
                  Beim {schwelle}. Besuch
                  <b>{belohnung}</b>
                </span>
              </div>
            </div>
          )}

          {szene === 'shiny' && shinyKarte && (
            <div className="ca-shiny">
              <span className="ca-show__kicker">Shiny — reines Sammlerglück</span>
              <div className="ca-shiny__aura" aria-hidden="true" />
              <div className="ca-card ca-shiny__card">
                <SvaKarte daten={shinyKarte} stufe="gross" eager aufdecken />
              </div>
            </div>
          )}

          {szene === 'scorer' && scorerKarte && (
            <div className="ca-scorer">
              <span className="ca-show__kicker ca-scorer__kicker">Torschütze</span>
              <div className="ca-card ca-scorer__card">
                <SvaKarte daten={scorerKarte} stufe="gross" eager aufdecken />
              </div>
            </div>
          )}
        </section>
      </main>

      {/* TOR!-Einblendung (vorhandenes Overlay, Vollbild) */}
      <TorJubel daten={tor} onZu={torZu} />

      {/* Abpfiff-Moment */}
      {abpfiff && (
        <div className={`ca-ende${abpfiff.sieg ? ' is-sieg' : ''}`} role="alert" aria-live="assertive">
          <span className="ca-ende__pfiff" aria-hidden="true" />
          {abpfiff.sieg && <span className="ca-ende__glanz" aria-hidden="true" />}
          <span className="ca-ende__label">Abpfiff · Endstand</span>
          <b className="ca-ende__stand">
            {abpfiff.th}<i>:</i>{abpfiff.tg}
          </b>
          <span className="ca-ende__paar">SVA — {abpfiff.gast}</span>
          <span className="ca-ende__danke">Danke fürs Dabeisein — Packs warten im Album</span>
        </div>
      )}

      {/* Netz-/Offline-Anzeige */}
      {!vorfuehrung && <span className={`ca-netz${offline ? ' is-weg' : ''}`} title={offline ? 'offline — Code aus dem Puffer' : 'online'} aria-hidden="true" />}
      {vorfuehrung && <span className="ca-vorfuehrung" aria-hidden="true">Vorführung</span>}

      {/* Start-Karte: zwei Knöpfe (echt / Vorführung) */}
      {!gestartet && (
        <div className="ca-start">
          <div className="ca-start__karte">
            <img className="ca-start__wappen" src="/brand/wappen.png" alt="" width="72" height="72" />
            <b className="ca-start__titel">Check-in-Anzeige</b>
            <small className="ca-start__sub">Vollbild · Bildschirm bleibt an · Ausstieg per langem Druck</small>
            <div className="ca-start__knoepfe">
              <button type="button" className="ca-start__btn ca-start__btn--echt" onClick={echtStarten}>
                Anzeige starten
              </button>
              <button type="button" className="ca-start__btn" onClick={vorfuehrStarten}>
                Vorführung starten
              </button>
            </div>
            <span className="ca-start__hint">Die Vorführung ist komplett simuliert — niemand wird eingecheckt.</span>
          </div>
        </div>
      )}
      <span className="ca-exit-hinweis" aria-hidden="true">lang drücken zum Beenden</span>
    </div>
  )
}
