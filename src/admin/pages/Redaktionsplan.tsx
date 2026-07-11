import { useMemo, useState } from 'react'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Table2,
  CalendarRange,
  Columns3,
  RefreshCw,
  Search,
  FolderOpen,
  Film,
  CalendarDays,
} from 'lucide-react'
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { Tabs } from '../components/ui/tabs'
import { KanalIcons, StatusSelect } from '../components/ui/status'
import { useToast } from '../components/ui/toast'
import { ContentEditor } from '../components/ContentEditor'
import type { ContentRow, ContentInput } from '../lib/db'
import { useContent, useContentMutations } from '../lib/queries'
import { KANAELE, STATUS, KATEGORIEN } from '../lib/constants'
import {
  startOfWeek,
  addDays,
  weekDays,
  toISODate,
  isoWeekNumber,
  formatDateShort,
} from '../lib/format'
import { cn } from '../lib/utils'

type View = 'tabelle' | 'woche' | 'kanban'

const VIEW_TABS = [
  { value: 'tabelle', label: 'Tabelle', icon: Table2 },
  { value: 'woche', label: 'Woche', icon: CalendarRange },
  { value: 'kanban', label: 'Kanban', icon: Columns3 },
] as const

// Kleine Icons, die anzeigen, ob Drive-Links hinterlegt sind (öffnen im neuen Tab).
function DriveMarks({ row }: { row: ContentRow }) {
  const open = (url: string | null, e: React.MouseEvent) => {
    e.stopPropagation()
    if (url) window.open(url, '_blank', 'noopener')
  }
  return (
    <>
      {row.drive_rohmaterial_url && (
        <button
          onClick={(e) => open(row.drive_rohmaterial_url, e)}
          className="text-muted-foreground transition-colors hover:text-primary"
          title="Rohmaterial-Ordner öffnen"
          aria-label="Rohmaterial-Ordner öffnen"
        >
          <FolderOpen className="h-3.5 w-3.5" />
        </button>
      )}
      {row.drive_asset_url && (
        <button
          onClick={(e) => open(row.drive_asset_url, e)}
          className="text-muted-foreground transition-colors hover:text-primary"
          title="Fertiges Asset öffnen"
          aria-label="Fertiges Asset öffnen"
        >
          <Film className="h-3.5 w-3.5" />
        </button>
      )}
    </>
  )
}

export function Redaktionsplan() {
  const toast = useToast()
  const contentQ = useContent()
  const { create, update, remove } = useContentMutations()
  const content = contentQ.data ?? []
  const loading = contentQ.isPending
  const [view, setView] = useState<View>('tabelle')

  // Filter
  const [fKanal, setFKanal] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fKategorie, setFKategorie] = useState('')
  const [fSuche, setFSuche] = useState('')

  // Editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<ContentRow | null>(null)
  const [editDefaultDate, setEditDefaultDate] = useState<string | null>(null)

  // Wochenansicht
  const [weekRef, setWeekRef] = useState<Date>(() => new Date())

  const filtered = useMemo(() => {
    const q = fSuche.trim().toLowerCase()
    return content.filter((r) => {
      if (fKanal && !r.kanal?.includes(fKanal)) return false
      if (fStatus && r.status !== fStatus) return false
      if (fKategorie && r.kategorie !== fKategorie) return false
      if (q) {
        const hay = [r.titel, r.caption, r.hook, r.beschreibung, r.verantwortlich]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [content, fKanal, fStatus, fKategorie, fSuche])

  const openNew = (date?: string | null) => {
    setEditRow(null)
    setEditDefaultDate(date ?? null)
    setEditorOpen(true)
  }
  const openEdit = (row: ContentRow) => {
    setEditRow(row)
    setEditDefaultDate(null)
    setEditorOpen(true)
  }

  const handleSave = async (input: ContentInput, id?: string) => {
    if (id) await update.mutateAsync({ id, patch: input })
    else await create.mutateAsync(input)
  }
  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id)
  }

  // Inline-Status ändern (Tabelle & Kanban-Drop) — optimistisch mit Rollback
  // (Cache-Logik in queries.ts), hier nur Feedback.
  const changeStatus = (row: ContentRow, status: string) => {
    if (row.status === status) return
    update.mutate(
      { id: row.id, patch: { status } },
      {
        onSuccess: () => {
          const label = STATUS.find((s) => s.value === status)?.label ?? status
          toast.success(`„${row.titel}" → ${label}`)
        },
        onError: (e) =>
          toast.error(e instanceof Error ? e.message : 'Status-Update fehlgeschlagen.'),
      },
    )
  }

  const monday = startOfWeek(weekRef)
  const days = weekDays(monday)

  return (
    <>
      <PageHeader
        title="Redaktionsplan"
        subtitle="Beiträge planen, Status pflegen, nichts vergessen."
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => void contentQ.refetch()}
              aria-label="Neu laden"
              title="Neu laden"
            >
              <RefreshCw className={cn('h-4 w-4', contentQ.isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Neuer Beitrag
            </Button>
          </div>
        }
      />

      {/* Ansicht + Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs items={VIEW_TABS} value={view} onChange={setView} />

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={fSuche}
              onChange={(e) => setFSuche(e.target.value)}
              placeholder="Suche…"
              className="h-9 w-40 pl-8"
              aria-label="Beiträge durchsuchen"
            />
          </div>
          <Select value={fKanal} onChange={(e) => setFKanal(e.target.value)} className="h-9 w-auto">
            <option value="">Alle Kanäle</option>
            {KANAELE.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </Select>
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-9 w-auto">
            <option value="">Alle Status</option>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Select value={fKategorie} onChange={(e) => setFKategorie(e.target.value)} className="h-9 w-auto">
            <option value="">Alle Kategorien</option>
            {KATEGORIEN.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {contentQ.error && !loading && (
        <ErrorState
          className="mb-4"
          message={contentQ.error.message}
          onRetry={() => void contentQ.refetch()}
        />
      )}

      {loading ? (
        <SkeletonRows rows={6} className="mt-2" />
      ) : view === 'tabelle' ? (
        <TabelleView rows={filtered} onEdit={openEdit} onStatus={changeStatus} onAdd={() => openNew()} />
      ) : view === 'woche' ? (
        <WocheView
          days={days}
          rows={filtered}
          monday={monday}
          weekRef={weekRef}
          setWeekRef={setWeekRef}
          onEdit={openEdit}
          onAdd={openNew}
        />
      ) : (
        <KanbanView rows={filtered} onEdit={openEdit} onStatus={changeStatus} />
      )}

      <ContentEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        row={editRow}
        defaultDate={editDefaultDate}
      />
    </>
  )
}

// ── Tabelle ─────────────────────────────────────────────────────────────────
function TabelleView({
  rows,
  onEdit,
  onStatus,
  onAdd,
}: {
  rows: ContentRow[]
  onEdit: (r: ContentRow) => void
  onStatus: (r: ContentRow, s: string) => void
  onAdd?: () => void
}) {
  if (!rows.length) return <EmptyHint onAdd={onAdd} />
  return (
    <div className="overflow-x-auto rounded-lg border border-border">
      <table className="w-full min-w-[720px] text-sm">
        <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
          <tr>
            <th className="px-3 py-2 font-medium">Datum</th>
            <th className="px-3 py-2 font-medium">Titel</th>
            <th className="px-3 py-2 font-medium">Kanäle</th>
            <th className="px-3 py-2 font-medium">Format</th>
            <th className="px-3 py-2 font-medium">Kategorie</th>
            <th className="px-3 py-2 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.id}
              className="cursor-pointer border-b border-border/60 last:border-0 hover:bg-accent/50"
              onClick={() => onEdit(r)}
            >
              <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                {formatDateShort(r.geplant_am)}
              </td>
              <td className="px-3 py-2 font-medium">
                <span className="flex items-center gap-1.5">
                  {r.titel}
                  <DriveMarks row={r} />
                </span>
              </td>
              <td className="px-3 py-2">
                <KanalIcons kanaele={r.kanal ?? []} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.format ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.kategorie ?? '—'}</td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <StatusSelect value={r.status} onChange={(s) => onStatus(r, s)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Woche ───────────────────────────────────────────────────────────────────
function WocheView({
  days,
  rows,
  monday,
  weekRef,
  setWeekRef,
  onEdit,
  onAdd,
}: {
  days: ReturnType<typeof weekDays>
  rows: ContentRow[]
  monday: Date
  weekRef: Date
  setWeekRef: (d: Date) => void
  onEdit: (r: ContentRow) => void
  onAdd: (date: string) => void
}) {
  const todayIso = toISODate(new Date())
  const byDay = (iso: string) => rows.filter((r) => r.geplant_am === iso)
  const undated = rows.filter((r) => !r.geplant_am)

  return (
    <div>
      <div className="mb-3 flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => setWeekRef(addDays(weekRef, -7))} aria-label="Vorige Woche">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="text-sm font-medium">
          KW {isoWeekNumber(monday)} · {formatDateShort(toISODate(monday))} – {formatDateShort(toISODate(addDays(monday, 6)))}
        </div>
        <Button variant="outline" size="icon" onClick={() => setWeekRef(addDays(weekRef, 7))} aria-label="Nächste Woche">
          <ChevronRight className="h-4 w-4" />
        </Button>
        <Button variant="ghost" onClick={() => setWeekRef(new Date())} className="text-sm">
          Heute
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-7">
        {days.map((d) => (
          <div
            key={d.iso}
            className={cn(
              'flex min-h-[140px] flex-col rounded-lg border border-border p-2',
              d.iso === todayIso && 'border-primary/70 ring-1 ring-primary/40',
            )}
          >
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold">
                {d.dayLabel} <span className="text-muted-foreground">{d.label}</span>
              </span>
              <button
                onClick={() => onAdd(d.iso)}
                className="rounded p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Beitrag hinzufügen"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {byDay(d.iso).map((r) => (
                <ContentCard key={r.id} row={r} onEdit={onEdit} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {undated.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-2 text-sm font-semibold text-muted-foreground">Ohne Termin</h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {undated.map((r) => (
              <ContentCard key={r.id} row={r} onEdit={onEdit} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Kanban (dnd-kit: Maus + Touch) ─────────────────────────────────────────
function KanbanView({
  rows,
  onEdit,
  onStatus,
}: {
  rows: ContentRow[]
  onEdit: (r: ContentRow) => void
  onStatus: (r: ContentRow, s: string) => void
}) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const sensors = useSensors(
    // distance-Constraint lässt normale Klicks (Karte öffnen) durch.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Touch: kurz halten, dann ziehen — scrollt sonst normal weiter.
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 8 } }),
  )
  const activeRow = rows.find((r) => r.id === activeId) ?? null

  const onDragEnd = (e: DragEndEvent) => {
    const over = e.over?.id
    const row = rows.find((r) => r.id === String(e.active.id))
    if (row && typeof over === 'string' && row.status !== over) onStatus(row, over)
    setActiveId(null)
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={(e) => setActiveId(String(e.active.id))}
      onDragEnd={onDragEnd}
      onDragCancel={() => setActiveId(null)}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {STATUS.map((s) => (
          <KanbanColumn
            key={s.value}
            meta={s}
            rows={rows.filter((r) => r.status === s.value)}
            onEdit={onEdit}
          />
        ))}
      </div>
      {/* DragOverlay portalt nach <body> — admin-root-Klasse stellt die Design-Tokens sicher. */}
      <DragOverlay>
        {activeRow && (
          <div className="admin-root">
            <ContentCard row={activeRow} onEdit={() => {}} showDate />
          </div>
        )}
      </DragOverlay>
    </DndContext>
  )
}

function KanbanColumn({
  meta,
  rows,
  onEdit,
}: {
  meta: (typeof STATUS)[number]
  rows: ContentRow[]
  onEdit: (r: ContentRow) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: meta.value })
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex min-h-[200px] flex-col rounded-lg border border-border bg-muted/20 p-2 transition-colors',
        isOver && 'border-primary/70 bg-primary/5',
      )}
    >
      <div className="mb-2 flex items-center gap-1.5 px-1">
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: meta.dot }} />
        <span className="text-sm font-semibold">{meta.label}</span>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length}</span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        {rows.map((r) => (
          <DraggableCard key={r.id} row={r} onEdit={onEdit} />
        ))}
      </div>
    </div>
  )
}

function DraggableCard({ row, onEdit }: { row: ContentRow; onEdit: (r: ContentRow) => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: row.id })
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn('touch-manipulation', isDragging && 'opacity-40')}
    >
      <ContentCard row={row} onEdit={onEdit} showDate />
    </div>
  )
}

// ── Gemeinsame Karte ────────────────────────────────────────────────────────
// Bewusst KEIN <button>: enthält die DriveMarks-Buttons (verschachtelte
// Buttons sind invalides HTML) — stattdessen div mit role="button".
function ContentCard({
  row,
  onEdit,
  showDate,
}: {
  row: ContentRow
  onEdit: (r: ContentRow) => void
  showDate?: boolean
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onEdit(row)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onEdit(row)
        }
      }}
      className="w-full cursor-pointer rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-xs font-medium leading-snug">{row.titel}</span>
        <span className="flex shrink-0 items-center gap-1">
          <DriveMarks row={row} />
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {showDate && row.geplant_am && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {formatDateShort(row.geplant_am)}
          </Badge>
        )}
        {row.format && (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {row.format}
          </Badge>
        )}
        <KanalIcons kanaele={row.kanal ?? []} />
      </div>
    </div>
  )
}

function EmptyHint({ onAdd }: { onAdd?: () => void }) {
  return (
    <EmptyState
      icon={CalendarDays}
      title="Noch keine Beiträge"
      description="Für diese Filter gibt es nichts. Lege einen Beitrag an oder passe die Filter an."
      action={
        onAdd && (
          <Button onClick={onAdd}>
            <Plus className="h-4 w-4" /> Neuer Beitrag
          </Button>
        )
      }
    />
  )
}
