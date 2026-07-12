import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus,
  RefreshCw,
  CalendarClock,
  Users,
  Pencil,
  PackagePlus,
  ImageIcon,
  Home,
  Bus,
  CheckCircle2,
} from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { Tabs } from '../components/ui/tabs'
import { useToast } from '../components/ui/toast'
import { SpielEditor } from '../components/SpielEditor'
import { SpielerEditor } from '../components/SpielerEditor'
import type { RosterInput, RosterRow, SpielInput, SpielRow } from '../lib/db'
import {
  useContent,
  useRoster,
  useRosterMutations,
  useSpiele,
  useSpieleMutations,
} from '../lib/queries'
import { formatAnstoss } from '../lib/format'
import { cn } from '../lib/utils'

type Tab = 'spiele' | 'kader'

export function Spiele() {
  const [tab, setTab] = useState<Tab>('spiele')
  return (
    <>
      <PageHeader
        title="Spiele & Kader"
        subtitle="Das Datenherz: Spieltage füttern Plan, Grafiken und Dashboard."
      />
      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'spiele', label: 'Spiele', icon: CalendarClock },
          { value: 'kader', label: 'Kader', icon: Users },
        ]}
      />
      {tab === 'spiele' ? <SpieleTab /> : <KaderTab />}
    </>
  )
}

// ── Spiele ──────────────────────────────────────────────────────────────────
function SpieleTab() {
  const toast = useToast()
  const spieleQ = useSpiele()
  const contentQ = useContent()
  const { create, update, remove, paket } = useSpieleMutations()
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<SpielRow | null>(null)

  const spiele = spieleQ.data ?? []
  const now = Date.now()
  const { anstehend, gespielt } = useMemo(() => {
    const a = spiele.filter((s) => new Date(s.anstoss).getTime() >= now)
    const g = spiele.filter((s) => new Date(s.anstoss).getTime() < now).reverse()
    return { anstehend: a, gespielt: g }
  }, [spiele, now])

  // Wie viele Plan-Beiträge hängen an einem Spiel? (aus dem geteilten Cache)
  const paketCount = (spielId: string) =>
    (contentQ.data ?? []).filter((c) => c.spiel_id === spielId).length

  const handleSave = async (input: SpielInput, id?: string) => {
    if (id) await update.mutateAsync({ id, patch: input })
    else await create.mutateAsync(input)
  }
  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id)
  }
  const handlePaket = (row: SpielRow) => {
    paket.mutate(row.id, {
      onSuccess: (rows) =>
        toast.success(`Spieltagspaket: ${rows.length} Beiträge im Redaktionsplan.`),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Paket fehlgeschlagen.'),
    })
  }

  const openNew = () => {
    setEditRow(null)
    setEditorOpen(true)
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Ein Klick aufs Paket legt Ankündigung, Aufstellung, Ergebnis & MOTM im Plan an.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => void spieleQ.refetch()} aria-label="Neu laden">
            <RefreshCw className={cn('h-4 w-4', spieleQ.isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Neues Spiel
          </Button>
        </div>
      </div>

      {spieleQ.error && !spieleQ.isPending && (
        <ErrorState className="mb-4" message={spieleQ.error.message} onRetry={() => void spieleQ.refetch()} />
      )}

      {spieleQ.isPending ? (
        <SkeletonRows rows={4} />
      ) : spiele.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="Noch keine Spiele"
          description="Lege den nächsten Spieltag an — daraus entstehen Paket-Beiträge und vorbefüllte Grafiken."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Neues Spiel
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          {anstehend.length > 0 && (
            <SpielSection
              title="Anstehend"
              rows={anstehend}
              paketCount={paketCount}
              onEdit={(r) => {
                setEditRow(r)
                setEditorOpen(true)
              }}
              onPaket={handlePaket}
            />
          )}
          {gespielt.length > 0 && (
            <SpielSection
              title="Gespielt"
              rows={gespielt}
              paketCount={paketCount}
              onEdit={(r) => {
                setEditRow(r)
                setEditorOpen(true)
              }}
              onPaket={handlePaket}
            />
          )}
        </div>
      )}

      <SpielEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        row={editRow}
      />
    </>
  )
}

function SpielSection({
  title,
  rows,
  paketCount,
  onEdit,
  onPaket,
}: {
  title: string
  rows: SpielRow[]
  paketCount: (id: string) => number
  onEdit: (r: SpielRow) => void
  onPaket: (r: SpielRow) => void
}) {
  return (
    <section>
      <h2 className="mb-2 font-display text-lg tracking-wide">{title}</h2>
      <div className="space-y-2">
        {rows.map((s) => {
          const n = paketCount(s.id)
          const hatErgebnis = s.tore_sva != null && s.tore_gegner != null
          return (
            <Card key={s.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-lg tracking-wide">
                      {s.heim ? `SVA vs. ${s.gegner}` : `${s.gegner} vs. SVA`}
                    </h3>
                    <Badge variant="outline" className="gap-1">
                      {s.heim ? <Home className="h-3 w-3" /> : <Bus className="h-3 w-3" />}
                      {s.heim ? 'Heim' : 'Auswärts'}
                    </Badge>
                    {hatErgebnis && (
                      <Badge variant="default" className="tabular-nums">
                        {s.heim ? `${s.tore_sva}:${s.tore_gegner}` : `${s.tore_gegner}:${s.tore_sva}`}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {formatAnstoss(s.anstoss)}
                    {s.ort ? ` · ${s.ort}` : ''}
                    {s.wettbewerb ? ` · ${s.wettbewerb}` : ''}
                    {s.spieltag_nr ? ` · ${s.spieltag_nr}. Spieltag` : ''}
                  </p>
                </div>

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {n > 0 ? (
                    <Badge variant="secondary" className="gap-1">
                      <CheckCircle2 className="h-3 w-3 text-green-500" /> Paket ({n})
                    </Badge>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => onPaket(s)}>
                      <PackagePlus className="h-4 w-4" /> Spieltagspaket
                    </Button>
                  )}
                  <Button asChild size="sm" variant="outline">
                    <Link to={`/matchday?spiel=${s.id}`} title="Grafik mit diesen Spieldaten">
                      <ImageIcon className="h-4 w-4" /> Grafik
                    </Link>
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => onEdit(s)} aria-label="Bearbeiten">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </section>
  )
}

// ── Kader ───────────────────────────────────────────────────────────────────
function KaderTab() {
  const toast = useToast()
  const rosterQ = useRoster()
  const { create, update, remove } = useRosterMutations()
  const roster = rosterQ.data ?? []
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<RosterRow | null>(null)

  const handleSave = async (input: RosterInput, id?: string) => {
    if (id) await update.mutateAsync({ id, patch: input })
    else await create.mutateAsync(input)
  }
  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id)
  }
  const toggleAktiv = (row: RosterRow) => {
    update.mutate(
      { id: row.id, patch: { aktiv: !row.aktiv } },
      { onError: (e) => toast.error(e instanceof Error ? e.message : 'Update fehlgeschlagen.') },
    )
  }

  const openNew = () => {
    setEditRow(null)
    setEditorOpen(true)
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Single Source für Aufstellungs-Grafiken, MOTM und (später) die Website-Spielerkarten.
        </p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => void rosterQ.refetch()} aria-label="Neu laden">
            <RefreshCw className={cn('h-4 w-4', rosterQ.isFetching && 'animate-spin')} />
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4" /> Neuer Spieler
          </Button>
        </div>
      </div>

      {rosterQ.error && !rosterQ.isPending && (
        <ErrorState className="mb-4" message={rosterQ.error.message} onRetry={() => void rosterQ.refetch()} />
      )}

      {rosterQ.isPending ? (
        <SkeletonRows rows={4} />
      ) : roster.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Kader ist leer"
          description="Lege Spieler mit Nummer, Position und Foto an — Grafiken und Steckbriefe greifen darauf zu."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Neuer Spieler
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {roster.map((p) => (
            <Card key={p.id} className={cn(!p.aktiv && 'opacity-55')}>
              <CardContent className="flex flex-col items-center gap-2 p-4 text-center">
                <PlayerAvatar row={p} />
                <div>
                  <p className="font-medium leading-tight">{p.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.nummer != null ? `#${p.nummer}` : ''}
                    {p.nummer != null && p.position ? ' · ' : ''}
                    {p.position ?? ''}
                  </p>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <button
                    onClick={() => toggleAktiv(p)}
                    className={cn(
                      'rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      p.aktiv ? 'bg-green-600/20 text-green-500' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {p.aktiv ? 'aktiv' : 'inaktiv'}
                  </button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setEditRow(p)
                      setEditorOpen(true)
                    }}
                    aria-label="Bearbeiten"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SpielerEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        row={editRow}
      />
    </>
  )
}

function PlayerAvatar({ row }: { row: RosterRow }) {
  if (row.foto_url) {
    return (
      <img
        src={row.foto_url}
        alt={row.name}
        className="h-16 w-16 rounded-full border-2 border-primary/60 object-cover"
        loading="lazy"
      />
    )
  }
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-primary/60 bg-muted font-display text-xl text-primary">
      {row.name.slice(0, 1).toUpperCase()}
    </div>
  )
}
