import { BarChart3 } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

// Phase-4-Stub (dokumentiert): Kennzahlen aus Meta/TikTok, spätere Ausbaustufe.
const GEPLANT = [
  'Reichweite, Interaktionen & Follower-Entwicklung je Kanal',
  'Best-Performer: welche Formate/Beiträge liefen am besten',
  'Beste Posting-Zeiten als Empfehlung für den Redaktionsplan',
  'Import via Meta-/TikTok-API oder manuelle Kennzahl-Pflege',
]

export function Insights() {
  return (
    <>
      <PageHeader title="Insights" subtitle="Meta / TikTok Analytics" />
      <Card>
        <CardContent className="space-y-5 py-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <BarChart3 className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-lg tracking-wide">Bald verfügbar</p>
              <p className="text-sm text-muted-foreground">
                Auswertung der Social-Media-Kennzahlen — folgt in einer späteren Ausbaustufe.
              </p>
            </div>
            <Badge variant="secondary" className="ml-auto uppercase">
              Stub
            </Badge>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted-foreground">Geplanter Funktionsumfang</p>
            <ul className="space-y-1.5 text-sm">
              {GEPLANT.map((g) => (
                <li key={g} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </>
  )
}
