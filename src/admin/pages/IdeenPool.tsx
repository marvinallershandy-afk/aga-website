import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, CalendarPlus, Pencil, RefreshCw } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { IdeeEditor } from '../components/IdeeEditor'
import {
  fetchIdeen,
  createIdee,
  updateIdee,
  deleteIdee,
  createContent,
  type IdeeRow,
  type IdeeInput,
} from '../lib/db'
import { kanalLabel, rhythmusLabel } from '../lib/constants'
import { toISODate } from '../lib/format'
import { cn } from '../lib/utils'

export function IdeenPool() {
  const navigate = useNavigate()
  const [ideen, setIdeen] = useState<IdeeRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<IdeeRow | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      setIdeen(await fetchIdeen())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Laden fehlgeschlagen.')
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
    } else {
      const created = await createIdee(input)
      setIdeen((prev) => [...prev, created])
    }
  }
  const handleDelete = async (id: string) => {
    await deleteIdee(id)
    setIdeen((prev) => prev.filter((r) => r.id !== id))
  }

  const toggleAktiv = async (row: IdeeRow) => {
    const prev = ideen
    setIdeen((list) => list.map((r) => (r.id === row.id ? { ...r, aktiv: !r.aktiv } : r)))
    try {
      await updateIdee(row.id, { aktiv: !row.aktiv })
    } catch (e) {
      setIdeen(prev)
      setError(e instanceof Error ? e.message : 'Update fehlgeschlagen.')
    }
  }

  // Idee → Redaktionsplan: neuen Content-Eintrag mit heutigem Datum anlegen.
  const intoPlan = async (row: IdeeRow) => {
    setNote(null)
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
      setNote(`„${row.titel}" wurde als geplanter Beitrag (heute) angelegt.`)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.')
    }
  }

  return (
    <>
      <PageHeader
        title="Ideen-Pool"
        subtitle="Wiederkehrende Formate — per Klick in den Redaktionsplan."
        actions={
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
        }
      />

      {note && (
        <div className="mb-4 flex items-center justify-between gap-3 rounded-md border border-green-600/40 bg-green-600/10 px-3 py-2 text-sm text-green-500">
          <span>{note}</span>
          <button className="underline hover:no-underline" onClick={() => navigate('/redaktionsplan')}>
            Zum Plan →
          </button>
        </div>
      )}
      {error && (
        <div className="mb-4 rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm text-primary">
          {error}
        </div>
      )}

      {loading ? (
        <p className="py-16 text-center text-muted-foreground">Lädt…</p>
      ) : ideen.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border py-16 text-center text-muted-foreground">
          Noch keine Ideen. Lege oben rechts eine an.
        </div>
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
    </>
  )
}
