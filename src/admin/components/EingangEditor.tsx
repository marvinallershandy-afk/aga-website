import { useEffect, useState } from 'react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { KanalChips } from './KanalChips'
import { useToast } from './ui/toast'
import type { EingangInput, EingangRow } from '../lib/db'

const EMPTY: EingangInput = { titel: '', beschreibung: '', von: '', kanal: [] }

export function EingangEditor({
  open,
  onClose,
  onSave,
  row,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: EingangInput, id?: string) => Promise<void>
  row?: EingangRow | null
}) {
  const toast = useToast()
  const [form, setForm] = useState<EingangInput>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setForm(
      row
        ? {
            titel: row.titel,
            beschreibung: row.beschreibung ?? '',
            von: row.von ?? '',
            kanal: row.kanal ?? [],
          }
        : EMPTY,
    )
  }, [open, row])

  const set = <K extends keyof EingangInput>(k: K, v: EingangInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.titel || !form.titel.trim()) {
      setError('Titel ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const nn = (v?: string | null) => (v && v.trim() ? v : null)
      await onSave(
        { ...form, beschreibung: nn(form.beschreibung), von: nn(form.von) },
        row?.id,
      )
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? 'Idee bearbeiten' : 'Neue Team-Idee'}
      description="Kurz festhalten — Details und Termin kommen bei der Übernahme in den Plan."
      className="max-w-md"
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
      <div className="space-y-1.5">
        <Label htmlFor="ee-titel">Idee *</Label>
        <Input
          id="ee-titel"
          value={form.titel ?? ''}
          onChange={(e) => set('titel', e.target.value)}
          placeholder="z. B. Kabinen-Karaoke nach dem Sieg"
          autoFocus
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ee-von">Von wem</Label>
        <Input
          id="ee-von"
          value={form.von ?? ''}
          onChange={(e) => set('von', e.target.value)}
          placeholder="z. B. Nico"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="ee-besch">Beschreibung</Label>
        <Textarea
          id="ee-besch"
          value={form.beschreibung ?? ''}
          onChange={(e) => set('beschreibung', e.target.value)}
          placeholder="Worum geht's? Kurz reicht."
        />
      </div>
      <div className="space-y-1.5">
        <Label>Passende Kanäle (optional)</Label>
        <KanalChips value={form.kanal ?? []} onChange={(v) => set('kanal', v)} />
      </div>
      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
