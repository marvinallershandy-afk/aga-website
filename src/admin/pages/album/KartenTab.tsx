import { useMemo, useRef, useState } from 'react'
import { ImagePlus, Layers, Loader2, RotateCw, Sparkles, Trash2, Users, Video } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Input } from '../../components/ui/input'
import { Label } from '../../components/ui/label'
import { Modal } from '../../components/ui/modal'
import { Select } from '../../components/ui/select'
import { Switch } from '../../components/ui/switch'
import { Textarea } from '../../components/ui/textarea'
import { SkeletonRows } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { useToast } from '../../components/ui/toast'
import { useConfirm } from '../../components/ui/confirm'
import { friendlyError } from '../../lib/db'
import { useRoster, useSpiele, useSponsoren } from '../../lib/queries'
import { uploadPublicImage } from '../../lib/pflege'
import { ACCEPT_IMAGES, loadImage } from '../../lib/image'
import { cn } from '../../lib/utils'
import { SELTEN, TYPEN, renderStickerFoto, typLabel, useAlbumStatistik, useKarten, useKartenMutations, walkoutSuchen, type KarteInput, type KarteRow } from '../../lib/album'
import { adminKartenDaten, useKatalogStandard, useKultKarte, useKultStandard } from '../../lib/albumV20'
import { SvaKarte } from '../../../karten/SvaKarte'
import { KartenExportKnoepfe } from './KartenExport'

// ─────────────────────────────────────────────────────────────
// v20-K: Admin → Album → Karten. Katalog pflegen mit Live-Vorschau der
// echten Karte (SvaKarte), Standard-Katalog per Knopf, je Karte Story-
// Bild + Reel für Instagram. Seltenheit bewertet nie einen Spieler:
// Basis = Kader (Kapitän/Trainer Gold), Glanz = Variante (füllt keinen
// Platz), Spezial = Momente + limitierte Karten (Bonus-Seite).
// ─────────────────────────────────────────────────────────────

type Filter = 'alle' | 'spieler' | 'varianten' | 'trainer' | 'moment' | 'fan' | 'partner' | 'limitiert' | 'inaktiv'
const NELE = 'picture by Nele'

export function KartenTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const karten = useKarten()
  const roster = useRoster()
  const sponsoren = useSponsoren()
  const stat = useAlbumStatistik()
  const { save, remove, ausKader } = useKartenMutations()
  const standard = useKatalogStandard()
  const [editor, setEditor] = useState<{ row: KarteRow | null } | null>(null)
  const [filter, setFilter] = useState<Filter>('alle')
  const [suche, setSuche] = useState('')
  const [walkLaeuft, setWalkLaeuft] = useState(false)

  const rows = useMemo(() => karten.data ?? [], [karten.data])
  const R = roster.data ?? []
  const S = sponsoren.data ?? []
  const saison = stat.data?.saison ?? '2026/27'
  const sichtbar = rows.filter((r) => {
    if (suche && !r.titel.toLowerCase().includes(suche.toLowerCase())) return false
    if (filter === 'alle') return r.aktiv
    if (filter === 'inaktiv') return !r.aktiv
    if (filter === 'varianten') return !!r.variante
    if (filter === 'limitiert') return !!r.limitiert
    if (filter === 'spieler') return r.typ === 'spieler' && !r.variante && !r.limitiert
    return r.typ === filter
  })
  const plaetze = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.aktiv && !r.variante && !r.limitiert) set.add(r.roster_id && (r.typ === 'spieler' || r.typ === 'trainer') ? r.roster_id : r.id)
    return set.size
  }, [rows])

  const walkouts = async () => {
    setWalkLaeuft(true)
    let n = 0
    try {
      for (const k of rows.filter((r) => (r.typ === 'spieler' || r.typ === 'trainer') && !r.walkout_url)) {
        const url = await walkoutSuchen(k, R.find((x) => x.id === k.roster_id)?.slug)
        if (url) {
          await save.mutateAsync({ id: k.id, input: { walkout_url: url } })
          n++
        }
      }
      toast.success(n ? `${n} Walkout-Video${n === 1 ? '' : 's'} verknüpft.` : 'Keine neuen Walkout-Videos gefunden.')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setWalkLaeuft(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={async () => {
            try {
              const r = await standard.mutateAsync()
              toast.success(`Standard-Katalog ${r.saison}: ${r.spielerBasis} Spieler, ${r.varianten} Glanz-Varianten, ${r.trainer} Trainerstab, ${r.momente} Momente, ${r.kurve} Kurve, ${r.partner} Partner neu · ${r.albumPlaetze} Album-Plätze.`)
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
          disabled={standard.isPending}
        >
          <Layers className="h-4 w-4" /> Standard-Katalog anlegen
        </Button>
        <Button variant="outline" onClick={() => setEditor({ row: null })}>
          <ImagePlus className="h-4 w-4" /> Neue Karte
        </Button>
        <Button
          variant="ghost"
          onClick={async () => {
            try {
              const r = await ausKader.mutateAsync()
              toast.success(`Aus dem Kader: ${r.bronze} Spieler-, ${r.gold} Kapitäns- und ${r.trainer} Trainerstab-Karten neu.`)
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
          disabled={ausKader.isPending}
        >
          <Users className="h-4 w-4" /> Neue Spieler aus Kader
        </Button>
        <Button variant="ghost" onClick={() => void walkouts()} disabled={walkLaeuft || !rows.length}>
          {walkLaeuft ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Walkouts suchen
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Input aria-label="Karte suchen" placeholder="Suchen …" value={suche} onChange={(e) => setSuche(e.target.value)} className="max-w-xs" />
        <Select aria-label="Filter" value={filter} onChange={(e) => setFilter(e.target.value as Filter)} className="w-auto">
          <option value="alle">Alle aktiven ({rows.filter((r) => r.aktiv).length})</option>
          <option value="spieler">Spieler-Basis</option>
          <option value="varianten">Glanz-Varianten</option>
          <option value="trainer">Trainerstab</option>
          <option value="moment">Momente</option>
          <option value="fan">Kurve</option>
          <option value="partner">Partner</option>
          <option value="limitiert">Limitiert (Bonus-Seite)</option>
          <option value="inaktiv">Inaktiv</option>
        </Select>
        <span className="text-sm text-muted-foreground">
          {plaetze} Album-Plätze · Saison {saison}
        </span>
      </div>
      <p className="text-sm text-muted-foreground">
        Seltenheit bewertet nie einen Spieler: jeder hat eine Basis-Karte (Kader, Kapitän/Trainer Gold). Glanz-Varianten sind Sammelstücke ohne eigenen Platz. Spezial = Momente und limitierte
        Karten (Spieler des Spiels, Derby, Advent) — die liegen auf der Bonus-Seite. Partner-Karten sind eine verkaufbare Leistung („Deine Firma als Sammelkarte“).
      </p>
      <KultPanel />
      {karten.isLoading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Sparkles} title="Noch keine Karten" description="Starte mit „Standard-Katalog anlegen“ — Spieler, Trainerstab, Momente, Kurve und Partner in einem Rutsch." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {sichtbar.map((k) => {
            const d = adminKartenDaten(k, R, S, { saison: k.saison ?? saison })
            return (
              <li key={k.id} className={cn('flex gap-3 rounded-lg border border-border bg-card p-3', !k.aktiv && 'opacity-60')}>
                <button type="button" className="w-24 shrink-0" onClick={() => setEditor({ row: k })} aria-label={`${k.titel} bearbeiten`}>
                  <SvaKarte daten={d} stufe="klein" />
                </button>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="truncate font-medium">{k.titel}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {typLabel(k.typ)}
                    {k.variante ? ' · Glanz' : ''}
                    {k.limitiert ? ' · limitiert' : ''}
                    {k.serie ? ` · ${k.serie}` : ''}
                    {k.untertitel ? ` · ${k.untertitel}` : ''}
                  </p>
                  {k.limitiert && (k.ziehbar_von || k.ziehbar_bis) && (
                    <p className="text-xs text-muted-foreground">
                      ziehbar {k.ziehbar_von ? new Date(k.ziehbar_von).toLocaleDateString('de-DE') : '…'} – {k.ziehbar_bis ? new Date(k.ziehbar_bis).toLocaleDateString('de-DE') : '…'}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-1">
                    <Select
                      aria-label={`Seltenheit ${k.titel}`}
                      value={k.seltenheit}
                      className="h-8 w-auto py-0 text-xs"
                      onChange={async (e) => {
                        try {
                          await save.mutateAsync({ id: k.id, input: { seltenheit: e.target.value as KarteRow['seltenheit'] } })
                        } catch (err) {
                          toast.error(friendlyError(err))
                        }
                      }}
                    >
                      {SELTEN.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </Select>
                    <Button variant="ghost" size="sm" onClick={() => setEditor({ row: k })}>
                      Bearbeiten
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`${k.titel} löschen`}
                      onClick={async () => {
                        const ok = await confirm({ title: 'Karte löschen?', description: 'Fans verlieren diese Karte aus ihrem Album. Besser: deaktivieren.', confirmLabel: 'Löschen', destructive: true })
                        if (!ok) return
                        try {
                          await remove.mutateAsync(k.id)
                        } catch (err) {
                          toast.error(friendlyError(err))
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <KartenExportKnoepfe daten={d} klein />
                </div>
              </li>
            )
          })}
        </ul>
      )}
      {editor && <KartenEditor row={editor.row} saison={saison} onClose={() => setEditor(null)} />}
    </div>
  )
}

const zuLokal = (iso?: string | null) => (iso ? new Date(new Date(iso).getTime() - new Date(iso).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : '')
const ausLokal = (v: string) => (v ? new Date(v).toISOString() : null)

function KartenEditor({ row, saison, onClose }: { row: KarteRow | null; saison: string; onClose: () => void }) {
  const toast = useToast()
  const { save } = useKartenMutations()
  const roster = useRoster()
  const sponsoren = useSponsoren()
  const spiele = useSpiele()
  const [f, setF] = useState<KarteInput>(
    row ?? { typ: 'moment', seltenheit: 'gold', aktiv: true, saison, titel: '', untertitel: null, bild_url: null, roster_id: null, sponsor_id: null, sortierung: 0, variante: false, limitiert: false, credit: null, bild_fokus: '50% 35%' },
  )
  const [upload, setUpload] = useState(false)
  const [hinten, setHinten] = useState(false)
  const datei = useRef<HTMLInputElement>(null)
  const set = (p: KarteInput) => setF((x) => ({ ...x, ...p }))
  const R = roster.data ?? []
  const S = sponsoren.data ?? []
  const heim = (spiele.data ?? []).filter((s) => s.heim).sort((a, b) => a.anstoss.localeCompare(b.anstoss))
  const vorschau = adminKartenDaten({ ...(f as KarteRow), id: row?.id ?? 'neu' }, R, S, { saison: f.saison ?? saison })
  const fokus = (f.bild_fokus ?? '50% 35%').split(' ').map((v) => parseFloat(v))

  const hochladen = async (file: File) => {
    setUpload(true)
    try {
      const img = await loadImage(file)
      const blob = await renderStickerFoto(img)
      set({ bild_url: await uploadPublicImage(blob, 'album', f.titel || 'karte'), credit: f.credit ?? (f.typ === 'moment' || f.typ === 'fan' ? NELE : null) })
    } catch (e) {
      toast.error(friendlyError(e, 'Upload fehlgeschlagen.'))
    } finally {
      setUpload(false)
    }
  }
  const speichern = async () => {
    if (!f.titel || f.titel.trim().length < 2) return toast.error('Bitte einen Titel eingeben.')
    if ((f.typ === 'spieler' || f.typ === 'trainer') && !f.roster_id) return toast.error('Bitte den Spieler bzw. Trainer auswählen.')
    try {
      await save.mutateAsync({
        id: row?.id,
        input: {
          ...f,
          titel: f.titel.trim(),
          untertitel: f.untertitel?.trim() || null,
          serie: f.serie?.trim() || null,
          credit: f.credit?.trim() || null,
          rueckseite: f.rueckseite?.trim() || null,
          saison: f.saison?.trim() || null,
        },
      })
      toast.success('Karte gespeichert.')
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? 'Karte bearbeiten' : 'Neue Karte'}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Abbrechen
          </Button>
          <Button onClick={() => void speichern()} disabled={save.isPending || upload}>
            Speichern
          </Button>
        </>
      }
    >
      <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ka-typ">Art</Label>
              <Select id="ka-typ" value={f.typ} onChange={(e) => set({ typ: e.target.value as KarteRow['typ'] })} disabled={!!row}>
                {TYPEN.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.value === 'fan' ? 'Kurve (Fans)' : t.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ka-selt">Seltenheit</Label>
              <Select id="ka-selt" value={f.seltenheit} onChange={(e) => set({ seltenheit: e.target.value as KarteRow['seltenheit'] })}>
                {SELTEN.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label} ({s.chance})
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {(f.typ === 'spieler' || f.typ === 'trainer') && (
            <div className="space-y-1.5">
              <Label htmlFor="ka-roster">{f.typ === 'spieler' ? 'Spieler' : 'Trainerstab'}</Label>
              <Select
                id="ka-roster"
                value={f.roster_id ?? ''}
                onChange={(e) => {
                  const r = R.find((x) => x.id === e.target.value)
                  set({ roster_id: e.target.value || null, titel: r?.name ?? f.titel })
                }}
              >
                <option value="">— auswählen —</option>
                {R.filter((r) => (f.typ === 'spieler' ? r.rolle === 'spieler' : r.rolle !== 'spieler')).map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">Bild kommt automatisch aus dem Kader (Greenscreen → Freisteller → Foto).</p>
            </div>
          )}
          {f.typ === 'partner' && (
            <div className="space-y-1.5">
              <Label htmlFor="ka-sponsor">Partner</Label>
              <Select id="ka-sponsor" value={f.sponsor_id ?? ''} onChange={(e) => set({ sponsor_id: e.target.value || null, titel: f.titel || S.find((s) => s.id === e.target.value)?.name || '' })}>
                <option value="">— auswählen —</option>
                {S.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">Logo und „Partner seit“ kommen aus Partner/Sponsoren (Logo dort hochladen, Laufzeit-Beginn eintragen).</p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ka-titel">Titel *</Label>
              <Input id="ka-titel" value={f.titel ?? ''} maxLength={60} onChange={(e) => set({ titel: e.target.value })} placeholder="z. B. Die Meister-Elf" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ka-unter">Untertitel</Label>
              <Input id="ka-unter" value={f.untertitel ?? ''} maxLength={80} onChange={(e) => set({ untertitel: e.target.value })} placeholder="z. B. 90+7. Minute" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ka-serie">Serie</Label>
              <Input id="ka-serie" value={f.serie ?? ''} maxLength={40} onChange={(e) => set({ serie: e.target.value })} placeholder="Meister 2026 · Urknall-Pokal 2026" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ka-pv">Präsentiert von</Label>
              <Select id="ka-pv" value={f.praesentiert_von ?? ''} onChange={(e) => set({ praesentiert_von: e.target.value || null })}>
                <option value="">— niemand —</option>
                {S.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {f.typ !== 'partner' && (
            <div className="space-y-1.5">
              <Label>Foto {f.typ === 'spieler' || f.typ === 'trainer' ? '(nur falls kein Freisteller)' : ''}</Label>
              <div className="flex items-start gap-3">
                {f.bild_url ? (
                  <button
                    type="button"
                    className="relative h-28 w-40 overflow-hidden rounded bg-secondary"
                    title="Klicken setzt den Bildausschnitt (Fokus)"
                    onClick={(e) => {
                      const r = e.currentTarget.getBoundingClientRect()
                      const x = Math.round(((e.clientX - r.left) / r.width) * 100)
                      const y = Math.round(((e.clientY - r.top) / r.height) * 100)
                      set({ bild_fokus: `${x}% ${y}%` })
                    }}
                  >
                    <img src={f.bild_url} alt="" className="h-full w-full object-cover" />
                    <span className="absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow" style={{ left: `${fokus[0]}%`, top: `${fokus[1]}%` }} />
                  </button>
                ) : (
                  <div className="h-28 w-40 rounded bg-secondary" />
                )}
                <div className="space-y-2">
                  <input ref={datei} type="file" accept={ACCEPT_IMAGES} className="hidden" onChange={(e) => e.target.files?.[0] && void hochladen(e.target.files[0])} />
                  <Button variant="outline" onClick={() => datei.current?.click()} disabled={upload}>
                    {upload ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Foto wählen
                  </Button>
                  <p className="text-xs text-muted-foreground">Querformat geht: Klick ins Bild setzt den Ausschnitt fürs Hochformat.</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ka-credit">Foto-Credit</Label>
                <Input id="ka-credit" value={f.credit ?? ''} maxLength={80} onChange={(e) => set({ credit: e.target.value })} placeholder={NELE} />
              </div>
              <p className="text-xs text-muted-foreground">Keine Kinder ohne Einwilligung der Eltern, kein Alkohol im Fokus. Credit „picture by Nele“ ist Pflicht bei ihren Fotos.</p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="ka-rueck">Rückseite (Steckbrief)</Label>
            <Textarea id="ka-rueck" rows={3} maxLength={400} value={f.rueckseite ?? ''} onChange={(e) => set({ rueckseite: e.target.value })} placeholder="Kurzer Text für die Rückseite — nur Fakten, keine Bewertungen." />
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            {f.typ === 'spieler' && <Switch checked={!!f.variante} onChange={(v) => set({ variante: v })} label="Glanz-Variante" hint="Sammelstück, füllt keinen Platz" />}
            <Switch checked={!!f.limitiert} onChange={(v) => set({ limitiert: v })} label="Limitiert" hint="Bonus-Seite, zählt nicht fürs Album" />
          </div>
          {f.limitiert && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="ka-von">Ziehbar ab</Label>
                <Input id="ka-von" type="datetime-local" value={zuLokal(f.ziehbar_von)} onChange={(e) => set({ ziehbar_von: ausLokal(e.target.value) })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ka-bis">Ziehbar bis</Label>
                <Input id="ka-bis" type="datetime-local" value={zuLokal(f.ziehbar_bis)} onChange={(e) => set({ ziehbar_bis: ausLokal(e.target.value) })} />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label htmlFor="ka-derby">Derby-Karte: nur beim Check-in an diesem Spiel</Label>
                <Select id="ka-derby" value={f.nur_spiel_id ?? ''} onChange={(e) => set({ nur_spiel_id: e.target.value || null })}>
                  <option value="">— jedes Spiel —</option>
                  {heim.map((s) => (
                    <option key={s.id} value={s.id}>
                      {new Date(s.anstoss).toLocaleDateString('de-DE')} · SVA – {s.gegner}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ka-saison">Saison</Label>
              <Input id="ka-saison" value={f.saison ?? ''} onChange={(e) => set({ saison: e.target.value })} placeholder="leer = jede Saison" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ka-sort">Reihenfolge</Label>
              <Input id="ka-sort" type="number" value={String(f.sortierung ?? 0)} onChange={(e) => set({ sortierung: Number(e.target.value) })} />
            </div>
          </div>
          <Switch checked={!!f.aktiv} onChange={(v) => set({ aktiv: v })} label="Aktiv" hint="Nur aktive Karten können gezogen werden und erscheinen im Album." />
        </div>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Vorschau</p>
          <SvaKarte daten={vorschau} stufe="normal" seite={hinten ? 'hinten' : 'vorne'} interaktiv onClick={() => setHinten((h) => !h)} eager />
          <Button variant="ghost" size="sm" onClick={() => setHinten((h) => !h)}>
            <RotateCw className="h-4 w-4" /> {hinten ? 'Vorderseite' : 'Rückseite'}
          </Button>
          <KartenExportKnoepfe daten={vorschau} />
        </div>
      </div>
    </Modal>
  )
}

// v26-K: Kabinen-Kult — Startbestand + „Neue Kult-Karte" (Einverständnis-Pflicht).
function KultPanel() {
  const toast = useToast()
  const roster = useRoster()
  const standard = useKultStandard()
  const anlegen = useKultKarte()
  const datei = useRef<HTMLInputElement>(null)
  const [bild, setBild] = useState<string | null>(null)
  const [titel, setTitel] = useState('')
  const [anekdote, setAnekdote] = useState('')
  const [kollektion, setKollektion] = useState('Kabinen-Kult')
  const [rosterId, setRosterId] = useState('')
  const [ok, setOk] = useState(false)
  const [upload, setUpload] = useState(false)
  const R = roster.data ?? []

  const hochladen = async (file: File) => {
    setUpload(true)
    try {
      const img = await loadImage(file)
      const blob = await renderStickerFoto(img)
      setBild(await uploadPublicImage(blob, 'album', titel || 'kult'))
    } catch (e) {
      toast.error(friendlyError(e, 'Upload fehlgeschlagen.'))
    } finally {
      setUpload(false)
    }
  }
  const speichern = async () => {
    if (titel.trim().length < 2) return toast.error('Bitte einen Titel eingeben.')
    if (!ok) return toast.error('Ohne „Spieler hat zugestimmt" darf keine Kult-Karte aktiv werden.')
    try {
      await anlegen.mutateAsync({ roster: rosterId || null, titel: titel.trim(), anekdote: anekdote.trim() || null, kollektion: kollektion.trim() || 'Kabinen-Kult', bild, einverstaendnis: ok })
      toast.success('Kult-Karte angelegt.')
      setTitel(''); setAnekdote(''); setBild(null); setRosterId(''); setOk(false)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <section className="rounded-lg border border-border bg-card/40 p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold">Kabinen-Kult</h3>
          <p className="text-sm text-muted-foreground">Insider-Karten aus der Kabine — eigene Serie, zählt nie fürs Album. Nur mit Einverständnis des/der Abgebildeten.</p>
        </div>
        <Button
          variant="outline"
          disabled={standard.isPending}
          onClick={async () => {
            try {
              const r = await standard.mutateAsync()
              toast.success(`Kult-Startbestand: ${r.kultNeu} Kabinen-Kult-Karten + ${r.momentPoolNeu} Monats-Momente neu.`)
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
        >
          <Sparkles className="h-4 w-4" /> Startbestand anlegen
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="kult-titel">Titel</Label>
          <Input id="kult-titel" value={titel} onChange={(e) => setTitel(e.target.value)} placeholder="z. B. Der Krampf" maxLength={60} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="kult-koll">Kollektion</Label>
          <Input id="kult-koll" value={kollektion} onChange={(e) => setKollektion(e.target.value)} maxLength={60} />
        </div>
        <div className="space-y-1 sm:col-span-2">
          <Label htmlFor="kult-text">Anekdote (Rückseite)</Label>
          <Textarea id="kult-text" value={anekdote} onChange={(e) => setAnekdote(e.target.value)} rows={2} maxLength={200} placeholder="Kurze Kabinen-Geschichte …" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="kult-roster">Person (optional)</Label>
          <Select id="kult-roster" value={rosterId} onChange={(e) => setRosterId(e.target.value)} className="w-full">
            <option value="">— ohne Zuordnung —</option>
            {R.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </Select>
        </div>
        <div className="flex items-end gap-2">
          <input ref={datei} type="file" accept={ACCEPT_IMAGES} className="hidden" onChange={(e) => e.target.files?.[0] && void hochladen(e.target.files[0])} />
          <Button variant="ghost" onClick={() => datei.current?.click()} disabled={upload}>
            {upload ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} {bild ? 'Bild ersetzen' : 'Foto hochladen'}
          </Button>
        </div>
      </div>
      <Switch checked={ok} onChange={setOk} label="Spieler hat zugestimmt" hint="Pflicht: ohne Einverständnis bleibt die Karte gesperrt." />
      <Button onClick={() => void speichern()} disabled={anlegen.isPending || !ok || titel.trim().length < 2}>
        <ImagePlus className="h-4 w-4" /> Kult-Karte anlegen
      </Button>
    </section>
  )
}
