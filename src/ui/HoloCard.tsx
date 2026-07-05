import { useEffect, useRef } from 'react'
import type { Player } from '../data/players'
import { POSITION_LABEL } from '../data/players'
import { CLUB } from '../data/club'
import { PORTRAIT_STYLE } from './cardConfig'

interface Props {
  player: Player
  onClick?: (p: Player) => void
  /** true → im Modal, größer, kein Klick-Handler nötig. */
  large?: boolean
}

// Eine Karte mit Pointer-/Gyro-Tilt und Holo-Shimmer. Shimmer läuft
// nur, solange die Karte im Viewport ist (IntersectionObserver).
export function HoloCard({ player, onClick, large }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // Tilt via Pointer
  function onMove(e: React.PointerEvent) {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const px = (e.clientX - r.left) / r.width
    const py = (e.clientY - r.top) / r.height
    el.style.setProperty('--tiltY', `${(px - 0.5) * 18}deg`)
    el.style.setProperty('--tiltX', `${(0.5 - py) * 20}deg`)
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
    el.style.setProperty('--py', '50%')
    el.style.setProperty('--glow', '0')
  }

  // Shimmer nur sichtbar aktiv (Performance)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(
      ([entry]) => el.classList.toggle('is-live', entry.isIntersecting),
      { threshold: 0.15 },
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div
      ref={ref}
      className={player.isPlayerOfMonth ? 'holo holo--totm' : 'holo'}
      style={large ? { aspectRatio: '3 / 4.2' } : undefined}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick ? () => onClick(player) : undefined}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => (e.key === 'Enter' || e.key === ' ') && onClick(player) : undefined}
      aria-label={`${player.name}, Nummer ${player.number}, ${POSITION_LABEL[player.position]}`}
    >
      <div className="holo__body" />
      <div className="holo__watermark">{player.number}</div>

      <div className="holo__top">
        <span className="holo__rating">{player.rating}</span>
        <span className="holo__pos">{player.position}</span>
      </div>
      <img className="holo__crest" src="/brand/wappen.png" alt={CLUB.name} title={CLUB.shortName} />

      <div className="holo__portrait">
        {player.photoUrl ? (
          <div className={`holo__photo holo__photo--${PORTRAIT_STYLE}`}>
            <img src={player.photoUrl} alt={player.name} loading="lazy" />
          </div>
        ) : (
          <div className="holo__silhouette" />
        )}
      </div>

      {player.isPlayerOfMonth && (
        <div className="holo__totm-banner">Spieler des Monats</div>
      )}

      <div className="holo__plate">
        <div className="holo__name">{player.name}</div>
        <div className="holo__rule" />
        <div className="holo__stats">
          <span><b>{player.stats.games}</b>Spiele</span>
          <span><b>{player.stats.goals}</b>Tore</span>
          <span><b>{player.stats.assists}</b>Assists</span>
        </div>
      </div>

      <div className="holo__shine" />
      <div className="holo__gloss" />
      <div className="holo__frame" />
    </div>
  )
}
