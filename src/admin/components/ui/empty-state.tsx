import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

// Einheitlicher Empty State mit Icon, Anleitung und optionaler Aktion.
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border px-6 py-16 text-center">
      {Icon && <Icon className="mb-3 h-8 w-8 text-muted-foreground/70" />}
      <h3 className="font-display text-lg tracking-wide">{title}</h3>
      {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
