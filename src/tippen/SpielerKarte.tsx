import { memo } from 'react'
import { HoloCard } from '../ui/HoloCard'
import type { KaderSpieler } from './api'
import { alsPlayer, spielerBild } from './karteAdapter'
import '../ui/cards.css'

// ─────────────────────────────────────────────────────────────
// v20-T: React-Seite des Karten-Adapters (siehe karteAdapter.ts).
// Heute die vorhandene HoloCard; später das neue Kartensystem.
// ─────────────────────────────────────────────────────────────

interface Props {
  spieler: KaderSpieler
  kapitaen?: boolean
  onClick?: () => void
}

/** Sammelkarte (z. B. auf dem Spielfeld von „Deine Elf“). */
export const SpielerKarte = memo(function SpielerKarte({ spieler, kapitaen = false, onClick }: Props) {
  return <HoloCard player={alsPlayer(spieler, kapitaen)} onClick={onClick ? () => onClick() : undefined} />
})

/** Rundes Gesicht für Listen und Auswahl. */
export function SpielerGesicht({ spieler, groesse = 44 }: { spieler?: KaderSpieler; groesse?: number }) {
  const b = spielerBild(spieler)
  return (
    <span className={`tp-gesicht${b.freigestellt ? ' tp-gesicht--frei' : ''}`} style={{ width: groesse, height: groesse }} aria-hidden="true">
      {b.src ? <img src={b.src} alt="" loading="lazy" decoding="async" draggable={false} /> : <i>{spieler?.nummer ?? '–'}</i>}
    </span>
  )
}
