import { useEffect, useState } from 'react'
import { NEXT_MATCH, nextKickoff } from '../data/content'
import { imSpieltagsfenster, laufendeMinute, type LiveData } from '../live/model'
import { setLiveSignal } from '../live/liveSignal'
import './matchdayBar.css'

// ─────────────────────────────────────────────────────────────
// v15-L: Spieltag-Leiste — dünn, oben unter der Brandbar, NUR im
// Spieltagsfenster (48 h vor bis 3 h nach Anpfiff). Der Onepager bleibt
// sonst wie er ist: keine Leiste, KEIN Request.
//   · vor dem Spiel: „So 15:00 · vs X · Live-Ticker →" (Build-Daten, 0 Requests)
//   · ab 15 min vor Anpfiff bis 3 h danach: alle 30 s web_live() (Modul wird
//     erst dann nachgeladen), pausiert bei verstecktem Tab
//   · live: „LIVE 1:0 (67') →", Halbzeit, Endstand
// Alles verlinkt auf /live. Stand geht zusätzlich an die LED-Tafel.
// ─────────────────────────────────────────────────────────────

const POLL_AB_MS = 15 * 60_000
const POLL_BIS_MS = 3 * 3600_000
const POLL_MS = 30_000

type Live = Pick<NonNullable<LiveData['match']>, 'status' | 'goalsFor' | 'goalsAgainst' | 'anpfiffAt' | 'wiederanpfiffAt'>

export function MatchdayBar() {
  const kickoff = nextKickoff()
  const k = kickoff?.getTime() ?? null
  const [now, setNow] = useState(() => Date.now())
  const [live, setLive] = useState<Live | null>(null)

  // Fenster-Uhr: nur lokale Zeit, kein Netz. Minütlich genügt (live: 15 s für die Minute).
  useEffect(() => {
    if (k == null) return
    const t = window.setInterval(() => setNow(Date.now()), live?.status === 'live' ? 15_000 : 60_000)
    return () => window.clearInterval(t)
  }, [k, live?.status])

  const imFenster = k != null && !NEXT_MATCH.isPlaceholder && imSpieltagsfenster(k, now)
  const pollen = imFenster && k != null && now >= k - POLL_AB_MS && now <= k + POLL_BIS_MS

  useEffect(() => {
    if (!pollen || k == null) return
    let aktiv = true
    let timer: number | null = null
    let ctrl: AbortController | null = null
    const holen = async () => {
      if (document.visibilityState === 'hidden') return
      ctrl = new AbortController()
      try {
        const { fetchLive } = await import('../live/api')
        const d = await fetchLive(ctrl.signal)
        if (!aktiv) return
        const m = d.match
        // nur übernehmen, wenn es dasselbe Spiel ist (Anstoß ±6 h)
        if (m && Math.abs(new Date(m.kickoff).getTime() - k) < 6 * 3600_000) {
          setLive({ status: m.status, goalsFor: m.goalsFor, goalsAgainst: m.goalsAgainst, anpfiffAt: m.anpfiffAt, wiederanpfiffAt: m.wiederanpfiffAt })
        }
      } catch {
        /* Netz weg: Leiste zeigt den letzten Stand */
      }
    }
    const plan = () => {
      timer = window.setTimeout(async () => {
        await holen()
        if (aktiv) plan()
      }, POLL_MS)
    }
    void holen().then(() => aktiv && plan())
    const onVis = () => {
      if (document.visibilityState === 'visible') void holen()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      aktiv = false
      if (timer) window.clearTimeout(timer)
      ctrl?.abort()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [pollen, k])

  const laufend = live && live.status !== 'geplant' ? live : null
  const lm = laufend ? laufendeMinute(laufend.status, laufend.anpfiffAt, laufend.wiederanpfiffAt, now) : null

  // LED-Tafel mitziehen (nur mit echtem Live-Stand)
  useEffect(() => {
    setLiveSignal(
      laufend && imFenster
        ? { status: laufend.status as 'live' | 'halbzeit' | 'beendet', home: NEXT_MATCH.home, opponent: NEXT_MATCH.opponent, goalsFor: laufend.goalsFor, goalsAgainst: laufend.goalsAgainst, minuteLabel: lm?.label ?? null }
        : null,
    )
  }, [laufend, imFenster, lm?.label])

  if (!imFenster || !kickoff) return null

  const gegner = `${NEXT_MATCH.home ? 'vs' : 'bei'} ${NEXT_MATCH.opponent}`
  const tag = kickoff.toLocaleDateString('de-DE', { weekday: 'short', timeZone: 'Europe/Berlin' }).replace('.', '')
  const zeit = kickoff.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
  const stand = laufend ? `${laufend.goalsFor}:${laufend.goalsAgainst}` : ''

  return (
    <a className="mday" href="/live" data-status={laufend?.status ?? 'vorher'} aria-label={laufend ? `Live-Ticker: ${stand} ${gegner}` : `Live-Ticker zum Spiel ${gegner}, ${tag} ${zeit} Uhr`}>
      {laufend?.status === 'live' && (
        <>
          <i className="mday__dot" aria-hidden="true" />
          <b>LIVE {stand}</b>
          {lm && <span className="mday__min">({lm.label})</span>}
        </>
      )}
      {laufend?.status === 'halbzeit' && <b>HALBZEIT {stand}</b>}
      {laufend?.status === 'beendet' && <b>ENDSTAND {stand}</b>}
      {!laufend && (
        <b>
          {tag} {zeit}
        </b>
      )}
      <span className="mday__vs">· {gegner}</span>
      <span className="mday__cta">{laufend ? '' : 'Live-Ticker '}→</span>
    </a>
  )
}
