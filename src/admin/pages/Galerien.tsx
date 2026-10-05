import { useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, Camera, ExternalLink, ImagePlus, Loader2, Plus, Star, Trash2 } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { PflegeHinweis } from '../components/PflegeHinweis'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useSpiele } from '../lib/queries'
import { ACCEPT_IMAGES } from '../lib/image'
import { cn } from '../lib/utils'
import {
  NELE_DEFAULT,
  publicUrl,
  slugify,
  useBilder,
  useBilderMutations,
  useGalerieMutations,
  useGalerien,
  type BildRow,
  type GalerieInput,
  type GalerieRow,
} from '../lib/galerien'

// ─────────────────────────────────────────────────────────────
// v17-D: Admin → Galerien („Spieltag in Bildern“ der Vereinsfotografin).
// Liste → Galerie öffnen → Angaben + Fotos (Mehrfach-Upload, im Browser
// auf 2000 px + 800-px-Vorschau verkleinert), Reihenfolge, Titelbild,
// Alt-Text. Öffentlich: Fans-Panel der Karte + /galerie — nach
// „Website veröffentlichen“.
// ─────────────────────────────────────────────────────────────

const datumDe = (d: string | null) => (d ? new Date(d + 'T12:00:00').toLocaleDateString('de-DE') : 'ohne Datum')

export function Galerien() {
  const q = useGalerien()
  const [offen, setOffen] = useState<string | null>(null)
  const [neu, setNeu] = useState(false)
  const g = q.data?.find((x) => x.id === offen) ?? null

  if (q.error && isMissingSchema(q.error)) {
    return (
      <>
        <PageHeader title="Galerien" />
        <PflegeHinweis schema title="Galerien brauchen die Galerie-Migration">
          Marvin wendet einmalig <code>20261008100000_sva_galerien.sql</code> an. Bis dahin zeigt die Website die
          Pokal-Galerie aus dem Code.
        </PflegeHinweis>
      </>
    )
  }

  if (g || neu) {
    return (
      <GalerieEditor
        galerie={g}
        onZurueck={() => {
          setOffen(null)
          setNeu(false)
        }}
        onAngelegt={(id) => {
          setNeu(false)
          setOffen(id)
        }}
      />
    )
  }

  const rows = q.data ?? []
  return (
    <>
      <PageHeader
        title="Galerien"
        subtitle="„Spieltag in Bildern“ — Fotos der Vereinsfotografin für die Karte (Fans) und /galerie."
        actions={
          <Button onClick={() => setNeu(true)}>
            <Plus className="h-4 w-4" /> Neue Galerie
          </Button>
        }
      />
      {q.error && !q.isPending && <ErrorState className="mb-4" message={friendlyError(q.error)} onRetry={() => void q.refetch()} />}
      {q.isPending ? (
        <SkeletonRows rows={3} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Camera}
          title="Noch keine Galerie"
          description="Leg eine Galerie an (z. B. „Heimspiel gegen …“) und lade die Fotos hoch. Bis eine veröffentlicht ist, zeigt die Website die Pokal-Galerie."
          action={
            <Button onClick={() => setNeu(true)}>
              <Plus className="h-4 w-4" /> Erste Galerie
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                onClick={() => setOffen(r.id)}
                className="group block w-full overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:border-foreground/40"
              >
                <div className="aspect-[3/2] bg-secondary">
                  {r.cover && <img src={publicUrl(r.cover)} alt="" className="h-full w-full object-cover" loading="lazy" />}
                </div>
                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{datumDe(r.datum)} · {r.anzahl} Fotos</span>
                    <span className={cn('rounded px-1.5 py-0.5 font-medium', r.veroeffentlicht ? 'bg-emerald-500/15 text-emerald-400' : 'bg-secondary text-muted-foreground')}>
                      {r.veroeffentlicht ? 'Veröffentlicht' : 'Entwurf'}
                    </span>
                  </div>
                  <div className="mt-1 font-display text-lg leading-tight tracking-wide">{r.titel}</div>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function GalerieEditor({ galerie, onZurueck, onAngelegt }: { galerie: GalerieRow | null; onZurueck: () => void; onAngelegt: (id: string) => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const spiele = useSpiele()
  const { save, remove } = useGalerieMutations()
  const [f, setF] = useState<GalerieInput>(() =>
    galerie
      ? { ...galerie }
      : { titel: '', slug: '', untertitel: '', datum: new Date().toISOString().slice(0, 10), spiel_id: null, ...NELE_DEFAULT, veroeffentlicht: false, sortierung: 0 },
  )
  const [slugBearbeitet, setSlugBearbeitet] = useState(!!galerie)
  const set = (patch: GalerieInput) => setF((x) => ({ ...x, ...patch }))

  const speichern = async () => {
    const titel = (f.titel ?? '').trim()
    if (titel.length < 2) return toast.error('Bitte einen Titel eingeben.')
    const slug = slugify(f.slug || titel)
    try {
      const id = await save.mutateAsync({
        id: galerie?.id,
        input: {
          ...f,
          titel,
          slug,
          untertitel: (f.untertitel ?? '').trim() || null,
          fotograf: (f.fotograf ?? '').trim() || NELE_DEFAULT.fotograf,
          fotograf_url: (f.fotograf_url ?? '').trim() || null,
          datum: f.datum || null,
          spiel_id: f.spiel_id || null,
        },
      })
      toast.success(galerie ? 'Gespeichert.' : 'Galerie angelegt — jetzt Fotos hochladen.')
      if (!galerie) onAngelegt(id)
    } catch (e) {
      toast.error(/slug/i.test(String((e as Error)?.message)) ? 'Diese Adresse (Slug) gibt es schon — bitte anpassen.' : friendlyError(e))
    }
  }

  const loeschen = async () => {
    if (!galerie) return
    const ok = await confirm({ title: 'Galerie löschen?', description: `„${galerie.titel}“ mit allen Fotos wird entfernt.`, confirmLabel: 'Löschen', destructive: true })
    if (!ok) return
    try {
      await remove.mutateAsync(galerie)
      toast.success('Galerie gelöscht.')
      onZurueck()
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const heimspiele = (spiele.data ?? []).slice().sort((a, b) => b.anstoss.localeCompare(a.anstoss)).slice(0, 40)

  return (
    <>
      <button type="button" onClick={onZurueck} className="mb-4 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Alle Galerien
      </button>
      <PageHeader
        title={galerie ? galerie.titel : 'Neue Galerie'}
        subtitle="Änderungen erscheinen nach „Website veröffentlichen“ auf der Karte (Fans) und unter /galerie."
        actions={
          galerie?.veroeffentlicht ? (
            <a className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground" href={`/galerie#${galerie.slug}`} target="_blank" rel="noreferrer">
              Ansehen <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : undefined
        }
      />

      <section className="mb-6 grid gap-4 rounded-lg border border-border bg-card p-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="g-titel">Titel</Label>
          <Input
            id="g-titel"
            value={f.titel ?? ''}
            placeholder="z. B. Heimspiel gegen TSV Hollern"
            onChange={(e) => set({ titel: e.target.value, ...(slugBearbeitet ? {} : { slug: slugify(e.target.value) }) })}
          />
        </div>
        <div>
          <Label htmlFor="g-datum">Datum</Label>
          <Input id="g-datum" type="date" value={f.datum ?? ''} onChange={(e) => set({ datum: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="g-spiel">Spiel (optional)</Label>
          <Select id="g-spiel" value={f.spiel_id ?? ''} onChange={(e) => set({ spiel_id: e.target.value || null })}>
            <option value="">— kein Spiel —</option>
            {heimspiele.map((s) => (
              <option key={s.id} value={s.id}>
                {new Date(s.anstoss).toLocaleDateString('de-DE')} · {s.heim ? 'gegen' : 'bei'} {s.gegner}
              </option>
            ))}
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Label htmlFor="g-unter">Unterzeile (optional)</Label>
          <Input id="g-unter" value={f.untertitel ?? ''} placeholder="Ein Satz zum Tag" onChange={(e) => set({ untertitel: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="g-foto">Fotograf</Label>
          <Input id="g-foto" value={f.fotograf ?? ''} onChange={(e) => set({ fotograf: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="g-fotourl">Link Fotograf (https)</Label>
          <Input id="g-fotourl" value={f.fotograf_url ?? ''} onChange={(e) => set({ fotograf_url: e.target.value })} />
        </div>
        <div>
          <Label htmlFor="g-slug">Adresse</Label>
          <Input
            id="g-slug"
            value={f.slug ?? ''}
            onChange={(e) => {
              setSlugBearbeitet(true)
              set({ slug: e.target.value })
            }}
          />
          <p className="mt-1 text-xs text-muted-foreground">/galerie#{slugify(f.slug || f.titel || '')}</p>
        </div>
        <div className="self-end">
          <Switch checked={!!f.veroeffentlicht} onChange={(v) => set({ veroeffentlicht: v })} label="Veröffentlicht" hint="Erst sichtbar, wenn Fotos drin sind." />
        </div>
        <div className="flex flex-wrap gap-2 sm:col-span-2">
          <Button onClick={() => void speichern()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {galerie ? 'Speichern' : 'Anlegen'}
          </Button>
          {galerie && (
            <Button variant="outline" onClick={() => void loeschen()} disabled={remove.isPending}>
              <Trash2 className="h-4 w-4" /> Galerie löschen
            </Button>
          )}
        </div>
      </section>

      {galerie && <BilderBereich galerie={galerie} />}
    </>
  )
}

function BilderBereich({ galerie }: { galerie: GalerieRow }) {
  const toast = useToast()
  const confirm = useConfirm()
  const q = useBilder(galerie.id)
  const { hochladen, aendern, titelbild, loeschen } = useBilderMutations(galerie)
  const input = useRef<HTMLInputElement>(null)
  const [fortschritt, setFortschritt] = useState<{ fertig: number; gesamt: number } | null>(null)
  const bilder = useMemo(() => q.data ?? [], [q.data])

  const onDateien = async (list: FileList | null) => {
    const files = [...(list ?? [])].filter((x) => x.type.startsWith('image/'))
    if (!files.length) return
    setFortschritt({ fertig: 0, gesamt: files.length })
    try {
      await hochladen.mutateAsync({ files, start: bilder.length, onFortschritt: (fertig) => setFortschritt({ fertig, gesamt: files.length }) })
      toast.success(`${files.length} Foto${files.length === 1 ? '' : 's'} hochgeladen.`)
    } catch (e) {
      toast.error(friendlyError(e, 'Hochladen fehlgeschlagen.'))
    } finally {
      setFortschritt(null)
      if (input.current) input.current.value = ''
    }
  }

  const verschieben = async (i: number, d: -1 | 1) => {
    const ziel = i + d
    if (ziel < 0 || ziel >= bilder.length) return
    const neu = [...bilder]
    ;[neu[i], neu[ziel]] = [neu[ziel], neu[i]]
    try {
      for (let k = 0; k < neu.length; k++) {
        const soll = (k + 1) * 10
        if (neu[k].reihenfolge !== soll) await aendern.mutateAsync({ id: neu[k].id, patch: { reihenfolge: soll } })
      }
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  const weg = async (b: BildRow) => {
    if (!(await confirm({ title: 'Foto entfernen?', confirmLabel: 'Entfernen', destructive: true }))) return
    try {
      await loeschen.mutateAsync(b)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl">Fotos {bilder.length > 0 && <span className="text-muted-foreground">({bilder.length})</span>}</h2>
        <div className="flex items-center gap-3">
          {fortschritt && (
            <span className="text-sm text-muted-foreground" aria-live="polite">
              <Loader2 className="mr-1 inline h-4 w-4 animate-spin" />
              {fortschritt.fertig} von {fortschritt.gesamt} …
            </span>
          )}
          <input ref={input} type="file" accept={ACCEPT_IMAGES} multiple hidden onChange={(e) => void onDateien(e.target.files)} />
          <Button onClick={() => input.current?.click()} disabled={!!fortschritt}>
            <ImagePlus className="h-4 w-4" /> Fotos hinzufügen
          </Button>
        </div>
      </div>
      <p className="mb-4 max-w-2xl text-sm text-muted-foreground">
        Mehrere Fotos auf einmal wählen. Sie werden im Browser verkleinert (2000 px + Vorschau). Stern = Titelbild. Kurzer
        Alt-Text hilft Blinden und Google („Jubel nach dem 2:1“). Keine Kinder ohne Einverständnis der Eltern, kein Alkohol im Fokus.
      </p>
      {q.isPending ? (
        <SkeletonRows rows={2} />
      ) : bilder.length === 0 ? (
        <EmptyState icon={ImagePlus} title="Noch keine Fotos" description="„Fotos hinzufügen“ — am Handy direkt aus der Galerie." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {bilder.map((b, i) => (
            <li key={b.id} className={cn('overflow-hidden rounded-lg border bg-card', b.titelbild ? 'border-primary' : 'border-border')}>
              <div className="relative aspect-[3/2] bg-secondary">
                <img src={publicUrl(b.vorschau_pfad ?? b.pfad)} alt="" className="h-full w-full object-cover" loading="lazy" />
                {b.titelbild && <span className="absolute left-2 top-2 rounded bg-primary px-1.5 py-0.5 text-xs font-medium text-primary-foreground">Titelbild</span>}
              </div>
              <div className="flex flex-col gap-2 p-2">
                <Input
                  aria-label="Alt-Text"
                  defaultValue={b.alt_text ?? ''}
                  placeholder="Was ist zu sehen?"
                  onBlur={(e) => {
                    const v = e.target.value.trim()
                    if (v !== (b.alt_text ?? '')) aendern.mutate({ id: b.id, patch: { alt_text: v || null } })
                  }}
                />
                <div className="flex items-center gap-1">
                  <Button size="icon" variant={b.titelbild ? 'default' : 'ghost'} aria-label="Als Titelbild" onClick={() => titelbild.mutate(b.id)}>
                    <Star className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Nach vorn" disabled={i === 0} onClick={() => void verschieben(i, -1)}>
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" aria-label="Nach hinten" disabled={i === bilder.length - 1} onClick={() => void verschieben(i, 1)}>
                    <ArrowDown className="h-4 w-4" />
                  </Button>
                  <span className="flex-1" />
                  <Button size="icon" variant="ghost" aria-label="Foto entfernen" onClick={() => void weg(b)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
