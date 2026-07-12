import { AlertTriangle, RotateCw } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

/** Einheitlicher Fehlerzustand mit Retry — Gegenstück zu EmptyState. */
export function ErrorState({
  title = 'Daten konnten nicht geladen werden',
  message,
  onRetry,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-6 py-10 text-center',
        className,
      )}
    >
      <AlertTriangle className="h-8 w-8 text-primary" />
      <div>
        <p className="font-medium">{title}</p>
        {message && <p className="mt-1 max-w-md text-sm text-muted-foreground">{message}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw className="h-4 w-4" /> Erneut versuchen
        </Button>
      )}
    </div>
  )
}
