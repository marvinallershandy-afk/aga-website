import { ArrowLeftRight, BookOpen, CalendarCheck, Flag, Layers, Lock, Moon, Target, UserPlus, Users } from 'lucide-react'
import type { Ziel } from './api'
import type { Metall } from './medaille-logik'

// ─────────────────────────────────────────────────────────────
// v21-A: Abzeichen als geprägte Medaille statt flacher Kasten.
//   erreicht → Metall (Kupfer-Rot · Silber · Gold · Holo), gerändelter Rand,
//              Licht folgt dem Zeiger, beim ersten Sehen „geprägt“ (Freischalten)
//   offen    → dunkle Rohling-Scheibe mit Fortschrittsring (füllt sich beim
//              Hineinscrollen), Symbol gedimmt
// Nur transform/opacity/stroke-dashoffset; prefers-reduced-motion = statisch.
// ─────────────────────────────────────────────────────────────

const FAMILIE = new Set(['zwillinge', 'warkehr', 'vater_sohn', 'familie_sva'])

/** Rote Karte (für „Die Rote Familie“) — augenzwinkernd */
function RoteKarte({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="7" y="3.5" width="10.5" height="15" rx="1.6" transform="rotate(12 12 12)" fill="currentColor" />
      <rect x="7" y="3.5" width="10.5" height="15" rx="1.6" transform="rotate(12 12 12)" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth=".8" />
    </svg>
  )
}

export function ZielSymbol({ z, size = 22 }: { z: Pick<Ziel, 'schluessel' | 'typ'>; size?: number }) {
  const p = { size, strokeWidth: 1.5, 'aria-hidden': true as const }
  if (z.schluessel === 'rote_familie') return <RoteKarte size={size} />
  if (FAMILIE.has(z.schluessel)) return <Users {...p} />
  if (z.schluessel === 'nachteule') return <Moon {...p} />
  switch (z.typ) {
    case 'kapitel':
      return <BookOpen {...p} />
    case 'meilenstein':
      return <Flag {...p} />
    case 'serie_checkin':
      return <CalendarCheck {...p} />
    case 'serie_tipp':
    case 'extern':
      return <Target {...p} />
    case 'sozial_tausch':
      return <ArrowLeftRight {...p} />
    case 'sozial_freund':
      return <UserPlus {...p} />
    default:
      return <Layers {...p} />
  }
}

const UMFANG = 2 * Math.PI * 46

interface MedailleProps {
  metall: Metall
  erreicht: boolean
  /** 0…1 Fortschritt (nur offen) */
  anteil?: number
  /** Ring erst füllen, wenn sichtbar */
  sichtbar?: boolean
  /** Freischalt-Animation (einmalig) */
  neu?: boolean
  gesperrt?: boolean
  groesse?: 's' | 'm' | 'l'
  children: React.ReactNode
}

export function Medaille({ metall, erreicht, anteil = 0, sichtbar = true, neu, gesperrt, groesse = 'm', children }: MedailleProps) {
  const off = UMFANG * (1 - (sichtbar ? Math.max(0, Math.min(1, anteil)) : 0))
  return (
    <span
      className={`md md--${groesse} md--${erreicht ? metall : 'roh'}${erreicht ? ' is-erreicht' : metall === 'rot' ? ' md--rot-offen' : ''}${neu ? ' is-neu' : ''}${gesperrt ? ' is-gesperrt' : ''}`}
      aria-hidden="true"
    >
      {neu && <span className="md__burst" />}
      <span className="md__koerper">
        <span className="md__rand" />
        <span className="md__feld">{gesperrt ? <Lock size={groesse === 's' ? 14 : 20} strokeWidth={1.5} /> : children}</span>
        {erreicht && <span className="md__licht" />}
        {erreicht && <span className="md__glanz" />}
      </span>
      {!erreicht && !gesperrt && (
        <svg className="md__ring" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="46" className="md__spur" />
          <circle cx="50" cy="50" r="46" className="md__wert" style={{ strokeDasharray: UMFANG.toFixed(2), strokeDashoffset: off.toFixed(2) }} />
        </svg>
      )}
    </span>
  )
}
