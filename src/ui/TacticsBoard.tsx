import { useMemo } from 'react'
import { POSITION_LABEL, ROLE_LABEL } from '../data/content'
import { useStore } from '../store/useStore'
import { STARTELF, BANK, STAB, TEAM_PLAYERS, FORMATION_LABEL, MATCH_LABEL } from '../camera/teamLayout'
import { Pitch, Face, chipLayout, lastName } from './tacticsPitch'

// ─────────────────────────────────────────────────────────────
// v14-M „Taktik-Board" (Mobil): Die Aufstellung auf einen Blick — ein
// 2D-Spielfeld in leichter Perspektive (wie die Totale am Desktop: eigenes
// Tor vorn/unten, Torwart groß, Sturm hinten kleiner), 11 runde Spieler-
// Chips an den Formations-Positionen (Elf über den ganzen Platz wie im
// 3D-Feld), darunter Bank und Trainerstab.
// Tap auf einen Chip → Karten-Modal mit Vor/Zurück über Startelf + Bank.
// Rein DOM/SVG, kein three. Passt ohne horizontales Scrollen in 360–430 px.
// ─────────────────────────────────────────────────────────────

// v15-L: Geometrie, Rasen und Gesichter liegen in tacticsPitch.tsx
// (geteilt mit der Live-Seite /live).

/** fluid: ohne Sticky-Höhenbudget (statischer Fallback / reduced-motion). */
export function TacticsBoard({ fluid = false }: { fluid?: boolean }) {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  // Blätter-Reihenfolge im Modal: Startelf (TW → Sturm), dann Bank.
  const list = TEAM_PLAYERS
  const chips = useMemo(
    () => STARTELF.map(({ player, slot }) => ({ player, role: slot.role, ...chipLayout(slot) })),
    [],
  )
  const label = MATCH_LABEL ? `Aufstellung ${MATCH_LABEL}` : `Unsere Elf · ${FORMATION_LABEL}`

  return (
    <div className={fluid ? 'tboard tboard--fluid' : 'tboard'}>
      <div className="tboard__meta">{label}</div>
      <div className="tboard__field">
        <Pitch />
        {chips.map(({ player, role, x, y, k }) => (
          <button
            key={player.id}
            type="button"
            className={`tboard__chip${player.isCaptain ? ' is-captain' : ''}`}
            style={{ left: `${x}%`, top: `${y}%`, ['--k' as string]: k.toFixed(3) }}
            onClick={() => setSelected(player, list)}
            aria-label={`${player.name}, ${POSITION_LABEL[player.position]}${player.number != null ? `, Nummer ${player.number}` : ''}`}
            data-role={role}
          >
            <Face src={player.cutoutUrl ?? player.photoUrl} name={player.name} />
            {player.number != null && <b className="tboard__num">{player.number}</b>}
            <span className="tboard__name">{lastName(player.name)}</span>
          </button>
        ))}
      </div>
      {BANK.length > 0 && (
        <div className="tboard__row">
          <span className="tboard__label">Bank</span>
          <div className="tboard__bench">
            {BANK.map((p) => (
              <button
                key={p.id}
                type="button"
                className="tboard__mini"
                onClick={() => setSelected(p, list)}
                aria-label={`${p.name}, Bank${p.number != null ? `, Nummer ${p.number}` : ''}`}
              >
                <Face src={p.cutoutUrl ?? p.photoUrl} name={p.name} />
                <span className="tboard__name">{lastName(p.name)}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {STAB.length > 0 && (
        <div className="tboard__row tboard__row--staff">
          <span className="tboard__label">Trainer</span>
          <div className="tboard__staff">
            {STAB.map((m) => (
              <span key={m.id} className="tboard__coach" title={`${m.name} (${ROLE_LABEL[m.role]})`}>
                <Face src={m.cutoutUrl ?? m.photoUrl} name={m.name} />
                <span>
                  <b>{lastName(m.name)}</b>
                  <small>{ROLE_LABEL[m.role]}</small>
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
