import { useEffect, useMemo, useRef, useState } from 'react'
import { Plus, Handshake, ChevronUp, ChevronDown, ImagePlus, ImageOff, Trash2, Loader2, ExternalLink, Archive, Package, BarChart3, Inbox, Radio } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { Switch } from '../components/ui/switch'
import { Select } from '../components/ui/select'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { PflegeHinweis } from '../components/PflegeHinweis'
import type { SponsorInput, SponsorRow } from '../lib/db'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useSponsoren, useSponsorenMutations } from '../lib/queries'
import { uploadPublicImage } from '../lib/pflege'
import { ACCEPT_IMAGES, loadImage, renderLogo } from '../lib/image'
import { STUFEN, stufeLabel, useNeueAnfragen, usePakete, usePartnerInfo, useSavePartnerInfo, type AnfrageRow } from '../lib/partner'
import { cn } from '../lib/utils'
import { PaketeTab } from './partner/PaketeTab'
import { ZahlenTab } from './partner/ZahlenTab'
import { AnfragenTab } from './partner/AnfragenTab'

// ─────────────────────────────────────────────────────────────
// v14-C: Sponsoren für die Website — Name, Logo, Link, „auf der Bande“,
// Reihenfolge, aktiv. v16-S: Bereich „Partner“ mit vier Tabs:
//   Sponsoren (+ Stufe, gekauftes Paket, „Live-Ticker präsentiert von“)
//   Pakete · Zahlen (Mediadaten) · Anfragen (Eingang von /partner)
// Route bleibt /sponsoren (Links/Tests), Tab über ?tab=.
// Pakete/Laufzeiten/Kontakte (CRM) bleiben im Archiv-Modul „Sponsoren-CRM“.
// ─────────────────────────────────────────────────────────────

type Tab = 'sponsoren' | 'pakete' | 'zahlen' | 'anfragen'
const TABS: Tab[] = ['sponsoren', 'pakete', 'zahlen', 'anfragen']

const RANG: Record<string, number> = { hauptpartner: 0, partner: 1, unterstuetzer: 2 }
const sortiere = (a: SponsorRow, b: SponsorRow) =>
  Number(b.aktiv) - Number(a.aktiv) ||
  (RANG[a.stufe ?? 'partner'] ?? 1) - (RANG[b.stufe ?? 'partner'] ?? 1) ||
  (a.sortierung ?? 0) - (b.sortierung ?? 0) ||
  a.name.localeCompare(b.name)

export function Sponsoren() {
  const [params, setParams] = useSearchParams()
  const tab = (TABS.includes(params.get('tab') as Tab) ? params.get('tab') : 'sponsoren') as Tab
  const setTab = (t: Tab) => setParams(t === 'sponsoren' ? {} : { tab: t }, { replace: true })
  const neu = useNeueAnfragen()
  const [vorlage, setVorlage] = useState<{ name: string; paketId: string | null } | null>(null)

  return (
    <>
      <PageHeader title="Partner" subtitle="Sponsoren, Pakete, Mediadaten und Anfragen — alles für /partner, die Bande und den Live-Ticker." />
      {/* Mobil 2×2 statt Scroll-Leiste: alle vier Bereiche bleiben sichtbar */}
      <div role="tablist" aria-label="Partner-Bereiche" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 sm:inline-grid sm:grid-cols-4">
        {(
          [
            ['sponsoren', 'Sponsoren', Handshake],
            ['pakete', 'Pakete', Package],
            ['zahlen', 'Zahlen', BarChart3],
            ['anfragen', 'Anfragen', Inbox],
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
            {value === 'anfragen' && neu > 0 && <span className="rounded-full bg-sva-gold px-1.5 text-[11px] font-bold text-black">{neu} neu</span>}
          </button>
        ))}
      </div>
      {tab === 'sponsoren' && <SponsorenTab vorlage={vorlage} onVorlageVerbraucht={() => setVorlage(null)} />}
      {tab === 'pakete' && <PaketeTab />}
      {tab === 'zahlen' && <ZahlenTab />}
      {tab === 'anfragen' && (
        <AnfragenTab
          onAlsSponsor={(a: AnfrageRow) => {
            setVorlage({ name: a.firma, paketId: a.paket_id })
            setTab('sponsoren')
          }}
        />
      )}
    </>
  )
}

function SponsorenTab({ vorlage, onVorlageVerbraucht }: { vorlage: { name: string; paketId: string | null } | null; onVorlageVerbraucht: () => void }) {
  const toast = useToast()
  const q = useSponsoren()
  const pakete = usePakete()
  const { create, update, remove } = useSponsorenMutations()
  const [editor, setEditor] = useState<{ open: boolean; row: SponsorRow | null; vorlage?: { name: string; paketId: string | null } }>({ open: false, row: null })

  useEffect(() => {
    if (!vorlage) return
    setEditor({ open: true, row: null, vorlage })
    onVorlageVerbraucht()
  }, [vorlage, onVorlageVerbraucht])

  const rows = useMemo(() => [...(q.data ?? [])].sort(sortiere), [q.data])
  const aktive = rows.filter((r) => r.aktiv)
  const altesSchema = rows.length > 0 && rows[0].bande === undefined
  // v16-S: Partner-Migration angewandt? (Tabelle sva_partner_pakete lesbar)
  const partnerBereit = !pakete.error
  const paketName = (id: string | null) => (pakete.data ?? []).find((p) => p.id === id)?.name ?? null

  const verschieben = async (index: number, richtung: -1 | 1) => {
    const ziel = index + richtung
    if (ziel < 0 || ziel >= aktive.length) return
    const neu = [...aktive]
    ;[neu[index], neu[ziel]] = [neu[ziel], neu[index]]
    try {
      for (let i = 0; i < neu.length; i++) {
        const soll = (i + 1) * 10
        if ((neu[i].sortierung ?? 0) !== soll) await update.mutateAsync({ id: neu[i].id, patch: { sortierung: soll } })
      }
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{aktive.length} auf der Website — Partner-Wand, Bande und Sponsoren-Streifen.</p>
        <Button onClick={() => setEditor({ open: true, row: null })}>
          <Plus className="h-4 w-4" /> Sponsor
        </Button>
      </div>

      {altesSchema && <PflegeHinweis schema className="mb-4" />}
      {pakete.error && isMissingSchema(pakete.error) && !altesSchema && (
        <PflegeHinweis schema title="Partner-Bereich noch nicht freigeschaltet" className="mb-4">
          Stufen, Pakete, Zahlen und Anfragen brauchen die Migration <code>20261006100000_sva_partner.sql</code> (Anleitung: docs/PARTNER.md). Sponsoren lassen sich trotzdem pflegen.
        </PflegeHinweis>
      )}

      {partnerBereit && <LivePartnerKarte sponsoren={aktive} />}

      {q.error && !q.isPending && <ErrorState className="mb-4" message={friendlyError(q.error)} onRetry={() => void q.refetch()} />}

      {q.isPending ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Noch keine Sponsoren"
          description="Solange hier niemand steht, zeigt die Website „Hier könnte dein Logo stehen“ und /partner eine einladende leere Partner-Wand."
          action={
            <Button onClick={() => setEditor({ open: true, row: null })}>
              <Plus className="h-4 w-4" /> Ersten Sponsor anlegen
            </Button>
          }
        />
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
          {rows.map((s) => {
            const i = aktive.indexOf(s)
            const paket = paketName(s.partner_paket_id ?? null)
            return (
              <li key={s.id} className={cn('flex items-center gap-1', !s.aktiv && 'opacity-55')}>
                <button type="button" onClick={() => setEditor({ open: true, row: s })} className="flex min-h-[68px] min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-accent/40">
                  <LogoBox url={s.logo_url} name={s.name} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate font-medium">{s.name}</span>
                      {partnerBereit && s.aktiv && (
                        <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide', s.stufe === 'hauptpartner' ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground')}>
                          {stufeLabel(s.stufe)}
                        </span>
                      )}
                    </span>
                    <span className="block truncate text-sm text-muted-foreground">
                      {!s.aktiv ? 'nicht auf der Website' : s.bande === false ? 'ohne Bande' : 'mit Bande'}
                      {paket ? ` · ${paket}` : ''}
                      {s.website_url ? ` · ${s.website_url.replace(/^https?:\/\/(www\.)?/, '')}` : ''}
                    </span>
                  </span>
                </button>
                {s.aktiv && aktive.length > 1 && (
                  <span className="flex flex-col pr-1">
                    <Button variant="ghost" size="icon" className="h-8 w-10" disabled={i <= 0} onClick={() => void verschieben(i, -1)} aria-label={`${s.name} nach oben`}>
                      <ChevronUp className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-10" disabled={i === aktive.length - 1} onClick={() => void verschieben(i, 1)} aria-label={`${s.name} nach unten`}>
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </span>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="mt-4 flex items-center gap-1.5 text-xs text-muted-foreground">
        <Archive className="h-3.5 w-3.5" /> Laufzeiten und Kontakte:{' '}
        <Link to="/sponsoren-crm" className="underline underline-offset-2">
          Sponsoren-CRM im Archiv
        </Link>
      </p>

      <SponsorFormular
        open={editor.open}
        row={editor.row}
        vorlage={editor.vorlage}
        partnerBereit={partnerBereit}
        pakete={(pakete.data ?? []).map((p) => ({ id: p.id, name: p.name }))}
        naechsteSortierung={Math.max(0, ...rows.map((r) => r.sortierung ?? 0)) + 10}
        onClose={() => setEditor((e) => ({ ...e, open: false }))}
        onSave={async (input, id) => {
          if (id) await update.mutateAsync({ id, patch: input })
          else await create.mutateAsync(input)
          toast.success(`${input.name} gespeichert. Erscheint nach „Website veröffentlichen“.`)
        }}
        onDelete={async (id) => {
          await remove.mutateAsync(id)
          toast.success('Sponsor gelöscht.')
        }}
      />
    </>
  )
}

/** v16-S: „Live-Ticker präsentiert von“ — wirkt auf /live sofort (web_live). */
function LivePartnerKarte({ sponsoren }: { sponsoren: SponsorRow[] }) {
  const toast = useToast()
  const info = usePartnerInfo()
  const save = useSavePartnerInfo()
  const aktuell = info.data?.live_partner_id ?? ''
  const gewaehlt = sponsoren.find((s) => s.id === aktuell) ?? null
  return (
    <div className="mb-4 flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center">
      <Radio className="hidden h-5 w-5 shrink-0 text-primary sm:block" />
      <div className="min-w-0 flex-1">
        <p className="font-medium">„Live-Ticker präsentiert von“</p>
        <p className="text-xs text-muted-foreground">Logo im Kopf von /live (sofort) und auf jeder Endstand-Story-Grafik.</p>
      </div>
      <div className="flex items-center gap-2 sm:w-72">
        {gewaehlt && <LogoBox url={gewaehlt.logo_url} name={gewaehlt.name} />}
        <Select
          aria-label="Live-Ticker präsentiert von"
          className="h-12 text-base"
          value={aktuell}
          disabled={info.isPending || save.isPending || !!info.error}
          onChange={async (e) => {
            try {
              await save.mutateAsync({ live_partner_id: e.target.value || null })
              toast.success(e.target.value ? 'Live-Ticker-Partner gesetzt. Auf /live sofort sichtbar.' : 'Live-Ticker ohne Partner.')
            } catch (err) {
              toast.error(friendlyError(err))
            }
          }}
        >
          <option value="">— niemand —</option>
          {sponsoren.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </div>
    </div>
  )
}

export function LogoBox({ url, name, gross }: { url: string | null; name: string; gross?: boolean }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center overflow-hidden rounded-md border border-border bg-white', gross ? 'h-24 w-48 p-2' : 'h-12 w-20 p-1')}>
      {url ? (
        <img src={url} alt={name} className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="font-display text-lg text-neutral-400">{name.slice(0, 1).toUpperCase() || '?'}</span>
      )}
    </span>
  )
}

function SponsorFormular({
  open,
  row,
  vorlage,
  partnerBereit,
  pakete,
  naechsteSortierung,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean
  row: SponsorRow | null
  vorlage?: { name: string; paketId: string | null }
  partnerBereit: boolean
  pakete: { id: string; name: string }[]
  naechsteSortierung: number
  onClose: () => void
  onSave: (input: SponsorInput & { name: string }, id?: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
}) {
  const confirm = useConfirm()
  const fileRef = useRef<HTMLInputElement>(null)
  const [name, setName] = useState('')
  const [link, setLink] = useState('')
  const [bande, setBande] = useState(true)
  const [aktiv, setAktiv] = useState(true)
  const [stufe, setStufe] = useState('partner')
  const [paketId, setPaketId] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [neuesLogo, setNeuesLogo] = useState<{ blob: Blob; vorschau: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setName(row?.name ?? vorlage?.name ?? '')
    setLink(row?.website_url ?? '')
    setBande(row?.bande ?? true)
    setAktiv(row?.aktiv ?? true)
    setStufe(row?.stufe ?? 'partner')
    setPaketId(row?.partner_paket_id ?? vorlage?.paketId ?? '')
    setLogoUrl(row?.logo_url ?? null)
    setNeuesLogo(null)
    setError(null)
  }, [open, row, vorlage])

  useEffect(() => () => {
    if (neuesLogo) URL.revokeObjectURL(neuesLogo.vorschau)
  }, [neuesLogo])

  const onFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const img = await loadImage(file)
      const blob = await renderLogo(img)
      setNeuesLogo({ blob, vorschau: URL.createObjectURL(blob) })
      setError(null)
    } catch {
      setError('Dieses Bild kann der Browser nicht lesen. Bitte PNG, JPG oder WebP wählen (PNG mit transparentem Hintergrund ist ideal).')
    }
  }

  const submit = async () => {
    const n = name.trim()
    if (!n) return setError('Bitte den Namen eintragen.')
    let url = link.trim()
    if (url && !/^https?:\/\//i.test(url)) url = `https://${url}`
    if (url) {
      try {
        new URL(url)
      } catch {
        return setError('Der Link sieht nicht richtig aus, z. B. https://baeckerei-muster.de')
      }
    }
    setSaving(true)
    setError(null)
    try {
      let logo_url = logoUrl
      if (neuesLogo) logo_url = await uploadPublicImage(neuesLogo.blob, 'sponsoren', n)
      await onSave(
        {
          name: n,
          website_url: url || null,
          bande,
          aktiv,
          logo_url,
          ...(partnerBereit ? { stufe, partner_paket_id: paketId || null } : {}),
          ...(row ? {} : { sortierung: naechsteSortierung }),
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
    const ok = await confirm({
      title: `${row.name} löschen?`,
      description: 'Tipp: „Auf der Website zeigen“ ausschalten blendet nur aus — CRM-Daten im Archiv bleiben dann erhalten.',
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

  const zeigeLogo = neuesLogo?.vorschau ?? logoUrl

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={row ? `${row.name} bearbeiten` : 'Sponsor hinzufügen'}
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
      <div className="flex flex-col items-center gap-2">
        <LogoBox url={zeigeLogo} name={name} gross />
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
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={() => fileRef.current?.click()}>
            <ImagePlus className="h-4 w-4" /> {zeigeLogo ? 'Anderes Logo' : 'Logo hochladen'}
          </Button>
          {zeigeLogo && (
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground"
              onClick={() => {
                setNeuesLogo(null)
                setLogoUrl(null)
              }}
            >
              <ImageOff className="h-4 w-4" /> Entfernen
            </Button>
          )}
        </div>
        {neuesLogo && <p className="text-xs text-muted-foreground">Verkleinert auf {Math.round(neuesLogo.blob.size / 1024)} KB — wird beim Speichern hochgeladen.</p>}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="sp-name">Name *</Label>
        <Input id="sp-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Bäckerei Behrens" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sp-link">Website des Sponsors (optional)</Label>
        <div className="flex gap-2">
          <Input id="sp-link" className="h-12 text-base" inputMode="url" value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://…" />
          {link.trim() && (
            <Button asChild variant="outline" size="icon" className="h-12 w-12 shrink-0">
              <a href={/^https?:\/\//i.test(link.trim()) ? link.trim() : `https://${link.trim()}`} target="_blank" rel="noreferrer" aria-label="Link testen">
                <ExternalLink className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {partnerBereit && (
        <>
          <div className="space-y-1.5">
            <Label id="sp-stufe-label">Stufe auf der Partner-Wand</Label>
            <div role="radiogroup" aria-labelledby="sp-stufe-label" className="grid grid-cols-3 gap-2">
              {STUFEN.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={stufe === s.value}
                  onClick={() => setStufe(s.value)}
                  className={cn(
                    'min-h-12 rounded-lg border px-2 py-2 text-sm font-medium transition-colors',
                    stufe === s.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border hover:bg-accent/40',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="sp-paket">Gebuchtes Paket (zählt bei „noch x frei“)</Label>
            <Select id="sp-paket" className="h-12 text-base" value={paketId} onChange={(e) => setPaketId(e.target.value)}>
              <option value="">— kein Paket —</option>
              {pakete.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </div>
        </>
      )}

      <div className="grid gap-2">
        <Switch checked={aktiv} onChange={setAktiv} label="Auf der Website zeigen" />
        <Switch checked={bande} onChange={setBande} disabled={!aktiv} label="Auf der Bande" hint="Logo auch auf der 3D-Bande am Spielfeld — sonst nur Partner-Wand und Sponsoren-Streifen" />
      </div>

      {error && (
        <p role="alert" className="rounded-md border border-primary/40 bg-primary/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}
    </Modal>
  )
}
