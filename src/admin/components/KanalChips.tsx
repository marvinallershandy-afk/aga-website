import { KANAELE } from '../lib/constants'
import { cn } from '../lib/utils'

// Mehrfachauswahl der Kanäle als Toggle-Chips (kein extra Dependency).
export function KanalChips({
  value,
  onChange,
}: {
  value: string[]
  onChange: (next: string[]) => void
}) {
  const toggle = (k: string) => {
    onChange(value.includes(k) ? value.filter((v) => v !== k) : [...value, k])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {KANAELE.map((k) => {
        const active = value.includes(k.value)
        return (
          <button
            key={k.value}
            type="button"
            onClick={() => toggle(k.value)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              active
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground',
            )}
          >
            {k.label}
          </button>
        )
      })}
    </div>
  )
}
