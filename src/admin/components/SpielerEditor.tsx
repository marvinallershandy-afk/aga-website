import { useEffect, useState } from 'react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Select } from './ui/select'
import { useConfirm } from './ui/confirm'
import type { RosterInput, RosterRow } from '../lib/db'
import { POSITIONEN, STECKBRIEF_FELDER } from '../lib/constants'

interface FormState {
  name: string
  nummer: string
  position: string
  foto_url: string
  aktiv: boolean
  steckbrief: Record<string, string>
}

const EMPTY: FormState = { name: '', nummer: '', position: '', foto_url: '', aktiv: true, steckbrief: {} }

export function SpielerEditor({
  open,
  onClose,
  onSave,
  onDelete,
  row,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: RosterInput, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  row?: RosterRow | null
}) {
  const confirm = useConfirm()
  const [form, setForm] = useState<FormState>(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    if (row) {
      setForm({
        name: row.name,
        nummer: row.nummer != null ? String(row.nummer) : '',
        position: row.position ?? '',
        foto_url: row.foto_url ?? '',
        aktiv: row.aktiv,
        steckbrief:
          row.steckbrief && typeof row.steckbrief === 'object' && !Array.isArray(row.steckbrief)
            ? (Object.fromEntries(
                Object.entries(row.steckbrief).filter(([, v]) => typeof v === 'string'),
              ) as Record<string, string>)
            : {},
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, row])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.name.trim()) {
      setError('Name ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          name: form.name.trim(),
          nummer: form.nummer !== '' ? Number(form.nummer) : null,
          position: form.position || null,
          foto_url: form.foto_url.trim() || null,
          aktiv: form.aktiv,
          steckbrief: Object.fromEntries(
            Object.entries(form.steckbrief).filter(([, v]) => v.trim() !== ''),
          ),
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
      title: 'Spieler löschen?',
      description: `${row.name} wird aus dem Kader entfernt.`,
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
      title={row ? 'Spieler bearbeiten' : 'Neuer Spieler'}
      description="Kader ist die Quelle für Aufstellungen, MOTM-Grafiken und Steckbriefe."
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
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="rp-name">Name *</Label>
          <Input
            id="rp-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="Vor- und Nachname"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rp-nummer">Nr.</Label>
          <Input
            id="rp-nummer"
            type="number"
            min={1}
            max={99}
            className="w-20"
            value={form.nummer}
            onChange={(e) => set('nummer', e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rp-position">Position</Label>
        <Select id="rp-position" value={form.position} onChange={(e) => set('position', e.target.value)}>
          <option value="">—</option>
          {POSITIONEN.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="rp-foto">Foto-URL</Label>
        <Input
          id="rp-foto"
          value={form.foto_url}
          onChange={(e) => set('foto_url', e.target.value)}
          placeholder="/players/name.webp oder https://…"
        />
        <p className="text-xs text-muted-foreground">
          Pfad unter /players (Website-Assets) oder externe URL — wird in Grafiken verwendet.
        </p>
      </div>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
          Steckbrief (für die Steckbrief-Grafik)
        </legend>
        <div className="space-y-2.5">
          {STECKBRIEF_FELDER.map((f) => (
            <div key={f.key} className="space-y-1">
              <Label htmlFor={`sb-${f.key}`}>{f.frage}</Label>
              <Input
                id={`sb-${f.key}`}
                value={form.steckbrief[f.key] ?? ''}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    steckbrief: { ...prev.steckbrief, [f.key]: e.target.value },
                  }))
                }
              />
            </div>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.aktiv}
          onChange={(e) => set('aktiv', e.target.checked)}
          className="h-4 w-4 accent-[var(--sva-red,#E91D29)]"
        />
        Aktiv (im Kader)
      </label>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
