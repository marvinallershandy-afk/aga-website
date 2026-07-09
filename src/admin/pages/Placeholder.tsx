import type { ReactNode } from 'react'
import { Card, CardContent } from '../components/ui/card'

// Einheitlicher Seitenkopf für den Admin-Bereich.
export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions}
    </div>
  )
}

// Platzhalter-Inhalt für Bereiche, die eine spätere Phase füllt.
export function Placeholder({ title, subtitle, note }: { title: string; subtitle?: string; note: string }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <Card>
        <CardContent className="py-16 text-center text-muted-foreground">{note}</CardContent>
      </Card>
    </>
  )
}
