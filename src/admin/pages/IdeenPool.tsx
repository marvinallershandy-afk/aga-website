import { useState } from 'react'
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
import { ErrorState } from '../components/ui/error-state'
import { Tabs } from '../components/ui/tabs'
import { KanalIcons, StatusSelect } from '../components/ui/status'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { IdeeEditor } from '../components/IdeeEditor'
import { EingangEditor } from '../components/EingangEditor'
import type { IdeeRow, IdeeInput, EingangRow, EingangInput, EingangStatus } from '../lib/db'
import {
  useContentMutations,
  useEingang,
  useEingangMutations,
  useIdeen,
  useIdeenMutations,
} from '../lib/queries'
import { rhythmusLabel, EINGANG_STATUS } from '../lib/constants'
import { toISODate, formatDateShort } from '../lib/format'
import { cn } from '../lib/utils'

type Tab = 'bibliothek' | 'eingang'

export function IdeenPool() {
  const [tab, setTab] = useState<Tab>('bibliothek')
  // Zähler kommt direkt aus dem geteilten Query-Cache — kein State-Gefrickel
  // über onCount-Props mehr.
  const eingangQ = useEingang()
  const offen = (eingangQ.data ?? []).filter((r) => r.status === 'offen').length

  return (
    <>
      <PageHeader
        title="Ideen"
        subtitle="Format-Bibliothek und Team-Ideen — Triage bis in den Plan."
      />

      <Tabs
        className="mb-4"
        value={tab}
        onChange={setTab}
        items={[
          { value: 'bibliothek', label: 'Format-Bibliothek', icon: Library },
          {
            value: 'eingang',
            label: 'Ideen-Eingang',
            icon: Inbox,
            badge:
              offen > 0 ? (
                <span
                  className={cn(
                    'rounded-full px-1.5 text-[10px] font-semibold',
                    tab === 'eingang' ? 'bg-primary-foreground/20' : 'bg-primary/20 text-primary',
                  )}
                >
                  {offen}
                </span>
              ) : undefined,
          },
        ]}
      />

      {tab === 'bibliothek' ? <BibliothekTab /> : <EingangTab />}
    </>
  )
}

// ── Format-Bibliothek (sm_ideen_pool) ───────────────────────────────────────
function BibliothekTab() {
  const toast = useToast()
  const ideenQ = useIdeen()
  const { create, update, remove } = useIdeenMutations()
  const { create: createContentMut } = useContentMutations()
  const ideen = ideenQ.data ?? []
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<IdeeRow | null>(null)

  const handleSave = async (input: IdeeInput, id?: string) => {
    if (id) {
      await update.mutateAsync({ id, patch: input })
      toast.success('Idee aktualisiert.')
    } else {
      await create.mutateAsync(input)
      toast.success('Idee angelegt.')
    }
  }
  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id)
    toast.success('Idee gelöscht.')
  }

  const toggleAktiv = (row: IdeeRow) => {
    update.mutate(
      { id: row.id, patch: { aktiv: !row.aktiv } },
      { onError: (e) => toast.error(e instanceof Error ? e.message : 'Update fehlgeschlagen.') },
    )
  }

  const intoPlan = (row: IdeeRow) => {
    createContentMut.mutate(
      {
        titel: row.titel,
        beschreibung: row.beschreibung,
        kanal: row.kanal ?? [],
        kategorie: row.kategorie,
        status: 'geplant',
        geplant_am: toISODate(new Date()),
        idee_id: row.id,
      },
      {
        onSuccess: () => toast.success(`„${row.titel}" als geplanter Beitrag (heute) angelegt.`),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.'),
      },
    )
  }

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Wiederkehrende Formate — per Klick in den Plan.</p>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => void ideenQ.refetch()} aria-label="Neu laden">
            <RefreshCw className={cn('h-4 w-4', ideenQ.isFetching && 'animate-spin')} />
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

      {ideenQ.error && !ideenQ.isPending && (
        <ErrorState className="mb-4" message={ideenQ.error.message} onRetry={() => void ideenQ.refetch()} />
      )}

      {ideenQ.isPending ? (
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

                <div className="flex flex-wrap items-center gap-1.5">
                  {idee.kategorie && <Badge variant="default">{idee.kategorie}</Badge>}
                  <Badge variant="secondary">{rhythmusLabel(idee.rhythmus)}</Badge>
                  <KanalIcons kanaele={idee.kanal ?? []} />
                </div>

                <div className="mt-auto flex gap-2 pt-2">
                  {/* secondary statt Vollrot — neun rote Buttons pro Seite entwerten die Primärfarbe */}
                  <Button size="sm" variant="secondary" className="flex-1" onClick={() => intoPlan(idee)}>
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
    </>
  )
}

// ── Ideen-Eingang (sm_ideen_eingang) ────────────────────────────────────────
function EingangTab() {
  const navigate = useNavigate()
  const toast = useToast()
  const confirm = useConfirm()
  const eingangQ = useEingang()
  const { create, update, remove, intoPlan } = useEingangMutations()
  const rows = eingangQ.data ?? []
  const [fStatus, setFStatus] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<EingangRow | null>(null)

  const filtered = fStatus ? rows.filter((r) => r.status === fStatus) : rows

  const setStatus = (row: EingangRow, status: EingangStatus) => {
    if (row.status === status) return
    update.mutate(
      { id: row.id, patch: { status } },
      { onError: (e) => toast.error(e instanceof Error ? e.message : 'Status-Update fehlgeschlagen.') },
    )
  }

  const handleIntoPlan = (row: EingangRow) => {
    intoPlan.mutate(row, {
      onSuccess: () => toast.success(`„${row.titel}" in den Plan übernommen.`),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Übernehmen fehlgeschlagen.'),
    })
  }

  const handleRemove = async (row: EingangRow) => {
    const ok = await confirm({
      title: 'Idee löschen?',
      description: `„${row.titel}" wird aus dem Eingang entfernt.`,
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (!ok) return
    remove.mutate(row.id, {
      onSuccess: () => toast.success('Idee gelöscht.'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.'),
    })
  }

  const handleSave = async (input: EingangInput, id?: string) => {
    if (id) {
      await update.mutateAsync({ id, patch: input })
      toast.success('Idee aktualisiert.')
    } else {
      await create.mutateAsync({ ...input, status: 'offen' })
      toast.success('Idee im Eingang gespeichert.')
    }
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
          <Button variant="ghost" size="icon" onClick={() => void eingangQ.refetch()} aria-label="Neu laden">
            <RefreshCw className={cn('h-4 w-4', eingangQ.isFetching && 'animate-spin')} />
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

      {eingangQ.error && !eingangQ.isPending && (
        <ErrorState className="mb-4" message={eingangQ.error.message} onRetry={() => void eingangQ.refetch()} />
      )}

      {eingangQ.isPending ? (
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
            const done = row.status === 'uebernommen' || row.status === 'verworfen'
            return (
              <Card key={row.id} className={cn(done && 'opacity-70')}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-medium">{row.titel}</h3>
                    {row.beschreibung && (
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{row.beschreibung}</p>
                    )}
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                      {row.von && <span>von {row.von}</span>}
                      <span>· {formatDateShort(row.created_at.slice(0, 10))}</span>
                      <KanalIcons kanaele={row.kanal ?? []} />
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <StatusSelect
                      kind="eingang"
                      value={row.status}
                      onChange={(s) => setStatus(row, s as EingangStatus)}
                    />
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleIntoPlan(row)}
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
                    <Button size="sm" variant="ghost" onClick={() => handleRemove(row)} aria-label="Löschen">
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
