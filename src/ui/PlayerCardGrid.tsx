import { useEffect, useState } from 'react'
// P1: Website-Daten aus der Fassade (Overlay/DB → sonst statischer Seed).
import { PLAYERS, STAFF, TRAINING_ZEILE, ROLE_LABEL, POSITION_LABEL } from '../data/content'
import { useStore } from '../store/useStore'
import { HoloCard } from './HoloCard'
import { StaffCard } from './StaffCard'
import { PlayerGallery } from './PlayerGallery'
import { jumpToSection } from './Brandbar'
import { TacticsBoard } from './TacticsBoard'
import { BANK, STAB, FORMATION_LABEL, MATCH_LABEL, TEAM_CARDS, TEAM_PLAYERS, teamState, teamFocus, teamPhaseAt } from '../camera/teamLayout'
import { TEAM_ORDER } from '../camera/tourPlan'

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

// ─── v18-R: Begleittext zur Spieler-zu-Spieler-Fahrt ────────────
// Drei Zustände: Anflug (kurzer Hinweis) → Spieler (Nummer, Position, Name
// der Karte, an der die Kamera gerade hält) → Totale (Bank + Trainerstab).
// teamFocus/teamState schreibt der CameraRig pro Frame; neu gerendert wird
// nur beim Wechsel (rAF-Abgleich) → ruhig, kein Flackern. Desktop: in der
// Textspalte; Handy: unten über den Knöpfen.
type View = { phase: 'anflug' | 'spieler' | 'totale'; card: number }
function useTeamView(): View {
  const [view, setView] = useState<View>({ phase: 'anflug', card: -1 })
  useEffect(() => {
    let raf = 0
    let last = 'anflug:-1'
    const tick = () => {
      raf = requestAnimationFrame(tick)
      if (teamState.w < 0.02) return
      const phase: View['phase'] =
        teamPhaseAt(teamState.s) === 'totale' ? 'totale' : teamFocus.card >= 0 && teamFocus.w > 0.5 ? 'spieler' : 'anflug'
      const card = phase === 'spieler' ? teamFocus.card : -1
      const key = `${phase}:${card}`
      if (key !== last) {
        last = key
        setView({ phase, card })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])
  return view
}

function TeamInfo() {
  const setSelected = useStore((s) => s.setSelectedPlayer)
  const view = useTeamView()
  const label = MATCH_LABEL ? `Aufstellung ${MATCH_LABEL}` : `Unsere Elf · ${FORMATION_LABEL}`
  const hasOutro = BANK.length > 0 || STAB.length > 0
  const p = view.card >= 0 ? TEAM_CARDS[view.card]?.player : undefined
  const order = view.card >= 0 ? TEAM_ORDER.indexOf(view.card) : -1
  const first = p ? p.name.trim().split(/\s+/).slice(0, -1).join(' ') : ''

  return (
    <div className="team-focus" data-phase={view.phase}>
      <div className="team-focus__meta">
        {label}
        {order >= 0 && (
          <span className="team-focus__count">
            {String(order + 1).padStart(2, '0')} / {String(TEAM_ORDER.length).padStart(2, '0')}
          </span>
        )}
      </div>
      {view.phase === 'spieler' && p ? (
        <button key={p.id} className="team-focus__card" onClick={() => setSelected(p, TEAM_PLAYERS)} aria-label={`${p.name} öffnen`}>
          <span className="team-focus__num" aria-hidden={p.number == null}>
            {p.number ?? '–'}
          </span>
          <span className="team-focus__txt">
            <span className="team-focus__pos">
              {POSITION_LABEL[p.position]}
              {p.isCaptain && <em>Kapitän</em>}
            </span>
            <b className="team-focus__name">
              {first && <small>{first}</small>}
              {lastName(p.name)}
            </b>
          </span>
        </button>
      ) : view.phase === 'totale' && hasOutro ? (
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
          Scroll weiter: Spieler für Spieler über den Platz. Tipp eine Karte an, dann dreht sie sich.
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
    // v18-R: Mobil wie Desktop — Karten in 3D, Spieler-zu-Spieler-Fahrt;
    // Begleittext + Knopf unten im Bild (das Taktik-Board bleibt im Fallback).
    if (narrow) {
      return (
        <div className="team-mobile">
          <TeamInfo />
          <div className="tboard__actions">
            <button className="btn btn--primary card-grid__all" onClick={() => setGalleryOpen(true)}>
              Alle Spieler
            </button>
          </div>
          {gallery}
        </div>
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
