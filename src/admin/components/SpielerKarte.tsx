import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v14-C: Vereinfachte Vorschau der Website-Spielerkarte (HoloCard) im Admin.
// Gleiche Bildsprache: dunkler Rot-Verlauf, Goldrand, Position + Nummer oben,
// Wappen, Foto (Freisteller bevorzugt) bzw. Nummer + Wappen ohne Foto,
// Namensplatte unten. Kein Tilt/Holo — es geht um „sieht das richtig aus?".
// ─────────────────────────────────────────────────────────────

export interface KartenDaten {
  name: string
  number: number | null
  /** TW/ABW/MIT/ANG oder Rollen-Label beim Trainerstab */
  position: string
  photoUrl: string | null
  cutoutUrl?: string | null
  isCaptain?: boolean
  isNewSigning?: boolean
  inactive?: boolean
}

export function SpielerKarte({ p, className, size = 'md' }: { p: KartenDaten; className?: string; size?: 'sm' | 'md' }) {
  const parts = p.name.trim().split(/\s+/)
  const nachname = parts.length > 1 ? parts.slice(-1)[0] : parts[0] || 'Name'
  const vorname = parts.length > 1 ? parts.slice(0, -1).join(' ') : ''
  const bild = p.cutoutUrl || p.photoUrl
  const istFreisteller = !!p.cutoutUrl

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-xl border border-sva-gold/55 shadow-lg shadow-black/50',
        size === 'sm' ? 'w-28' : 'w-full max-w-[220px]',
        p.inactive && 'opacity-50 grayscale',
        className,
      )}
      style={{
        aspectRatio: '3 / 4.2',
        background: 'radial-gradient(120% 80% at 50% 0%, #431418 0%, #201618 42%, #0f0c0d 100%)',
      }}
      aria-label={`Kartenvorschau ${p.name}`}
    >
      {/* Wasserzeichen-Nummer */}
      {p.number != null && (
        <span
          aria-hidden
          className="pointer-events-none absolute -right-1 top-6 font-display leading-none text-white/[0.06]"
          style={{ fontSize: size === 'sm' ? 64 : 120 }}
        >
          {p.number}
        </span>
      )}

      {/* Kopf: Nummer/Position links, Wappen rechts */}
      <div className={cn('absolute left-2.5 top-2 z-10 flex flex-col leading-none', size === 'sm' && 'left-1.5 top-1.5')}>
        {p.number != null && <span className={cn('font-display text-white', size === 'sm' ? 'text-lg' : 'text-3xl')}>{p.number}</span>}
        <span className={cn('mt-0.5 font-extrabold tracking-[0.12em] text-white/85', size === 'sm' ? 'text-[8px]' : 'text-[10px]')}>
          {p.position}
        </span>
      </div>
      <img
        src="/brand/wappen.png"
        alt=""
        aria-hidden
        className={cn('absolute right-2 top-2 z-10 w-auto', size === 'sm' ? 'h-5' : 'h-8')}
      />
      {p.isCaptain && (
        <span className="absolute left-2 top-[34%] z-10 flex h-6 w-6 items-center justify-center rounded-full bg-sva-gold text-[11px] font-black text-black">
          C
        </span>
      )}
      {p.isNewSigning && size !== 'sm' && (
        <span className="absolute right-2 top-[34%] z-10 rounded bg-primary px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-white">
          Neu
        </span>
      )}

      {/* Porträt */}
      <div className="absolute inset-x-0 bottom-[26%] top-[10%] flex items-end justify-center">
        {bild ? (
          istFreisteller ? (
            <img
              src={bild}
              alt=""
              className="h-full w-full object-contain object-bottom"
              style={{ filter: 'drop-shadow(0 0 14px rgba(233,29,41,.38)) drop-shadow(0 10px 12px rgba(0,0,0,.6))' }}
            />
          ) : (
            <div
              className="relative h-[96%] w-[78%] overflow-hidden rounded-t-md"
              style={{ background: 'linear-gradient(168deg, #E91D29 0%, #6e1218 45%, #231F20 82%)' }}
            >
              <img src={bild} alt="" className="absolute inset-0 h-full w-full object-cover" style={{ objectPosition: '50% 14%', mixBlendMode: 'luminosity' }} />
            </div>
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-1">
            <span className={cn('font-display leading-none text-white/80', size === 'sm' ? 'text-4xl' : 'text-7xl')}>
              {p.number ?? ''}
            </span>
            <img src="/brand/wappen.png" alt="" aria-hidden className={cn('w-auto opacity-60', size === 'sm' ? 'h-6' : 'h-12')} />
          </div>
        )}
      </div>

      {/* Namensplatte */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/80 to-transparent px-2 pb-2 pt-4 text-center">
        {vorname && <small className={cn('block truncate text-white/75', size === 'sm' ? 'text-[8px]' : 'text-[11px]')}>{vorname}</small>}
        <b className={cn('block truncate font-display uppercase tracking-wide text-white', size === 'sm' ? 'text-xs' : 'text-xl')}>
          {nachname}
        </b>
        <div className="mx-auto mt-1 h-px w-2/3 bg-gradient-to-r from-transparent via-sva-gold/70 to-transparent" />
      </div>
    </div>
  )
}
