import { useEffect, useState } from 'react'
// P1: Website-Daten aus der Fassade (Overlay/DB → sonst statischer Seed).
import { PLAYERS, STAFF, TRAINING_ZEILE, ROLE_LABEL } from '../data/content'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'
import { PlayerGallery } from './PlayerGallery'
import { jumpToSection } from './Brandbar'
import { TacticsBoard } from './TacticsBoard'
import { BANK, STAB, FORMATION_LABEL, MATCH_LABEL, teamState, teamPhaseAt } from '../camera/teamLayout'

// v13-E9: Der Spieler-Funnel beginnt HIER (FIFA-Karten = „da will ich
// spielen") — die Pill bringt den Probetraining-Termin an die Mannschaft.
function TrainingPill() {
  return (
    <button className="training-pill" onClick={() => jumpToSection('kontakt')}>
      Selber kicken? Probetraining {TRAINING_ZEILE} <span aria-hidden="true">→</span>
    </button>
  )
}

const NARROW_QUERY = '(max-width: 640px)'
function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && window.matchMedia(NARROW_QUERY).matches)
  useEffect(() => {
    const mq = window.matchMedia(NARROW_QUERY)
    const on = () => setNarrow(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return narrow
}

function lastName(name: string) {
  return name.trim().split(/\s+/).slice(-1)[0]
}

// ─── Desktop/Tablet: ruhiger Begleittext zur Fahrt ───────────
// v15-P: KEIN Person-für-Person-Fokus mehr (synchroner Name/Nr. +
// Fortschrittsstriche entfallen). Zwei Zustände: unterwegs ein kurzer
// Hinweis, in der Totale Bank + Trainerstab. teamState wird vom
// CameraRig pro Frame geschrieben; neu gerendert wird nur beim Wechsel.
function TeamInfo() {
  const [phase, setPhase] = useState<'fahrt' | 'totale'>('fahrt')
  useEffect(() => {
    let raf = 0
    let last = 'fahrt'
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (teamState.w < 0.02) return
      const next = teamPhaseAt(teamState.s)
      if (next !== last) {
        last = next
        setPhase(next)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const label = MATCH_LABEL ? `Aufstellung ${MATCH_LABEL}` : `Unsere Elf · ${FORMATION_LABEL}`
  const hasOutro = BANK.length > 0 || STAB.length > 0

  return (
    <div className="team-focus">
      <div className="team-focus__meta">{label}</div>
      {phase === 'totale' && hasOutro ? (
        <div key="outro" className="team-focus__outro">
          {BANK.length > 0 && (
            <p>
              <span>Auf der Bank</span>
              {BANK.map((b) => lastName(b.name)).join(' · ')}
            </p>
          )}
          {STAB.length > 0 && (
            <p>
              <span>An der Linie</span>
              {STAB.map((m) => `${m.name} (${ROLE_LABEL[m.role]})`).join(' · ')}
            </p>
          )}
        </div>
      ) : (
        <p key="intro" className="team-focus__intro">
          Scroll über den Platz bis zur Totale. Tipp eine Karte an, dann dreht sie sich.
        </p>
      )}
    </div>
  )
}

export function PlayerCardGrid() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const fallback = useStore((s) => s.fallback)
  const narrow = useNarrow()
  const [galleryOpen, setGalleryOpen] = useState(false)
  const gallery = (
    <PlayerGallery open={galleryOpen} onClose={() => setGalleryOpen(false)} />
  )
  const allBtn = (
    <button className="btn btn--primary card-grid__all" onClick={() => setGalleryOpen(true)}>
      Alle Spieler anzeigen
    </button>
  )

  // 3D-Pfad: Karten leben auf dem Platz (Desktop/Tablet) bzw. im Deck (mobil).
  if (!fallback) {
    // v14-M: Mobil trägt das Taktik-Board die Aufstellung (statt Swipe-Deck).
    if (narrow) {
      return (
        <>
          <TacticsBoard />
          <div className="tboard__actions">
            <button className="btn btn--primary card-grid__all" onClick={() => setGalleryOpen(true)}>
              Alle Spieler
            </button>
          </div>
          {gallery}
        </>
      )
    }
    return (
      <>
        <TeamInfo />
        <div className="team-actions">
          {allBtn}
          <TrainingPill />
        </div>
        {gallery}
      </>
    )
  }

  // Fallback (kein WebGL / reduced-motion): statisches Taktik-Board (v14-M)
  // + Karten-Raster.
  return (
    <>
      <TacticsBoard fluid />
      <div className="card-grid">
        {PLAYERS.map((p) => (
          <HoloCard key={p.id} player={p} onClick={setSelected} />
        ))}
      </div>

      <TrainingPill />

      {/* v10-E2: Trainerstab als eigene, klar abgesetzte Kategorie */}
      <div className="staff-block">
        <span className="staff-block__label">Trainerstab</span>
        <div className="staff-grid">
          {STAFF.map((m) => (
            <StaffCard key={m.id} member={m} />
          ))}
        </div>
      </div>
    </>
  )
}
