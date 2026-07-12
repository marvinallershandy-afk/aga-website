import { useMemo, useState } from 'react'
import {
  RefreshCw,
  FolderOpen,
  Film,
  ExternalLink,
  Pencil,
  HardDriveDownload,
} from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { StatusSelect } from '../components/ui/status'
import { useToast } from '../components/ui/toast'
import { ContentEditor } from '../components/ContentEditor'
import { DriveBrowser } from '../components/DriveBrowser'
import type { ContentRow, ContentInput } from '../lib/db'
import { useContent, useContentMutations } from '../lib/queries'
import { statusMeta, DRIVE_MASTER_FOLDER_ID, driveFolderUrl } from '../lib/constants'
import { formatDateShort } from '../lib/format'
import { cn } from '../lib/utils'

// Produktions-relevante Status (Rohschnitt → fertig). „idee" ist Vorstufe.
const PROD_STATUS = ['geplant', 'in_arbeit', 'fertig']

export function Produktion() {
  const toast = useToast()
  const contentQ = useContent()
  const { create, update, remove } = useContentMutations()
  const content = contentQ.data ?? []
  const loading = contentQ.isPending
  const [onlyProd, setOnlyProd] = useState(true)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<ContentRow | null>(null)

  const rows = useMemo(
    () => (onlyProd ? content.filter((r) => PROD_STATUS.includes(r.status)) : content),
    [content, onlyProd],
  )

  const changeStatus = (row: ContentRow, status: string) => {
    if (row.status === status) return
    update.mutate(
      { id: row.id, patch: { status } },
      {
        onSuccess: () => toast.success(`„${row.titel}" → ${statusMeta(status).label}`),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Status-Update fehlgeschlagen.'),
      },
    )
  }

  // Deckt jetzt auch die Neuanlage ab — vorher schlug „Neu" hier still fehl.
  const handleSave = async (input: ContentInput, id?: string) => {
    if (id) await update.mutateAsync({ id, patch: input })
    else await create.mutateAsync(input)
  }
  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id)
  }

  return (
    <>
      <PageHeader
        title="Produktion & Assets"
        subtitle="Vom Rohmaterial zum fertigen Reel — verlinkt mit Google Drive, ohne Kopien."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => void contentQ.refetch()} aria-label="Neu laden">
              <RefreshCw className={cn('h-4 w-4', contentQ.isFetching && 'animate-spin')} />
            </Button>
            <Button asChild variant="outline">
              <a href={driveFolderUrl(DRIVE_MASTER_FOLDER_ID)} target="_blank" rel="noopener noreferrer">
                <FolderOpen className="h-4 w-4" /> Drive öffnen
              </a>
            </Button>
          </div>
        }
      />

      {/* Drive-Bridge — Deep-Links + Live-Ansicht (Edge Function) */}
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between space-y-0 p-4">
          <CardTitle className="flex items-center gap-2 text-lg">
            <HardDriveDownload className="h-5 w-5 text-primary" /> Drive-Bridge
          </CardTitle>
          <Button asChild size="sm" variant="outline">
            <a href={driveFolderUrl(DRIVE_MASTER_FOLDER_ID)} target="_blank" rel="noopener noreferrer">
              <FolderOpen className="h-4 w-4" /> Master-Ordner
            </a>
          </Button>
        </CardHeader>
        <CardContent className="space-y-3 p-4 pt-0">
          <p className="text-sm text-muted-foreground">
            Der Admin <b>verlinkt</b> auf Google Drive — Dateien bleiben in Drive, hier wird nichts kopiert.
            Live-Ansicht: Ordner durchsuchen und Spieltag-Unterordner direkt hier anlegen.
          </p>
          <DriveBrowser rootId={DRIVE_MASTER_FOLDER_ID} rootName="Social-Media (Master)" />
        </CardContent>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="font-display text-lg tracking-wide">Produktions-Tracker</h2>
        <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
          <input
            type="checkbox"
            checked={onlyProd}
            onChange={(e) => setOnlyProd(e.target.checked)}
            className="h-4 w-4 accent-[hsl(var(--primary))]"
          />
          nur in Produktion
        </label>
      </div>

      {contentQ.error && !loading && (
        <ErrorState className="mb-4" message={contentQ.error.message} onRetry={() => void contentQ.refetch()} />
      )}

      {loading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Film}
          title={onlyProd ? 'Nichts in Produktion' : 'Keine Beiträge'}
          description="Beiträge im Status Geplant/In Arbeit/Fertig erscheinen hier mit ihren Drive-Ordnern."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Datum</th>
                <th className="px-3 py-2 font-medium">Titel</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Rohmaterial</th>
                <th className="px-3 py-2 font-medium">Asset</th>
                <th className="px-3 py-2 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateShort(r.geplant_am)}
                  </td>
                  <td className="px-3 py-2 font-medium">{r.titel}</td>
                  <td className="px-3 py-2">
                    <StatusSelect value={r.status} onChange={(s) => changeStatus(r, s)} />
                  </td>
                  <td className="px-3 py-2">
                    <DriveCell url={r.drive_rohmaterial_url} icon={FolderOpen} label="Ordner" />
                  </td>
                  <td className="px-3 py-2">
                    <DriveCell url={r.drive_asset_url} icon={Film} label="Asset" />
                  </td>
                  <td className="px-3 py-2 text-right">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setEditRow(r)
                        setEditorOpen(true)
                      }}
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ContentEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        row={editRow}
      />
    </>
  )
}

function DriveCell({
  url,
  icon: Icon,
  label,
}: {
  url: string | null
  icon: typeof FolderOpen
  label: string
}) {
  if (!url) return <span className="text-xs text-muted-foreground">—</span>
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
    >
      <Icon className="h-3.5 w-3.5" /> {label} <ExternalLink className="h-3 w-3" />
    </a>
  )
}
