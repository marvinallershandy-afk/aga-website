import { useEffect, useState } from 'react'
import { laufendeMinute, type LiveMatch } from '../live/model'
import { setLiveSignal } from '../live/liveSignal'
import { VORFUEHRUNG } from '../live/vorfuehrung'
import { MatchdayBar } from './MatchdayBar'
import './matchdayBar.css'

// ─────────────────────────────────────────────────────────────
// v18-T „Vorführ-Spiel“ im Onepager (/?vorfuehrung=1): statt der normalen
// Spieltag-Leiste eine Leiste mit dem Vorführ-Spiel aus web_live_demo()
// (alle 15 s, pausiert bei verstecktem Tab). Der Stand geht wie bei einem
// echten Spiel an Karten-Marker und LED-Tafel (liveSignal). Ohne Parameter:
// unverändert die normale Leiste — kein Request, nichts zu sehen.
// ─────────────────────────────────────────────────────────────

export function SpieltagLeiste() {
  return VORFUEHRUNG ? <VorfuehrungsLeiste /> : <MatchdayBar />
}

const POLL_MS = 15_000

function VorfuehrungsLeiste() {
  const [m, setM] = useState<LiveMatch | null>(null)
  const [geladen, setGeladen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let aktiv = true
    let timer: number | null = null
    let ctrl: AbortController | null = null
    const holen = async () => {
      if (document.visibilityState === 'hidden') return
      ctrl = new AbortController()
      try {
        const { fetchLive } = await import('../live/api')
        const d = await fetchLive(ctrl.signal, true)
        if (aktiv) setM(d.match)
      } catch {
        /* Netz weg: letzter Stand bleibt */
      } finally {
        if (aktiv) setGeladen(true)
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
    const uhr = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => {
      aktiv = false
      if (timer) window.clearTimeout(timer)
      window.clearInterval(uhr)
      ctrl?.abort()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  const laufend = m && m.status !== 'geplant' ? m : null
  const lm = laufend ? laufendeMinute(laufend.status, laufend.anpfiffAt, laufend.wiederanpfiffAt, now) : null

  // Karten-Marker + LED-Tafel wie bei einem echten Spiel
  useEffect(() => {
    setLiveSignal(
      laufend
        ? { status: laufend.status as 'live' | 'halbzeit' | 'beendet', home: laufend.home, opponent: laufend.opponent, goalsFor: laufend.goalsFor, goalsAgainst: laufend.goalsAgainst, minuteLabel: lm?.label ?? null }
        : null,
    )
  }, [laufend, lm?.label])

  if (!geladen) return null
  const href = '/live?vorfuehrung=1'
  if (!m) {
    return (
      <a className="mday mday--demo" href={href} data-status="vorher" aria-label="Vorführung: gerade kein Vorführ-Spiel">
        <span className="mday__demo">Vorführung</span>
        <span className="mday__vs">gerade kein Spiel</span>
      </a>
    )
  }
  const gegner = `${m.home ? 'vs' : 'bei'} ${m.opponent}`
  const stand = `${m.goalsFor}:${m.goalsAgainst}`
  const zeit = new Date(m.kickoff).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
  return (
    <a className="mday mday--demo" href={href} data-status={laufend?.status ?? 'vorher'} aria-label={`Vorführung – kein echtes Spiel: ${laufend ? stand : zeit} ${gegner}`}>
      <span className="mday__demo">Vorführung</span>
      {m.status === 'live' && (
        <>
          <i className="mday__dot" aria-hidden="true" />
          <b>LIVE {stand}</b>
          {lm && <span className="mday__min">({lm.label})</span>}
        </>
      )}
      {m.status === 'halbzeit' && <b>HALBZEIT {stand}</b>}
      {m.status === 'beendet' && <b>ENDSTAND {stand}</b>}
      {m.status === 'geplant' && <b>{zeit}</b>}
      <span className="mday__vs">· {gegner}</span>
      <span className="mday__cta">→</span>
    </a>
  )
}
