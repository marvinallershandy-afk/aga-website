import { TABLE_PREVIEW } from '../data/content'
import { FussballDeWidget } from './FussballDeWidget'
import type { LiveSettings } from './model'

// ─────────────────────────────────────────────────────────────
// v15: Die Live-Seite zeigt die EIGENE Tabelle (Admin → Tabelle per
// Screenshot → „Website veröffentlichen"), im Seiten-Look und ohne
// Fremd-Request. Das fussball.de-Widget bleibt nur Rückfall, solange
// noch keine Tabelle gepflegt ist.
// ─────────────────────────────────────────────────────────────

export function LiveTabelle({ settings }: { settings: LiveSettings }) {
  if (TABLE_PREVIEW.length === 0) return <FussballDeWidget settings={settings} />
  const mitTore = TABLE_PREVIEW.some((r) => r.goals != null && r.against != null)
  return (
    <div className="lv-tab-wrap">
      <table className="lv-table">
        <thead>
          <tr>
            <th>#</th>
            <th className="lv-table__team">Team</th>
            <th>Sp</th>
            {mitTore && <th>Diff</th>}
            <th>Pkt</th>
          </tr>
        </thead>
        <tbody>
          {TABLE_PREVIEW.map((r) => {
            const diff = r.goals != null && r.against != null ? r.goals - r.against : null
            return (
              <tr key={r.pos} className={r.self ? 'is-self' : undefined}>
                <td>{r.pos}</td>
                <td className="lv-table__team">{r.team}</td>
                <td>{r.sp}</td>
                {mitTore && <td>{diff == null ? '–' : diff > 0 ? `+${diff}` : diff}</td>}
                <td className="lv-table__pkt">{r.pkt}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
      <p className="lv-table__quelle">Stand: letzter veröffentlichter Spieltag · Quelle fussball.de</p>
    </div>
  )
}
