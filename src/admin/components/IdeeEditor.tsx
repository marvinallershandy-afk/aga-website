import { useEffect, useState } from 'react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { useConfirm } from './ui/confirm'
import { KanalChips } from './KanalChips'
import { KATEGORIEN, RHYTHMEN } from '../lib/constants'
import type { IdeeInput, IdeeRow } from '../lib/db'

const EMPTY: IdeeInput = {
  titel: '',
  beschreibung: '',
  kanal: [],
  kategorie: '',
  rhythmus: '',
  aktiv: true,
}

export function IdeeEditor({
  open,
  onClose,
  onSave,
  onDelete,
  row,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: IdeeInput, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  row?: IdeeRow | null
}) {
  const confirm = useConfirm()
  const [form, setForm] = useState<IdeeInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (row) {
      setForm({
        titel: row.titel,
        beschreibung: row.beschreibung ?? '',
        kanal: row.kanal ?? [],
        kategorie: row.kategorie ?? '',
        rhythmus: row.rhythmus ?? '',
        aktiv: row.aktiv,
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, row])

  const set = <K extends keyof IdeeInput>(k: K, v: IdeeInput[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.titel || !form.titel.trim()) {
      setError('Titel ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          ...form,
          beschreibung: form.beschreibung || null,
          kategorie: form.kategorie || null,
          rhythmus: form.rhythmus || null,
        },
        row?.id,
      )
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!row || !onDelete) return
    const ok = await confirm({
      title: 'Idee löschen?',
      description: `„${row.titel}" wird endgültig entfernt.`,
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await onDelete(row.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.')
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? 'Idee bearbeiten' : 'Neue Idee'}
      description="Wiederkehrendes Format für den Ideen-Pool."
      footer={
        <>
          {row && onDelete && (
            <Button variant="destructive" onClick={remove} disabled={saving} className="mr-auto">
              Löschen
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="ie-titel">Titel *</Label>
        <Input
          id="ie-titel"
          value={form.titel ?? ''}
          onChange={(e) => set('titel', e.target.value)}
          placeholder="z. B. Spieler des Spiels"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Kanäle</Label>
        <KanalChips value={form.kanal ?? []} onChange={(v) => set('kanal', v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ie-kat">Kategorie</Label>
          <Select id="ie-kat" value={form.kategorie ?? ''} onChange={(e) => set('kategorie', e.target.value)}>
            <option value="">—</option>
            {KATEGORIEN.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ie-rhythmus">Rhythmus</Label>
          <Select id="ie-rhythmus" value={form.rhythmus ?? ''} onChange={(e) => set('rhythmus', e.target.value)}>
            <option value="">—</option>
            {RHYTHMEN.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ie-besch">Beschreibung</Label>
        <Textarea
          id="ie-besch"
          value={form.beschreibung ?? ''}
          onChange={(e) => set('beschreibung', e.target.value)}
          placeholder="Worum geht es? Wann posten?"
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.aktiv ?? true}
          onChange={(e) => set('aktiv', e.target.checked)}
          className="h-4 w-4 accent-[var(--sva-red,#E91D29)]"
        />
        Aktiv (im Pool sichtbar)
      </label>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
