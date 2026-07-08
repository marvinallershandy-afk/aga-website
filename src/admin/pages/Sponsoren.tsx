import { Handshake } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Card, CardContent } from '../components/ui/card'
import { Badge } from '../components/ui/badge'

// Phase-4-Stub (dokumentiert): Tabelle sm_sponsoren existiert bereits mit RLS,
// die CRM-Oberfläche folgt in einer späteren Ausbaustufe.
const GEPLANT = [
  'Sponsoren anlegen & pflegen (Name, Ansprechpartner, Kontakt, Logo)',
  'Pakete (Gold / Silber / Bronze) mit Laufzeit von–bis',
  'Vereinbarte Leistungen & Erinnerungen vor Vertragsende',
  'Verknüpfung mit dem Format „Sponsor des Monats" im Redaktionsplan',
]

export function Sponsoren() {
  return (
    <>
      <PageHeader title="Sponsoren-CRM" subtitle="Pakete, Laufzeiten, Leistungen" />
      <Card>
        <CardContent className="space-y-5 py-8">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/15 text-primary">
              <Handshake className="h-6 w-6" />
            </span>
            <div>
              <p className="font-display text-lg tracking-wide">Bald verfügbar</p>
              <p className="text-sm text-muted-foreground">
                Datenbank steht bereits: Tabelle <code className="text-primary">sm_sponsoren</code> (RLS aktiv, leer).
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
