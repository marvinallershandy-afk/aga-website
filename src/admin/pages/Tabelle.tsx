import { useState } from 'react'
import { Plus, RefreshCw, ListOrdered, Trash2, Pencil, ExternalLink } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import type { TabelleRow, TabelleInput } from '../lib/db'
import { useTabelle, useTabelleMutations } from '../lib/queries'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// P3 (Admin-Ausbau): Ligatabelle — Handeingabe-Maske.
//
// Die öffentliche Seite (FussballWidget) zeigte bisher statische Vorschau-
// Werte. Hier gepflegte Zeilen landen in sm_tabelle und werden über den
// P1-Build-Fetch (scripts/fetch-content.mjs) statisch auf die Website gebacken.
//
// ⚠️ QUELLE = GATE-D (offen): Ob die Tabelle künftig aus dem DFB-Widget, per
// n8n-Auslesen von fussball.de oder per Handeingabe kommt, entscheidet Marvin.
// Diese Maske ist der immer erlaubte Handeingabe-Weg (Fallback) UND das
// Ziel-Schema für die automatischen Wege. Der fussball.de→sm_tabelle-Auslesepfad
// ist bewusst NICHT verdrahtet (offener Schalter).
// ─────────────────────────────────────────────────────────────

const FUSSBALL_DE_HINWEIS =
  'https://www.fussball.de'

type Draft = {
  saison: string
  platz: string
  team: string
  spiele: string
  siege: string
  unentschieden: string
  niederlagen: string
  tore: string
  gegentore: string
  punkte: string
  self: boolean
}

const LEER: Draft = {
  saison: '',
  platz: '',
  team: '',
  spiele: '0',
  siege: '0',
  unentschieden: '0',
  niederlagen: '0',
  tore: '0',
  gegentore: '0',
  punkte: '0',
  self: false,
}

function rowToDraft(r: TabelleRow): Draft {
  return {
    saison: r.saison ?? '',
    platz: String(r.platz),
    team: r.team,
    spiele: String(r.spiele),
    siege: String(r.siege),
    unentschieden: String(r.unentschieden),
    niederlagen: String(r.niederlagen),
    tore: String(r.tore),
    gegentore: String(r.gegentore),
    punkte: String(r.punkte),
    self: r.self,
  }
}

function draftToInput(d: Draft): TabelleInput & { platz: number; team: string } {
  const n = (v: string) => (v.trim() === '' ? 0 : Number(v))
  return {
    saison: d.saison.trim() || null,
    platz: n(d.platz),
    team: d.team.trim(),
    spiele: n(d.spiele),
    siege: n(d.siege),
    unentschieden: n(d.unentschieden),
    niederlagen: n(d.niederlagen),
    tore: n(d.tore),
    gegentore: n(d.gegentore),
    punkte: n(d.punkte),
    self: d.self,
  }
}

export function Tabelle() {
  const toast = useToast()
  const confirm = useConfirm()
  const tabelleQ = useTabelle()
  const { create, update, remove } = useTabelleMutations()
  const rows = tabelleQ.data ?? []

  const [editorOpen, setEditorOpen] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft>(LEER)

  const openNew = () => {
    setEditId(null)
    setDraft(LEER)
    setEditorOpen(true)
  }
  const openEdit = (r: TabelleRow) => {
    setEditId(r.id)
    setDraft(rowToDraft(r))
    setEditorOpen(true)
  }

  const handleDelete = async (r: TabelleRow) => {
    const ok = await confirm({
      title: 'Zeile löschen?',
      description: `Platz ${r.platz} · ${r.team} wird entfernt.`,
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (!ok) return
    remove.mutate(r.id, {
      onSuccess: () => toast.success('Zeile gelöscht.'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.'),
    })
  }

  return (
    <>
      <PageHeader
        title="Ligatabelle"
        subtitle="Tabellenstand pflegen — erscheint über den Website-Build auf der öffentlichen Seite."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => void tabelleQ.refetch()} aria-label="Neu laden">
              <RefreshCw className={cn('h-4 w-4', tabelleQ.isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Zeile hinzufügen
            </Button>
          </div>
        }
      />

      {/* GATE-D-Hinweis: Quelle der Daten ist eine offene Entscheidung. */}
      <div className="mb-4 rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground">
        Quelle offen (GATE-D): DFB-Widget · n8n-Auslesen von{' '}
        <a
          href={FUSSBALL_DE_HINWEIS}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-foreground/80 underline"
        >
          fussball.de <ExternalLink className="h-3 w-3" />
        </a>{' '}
        · Handeingabe (dieser Weg). Bis zur Entscheidung ist die Handeingabe die verlässliche Quelle.
      </div>

      {tabelleQ.error && !tabelleQ.isPending && (
        <ErrorState className="mb-4" message={tabelleQ.error.message} onRetry={() => void tabelleQ.refetch()} />
      )}

      {tabelleQ.isPending ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={ListOrdered}
          title="Noch keine Tabelle"
          description="Trage die Ligatabelle Zeile für Zeile ein. Markiere die eigene Mannschaft, damit sie auf der Website hervorgehoben wird."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Erste Zeile anlegen
            </Button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Pl.</th>
                <th className="px-3 py-2 font-medium">Team</th>
                <th className="px-3 py-2 font-medium">Sp.</th>
                <th className="px-3 py-2 font-medium">S</th>
                <th className="px-3 py-2 font-medium">U</th>
                <th className="px-3 py-2 font-medium">N</th>
                <th className="px-3 py-2 font-medium">Tore</th>
                <th className="px-3 py-2 font-medium">Diff</th>
                <th className="px-3 py-2 font-medium">Pkt.</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr
                  key={r.id}
                  className={cn(
                    'border-b border-border/60 last:border-0 hover:bg-accent/40',
                    r.self && 'bg-primary/10 font-medium',
                  )}
                >
                  <td className="px-3 py-2 tabular-nums">{r.platz}</td>
                  <td className="px-3 py-2">{r.team}</td>
                  <td className="px-3 py-2 tabular-nums">{r.spiele}</td>
                  <td className="px-3 py-2 tabular-nums">{r.siege}</td>
                  <td className="px-3 py-2 tabular-nums">{r.unentschieden}</td>
                  <td className="px-3 py-2 tabular-nums">{r.niederlagen}</td>
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {r.tore}:{r.gegentore}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{r.diff > 0 ? `+${r.diff}` : r.diff}</td>
                  <td className="px-3 py-2 font-semibold tabular-nums">{r.punkte}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label="Bearbeiten">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(r)} aria-label="Löschen">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TabelleEditor
        open={editorOpen}
        isEdit={editId != null}
        draft={draft}
        setDraft={setDraft}
        onClose={() => setEditorOpen(false)}
        onSave={async () => {
          const input = draftToInput(draft)
          if (!input.team) throw new Error('Team ist erforderlich.')
          if (editId) await update.mutateAsync({ id: editId, patch: input })
          else await create.mutateAsync(input)
          toast.success('Tabelle gespeichert.')
          setEditorOpen(false)
        }}
      />
    </>
  )
}

function NumField({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="number" min={0} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

function TabelleEditor({
  open,
  isEdit,
  draft,
  setDraft,
  onClose,
  onSave,
}: {
  open: boolean
  isEdit: boolean
  draft: Draft
  setDraft: (d: Draft) => void
  onClose: () => void
  onSave: () => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft({ ...draft, [k]: v })

  const submit = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? 'Tabellenzeile bearbeiten' : 'Tabellenzeile hinzufügen'}
      description="Tordifferenz wird automatisch aus Toren und Gegentoren berechnet."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <NumField id="t-platz" label="Platz" value={draft.platz} onChange={(v) => set('platz', v)} />
        <div className="space-y-1.5">
          <Label htmlFor="t-saison">Saison (optional)</Label>
          <Input id="t-saison" value={draft.saison} onChange={(e) => set('saison', e.target.value)} placeholder="2026/27" />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="t-team">Team</Label>
        <Input id="t-team" value={draft.team} onChange={(e) => set('team', e.target.value)} placeholder="Vereinsname" />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <NumField id="t-spiele" label="Spiele" value={draft.spiele} onChange={(v) => set('spiele', v)} />
        <NumField id="t-punkte" label="Punkte" value={draft.punkte} onChange={(v) => set('punkte', v)} />
        <NumField id="t-siege" label="Siege" value={draft.siege} onChange={(v) => set('siege', v)} />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <NumField id="t-unent" label="Unent." value={draft.unentschieden} onChange={(v) => set('unentschieden', v)} />
        <NumField id="t-nieder" label="Niederl." value={draft.niederlagen} onChange={(v) => set('niederlagen', v)} />
        <div />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumField id="t-tore" label="Tore" value={draft.tore} onChange={(v) => set('tore', v)} />
        <NumField id="t-gegentore" label="Gegentore" value={draft.gegentore} onChange={(v) => set('gegentore', v)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.self}
          onChange={(e) => set('self', e.target.checked)}
          className="h-4 w-4"
        />
        Eigene Mannschaft (auf der Website hervorheben)
      </label>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
