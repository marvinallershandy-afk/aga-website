import { useEffect, useState } from 'react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Select } from './ui/select'
import { useConfirm } from './ui/confirm'
import type { SponsorInput, SponsorRow } from '../lib/db'
import { PAKETE } from '../lib/constants'

interface FormState {
  name: string
  paket: string
  laufzeit_von: string
  laufzeit_bis: string
  leistungen: string
  ansprechpartner: string
  kontakt: string
  logo_url: string
  aktiv: boolean
  notizen: string
}

const EMPTY: FormState = {
  name: '',
  paket: '',
  laufzeit_von: '',
  laufzeit_bis: '',
  leistungen: '',
  ansprechpartner: '',
  kontakt: '',
  logo_url: '',
  aktiv: true,
  notizen: '',
}

export function SponsorEditor({
  open,
  onClose,
  onSave,
  onDelete,
  row,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: SponsorInput, id?: string) => Promise<void>
  onDelete?: (id: string) => Promise<void>
  row?: SponsorRow | null
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
        paket: row.paket ?? '',
        laufzeit_von: row.laufzeit_von ?? '',
        laufzeit_bis: row.laufzeit_bis ?? '',
        leistungen: row.leistungen ?? '',
        ansprechpartner: row.ansprechpartner ?? '',
        kontakt: row.kontakt ?? '',
        logo_url: row.logo_url ?? '',
        aktiv: row.aktiv,
        notizen: row.notizen ?? '',
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
          paket: form.paket || null,
          laufzeit_von: form.laufzeit_von || null,
          laufzeit_bis: form.laufzeit_bis || null,
          leistungen: form.leistungen.trim() || null,
          ansprechpartner: form.ansprechpartner.trim() || null,
          kontakt: form.kontakt.trim() || null,
          logo_url: form.logo_url.trim() || null,
          aktiv: form.aktiv,
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
      title: 'Sponsor löschen?',
      description: `„${row.name}" wird endgültig entfernt.`,
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
      title={row ? 'Sponsor bearbeiten' : 'Neuer Sponsor'}
      description="Pakete, Laufzeiten und Leistungen an einem Ort."
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
          <Label htmlFor="sn-name">Name *</Label>
          <Input
            id="sn-name"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="z. B. Autohaus Müller"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sn-paket">Paket</Label>
          <Select id="sn-paket" value={form.paket} onChange={(e) => set('paket', e.target.value)}>
            <option value="">—</option>
            {PAKETE.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sn-von">Laufzeit von</Label>
          <Input id="sn-von" type="date" value={form.laufzeit_von} onChange={(e) => set('laufzeit_von', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sn-bis">Laufzeit bis</Label>
          <Input id="sn-bis" type="date" value={form.laufzeit_bis} onChange={(e) => set('laufzeit_bis', e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sn-leistungen">Vereinbarte Leistungen</Label>
        <Textarea
          id="sn-leistungen"
          value={form.leistungen}
          onChange={(e) => set('leistungen', e.target.value)}
          placeholder="z. B. Bande + 2 Instagram-Posts pro Saison + Trikotärmel"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="sn-ansprech">Ansprechpartner</Label>
          <Input id="sn-ansprech" value={form.ansprechpartner} onChange={(e) => set('ansprechpartner', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sn-kontakt">Kontakt</Label>
          <Input
            id="sn-kontakt"
            value={form.kontakt}
            onChange={(e) => set('kontakt', e.target.value)}
            placeholder="E-Mail oder Telefon"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sn-logo">Logo-URL</Label>
        <Input id="sn-logo" value={form.logo_url} onChange={(e) => set('logo_url', e.target.value)} placeholder="https://…" />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sn-notizen">Notizen</Label>
        <Textarea id="sn-notizen" value={form.notizen} onChange={(e) => set('notizen', e.target.value)} />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.aktiv}
          onChange={(e) => set('aktiv', e.target.checked)}
          className="h-4 w-4 accent-[var(--sva-red,#E91D29)]"
        />
        Aktiv (laufende Partnerschaft)
      </label>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
