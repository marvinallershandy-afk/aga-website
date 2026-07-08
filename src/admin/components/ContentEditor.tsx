import { useEffect, useState } from 'react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { KanalChips } from './KanalChips'
import { STATUS, FORMATE, KATEGORIEN } from '../lib/constants'
import type { ContentInput, ContentRow } from '../lib/db'

const EMPTY: ContentInput = {
  titel: '',
  beschreibung: '',
  kanal: [],
  status: 'idee',
  format: '',
  kategorie: '',
  geplant_am: null,
  verantwortlich: '',
  notizen: '',
}

export function ContentEditor({
  open,
  onClose,
  onSave,
  onDelete,
  row,
  defaultDate,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: ContentInput, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  row?: ContentRow | null
  defaultDate?: string | null
}) {
  const [form, setForm] = useState<ContentInput>(EMPTY)
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
        status: row.status,
        format: row.format ?? '',
        kategorie: row.kategorie ?? '',
        geplant_am: row.geplant_am,
        verantwortlich: row.verantwortlich ?? '',
        notizen: row.notizen ?? '',
        idee_id: row.idee_id,
      })
    } else {
      setForm({ ...EMPTY, geplant_am: defaultDate ?? null })
    }
  }, [open, row, defaultDate])

  const set = <K extends keyof ContentInput>(k: K, v: ContentInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.titel || !form.titel.trim()) {
      setError('Titel ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload: ContentInput = {
        ...form,
        format: form.format || null,
        kategorie: form.kategorie || null,
        verantwortlich: form.verantwortlich || null,
        beschreibung: form.beschreibung || null,
        notizen: form.notizen || null,
        geplant_am: form.geplant_am || null,
      }
      await onSave(payload, row?.id)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!row || !onDelete) return
    if (!window.confirm('Diesen Eintrag wirklich löschen?')) return
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
      title={row ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}
      description="Plane Kanal, Status und Termin für einen Social-Media-Beitrag."
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
        <Label htmlFor="ce-titel">Titel *</Label>
        <Input
          id="ce-titel"
          value={form.titel ?? ''}
          onChange={(e) => set('titel', e.target.value)}
          placeholder="z. B. Spieltag-Ankündigung SVA vs. …"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label>Kanäle</Label>
        <KanalChips value={form.kanal ?? []} onChange={(v) => set('kanal', v)} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ce-status">Status</Label>
          <Select id="ce-status" value={form.status ?? 'idee'} onChange={(e) => set('status', e.target.value)}>
            {STATUS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-datum">Geplant am</Label>
          <Input
            id="ce-datum"
            type="date"
            value={form.geplant_am ?? ''}
            onChange={(e) => set('geplant_am', e.target.value || null)}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ce-format">Format</Label>
          <Select id="ce-format" value={form.format ?? ''} onChange={(e) => set('format', e.target.value)}>
            <option value="">—</option>
            {FORMATE.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-kat">Kategorie</Label>
          <Select id="ce-kat" value={form.kategorie ?? ''} onChange={(e) => set('kategorie', e.target.value)}>
            <option value="">—</option>
            {KATEGORIEN.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ce-verant">Verantwortlich</Label>
        <Input
          id="ce-verant"
          value={form.verantwortlich ?? ''}
          onChange={(e) => set('verantwortlich', e.target.value)}
          placeholder="Wer kümmert sich?"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ce-besch">Beschreibung / Caption</Label>
        <Textarea
          id="ce-besch"
          value={form.beschreibung ?? ''}
          onChange={(e) => set('beschreibung', e.target.value)}
          placeholder="Text, Idee, Caption-Entwurf …"
        />
      </div>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
