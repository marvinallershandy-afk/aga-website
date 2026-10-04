import { useEffect, useMemo, useState } from 'react'
import { Plus, CalendarDays, Home, Bus, MapPin, Trash2, Loader2, ChevronDown, ExternalLink } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import type { SpielInput, SpielRow } from '../lib/db'
import { friendlyError } from '../lib/db'
import { useSettings, useSpiele, useSpieleMutations } from '../lib/queries'
import { formatAnstoss } from '../lib/format'
import { ergebnisArt, ergebnisOffen, ergebnisText, hatErgebnis, naechstesSpiel, paarung } from '../lib/spiele'
import { fussballDeUrl } from '../lib/pflege'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v14-C: Spielplan, vereinfacht. Drei Blöcke:
//   „Ergebnis fehlt“ (mit Schnell-Eingabe direkt in der Karte),
//   „Anstehend“, „Gespielt“. Antippen öffnet das Formular.
// Daten: sm_spiele (wie bisher; Archiv-Module lesen dieselben Zeilen).
// ─────────────────────────────────────────────────────────────

const HEIM_ORT = 'Waldsportplatz Agathenburg'
const WETTBEWERB = 'Kreisliga Stade'

export function Spiele() {
  const toast = useToast()
  const spieleQ = useSpiele()
  const settingsQ = useSettings()
  const { create, update, remove } = useSpieleMutations()
  const [editor, setEditor] = useState<{ open: boolean; row: SpielRow | null }>({ open: false, row: null })
  const [alleGespielt, setAlleGespielt] = useState(false)

  const spiele = useMemo(() => spieleQ.data ?? [], [spieleQ.data])
  const offen = ergebnisOffen(spiele).sort((a, b) => +new Date(b.anstoss) - +new Date(a.anstoss))
  const naechstes = naechstesSpiel(spiele)
  const offenIds = new Set(offen.map((s) => s.id))
  const anstehend = spiele
    .filter((s) => !hatErgebnis(s) && !offenIds.has(s.id))
    .sort((a, b) => +new Date(a.anstoss) - +new Date(b.anstoss))
  const gespielt = spiele.filter(hatErgebnis).sort((a, b) => +new Date(b.anstoss) - +new Date(a.anstoss))
  const teamId = settingsQ.data?.fussball_de_team_id

  const speichern = async (input: SpielInput, id?: string) => {
    if (id) await update.mutateAsync({ id, patch: input })
    else await create.mutateAsync(input)
    toast.success('Spiel gespeichert. Erscheint nach „Website veröffentlichen“.')
  }

  return (
    <>
      <PageHeader
        title="Spiele"
        subtitle="Spielplan und Ergebnisse — daraus entstehen nächstes Spiel, letztes Ergebnis und Form auf der Website."
        actions={
          <div className="flex w-full gap-2 sm:w-auto">
            {teamId && (
              <Button asChild variant="outline" className="flex-1 sm:flex-none">
                <a href={fussballDeUrl(teamId)} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> fussball.de
                </a>
              </Button>
            )}
            <Button className="flex-1 sm:flex-none" onClick={() => setEditor({ open: true, row: null })}>
              <Plus className="h-4 w-4" /> Spiel
            </Button>
          </div>
        }
      />

      {spieleQ.error && !spieleQ.isPending && (
        <ErrorState className="mb-4" message={friendlyError(spieleQ.error)} onRetry={() => void spieleQ.refetch()} />
      )}

      {spieleQ.isPending ? (
        <SkeletonRows rows={5} />
      ) : spiele.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Noch keine Spiele"
          description="Trag das nächste Spiel ein — die Website zeigt dann Gegner, Anstoß und Countdown."
          action={
            <Button onClick={() => setEditor({ open: true, row: null })}>
              <Plus className="h-4 w-4" /> Erstes Spiel anlegen
            </Button>
          }
        />
      ) : (
        <div className="space-y-7">
          {offen.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-lg tracking-wide text-primary">Ergebnis fehlt</h2>
              <div className="space-y-2">
                {offen.map((s) => (
                  <SchnellErgebnis
                    key={s.id}
                    spiel={s}
                    onOpen={() => setEditor({ open: true, row: s })}
                    onSave={async (tore_sva, tore_gegner) => {
                      try {
                        await update.mutateAsync({ id: s.id, patch: { tore_sva, tore_gegner } })
                        toast.success(`Ergebnis gespeichert: ${paarung(s)}.`)
                      } catch (e) {
                        toast.error(friendlyError(e))
                      }
                    }}
                  />
                ))}
              </div>
            </section>
          )}

          <section>
            <h2 className="mb-2 font-display text-lg tracking-wide">Anstehend</h2>
            {anstehend.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein anstehendes Spiel eingetragen.</p>
            ) : (
              <SpielListe rows={anstehend} hervorheben={naechstes?.id} onOpen={(row) => setEditor({ open: true, row })} />
            )}
          </section>

          {gespielt.length > 0 && (
            <section>
              <h2 className="mb-2 font-display text-lg tracking-wide">Gespielt</h2>
              <SpielListe rows={alleGespielt ? gespielt : gespielt.slice(0, 5)} onOpen={(row) => setEditor({ open: true, row })} />
              {gespielt.length > 5 && (
                <Button variant="ghost" size="sm" className="mt-2" onClick={() => setAlleGespielt((v) => !v)}>
                  <ChevronDown className={cn('h-4 w-4 transition-transform', alleGespielt && 'rotate-180')} />
                  {alleGespielt ? 'Weniger zeigen' : `Alle ${gespielt.length} zeigen`}
                </Button>
              )}
            </section>
          )}
        </div>
      )}

      <SpielFormular
        open={editor.open}
        row={editor.row}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        onSave={speichern}
        onDelete={async (id) => {
          await remove.mutateAsync(id)
          toast.success('Spiel gelöscht.')
        }}
      />
    </>
  )
}

function SpielListe({ rows, hervorheben, onOpen }: { rows: SpielRow[]; hervorheben?: string; onOpen: (r: SpielRow) => void }) {
  return (
    <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
      {rows.map((s) => {
        const art = ergebnisArt(s)
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => onOpen(s)}
              className={cn('flex min-h-[64px] w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-accent/40', hervorheben === s.id && 'bg-primary/10')}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary" title={s.heim ? 'Heim' : 'Auswärts'}>
                {s.heim ? <Home className="h-4 w-4" /> : <Bus className="h-4 w-4" />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  {paarung(s)}
                  {hervorheben === s.id && <span className="ml-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold uppercase text-white">Nächstes</span>}
                </span>
                <span className="block truncate text-sm text-muted-foreground">
                  {formatAnstoss(s.anstoss)}
                  {s.ort ? ` · ${s.ort}` : ''}
                </span>
              </span>
              {hatErgebnis(s) && (
                <span
                  className={cn(
                    'shrink-0 rounded-md px-2.5 py-1 font-display text-lg tabular-nums',
                    art === 'W' && 'bg-green-600/25 text-green-300',
                    art === 'U' && 'bg-secondary text-foreground',
                    art === 'N' && 'bg-primary/25 text-red-200',
                  )}
                >
                  {ergebnisText(s)}
                </span>
              )}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function SchnellErgebnis({ spiel, onOpen, onSave }: { spiel: SpielRow; onOpen: () => void; onSave: (sva: number, gegner: number) => Promise<void> }) {
  const [sva, setSva] = useState('')
  const [geg, setGeg] = useState('')
  const [busy, setBusy] = useState(false)
  const ok = sva !== '' && geg !== ''
  // Eingabefelder in Paarungs-Reihenfolge (Heim links).
  const links = spiel.heim ? { label: 'SVA', v: sva, set: setSva } : { label: spiel.gegner, v: geg, set: setGeg }
  const rechts = spiel.heim ? { label: spiel.gegner, v: geg, set: setGeg } : { label: 'SVA', v: sva, set: setSva }
  const zahl = (v: string) => v.replace(/\D/g, '').slice(0, 2)

  return (
    <Card className="border-primary/40">
      <CardContent className="space-y-3 p-4">
        <button type="button" onClick={onOpen} className="block text-left">
          <span className="block font-medium">{paarung(spiel)}</span>
          <span className="block text-sm text-muted-foreground">{formatAnstoss(spiel.anstoss)}</span>
        </button>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label className="block truncate text-xs text-muted-foreground">{links.label}</Label>
            <Input inputMode="numeric" className="h-14 text-center font-display text-2xl" value={links.v} onChange={(e) => links.set(zahl(e.target.value))} aria-label={`Tore ${links.label}`} />
          </div>
          <span className="pb-3 font-display text-2xl text-muted-foreground">:</span>
          <div className="flex-1 space-y-1">
            <Label className="block truncate text-xs text-muted-foreground">{rechts.label}</Label>
            <Input inputMode="numeric" className="h-14 text-center font-display text-2xl" value={rechts.v} onChange={(e) => rechts.set(zahl(e.target.value))} aria-label={`Tore ${rechts.label}`} />
          </div>
          <Button
            className="h-14 px-5"
            disabled={!ok || busy}
            onClick={async () => {
              setBusy(true)
              await onSave(Number(sva), Number(geg))
              setBusy(false)
            }}
          >
            {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Speichern'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Formular ────────────────────────────────────────────────────────────────
interface Form {
  gegner: string
  heim: boolean
  datum: string // yyyy-mm-dd
  zeit: string // hh:mm
  ort: string
  wettbewerb: string
  toreSva: string
  toreGegner: string
}

const pad = (n: number) => String(n).padStart(2, '0')
function toForm(row: SpielRow | null): Form {
  if (!row) return { gegner: '', heim: true, datum: '', zeit: '15:00', ort: HEIM_ORT, wettbewerb: WETTBEWERB, toreSva: '', toreGegner: '' }
  const d = new Date(row.anstoss)
  return {
    gegner: row.gegner,
    heim: row.heim,
    datum: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    zeit: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
    ort: row.ort ?? '',
    wettbewerb: row.wettbewerb ?? '',
    toreSva: row.tore_sva != null ? String(row.tore_sva) : '',
    toreGegner: row.tore_gegner != null ? String(row.tore_gegner) : '',
  }
}

function SpielFormular({
  open,
  row,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  row: SpielRow | null
  onClose: () => void
  onSave: (input: SpielInput, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const confirm = useConfirm()
  const [f, setF] = useState<Form>(toForm(null))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setF(toForm(row))
    setError(null)
  }, [open, row])

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }))
  const zahl = (v: string) => v.replace(/\D/g, '').slice(0, 2)

  const submit = async () => {
    if (!f.gegner.trim()) return setError('Bitte den Gegner eintragen.')
    if (!f.datum) return setError('Bitte ein Datum wählen.')
    const anstoss = new Date(`${f.datum}T${f.zeit || '15:00'}`)
    if (Number.isNaN(anstoss.getTime())) return setError('Datum/Uhrzeit ungültig.')
    if ((f.toreSva === '') !== (f.toreGegner === '')) return setError('Ergebnis bitte vollständig (beide Seiten) oder gar nicht.')
    setSaving(true)
    setError(null)
    try {
      await onSave(
        {
          gegner: f.gegner.trim(),
          heim: f.heim,
          anstoss: anstoss.toISOString(),
          ort: f.ort.trim() || null,
          wettbewerb: f.wettbewerb.trim() || null,
          tore_sva: f.toreSva === '' ? null : Number(f.toreSva),
          tore_gegner: f.toreGegner === '' ? null : Number(f.toreGegner),
        },
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
    const ok = await confirm({ title: 'Spiel löschen?', description: `${paarung(row)} wird entfernt.`, confirmLabel: 'Löschen', destructive: true })
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

  const istVergangen = f.datum && new Date(`${f.datum}T${f.zeit || '15:00'}`).getTime() < Date.now()

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? 'Spiel bearbeiten' : 'Spiel hinzufügen'}
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
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Speichert …' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="space-y-1.5">
        <Label htmlFor="s-gegner">Gegner *</Label>
        <Input id="s-gegner" className="h-12 text-base" value={f.gegner} onChange={(e) => set('gegner', e.target.value)} placeholder="z. B. TuS Harsefeld" />
      </div>

      <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Heim oder Auswärts">
        {[
          { v: true, label: 'Heimspiel', icon: Home },
          { v: false, label: 'Auswärts', icon: Bus },
        ].map((o) => (
          <button
            key={o.label}
            type="button"
            role="radio"
            aria-checked={f.heim === o.v}
            onClick={() => setF((x) => ({ ...x, heim: o.v, ort: o.v ? (x.ort || HEIM_ORT) : x.ort === HEIM_ORT ? '' : x.ort }))}
            className={cn(
              'flex min-h-[48px] items-center justify-center gap-2 rounded-lg border text-sm font-medium',
              f.heim === o.v ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:bg-accent',
            )}
          >
            <o.icon className="h-4 w-4" /> {o.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="s-datum">Datum *</Label>
          <Input id="s-datum" type="date" className="h-12 text-base" value={f.datum} onChange={(e) => set('datum', e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="s-zeit">Anstoß</Label>
          <Input id="s-zeit" type="time" className="h-12 w-32 text-base" value={f.zeit} onChange={(e) => set('zeit', e.target.value)} />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-ort" className="flex items-center gap-1">
          <MapPin className="h-3.5 w-3.5" /> Ort
        </Label>
        <Input id="s-ort" className="h-12 text-base" value={f.ort} onChange={(e) => set('ort', e.target.value)} placeholder={f.heim ? HEIM_ORT : 'Sportplatz des Gegners'} />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="s-wb">Wettbewerb</Label>
        <Input id="s-wb" className="h-12 text-base" value={f.wettbewerb} onChange={(e) => set('wettbewerb', e.target.value)} placeholder={WETTBEWERB} />
      </div>

      <fieldset className={cn('rounded-lg border p-3', istVergangen ? 'border-primary/50' : 'border-border')}>
        <legend className="px-1 text-xs uppercase tracking-wide text-muted-foreground">Ergebnis {istVergangen ? '' : '(nach dem Spiel)'}</legend>
        <div className="flex items-end gap-2">
          <div className="flex-1 space-y-1">
            <Label htmlFor="s-sva" className="text-xs text-muted-foreground">SVA</Label>
            <Input id="s-sva" inputMode="numeric" className="h-12 text-center font-display text-xl" value={f.toreSva} onChange={(e) => set('toreSva', zahl(e.target.value))} />
          </div>
          <span className="pb-2.5 font-display text-xl text-muted-foreground">:</span>
          <div className="flex-1 space-y-1">
            <Label htmlFor="s-geg" className="truncate text-xs text-muted-foreground">{f.gegner || 'Gegner'}</Label>
            <Input id="s-geg" inputMode="numeric" className="h-12 text-center font-display text-xl" value={f.toreGegner} onChange={(e) => set('toreGegner', zahl(e.target.value))} />
          </div>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </Modal>
  )
}
