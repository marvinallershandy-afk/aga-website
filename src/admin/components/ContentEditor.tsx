import { useEffect, useState } from 'react'
import { ExternalLink, FolderOpen, Film } from 'lucide-react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { KanalChips } from './KanalChips'
import { useToast } from './ui/toast'
import { useConfirm } from './ui/confirm'
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
  hook: '',
  caption: '',
  cta: '',
  sound: '',
  drive_rohmaterial_url: '',
  drive_asset_url: '',
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
  const toast = useToast()
  const confirm = useConfirm()
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
        hook: row.hook ?? '',
        caption: row.caption ?? '',
        cta: row.cta ?? '',
        sound: row.sound ?? '',
        drive_rohmaterial_url: row.drive_rohmaterial_url ?? '',
        drive_asset_url: row.drive_asset_url ?? '',
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
      // Leere Strings → null (saubere DB-Werte).
      const nn = (v?: string | null) => (v && v.trim() ? v : null)
      const payload: ContentInput = {
        ...form,
        format: form.format || null,
        kategorie: form.kategorie || null,
        verantwortlich: nn(form.verantwortlich),
        beschreibung: nn(form.beschreibung),
        notizen: nn(form.notizen),
        geplant_am: form.geplant_am || null,
        hook: nn(form.hook),
        caption: nn(form.caption),
        cta: nn(form.cta),
        sound: nn(form.sound),
        drive_rohmaterial_url: nn(form.drive_rohmaterial_url),
        drive_asset_url: nn(form.drive_asset_url),
      }
      await onSave(payload, row?.id)
      toast.success(row ? 'Beitrag aktualisiert.' : 'Beitrag angelegt.')
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Speichern fehlgeschlagen.'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!row || !onDelete) return
    const ok = await confirm({
      title: 'Beitrag löschen?',
      description: `„${row.titel}" wird dauerhaft entfernt. Das lässt sich nicht rückgängig machen.`,
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await onDelete(row.id)
      toast.success('Beitrag gelöscht.')
      onClose()
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Löschen fehlgeschlagen.'
      setError(msg)
      toast.error(msg)
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? 'Beitrag bearbeiten' : 'Neuer Beitrag'}
      description="Kanal, Status, Termin und Inhalt eines Social-Media-Beitrags."
      className="max-w-2xl"
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
          <Label htmlFor="ce-kat">Säule / Kategorie</Label>
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

      {/* Inhalt */}
      <div className="space-y-1.5">
        <Label htmlFor="ce-hook">Hook</Label>
        <Input
          id="ce-hook"
          value={form.hook ?? ''}
          onChange={(e) => set('hook', e.target.value)}
          placeholder="Erster Satz / Aufhänger der ersten Sekunden"
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ce-caption">Caption</Label>
        <Textarea
          id="ce-caption"
          value={form.caption ?? ''}
          onChange={(e) => set('caption', e.target.value)}
          placeholder="Der Text, der unter dem Post steht …"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="ce-cta">Call-to-Action</Label>
          <Input
            id="ce-cta"
            value={form.cta ?? ''}
            onChange={(e) => set('cta', e.target.value)}
            placeholder="z. B. „Kommt Sonntag vorbei!“"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ce-sound">Sound / Audio</Label>
          <Input
            id="ce-sound"
            value={form.sound ?? ''}
            onChange={(e) => set('sound', e.target.value)}
            placeholder="Trending-Sound / Musik-Referenz"
          />
        </div>
      </div>

      {/* Drive-Verlinkung (keine Datei-Kopien — nur Deep-Links) */}
      <div className="grid grid-cols-1 gap-3 rounded-lg border border-border bg-muted/20 p-3">
        <DriveLinkField
          id="ce-roh"
          icon={FolderOpen}
          label="Rohmaterial-Ordner (Drive)"
          value={form.drive_rohmaterial_url ?? ''}
          onChange={(v) => set('drive_rohmaterial_url', v)}
        />
        <DriveLinkField
          id="ce-asset"
          icon={Film}
          label="Fertiges Asset (Drive)"
          value={form.drive_asset_url ?? ''}
          onChange={(v) => set('drive_asset_url', v)}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="ce-notiz">Interne Notiz</Label>
        <Textarea
          id="ce-notiz"
          value={form.notizen ?? ''}
          onChange={(e) => set('notizen', e.target.value)}
          placeholder="Nur fürs Team — Absprachen, Todos …"
          className="min-h-[60px]"
        />
      </div>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}

// Drive-Link-Feld mit „Öffnen"-Button (öffnet Deep-Link in neuem Tab).
function DriveLinkField({
  id,
  icon: Icon,
  label,
  value,
  onChange,
}: {
  id: string
  icon: typeof FolderOpen
  label: string
  value: string
  onChange: (v: string) => void
}) {
  const valid = /^https?:\/\//i.test(value.trim())
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://drive.google.com/…"
        />
        <Button
          type="button"
          variant="outline"
          size="icon"
          disabled={!valid}
          onClick={() => valid && window.open(value, '_blank', 'noopener')}
          aria-label="Ordner öffnen"
          title={valid ? 'In Drive öffnen' : 'Gültigen Link einfügen'}
        >
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
