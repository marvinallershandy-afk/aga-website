import { motion } from 'framer-motion'
import { CLUB, fussballDeTeamUrl, FORM, LAST_MATCH, NEXT_MATCH, TABLE_PREVIEW, type FormResult } from '../data/club'
import { PLAYERS } from '../data/players'

// ─────────────────────────────────────────────────────────────
// v11-E5: SAISON-COCKPIT (löst die reine Tabelle ab). Vier Panels:
//  · Form der letzten 5 Spiele (grün/gelb/rot)
//  · letztes & nächstes Spiel
//  · Top-Torschützen MIT Gesichtern (aus dem Kader)
//  · Tabelle (Vorschau) + Deep-Link zur echten fussball.de-Tabelle
// Live-Daten kommen von fussball.de (Team-ID in club.ts). Bis zur
// echten Anbindung sind Tabelle/Ergebnisse ehrlich als Vorschau
// markiert; Torschützen sind ECHT (aus dem Kader abgeleitet).
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

// Initialen als Gesichts-Fallback, wenn (noch) kein Foto da ist.
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

export function FussballWidget() {
  const topScorers = [...PLAYERS].sort((a, b) => b.stats.goals - a.stats.goals).slice(0, 3)

  return (
    <motion.div className="cockpit" {...reveal}>
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
          <span className="cockpit__label">Nächstes Spiel</span>
          <div className="match-card__teams">
            <b>{NEXT_MATCH.home ? 'SVA' : NEXT_MATCH.opponent}</b>
            <span className="match-card__vs">vs</span>
            <b>{NEXT_MATCH.home ? NEXT_MATCH.opponent : 'SVA'}</b>
          </div>
          <span className="match-card__meta">{NEXT_MATCH.date}{NEXT_MATCH.home ? ' · Heim' : ' · Auswärts'}</span>
        </div>
      </div>

      {/* Top-Torschützen mit Gesichtern */}
      <div className="cockpit__panel cockpit__scorers">
        <span className="cockpit__label">Top-Torschützen</span>
        <ul className="scorer-list">
          {topScorers.map((p, i) => (
            <li key={p.id} className="scorer">
              <span className="scorer__rank">{i + 1}</span>
              <ScorerFace name={p.name} photoUrl={p.photoUrl} />
              <span className="scorer__name">{p.name}</span>
              <span className="scorer__goals"><b>{p.stats.goals}</b>Tore</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Tabelle (Vorschau) + Live-Link */}
      <div className="cockpit__panel cockpit__table">
        <div className="cockpit__label cockpit__label--row">
          <span>Tabelle · Kreisliga</span>
          <a href={fussballDeTeamUrl} target="_blank" rel="noreferrer" className="cockpit__live">
            Live auf fussball.de →
          </a>
        </div>
        <table className="cockpit-table">
          <thead>
            <tr>
              <th>#</th><th>Team</th><th>Sp</th><th>Pkt</th>
            </tr>
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
    </motion.div>
  )
}
