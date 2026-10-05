import { useState } from 'react'
import { Loader2, Plus, Save, Trash2, Users, ExternalLink } from 'lucide-react'
import { Button } from './ui/button'
import { Card, CardContent } from './ui/card'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { useConfirm } from './ui/confirm'
import { useToast } from './ui/toast'
import { PflegeHinweis } from './PflegeHinweis'
import { friendlyError, isMissingSchema } from '../lib/db'
import { normalizeWhatsapp } from '../lib/pflege'
import { schluesselAus, useMannschaftLoeschen, useMannschaftSpeichern, useMannschaften, type MannschaftRow } from '../lib/mannschaften'

// ─────────────────────────────────────────────────────────────
// v18-A: Verein & Links → „Mannschaften (Probetraining)“.
// Welche Mannschaften der Probetraining-Assistent auf der Website anbietet —
// je Mannschaft optional eigene WhatsApp-Nummer + Ansprechpartner (z. B.
// Jugendtrainer). Leer = Haupt-WhatsApp oben. Wirkt nach „Veröffentlichen“.
// ─────────────────────────────────────────────────────────────

interface Form {
  name: string
  hinweis: string
  training: string
  ansprechpartner: string
  whatsapp: string
  sichtbar: boolean
}
const aus = (m?: MannschaftRow): Form => ({
  name: m?.name ?? '',
  hinweis: m?.hinweis ?? '',
  training: m?.training ?? '',
  ansprechpartner: m?.ansprechpartner ?? '',
  whatsapp: m?.whatsapp ?? '',
  sichtbar: m?.sichtbar ?? true,
})

export function MannschaftenKarte() {
  const q = useMannschaften()
  const [neu, setNeu] = useState(false)
  const schemaFehlt = q.error && isMissingSchema(q.error)
  const liste = q.data ?? []

  return (
    <Card>
      <CardContent className="space-y-4 p-4 md:p-5">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-wide">
          <Users className="h-5 w-5 text-muted-foreground" /> Mannschaften (Probetraining)
        </h2>
        <p className="text-sm text-muted-foreground">
          Diese Mannschaften kann man im Probetraining-Assistenten auf der Website wählen. Die Nachricht geht an die WhatsApp-Nummer der Mannschaft –
          ist keine eingetragen, an die WhatsApp-Nummer oben.
        </p>
        {schemaFehlt && <PflegeHinweis schema>Für diesen Bereich muss Marvin die Migration 20261009090000_sva_alltag.sql anwenden.</PflegeHinweis>}
        {q.error && !schemaFehlt && <PflegeHinweis title="Konnte nicht laden">{friendlyError(q.error)}</PflegeHinweis>}
        {liste.map((m) => (
          // key mit Änderungszeit → nach dem Speichern frisch aus der DB
          <Zeile key={`${m.id}-${m.updated_at}`} m={m} alle={liste} />
        ))}
        {neu ? (
          <Zeile alle={liste} onFertig={() => setNeu(false)} />
        ) : (
          !schemaFehlt && (
            <Button variant="outline" className="h-12 w-full md:w-auto" onClick={() => setNeu(true)}>
              <Plus className="h-4 w-4" /> Mannschaft hinzufügen
            </Button>
          )
        )}
      </CardContent>
    </Card>
  )
}

function Zeile({ m, alle, onFertig }: { m?: MannschaftRow; alle: MannschaftRow[]; onFertig?: () => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const save = useMannschaftSpeichern()
  const del = useMannschaftLoeschen()
  const [f, setF] = useState<Form>(aus(m))
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const dirty = JSON.stringify(f) !== JSON.stringify(aus(m))
  const wa = normalizeWhatsapp(f.whatsapp)
  const waOk = !f.whatsapp.trim() || !!wa
  const id = m?.id ?? 'neu'

  const speichern = async () => {
    const name = f.name.trim()
    if (name.length < 2) return toast.error('Bitte einen Namen eintragen, z. B. „2. Herren“.')
    if (!waOk) return toast.error('WhatsApp: Nummer nicht erkannt, z. B. 0151 12345678.')
    try {
      await save.mutateAsync({
        id: m?.id,
        input: {
          ...(m ? {} : { schluessel: schluesselAus(name, alle.map((x) => x.schluessel)), sortierung: (alle.at(-1)?.sortierung ?? 0) + 10 }),
          name,
          hinweis: f.hinweis.trim() || null,
          training: f.training.trim() || null,
          ansprechpartner: f.ansprechpartner.trim() || null,
          whatsapp: wa,
          sichtbar: f.sichtbar,
        },
      })
      toast.success('Gespeichert. Erscheint nach „Website veröffentlichen“.')
      onFertig?.()
    } catch (e) {
      toast.error(friendlyError(e, 'Speichern fehlgeschlagen.'))
    }
  }
  const loeschen = async () => {
    if (!m) return onFertig?.()
    if (!(await confirm({ title: `„${m.name}“ entfernen?`, description: 'Die Mannschaft verschwindet aus dem Probetraining-Assistenten. Tipp: „Auf der Website zeigen“ ausschalten geht auch.', confirmLabel: 'Entfernen', destructive: true }))) return
    try {
      await del.mutateAsync(m.id)
    } catch (e) {
      toast.error(friendlyError(e, 'Löschen fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-border p-3" data-testid={`mannschaft-${m?.schluessel ?? 'neu'}`}>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor={`m-name-${id}`}>Name</Label>
          <Input id={`m-name-${id}`} className="h-12 text-base" value={f.name} onChange={(e) => set('name', e.target.value)} placeholder="2. Herren" maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`m-hint-${id}`}>Kurzinfo (optional)</Label>
          <Input id={`m-hint-${id}`} className="h-12 text-base" value={f.hinweis} onChange={(e) => set('hinweis', e.target.value)} placeholder="ab 18 Jahren · 2. Kreisklasse" maxLength={120} />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label htmlFor={`m-tr-${id}`}>Training (optional)</Label>
          <Input id={`m-tr-${id}`} className="h-12 text-base" value={f.training} onChange={(e) => set('training', e.target.value)} placeholder="leer = Trainingszeiten und -ort von oben" maxLength={160} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`m-ap-${id}`}>Ansprechpartner (Vorname, optional)</Label>
          <Input id={`m-ap-${id}`} className="h-12 text-base" value={f.ansprechpartner} onChange={(e) => set('ansprechpartner', e.target.value)} placeholder="Jan" maxLength={40} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={`m-wa-${id}`}>WhatsApp dieser Mannschaft (optional)</Label>
          <div className="flex gap-2">
            <Input id={`m-wa-${id}`} className="h-12 text-base" inputMode="tel" value={f.whatsapp} onChange={(e) => set('whatsapp', e.target.value)} placeholder="leer = Haupt-WhatsApp" />
            {wa && (
              <Button asChild variant="outline" className="h-12 shrink-0">
                <a href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer" aria-label="Nummer testen">
                  <ExternalLink className="h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
          <p className={`text-xs ${waOk ? 'text-muted-foreground' : 'text-primary'}`}>{!waOk ? 'Nummer nicht erkannt' : wa ? `wird gespeichert als +${wa}` : 'Nachrichten gehen an die Haupt-Nummer.'}</p>
        </div>
      </div>
      <Switch checked={f.sichtbar} onChange={(v) => set('sichtbar', v)} label="Auf der Website zeigen" />
      <div className="flex flex-wrap gap-2">
        <Button className="h-11" onClick={() => void speichern()} disabled={(!dirty && !!m) || save.isPending}>
          {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {m ? (dirty ? 'Speichern' : 'Gespeichert') : 'Anlegen'}
        </Button>
        <Button variant="ghost" className="h-11 text-muted-foreground" onClick={() => void loeschen()}>
          <Trash2 className="h-4 w-4" /> {m ? 'Entfernen' : 'Abbrechen'}
        </Button>
      </div>
    </div>
  )
}
