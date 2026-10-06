import { useEffect, useRef, useState } from 'react'
import { Camera, Trash2, ImageOff, Loader2 } from 'lucide-react'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { Switch } from './ui/switch'
import { useConfirm } from './ui/confirm'
import { SpielerKarte } from './SpielerKarte'
import { FotoZuschnitt } from './FotoZuschnitt'
import type { RosterInput, RosterRow } from '../lib/db'
import { friendlyError } from '../lib/db'
import {
  POSITION_CODES,
  STAFF_ROLLEN,
  positionCode,
  rolleLabel,
  uploadPublicImage,
  type PositionCode,
  type Rolle,
} from '../lib/pflege'
import { ACCEPT_IMAGES, CROP_DEFAULT, loadImage, renderPlayerPhoto, type CropState } from '../lib/image'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v14-C: Spieler/Trainer anlegen oder bearbeiten. Große Felder, wenige
// Pflichtangaben (nur der Name). Foto wird im Browser auf 2:3 zugeschnitten
// und verkleinert, erst beim Speichern hochgeladen (keine Datei-Leichen).
// ─────────────────────────────────────────────────────────────

interface Form {
  name: string
  rolle: Rolle
  nummer: string
  position: PositionCode
  kapitaen: boolean
  neuzugang: boolean
  aktiv: boolean
  seit: string
  kontaktText: string
  fupaId: string
}

const LEER: Form = {
  name: '',
  rolle: 'spieler',
  nummer: '',
  position: 'MIT',
  kapitaen: false,
  neuzugang: false,
  aktiv: true,
  seit: '',
  kontaktText: '',
  fupaId: '',
}

export interface KaderSpeichern {
  input: RosterInput
  id?: string
}

export function KaderEditor({
  open,
  onClose,
  row,
  neuAls,
  alle,
  inAufstellung,
  onSave,
  onDelete,
}: {
  open: boolean
  onClose: () => void
  row: RosterRow | null
  /** Beim Anlegen: Spieler oder Trainerstab vorauswählen. */
  neuAls: 'spieler' | 'stab'
  /** Gesamter Kader (Rückennummer-Prüfung). */
  alle: RosterRow[]
  /** Steht diese Person in der aktuellen Aufstellung? (Warnung beim Löschen) */
  inAufstellung: boolean
  onSave: (s: KaderSpeichern) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<Form>(LEER)
  const [foto, setFoto] = useState<{ url: string | null; cutout: string | null }>({ url: null, cutout: null })
  const [neuesFoto, setNeuesFoto] = useState<{ img: HTMLImageElement; crop: CropState } | null>(null)
  const [vorschauUrl, setVorschauUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setNeuesFoto(null)
    if (row) {
      setForm({
        name: row.name,
        rolle: (row.rolle as Rolle) ?? 'spieler',
        nummer: row.nummer != null ? String(row.nummer) : '',
        position: positionCode(row.position),
        kapitaen: !!row.kapitaen,
        neuzugang: !!row.neuzugang,
        aktiv: row.aktiv,
        seit: row.im_verein_seit != null ? String(row.im_verein_seit) : '',
        kontaktText: row.kontakt_text ?? '',
        fupaId: (row as RosterRow & { fupa_spieler_id?: number | null }).fupa_spieler_id != null ? String((row as RosterRow & { fupa_spieler_id?: number | null }).fupa_spieler_id) : '',
      })
      setFoto({ url: row.foto_url, cutout: row.freisteller_url ?? null })
    } else {
      setForm({ ...LEER, rolle: neuAls === 'stab' ? 'trainer' : 'spieler' })
      setFoto({ url: null, cutout: null })
    }
  }, [open, row, neuAls])

  // Live-Kartenvorschau des neuen Ausschnitts (leicht verzögert).
  useEffect(() => {
    if (!neuesFoto) {
      setVorschauUrl(null)
      return
    }
    let url: string | null = null
    let cancelled = false
    const t = window.setTimeout(async () => {
      try {
        const blob = await renderPlayerPhoto(neuesFoto.img, neuesFoto.crop)
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setVorschauUrl(url)
      } catch {
        /* Vorschau ist optional */
      }
    }, 200)
    return () => {
      cancelled = true
      window.clearTimeout(t)
      if (url) URL.revokeObjectURL(url)
    }
  }, [neuesFoto])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => ({ ...f, [k]: v }))
  const istSpieler = form.rolle === 'spieler'

  const onFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    try {
      const img = await loadImage(file)
      setNeuesFoto({ img, crop: CROP_DEFAULT })
    } catch {
      setError('Dieses Bild kann der Browser nicht lesen. Bitte ein JPG oder PNG wählen.')
    }
  }

  const nummerKonflikt = (() => {
    if (!istSpieler || !form.nummer.trim()) return null
    const n = Number(form.nummer)
    return alle.find((r) => r.id !== row?.id && r.aktiv && (r.rolle ?? 'spieler') === 'spieler' && r.nummer === n) ?? null
  })()

  const submit = async () => {
    const name = form.name.trim().replace(/\s+/g, ' ')
    if (!name) return setError('Bitte einen Namen eintragen.')
    let nummer: number | null = null
    if (istSpieler && form.nummer.trim()) {
      nummer = Number(form.nummer)
      if (!Number.isInteger(nummer) || nummer < 1 || nummer > 99) return setError('Rückennummer bitte zwischen 1 und 99.')
      if (nummerKonflikt && form.aktiv) return setError(`Die Nummer ${nummer} trägt schon ${nummerKonflikt.name}.`)
    }
    let seit: number | null = null
    if (form.seit.trim()) {
      seit = Number(form.seit)
      if (!Number.isInteger(seit) || seit < 1900 || seit > new Date().getFullYear()) return setError('„Im Verein seit“ bitte als Jahr, z. B. 2018.')
    }

    setSaving(true)
    setError(null)
    try {
      let foto_url = foto.url
      let freisteller_url = foto.cutout
      if (neuesFoto) {
        const blob = await renderPlayerPhoto(neuesFoto.img, neuesFoto.crop)
        foto_url = await uploadPublicImage(blob, 'spieler', name)
        freisteller_url = null // alter Freisteller passt nicht mehr zum neuen Foto
      }
      await onSave({
        id: row?.id,
        input: {
          name,
          rolle: form.rolle,
          nummer: istSpieler ? nummer : null,
          position: istSpieler ? form.position : null,
          kapitaen: istSpieler && form.kapitaen,
          neuzugang: form.neuzugang,
          aktiv: form.aktiv,
          im_verein_seit: seit,
          kontakt_text: form.rolle === 'teammanager' ? form.kontaktText.trim() || null : null,
          foto_url,
          freisteller_url,
          // v23-U: FuPa-Spieler-ID (für die Live-Bot-Zuordnung), nur Spieler.
          fupa_spieler_id: istSpieler && form.fupaId.trim() ? Number(form.fupaId) : null,
        } as RosterInput,
      })
      onClose()
    } catch (e) {
      setError(friendlyError(e, 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!row) return
    const ok = await confirm({
      title: `${row.name} löschen?`,
      description: inAufstellung
        ? 'Achtung: steht in der aktuellen Aufstellung. Besser „Aktiv“ ausschalten — dann bleibt alles nachvollziehbar.'
        : 'Endgültig entfernen. Tipp: „Aktiv“ ausschalten blendet nur aus und lässt sich rückgängig machen.',
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

  const karte = {
    name: form.name || (istSpieler ? 'Neuer Spieler' : 'Neue Person'),
    number: istSpieler && form.nummer ? Number(form.nummer) || null : null,
    position: istSpieler ? form.position : rolleLabel(form.rolle).toUpperCase(),
    photoUrl: neuesFoto ? vorschauUrl : foto.url,
    cutoutUrl: neuesFoto ? null : foto.cutout,
    isCaptain: istSpieler && form.kapitaen,
    isNewSigning: form.neuzugang,
    inactive: !form.aktiv,
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? `${row.name} bearbeiten` : istSpieler ? 'Spieler hinzufügen' : 'Trainerstab hinzufügen'}
      className="max-w-3xl"
      footer={
        <>
          {row && (
            <Button variant="ghost" onClick={remove} disabled={saving} className="mr-auto text-muted-foreground">
              <Trash2 className="h-4 w-4" /> Löschen
            </Button>
          )}
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving} className="min-w-28">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? 'Speichert …' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="grid gap-5 md:grid-cols-[240px_1fr]">
        {/* Links: Foto + Kartenvorschau */}
        <div className="flex flex-col items-center gap-3">
          {neuesFoto ? (
            <FotoZuschnitt img={neuesFoto.img} value={neuesFoto.crop} onChange={(crop) => setNeuesFoto({ ...neuesFoto, crop })} />
          ) : (
            <SpielerKarte p={karte} className="max-w-[150px] md:max-w-[220px]" />
          )}
          <input
            ref={fileRef}
            type="file"
            accept={ACCEPT_IMAGES}
            className="hidden"
            onChange={(e) => {
              void onFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          <div className="flex w-full max-w-[240px] flex-col gap-2">
            <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
              <Camera className="h-4 w-4" /> {foto.url || neuesFoto ? 'Anderes Foto' : 'Foto wählen'}
            </Button>
            {neuesFoto && (
              <Button type="button" variant="ghost" onClick={() => setNeuesFoto(null)}>
                Zuschnitt verwerfen
              </Button>
            )}
            {!neuesFoto && foto.url && (
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setFoto({ url: null, cutout: null })}>
                <ImageOff className="h-4 w-4" /> Foto entfernen
              </Button>
            )}
          </div>
          {neuesFoto && (
            <div className="w-full max-w-[240px]">
              <p className="mb-1 text-xs text-muted-foreground">So sieht die Karte aus:</p>
              <SpielerKarte p={karte} size="sm" className="mx-auto" />
            </div>
          )}
        </div>

        {/* Rechts: Felder */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="k-name">Name *</Label>
            <Input
              id="k-name"
              className="h-12 text-base"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="Vorname Nachname"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Rolle</Label>
            <div className="flex flex-wrap gap-2">
              {([{ value: 'spieler', label: 'Spieler' }, ...STAFF_ROLLEN] as { value: Rolle; label: string }[]).map((r) => (
                <ChipButton key={r.value} active={form.rolle === r.value} onClick={() => set('rolle', r.value)}>
                  {r.label}
                </ChipButton>
              ))}
            </div>
          </div>

          {istSpieler && (
            <>
              <div className="space-y-1.5">
                <Label>Position</Label>
                <div className="grid grid-cols-4 gap-2">
                  {POSITION_CODES.map((p) => (
                    <ChipButton key={p.value} active={form.position === p.value} onClick={() => set('position', p.value)} big>
                      <span className="block text-base font-bold">{p.kurz}</span>
                      <span className="block text-[10px] font-normal opacity-80">{p.label}</span>
                    </ChipButton>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-nr">Rückennummer (optional)</Label>
                <Input
                  id="k-nr"
                  className="h-12 w-28 text-base"
                  inputMode="numeric"
                  value={form.nummer}
                  onChange={(e) => set('nummer', e.target.value.replace(/\D/g, '').slice(0, 2))}
                  placeholder="–"
                />
                {nummerKonflikt && <p className="text-xs text-sva-gold">Nummer {form.nummer} hat schon {nummerKonflikt.name}.</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="k-fupa">FuPa-Spieler-ID (optional)</Label>
                <Input
                  id="k-fupa"
                  className="h-12 w-36 text-base"
                  inputMode="numeric"
                  value={form.fupaId}
                  onChange={(e) => set('fupaId', e.target.value.replace(/\D/g, '').slice(0, 10))}
                  placeholder="z. B. 701234"
                />
                <p className="text-xs text-muted-foreground">Verbindet den Spieler mit FuPa, damit der Live-Bot Tore richtig zuordnet. Am einfachsten im Ticker-Pult über „FuPa-Spieler zuordnen“.</p>
              </div>
            </>
          )}

          <div className="grid gap-2">
            {istSpieler && (
              <Switch checked={form.kapitaen} onChange={(v) => set('kapitaen', v)} label="Kapitän" hint="Es gibt nur einen — der bisherige wird abgelöst." />
            )}
            <Switch checked={form.neuzugang} onChange={(v) => set('neuzugang', v)} label="Neuzugang" hint="Neu in dieser Saison" />
            <Switch checked={form.aktiv} onChange={(v) => set('aktiv', v)} label="Aktiv" hint="Aus = auf der Website ausgeblendet, bleibt hier gespeichert" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="k-seit">Im Verein seit (optional)</Label>
            <Input
              id="k-seit"
              className="h-12 w-28 text-base"
              inputMode="numeric"
              value={form.seit}
              onChange={(e) => set('seit', e.target.value.replace(/\D/g, '').slice(0, 4))}
              placeholder="z. B. 2018"
            />
          </div>

          {form.rolle === 'teammanager' && (
            <div className="space-y-1.5">
              <Label htmlFor="k-kontakt">Vorformulierte Nachricht für „Schreib mir“ (optional)</Label>
              <Textarea id="k-kontakt" value={form.kontaktText} onChange={(e) => set('kontaktText', e.target.value)} placeholder="Hallo! Ich habe eine Frage zum SV Agathenburg-Dollern." />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
              {error}
            </p>
          )}
        </div>
      </div>
    </Modal>
  )
}

export function ChipButton({
  active,
  onClick,
  children,
  big,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  big?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'rounded-lg border px-3 text-sm font-medium transition-colors',
        big ? 'py-2' : 'min-h-[44px] py-2',
        active ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-transparent text-muted-foreground hover:bg-accent hover:text-foreground',
      )}
    >
      {children}
    </button>
  )
}
