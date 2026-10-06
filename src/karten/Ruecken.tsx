import './karten.css'
import { CLIP_UMRISS, INNEN, svgPunkte } from './geometrie'
import { muster } from './muster'

// ─────────────────────────────────────────────────────────────
// v20-K: Kartenrücken (verdeckte Karte im Pack, Stapel, leere Plätze).
// Neutral — verrät weder Spieler noch Seltenheit. Rot-schwarze Folie,
// Wappen-Prägung, feines Rautenraster, Schriftzug.
// ─────────────────────────────────────────────────────────────
export function KartenRuecken({ className, style }: { className?: string; style?: React.CSSProperties }) {
  const m = muster()
  return (
    <div className={`sk sk-ruecken${className ? ` ${className}` : ''}`} style={style} aria-hidden="true">
      <div className="sk__koerper" style={{ clipPath: CLIP_UMRISS }}>
        <div className="sk-ruecken__grund" />
        <div className="sk__muster" style={{ backgroundImage: `url("${m.rauten}")`, backgroundSize: '4cqw 4cqw', opacity: 0.07 }} />
        <svg className="sk__rahmen" viewBox="0 0 100 140" preserveAspectRatio="none">
          <polygon points={svgPunkte(INNEN)} fill="none" stroke="rgba(244,242,239,.35)" strokeWidth=".45" />
        </svg>
      </div>
      <div className="sk-ruecken__mitte">
        <img src="/brand/aga-logo.png" alt="" draggable={false} />
        <b>Sammelkarte</b>
        <span>SV Agathenburg-Dollern</span>
      </div>
    </div>
  )
}
