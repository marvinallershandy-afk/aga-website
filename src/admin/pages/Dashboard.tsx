import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarDays,
  Lightbulb,
  Image as ImageIcon,
  Plus,
  TrendingUp,
  Trophy,
  ArrowRight,
  CircleDot,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Skeleton } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { PageHeader } from './Placeholder'
import { useContent, useIdeen } from '../lib/queries'
import { STATUS, statusMeta, kanalLabel } from '../lib/constants'
import { startOfWeek, weekDays, toISODate, isoWeekNumber, formatDateShort } from '../lib/format'
import { cn } from '../lib/utils'

const QUICK = [
  { to: '/redaktionsplan', icon: Plus, label: 'Neuer Beitrag' },
  { to: '/matchday', icon: ImageIcon, label: 'Neue Grafik' },
]

export function Dashboard() {
  const contentQ = useContent()
  const ideenQ = useIdeen()
  const content = contentQ.data ?? []
  const ideen = ideenQ.data ?? []
  const loading = contentQ.isPending || ideenQ.isPending
  const loadError = contentQ.error ?? ideenQ.error

  const stats = useMemo(() => {
    const today = new Date()
    const todayIso = toISODate(today)
    const monday = startOfWeek(today)
    const weekIsos = weekDays(monday).map((d) => d.iso)
    const inWeek = content.filter((r) => r.geplant_am && weekIsos.includes(r.geplant_am))
    const heute = content.filter((r) => r.geplant_am === todayIso && r.status !== 'veroeffentlicht')
    const upcoming = content
      .filter((r) => r.geplant_am && r.geplant_am >= todayIso && r.status !== 'veroeffentlicht')
      .sort((a, b) => (a.geplant_am! < b.geplant_am! ? -1 : 1))
      .slice(0, 5)
    const offen = content.filter((r) => r.status !== 'veroeffentlicht').length
    const statusCounts = STATUS.map((s) => ({
      ...s,
      n: content.filter((r) => r.status === s.value).length,
    }))
    const latestIdeen = [...ideen]
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, 3)
    return { todayIso, monday, weekCount: inWeek.length, heute, upcoming, offen, statusCounts, latestIdeen }
  }, [content, ideen])

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Dein Cockpit für diese Woche — planen, produzieren, posten."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {QUICK.map((q) => {
              const Icon = q.icon
              return (
                <Button key={q.to} asChild variant={q.label === 'Neuer Beitrag' ? 'default' : 'outline'}>
                  <Link to={q.to}>
                    <Icon className="h-4 w-4" /> {q.label}
                  </Link>
                </Button>
              )
            })}
          </div>
        }
      />

      {loadError && !loading && (
        <ErrorState
          className="mb-4"
          message={loadError.message}
          onRetry={() => {
            void contentQ.refetch()
            void ideenQ.refetch()
          }}
        />
      )}

      {/* KPI-Reihe: mobil 2×2 statt vier gestapelter Karten */}
      <div className="mb-4 grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <StatTile
          label={`Diese Woche · KW ${isoWeekNumber(stats.monday)}`}
          value={loading ? null : stats.weekCount}
          hint="Beiträge geplant"
          icon={CalendarDays}
        />
        <StatTile label="Offen" value={loading ? null : stats.offen} hint="noch nicht veröffentlicht" icon={CircleDot} />
        <StatTile label="Heute fällig" value={loading ? null : stats.heute.length} hint="für heute geplant" icon={ArrowRight} />
        <StatTile label="Ideen im Pool" value={loading ? null : ideen.length} hint="Format-Bibliothek" icon={Lightbulb} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Anstehend */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-lg">Als Nächstes dran</CardTitle>
            <Link to="/redaktionsplan" className="text-sm text-primary hover:underline">
              Alle ansehen →
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : stats.upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarDays}
                title="Nichts geplant"
                description="Leg im Redaktionsplan Beiträge mit Termin an — sie tauchen dann hier auf."
                action={
                  <Button asChild size="sm">
                    <Link to="/redaktionsplan">
                      <Plus className="h-4 w-4" /> Beitrag planen
                    </Link>
                  </Button>
                }
              />
            ) : (
              <ul className="divide-y divide-border/60">
                {stats.upcoming.map((r) => (
                  <li key={r.id}>
                    <Link
                      to="/redaktionsplan"
                      className="flex items-center gap-3 py-2.5 transition-colors hover:bg-accent/40"
                    >
                      <div className="flex w-14 shrink-0 flex-col items-center rounded-md bg-muted/50 py-1">
                        <span className="text-xs font-semibold">
                          {r.geplant_am === stats.todayIso ? 'Heute' : formatDateShort(r.geplant_am).slice(0, 5)}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{r.titel}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {r.kanal?.map(kanalLabel).join(' · ') || 'kein Kanal'}
                          {r.format ? ` · ${r.format}` : ''}
                        </p>
                      </div>
                      <StatusDot status={r.status} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Status-Verteilung */}
        <Card>
          <CardHeader className="p-4">
            <CardTitle className="text-lg">Status-Verteilung</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 p-4 pt-0">
            {loading
              ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-6 w-full" />)
              : stats.statusCounts.map((s) => (
                  <div key={s.value} className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.dot }} />
                    <span className="text-sm">{s.label}</span>
                    <span className="ml-auto text-sm font-semibold tabular-nums text-muted-foreground">{s.n}</span>
                  </div>
                ))}
          </CardContent>
        </Card>
      </div>

      {/* Untere Reihe: Ideen + Platzhalter-Widgets */}
      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-lg">Neueste Ideen</CardTitle>
            <Link to="/ideen" className="text-sm text-primary hover:underline">
              Pool →
            </Link>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {loading ? (
              <div className="space-y-2">
                {[0, 1, 2].map((i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : stats.latestIdeen.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">Noch keine Ideen.</p>
            ) : (
              <ul className="space-y-2">
                {stats.latestIdeen.map((i) => (
                  <li key={i.id} className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 shrink-0 text-sva-gold" />
                    <span className="truncate text-sm">{i.titel}</span>
                    {i.kanal?.[0] && (
                      <Badge variant="outline" className="ml-auto shrink-0 px-1.5 py-0 text-[10px]">
                        {kanalLabel(i.kanal[0])}
                      </Badge>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* KPI-Snapshot — Platzhalter bis Insights (P6) */}
        <PlaceholderCard
          icon={TrendingUp}
          title="Reichweite & Follower"
          note="KPI-Snapshot kommt mit dem Insights-Modul (Meta/TikTok-Anbindung)."
          badge="bald"
        />

        {/* Matchday-Countdown — Platzhalter bis Website-Steuerung (P7) */}
        <PlaceholderCard
          icon={Trophy}
          title="Nächstes Spiel"
          note="Countdown & Gegner erscheinen hier, sobald die Spieldaten angebunden sind."
          badge="bald"
          to="/matchday"
          toLabel="Zum Grafik-Generator"
        />
      </div>
    </>
  )
}

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
}: {
  label: string
  value: number | null
  hint: string
  icon: typeof CalendarDays
}) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          {value === null ? (
            <Skeleton className="mt-1 h-6 w-10" />
          ) : (
            <p className="text-2xl font-display leading-tight tabular-nums">{value}</p>
          )}
          <p className="truncate text-[11px] text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function StatusDot({ status }: { status: string }) {
  const m = statusMeta(status)
  return (
    <span className="flex shrink-0 items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: m.dot }} />
      <span className="hidden text-xs text-muted-foreground sm:inline">{m.label}</span>
    </span>
  )
}

function PlaceholderCard({
  icon: Icon,
  title,
  note,
  badge,
  to,
  toLabel,
}: {
  icon: typeof TrendingUp
  title: string
  note: string
  badge?: string
  to?: string
  toLabel?: string
}) {
  return (
    <Card className="border-dashed">
      <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className="h-5 w-5 text-muted-foreground" /> {title}
        </CardTitle>
        {badge && (
          <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
            {badge}
          </span>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0">
        <p className="text-sm text-muted-foreground">{note}</p>
        {to && (
          <Link
            to={to}
            className={cn('mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline')}
          >
            {toLabel} <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </CardContent>
    </Card>
  )
}
