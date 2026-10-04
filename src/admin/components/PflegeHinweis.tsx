import { DatabaseZap, Info } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

// v14-C: Ruhige Hinweis-Box für Ehrenamtliche. `schema` = die Datenbank ist
// noch nicht auf dem Stand der Vereins-Pflege (Migration fehlt) — dann wird
// erklärt statt mit Fehlercodes zu erschrecken.
export function PflegeHinweis({
  schema,
  title,
  children,
  className,
}: {
  schema?: boolean
  title?: string
  children?: ReactNode
  className?: string
}) {
  const Icon = schema ? DatabaseZap : Info
  return (
    <div
      role="note"
      className={cn(
        'flex items-start gap-3 rounded-lg border px-4 py-3 text-sm',
        schema ? 'border-sva-gold/40 bg-sva-gold/10' : 'border-border bg-muted/30',
        className,
      )}
    >
      <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', schema ? 'text-sva-gold' : 'text-muted-foreground')} />
      <div className="space-y-1">
        <p className="font-medium">
          {title ?? (schema ? 'Die Datenbank ist noch nicht vorbereitet' : 'Hinweis')}
        </p>
        <div className="text-muted-foreground">
          {children ??
            (schema
              ? 'Dieser Bereich braucht die neuen Tabellen der Vereins-Pflege. Marvin muss einmalig die Migrationen anwenden (Anleitung: docs/VEREINSPFLEGE.md). Bis dahin kannst du dich hier nur umsehen.'
              : null)}
        </div>
      </div>
    </div>
  )
}
