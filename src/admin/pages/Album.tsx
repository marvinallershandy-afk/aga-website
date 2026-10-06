import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, CalendarCheck, Download, ExternalLink, FlaskConical, KeyRound, ListChecks, MonitorPlay, QrCode, RefreshCw, Settings2, Sparkles, Star, Target, Ticket, Trophy, Users } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Textarea } from '../components/ui/textarea'
import { Label } from '../components/ui/label'
import { Modal } from '../components/ui/modal'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useSpiele, useSponsoren } from '../lib/queries'
import { cn } from '../lib/utils'
import {
  useAlbumEinstellungen,
  useAlbumStatistik,
  useCodeErzeugen,
  useCodes,
  useGutscheinEinloesen,
  useGutscheine,
  useSaveAlbumEinstellungen,
  type EinstellungenInput,
} from '../lib/album'
import { A4, canvasZuBlob, herunterladen, plakatPdf, zeichnePlakat } from '../lib/albumPlakat'
import { KartenTab } from './album/KartenTab'
import { ZieleTab } from './album/ZieleTab'
import { CodesTab } from './album/CodesTab'
import { VerlosungenTab } from './album/VerlosungenTab'
import { WocheTab } from './album/WocheTab'
import { ShinyGeheimTab, LaborTab } from './album/ShinyGeheimTab'
import { PackKontrolleKarte, PackTypenEditor } from './album/PackTypen'

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

type Tab = 'woche' | 'spieltage' | 'karten' | 'ziele' | 'codes' | 'verlosungen' | 'gutscheine' | 'einstellungen' | 'shiny' | 'labor'
const TABS: Tab[] = ['woche', 'spieltage', 'karten', 'ziele', 'codes', 'verlosungen', 'gutscheine', 'einstellungen', 'shiny', 'labor']
/** v22-A: Album als Vorführung (rein im Browser, Demo-Fan, nichts wird gespeichert). */
export const ALBUM_VORFUEHRUNG_PFAD = '/album?vorfuehrung=1'

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
  const roh = params.get('tab') === 'sticker' ? 'karten' : params.get('tab')
  const tab = (TABS.includes(roh as Tab) ? roh : 'woche') as Tab
  const setTab = (t: Tab) => setParams(t === 'woche' ? {} : { tab: t }, { replace: true })
  const stat = useAlbumStatistik(tab === 'spieltage')
  const fehlt = stat.error && isMissingSchema(stat.error)

  return (
    <>
      <PageHeader
        title="Album"
        subtitle="Das Sammelalbum auf /album: Wochen-Ablauf, QR-Check-in, Kartenkatalog, Ziele, Codes, Verlosungen, Gutscheine, Regeln, Shiny & Geheimkarten."
        actions={
          <Button asChild variant="outline" className="h-11" data-testid="album-vorfuehrung">
            <a href={ALBUM_VORFUEHRUNG_PFAD} target="_blank" rel="noreferrer" title="Simuliertes Album mit Demo-Fan: Packs (normal, Gold, Shiny, alle Karten), Geheimkarten, Kartenlabor. Nichts wird gespeichert.">
              <MonitorPlay className="h-4 w-4" /> Album-Vorführung öffnen <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </Button>
        }
      />
      <div role="tablist" aria-label="Album-Bereiche" className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-secondary p-1 sm:inline-grid sm:grid-cols-5 lg:grid-cols-10">
        {(
          [
            ['woche', 'Woche', ListChecks],
            ['spieltage', 'Spieltage', CalendarCheck],
            ['karten', 'Karten', Sparkles],
            ['ziele', 'Ziele', Target],
            ['codes', 'Codes', KeyRound],
            ['verlosungen', 'Verlosungen', Trophy],
            ['gutscheine', 'Gutscheine', Ticket],
            ['einstellungen', 'Regeln', Settings2],
            ['shiny', 'Shiny & Geheim', Star],
            ['labor', 'Labor', FlaskConical],
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
          {tab === 'woche' && <WocheTab />}
          {tab === 'spieltage' && <SpieltageTab />}
          {tab === 'karten' && <KartenTab />}
          {tab === 'ziele' && <ZieleTab />}
          {tab === 'codes' && <CodesTab />}
          {tab === 'verlosungen' && <VerlosungenTab />}
          {tab === 'gutscheine' && <GutscheineTab />}
          {tab === 'einstellungen' && <EinstellungenTab />}
          {tab === 'shiny' && <ShinyGeheimTab />}
          {tab === 'labor' && <LaborTab />}
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
  const navigate = useNavigate()
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
  const partnerWahl = (key: 'partner_1_id' | 'partner_2_id' | 'partner_3_id' | 'partner_komplett_id') => (
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

      {/* v25-D: Check-in am Eingang — rotierender Code + iPad-Anzeige */}
      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Check-in am Eingang</h2>
        <Switch
          checked={f.checkin_rotation !== false}
          onChange={(v) => set({ checkin_rotation: v })}
          label="Wechselnden Code nutzen (Fern-Check-in verhindern)"
          hint="Der QR auf der Check-in-Anzeige wechselt regelmäßig — ein abfotografierter Code taugt dann nicht mehr für zu Hause. Der statische QR bleibt als Notfall-Fallback."
        />
        {f.checkin_rotation !== false && (
          <div className="sm:max-w-[220px]">{zahl('checkin_rotation_minuten', 'Wechsel alle … Minuten', 1, 10, 'Standard 3')}</div>
        )}
        <div className="space-y-1.5">
          <Button type="button" variant="outline" onClick={() => navigate('/checkin-anzeige')}>
            <MonitorPlay className="h-4 w-4" /> Check-in-Anzeige öffnen (fürs iPad)
          </Button>
          <p className="text-xs text-muted-foreground">
            Vollbild fürs Tablet am Eingang/an der Kasse: großer QR mit Countdown, Live-Zähler „heute eingecheckt“ und ruhig wechselnden Spielerkarten.
            Bildschirm bleibt an; Ausstieg per langem Druck.
          </p>
        </div>
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
          {zahl('schwelle_3', 'Check-ins', 3, 60)}
          <div className="space-y-1.5">
            <Label htmlFor="e-b3">3. Belohnung (Verlosungs-Los)</Label>
            <Input id="e-b3" value={f.belohnung_3 ?? ''} maxLength={80} onChange={(e) => set({ belohnung_3: e.target.value })} />
          </div>
          <div className="space-y-1.5 self-end">{partnerWahl('partner_3_id')}</div>
          <div className="flex items-end pb-2 text-sm text-muted-foreground">Mannschaft voll</div>
          <div className="space-y-1.5">
            <Label htmlFor="e-bk">Mannschaft komplett</Label>
            <Input id="e-bk" value={f.belohnung_komplett ?? ''} maxLength={80} onChange={(e) => set({ belohnung_komplett: e.target.value })} />
          </div>
          <div className="space-y-1.5 self-end">{partnerWahl('partner_komplett_id')}</div>
        </div>
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Packs & Chancen</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {zahl('gewicht_bronze', `Kader · ${pct(f.gewicht_bronze)}`, 0, 1000)}
          {zahl('gewicht_silber', `Silber · ${pct(f.gewicht_silber)}`, 0, 1000)}
          {zahl('gewicht_gold', `Gold · ${pct(f.gewicht_gold)}`, 0, 1000)}
          {zahl('gewicht_spezial', `Spezial · ${pct(f.gewicht_spezial)}`, 0, 1000)}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {zahl('karten_pro_pack', 'Karten je Geschenk-Pack', 1, 5, 'sonstige Packs ohne Pack-Typ, Standard 3')}
          {zahl('doppelte_bremse', 'Doppelten-Bremse %', 0, 100, 'bevorzugt fehlende Karten (v24: Standard 5)')}
          {zahl('fenster_vor_min', 'Fenster vor Anstoß (min)', 0, 240)}
          {zahl('fenster_nach_min', 'Fenster nach Anstoß (min)', 15, 360, '135 ≈ Abpfiff + 30 min')}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {zahl('karten_story', 'Story-Code', 0, 5, 'Einzelkarte, Standard 1')}
          {zahl('karten_freund', 'Freund-Bonus', 0, 5, 'beide eingecheckt, Standard 1')}
          {zahl('smart_ab_karten', 'Smart-Pack ab … Karten', 1, 10, 'v24: 2 — Einzelkarten (Story/Advent/Freund) sind reiner Zufall')}
        </div>
        <p className="text-xs text-muted-foreground">Tipp-, Spieltags-, Sieg-, Starter-, Ziel- und Event-Pack stellst du unten unter „Pack-Typen“ ein.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <Switch checked={!!f.smart_pack} onChange={(v) => set({ smart_pack: v })} label="Smart-Pack" hint="Erste Karte jedes Packs ist eine fehlende" />
          <Switch checked={!!f.smart_pack_belohnung} onChange={(v) => set({ smart_pack_belohnung: v })} label="Smart-Pack auch bei Belohnungen" hint="Aus empfohlen (sonst zu schnell komplett)" />
          <Switch checked={!!f.bonus_heimsieg} onChange={(v) => set({ bonus_heimsieg: v })} label="Bonus-Pack bei Heimsieg" hint="Wird automatisch verteilt, sobald das Ergebnis feststeht." />
        </div>
        <Switch checked={!!f.aktiv} onChange={(v) => set({ aktiv: v })} label="Album aktiv" hint="Aus = Check-ins werden freundlich abgelehnt (z. B. Sommerpause)." />
      </section>

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Tausch, Codes & Lose</h2>
        <div className="grid gap-3 sm:grid-cols-4">
          {zahl('tausch_min_tage', 'Tausch ab Kontoalter (Tage)', 0, 60, 'Standard 7')}
          {zahl('tausch_pro_woche', 'Tausche pro Woche', 0, 50, 'Standard 5')}
          {zahl('wunsch_kosten', 'Doppelte je Wunschkarte', 2, 10, 'v24: Standard 5')}
          {zahl('code_fehler_limit', 'Code-Fehlversuche/Std.', 3, 100, 'danach gesperrt')}
          {zahl('lose_checkin', 'Lose je Check-in', 0, 10, 'Standard 1')}
          {zahl('lose_komplett', 'Lose für volles Album', 0, 100, 'Standard 5')}
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          {zahl('shiny_chance', 'Shiny-Chance 1 : N', 0, 100000, 'je Spieler-/Trainerkarte · 0 = aus · Standard 250')}
          <div className="space-y-1.5">
            <Label htmlFor="e-geb">Vereins-Geburtstag</Label>
            <Input id="e-geb" type="date" value={f.vereins_geburtstag ?? ''} onChange={(e) => set({ vereins_geburtstag: e.target.value || null })} />
            <p className="text-xs text-muted-foreground">Gründungstag (1949). Nur an diesem Tag gibt es die Geheimkarte „Seit 1949“.</p>
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="e-tn">Teilnahmebedingungen Verlosung</Label>
          <Textarea id="e-tn" rows={4} value={f.teilnahme_text ?? ''} onChange={(e) => set({ teilnahme_text: e.target.value })} />
        </div>
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

      <section className="space-y-4 rounded-lg border border-border p-4">
        <h2 className="font-display text-xl">Pack-Typen</h2>
        <PackTypenEditor />
      </section>
      <PackKontrolleKarte />

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
