import { useRef, useState } from 'react'
import type { Player } from '../data/players'
import { POSITION_LABEL, SHOW_RATING } from '../data/players'
import { CLUB } from '../data/club'
import { tierOf, figureFit, cachedFigureFit, FIGURE, type FigureFit } from './cardArt'

// ─────────────────────────────────────────────────────────────
// v14-D „Karten 2.0" — DOM-Sammelkarte. Gleiches Design wie die
// 3D-Textur und der Story-Export (ui/cardArt.ts):
//  · rot-schwarzer gebürsteter Foil mit Wappen-Prägung
//  · Freisteller IM Kartenrahmen (v15-P): Kopf mit Abstand unter der
//    Oberkante (Scheitel pro Bild gemessen), Oberkörper läuft weich in
//    die Namensplatte aus; dahinter die Rückennummer als Wasserzeichen
//  · oben links Nummer (Gold) + Position, oben rechts Wappen
//  · unten Vorname klein, NACHNAME groß
//  · Badges „C" (Kapitän) und „NEU" (Neuzugang)
//  · Stufen über Flags: Kader / Neuzugang (Silber) / Kapitän (Gold) /
//    Spieler des Monats (Holo)
// Keine Stats, kein Rating ohne echte Werte, keine Platzhalter-Texte.
// Interaktion: Pointer-Tilt + Foil-Glanz (Desktop); Gyro-Tilt mobil
// erst nach Erlaubnis (iOS fragt beim ersten Tap auf eine Karte).
// Alle Maße in cqw (Container-Query-Einheiten) → skaliert mit der Karte.
// ─────────────────────────────────────────────────────────────

interface Props {
  player: Player
  onClick?: (p: Player) => void
  /** true → im Modal, größer, kein Klick-Handler nötig. */
  large?: boolean
}

// ── Gyro-Tilt (mobil) ───────────────────────────────────────
// Ein globaler Listener schreibt --gyroX/--gyroY an <html>; jede Karte
// addiert die Werte zu ihrem Tilt. Startet erst nach einem Tap (iOS
// verlangt die Erlaubnis aus einer Nutzergeste) und nur auf Touch-Geräten.
let gyroState: 'idle' | 'on' | 'off' = 'idle'
export function requestGyro() {
  if (gyroState !== 'idle' || typeof window === 'undefined') return
  if (!window.matchMedia('(pointer: coarse)').matches) { gyroState = 'off'; return }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { gyroState = 'off'; return }
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent
  if (!DOE) { gyroState = 'off'; return }
  if (typeof DOE.requestPermission === 'function') {
    gyroState = 'off' // bis zur Antwort keine zweite Anfrage
    DOE.requestPermission()
      .then((r) => { if (r === 'granted') startGyro() })
      .catch(() => { /* abgelehnt → ohne Gyro */ })
  } else {
    startGyro()
  }
}
function startGyro() {
  gyroState = 'on'
  const root = document.documentElement
  let baseB: number | null = null
  let baseG: number | null = null
  let raf = 0
  let gx = 0
  let gy = 0
  window.addEventListener('deviceorientation', (e) => {
    if (e.beta == null || e.gamma == null) return
    // Ruhelage driftet langsam mit → egal, wie das Handy gehalten wird
    baseB = baseB == null ? e.beta : baseB + (e.beta - baseB) * 0.02
    baseG = baseG == null ? e.gamma : baseG + (e.gamma - baseG) * 0.02
    gx = Math.max(-9, Math.min(9, (baseB - e.beta) * 0.45))
    gy = Math.max(-11, Math.min(11, (e.gamma - baseG) * 0.55))
    if (!raf) {
      raf = requestAnimationFrame(() => {
        raf = 0
        root.style.setProperty('--gyroX', `${gx.toFixed(2)}deg`)
        root.style.setProperty('--gyroY', `${gy.toFixed(2)}deg`)
        root.style.setProperty('--gyroPx', `${(50 + gy * 3).toFixed(1)}%`)
      })
    }
  }, { passive: true })
}

/** v15-P: Freisteller im Kartenfenster. Der Scheitel wird beim Laden pro
 *  Bild gemessen (cardArt.figureFit) → jeder Kopf sitzt gleich weit unter
 *  der Oberkante, egal wie der Freisteller zugeschnitten ist. Bis zur
 *  Messung bleibt die Figur unsichtbar (kein Springen). */
export function CardFigure({ src, headU = FIGURE.head }: { src: string; headU?: number }) {
  const [fit, setFit] = useState<FigureFit | null>(() => cachedFigureFit(src))
  return (
    <div className="holo__figwrap" aria-hidden="true">
      <img
        className="holo__figure"
        src={src}
        alt=""
        loading="lazy"
        decoding="async"
        draggable={false}
        data-ready={fit ? 'true' : undefined}
        style={fit ? { top: `${(headU - fit.head * FIGURE.width * fit.ratio).toFixed(2)}cqw` } : undefined}
        onLoad={(e) => setFit(figureFit(e.currentTarget))}
      />
    </div>
  )
}

function splitName(name: string) {
  const parts = name.trim().split(/\s+/)
  return { first: parts.slice(0, -1).join(' '), last: parts.slice(-1)[0] ?? '' }
}

/** Nachname so groß wie möglich, aber einzeilig (Anton ≈ 0.46 em/Zeichen). */
export function lastNameSize(last: string, max = 15, room = 84): string {
  return `${Math.min(max, room / Math.max(1, last.length * 0.47)).toFixed(2)}cqw`
}

export function HoloCard({ player, onClick, large }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const tier = tierOf(player)
  const { first, last } = splitName(player.name)
  const figure = player.cutoutUrl ?? null
  const big = SHOW_RATING ? String(player.rating) : player.number !== null ? String(player.number) : ''

  function onMove(e: React.PointerEvent) {
    if (e.pointerType !== 'mouse') return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--tiltY', `${(px - 0.5) * 14}deg`)
    el.style.setProperty('--tiltX', `${(0.5 - py) * 14}deg`)
    el.style.setProperty('--px', `${px * 100}%`)
    el.style.setProperty('--py', `${py * 100}%`)
    el.style.setProperty('--glow', '1')
  }
  function onLeave() {
    const el = ref.current
    if (!el) return
    el.style.setProperty('--tiltX', '0deg')
    el.style.setProperty('--tiltY', '0deg')
    el.style.setProperty('--px', '50%')
    el.style.setProperty('--py', '30%')
    el.style.setProperty('--glow', '0')
  }

  return (
    <div
      ref={ref}
      className={`holo holo--${tier}${large ? ' holo--large' : ''}`}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={(e) => {
        requestGyro()
        if (onClick) {
          e.stopPropagation()
          onClick(player)
        }
      }}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onClick(player)) : undefined}
      aria-label={
        player.number === null
          ? `${player.name}, ${POSITION_LABEL[player.position]}`
          : `${player.name}, Nummer ${player.number}, ${POSITION_LABEL[player.position]}`
      }
    >
      <div className="holo__body" aria-hidden="true">
        <div className="holo__emboss" />
        {figure && player.number !== null && <div className="holo__watermark">{player.number}</div>}
        <div className="holo__frame" />
        <div className="holo__plate" />
      </div>

      {figure ? (
        <CardFigure key={figure} src={figure} />
      ) : (
        <div className="holo__nophoto" aria-hidden="true">
          <img src="/brand/aga-logo.png" alt="" />
          {player.number !== null && <span>{player.number}</span>}
        </div>
      )}

      <div className="holo__top" aria-hidden="true">
        {big && <span className="holo__num">{big}</span>}
        <span className="holo__pos">{player.position}</span>
      </div>
      <img className="holo__crest" src="/brand/aga-logo.png" alt={CLUB.name} draggable={false} />
      <div className="holo__badges" aria-hidden="true">
        {player.isCaptain && <span className="holo__badge holo__badge--c" title="Kapitän">C</span>}
        {player.isNewSigning && <span className="holo__badge holo__badge--neu" title="Neuzugang">NEU</span>}
      </div>
      {tier === 'potm' && <div className="holo__potm">Spieler des Monats</div>}

      <div className="holo__name" aria-hidden="true">
        {first && <small>{first}</small>}
        <b style={{ fontSize: lastNameSize(last) }}>{last}</b>
        <i />
        <span>SV Agathenburg-Dollern</span>
      </div>

      <div className="holo__sheen" aria-hidden="true" />
    </div>
  )
}
