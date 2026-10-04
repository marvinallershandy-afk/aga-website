import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
// P1: Website-Daten aus der Fassade (Overlay/DB → sonst statischer Seed).
import { CLUB, CONTACT, fussballDeTeamUrl, FORM, LAST_MATCH, NEXT_MATCH, nextKickoff, TABLE_PREVIEW, PLAYERS, type FormResult } from '../data/content'

// ─────────────────────────────────────────────────────────────
// v11-E5: SAISON-COCKPIT (löst die reine Tabelle ab).
// v12-E5: nutzt die VOLLE Breite — Tabelle links, Form/Spiele/Torschützen
// rechts, alles auf einem Bild. Nächstes-Spiel mit Live-Countdown +
// „In Kalender" (ICS).
// v14: Jeder Block erscheint NUR mit echten Daten (Admin-Pflege → Build).
// Ohne Daten führt das Cockpit direkt zu fussball.de — keine
// Beispiel-Vereine, keine erfundene Formkurve, kein Fake-Ergebnis mehr.
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
    <div className="countdown" aria-label="Countdown bis zum nächsten Spiel">
      {cells.map(([v, l]) => (
        <span key={l} className="countdown__cell">
          <b>{l === 'Tage' ? v : pad(v)}</b>
          <small>{l}</small>
        </span>
      ))}
    </div>
  )
}

function downloadICS(start: Date, opponent: string, home: boolean) {
  const stamp = (x: Date) => x.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z'
  const end = new Date(start.getTime() + 2 * 3600 * 1000)
  // v14: Auswärts stand vorher „SVA vs SVA" im Kalender.
  const summary = home ? `${CLUB.shortName} vs ${opponent}` : `${opponent} vs ${CLUB.shortName}`
  const ics = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//SVA//Spiel//DE', 'BEGIN:VEVENT',
    `DTSTART:${stamp(start)}`, `DTEND:${stamp(end)}`,
    `SUMMARY:${summary}`,
    `LOCATION:${home ? CONTACT.address : opponent}`,
    `DESCRIPTION:${home ? 'Heimspiel' : 'Auswärtsspiel'} SV Agathenburg-Dollern — aktuelle Infos auf fussball.de.`,
    'END:VEVENT', 'END:VCALENDAR',
  ].join('\r\n')
  const blob = new Blob([ics], { type: 'text/calendar' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = home ? 'sva-heimspiel.ics' : 'sva-auswaertsspiel.ics'
  a.click()
  URL.revokeObjectURL(url)
}

export function FussballWidget() {
  const topScorers = [...PLAYERS].sort((a, b) => b.stats.goals - a.stats.goals).slice(0, 3)
  // Torschützen nur mit echten Zahlen (sonst drei Spieler mit 0 Toren).
  const hasGoals = topScorers.some((p) => p.stats.goals > 0)
  const hasTable = TABLE_PREVIEW.length > 0
  const hasForm = FORM.length > 0
  // null = kein echter Termin hinterlegt → Countdown/ICS bleiben aus.
  const kickoff = nextKickoff()
  const nextLabel = NEXT_MATCH.isPlaceholder ? 'Nächstes Spiel' : NEXT_MATCH.home ? 'Nächstes Heimspiel' : 'Nächstes Auswärtsspiel'

  return (
    <motion.div className="cockpit" {...reveal}>
      {/* ── Hauptspalte: Tabelle ───────────────────────────────── */}
      <div className="cockpit__main">
        <div className="cockpit__panel cockpit__table">
          <div className="cockpit__label cockpit__label--row">
            <span>Tabelle · Kreisliga Stade</span>
            <a href={fussballDeTeamUrl} target="_blank" rel="noreferrer" className="cockpit__live">
              fussball.de →
            </a>
          </div>
          {hasTable ? (
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
          ) : (
            <a className="cockpit-empty" href={fussballDeTeamUrl} target="_blank" rel="noreferrer">
              <b>Tabelle, Spielplan &amp; Ergebnisse</b>
              <span>Kreisliga Stade · Saison 26/27 — immer aktuell auf fussball.de</span>
              <i aria-hidden="true">→</i>
            </a>
          )}
        </div>

        {hasGoals && (
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
        )}
      </div>

      {/* ── Seitenspalte: Form, Spiele ──────────────────────────── */}
      <div className="cockpit__side">
        {hasForm && (
          <div className="cockpit__panel cockpit__form">
            <span className="cockpit__label">Form · letzte {FORM.length}</span>
            <div className="form-row">
              {FORM.map((r, i) => (
                <span key={i} className={`form-dot ${FORM_META[r].cls}`} title={FORM_META[r].label}>
                  {r === 'U' ? 'U' : r === 'W' ? 'S' : 'N'}
                </span>
              ))}
              <span className="form-row__hint">älteste → neueste</span>
            </div>
          </div>
        )}

        <div className="cockpit__matches">
          {LAST_MATCH && (
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
              <span className="match-card__meta">{LAST_MATCH.date}</span>
            </div>
          )}

          <div className="cockpit__panel match-card match-card--next">
            <span className="cockpit__label">{nextLabel}</span>
            {NEXT_MATCH.isPlaceholder ? (
              <a className="match-card__link" href={fussballDeTeamUrl} target="_blank" rel="noreferrer">
                <b>Wann &amp; gegen wen?</b>
                <span>Spielplan auf fussball.de →</span>
              </a>
            ) : (
              <>
                <div className="match-card__teams">
                  <b>{NEXT_MATCH.home ? 'SVA' : NEXT_MATCH.opponent}</b>
                  <span className="match-card__vs">vs</span>
                  <b>{NEXT_MATCH.home ? NEXT_MATCH.opponent : 'SVA'}</b>
                </div>
                {kickoff ? (
                  <>
                    <Countdown target={kickoff} />
                    <div className="match-card__cta">
                      <button className="btn btn--sm btn--primary" onClick={() => downloadICS(kickoff, NEXT_MATCH.opponent, NEXT_MATCH.home)}>
                        In Kalender
                      </button>
                      <span className="match-card__meta">
                        {kickoff.toLocaleString('de-DE', {
                          weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit',
                        })} Uhr
                      </span>
                    </div>
                  </>
                ) : (
                  <span className="match-card__meta">{NEXT_MATCH.date}</span>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
