import { useState } from 'react'
import {
  FolderOpen,
  Folder,
  File as FileIcon,
  ExternalLink,
  ChevronRight,
  FolderPlus,
  RefreshCw,
  Loader2,
  AlertTriangle,
} from 'lucide-react'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { useToast } from './ui/toast'
import { driveList, driveCreateFolder, isFolder, type DriveFile } from '../lib/drive'
import { cn } from '../lib/utils'

interface Crumb {
  id: string
  name: string
}

export function DriveBrowser({ rootId, rootName }: { rootId: string; rootName: string }) {
  const toast = useToast()
  const [stack, setStack] = useState<Crumb[]>([{ id: rootId, name: rootName }])
  const [files, setFiles] = useState<DriveFile[]>([])
  const [state, setState] = useState<'idle' | 'loading' | 'ready' | 'unconfigured' | 'error'>('idle')
  const [errMsg, setErrMsg] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')

  const current = stack[stack.length - 1]

  const load = async (folderId: string) => {
    setState('loading')
    try {
      const res = await driveList(folderId)
      if (!res.configured) {
        setState('unconfigured')
        return
      }
      setFiles(res.files ?? [])
      setState('ready')
    } catch (e) {
      setErrMsg(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
      setState('error')
    }
  }

  const openRoot = () => {
    setStack([{ id: rootId, name: rootName }])
    load(rootId)
  }
  const enter = (f: DriveFile) => {
    setStack((s) => [...s, { id: f.id, name: f.name }])
    load(f.id)
  }
  const goTo = (idx: number) => {
    const c = stack[idx]
    setStack((s) => s.slice(0, idx + 1))
    load(c.id)
  }

  const createFolder = async () => {
    const name = newName.trim()
    if (!name) return
    setCreating(true)
    try {
      await driveCreateFolder(current.id, name)
      toast.success(`Ordner „${name}" angelegt.`)
      setNewName('')
      await load(current.id)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.')
    } finally {
      setCreating(false)
    }
  }

  // Startzustand: erst auf Klick laden (spart unnötige Function-Calls).
  if (state === 'idle') {
    return (
      <Button variant="outline" size="sm" onClick={openRoot}>
        <FolderOpen className="h-4 w-4" /> Live-Ansicht laden
      </Button>
    )
  }

  if (state === 'unconfigured') {
    return (
      <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-sva-gold" />
        <div>
          <p className="font-medium text-foreground">Drive-Zugang noch nicht eingerichtet</p>
          <p className="mt-0.5">
            Die Live-Ansicht ist deployt, aber die Server-Secrets für Google Drive fehlen noch. Sobald
            sie gesetzt sind (siehe Bericht), erscheinen hier Ordner &amp; Dateien.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border">
      {/* Breadcrumb + Aktionen */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border p-2 text-sm">
        {stack.map((c, i) => (
          <span key={c.id} className="flex items-center">
            {i > 0 && <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-muted-foreground" />}
            <button
              onClick={() => goTo(i)}
              className={cn(
                'rounded px-1.5 py-0.5 hover:bg-accent',
                i === stack.length - 1 ? 'font-medium text-foreground' : 'text-muted-foreground',
              )}
            >
              {c.name}
            </button>
          </span>
        ))}
        <Button
          variant="ghost"
          size="icon"
          className="ml-auto h-7 w-7"
          onClick={() => load(current.id)}
          aria-label="Neu laden"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', state === 'loading' && 'animate-spin')} />
        </Button>
      </div>

      {/* Ordner-anlegen-Zeile */}
      <div className="flex items-center gap-2 border-b border-border p-2">
        <FolderPlus className="h-4 w-4 shrink-0 text-muted-foreground" />
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && createFolder()}
          placeholder={`Neuer Ordner in „${current.name}“…`}
          className="h-8 text-sm"
        />
        <Button size="sm" onClick={createFolder} disabled={creating || !newName.trim()}>
          {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Anlegen'}
        </Button>
      </div>

      {/* Inhalt */}
      {state === 'loading' ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Lädt…
        </div>
      ) : state === 'error' ? (
        <div className="flex items-start gap-2 p-3 text-sm text-primary">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> {errMsg}
        </div>
      ) : files.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Ordner ist leer.</p>
      ) : (
        <ul className="max-h-80 overflow-y-auto">
          {files.map((f) => (
            <li key={f.id} className="flex items-center gap-2 border-b border-border/40 px-3 py-2 last:border-0">
              {isFolder(f) ? (
                <button onClick={() => enter(f)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <Folder className="h-4 w-4 shrink-0 text-sva-gold" />
                  <span className="truncate text-sm hover:underline">{f.name}</span>
                </button>
              ) : (
                <span className="flex min-w-0 flex-1 items-center gap-2">
                  <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="truncate text-sm">{f.name}</span>
                </span>
              )}
              {f.webViewLink && (
                <a
                  href={f.webViewLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 text-muted-foreground hover:text-primary"
                  aria-label="In Drive öffnen"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
