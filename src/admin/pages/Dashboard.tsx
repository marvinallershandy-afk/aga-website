import { Link } from 'react-router-dom'
import { CalendarDays, Lightbulb, Image as ImageIcon } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'
import { PageHeader } from './Placeholder'

const TILES = [
  {
    to: '/admin/redaktionsplan',
    icon: CalendarDays,
    title: 'Redaktionsplan',
    desc: 'Woche planen, Status pflegen, nichts vergessen.',
  },
  {
    to: '/admin/ideen',
    icon: Lightbulb,
    title: 'Ideen-Pool',
    desc: 'Wiederkehrende Formate → per Klick in den Plan.',
  },
  {
    to: '/admin/matchday',
    icon: ImageIcon,
    title: 'Matchday-Grafiken',
    desc: 'Ankündigung, Aufstellung, Ergebnis, MOTM als PNG.',
  },
]

export function Dashboard() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Willkommen im SVA-Social-Media-Cockpit. Wähle einen Bereich."
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => {
          const Icon = t.icon
          return (
            <Link key={t.to} to={t.to}>
              <Card className="h-full transition-colors hover:border-primary">
                <CardHeader>
                  <Icon className="mb-2 h-6 w-6 text-primary" />
                  <CardTitle>{t.title}</CardTitle>
                  <CardDescription>{t.desc}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0 text-sm text-muted-foreground">Öffnen →</CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </>
  )
}
