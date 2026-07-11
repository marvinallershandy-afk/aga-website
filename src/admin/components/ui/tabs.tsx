import * as React from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../lib/utils'

// Segment-Control für Ansichts-/Tab-Wechsel — ersetzt die zuvor in
// Redaktionsplan, IdeenPool und Matchday duplizierten Button-Gruppen.

export interface TabItem<T extends string = string> {
  value: T
  label: string
  icon?: LucideIcon
  badge?: React.ReactNode
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
}: {
  items: readonly TabItem<T>[]
  value: T
  onChange: (value: T) => void
  className?: string
}) {
  return (
    <div
      role="tablist"
      className={cn('inline-flex overflow-hidden rounded-md bg-secondary', className)}
    >
      {items.map((item) => {
        const Icon = item.icon
        const active = item.value === value
        return (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(item.value)}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              active
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {Icon && <Icon className="h-4 w-4" />}
            {item.label}
            {item.badge}
          </button>
        )
      })}
    </div>
  )
}
