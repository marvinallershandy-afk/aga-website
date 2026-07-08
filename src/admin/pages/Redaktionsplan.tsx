import { useEffect, useMemo, useState } from 'react'
import { Plus, ChevronLeft, ChevronRight, Table2, CalendarRange, Columns3, RefreshCw } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Select } from '../components/ui/select'
import { Badge } from '../components/ui/badge'
import { ContentEditor } from '../components/ContentEditor'
import {
  fetchContent,
  createContent,
  updateContent,
  deleteContent,
  type ContentRow,
  type ContentInput,
} from '../lib/db'
import { KANAELE, STATUS, KATEGORIEN, kanalLabel } from '../lib/constants'
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

function KanalDots({ kanal }: { kanal: string[] }) {
  if (!kanal?.length) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {kanal.map((k) => (
        <Badge key={k} variant="outline" className="px-1.5 py-0 text-[10px]">
          {kanalLabel(k)}
        </Badge>
      ))}
    </div>
  )
}

export function Redaktionsplan() {
  const [content, setContent] = useState<ContentRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<View>('tabelle')

  // Filter
  const [fKanal, setFKanal] = useState('')
  const [fStatus, setFStatus] = useState('')
  const [fKategorie, setFKategorie] = useState('')

  // Editor
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<ContentRow | null>(null)
  const [editDefaultDate, setEditDefaultDate] = useState<string | null>(null)

  // Wochenansicht
  const [weekRef, setWeekRef] = useState<Date>(() => new Date())

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setContent(await fetchContent())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(
    () =>
      content.filter(
        (r) =>
          (!fKanal || r.kanal?.includes(fKanal)) &&
          (!fStatus || r.status === fStatus) &&
          (!fKategorie || r.kategorie === fKategorie),
      ),
    [content, fKanal, fStatus, fKategorie],
  )

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
    if (id) {
      const updated = await updateContent(id, input)
      setContent((prev) => prev.map((r) => (r.id === id ? updated : r)))
    } else {
      const created = await createContent(input)
      setContent((prev) => [...prev, created])
    }
  }
  const handleDelete = async (id: string) => {
    await deleteContent(id)
    setContent((prev) => prev.filter((r) => r.id !== id))
  }

  // Inline-Status ändern (Tabelle & Kanban-Drop)
  const changeStatus = async (row: ContentRow, status: string) => {
    if (row.status === status) return
    const prev = content
    setContent((c) => c.map((r) => (r.id === row.id ? { ...r, status } : r)))
    try {
      await updateContent(row.id, { status })
    } catch (e) {
      setContent(prev) // Rollback
      setError(e instanceof Error ? e.message : 'Status-Update fehlgeschlagen.')
    }
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
            <Button variant="ghost" size="icon" onClick={load} aria-label="Neu laden" title="Neu laden">
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </Button>
            <Button onClick={() => openNew()}>
              <Plus className="h-4 w-4" /> Neuer Beitrag
            </Button>
          </div>
        }
      />

      {/* Ansicht + Filter */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex overflow-hidden rounded-md border border-border">
          {(
            [
              { v: 'tabelle', label: 'Tabelle', icon: Table2 },
              { v: 'woche', label: 'Woche', icon: CalendarRange },
              { v: 'kanban', label: 'Kanban', icon: Columns3 },
            ] as const
          ).map((t) => {
            const Icon = t.icon
            return (
              <button
                key={t.v}
                onClick={() => setView(t.v)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                  view === t.v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
                )}
              >
                <Icon className="h-4 w-4" /> {t.label}
              </button>
            )
          })}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
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

      {error && (
        <div className="mb-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Lädt…</p>
      ) : view === 'tabelle' ? (
        <TabelleView rows={filtered} onEdit={openEdit} onStatus={changeStatus} />
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
}: {
  rows: ContentRow[]
  onEdit: (r: ContentRow) => void
  onStatus: (r: ContentRow, s: string) => void
}) {
  if (!rows.length) return <EmptyHint />
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
              <td className="px-3 py-2 font-medium">{r.titel}</td>
              <td className="px-3 py-2">
                <KanalDots kanal={r.kanal} />
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.format ?? '—'}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.kategorie ?? '—'}</td>
              <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                <Select
                  value={r.status}
                  onChange={(e) => onStatus(r, e.target.value)}
                  className="h-8 w-auto min-w-[130px] text-xs"
                >
                  {STATUS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </Select>
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

// ── Kanban ──────────────────────────────────────────────────────────────────
function KanbanView({
  rows,
  onEdit,
  onStatus,
}: {
  rows: ContentRow[]
  onEdit: (r: ContentRow) => void
  onStatus: (r: ContentRow, s: string) => void
}) {
  const [dragId, setDragId] = useState<string | null>(null)
  const [overCol, setOverCol] = useState<string | null>(null)

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3 xl:grid-cols-5">
      {STATUS.map((s) => {
        const colRows = rows.filter((r) => r.status === s.value)
        return (
          <div
            key={s.value}
            onDragOver={(e) => {
              e.preventDefault()
              setOverCol(s.value)
            }}
            onDragLeave={() => setOverCol((c) => (c === s.value ? null : c))}
            onDrop={() => {
              const row = rows.find((r) => r.id === dragId)
              if (row) onStatus(row, s.value)
              setDragId(null)
              setOverCol(null)
            }}
            className={cn(
              'flex min-h-[200px] flex-col rounded-lg border border-border bg-muted/20 p-2 transition-colors',
              overCol === s.value && 'border-primary/70 bg-primary/5',
            )}
          >
            <div className="mb-2 flex items-center gap-1.5 px-1">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.dot }} />
              <span className="text-sm font-semibold">{s.label}</span>
              <span className="ml-auto text-xs text-muted-foreground">{colRows.length}</span>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {colRows.map((r) => (
                <div
                  key={r.id}
                  draggable
                  onDragStart={() => setDragId(r.id)}
                  onDragEnd={() => setDragId(null)}
                >
                  <ContentCard row={r} onEdit={onEdit} showDate />
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Gemeinsame Karte ────────────────────────────────────────────────────────
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
    <button
      onClick={() => onEdit(row)}
      className="w-full rounded-md border border-border bg-card p-2 text-left transition-colors hover:border-primary/60"
    >
      <div className="mb-1 flex items-start justify-between gap-2">
        <span className="line-clamp-2 text-xs font-medium leading-snug">{row.titel}</span>
      </div>
      <div className="flex flex-wrap items-center gap-1">
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
        <KanalDots kanal={row.kanal} />
      </div>
    </button>
  )
}

function EmptyHint() {
  return (
    <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
      Keine Beiträge für diese Filter. Lege oben rechts einen neuen an.
    </div>
  )
}
