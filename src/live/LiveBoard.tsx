import { useMemo } from 'react'
import { FORMATION_SLOTS } from '../data/lineup'
import { Pitch, Face, chipLayout, lastName } from '../ui/tacticsPitch'
import { platzStand, type LiveData, type LivePlayer } from './model'

// ─────────────────────────────────────────────────────────────
// v15-L: Aufstellung auf der Live-Seite = das Taktik-Board des Onepagers
// (gleiche Geometrie/Rasen aus ui/tacticsPitch.tsx), plus Live-Markierungen:
// eingewechselte Spieler stehen auf dem Platz des Ausgewechselten (grüner
// Pfeil mit Minute), Karten und Tore am Chip, Ausgewechselte in der Bank-
// Zeile mit rotem Pfeil.
// ─────────────────────────────────────────────────────────────

const ROLLE: Record<string, string> = {
  trainer: 'Trainer',
  'co-trainer': 'Co-Trainer',
  'torwart-trainer': 'TW-Trainer',
  teammanager: 'Teammanager',
}

export function LiveBoard({ data, players }: { data: LiveData; players: Map<string, LivePlayer> }) {
  const l = data.lineup
  const stand = useMemo(() => platzStand(l, data.events), [l, data.events])
  if (!l || l.startelf.length !== 11) {
    return (
      <div className="lv-card lv-card--pad lv-leer">
        <p>Die Aufstellung folgt — meist etwa eine Stunde vor Anpfiff.</p>
      </div>
    )
  }
  const slots = FORMATION_SLOTS[l.formation] ?? FORMATION_SLOTS['4-4-2']
  const bankZeile = [...stand.bank.map((id) => ({ id, raus: false })), ...[...stand.ausgewechselt.keys()].map((id) => ({ id, raus: true }))]
  const titel = l.forMatch ? `Aufstellung · ${l.formation}` : `Zuletzt gespeicherte Elf · ${l.formation}`

  return (
    <div className="tboard lv-board">
      <div className="tboard__meta">{titel}</div>
      {!l.forMatch && data.match?.status === 'geplant' && <p className="lv-hinweis">Noch nicht für dieses Spiel bestätigt.</p>}
      <div className="tboard__field">
        <Pitch />
        {stand.slots.map((id, i) => {
          const p = players.get(id)
          const slot = slots[i]
          if (!p || !slot) return null
          const { x, y, k } = chipLayout(slot)
          const rein = stand.eingewechselt.get(id)
          const tore = stand.tore.get(id) ?? 0
          return (
            <div
              key={`${i}-${id}`}
              className={`tboard__chip${p.isCaptain ? ' is-captain' : ''}`}
              style={{ left: `${x}%`, top: `${y}%`, ['--k' as string]: k.toFixed(3) }}
              data-role={slot.role}
              aria-label={`${p.name}${p.number != null ? `, Nummer ${p.number}` : ''}${rein ? `, eingewechselt ${rein}` : ''}`}
            >
              <Face src={p.cutoutUrl ?? p.photoUrl} name={p.name} />
              {p.number != null && <b className="tboard__num">{p.number}</b>}
              {(stand.gelb.has(id) || stand.rot.has(id)) && <i className={`lv-karte ${stand.rot.has(id) ? 'lv-karte--rot' : ''}`} aria-hidden="true" />}
              {tore > 0 && <i className="lv-chip-tor" aria-hidden="true">{tore > 1 ? `⚽×${tore}` : '⚽'}</i>}
              <span className="tboard__name">
                {rein && <em className="lv-rein">▲{rein}</em>}
                {lastName(p.name)}
              </span>
            </div>
          )
        })}
      </div>
      {bankZeile.length > 0 && (
        <div className="tboard__row">
          <span className="tboard__label">Bank</span>
          <div className="tboard__bench">
            {bankZeile.map(({ id, raus }) => {
              const p = players.get(id)
              if (!p) return null
              return (
                <span key={id} className={`tboard__mini${raus ? ' is-raus' : ''}`} title={raus ? `${p.name}, ausgewechselt ${stand.ausgewechselt.get(id)}` : p.name}>
                  <Face src={p.cutoutUrl ?? p.photoUrl} name={p.name} />
                  <span className="tboard__name">
                    {raus && <em className="lv-raus">▼</em>}
                    {lastName(p.name)}
                  </span>
                </span>
              )
            })}
          </div>
        </div>
      )}
      {data.staff.length > 0 && (
        <div className="tboard__row tboard__row--staff">
          <span className="tboard__label">Trainer</span>
          <div className="tboard__staff">
            {data.staff.map((m) => (
              <span key={m.id} className="tboard__coach">
                <Face src={m.cutoutUrl ?? m.photoUrl} name={m.name} />
                <span>
                  <b>{lastName(m.name)}</b>
                  <small>{ROLLE[m.role] ?? m.role}</small>
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
