import { useMemo } from 'react'
import type { Player } from '../data/players'
import { SvaKarte } from '../karten/SvaKarte'
import { vonSpieler } from '../karten/adapter'
import { gyroAnfragen } from '../karten/gyro'

// ─────────────────────────────────────────────────────────────
// v20-K: Die Spielerkarte der Website ist jetzt die gemeinsame
// Sammelkarte (<SvaKarte/>, src/karten). HoloCard bleibt als dünner
// Adapter, damit Galerie, Modal und Raster unverändert aufrufen.
// Bilder über playerMedia (Greenscreen → HD-Freisteller → Foto), lebende
// Karte (Loop), sobald Greenscreen-Aufnahmen da sind.
// ─────────────────────────────────────────────────────────────

interface Props {
  player: Player
  onClick?: (p: Player) => void
  /** true → im Modal: groß, mit Holo-Neigung und Rückseite */
  large?: boolean
  /** im Modal: Rückseite zeigen (Dreh-Animation) */
  seite?: 'vorne' | 'hinten'
}

/** Gyro-Erlaubnis (iOS) aus einer Nutzergeste — Alt-Name. */
export const requestGyro = gyroAnfragen

export function HoloCard({ player, onClick, large, seite }: Props) {
  const daten = useMemo(() => vonSpieler(player), [player])
  return (
    <SvaKarte
      daten={daten}
      stufe={large ? 'gross' : 'normal'}
      interaktiv={large}
      lebend
      seite={seite}
      className="sva-spielerkarte"
      onClick={onClick ? () => onClick(player) : undefined}
    />
  )
}
