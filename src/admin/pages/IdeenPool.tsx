import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Plus,
  CalendarPlus,
  Pencil,
  RefreshCw,
  Library,
  Inbox,
  Trash2,
  Lightbulb,
} from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { IdeeEditor } from '../components/IdeeEditor'
import { EingangEditor } from '../components/EingangEditor'
import {
  fetchIdeen,
  createIdee,
  updateIdee,
  deleteIdee,
  createContent,
  fetchEingang,
  createEingang,
  updateEingang,
  deleteEingang,
  eingangIntoPlan,
  type IdeeRow,
  type IdeeInput,
  type EingangRow,
  type EingangInput,
  type EingangStatus,
} from '../lib/db'
import { kanalLabel, rhythmusLabel, EINGANG_STATUS, eingangStatusMeta } from '../lib/constants'
import { toISODate, formatDateShort } from '../lib/format'
import { cn } from '../lib/utils'

type Tab = 'bibliothek' | 'eingang'

export function IdeenPool() {
  const [tab, setTab] = useState<Tab>('bibliothek')
  const [eingangCount, setEingangCount] = useState<number | null>(null)

  return (
    <>
      <PageHeader
        title="Ideen"
        subtitle="Format-Bibliothek und Team-Ideen — Triage bis in den Plan."
      />

      <div className="mb-4 flex overflow-hidden rounded-md border border-border">
        {(
          [
            { v: 'bibliothek', label: 'Format-Bibliothek', icon: Library },
            { v: 'eingang', label: 'Ideen-Eingang', icon: Inbox },
          ] as const
        ).map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.v}
              onClick={() => setTab(t.v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors',
                tab === t.v ? 'bg-primary text-primary-foreground' : 'hover:bg-accent',
              )}
            >
              <Icon className="h-4 w-4" /> {t.label}
              {t.v === 'eingang' && eingangCount != null && eingangCount > 0 && (
                <span
                  className={cn(
                    'ml-1 rounded-full px-1.5 text-[10px] font-semibold',
                    tab === t.v ? 'bg-primary-foreground/20' : 'bg-primary/20 text-primary',
                  )}
                >
                  {eingangCount}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {tab === 'bibliothek' ? <BibliothekTab /> : <EingangTab onCount={setEingangCount} />}
    </>
  )
}

// ── Format-Bibliothek (sm_ideen_pool) ───────────────────────────────────────
function BibliothekTab() {
  const navigate = useNavigate()
  const toast = useToast()
  const [ideen, setIdeen] = useState<IdeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<IdeeRow | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      setIdeen(await fetchIdeen())
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const handleSave = async (input: IdeeInput, id?: string) => {
    if (id) {
      const updated = await updateIdee(id, input)
      setIdeen((prev) => prev.map((r) => (r.id === id ? updated : r)))
      toast.success('Idee aktualisiert.')
    } else {
      const created = await createIdee(input)
      setIdeen((prev) => [...prev, created])
      toast.success('Idee angelegt.')
    }
  }
  const handleDelete = async (id: string) => {
    await deleteIdee(id)
    setIdeen((prev) => prev.filter((r) => r.id !== id))
    toast.success('Idee gelöscht.')
  }

  const toggleAktiv = async (row: IdeeRow) => {
    const prev = ideen
    setIdeen((list) => list.map((r) => (r.id === row.id ? { ...r, aktiv: !r.aktiv } : r)))
    try {
      await updateIdee(row.id, { aktiv: !row.aktiv })
    } catch (e) {
      setIdeen(prev)
      toast.error(e instanceof Error ? e.message : 'Update fehlgeschlagen.')
    }
  }

  const intoPlan = async (row: IdeeRow) => {
    try {
      await createContent({
        titel: row.titel,
        beschreibung: row.beschreibung,
        kanal: row.kanal ?? [],
        kategorie: row.kategorie,
        status: 'geplant',
        geplant_am: toISODate(new Date()),
        idee_id: row.id,
      })
      toast.success(`„${row.titel}" als geplanter Beitrag (heute) angelegt.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.')
    }
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Wiederkehrende Formate — per Klick in den Plan.</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={load} aria-label="Neu laden">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button
            onClick={() => {
              setEditRow(null)
              setEditorOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Neue Idee
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : ideen.length === 0 ? (
        <EmptyState
          icon={Library}
          title="Bibliothek ist leer"
          description="Sammle hier wiederkehrende Content-Formate, die du per Klick in den Plan holst."
          action={
            <Button
              onClick={() => {
                setEditRow(null)
                setEditorOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> Neue Idee
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ideen.map((idee) => (
            <Card key={idee.id} className={cn('flex flex-col', !idee.aktiv && 'opacity-55')}>
              <CardContent className="flex flex-1 flex-col gap-3 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-display text-lg leading-tight tracking-wide">{idee.titel}</h3>
                  <button
                    onClick={() => toggleAktiv(idee)}
                    title={idee.aktiv ? 'Aktiv — klicken zum Deaktivieren' : 'Inaktiv — klicken zum Aktivieren'}
                    className={cn(
                      'mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                      idee.aktiv ? 'bg-green-600/20 text-green-500' : 'bg-secondary text-muted-foreground',
                    )}
                  >
                    {idee.aktiv ? 'aktiv' : 'inaktiv'}
                  </button>
                </div>

                {idee.beschreibung && (
                  <p className="line-clamp-3 text-sm text-muted-foreground">{idee.beschreibung}</p>
                )}

                <div className="flex flex-wrap gap-1.5">
                  {idee.kategorie && <Badge variant="default">{idee.kategorie}</Badge>}
                  <Badge variant="secondary">{rhythmusLabel(idee.rhythmus)}</Badge>
                  {idee.kanal?.map((k) => (
                    <Badge key={k} variant="outline" className="text-[10px]">
                      {kanalLabel(k)}
                    </Badge>
                  ))}
                </div>

                <div className="mt-auto flex gap-2 pt-2">
                  <Button size="sm" className="flex-1" onClick={() => intoPlan(idee)}>
                    <CalendarPlus className="h-4 w-4" /> In den Plan
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      setEditRow(idee)
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

      <IdeeEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        row={editRow}
      />
      {/* navigate für „Zum Plan" aus Toast-losen Kontexten reserviert */}
      <span className="hidden" onClick={() => navigate('/redaktionsplan')} />
    </>
  )
}

// ── Ideen-Eingang (sm_ideen_eingang) ────────────────────────────────────────
function EingangTab({ onCount }: { onCount: (n: number) => void }) {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const [rows, setRows] = useState<EingangRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fStatus, setFStatus] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<EingangRow | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await fetchEingang()
      setRows(data)
      onCount(data.filter((r) => r.status === 'offen').length)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const filtered = fStatus ? rows.filter((r) => r.status === fStatus) : rows

  const setStatus = async (row: EingangRow, status: EingangStatus) => {
    if (row.status === status) return
    const prev = rows
    setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status } : r)))
    onCount((fStatus ? rows : rows).filter((r) => (r.id === row.id ? status : r.status) === 'offen').length)
    try {
      await updateEingang(row.id, { status })
    } catch (e) {
      setRows(prev)
      toast.error(e instanceof Error ? e.message : 'Status-Update fehlgeschlagen.')
    }
  }

  const intoPlan = async (row: EingangRow) => {
    try {
      await eingangIntoPlan(row)
      setRows((list) => list.map((r) => (r.id === row.id ? { ...r, status: 'uebernommen' } : r)))
      toast.success(`„${row.titel}" in den Plan übernommen.`)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Übernehmen fehlgeschlagen.')
    }
  }

  const remove = async (row: EingangRow) => {
    const ok = await confirm({
      title: 'Idee löschen?',
      description: `„${row.titel}" wird aus dem Eingang entfernt.`,
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (!ok) return
    const prev = rows
    setRows((list) => list.filter((r) => r.id !== row.id))
    try {
      await deleteEingang(row.id)
      toast.success('Idee gelöscht.')
    } catch (e) {
      setRows(prev)
      toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
    }
  }

  const handleSave = async (input: EingangInput, id?: string) => {
    if (id) {
      const updated = await updateEingang(id, input)
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)))
      toast.success('Idee aktualisiert.')
    } else {
      const created = await createEingang({ ...input, status: 'offen' })
      setRows((prev) => [created, ...prev])
      toast.success('Idee im Eingang gespeichert.')
    }
    load()
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Team-Ideen sammeln, prüfen und in den Plan übernehmen.
        </p>
        <div className="flex items-center gap-2">
          <Select value={fStatus} onChange={(e) => setFStatus(e.target.value)} className="h-9 w-auto">
            <option value="">Alle</option>
            {EINGANG_STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
          <Button variant="ghost" size="icon" onClick={load} aria-label="Neu laden">
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
          <Button
            onClick={() => {
              setEditRow(null)
              setEditorOpen(true)
            }}
          >
            <Plus className="h-4 w-4" /> Neue Idee
          </Button>
        </div>
      </div>

      {loading ? (
        <SkeletonRows rows={4} />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={fStatus ? 'Nichts in diesem Status' : 'Eingang ist leer'}
          description="Ideen vom Team (z. B. von Nico) landen hier. Von hier aus prüfen und in den Plan holen."
          action={
            <Button
              onClick={() => {
                setEditRow(null)
                setEditorOpen(true)
              }}
            >
              <Plus className="h-4 w-4" /> Idee erfassen
            </Button>
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const meta = eingangStatusMeta(row.status)
            const done = row.status === 'uebernommen' || row.status === 'verworfen'
            return (
              <Card key={row.id} className={cn(done && 'opacity-70')}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: meta.dot }} />
                      <h3 className="truncate font-medium">{row.titel}</h3>
                    </div>
                    {row.beschreibung && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{row.beschreibung}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {row.von && <span>von {row.von}</span>}
                      <span>· {formatDateShort(row.created_at.slice(0, 10))}</span>
                      {row.kanal?.map((k) => (
                        <Badge key={k} variant="outline" className="px-1.5 py-0 text-[10px]">
                          {kanalLabel(k)}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <Select
                      value={row.status}
                      onChange={(e) => setStatus(row, e.target.value as EingangStatus)}
                      className="h-8 w-auto min-w-[120px] text-xs"
                      aria-label="Status"
                    >
                      {EINGANG_STATUS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                    <Button
                      size="sm"
                      onClick={() => intoPlan(row)}
                      disabled={row.status === 'uebernommen'}
                      title={row.status === 'uebernommen' ? 'Bereits übernommen' : 'In den Redaktionsplan'}
                    >
                      <CalendarPlus className="h-4 w-4" /> In den Plan
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditRow(row)
                        setEditorOpen(true)
                      }}
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => remove(row)} aria-label="Löschen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {rows.some((r) => r.status === 'uebernommen') && (
        <button
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
          onClick={() => navigate('/redaktionsplan')}
        >
          <Lightbulb className="h-3.5 w-3.5" /> Übernommene Ideen im Redaktionsplan ansehen →
        </button>
      )}

      <EingangEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        row={editRow}
      />
    </>
  )
}
