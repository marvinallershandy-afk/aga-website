import { useState } from 'react'
import { Plus, Target, Trash2, Wand2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Modal } from '../../components/ui/modal'
import { Select } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { SkeletonRows } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { useToast } from '../../components/ui/toast'
import { useConfirm } from '../../components/ui/confirm'
import { friendlyError } from '../../lib/db'
import { useRoster } from '../../lib/queries'
import { useKarten, useAlbumStatistik } from '../../lib/album'
import { useZiele, useZielMutations, useZielStatus, type ZielInput, type ZielRow, type ZielTyp } from '../../lib/albumV20'
import { cn } from '../../lib/utils'

// ─────────────────────────────────────────────────────────────
// v20-K: Admin → Album → Ziele. Sammelziele/Missionen aus Vorlagen:
// Familie (Personen), Set (Karten), Kapitel, Serie (Check-ins/Tipps in
// Folge), Sozial (erster Tausch, Freund geworben), Tipp-Liga (extern,
// Auslöser aus der Tipp-Liga), Wochen-Challenge (gültig von–bis),
// Meilenstein. Belohnung: Pack (Größe, Mindest-Seltenheit) + Lose.
// Übersicht, wer was erreicht hat.
// ─────────────────────────────────────────────────────────────

const VORLAGEN: { id: string; titel: string; typ: ZielTyp; hilfe: string }[] = [
  { id: 'familie', titel: 'Familie / Verwandte', typ: 'set', hilfe: 'Brüder, Zwillinge, Vater & Sohn — Personen wählen (Trainerstab zählt mit).' },
  { id: 'set', titel: 'Karten-Set', typ: 'set', hilfe: 'Frei wählbare Kartenmenge, z. B. alle Meister-Momente.' },
  { id: 'kapitel', titel: 'Kapitel komplett', typ: 'kapitel', hilfe: 'Alle Plätze eines Kapitels.' },
  { id: 'serie', titel: 'Serie', typ: 'serie_checkin', hilfe: 'X Heimspiele in Folge eingecheckt oder X Wochen in Folge getippt.' },
  { id: 'sozial', titel: 'Sozial', typ: 'sozial_tausch', hilfe: 'Erster Tausch oder Freund geworben.' },
  { id: 'tipp', titel: 'Tipp-Liga', typ: 'extern', hilfe: 'Auslöser kommt aus der Tipp-Liga (Schlüssel z. B. tipp_exakt).' },
  { id: 'challenge', titel: 'Wochen-Challenge', typ: 'set', hilfe: 'Beliebiges Ziel mit Zeitraum von–bis.' },
  { id: 'meilenstein', titel: 'Meilenstein', typ: 'meilenstein', hilfe: 'Album zu X % gefüllt.' },
]
const KAPITEL = [
  ['TW', 'Tor'],
  ['ABW', 'Abwehr'],
  ['MIT', 'Mittelfeld'],
  ['ANG', 'Sturm'],
  ['stab', 'Trainerstab'],
  ['moment', 'Momente'],
  ['fan', 'Kurve'],
  ['partner', 'Partner'],
] as const
const slug = (t: string) =>
  t
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 50)

export function ZieleTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const ziele = useZiele()
  const status = useZielStatus()
  const { save, remove, standard } = useZielMutations()
  const [editor, setEditor] = useState<{ row: ZielRow | null; vorlage?: string } | null>(null)
  const zaehl = new Map((status.data?.ziele ?? []).map((z) => [z.id, z.erreicht]))
  const rows = ziele.data ?? []

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={async () => {
            try {
              const r = await standard.mutateAsync()
              toast.success(`${r.angelegt} Standard-Ziele angelegt (insgesamt ${r.gesamt}).`)
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
          disabled={standard.isPending}
        >
          <Wand2 className="h-4 w-4" /> Standard-Ziele anlegen
        </Button>
        <Select aria-label="Neues Ziel aus Vorlage" value="" onChange={(e) => e.target.value && setEditor({ row: null, vorlage: e.target.value })} className="w-auto">
          <option value="">+ Neues Ziel aus Vorlage …</option>
          {VORLAGEN.map((v) => (
            <option key={v.id} value={v.id}>
              {v.titel}
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        Ziele machen Lust aufs Weitersammeln: Wer ein Set komplett hat, eine Serie hält oder eine Mission schafft, bekommt ein Pack und/oder Lose. Geheime Missionen sieht ein Fan erst, wenn er sie
        erreicht hat. „Nächstes Ziel“ zeigt das Album oben an.
      </p>
      {ziele.isLoading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Target} title="Noch keine Ziele" description="„Standard-Ziele anlegen“ legt Familien-Sets, Kapitel, Meilensteine, Serien und Tipp-Liga-Ziele an." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((z) => (
            <li key={z.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', !z.aktiv && 'opacity-60')}>
              <div className="min-w-0 flex-1">
                <p className="font-medium">
                  {z.titel}
                  {z.geheim && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] uppercase tracking-wide">geheim</span>}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {VORLAGEN.find((v) => v.id === z.vorlage)?.titel ?? z.typ}
                  {z.beschreibung ? ` · ${z.beschreibung}` : ''} · Belohnung: {z.belohnung_karten ? `${z.belohnung_karten} Karte${z.belohnung_karten > 1 ? 'n' : ''}` : 'keine Karte'}
                  {z.belohnung_min_seltenheit && z.belohnung_min_seltenheit !== 'bronze' ? ` (mind. ${z.belohnung_min_seltenheit})` : ''}
                  {z.belohnung_lose ? ` + ${z.belohnung_lose} Lose` : ''}
                  {z.gueltig_bis ? ` · bis ${new Date(z.gueltig_bis).toLocaleDateString('de-DE')}` : ''}
                </p>
              </div>
              <span className="rounded-full bg-secondary px-3 py-1 text-sm font-semibold tabular-nums" title="Fans, die das Ziel erreicht haben">
                {zaehl.get(z.id) ?? 0}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  try {
                    await save.mutateAsync({ id: z.id, input: { aktiv: !z.aktiv } })
                  } catch (e) {
                    toast.error(friendlyError(e))
                  }
                }}
              >
                {z.aktiv ? 'Pausieren' : 'Aktivieren'}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditor({ row: z })}>
                Bearbeiten
              </Button>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`${z.titel} löschen`}
                onClick={async () => {
                  if (!(await confirm({ title: 'Ziel löschen?', description: 'Erreichte Belohnungen bleiben bei den Fans.', confirmLabel: 'Löschen', destructive: true }))) return
                  try {
                    await remove.mutateAsync(z.id)
                  } catch (e) {
                    toast.error(friendlyError(e))
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <section className="space-y-2">
        <h2 className="font-display text-xl">Zuletzt erreicht</h2>
        {(status.data?.erreicht ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">Noch niemand — die ersten Packs entscheiden.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border text-sm">
            {(status.data?.erreicht ?? []).slice(0, 30).map((e, i) => (
              <li key={i} className="flex gap-3 px-4 py-2">
                <span className="w-32 shrink-0 text-muted-foreground">{new Date(e.at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="font-medium">{e.name}</span>
                <span className="text-muted-foreground">{e.titel}</span>
                {e.lose > 0 && <span className="ml-auto text-muted-foreground">+{e.lose} Lose</span>}
              </li>
            ))}
          </ul>
        )}
      </section>
      {editor && <ZielEditor row={editor.row} vorlage={editor.vorlage} onClose={() => setEditor(null)} />}
    </div>
  )
}

function ZielEditor({ row, vorlage, onClose }: { row: ZielRow | null; vorlage?: string; onClose: () => void }) {
  const toast = useToast()
  const { save } = useZielMutations()
  const roster = useRoster()
  const karten = useKarten()
  const stat = useAlbumStatistik()
  const v = VORLAGEN.find((x) => x.id === (row?.vorlage ?? vorlage)) ?? VORLAGEN[1]
  const [f, setF] = useState<ZielInput>(() =>
    row ?? {
      vorlage: v.id,
      typ: v.typ,
      titel: '',
      beschreibung: null,
      karten: [],
      roster_ids: [],
      kapitel: v.id === 'kapitel' ? 'TW' : null,
      anzahl: v.id === 'serie' ? 3 : v.id === 'meilenstein' ? 50 : null,
      belohnung_karten: v.id === 'familie' ? 3 : 1,
      belohnung_min_seltenheit: null,
      belohnung_lose: 0,
      geheim: false,
      wiederholbar: v.id === 'tipp',
      aktiv: true,
      saison: stat.data?.saison ?? null,
      gueltig_von: v.id === 'challenge' ? new Date().toISOString() : null,
      gueltig_bis: v.id === 'challenge' ? new Date(Date.now() + 7 * 864e5).toISOString() : null,
    },
  )
  const set = (p: ZielInput) => setF((x) => ({ ...x, ...p }))
  const toggle = (feld: 'karten' | 'roster_ids', id: string) => {
    const l = new Set(f[feld] ?? [])
    if (l.has(id)) l.delete(id)
    else l.add(id)
    set({ [feld]: [...l] } as ZielInput)
  }
  const speichern = async () => {
    if (!f.titel || f.titel.trim().length < 2) return toast.error('Bitte einen Titel eingeben.')
    try {
      await save.mutateAsync({ id: row?.id, input: { ...f, titel: f.titel.trim(), schluessel: row?.schluessel ?? `${slug(f.titel)}_${Date.now().toString(36).slice(-4)}` } })
      toast.success('Ziel gespeichert.')
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  const personen = (roster.data ?? []).filter((r) => r.aktiv)
  const kartenListe = (karten.data ?? []).filter((k) => k.aktiv && !k.variante && !k.limitiert)
  return (
    <Modal
      open
      onClose={onClose}
      title={row ? 'Ziel bearbeiten' : `Neues Ziel: ${v.titel}`}
      description={v.hilfe}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={() => void speichern()} disabled={save.isPending}>
            <Plus className="h-4 w-4" /> Speichern
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="zi-titel">Titel *</Label>
          <Input id="zi-titel" value={f.titel ?? ''} maxLength={60} onChange={(e) => set({ titel: e.target.value })} placeholder={v.id === 'familie' ? 'z. B. Die Warkehr-Brüder' : 'z. B. Meister 2026'} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zi-typ">Art</Label>
          <Select id="zi-typ" value={f.typ} onChange={(e) => set({ typ: e.target.value as ZielTyp })}>
            <option value="set">Set (Karten/Personen)</option>
            <option value="kapitel">Kapitel komplett</option>
            <option value="meilenstein">Meilenstein (%)</option>
            <option value="serie_checkin">Heimspiele in Folge</option>
            <option value="serie_tipp">Tipp-Wochen in Folge</option>
            <option value="sozial_tausch">Erster Tausch</option>
            <option value="sozial_freund">Freund geworben</option>
            <option value="extern">Tipp-Liga (extern)</option>
          </Select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="zi-besch">Beschreibung (für Fans)</Label>
        <Input id="zi-besch" value={f.beschreibung ?? ''} maxLength={200} onChange={(e) => set({ beschreibung: e.target.value || null })} placeholder="z. B. Isaak + Aaron Warkehr" />
      </div>
      {f.typ === 'set' && (
        <>
          <div className="space-y-1.5">
            <Label>Personen ({(f.roster_ids ?? []).length})</Label>
            <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded border border-border p-2 sm:grid-cols-3">
              {personen.map((r) => (
                <label key={r.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={(f.roster_ids ?? []).includes(r.id)} onChange={() => toggle('roster_ids', r.id)} />
                  {r.name}
                  {r.rolle !== 'spieler' && <span className="text-xs text-muted-foreground">(Stab)</span>}
                </label>
              ))}
            </div>
          </div>
          {v.id !== 'familie' && (
            <div className="space-y-1.5">
              <Label>Karten ({(f.karten ?? []).length})</Label>
              <div className="grid max-h-48 grid-cols-2 gap-1 overflow-y-auto rounded border border-border p-2">
                {kartenListe
                  .filter((k) => k.typ !== 'spieler' && k.typ !== 'trainer')
                  .map((k) => (
                    <label key={k.id} className="flex items-center gap-2 text-sm">
                      <input type="checkbox" checked={(f.karten ?? []).includes(k.id)} onChange={() => toggle('karten', k.id)} />
                      {k.titel}
                    </label>
                  ))}
              </div>
            </div>
          )}
        </>
      )}
      {f.typ === 'kapitel' && (
        <div className="space-y-1.5">
          <Label htmlFor="zi-kap">Kapitel</Label>
          <Select id="zi-kap" value={f.kapitel ?? 'TW'} onChange={(e) => set({ kapitel: e.target.value })}>
            {KAPITEL.map(([id, t]) => (
              <option key={id} value={id}>
                {t}
              </option>
            ))}
          </Select>
        </div>
      )}
      {(f.typ === 'serie_checkin' || f.typ === 'serie_tipp' || f.typ === 'meilenstein' || f.typ === 'set') && (
        <div className="space-y-1.5">
          <Label htmlFor="zi-anz">{f.typ === 'meilenstein' ? 'Prozent' : f.typ === 'set' ? 'Mindestens (leer = alle)' : 'Anzahl in Folge'}</Label>
          <Input id="zi-anz" type="number" min={1} value={f.anzahl ?? ''} onChange={(e) => set({ anzahl: e.target.value ? Number(e.target.value) : null })} />
        </div>
      )}
      {f.typ === 'extern' && (
        <p className="text-xs text-muted-foreground">
          Der Auslöser kommt aus der Tipp-Liga: <code>album_ziel_ausloesen('{row?.schluessel ?? 'schluessel'}', bezug)</code>. Für feste Schlüssel (tipp_exakt …) die Standard-Ziele nutzen.
        </p>
      )}
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="zi-bk">Karten</Label>
          <Input id="zi-bk" type="number" min={0} max={5} value={String(f.belohnung_karten ?? 1)} onChange={(e) => set({ belohnung_karten: Number(e.target.value) })} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zi-bs">Mindestens</Label>
          <Select id="zi-bs" value={f.belohnung_min_seltenheit ?? ''} onChange={(e) => set({ belohnung_min_seltenheit: e.target.value || null })}>
            <option value="">beliebig</option>
            <option value="silber">Silber</option>
            <option value="gold">Gold</option>
            <option value="spezial">Spezial</option>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="zi-bl">Lose</Label>
          <Input id="zi-bl" type="number" min={0} max={100} value={String(f.belohnung_lose ?? 0)} onChange={(e) => set({ belohnung_lose: Number(e.target.value) })} />
        </div>
      </div>
      {(v.id === 'challenge' || f.gueltig_bis) && (
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="zi-von">Gültig von</Label>
            <Input id="zi-von" type="date" value={f.gueltig_von?.slice(0, 10) ?? ''} onChange={(e) => set({ gueltig_von: e.target.value ? new Date(e.target.value + 'T00:00:00').toISOString() : null })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="zi-bis">Gültig bis</Label>
            <Input id="zi-bis" type="date" value={f.gueltig_bis?.slice(0, 10) ?? ''} onChange={(e) => set({ gueltig_bis: e.target.value ? new Date(e.target.value + 'T23:59:59').toISOString() : null })} />
          </div>
        </div>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        <Switch checked={!!f.geheim} onChange={(x) => set({ geheim: x })} label="Geheime Mission" hint="Erst nach Erreichen sichtbar" />
        <Switch checked={!!f.aktiv} onChange={(x) => set({ aktiv: x })} label="Aktiv" />
      </div>
    </Modal>
  )
}
