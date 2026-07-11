import type { ComponentType, SVGProps } from 'react'
import { ChevronDown, Music2, MessageCircle, Globe } from 'lucide-react'
import { cn } from '../../lib/utils'
import { EINGANG_STATUS, STATUS, eingangStatusMeta, kanalLabel, statusMeta } from '../../lib/constants'

// Einheitliche Status- und Kanal-Darstellung für alle Seiten:
// farbige Status-Pills (statt grauem Einheitsbrei) + kompakte Kanal-Icons.

export function StatusPill({
  value,
  kind = 'content',
  className,
}: {
  value: string
  kind?: 'content' | 'eingang'
  className?: string
}) {
  const meta = kind === 'content' ? statusMeta(value) : eingangStatusMeta(value)
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium text-foreground',
        className,
      )}
      style={{ borderColor: `${meta.dot}59`, backgroundColor: `${meta.dot}1f` }}
    >
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: meta.dot }} />
      {meta.label}
    </span>
  )
}

/**
 * Status-Pill, die zugleich ein natives Select ist (unsichtbar darübergelegt):
 * sieht aus wie die Pill, öffnet aber das System-Dropdown zum Umschalten.
 */
export function StatusSelect({
  value,
  onChange,
  kind = 'content',
  className,
}: {
  value: string
  onChange: (status: string) => void
  kind?: 'content' | 'eingang'
  className?: string
}) {
  const options = kind === 'content' ? STATUS : EINGANG_STATUS
  return (
    <span className={cn('relative inline-flex items-center', className)}>
      <StatusPill value={value} kind={kind} />
      <ChevronDown className="ml-1 h-3 w-3 text-muted-foreground" />
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 cursor-pointer opacity-0"
        aria-label="Status ändern"
      >
        {options.map((s) => (
          <option key={s.value} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </span>
  )
}

type IconProps = SVGProps<SVGSVGElement>

// Brand-Icons im Lucide-Strichstil (lucide-react führt keine Marken-Icons).
function InstagramIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
    </svg>
  )
}
function FacebookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  )
}

const KANAL_ICON: Record<string, ComponentType<IconProps>> = {
  instagram: InstagramIcon,
  facebook: FacebookIcon,
  tiktok: Music2,
  whatsapp: MessageCircle,
  website: Globe,
}

/** Kanäle als kompakte Icon-Reihe (Tooltip = Kanalname). */
export function KanalIcons({ kanaele, className }: { kanaele: string[]; className?: string }) {
  if (!kanaele.length) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <span className={cn('inline-flex items-center gap-1.5', className)}>
      {kanaele.map((k) => {
        const Icon = KANAL_ICON[k]
        const label = kanalLabel(k)
        return Icon ? (
          <span key={k} title={label} className="inline-flex" aria-label={label}>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        ) : (
          <span key={k} className="text-xs text-muted-foreground">
            {label}
          </span>
        )
      })}
    </span>
  )
}
