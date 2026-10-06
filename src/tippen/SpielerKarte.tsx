import { memo, useMemo } from 'react'
import { SvaKarte } from '../karten/SvaKarte'
import { vonSpieler } from '../karten/adapter'
import type { KaderSpieler } from './api'
import { alsPlayer, spielerBild } from './karteAdapter'

// ─────────────────────────────────────────────────────────────
// v20-T/v21: React-Seite des Karten-Adapters (siehe karteAdapter.ts).
// v21: direkt die gemeinsame Sammelkarte <SvaKarte/> (src/karten) —
// Neigung + Holo-Glanz bei Zeigergeräten, lebende Karte (Greenscreen-Loop),
// Kapitän DEINER Elf = Gold-Stufe.
// ─────────────────────────────────────────────────────────────

const zeiger = typeof window !== 'undefined' && window.matchMedia?.('(hover: hover) and (pointer: fine)').matches

interface Props {
  spieler: KaderSpieler
  kapitaen?: boolean
  onClick?: () => void
  /** groß (Sheet/Bühne): Neigung auch per Gyro, HD-Freisteller */
  gross?: boolean
}

/** Sammelkarte (z. B. auf dem Spielfeld von „Deine Elf“). */
export const SpielerKarte = memo(function SpielerKarte({ spieler, kapitaen = false, onClick, gross }: Props) {
  const daten = useMemo(() => vonSpieler(alsPlayer(spieler, kapitaen)), [spieler, kapitaen])
  return (
    <SvaKarte
      daten={daten}
      stufe={gross ? 'gross' : 'normal'}
      interaktiv={gross || zeiger}
      lebend
      className="sva-spielerkarte"
      onClick={onClick}
      ariaLabel={`${spieler.name}${kapitaen ? ', Kapitän' : ''}`}
    />
  )
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
