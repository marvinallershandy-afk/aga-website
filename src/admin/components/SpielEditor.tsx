import { useEffect, useState } from 'react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { useConfirm } from './ui/confirm'
import type { SpielInput, SpielRow } from '../lib/db'

// datetime-local arbeitet in lokaler Zeit ohne Zone — ISO <-> Input-Format wandeln.
function isoToLocalInput(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

interface FormState {
  gegner: string
  heim: boolean
  anstoss: string // datetime-local
  ort: string
  wettbewerb: string
  spieltag_nr: string
  tore_sva: string
  tore_gegner: string
  notizen: string
}

const EMPTY: FormState = {
  gegner: '',
  heim: true,
  anstoss: '',
  ort: 'Sportplatz Agathenburg',
  wettbewerb: 'Kreisliga Stade',
  spieltag_nr: '',
  tore_sva: '',
  tore_gegner: '',
  notizen: '',
}

export function SpielEditor({
  open,
  onClose,
  onSave,
  onDelete,
  row,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: SpielInput, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  row?: SpielRow | null
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
        gegner: row.gegner,
        heim: row.heim,
        anstoss: isoToLocalInput(row.anstoss),
        ort: row.ort ?? '',
        wettbewerb: row.wettbewerb ?? '',
        spieltag_nr: row.spieltag_nr != null ? String(row.spieltag_nr) : '',
        tore_sva: row.tore_sva != null ? String(row.tore_sva) : '',
        tore_gegner: row.tore_gegner != null ? String(row.tore_gegner) : '',
        notizen: row.notizen ?? '',
      })
    } else {
      setForm(EMPTY)
    }
  }, [open, row])

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async () => {
    if (!form.gegner.trim()) {
      setError('Gegner ist erforderlich.')
      return
    }
    if (!form.anstoss) {
      setError('Anstoß (Datum & Uhrzeit) ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          gegner: form.gegner.trim(),
          heim: form.heim,
          anstoss: new Date(form.anstoss).toISOString(),
          ort: form.ort.trim() || null,
          wettbewerb: form.wettbewerb.trim() || null,
          spieltag_nr: form.spieltag_nr ? Number(form.spieltag_nr) : null,
          tore_sva: form.tore_sva !== '' ? Number(form.tore_sva) : null,
          tore_gegner: form.tore_gegner !== '' ? Number(form.tore_gegner) : null,
          notizen: form.notizen.trim() || null,
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
      title: 'Spiel löschen?',
      description: `Das Spiel gegen ${row.gegner} wird entfernt. Verknüpfte Plan-Beiträge bleiben bestehen.`,
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
      title={row ? 'Spiel bearbeiten' : 'Neues Spiel'}
      description="Spieldaten sind die Quelle für Paket, Grafiken und Dashboard."
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
          <Label htmlFor="sp-gegner">Gegner *</Label>
          <Input
            id="sp-gegner"
            value={form.gegner}
            onChange={(e) => set('gegner', e.target.value)}
            placeholder="z. B. TuS Fischbek"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-heim">Heim/Auswärts</Label>
          <Select id="sp-heim" value={form.heim ? 'heim' : 'auswaerts'} onChange={(e) => set('heim', e.target.value === 'heim')}>
            <option value="heim">Heim</option>
            <option value="auswaerts">Auswärts</option>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sp-anstoss">Anstoß *</Label>
          <Input
            id="sp-anstoss"
            type="datetime-local"
            value={form.anstoss}
            onChange={(e) => set('anstoss', e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-ort">Ort</Label>
          <Input id="sp-ort" value={form.ort} onChange={(e) => set('ort', e.target.value)} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sp-wettbewerb">Wettbewerb</Label>
          <Input id="sp-wettbewerb" value={form.wettbewerb} onChange={(e) => set('wettbewerb', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sp-nr">Spieltag-Nr.</Label>
          <Input
            id="sp-nr"
            type="number"
            className="w-24"
            value={form.spieltag_nr}
            onChange={(e) => set('spieltag_nr', e.target.value)}
          />
        </div>
      </div>

      <fieldset className="rounded-md border border-border p-3">
        <legend className="px-1 text-xs uppercase tracking-wide text-muted-foreground">
          Ergebnis (nach Abpfiff)
        </legend>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="sp-tsva">Tore SVA</Label>
            <Input
              id="sp-tsva"
              type="number"
              min={0}
              value={form.tore_sva}
              onChange={(e) => set('tore_sva', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-tgegner">Tore Gegner</Label>
            <Input
              id="sp-tgegner"
              type="number"
              min={0}
              value={form.tore_gegner}
              onChange={(e) => set('tore_gegner', e.target.value)}
            />
          </div>
        </div>
      </fieldset>

      <div className="space-y-1.5">
        <Label htmlFor="sp-notizen">Notizen</Label>
        <Textarea
          id="sp-notizen"
          value={form.notizen}
          onChange={(e) => set('notizen', e.target.value)}
          placeholder="Besonderheiten, Torschützen, MOTM …"
        />
      </div>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
