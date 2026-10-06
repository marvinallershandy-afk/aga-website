import { useState } from 'react'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { TABLE_PREVIEW } from '../data/content'
import { FussballDeWidget } from './FussballDeWidget'
import type { Konferenz, LiveSettings, TabelleZeile } from './model'

// ─────────────────────────────────────────────────────────────
// v15: Die Live-Seite zeigt die EIGENE Tabelle (Admin → Tabelle per
// Screenshot → „Website veröffentlichen"), im Seiten-Look und ohne
// Fremd-Request. Das fussball.de-Widget bleibt nur Rückfall.
// v23-U: Umschalter „Stand jetzt | live" — die live aus den FuPa-Ständen
// gerechnete Tabelle (Ausschnitt SVA ± 2, Pfeile). Nur wenn die Rechnung VOR
// dem Spieltag mit der FuPa-Tabelle übereinstimmt (conference.stimmt) und ein
// Spiel läuft/beendet ist — sonst gar nicht (lieber keine als eine falsche).
// ─────────────────────────────────────────────────────────────

export function LiveTabelle({ settings, konferenz }: { settings: LiveSettings; konferenz?: Konferenz | null }) {
  const liveZeilen = konferenz?.stimmt && konferenz.zeilen && konferenz.zeilen.length ? konferenz.zeilen : null
  const hatLive = !!konferenz?.spiele?.some((s) => s.section === 'LIVE' || s.section === 'POST')
  const liveMoeglich = !!liveZeilen && hatLive
  const [modus, setModus] = useState<'stand' | 'live'>('stand')

  if (TABLE_PREVIEW.length === 0 && !liveMoeglich) return <FussballDeWidget settings={settings} />

  return (
    <div className="lv-tab-wrap">
      {liveMoeglich && (
        <div className="lv-tabtabs" role="tablist" aria-label="Tabellen-Ansicht">
          <button type="button" role="tab" aria-selected={modus === 'stand'} onClick={() => setModus('stand')}>
            Stand jetzt
          </button>
          <button type="button" role="tab" aria-selected={modus === 'live'} onClick={() => setModus('live')}>
            <i className="lv-puls lv-puls--sm" aria-hidden="true" /> live
          </button>
        </div>
      )}

      {liveMoeglich && modus === 'live' ? (
        <LiveStand zeilen={liveZeilen!} />
      ) : TABLE_PREVIEW.length === 0 ? (
        <FussballDeWidget settings={settings} />
      ) : (
        <Veroeffentlicht />
      )}
    </div>
  )
}

function Veroeffentlicht() {
  const mitTore = TABLE_PREVIEW.some((r) => r.goals != null && r.against != null)
  return (
    <>
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
    </>
  )
}

function LiveStand({ zeilen }: { zeilen: TabelleZeile[] }) {
  const [alle, setAlle] = useState(false)
  const selfIdx = zeilen.findIndex((z) => z.self)
  // Ausschnitt SVA ± 2
  const sicht = alle || selfIdx < 0 ? zeilen : zeilen.filter((_, i) => Math.abs(i - selfIdx) <= 2)
  return (
    <>
      <table className="lv-table lv-table--live">
        <thead>
          <tr>
            <th>#</th>
            <th className="lv-table__team">Team</th>
            <th>Sp</th>
            <th>Diff</th>
            <th>Pkt</th>
          </tr>
        </thead>
        <tbody>
          {sicht.map((r) => (
            <tr key={r.slug} className={`${r.self ? 'is-self ' : ''}${r.live ? 'is-live' : ''}`.trim() || undefined}>
              <td>
                <span className="lv-table__platz">
                  {r.platz}
                  {r.trend ? (
                    <span className={`lv-table__trend ${r.trend > 0 ? 'is-hoch' : 'is-runter'}`} aria-label={r.trend > 0 ? `${r.trend} hoch` : `${-r.trend} runter`}>
                      {r.trend > 0 ? <ArrowUp size={11} strokeWidth={2.5} /> : <ArrowDown size={11} strokeWidth={2.5} />}
                      {Math.abs(r.trend)}
                    </span>
                  ) : null}
                </span>
              </td>
              <td className="lv-table__team">
                {r.live && <i className="lv-puls lv-puls--sm" aria-hidden="true" />}
                {r.team}
              </td>
              <td>{r.sp}</td>
              <td>{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
              <td className="lv-table__pkt">{r.pkt}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!alle && selfIdx >= 0 && zeilen.length > sicht.length && (
        <button type="button" className="lv-table__mehr" onClick={() => setAlle(true)}>
          Ganze Tabelle
        </button>
      )}
      {alle && (
        <button type="button" className="lv-table__mehr" onClick={() => setAlle(false)}>
          Weniger zeigen
        </button>
      )}
      <p className="lv-table__quelle">vorläufig · berechnet aus FuPa-Ständen</p>
    </>
  )
}
