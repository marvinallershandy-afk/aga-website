import { useMemo } from 'react'
import { POSITION_LABEL, ROLE_LABEL } from '../data/content'
import { useStore } from '../store/useStore'
import { STARTELF, BANK, STAB, TEAM_PLAYERS, FORMATION_LABEL, MATCH_LABEL } from '../camera/teamLayout'

// ─────────────────────────────────────────────────────────────
// v14-M „Taktik-Board" (Mobil): Die Aufstellung auf einen Blick — ein
// 2D-Spielfeld in leichter Perspektive (wie die Totale am Desktop: eigenes
// Tor vorn/unten, Torwart groß, Sturm hinten kleiner), 11 runde Spieler-
// Chips an den Formations-Positionen (Elf über den ganzen Platz wie im
// 3D-Feld), darunter Bank und Trainerstab.
// Tap auf einen Chip → Karten-Modal mit Vor/Zurück über Startelf + Bank.
// Rein DOM/SVG, kein three. Passt ohne horizontales Scrollen in 360–430 px.
// ─────────────────────────────────────────────────────────────

// Board-Koordinaten (viewBox). Perspektive einer Bodenebene: die Breite
// schrumpft mit 1/Tiefe, die Bildschirm-y ist linear in derselben Größe →
// alle Linien bleiben gerade, Kreise werden zu Ellipsen.
const VW = 360
const VH = 300
const CX = VW / 2
const HALF_NEAR = 168 // halbe Breite an der eigenen Torlinie
const FAR = 0.78 // Breite gegnerische Torlinie / eigene Torlinie
const Y_NEAR = 278
const Y_FAR = 12
const K = 1 / FAR - 1

/** Feldpunkt (u: −1 links … 1 rechts, v: 0 eigene … 1 gegnerische Torlinie) → Board. */
function proj(u: number, v: number): [number, number] {
  const s = 1 / (1 + K * v)
  return [CX + u * HALF_NEAR * s, Y_FAR + ((Y_NEAR - Y_FAR) * (s - FAR)) / (1 - FAR)]
}
/** Maßstab an der Tiefe v (1 vorn … FAR hinten). */
function scaleAt(v: number) {
  return 1 / (1 + K * v)
}

// Feldmaße in Metern (105 × 68) → u/v
const L = 105
const W2 = 34
const pt = (xm: number, ym: number) => proj(xm / W2, ym / L)
const poly = (pts: [number, number][]) => pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
const rect = (x0: number, x1: number, y0: number, y1: number) => poly([pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)])
function arc(cxm: number, cym: number, r: number, a0: number, a1: number, n = 28) {
  const out: [number, number][] = []
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n
    out.push(pt(cxm + Math.cos(a) * r, cym + Math.sin(a) * r))
  }
  return poly(out)
}

function Pitch() {
  // Mäh-Streifen über die Länge (10 Bahnen)
  const stripes = Array.from({ length: 10 }, (_, i) => rect(-W2, W2, (i * L) / 10, ((i + 1) * L) / 10))
  // Strafraum-Bögen: Kreis r 9.15 um den Elfmeterpunkt, nur außerhalb des Strafraums
  const arcA = Math.asin((16.5 - 11) / 9.15)
  return (
    <svg className="tboard__pitch" viewBox={`0 0 ${VW} ${VH}`} aria-hidden="true" preserveAspectRatio="none">
      <defs>
        <linearGradient id="tb-grass" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#173f24" />
          <stop offset="1" stopColor="#2a6a35" />
        </linearGradient>
        <radialGradient id="tb-light" cx="0.5" cy="0.62" r="0.62">
          <stop offset="0" stopColor="rgba(255,240,200,0.16)" />
          <stop offset="1" stopColor="rgba(255,240,200,0)" />
        </radialGradient>
      </defs>
      <polygon points={rect(-W2 - 3, W2 + 3, -3, L + 3)} fill="url(#tb-grass)" />
      {stripes.map((p, i) => (i % 2 ? <polygon key={i} points={p} fill="rgba(255,255,255,0.035)" /> : null))}
      <polygon points={rect(-W2 - 3, W2 + 3, -3, L + 3)} fill="url(#tb-light)" />
      <g fill="none" stroke="rgba(255,255,255,0.62)" strokeWidth="1.1" strokeLinejoin="round">
        <polygon points={rect(-W2, W2, 0, L)} />
        <polyline points={poly([pt(-W2, L / 2), pt(W2, L / 2)])} />
        <polygon points={arc(0, L / 2, 9.15, 0, Math.PI * 2, 48)} />
        {/* eigener Strafraum (unten) */}
        <polygon points={rect(-20.16, 20.16, 0, 16.5)} />
        <polygon points={rect(-9.16, 9.16, 0, 5.5)} />
        <polyline points={arc(0, 11, 9.15, arcA, Math.PI - arcA)} />
        {/* gegnerischer Strafraum (oben) */}
        <polygon points={rect(-20.16, 20.16, L - 16.5, L)} />
        <polygon points={rect(-9.16, 9.16, L - 5.5, L)} />
        <polyline points={arc(0, L - 11, 9.15, Math.PI + arcA, Math.PI * 2 - arcA)} />
        {/* Tore */}
        <polygon points={rect(-3.66, 3.66, -2.2, 0)} stroke="rgba(255,255,255,0.8)" />
        <polygon points={rect(-3.66, 3.66, L, L + 2.2)} stroke="rgba(255,255,255,0.5)" />
      </g>
      <g fill="rgba(255,255,255,0.7)">
        <circle cx={pt(0, L / 2)[0]} cy={pt(0, L / 2)[1]} r="1.6" />
        <circle cx={pt(0, 11)[0]} cy={pt(0, 11)[1]} r="1.4" />
        <circle cx={pt(0, L - 11)[0]} cy={pt(0, L - 11)[1]} r="1.1" />
      </g>
    </svg>
  )
}

function lastName(name: string) {
  return name.trim().split(/\s+/).slice(-1)[0]
}
function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
}

function Face({ src, name }: { src?: string | null; name: string }) {
  return (
    <span className="tboard__face">
      {src ? <img src={src} alt="" loading="lazy" decoding="async" draggable={false} /> : <i>{initials(name)}</i>}
    </span>
  )
}

/** fluid: ohne Sticky-Höhenbudget (statischer Fallback / reduced-motion). */
export function TacticsBoard({ fluid = false }: { fluid?: boolean }) {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  // Blätter-Reihenfolge im Modal: Startelf (TW → Sturm), dann Bank.
  const list = TEAM_PLAYERS
  const chips = useMemo(
    () =>
      STARTELF.map(({ player, slot }) => {
        // Board-Tiefe: wie im 3D-Feld über den ganzen Platz (Sturm in der
        // gegnerischen Hälfte), aber etwas weiter gespreizt als slotDepth,
        // damit zwischen den Reihen Platz für Gesicht + Name bleibt.
        // Der Torwart steht dicht vor dem eigenen Tor (Luft zur Abwehr).
        const v = slot.role === 'TW' ? 0.03 : 0.02 + slot.y * 0.92
        // Mitte leicht gespreizt (|x|^0.85) → Namen eng stehender Spieler
        // (zwei Spitzen, Fünfer-Mittelfeld) überlappen nicht.
        const u = Math.sign(slot.x) * Math.pow(Math.abs(slot.x), 0.85) * 0.86
        const [x, y] = proj(u, v)
        const s = scaleAt(v)
        return { player, role: slot.role, x: (x / VW) * 100, y: (y / VH) * 100, k: 0.72 + 0.28 * ((s - FAR) / (1 - FAR)) }
      }),
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
