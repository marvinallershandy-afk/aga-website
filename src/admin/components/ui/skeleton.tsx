import { cn } from '../../lib/utils'

// Lade-Platzhalter mit Puls. Für Tabellen/Karten während des Datenladens.
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-muted', className)} />
}

// Fertige Zeilen-Skeletons für Tabellen/Listen.
export function SkeletonRows({ rows = 5, className }: { rows?: number; className?: string }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-12 w-full" />
      ))}
    </div>
  )
}
