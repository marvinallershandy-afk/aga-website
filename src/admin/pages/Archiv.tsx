import { Link } from 'react-router-dom'
import {
  LayoutDashboard,
  CalendarDays,
  Lightbulb,
  Clapperboard,
  Image as ImageIcon,
  BarChart3,
  Zap,
  Handshake,
  ChevronRight,
} from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Card, CardContent } from '../components/ui/card'

// v14-C: Die Social-Media-Module aus der ersten Admin-Phase. Nicht gelöscht,
// nur aus der Hauptnavigation genommen — Routen und Daten bleiben unverändert.
const MODULE = [
  { to: '/social', label: 'Social-Dashboard', text: 'Wochenstatistik, fällige Beiträge', icon: LayoutDashboard },
  { to: '/redaktionsplan', label: 'Redaktionsplan', text: 'Beiträge planen, Kanban', icon: CalendarDays },
  { to: '/ideen', label: 'Ideen', text: 'Format-Bibliothek und Team-Eingang', icon: Lightbulb },
  { to: '/produktion', label: 'Produktion & Assets', text: 'Produktions-Board, Google Drive', icon: Clapperboard },
  { to: '/matchday', label: 'Matchday-Grafiken', text: 'Spieltags-Grafiken als PNG', icon: ImageIcon },
  { to: '/insights', label: 'Insights', text: 'Kanal-Kennzahlen von Hand', icon: BarChart3 },
  { to: '/automationen', label: 'Automationen', text: 'n8n-Webhooks', icon: Zap },
  { to: '/sponsoren-crm', label: 'Sponsoren-CRM', text: 'Pakete, Laufzeiten, Sponsor des Monats', icon: Handshake },
] as const

export function Archiv() {
  return (
    <>
      <PageHeader
        title="Archiv: Social Media"
        subtitle="Werkzeuge aus der Social-Media-Phase. Sie funktionieren weiter, sind für die Website-Pflege aber nicht nötig."
      />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {MODULE.map((m) => {
          const Icon = m.icon
          return (
            <Link key={m.to} to={m.to} className="group">
              <Card className="transition-colors group-hover:border-primary/50">
                <CardContent className="flex items-center gap-3 p-4">
                  <Icon className="h-5 w-5 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{m.label}</p>
                    <p className="text-sm text-muted-foreground">{m.text}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
