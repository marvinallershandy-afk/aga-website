import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarCheck, Download, ImagePlus, Loader2, QrCode, RefreshCw, Settings2, Sparkles, Ticket, Trash2, Users, Video } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useRoster, useSpiele, useSponsoren } from '../lib/queries'
import { uploadPublicImage } from '../lib/pflege'
import { ACCEPT_IMAGES, loadImage } from '../lib/image'
import { cn } from '../lib/utils'
import {
  SELTEN,
  TYPEN,
  renderStickerFoto,
  typLabel,
  useAlbumEinstellungen,
  useAlbumStatistik,
  useCodeErzeugen,
  useCodes,
  useGutscheinEinloesen,
  useGutscheine,
  useKarten,
  useKartenMutations,
  useSaveAlbumEinstellungen,
  walkoutSuchen,
  type EinstellungenInput,
  type KarteInput,
  type KarteRow,
} from '../lib/album'
import { A4, canvasZuBlob, herunterladen, plakatPdf, zeichnePlakat } from '../lib/albumPlakat'

// ─────────────────────────────────────────────────────────────
// v17-A: Admin „Album“ (Sammelalbum / Stickerheft auf /album).
//   Spieltage  — QR-Plakat je Heimspiel (A4 PDF/PNG, „präsentiert von“),
//                Live-Zähler der Check-ins
//   Sticker    — Katalog: aus Kader erzeugen, Momente/Partner/Fans mit
//                Foto, Seltenheit, Walkout-Videos finden
//   Gutscheine — Liste, Suche nach Code, Notfall-Einlösen
//   Einstellungen — Chancen, Tütchen-Größe, Fenster, Belohnungen (v17-D: ohne Stand-PIN)
// Die Ziehung passiert in der Datenbank; hier wird nur gepflegt.
// ─────────────────────────────────────────────────────────────

type Tab = 'spieltage' | 'sticker' | 'gutscheine' | 'einstellungen'
const TABS: Tab[] = ['spieltage', 'sticker', 'gutscheine', 'einstellungen']

const datum = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

function MigrationFehlt() {
  return (
    <EmptyState
      icon={BookOpen}
      title="Das Sammelalbum ist in der Datenbank noch nicht eingerichtet"
      description="Die Migration 20261007100000_sva_album.sql fehlt noch. Bitte Marvin Bescheid geben — danach erscheinen hier Sticker, QR-Codes und Gutscheine."
    />
  )
}

export function Album() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'spieltage') as Tab
  const setTab = (t: Tab) => setParams(t === 'spieltage' ? {} : { tab: t }, { replace: true })
  const stat = useAlbumStatistik(tab === 'spieltage')
  const fehlt = stat.error && isMissingSchema(stat.error)

  return (
    <>
      <PageHeader title="Album" subtitle="Das Stickerheft auf /album: QR-Check-in am Eingang, Sticker-Katalog, Gutscheine und Regeln." />
      <div role="tablist" aria-label="Album-Bereiche" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 sm:inline-grid sm:grid-cols-4">
        {(
          [
            ['spieltage', 'Spieltage', CalendarCheck],
            ['sticker', 'Sticker', Sparkles],
            ['gutscheine', 'Gutscheine', Ticket],
            ['einstellungen', 'Regeln', Settings2],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
              tab === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {value === 'gutscheine' && (stat.data?.gutscheineOffen ?? 0) > 0 && (
              <span className="rounded-full bg-sva-gold px-1.5 text-[11px] font-bold text-black">{stat.data?.gutscheineOffen}</span>
            )}
          </button>
        ))}
      </div>
      {fehlt ? (
        <MigrationFehlt />
      ) : (
        <>
          {tab === 'spieltage' && <SpieltageTab />}
          {tab === 'sticker' && <StickerTab />}
          {tab === 'gutscheine' && <GutscheineTab />}
          {tab === 'einstellungen' && <EinstellungenTab />}
        </>
      )}
    </>
  )
}

// ── Spieltage: QR-Codes + Live-Zähler ───────────────────────
function SpieltageTab() {
  const toast = useToast()
  const spiele = useSpiele()
  const codes = useCodes()
  const sponsoren = useSponsoren()
  const stat = useAlbumStatistik(true)
  const erzeugen = useCodeErzeugen()
  const [plakat, setPlakat] = useState<string | null>(null)
  // „Jetzt“ beim Öffnen des Tabs (reicht für Heute/vorbei; Live-Zahlen kommen per Abfrage)
  const [jetzt] = useState(() => Date.now())

  const heim = useMemo(() => {
    return (spiele.data ?? [])
      .filter((s) => s.heim && new Date(s.anstoss).getTime() > jetzt - 45 * 864e5)
      .sort((a, b) => new Date(a.anstoss).getTime() - new Date(b.anstoss).getTime())
  }, [spiele.data, jetzt])
  const zaehler = new Map((stat.data?.spiele ?? []).map((s) => [s.spielId, s.checkins]))
  const heute = heim.find((s) => Math.abs(new Date(s.anstoss).getTime() - jetzt) < 4 * 3600e3)
  const gezaehlt = (stat.data?.spiele ?? []).filter((s) => s.checkins > 0)
  const schnitt = gezaehlt.length ? Math.round(gezaehlt.reduce((a, s) => a + s.checkins, 0) / gezaehlt.length) : null

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-4">
        <Kennzahl label={heute ? `Check-ins heute (${heute.gegner})` : 'Check-ins diese Saison'} wert={heute ? zaehler.get(heute.id) ?? 0 : stat.data?.checkinsSaison ?? 0} live={!!heute} />
        <Kennzahl label="Fans mit Heft" wert={stat.data?.fans ?? 0} />
        <Kennzahl label="Ø gezählte Zuschauer / Heimspiel" wert={schnitt ?? '–'} hint={gezaehlt.length ? `${gezaehlt.length} Spiele · steht auf /partner` : 'noch kein Spiel gezählt'} />
        <Kennzahl label="Gutscheine offen" wert={stat.data?.gutscheineOffen ?? 0} />
      </div>
      <p className="text-sm text-muted-foreground">
        Pro Heimspiel einen QR-Code erzeugen, als A4-Plakat drucken und am Eingang aufhängen. Der Code gilt 1 Std. vor Anstoß bis kurz nach Abpfiff. Wird ein Code
        abfotografiert und weitergeschickt: „Neu erzeugen“ macht den alten ungültig (Plakat neu drucken).
      </p>
      {spiele.isLoading || codes.isLoading ? (
        <SkeletonRows rows={4} />
      ) : heim.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Keine Heimspiele" description="Lege unter „Spiele“ die nächsten Heimspiele an." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {heim.map((s) => {
            const c = (codes.data ?? []).find((x) => x.spiel_id === s.id)
            const n = zaehler.get(s.id) ?? 0
            const vorbei = new Date(s.anstoss).getTime() < jetzt - 4 * 3600e3
            return (
              <li key={s.id} className={cn('flex flex-wrap items-center gap-3 px-4 py-3', vorbei && 'opacity-70')}>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">SVA – {s.gegner}</p>
                  <p className="text-xs text-muted-foreground">
                    {datum(s.anstoss)}
                    {c ? ` · Code seit ${new Date(c.erzeugt_at).toLocaleDateString('de-DE')}` : ' · noch kein Code'}
                    {c?.bonus_at ? ' · Heimsieg-Bonus verteilt' : ''}
                  </p>
                </div>
                <span className="flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-sm font-semibold tabular-nums" title="Check-ins">
                  <Users className="h-4 w-4" /> {n}
                </span>
                {c ? (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setPlakat(s.id)}>
                      <QrCode className="h-4 w-4" /> Plakat
                    </Button>
                    {!vorbei && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          try {
                            await erzeugen.mutateAsync({ spielId: s.id, partnerId: c.partner_id, neu: true })
                            toast.success('Neuer Code erzeugt — bitte Plakat neu drucken.')
                          } catch (e) {
                            toast.error(friendlyError(e))
                          }
                        }}
                      >
                        <RefreshCw className="h-4 w-4" /> Neu erzeugen
                      </Button>
                    )}
                  </>
                ) : (
                  !vorbei && (
                    <Button
                      size="sm"
                      disabled={erzeugen.isPending}
                      onClick={async () => {
                        try {
                          await erzeugen.mutateAsync({ spielId: s.id, partnerId: null, neu: false })
                          setPlakat(s.id)
                        } catch (e) {
                          toast.error(friendlyError(e))
                        }
                      }}
                    >
                      <QrCode className="h-4 w-4" /> QR-Code erzeugen
                    </Button>
                  )
                )}
              </li>
            )
          })}
        </ul>
      )}
      {plakat && (
        <PlakatModal
          spiel={heim.find((s) => s.id === plakat)!}
          code={(codes.data ?? []).find((x) => x.spiel_id === plakat) ?? null}
          sponsoren={(sponsoren.data ?? []).filter((x) => x.aktiv)}
          saison={stat.data?.saison ?? ''}
          onClose={() => setPlakat(null)}
        />
      )}
    </div>
  )
}

function Kennzahl({ label, wert, hint, live }: { label: string; wert: number | string; hint?: string; live?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {live && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" aria-hidden="true" />}
        {label}
      </p>
      <p className="mt-1 font-display text-4xl tabular-nums">{wert}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
}

function PlakatModal({
  spiel,
  code,
  sponsoren,
  saison,
  onClose,
}: {
  spiel: { id: string; gegner: string; anstoss: string }
  code: { token: string; partner_id: string | null } | null
  sponsoren: { id: string; name: string; logo_url: string | null }[]
  saison: string
  onClose: () => void
}) {
  const toast = useToast()
  const erzeugen = useCodeErzeugen()
  const canvas = useRef<HTMLCanvasElement>(null)
  const [partnerId, setPartnerId] = useState<string>(code?.partner_id ?? '')
  const [laeuft, setLaeuft] = useState(false)
  const url = code ? `${window.location.origin}/album?c=${code.token}` : ''
  const partner = sponsoren.find((s) => s.id === partnerId) ?? null

  useEffect(() => {
    if (!canvas.current || !code) return
    void zeichnePlakat(canvas.current, {
      url,
      gegner: spiel.gegner,
      anstoss: spiel.anstoss,
      saison,
      partner: partner ? { name: partner.name, logoUrl: partner.logo_url } : null,
    })
  }, [url, spiel.gegner, spiel.anstoss, saison, partner, code])

  const partnerSpeichern = async (id: string) => {
    setPartnerId(id)
    try {
      await erzeugen.mutateAsync({ spielId: spiel.id, partnerId: id || null, neu: false })
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  const name = `sva-checkin-${spiel.gegner.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${spiel.anstoss.slice(0, 10)}`
  const export_ = async (art: 'png' | 'pdf') => {
    if (!canvas.current) return
    setLaeuft(true)
    try {
      herunterladen(art === 'png' ? await canvasZuBlob(canvas.current, 'image/png') : await plakatPdf(canvas.current), `${name}.${art}`)
    } catch (e) {
      toast.error(friendlyError(e, 'Export fehlgeschlagen.'))
    } finally {
      setLaeuft(false)
    }
  }

  return (
    <Modal open onClose={onClose} title="QR-Plakat für den Eingang" description={`SVA – ${spiel.gegner} · ${datum(spiel.anstoss)}`} className="max-w-3xl">
      {!code ? (
        <p className="text-sm text-muted-foreground">Noch kein Code für dieses Spiel.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <canvas
            ref={canvas}
            width={A4.w}
            height={A4.h}
            className="w-full rounded border border-border shadow"
            style={{ aspectRatio: `${A4.w} / ${A4.h}` }}
            aria-label="Vorschau des A4-Plakats"
            data-testid="album-plakat"
          />
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="al-partner">Check-in präsentiert von</Label>
              <Select id="al-partner" value={partnerId} onChange={(e) => void partnerSpeichern(e.target.value)}>
                <option value="">— ohne Partner —</option>
                {sponsoren.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">Logo erscheint auf dem Plakat und auf dem Sticker-Tütchen. Verkaufbar als Partner-Leistung.</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button onClick={() => void export_('pdf')} disabled={laeuft}>
                <Download className="h-4 w-4" /> PDF (A4)
              </Button>
              <Button variant="outline" onClick={() => void export_('png')} disabled={laeuft}>
                <Download className="h-4 w-4" /> PNG
              </Button>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="al-link">Check-in-Link (nur für den Notfall, nicht posten)</Label>
              <Input id="al-link" readOnly value={url} onFocus={(e) => e.currentTarget.select()} />
            </div>
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>Gültig 1 Std. vor Anstoß bis kurz nach Abpfiff (läuft der Ticker länger: bis 30 min nach Abpfiff).</li>
              <li>1 Check-in pro Konto und Spiel. Bei Heimsieg gibt es automatisch ein Bonus-Tütchen.</li>
              <li>Plakat auf A4 drucken (Skalierung „Tatsächliche Größe“), am besten laminiert am Eingang.</li>
            </ul>
          </div>
        </div>
      )}
    </Modal>
  )
}

// ── Sticker-Katalog ─────────────────────────────────────────
function StickerTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const karten = useKarten()
  const roster = useRoster()
  const sponsoren = useSponsoren()
  const { save, remove, ausKader } = useKartenMutations()
  const [editor, setEditor] = useState<{ row: KarteRow | null } | null>(null)
  const [suche, setSuche] = useState(false)
  const [filter, setFilter] = useState<string>('alle')

  const rows = karten.data ?? []
  const sichtbar = filter === 'alle' ? rows : rows.filter((r) => r.typ === filter)
  const rosterSlug = (id: string | null) => (roster.data ?? []).find((r) => r.id === id)?.slug

  const walkouts = async () => {
    setSuche(true)
    let n = 0
    try {
      for (const k of rows.filter((r) => (r.typ === 'spieler' || r.typ === 'trainer') && !r.walkout_url)) {
        const url = await walkoutSuchen(k, rosterSlug(k.roster_id))
        if (url) {
          await save.mutateAsync({ id: k.id, input: { walkout_url: url } })
          n++
        }
      }
      toast.success(n ? `${n} Walkout-Video${n === 1 ? '' : 's'} verknüpft.` : 'Keine neuen Walkout-Videos gefunden (public/players/walkout/).')
    } catch (e) {
      toast.error(friendlyError(e))
    } finally {
      setSuche(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button
          onClick={async () => {
            try {
              const r = await ausKader.mutateAsync()
              toast.success(`Aus dem Kader: ${r.bronze} Spieler-, ${r.gold} Kapitäns- und ${r.trainer} Trainerstab-Sticker neu (Saison ${r.saison}).`)
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
          disabled={ausKader.isPending}
        >
          <Users className="h-4 w-4" /> Sticker aus Kader erzeugen
        </Button>
        <Button variant="outline" onClick={() => setEditor({ row: null })}>
          <ImagePlus className="h-4 w-4" /> Neuer Sticker
        </Button>
        <Button variant="ghost" onClick={() => void walkouts()} disabled={suche || !rows.length}>
          {suche ? <Loader2 className="h-4 w-4 animate-spin" /> : <Video className="h-4 w-4" />} Walkouts suchen
        </Button>
        <Select aria-label="Typ filtern" value={filter} onChange={(e) => setFilter(e.target.value)} className="ml-auto w-auto">
          <option value="alle">Alle ({rows.length})</option>
          {TYPEN.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label} ({rows.filter((r) => r.typ === t.value).length})
            </option>
          ))}
        </Select>
      </div>
      <p className="text-sm text-muted-foreground">
        Jeder Spieler hat einen Platz im Heft — weitere Versionen (Silber, Gold, Glitzer) zählen für denselben Platz. Momente sind meist Gold oder Glitzer.
        Partner-Sticker sind eine verkaufbare Leistung („Deine Firma als Sticker im SVA-Heft“).
      </p>
      {karten.isLoading ? (
        <SkeletonRows rows={6} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Sparkles} title="Noch keine Sticker" description="Starte mit „Sticker aus Kader erzeugen“ — danach Momente und Partner ergänzen." />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sichtbar.map((k) => (
            <li key={k.id} className={cn('flex gap-3 rounded-lg border border-border bg-card p-3', !k.aktiv && 'opacity-60')}>
              <div className="h-20 w-16 shrink-0 overflow-hidden rounded bg-secondary">
                {k.bild_url && <img src={k.bild_url} alt="" className="h-full w-full object-cover" loading="lazy" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{k.titel}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {typLabel(k.typ)}
                  {k.untertitel ? ` · ${k.untertitel}` : ''}
                  {k.saison ? ` · ${k.saison}` : ' · jede Saison'}
                  {k.walkout_url ? ' · Walkout' : ''}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Select
                    aria-label={`Seltenheit ${k.titel}`}
                    value={k.seltenheit}
                    className="h-9 w-auto py-0 text-xs"
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
                      const ok = await confirm({
                        title: 'Sticker löschen?',
                        description: 'Fans verlieren diesen Sticker aus ihrem Heft. Besser: deaktivieren.',
                        confirmLabel: 'Löschen',
                        destructive: true,
                      })
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
              </div>
            </li>
          ))}
        </ul>
      )}
      {editor && (
        <StickerEditor
          row={editor.row}
          roster={(roster.data ?? []).map((r) => ({ id: r.id, name: r.name, foto: r.foto_url, rolle: (r as { rolle?: string }).rolle ?? 'spieler' }))}
          sponsoren={(sponsoren.data ?? []).map((s) => ({ id: s.id, name: s.name }))}
          onClose={() => setEditor(null)}
        />
      )}
    </div>
  )
}

function StickerEditor({
  row,
  roster,
  sponsoren,
  onClose,
}: {
  row: KarteRow | null
  roster: { id: string; name: string; foto: string | null; rolle: string }[]
  sponsoren: { id: string; name: string }[]
  onClose: () => void
}) {
  const toast = useToast()
  const { save } = useKartenMutations()
  const stat = useAlbumStatistik()
  const [f, setF] = useState<KarteInput>(
    row ?? { typ: 'moment', seltenheit: 'gold', aktiv: true, saison: stat.data?.saison ?? null, titel: '', untertitel: null, bild_url: null, roster_id: null, sponsor_id: null, sortierung: 0 },
  )
  const [upload, setUpload] = useState(false)
  const datei = useRef<HTMLInputElement>(null)
  const set = (p: KarteInput) => setF((x) => ({ ...x, ...p }))

  const hochladen = async (file: File) => {
    setUpload(true)
    try {
      const img = await loadImage(file)
      const blob = await renderStickerFoto(img)
      set({ bild_url: await uploadPublicImage(blob, 'album', f.titel || 'sticker') })
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
      await save.mutateAsync({ id: row?.id, input: { ...f, titel: f.titel.trim(), untertitel: f.untertitel?.trim() || null, saison: f.saison?.trim() || null } })
      toast.success('Sticker gespeichert.')
      onClose()
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={row ? 'Sticker bearbeiten' : 'Neuer Sticker'}
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
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="st-typ">Art</Label>
            <Select id="st-typ" value={f.typ} onChange={(e) => set({ typ: e.target.value as KarteRow['typ'] })} disabled={!!row}>
              {TYPEN.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-selt">Seltenheit</Label>
            <Select id="st-selt" value={f.seltenheit} onChange={(e) => set({ seltenheit: e.target.value as KarteRow['seltenheit'] })}>
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
            <Label htmlFor="st-roster">{f.typ === 'spieler' ? 'Spieler' : 'Trainerstab'}</Label>
            <Select
              id="st-roster"
              value={f.roster_id ?? ''}
              onChange={(e) => {
                const r = roster.find((x) => x.id === e.target.value)
                set({ roster_id: e.target.value || null, titel: r?.name ?? f.titel, bild_url: f.bild_url ?? r?.foto ?? null })
              }}
            >
              <option value="">— auswählen —</option>
              {roster
                .filter((r) => (f.typ === 'spieler' ? r.rolle === 'spieler' : r.rolle !== 'spieler'))
                .map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
            </Select>
            <p className="text-xs text-muted-foreground">Für Sonderversionen (z. B. Gold „Torjäger“, Glitzer „Spieler des Spiels“) — zählt für denselben Platz im Heft.</p>
          </div>
        )}
        {f.typ === 'partner' && (
          <div className="space-y-1.5">
            <Label htmlFor="st-sponsor">Partner</Label>
            <Select
              id="st-sponsor"
              value={f.sponsor_id ?? ''}
              onChange={(e) => set({ sponsor_id: e.target.value || null, titel: f.titel || sponsoren.find((s) => s.id === e.target.value)?.name || '' })}
            >
              <option value="">— auswählen —</option>
              {sponsoren.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">Ohne eigenes Foto zeigt der Sticker das Partner-Logo.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="st-titel">Titel *</Label>
          <Input id="st-titel" value={f.titel ?? ''} maxLength={60} onChange={(e) => set({ titel: e.target.value })} placeholder="z. B. Das Tor zur Meisterschaft" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="st-unter">Untertitel / Bildunterschrift</Label>
          <Input id="st-unter" value={f.untertitel ?? ''} maxLength={80} onChange={(e) => set({ untertitel: e.target.value })} placeholder="z. B. 90+7. Minute · Meister 2026" />
        </div>
        <div className="space-y-1.5">
          <Label>Foto</Label>
          <div className="flex items-center gap-3">
            <div className="h-24 w-20 overflow-hidden rounded bg-secondary">{f.bild_url && <img src={f.bild_url} alt="" className="h-full w-full object-cover" />}</div>
            <input ref={datei} type="file" accept={ACCEPT_IMAGES} className="hidden" onChange={(e) => e.target.files?.[0] && void hochladen(e.target.files[0])} />
            <Button variant="outline" onClick={() => datei.current?.click()} disabled={upload}>
              {upload ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />} Foto wählen
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">Keine Kinder ohne Einwilligung der Eltern, keine Alkohol-Motive im Vordergrund.</p>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="st-saison">Saison</Label>
            <Input id="st-saison" value={f.saison ?? ''} onChange={(e) => set({ saison: e.target.value })} placeholder="leer = jede Saison" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-walk">Walkout-Video (optional)</Label>
            <Input id="st-walk" value={f.walkout_url ?? ''} onChange={(e) => set({ walkout_url: e.target.value || null })} placeholder="/players/walkout/…" />
          </div>
        </div>
        <Switch checked={!!f.aktiv} onChange={(v) => set({ aktiv: v })} label="Aktiv" hint="Nur aktive Sticker können gezogen werden und erscheinen im Heft." />
      </div>
    </Modal>
  )
}

// ── Gutscheine ──────────────────────────────────────────────
function GutscheineTab() {
  const toast = useToast()
  const confirm = useConfirm()
  const q = useGutscheine()
  const einloesen = useGutscheinEinloesen()
  const [suche, setSuche] = useState('')
  const [nurOffen, setNurOffen] = useState(true)
  const rows = (q.data ?? []).filter(
    (g) => (!nurOffen || g.status === 'offen') && (!suche || g.code.includes(suche.toUpperCase()) || (g.name ?? '').toLowerCase().includes(suche.toLowerCase())),
  )
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Input aria-label="Code oder Name suchen" placeholder="Code (SVA-…) oder Name" value={suche} onChange={(e) => setSuche(e.target.value)} className="max-w-xs" />
        <div className="w-60">
          <Switch checked={nurOffen} onChange={setNurOffen} label="Nur offene" />
        </div>
      </div>
      <p className="text-sm text-muted-foreground">
        Eingelöst wird normalerweise direkt am Stand: Der Fan tippt „Einlösen“ und bestätigt — danach zeigt sein Handy einen großen Haken mit Uhrzeit, der Gutschein ist verbraucht. Hier nur für Notfälle (z. B. Akku leer).
        „Album komplett“ ist ein Los für die Saison-Verlosung.
      </p>
      {q.isLoading ? (
        <SkeletonRows rows={5} />
      ) : rows.length === 0 ? (
        <EmptyState icon={Ticket} title={nurOffen ? 'Keine offenen Gutscheine' : 'Noch keine Gutscheine'} description="Gutscheine entstehen automatisch beim 5. und 10. Check-in und bei vollem Heft." />
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {rows.map((g) => (
            <li key={g.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="font-mono text-sm font-semibold">{g.code}</span>
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{g.titel}</p>
                <p className="text-xs text-muted-foreground">
                  {g.name ?? 'Konto gelöscht'} · {new Date(g.created_at).toLocaleDateString('de-DE')} · Saison {g.saison}
                </p>
              </div>
              {g.status === 'eingeloest' ? (
                <span className="text-xs text-muted-foreground">
                  eingelöst {g.eingeloest_at ? new Date(g.eingeloest_at).toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' }) : ''} ({g.eingeloest_durch === 'admin' ? 'Admin' : 'Stand'})
                </span>
              ) : g.stufe === 'komplett' ? (
                <span className="rounded-full bg-sva-gold px-2 py-0.5 text-xs font-bold text-black">Verlosung</span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    const ok = await confirm({ title: `${g.code} einlösen?`, description: `${g.titel} für ${g.name ?? 'Fan'} als eingelöst markieren.`, confirmLabel: 'Einlösen' })
                    if (!ok) return
                    try {
                      await einloesen.mutateAsync(g.id)
                      toast.success('Eingelöst.')
                    } catch (e) {
                      toast.error(friendlyError(e))
                    }
                  }}
                >
                  Einlösen
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

// ── Regeln ──────────────────────────────────────────────────
function EinstellungenTab() {
  const toast = useToast()
  const q = useAlbumEinstellungen()
  const sponsoren = useSponsoren()
  const stat = useAlbumStatistik()
  const speichern = useSaveAlbumEinstellungen()
  // Entwurf erst bei der ersten Änderung anlegen; bis dahin gilt der geladene Stand
  const [entwurf, setF] = useState<EinstellungenInput | null>(null)
  const f = entwurf ?? q.data ?? null
  if (q.isLoading || !f) return <SkeletonRows rows={6} />
  const set = (p: EinstellungenInput) => setF((x) => ({ ...(x ?? f), ...p }))
  const summe = (f.gewicht_bronze ?? 0) + (f.gewicht_silber ?? 0) + (f.gewicht_gold ?? 0) + (f.gewicht_spezial ?? 0)
  const pct = (n?: number) => (summe ? `${((100 * (n ?? 0)) / summe).toLocaleString('de-DE', { maximumFractionDigits: 1 })} %` : '–')
  const zahl = (key: keyof EinstellungenInput, label: string, min: number, max: number, hint?: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={`e-${key}`}>{label}</Label>
      <Input id={`e-${key}`} type="number" inputMode="numeric" min={min} max={max} value={String(f[key] ?? '')} onChange={(e) => set({ [key]: Number(e.target.value) } as EinstellungenInput)} />
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  )
  const partnerWahl = (key: 'partner_1_id' | 'partner_2_id' | 'partner_komplett_id') => (
    <Select aria-label="präsentiert von" value={f[key] ?? ''} onChange={(e) => set({ [key]: e.target.value || null } as EinstellungenInput)}>
      <option value="">— ohne Partner —</option>
      {(sponsoren.data ?? [])
        .filter((s) => s.aktiv)
        .map((s) => (
          <option key={s.id} value={s.id}>
            präsentiert von {s.name}
          </option>
        ))}
    </Select>
  )
  const csv = () => {
    const zeilen = ['Name;E-Mail', ...(stat.data?.kontakte ?? []).map((k) => `${k.name};${k.email}`)]
    // BOM, damit Excel die Umlaute richtig liest
    herunterladen(new Blob(['﻿' + zeilen.join('\n')], { type: 'text/csv;charset=utf-8' }), 'sva-album-erinnerung.csv')
  }

  return (
    <div className="space-y-6">
      <section className="space-y-2 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Gutscheine am Stand</h2>
        <p className="text-sm text-muted-foreground">
          Ohne PIN: Der Fan zeigt den Gutschein, tippt „Einlösen“ und bestätigt „Wirklich einlösen?“. Danach steht auf seinem Handy ein großer
          Haken mit Datum und Uhrzeit — der Gutschein ist verbraucht und lässt sich kein zweites Mal einlösen. Helfer achten nur auf den Haken.
        </p>
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Belohnungen</h2>
        <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)_minmax(0,1fr)]">
          {zahl('schwelle_1', 'Check-ins', 1, 60)}
          <div className="space-y-1.5">
            <Label htmlFor="e-b1">1. Belohnung</Label>
            <Input id="e-b1" value={f.belohnung_1 ?? ''} maxLength={80} onChange={(e) => set({ belohnung_1: e.target.value })} />
          </div>
          <div className="space-y-1.5 self-end">{partnerWahl('partner_1_id')}</div>
          {zahl('schwelle_2', 'Check-ins', 2, 60)}
          <div className="space-y-1.5">
            <Label htmlFor="e-b2">2. Belohnung</Label>
            <Input id="e-b2" value={f.belohnung_2 ?? ''} maxLength={80} onChange={(e) => set({ belohnung_2: e.target.value })} />
          </div>
          <div className="space-y-1.5 self-end">{partnerWahl('partner_2_id')}</div>
          <div className="flex items-end pb-2 text-sm text-muted-foreground">Heft voll</div>
          <div className="space-y-1.5">
            <Label htmlFor="e-bk">Mannschaft komplett</Label>
            <Input id="e-bk" value={f.belohnung_komplett ?? ''} maxLength={80} onChange={(e) => set({ belohnung_komplett: e.target.value })} />
          </div>
          <div className="space-y-1.5 self-end">{partnerWahl('partner_komplett_id')}</div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Tütchen & Chancen</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {zahl('gewicht_bronze', `Kader · ${pct(f.gewicht_bronze)}`, 0, 1000)}
          {zahl('gewicht_silber', `Silber · ${pct(f.gewicht_silber)}`, 0, 1000)}
          {zahl('gewicht_gold', `Gold · ${pct(f.gewicht_gold)}`, 0, 1000)}
          {zahl('gewicht_spezial', `Glitzer · ${pct(f.gewicht_spezial)}`, 0, 1000)}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {zahl('karten_pro_pack', 'Sticker pro Tütchen', 1, 5, 'Standard 3')}
          {zahl('doppelte_bremse', 'Doppelten-Bremse %', 0, 100, 'bevorzugt fehlende Sticker')}
          {zahl('fenster_vor_min', 'Fenster vor Anstoß (min)', 0, 240)}
          {zahl('fenster_nach_min', 'Fenster nach Anstoß (min)', 15, 360, '135 ≈ Abpfiff + 30 min')}
        </div>
        <Switch checked={!!f.bonus_heimsieg} onChange={(v) => set({ bonus_heimsieg: v })} label="Bonus-Tütchen bei Heimsieg" hint="Wird automatisch verteilt, sobald das Ergebnis feststeht." />
        <Switch checked={!!f.aktiv} onChange={(v) => set({ aktiv: v })} label="Album aktiv" hint="Aus = Check-ins werden freundlich abgelehnt (z. B. Sommerpause)." />
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          onClick={async () => {
            try {
              await speichern.mutateAsync(f)
              toast.success('Gespeichert.')
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
          disabled={speichern.isPending}
        >
          Speichern
        </Button>
      </div>

      <section className="space-y-2 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Kennzahlen</h2>
        <p className="text-sm text-muted-foreground">
          {stat.data?.fans ?? 0} Fans · {stat.data?.checkinsSaison ?? 0} Check-ins · {stat.data?.albenKomplett ?? 0} {stat.data?.albenKomplett === 1 ? 'Heft' : 'Hefte'} komplett · {stat.data?.fansRangliste ?? 0} in der Rangliste ·{' '}
          {stat.data?.fansErinnerung ?? 0} mit Erinnerungs-Einwilligung
        </p>
        <Button variant="outline" size="sm" onClick={csv} disabled={!stat.data?.kontakte.length}>
          <Download className="h-4 w-4" /> E-Mails mit Einwilligung (CSV)
        </Button>
        <p className="text-xs text-muted-foreground">Nur Fans, die „Erinnerung vor Heimspielen“ angehakt haben. Nicht weitergeben, nur für die Spieltags-Erinnerung nutzen.</p>
      </section>
    </div>
  )
}
