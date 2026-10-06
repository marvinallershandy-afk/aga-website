import { useEffect, useRef, type ReactNode } from 'react'
import { animate, useReducedMotion } from 'framer-motion'
import { Crown, Eye, Flame, Footprints, PenLine, Sparkles, Square, Target, Trophy, Users } from 'lucide-react'
import type { Abzeichen } from './model'
import { avatarTon, kuerzel } from './model'

// ─────────────────────────────────────────────────────────────
// v21-T: kleine Bausteine der Tipp-Liga im TV-Grafik-Stil:
// Zähler (Punkte zählen hoch), Avatar (Initialen), Wappen + Gegner als
// Bandentafel (DESIGN.md 8a), Kapitel-Kopf (Bauchbinde), Medaille.
// ─────────────────────────────────────────────────────────────

/** Zahl, die von ihrem letzten Wert zum Ziel zählt (transform-frei, nur Text). */
export function Zaehler({ wert, dauer = 0.6, vorzeichen = false, start = true, className }: { wert: number; dauer?: number; vorzeichen?: boolean; start?: boolean; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const zuletzt = useRef<number | null>(null)
  const ruhig = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const fmt = (n: number) => `${vorzeichen && n > 0 ? '+' : ''}${n}`
    const von = zuletzt.current ?? (start ? 0 : wert)
    if (!start || ruhig || von === wert) {
      el.textContent = fmt(wert)
      zuletzt.current = wert
      return
    }
    const a = animate(von, wert, {
      duration: dauer,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => (el.textContent = fmt(Math.round(v))),
      onComplete: () => (zuletzt.current = wert),
    })
    return () => {
      a.stop()
      zuletzt.current = wert
    }
  }, [wert, dauer, vorzeichen, start, ruhig])
  return (
    <span ref={ref} className={className}>
      {`${vorzeichen && wert > 0 ? '+' : ''}${start && !ruhig ? 0 : wert}`}
    </span>
  )
}

export function Avatar({ name, groesse = 40, kabine, ich }: { name: string; groesse?: number; kabine?: boolean; ich?: boolean }) {
  const t = name.trim().split(/\s+/)
  const ini = `${t[0]?.[0] ?? '?'}${t[1]?.[0] ?? ''}`.toUpperCase()
  return (
    <span
      className={`tp-ava tp-ava--${avatarTon(name)}${kabine ? ' is-kabine' : ''}${ich ? ' is-ich' : ''}`}
      style={{ width: groesse, height: groesse, fontSize: groesse * 0.4 }}
      aria-hidden="true"
    >
      {ini}
      {kabine && <i className="tp-ava__k">K</i>}
    </span>
  )
}

/** SVA-Wappen bzw. Gegner als Bandentafel (Anton-Kürzel, rote Kante). */
export function Wappen({ sva, name, klein }: { sva: boolean; name: string; klein?: boolean }) {
  return sva ? (
    <span className={`tp-wappen${klein ? ' tp-wappen--klein' : ''}`}>
      <img src="/brand/aga-logo.png" alt="" width="44" height="52" />
    </span>
  ) : (
    <span className={`tp-tafel${klein ? ' tp-tafel--klein' : ''}`} aria-hidden="true">
      {kuerzel(name)}
    </span>
  )
}

/** Kapitel-Kopf wie eine TV-Bauchbinde: roter Strich, Label, rechts Info. */
export function Kapitel({ titel, meta, id, children }: { titel: string; meta?: ReactNode; id?: string; children?: ReactNode }) {
  return (
    <header className="tp-kap">
      <h2 className="tp-kap__titel" id={id}>
        {titel}
      </h2>
      {meta != null && <span className="tp-kap__meta">{meta}</span>}
      {children}
    </header>
  )
}

const ICONS: Record<Abzeichen['icon'], typeof Eye> = {
  eye: Eye,
  flame: Flame,
  square: Square,
  crown: Crown,
  target: Target,
  sparkles: Sparkles,
  footprints: Footprints,
  trophy: Trophy,
  users: Users,
  pen: PenLine,
}

/** Medaille (SVG): geprägter Ring, Metall nach Stufe; gesperrt = Blindprägung. */
export function Medaille({ a, da, groesse = 72 }: { a: Abzeichen; da: boolean; groesse?: number }) {
  const Icon = ICONS[a.icon]
  const stufe = da ? (a.stufe ?? 'rot') : 'aus'
  const id = `med-${a.key}-${stufe}`
  const farben: Record<string, [string, string, string]> = {
    rot: ['#ff5a62', '#c3141f', '#6d0b12'],
    silber: ['#ffffff', '#9aa1aa', '#4e545c'],
    gold: ['#fff1bd', '#d9aa45', '#7a5718'],
    aus: ['#3a3536', '#262223', '#1a1718'],
  }
  const [h, m, d] = farben[stufe]
  return (
    <span className={`tp-medaille is-${stufe}`} style={{ width: groesse, height: groesse }} aria-hidden="true">
      <svg viewBox="0 0 100 100" width={groesse} height={groesse}>
        <defs>
          <linearGradient id={`${id}-r`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={h} />
            <stop offset=".45" stopColor={m} />
            <stop offset="1" stopColor={d} />
          </linearGradient>
          <radialGradient id={`${id}-i`} cx=".5" cy=".35" r=".7">
            <stop offset="0" stopColor="#262223" />
            <stop offset="1" stopColor="#100e0f" />
          </radialGradient>
        </defs>
        {/* Zacken-Rand wie eine Prägemedaille */}
        <polygon
          points={Array.from({ length: 48 }, (_, i) => {
            const r = i % 2 ? 46 : 49
            const w = (i / 48) * Math.PI * 2
            return `${(50 + r * Math.cos(w)).toFixed(2)},${(50 + r * Math.sin(w)).toFixed(2)}`
          }).join(' ')}
          fill={`url(#${id}-r)`}
        />
        <circle cx="50" cy="50" r="38" fill={`url(#${id}-i)`} stroke={`url(#${id}-r)`} strokeWidth="2" />
        <circle cx="50" cy="50" r="33" fill="none" stroke="rgba(244,242,239,.10)" strokeWidth=".8" strokeDasharray="1.5 2.5" />
      </svg>
      <Icon className="tp-medaille__icon" size={groesse * 0.36} strokeWidth={1.5} />
    </span>
  )
}
