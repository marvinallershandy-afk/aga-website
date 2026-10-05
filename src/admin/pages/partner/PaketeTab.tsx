import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, Package, Plus, Star, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Modal } from '../../components/ui/modal'
import { Select } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { Textarea } from '../../components/ui/textarea'
import { SkeletonRows } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { ErrorState } from '../../components/ui/error-state'
import { useToast } from '../../components/ui/toast'
import { useConfirm } from '../../components/ui/confirm'
import { PflegeHinweis } from '../../components/PflegeHinweis'
import { friendlyError, isMissingSchema } from '../../lib/db'
import { useSponsoren } from '../../lib/queries'
import { EINHEITEN, usePakete, usePaketeMutations, type PaketInput, type PaketRow } from '../../lib/partner'
import { cn } from '../../lib/utils'

// ─────────────────────────────────────────────────────────────
// v16-S: Pakete für /partner. Reihenfolge = Reihenfolge auf der Seite,
// „sichtbar“ blendet aus, Plätze minus gebuchte Sponsoren = „noch x frei“.
// ─────────────────────────────────────────────────────────────

const nf = new Intl.NumberFormat('de-DE')
function preisKurz(p: Pick<PaketRow, 'preis_ab' | 'preis_einheit'>): string {
  if (p.preis_ab == null) return 'Preis auf Anfrage'
  return `ab ${nf.format(p.preis_ab)} € ${p.preis_einheit === 'einmalig' ? 'einmalig' : `/ ${p.preis_einheit}`}`
}

export function PaketeTab() {
  const toast = useToast()
  const q = usePakete()
  const sponsoren = useSponsoren()
  const { save, remove } = usePaketeMutations()
  const [editor, setEditor] = useState<{ open: boolean; row: PaketRow | null }>({ open: false, row: null })
  const rows = useMemo(() => q.data ?? [], [q.data])

  const belegt = (id: string) => (sponsoren.data ?? []).filter((s) => s.aktiv && s.partner_paket_id === id).length

  const verschieben = async (i: number, d: -1 | 1) => {
    const ziel = i + d
    if (ziel < 0 || ziel >= rows.length) return
    const neu = [...rows]
    ;[neu[i], neu[ziel]] = [neu[ziel], neu[i]]
    try {
      for (let k = 0; k < neu.length; k++) {
        const soll = (k + 1) * 10
        if (neu[k].sortierung !== soll) await save.mutateAsync({ id: neu[k].id, input: { sortierung: soll } })
      }
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  if (q.error && isMissingSchema(q.error)) {
    return <PflegeHinweis schema title="Pakete brauchen die Partner-Migration">Marvin wendet einmalig <code>20261006100000_sva_partner.sql</code> an (docs/PARTNER.md). Danach stehen hier sechs Vorschlags-Pakete zum Anpassen.</PflegeHinweis>
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-xl text-sm text-muted-foreground">
          So erscheinen die Pakete auf /partner — in dieser Reihenfolge. Änderungen sind nach „Website veröffentlichen“ sichtbar.
        </p>
        <Button onClick={() => setEditor({ open: true, row: null })}>
          <Plus className="h-4 w-4" /> Paket
        </Button>
      </div>
      {q.error && !q.isPending && <ErrorState className="mb-4" message={friendlyError(q.error)} onRetry={() => void q.refetch()} />}
      {q.isPending ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Package} title="Noch keine Pakete" description="Ohne Pakete zeigt /partner nur Zahlen, Partner-Wand und das Anfrage-Formular." action={<Button onClick={() => setEditor({ open: true, row: null })}><Plus className="h-4 w-4" /> Erstes Paket</Button>} />
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {rows.map((p, i) => {
            const b = belegt(p.id)
            const frei = p.plaetze == null ? null : Math.max(0, p.plaetze - b)
            return (
              <li key={p.id} className={cn('flex rounded-lg border bg-card', p.hervorgehoben ? 'border-primary/60' : 'border-border', !p.sichtbar && 'opacity-60')}>
                <button type="button" className="min-w-0 flex-1 p-4 text-left hover:bg-accent/30" onClick={() => setEditor({ open: true, row: p })}>
                  <span className="flex items-center gap-2">
                    {p.hervorgehoben && <Star className="h-4 w-4 shrink-0 fill-primary text-primary" aria-label="hervorgehoben" />}
                    <span className="truncate font-display text-lg tracking-wide">{p.name}</span>
                  </span>
                  <span className="mt-1 block text-sm">{preisKurz(p)}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {p.plaetze == null ? 'Plätze unbegrenzt' : `${b} von ${p.plaetze} Plätzen gebucht · ${frei === 0 ? 'ausgebucht' : `${frei} frei`}`}
                    {' · '}
                    {p.leistungen.length} Leistungen
                    {!p.sichtbar && ' · ausgeblendet'}
                  </span>
                </button>
                <span className="flex flex-col justify-center gap-0.5 pr-1">
                  <Button variant="ghost" size="icon" className="h-9 w-10" disabled={i === 0} onClick={() => void verschieben(i, -1)} aria-label={`${p.name} nach oben`}>
                    <ChevronUp className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-10"
                    onClick={() => save.mutate({ id: p.id, input: { sichtbar: !p.sichtbar } }, { onError: (e) => toast.error(friendlyError(e)) })}
                    aria-label={p.sichtbar ? `${p.name} ausblenden` : `${p.name} einblenden`}
                  >
                    {p.sichtbar ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-10" disabled={i === rows.length - 1} onClick={() => void verschieben(i, 1)} aria-label={`${p.name} nach unten`}>
                    <ChevronDown className="h-4 w-4" />
                  </Button>
                </span>
              </li>
            )
          })}
        </ul>
      )}
      <PaketFormular
        open={editor.open}
        row={editor.row}
        naechsteSortierung={Math.max(0, ...rows.map((r) => r.sortierung)) + 10}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        onSave={async (input, id) => {
          await save.mutateAsync({ id, input })
          toast.success(`${input.name} gespeichert. Erscheint nach „Website veröffentlichen“.`)
        }}
        onDelete={async (id) => {
          await remove.mutateAsync(id)
          toast.success('Paket gelöscht.')
        }}
      />
    </>
  )
}

function PaketFormular({
  open,
  row,
  naechsteSortierung,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  row: PaketRow | null
  naechsteSortierung: number
  onClose: () => void
  onSave: (input: PaketInput & { name: string }, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const confirm = useConfirm()
  const [name, setName] = useState('')
  const [beschreibung, setBeschreibung] = useState('')
  const [leistungen, setLeistungen] = useState('')
  const [preis, setPreis] = useState('')
  const [einheit, setEinheit] = useState<string>('Saison')
  const [plaetze, setPlaetze] = useState('')
  const [hervor, setHervor] = useState(false)
  const [sichtbar, setSichtbar] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(row?.name ?? '')
    setBeschreibung(row?.beschreibung ?? '')
    setLeistungen((row?.leistungen ?? []).join('\n'))
    setPreis(row?.preis_ab != null ? String(row.preis_ab) : '')
    setEinheit(row?.preis_einheit ?? 'Saison')
    setPlaetze(row?.plaetze != null ? String(row.plaetze) : '')
    setHervor(row?.hervorgehoben ?? false)
    setSichtbar(row?.sichtbar ?? true)
    setError(null)
  }, [open, row])

  const zahl = (v: string, max: number): number | null | 'fehler' => {
    const t = v.replace(/[.\s€]/g, '').trim()
    if (!t) return null
    if (!/^\d+$/.test(t)) return 'fehler'
    const n = Number(t)
    return n > max ? 'fehler' : n
  }

  const submit = async () => {
    const n = name.trim()
    if (n.length < 2) return setError('Bitte einen Namen eintragen (mind. 2 Zeichen).')
    if (beschreibung.length > 400) return setError('Beschreibung bitte kürzer (max. 400 Zeichen).')
    const l = leistungen.split('\n').map((x) => x.trim()).filter(Boolean)
    if (l.length > 12) return setError('Höchstens 12 Leistungen.')
    const p = zahl(preis, 1_000_000)
    if (p === 'fehler') return setError('Preis bitte als ganze Euro, z. B. 250 — oder leer für „auf Anfrage“.')
    const pl = zahl(plaetze, 999)
    if (pl === 'fehler') return setError('Plätze bitte als Zahl — oder leer für unbegrenzt.')
    setSaving(true)
    setError(null)
    try {
      await onSave(
        { name: n, beschreibung: beschreibung.trim() || null, leistungen: l, preis_ab: p, preis_einheit: einheit, plaetze: pl, hervorgehoben: hervor, sichtbar, ...(row ? {} : { sortierung: naechsteSortierung }) },
        row?.id,
      )
      onClose()
    } catch (e) {
      setError(friendlyError(e, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  const loeschen = async () => {
    if (!row) return
    const ok = await confirm({
      title: `${row.name} löschen?`,
      description: 'Tipp: Ausblenden (Auge) behält das Paket. Gebuchte Sponsoren verlieren beim Löschen die Paket-Zuordnung.',
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (!ok) return
    setSaving(true)
    try {
      await onDelete(row.id)
      onClose()
    } catch (e) {
      setError(friendlyError(e, 'Löschen fehlgeschlagen.'))
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? `${row.name} bearbeiten` : 'Paket hinzufügen'}
      footer={
        <>
          {row && (
            <Button variant="ghost" className="mr-auto text-muted-foreground" onClick={loeschen} disabled={saving}>
              <Trash2 className="h-4 w-4" /> Löschen
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving} className="min-w-28">
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {saving ? 'Speichert …' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="pk-name">Name *</Label>
        <Input id="pk-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="z. B. Bande am Spielfeld" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pk-text">Kurze Beschreibung</Label>
        <Textarea id="pk-text" value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} maxLength={400} placeholder="Ein Satz, warum sich das lohnt." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pk-leist">Leistungen (eine pro Zeile)</Label>
        <Textarea id="pk-leist" className="min-h-[120px]" value={leistungen} onChange={(e) => setLeistungen(e.target.value)} placeholder={'Bandenplatz am Waldsportplatz\nLogo auf der Partner-Wand'} />
      </div>
      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="pk-preis">Preis ab (€)</Label>
          <Input id="pk-preis" className="h-12 text-base" inputMode="numeric" value={preis} onChange={(e) => setPreis(e.target.value)} placeholder="leer = auf Anfrage" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="pk-einheit">pro</Label>
          <Select id="pk-einheit" className="h-12 w-36 text-base" value={einheit} onChange={(e) => setEinheit(e.target.value)}>
            {EINHEITEN.map((x) => (
              <option key={x} value={x}>
                {x}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="pk-plaetze">Plätze insgesamt</Label>
        <Input id="pk-plaetze" className="h-12 text-base" inputMode="numeric" value={plaetze} onChange={(e) => setPlaetze(e.target.value)} placeholder="leer = unbegrenzt (keine Anzeige)" />
        <p className="text-xs text-muted-foreground">„Noch x frei“ rechnet sich selbst: Plätze minus aktive Sponsoren mit diesem Paket.</p>
      </div>
      <div className="grid gap-2">
        <Switch checked={sichtbar} onChange={setSichtbar} label="Auf /partner zeigen" />
        <Switch checked={hervor} onChange={setHervor} label="Hervorheben („Beliebt“)" hint="Rote Karte mit Band — am besten nur bei einem Paket" />
      </div>
      {error && (
        <p role="alert" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </Modal>
  )
}
