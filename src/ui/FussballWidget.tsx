import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { CLUB, CONTACT, fussballDeTeamUrl, FORM, LAST_MATCH, NEXT_MATCH, TABLE_PREVIEW, type FormResult } from '../data/club'
import { PLAYERS } from '../data/players'

// ─────────────────────────────────────────────────────────────
// v11-E5: SAISON-COCKPIT (löst die reine Tabelle ab).
// v12-E5: nutzt die VOLLE Breite — Tabelle links, Form/Spiele/Torschützen
// rechts, alles auf einem Bild. Hover-Effekte auf Zeilen & Karten,
// Top-Torschützen prominenter. Nächstes-Spiel mit Live-Countdown +
// „In Kalender" (ICS). Live-Daten kommen von fussball.de (Team-ID in
// club.ts); Tabelle/Ergebnis/Termin sind bis zur Anbindung Vorschau.
// ─────────────────────────────────────────────────────────────

const reveal = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: false, amount: 0.3 },
  transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const },
}

const FORM_META: Record<FormResult, { cls: string; label: string }> = {
  W: { cls: 'form-dot--win', label: 'Sieg' },
  U: { cls: 'form-dot--draw', label: 'Unentschieden' },
  N: { cls: 'form-dot--loss', label: 'Niederlage' },
}

function initials(name: string) {
  const p = name.trim().split(/\s+/)
  return ((p[0]?.[0] ?? '') + (p[p.length - 1]?.[0] ?? '')).toUpperCase()
}

function ScorerFace({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  return (
    <span className="scorer__face">
      {photoUrl ? (
        <img src={photoUrl} alt={name} loading="lazy" />
      ) : (
        <span className="scorer__initials">{initials(name)}</span>
      )}
    </span>
  )
}

// Nächster Sonntag 15:00 (typische Anstoßzeit) — vorläufiger Termin, bis
// fussball.de/Marvin den echten liefert. Hält den Countdown „lebendig".
function nextSunday1500(): Date {
  const now = new Date()
  const d = new Date(now)
  d.setHours(15, 0, 0, 0)
  const day = d.getDay() // 0 = Sonntag
  let add = (7 - day) % 7
  if (add === 0 && d.getTime() <= now.getTime()) add = 7
  d.setDate(d.getDate() + add)
  return d
}

function pad(n: number) { return String(n).padStart(2, '0') }

function Countdown({ target }: { target: Date }) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])
  const diff = Math.max(0, target.getTime() - now)
  const d = Math.floor(diff / 86400000)
  const h = Math.floor((diff % 86400000) / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  const cells: [number, string][] = [[d, 'Tage'], [h, 'Std'], [m, 'Min'], [s, 'Sek']]
  return (
    <div className="countdown" aria-label="Countdown bis zum nächsten Heimspiel">
      {cells.map(([v, l]) => (
        <span key={l} className="countdown__cell">
          <b>{l === 'Tage' ? v : pad(v)}</b>
          <small>{l}</small>
        </span>
      ))}
    </div>
  )
}

function downloadICS(start: Date, opponent: string) {
  const stamp = (x: Date) => x.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const end = new Date(start.getTime() + 2 * 3600 * 1000)
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SVA//Heimspiel//DE', 'BEGIN:VEVENT',
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${CLUB.shortName} vs ${opponent}`,
    `LOCATION:${CONTACT.address}`,
    'DESCRIPTION:Heimspiel SV Agathenburg-Dollern (Termin vorläufig — bitte auf fussball.de prüfen).',
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'sva-heimspiel.ics'
  a.click()
  URL.revokeObjectURL(url)
}

export function FussballWidget() {
  const topScorers = [...PLAYERS].sort((a, b) => b.stats.goals - a.stats.goals).slice(0, 3)
  const kickoff = nextSunday1500()
  const opponent = NEXT_MATCH.home ? NEXT_MATCH.opponent : 'SVA'

  return (
    <motion.div className="cockpit" {...reveal}>
      {/* ── Hauptspalte: Tabelle ───────────────────────────────── */}
      <div className="cockpit__main">
        <div className="cockpit__panel cockpit__table">
          <div className="cockpit__label cockpit__label--row">
            <span>Tabelle · Kreisliga</span>
            <a href={fussballDeTeamUrl} target="_blank" rel="noreferrer" className="cockpit__live">
              Live auf fussball.de →
            </a>
          </div>
          <table className="cockpit-table">
            <thead>
              <tr><th>#</th><th>Team</th><th>Sp</th><th>Pkt</th></tr>
            </thead>
            <tbody>
              {TABLE_PREVIEW.map((r) => (
                <tr key={r.pos} className={r.self ? 'is-self' : undefined}>
                  <td className="cockpit-table__pos">{r.pos}</td>
                  <td>{r.team}</td>
                  <td className="cockpit-table__c">{r.sp}</td>
                  <td className="cockpit-table__c">{r.pkt}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="widget-note">
            Vorschau — sobald fussball.de verbunden ist ({CLUB.fussballDeTeamId.slice(0, 6)}…),
            steht hier die echte Live-Tabelle. Der Link oben führt schon jetzt zur echten Tabelle.
          </p>
        </div>

        {/* Top-Torschützen mit Gesichtern — prominent */}
        <div className="cockpit__panel cockpit__scorers">
          <span className="cockpit__label">Top-Torschützen</span>
          <ul className="scorer-list">
            {topScorers.map((p, i) => (
              <li key={p.id} className={`scorer${i === 0 ? ' scorer--lead' : ''}`}>
                <span className="scorer__rank">{i + 1}</span>
                <ScorerFace name={p.name} photoUrl={p.photoUrl} />
                <span className="scorer__name">{p.name}</span>
                <span className="scorer__goals"><b>{p.stats.goals}</b>Tore</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Seitenspalte: Form, Spiele ──────────────────────────── */}
      <div className="cockpit__side">
        {/* Form der letzten 5 */}
        <div className="cockpit__panel cockpit__form">
          <span className="cockpit__label">Form · letzte 5</span>
          <div className="form-row">
            {FORM.map((r, i) => (
              <span key={i} className={`form-dot ${FORM_META[r].cls}`} title={FORM_META[r].label}>
                {r === 'U' ? 'U' : r === 'W' ? 'S' : 'N'}
              </span>
            ))}
            <span className="form-row__hint">älteste → neueste</span>
          </div>
        </div>

        {/* Letztes & nächstes Spiel */}
        <div className="cockpit__matches">
          <div className="cockpit__panel match-card">
            <span className="cockpit__label">Zuletzt</span>
            <div className="match-card__teams">
              <b>{LAST_MATCH.home ? 'SVA' : LAST_MATCH.opponent}</b>
              <span className="match-card__score">
                {LAST_MATCH.home ? LAST_MATCH.goalsFor : LAST_MATCH.goalsAgainst}
                <i>:</i>
                {LAST_MATCH.home ? LAST_MATCH.goalsAgainst : LAST_MATCH.goalsFor}
              </span>
              <b>{LAST_MATCH.home ? LAST_MATCH.opponent : 'SVA'}</b>
            </div>
            <span className="match-card__meta">{LAST_MATCH.date}{LAST_MATCH.isPlaceholder ? ' · Vorschau' : ''}</span>
          </div>

          <div className="cockpit__panel match-card match-card--next">
            <span className="cockpit__label">Nächstes Heimspiel</span>
            <div className="match-card__teams">
              <b>{NEXT_MATCH.home ? 'SVA' : NEXT_MATCH.opponent}</b>
              <span className="match-card__vs">vs</span>
              <b>{NEXT_MATCH.home ? NEXT_MATCH.opponent : 'SVA'}</b>
            </div>
            <Countdown target={kickoff} />
            <div className="match-card__cta">
              <button className="btn btn--sm btn--primary" onClick={() => downloadICS(kickoff, opponent)}>
                In Kalender
              </button>
              <span className="match-card__meta">So 15:00 · Termin vorläufig</span>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
