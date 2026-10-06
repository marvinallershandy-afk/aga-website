import { Check } from 'lucide-react'
import type { KaderSpieler } from './api'
import { nachname } from './model'
import { SpielerGesicht } from './SpielerKarte'

// ─────────────────────────────────────────────────────────────
// v20-T: waagerechte Spieler-Auswahl (Torschütze, Spieler des Spiels).
// Ein Tipp wählt, ein zweiter Tipp auf denselben hebt die Wahl auf.
// ─────────────────────────────────────────────────────────────

export function SpielerLeiste({
  kader,
  wert,
  onWahl,
  label,
  sortierung = 'angriff',
}: {
  kader: KaderSpieler[]
  wert?: string
  onWahl: (id?: string) => void
  label: string
  sortierung?: 'angriff' | 'kader'
}) {
  const ordnung = { ANG: 0, MIT: 1, ABW: 2, TW: 3 } as const
  const liste =
    sortierung === 'angriff'
      ? [...kader].sort((a, b) => ordnung[a.position] - ordnung[b.position] || b.tore - a.tore || (a.nummer ?? 99) - (b.nummer ?? 99))
      : kader
  return (
    <div className="tp-leiste" role="radiogroup" aria-label={label}>
      {liste.map((k) => {
        const an = wert === k.id
        return (
          <button
            key={k.id}
            type="button"
            role="radio"
            aria-checked={an}
            className={`tp-leiste__spieler${an ? ' is-an' : ''}`}
            onClick={() => onWahl(an ? undefined : k.id)}
          >
            <span className="tp-leiste__bild">
              <SpielerGesicht spieler={k} groesse={60} />
              {an && (
                <span className="tp-leiste__haken" aria-hidden="true">
                  <Check size={14} strokeWidth={2} />
                </span>
              )}
            </span>
            <b>{nachname(k.name)}</b>
            <small>
              {k.nummer != null ? `#${k.nummer} · ` : ''}
              {k.position}
            </small>
          </button>
        )
      })}
    </div>
  )
}
