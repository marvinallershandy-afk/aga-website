import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { CalendarClock, ClipboardCheck, Crown, Download, ExternalLink, Image as ImageIcon, Loader2, Minus, MonitorPlay, Plus, Settings2, Share2, Shirt, Trophy, Users } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Select } from '../components/ui/select'
import { Switch } from '../components/ui/switch'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { useAuth } from '../auth/AuthProvider'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useSponsoren } from '../lib/queries'
import { cn } from '../lib/utils'
import {
  useBericht,
  useBerichtAktionen,
  useFupaVorschlag,
  useKabine,
  useSpieltagSpeichern,
  useStoryDaten,
  useTeilnehmer,
  useTippEinstellungen,
  useTippEinstellungenSpeichern,
  useTippSpieltage,
  useTippKader,
  useTippSpielerSpeichern,
  useTippPreise,
  useTippPreisAktionen,
  type TippPreis,
  type AdminSpieltag,
  type TippKaderZeile,
  type BerichtZeile,
  type StoryDaten,
} from '../lib/tippliga'
import { BONUS } from '../../tippen/model'
import type { BonusKey } from '../../tippen/api'

// ─────────────────────────────────────────────────────────────
// v20-T: Admin „Tipp-Liga“.
//   Spielbericht  (Team + Admin) — 2 Minuten nach Abpfiff am Handy:
//                 vorbefüllt aus Ticker + Aufstellung, Vorlagen/Minuten/
//                 Zu-null ergänzen, MOTM (Instagram-Wahl) eintragen,
//                 Bonusfragen bestätigen → „Werten“. Korrektur = neu werten.
//   Spieltage     (Team + Admin) — Bonusfragen je Spiel (Vorschlag aus dem
//                 Pool), Zuschauer-Linie, Testspiel als Winterwertung.
//   Story         (Admin) — Story-Grafiken der Woche als fertige PNGs.
//   Kabine & Regeln (Admin) — Spieler-Konten markieren, Partner, Preise.
// Deep-Links (Wochen-Checkliste): /admin/spielbericht/:spielId,
// /admin/tippliga/spieltage, /admin/tippliga/story, /admin/tippliga/kabine.
// ─────────────────────────────────────────────────────────────

type Tab = 'bericht' | 'spieltage' | 'kader' | 'story' | 'kabine'

/** v21: Tipp-Liga als Vorführung (rein im Browser, simulierte Daten, nichts wird gespeichert). */
export const TIPP_VORFUEHRUNG_PFAD = '/tippen?vorfuehrung=1'

const datum = (iso: string) =>
  new Date(iso).toLocaleString('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

function MigrationFehlt() {
  return (
    <EmptyState
      icon={Trophy}
      title="Die Tipp-Liga ist in der Datenbank noch nicht eingerichtet"
      description="Die Migration 20261012100000_sva_tippliga.sql fehlt noch. Bitte Marvin Bescheid geben — danach erscheinen hier Spielbericht, Bonusfragen und Story-Grafiken."
    />
  )
}

export function TippLiga() {
  const { tab: tabParam, spielId } = useParams()
  const navigate = useNavigate()
  const { rolle } = useAuth()
  const istAdmin = rolle !== 'team'
  const tab: Tab = spielId ? 'bericht' : (['bericht', 'spieltage', 'kader', 'story', 'kabine'].includes(tabParam ?? '') ? (tabParam as Tab) : 'bericht')
  const tage = useTippSpieltage()
  const fehlt = tage.error && isMissingSchema(tage.error)

  const tabs = (
    [
      ['bericht', 'Spielbericht', ClipboardCheck, true],
      ['spieltage', 'Spieltage', CalendarClock, true],
      ['kader', 'Kader', Shirt, true],
      ['story', 'Story', ImageIcon, istAdmin],
      ['kabine', 'Kabine & Regeln', Users, istAdmin],
    ] as const
  ).filter((t) => t[3])

  return (
    <>
      <PageHeader
        title="Tipp-Liga"
        subtitle="Spielbericht nach dem Abpfiff, Bonusfragen je Spieltag, Kader, Story-Grafiken für Instagram."
        actions={
          <Button asChild variant="outline" className="h-11" data-testid="tipp-vorfuehrung">
            <a href={TIPP_VORFUEHRUNG_PFAD} target="_blank" rel="noreferrer" title="Simulierte Tipp-Liga mit 15 Tippern — Phasen vor Anpfiff, Live, Abpfiff, Montag. Nichts wird gespeichert.">
              <MonitorPlay className="h-4 w-4" /> Tipp-Liga-Vorführung öffnen <ExternalLink className="h-3.5 w-3.5 opacity-60" />
            </a>
          </Button>
        }
      />
      <div role="tablist" aria-label="Tipp-Liga-Bereiche" className={cn('mb-5 grid gap-1 rounded-lg bg-secondary p-1 sm:inline-grid', tabs.length === 5 ? 'grid-cols-2 sm:grid-cols-5' : 'grid-cols-3')}>
        {tabs.map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => navigate(value === 'bericht' ? '/tippliga' : `/tippliga/${value}`, { replace: true })}
            className={cn(
              'flex min-h-11 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium transition-colors',
              tab === value ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>
      {fehlt ? (
        <MigrationFehlt />
      ) : (
        <>
          {tab === 'bericht' && <BerichtTab spielId={spielId ?? null} tage={tage.data ?? []} laedt={tage.isLoading} />}
          {tab === 'spieltage' && <SpieltageTab tage={tage.data ?? []} laedt={tage.isLoading} />}
          {tab === 'kader' && <KaderTab />}
          {tab === 'story' && istAdmin && <StoryTab />}
          {tab === 'kabine' && istAdmin && <KabineTab />}
        </>
      )}
    </>
  )
}

// ── Spielbericht ────────────────────────────────────────────
function BerichtTab({ spielId, tage, laedt }: { spielId: string | null; tage: AdminSpieltag[]; laedt: boolean }) {
  const navigate = useNavigate()
  const kandidaten = useMemo(
    () => tage.filter((t) => t.wertung && !t.offen).sort((a, b) => +new Date(b.anstoss) - +new Date(a.anstoss)),
    [tage],
  )
  // Standard: das jüngste geschlossene, noch nicht gewertete Spiel
  const vorschlag = kandidaten.find((t) => !t.gewertetAt)?.id ?? kandidaten[0]?.id ?? null
  const aktiv = spielId ?? vorschlag

  if (laedt) return <SkeletonRows rows={4} />
  if (!aktiv) {
    return <EmptyState icon={ClipboardCheck} title="Noch kein Spiel zum Werten" description="Sobald ein tippbares Spiel angepfiffen wurde, steht hier der Spielbericht." />
  }
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-[16rem] flex-1">
          <Label htmlFor="tp-spiel">Spiel</Label>
          <Select id="tp-spiel" value={aktiv} onChange={(e) => navigate(`/spielbericht/${e.target.value}`, { replace: true })}>
            {kandidaten.map((t) => (
              <option key={t.id} value={t.id}>
                {datum(t.anstoss)} · {t.heim ? 'vs' : 'bei'} {t.gegner}
                {t.gewertetAt ? ' · gewertet' : ' · offen'}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <BerichtFormular key={aktiv} spiel={aktiv} />
    </div>
  )
}

const KARTEN: { wert: BerichtZeile['karte']; label: string; cls: string }[] = [
  { wert: null, label: '–', cls: '' },
  { wert: 'gelb', label: 'G', cls: 'bg-yellow-400 text-black' },
  { wert: 'gelbrot', label: 'GR', cls: 'bg-gradient-to-r from-yellow-400 to-red-600 text-black' },
  { wert: 'rot', label: 'R', cls: 'bg-red-600 text-white' },
]

function Zaehler({ wert, onChange, label }: { wert: number; onChange: (n: number) => void; label: string }) {
  return (
    <div className="flex items-center gap-1" aria-label={label}>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-border disabled:opacity-30" onClick={() => onChange(Math.max(0, wert - 1))} disabled={wert === 0} aria-label={`${label} weniger`}>
        <Minus className="h-4 w-4" />
      </button>
      <span className="w-6 text-center font-display text-lg tabular-nums">{wert}</span>
      <button type="button" className="grid h-9 w-9 place-items-center rounded-md border border-border" onClick={() => onChange(Math.min(15, wert + 1))} aria-label={`${label} mehr`}>
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

function BerichtFormular({ spiel }: { spiel: string }) {
  const q = useBericht(spiel)
  const { speichern, werten, motmKarte } = useBerichtAktionen()
  const toast = useToast()
  const confirm = useConfirm()
  const [zeilen, setZeilen] = useState<BerichtZeile[] | null>(null)
  const [auf, setAuf] = useState<Partial<Record<BonusKey, string>>>({})
  const [erster, setErster] = useState<string>('')
  const [motm, setMotm] = useState<string>('')
  const [ergebnis, setErgebnis] = useState<{ toreSva: string; toreGegner: string }>({ toreSva: '', toreGegner: '' })
  const [alle, setAlle] = useState(false)
  // v23-U: Vorschlag aus der FuPa-Aufstellung (Minuten/Tore/Vorlagen/Karten).
  const vorschlagQ = useFupaVorschlag(spiel)
  const fupa = useMemo(() => new Map((vorschlagQ.data ?? []).map((v) => [v.id, v] as const)), [vorschlagQ.data])

  const b = q.data
  // Formular einmal aus der Antwort füllen (danach gehört es dem Nutzer)
  const [geladen, setGeladen] = useState<string | null>(null)
  if (b && geladen !== (b.berichtAt ?? 'neu') + b.spiel.id) {
    setGeladen((b.berichtAt ?? 'neu') + b.spiel.id)
    setZeilen(b.zeilen)
    setAuf(b.aufloesung ?? {})
    setErster(b.ersterTorschuetze ?? '')
    setMotm(b.spiel.motm ?? '')
    setErgebnis({ toreSva: b.spiel.toreSva != null ? String(b.spiel.toreSva) : '', toreGegner: b.spiel.toreGegner != null ? String(b.spiel.toreGegner) : '' })
  }

  if (q.isLoading || !b || !zeilen) return q.error ? <p className="text-sm text-destructive">{friendlyError(q.error)}</p> : <SkeletonRows rows={6} />

  const set = (id: string, patch: Partial<BerichtZeile>) =>
    setZeilen((z) => (z ?? []).map((x) => {
      if (x.id !== id) return x
      const n = { ...x, ...patch }
      // Zu-null nur sinnvoll für TW/ABW mit mind. 60 Minuten
      if (!(n.position === 'TW' || n.position === 'ABW') || (n.minuten ?? 90) < 60 || !n.eingesetzt) n.zuNull = false
      return n
    }))
  // v23-U: FuPa-Werte übernehmen — füllt nur LEERE Felder, überschreibt nichts.
  const fupaUebernehmen = () => {
    let n = 0
    setZeilen((z) =>
      (z ?? []).map((x) => {
        const v = fupa.get(x.id)
        if (!v) return x
        const y = { ...x }
        const spielte = !!v.start || (v.minuten ?? 0) > 0 || (v.tore ?? 0) > 0 || (v.vorlagen ?? 0) > 0
        if (!y.eingesetzt && spielte) {
          y.eingesetzt = true
          y.minuten = y.minuten ?? v.minuten ?? 90
          n++
        } else if (y.eingesetzt && y.minuten == null && v.minuten != null) {
          y.minuten = v.minuten
          n++
        }
        if (y.tore === 0 && (v.tore ?? 0) > 0) { y.tore = v.tore!; n++ }
        if (y.vorlagen === 0 && (v.vorlagen ?? 0) > 0) { y.vorlagen = v.vorlagen!; n++ }
        if (!y.karte && (v.rot || v.gelbrot || v.gelb)) { y.karte = v.rot ? 'rot' : v.gelbrot ? 'gelbrot' : 'gelb'; n++ }
        if (!(y.position === 'TW' || y.position === 'ABW') || (y.minuten ?? 90) < 60 || !y.eingesetzt) y.zuNull = false
        return y
      }),
    )
    toast.success(n ? `FuPa-Werte übernommen (${n} leere Felder gefüllt).` : 'Keine leeren Felder zu füllen.')
  }
  const sichtbar = zeilen.filter((z) => alle || z.eingesetzt || z.tore || z.vorlagen || z.karte)
  const eingesetzt = zeilen.filter((z) => z.eingesetzt).length
  const ohneTickerErgebnis = !b.mitTicker || b.spiel.toreSva == null
  const spieler = zeilen.filter((z) => z.eingesetzt)
  const ergebnisWert = ergebnis.toreSva !== '' && ergebnis.toreGegner !== '' ? { toreSva: Number(ergebnis.toreSva), toreGegner: Number(ergebnis.toreGegner) } : null

  const sichern = async () => {
    await speichern.mutateAsync({ spiel, zeilen, aufloesung: auf, erster: erster || null, motm: motm || null, ergebnis: ohneTickerErgebnis ? ergebnisWert : null })
  }
  const nurSpeichern = async () => {
    try {
      await sichern()
      toast.success('Spielbericht gespeichert.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  const sichernUndWerten = async () => {
    const fehlend = b.fragen.filter((f) => !auf[f.key])
    if (fehlend.length && !(await confirm({ title: 'Bonusfragen offen', description: `${fehlend.length} Bonusfrage(n) ohne Auflösung — dafür gibt es dann keine Punkte. Trotzdem werten?`, confirmLabel: 'Trotzdem werten' }))) return
    try {
      await sichern()
      const r = await werten.mutateAsync(spiel)
      toast.success(`Gewertet: ${r.teilnehmer} Tipper · Ø ${r.schnitt ?? 0} Punkte · ${r.exakt}× exakt. Ranglisten sind aktuell.`)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  const motmVeroeffentlichen = async () => {
    try {
      await sichern()
      await motmKarte.mutateAsync(spiel)
      toast.success('MOTM-Karte ist im Album.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }

  return (
    <div className="space-y-5 pb-28">
      {/* Kopf: Ergebnis + Zahlen */}
      <section className="rounded-lg border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{datum(b.spiel.anstoss)} · {b.spiel.heim ? 'Heimspiel' : 'Auswärts'}{b.wertung === 'winter' ? ' · Winterwertung' : ''}</p>
            <p className="font-display text-2xl">
              {b.spiel.heim ? `SVA – ${b.spiel.gegner}` : `${b.spiel.gegner} – SVA`}
            </p>
          </div>
          {!ohneTickerErgebnis ? (
            <p className="font-display text-4xl tabular-nums">
              {b.spiel.heim ? `${b.spiel.toreSva}:${b.spiel.toreGegner}` : `${b.spiel.toreGegner}:${b.spiel.toreSva}`}
            </p>
          ) : (
            <div className="flex items-end gap-2">
              <div>
                <Label htmlFor="e-sva">SVA</Label>
                <Input id="e-sva" inputMode="numeric" className="w-16 text-center" value={ergebnis.toreSva} onChange={(e) => setErgebnis((x) => ({ ...x, toreSva: e.target.value.replace(/\D/g, '').slice(0, 2) }))} />
              </div>
              <span className="pb-2 font-display text-2xl">:</span>
              <div>
                <Label htmlFor="e-geg">Gegner</Label>
                <Input id="e-geg" inputMode="numeric" className="w-16 text-center" value={ergebnis.toreGegner} onChange={(e) => setErgebnis((x) => ({ ...x, toreGegner: e.target.value.replace(/\D/g, '').slice(0, 2) }))} />
              </div>
            </div>
          )}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {b.anzahlTipps} Tipps · {b.anzahlElf} Elfs
          {b.checkins != null && ` · ${b.checkins} Check-ins`}
          {b.mitTicker ? ' · vorbefüllt aus dem Ticker' : ' · ohne Ticker — bitte Tore/Karten eintragen'}
          {b.mitAufstellung ? ' + Aufstellung' : ''}
          {b.gewertetAt && <> · <b className="text-foreground">gewertet {datum(b.gewertetAt)}</b></>}
        </p>
        {b.offen && <p className="mt-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm">Das Spiel ist noch nicht angepfiffen — werten geht erst nach dem Anpfiff.</p>}
      </section>

      {/* Spieler */}
      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center justify-between gap-3 border-b border-border p-4">
          <h2 className="font-display text-xl">Spieler · {eingesetzt} eingesetzt</h2>
          <div className="flex items-center gap-2">
            {fupa.size > 0 && (
              <Button variant="outline" size="sm" onClick={fupaUebernehmen} title="Minuten, Tore, Vorlagen und Karten aus der FuPa-Aufstellung in leere Felder übernehmen">
                FuPa-Werte übernehmen
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => setAlle((x) => !x)}>
              {alle ? 'Nur Eingesetzte' : 'Ganzer Kader'}
            </Button>
          </div>
        </div>
        <ul className="divide-y divide-border">
          {sichtbar.map((z) => (
            <li key={z.id} className={cn('flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3', !z.eingesetzt && 'opacity-60')}>
              <label className="flex min-w-[11rem] flex-1 items-center gap-3">
                <input type="checkbox" className="h-5 w-5 accent-[hsl(var(--primary))]" checked={z.eingesetzt} onChange={(e) => set(z.id, { eingesetzt: e.target.checked, minuten: e.target.checked ? (z.minuten ?? 90) : null })} />
                <span>
                  <span className="block font-medium">
                    {z.nummer != null && <span className="mr-1 text-muted-foreground">#{z.nummer}</span>}
                    {z.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {z.position}
                    {z.start ? ' · Startelf' : ''}
                  </span>
                  {(() => {
                    const v = fupa.get(z.id)
                    if (!v || (v.minuten == null && !v.tore && !v.vorlagen)) return null
                    const teile = [v.minuten != null ? `${v.minuten}′` : null, v.tore ? `${v.tore} T.` : null, v.vorlagen ? `${v.vorlagen} V.` : null].filter(Boolean)
                    return <span className="block text-[11px] text-sky-400">FuPa: {teile.join(' · ')}</span>
                  })()}
                </span>
              </label>
              <div className="flex items-center gap-1">
                <Input aria-label={`${z.name}: Minuten`} inputMode="numeric" className="h-9 w-14 text-center" value={z.minuten ?? ''} placeholder="Min" disabled={!z.eingesetzt} onChange={(e) => set(z.id, { minuten: e.target.value === '' ? null : Math.min(130, Number(e.target.value.replace(/\D/g, ''))) })} />
                <span className="text-xs text-muted-foreground">′</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Tor <Zaehler wert={z.tore} label={`${z.name}: Tore`} onChange={(n) => set(z.id, { tore: n, eingesetzt: n > 0 ? true : z.eingesetzt })} />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Vorl. <Zaehler wert={z.vorlagen} label={`${z.name}: Vorlagen`} onChange={(n) => set(z.id, { vorlagen: n })} />
              </div>
              <div className="flex gap-1" role="radiogroup" aria-label={`${z.name}: Karte`}>
                {KARTEN.map((k) => (
                  <button
                    key={k.label}
                    type="button"
                    role="radio"
                    aria-checked={(z.karte ?? null) === k.wert}
                    onClick={() => set(z.id, { karte: k.wert })}
                    className={cn('h-9 min-w-9 rounded-md border border-border px-2 text-xs font-bold', (z.karte ?? null) === k.wert ? k.cls || 'bg-secondary' : 'opacity-60')}
                  >
                    {k.label}
                  </button>
                ))}
              </div>
              {z.position === 'TW' || z.position === 'ABW' ? (
                <label className={cn('flex items-center gap-2 text-sm', (!z.eingesetzt || (z.minuten ?? 90) < 60) && 'opacity-40')}>
                  <input type="checkbox" className="h-5 w-5" checked={z.zuNull} disabled={!z.eingesetzt || (z.minuten ?? 90) < 60} onChange={(e) => set(z.id, { zuNull: e.target.checked })} />
                  Zu null
                </label>
              ) : (
                <span className="hidden w-[4.75rem] md:block" aria-hidden="true" />
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Torschütze + MOTM */}
      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 md:grid-cols-2">
        <div>
          <Label htmlFor="tp-erster">Erster SVA-Torschütze</Label>
          <Select id="tp-erster" value={erster} onChange={(e) => setErster(e.target.value)}>
            <option value="">— kein SVA-Tor / Eigentor —</option>
            {spieler.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
          {b.ersterAuto && <p className="mt-1 text-xs text-muted-foreground">Aus dem Ticker: {zeilen.find((z) => z.id === b.ersterAuto)?.name}</p>}
        </div>
        <div>
          <Label htmlFor="tp-motm">Spieler des Spiels (Instagram-Wahl)</Label>
          <div className="flex gap-2">
            <Select id="tp-motm" value={motm} onChange={(e) => setMotm(e.target.value)}>
              <option value="">— noch offen —</option>
              {spieler.map((z) => (
                <option key={z.id} value={z.id}>
                  {z.name}
                </option>
              ))}
            </Select>
            <Button
              variant="outline"
              onClick={() => void motmVeroeffentlichen()}
              disabled={!motm || !b.albumMotm || motmKarte.isPending}
              title={b.albumMotm ? 'Spezialkarte im Album veröffentlichen' : 'Album-Modul folgt'}
            >
              <Crown className="h-4 w-4" /> MOTM-Karte veröffentlichen
            </Button>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            {b.albumMotm ? 'Die Karte erscheint sofort im Sammelalbum.' : 'Album-Modul folgt — die MOTM-Karte kommt mit dem neuen Kartensystem.'} Montags eintragen und neu werten: +2 für richtige Tipps, +5 in der Elf.
          </p>
        </div>
      </section>

      {/* Bonusfragen */}
      <section className="rounded-lg border border-border bg-card p-4">
        <h2 className="mb-3 font-display text-xl">Bonusfragen</h2>
        <div className="space-y-4">
          {b.fragen.map((f) => {
            const def = BONUS[f.key]
            const auto = b.aufloesungAuto[f.key]
            return (
              <div key={f.key}>
                <p className="text-sm font-medium">
                  {def.frage(f.linie)}
                  {auto && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">automatisch: {def.optionen.find((o) => o.wert === auto)?.label}</span>}
                </p>
                <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label={def.kurz}>
                  {def.optionen.map((o) => (
                    <button
                      key={o.wert}
                      type="button"
                      role="radio"
                      aria-checked={auf[f.key] === o.wert}
                      onClick={() => setAuf((a) => ({ ...a, [f.key]: o.wert }))}
                      className={cn('min-h-10 rounded-md border border-border px-4 text-sm font-semibold', auf[f.key] === o.wert ? 'bg-primary text-primary-foreground' : 'hover:bg-accent')}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Aktionen: am Handy unten angedockt */}
      <div className="fixed inset-x-0 bottom-[60px] z-20 border-t border-border bg-background p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:static md:rounded-lg md:border md:p-4">
        <div className="mx-auto flex max-w-6xl gap-2">
          <Button variant="outline" className="flex-1" onClick={() => void nurSpeichern()} disabled={speichern.isPending || werten.isPending}>
            Speichern
          </Button>
          <Button className="flex-[2]" onClick={() => void sichernUndWerten()} disabled={speichern.isPending || werten.isPending || b.offen}>
            {(speichern.isPending || werten.isPending) && <Loader2 className="h-4 w-4 animate-spin" />}
            {b.gewertetAt ? 'Neu werten' : 'Werten'}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Spieltage: Bonusfragen + tippbar ────────────────────────
function SpieltageTab({ tage, laedt }: { tage: AdminSpieltag[]; laedt: boolean }) {
  if (laedt) return <SkeletonRows rows={5} />
  const kommend = tage.filter((t) => t.offen || !t.gewertetAt)
  if (!kommend.length) return <EmptyState icon={CalendarClock} title="Keine anstehenden Spiele" description="Spiele kommen automatisch aus FuPa bzw. Admin → Spiele." />
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Pro Spieltag 3 Bonusfragen — der Vorschlag wechselt automatisch. Pflichtspiele sind immer tippbar, Testspiele nur per Schalter (zählen dann zur
        Winterwertung). Nach dem Anpfiff sind die Fragen gesperrt.
      </p>
      {kommend.map((t) => (
        <SpieltagZeile key={t.id} t={t} />
      ))}
    </div>
  )
}

function SpieltagZeile({ t }: { t: AdminSpieltag }) {
  const speichern = useSpieltagSpeichern()
  const toast = useToast()
  const [fragen, setFragen] = useState<BonusKey[]>(t.fragen)
  const [linie, setLinie] = useState<string>(t.linieAuto || t.linie == null ? '' : String(t.linie))
  const pool = (Object.keys(BONUS) as BonusKey[]).filter((k) => k !== 'zuschauer' || t.heim)
  const ab = async (patch: { tippbar?: boolean | null; fragen?: BonusKey[] | null; linie?: number | null }) => {
    try {
      await speichern.mutateAsync({
        spiel: t.id,
        tippbar: patch.tippbar !== undefined ? patch.tippbar : (t.tippbarSchalter ?? null),
        fragen: patch.fragen !== undefined ? patch.fragen : t.fragenAuto ? null : fragen,
        linie: patch.linie !== undefined ? patch.linie : linie === '' ? null : Number(linie),
      })
      toast.success('Gespeichert.')
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {datum(t.anstoss)} · {t.wettbewerb ?? 'ohne Wettbewerb'}
          </p>
          <p className="font-display text-xl">{t.heim ? `SVA – ${t.gegner}` : `${t.gegner} – SVA`}</p>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className={cn('rounded px-2 py-0.5 text-xs font-bold uppercase', t.wertung === 'saison' ? 'bg-primary text-primary-foreground' : t.wertung === 'winter' ? 'bg-sky-600 text-white' : 'bg-secondary text-muted-foreground')}>
            {t.wertung === 'saison' ? 'Saison' : t.wertung === 'winter' ? 'Winterwertung' : 'nicht tippbar'}
          </span>
          <span className="text-muted-foreground">{t.anzahlTipps} Tipps</span>
        </div>
      </div>
      {t.pflichtspiel ? (
        <div className="mt-3">
          <Switch checked={t.tippbarSchalter === false} onChange={(v) => void ab({ tippbar: v ? false : null })} label="Dieses Spiel nicht tippen" hint="z. B. bei Spielabsage oder Wertung am grünen Tisch" disabled={!t.offen} />
        </div>
      ) : (
        <div className="mt-3">
          <Switch checked={t.tippbarSchalter === true} onChange={(v) => void ab({ tippbar: v ? true : null })} label="Testspiel tippbar machen (Winterwertung)" hint="Zählt nicht zur Saison, sondern zur eigenen Winterwertung." disabled={!t.offen} />
        </div>
      )}
      {t.wertung && (
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i}>
              <Label htmlFor={`f-${t.id}-${i}`}>Frage {i + 1}</Label>
              <Select
                id={`f-${t.id}-${i}`}
                value={fragen[i]}
                disabled={!t.offen}
                onChange={(e) => {
                  const n = [...fragen]
                  const neu = e.target.value as BonusKey
                  const j = n.indexOf(neu)
                  if (j !== -1) n[j] = n[i] // tauschen statt doppelt
                  n[i] = neu
                  setFragen(n)
                  void ab({ fragen: n })
                }}
              >
                {pool.map((k) => (
                  <option key={k} value={k}>
                    {BONUS[k].kurz}
                  </option>
                ))}
              </Select>
            </div>
          ))}
        </div>
      )}
      {t.wertung && t.heim && fragen.includes('zuschauer') && (
        <div className="mt-3 flex items-end gap-2">
          <div>
            <Label htmlFor={`l-${t.id}`}>Zuschauer-Linie (Check-ins)</Label>
            <Input id={`l-${t.id}`} inputMode="numeric" className="w-28" placeholder={`${t.linie ?? 50} (auto)`} value={linie} disabled={!t.offen} onChange={(e) => setLinie(e.target.value.replace(/\D/g, '').slice(0, 4))} />
          </div>
          <Button variant="outline" size="sm" disabled={!t.offen} onClick={() => void ab({})}>
            Linie speichern
          </Button>
        </div>
      )}
      <div className="mt-3 flex gap-2 text-sm">
        {!t.offen && (
          <Link className="text-primary underline-offset-4 hover:underline" to={`/spielbericht/${t.id}`}>
            Zum Spielbericht
          </Link>
        )}
        {t.fragenAuto && t.offen && <span className="text-xs text-muted-foreground">Fragen: automatischer Vorschlag</span>}
      </div>
    </section>
  )
}

// ── Story-Grafiken der Woche ────────────────────────────────
type Grafik = { key: string; tag: string; titel: string; erzeugen: (d: StoryDaten) => Promise<HTMLCanvasElement> | null }

function StoryTab() {
  const story = useStoryDaten()
  const einst = useTippEinstellungen()
  const speichernEinst = useTippEinstellungenSpeichern()
  const toast = useToast()
  const [code, setCode] = useState('')
  const [codeGeladen, setCodeGeladen] = useState(false)
  if (einst.data && !codeGeladen) {
    setCodeGeladen(true)
    setCode(einst.data.story_code ?? '')
  }
  const d = story.data
  const [bilder, setBilder] = useState<Record<string, string>>({})
  const [laeuft, setLaeuft] = useState(false)

  const grafiken: Grafik[] = useMemo(
    () => [
      {
        key: 'fr-jetzt-tippen',
        tag: 'Freitag',
        titel: '„Jetzt tippen“',
        // v21: mit den zwei treffsichersten verfügbaren Spielern als Freisteller
        erzeugen: (x) =>
          x.offen
            ? Promise.all([import('../../tippen/share'), import('../../tippen/api')]).then(async ([m, api]) => {
                const kader = await api.ladeLage().then((l) => l.kader).catch(() => [])
                const stars = kader
                  .filter((k) => !k.nichtVerfuegbar && (k.cutoutUrl || k.fotoUrl) && k.position !== 'TW')
                  .sort((a, b) => b.tore - a.tore || (a.position === 'ANG' ? -1 : 1))
                  .slice(0, 2)
                return m.bildJetztTippen(x.offen!, x.partner, x.preise, stars)
              })
            : null,
      },
      { key: 'sa-noch-nicht-getippt', tag: 'Samstag', titel: '„Noch nicht getippt?“', erzeugen: (x) => (x.offen ? import('../../tippen/share').then((m) => m.bildNochNichtGetippt(x.offen!, x.storyCode, x.partner)) : null) },
      {
        key: 'mo-tipp-sieger',
        tag: 'Montag',
        titel: 'Tipp-Sieger',
        erzeugen: (x) =>
          x.spieltag && x.spieltag.sieger.length
            ? import('../../tippen/share').then((m) => m.bildTippSieger({ gegner: x.spieltag!.gegner, heim: x.spieltag!.heim, toreSva: x.spieltag!.toreSva, toreGegner: x.spieltag!.toreGegner, sieger: x.spieltag!.sieger, teilnehmer: x.spieltag!.teilnehmer }, x.partner, x.preise))
            : null,
      },
      { key: 'mo-top5', tag: 'Montag', titel: 'Top 5 der Saison', erzeugen: (x) => (x.top5?.length ? import('../../tippen/share').then((m) => m.bildTop5(x.top5!, x.duell?.saison.saison ?? '', x.partner)) : null) },
      {
        key: 'mo-fans-vs-kabine',
        tag: 'Montag',
        titel: 'Fans vs. Kabine',
        erzeugen: (x) =>
          x.duell?.saison.nKabine
            ? import('../../tippen/share').then((m) => m.bildFansVsKabine({ ...x.duell!.saison, titel: `Saison ${x.duell!.saison.saison}`, kabineBester: x.duell!.kabineBester }, x.partner))
            : null,
      },
    ],
    [],
  )

  useEffect(() => {
    if (!d) return
    let aktiv = true
    void (async () => {
      setLaeuft(true)
      const out: Record<string, string> = {}
      for (const g of grafiken) {
        try {
          const c = await g.erzeugen(d)
          if (c) out[g.key] = c.toDataURL('image/png')
        } catch (e) {
          console.error('[tippliga/story]', g.key, e)
        }
      }
      if (aktiv) {
        setBilder(out)
        setLaeuft(false)
      }
    })()
    return () => {
      aktiv = false
    }
  }, [d, grafiken])

  const laden = async (key: string, teilen: boolean) => {
    const url = bilder[key]
    if (!url) return
    const blob = await (await fetch(url)).blob()
    const datei = `sva-tippliga-${key}.png`
    const file = new File([blob], datei, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (teilen && nav.share && nav.canShare?.({ files: [file] })) {
      try {
        await nav.share({ files: [file] })
      } catch {
        /* abgebrochen */
      }
      return
    }
    const a = document.createElement('a')
    a.href = url
    a.download = datei
    a.click()
  }

  if (story.isLoading) return <SkeletonRows rows={4} />
  if (story.error) return <p className="text-sm text-destructive">{friendlyError(story.error)}</p>
  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-4">
        <div>
          <Label htmlFor="story-code">Story-Code der Woche (Samstag)</Label>
          <Input id="story-code" className="w-48 font-mono uppercase" maxLength={24} placeholder="z. B. AGA-SA7" value={code} onChange={(e) => setCode(e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase())} />
        </div>
        <Button
          variant="outline"
          onClick={async () => {
            try {
              await speichernEinst.mutateAsync({ story_code: code.trim() || null })
              toast.success(code ? 'Story-Code gespeichert — steht auf der Samstags-Grafik.' : 'Story-Code entfernt.')
            } catch (e) {
              toast.error(friendlyError(e))
            }
          }}
        >
          Speichern
        </Button>
        <p className="basis-full text-xs text-muted-foreground">Optional. Einlösen übernimmt das Album. Leer = keine Code-Box auf der Grafik.</p>
      </section>
      <p className="text-sm text-muted-foreground">
        Wochenplan: <b>Fr</b> „Jetzt tippen“ (Link-Sticker /tippen) · <b>Sa</b> „Noch nicht getippt?“ · <b>So</b> Spielbericht → Werten · <b>Mo</b> Tipp-Sieger, Top 5,
        Fans vs. Kabine. Einzelne Kabinen-Spieler erscheinen nur positiv (Sieger, Top 5).
      </p>
      {laeuft && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Grafiken werden erzeugt …</p>}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {grafiken.map((g) => (
          <figure key={g.key} className="overflow-hidden rounded-lg border border-border bg-card">
            {bilder[g.key] ? (
              <img src={bilder[g.key]} alt={g.titel} className="aspect-[9/16] w-full object-cover" />
            ) : (
              <div className="grid aspect-[9/16] place-items-center p-3 text-center text-xs text-muted-foreground">{laeuft ? '…' : 'Noch keine Daten (kein offenes bzw. gewertetes Spiel)'}</div>
            )}
            <figcaption className="space-y-2 p-3">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{g.tag}</p>
              <p className="text-sm font-semibold">{g.titel}</p>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" className="flex-1" disabled={!bilder[g.key]} onClick={() => void laden(g.key, false)} aria-label={`${g.titel} herunterladen`}>
                  <Download className="h-4 w-4" />
                </Button>
                <Button size="sm" className="flex-1" disabled={!bilder[g.key]} onClick={() => void laden(g.key, true)} aria-label={`${g.titel} teilen`}>
                  <Share2 className="h-4 w-4" />
                </Button>
              </div>
            </figcaption>
          </figure>
        ))}
      </div>
    </div>
  )
}

// ── Kabine & Regeln ─────────────────────────────────────────
function KabineTab() {
  const [suche, setSuche] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = window.setTimeout(() => setQ(suche.trim()), 300)
    return () => window.clearTimeout(t)
  }, [suche])
  const tl = useTeilnehmer(q)
  const kabine = useKabine()
  const toast = useToast()
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_380px]">
      <section className="rounded-lg border border-border bg-card">
        <div className="space-y-2 border-b border-border p-4">
          <h2 className="font-display text-xl">Teilnehmer · Kabine</h2>
          <p className="text-sm text-muted-foreground">
            Spieler-Konten als <b>Kabine</b> markieren — dann zählen sie im Duell „Fans vs. Kabine“. {tl.data && `${tl.data.gesamt} Teilnehmer, davon ${tl.data.kabine} Kabine.`}
          </p>
          <Input placeholder="Vorname oder E-Mail suchen" value={suche} onChange={(e) => setSuche(e.target.value)} />
        </div>
        {tl.isLoading ? (
          <SkeletonRows rows={4} />
        ) : (
          <ul className="divide-y divide-border">
            {(tl.data?.liste ?? []).map((t) => (
              <li key={t.userId} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="font-medium">
                    {t.name}
                    {!t.sichtbar && <span className="ml-2 text-xs text-muted-foreground">(nicht öffentlich)</span>}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {t.email} · {t.tipps} Tipps · {t.punkte} Punkte
                  </p>
                </div>
                <Button
                  size="sm"
                  variant={t.kabine ? 'default' : 'outline'}
                  onClick={async () => {
                    try {
                      await kabine.mutateAsync({ user: t.userId, kabine: !t.kabine })
                      toast.success(t.kabine ? `${t.name} ist wieder Fan.` : `${t.name} ist jetzt Kabine.`)
                    } catch (e) {
                      toast.error(friendlyError(e))
                    }
                  }}
                >
                  {t.kabine ? 'Kabine ✓' : 'Als Kabine markieren'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <Regeln />
      <div className="lg:col-span-2">
        <PreiseVerwaltung />
      </div>
    </div>
  )
}

// ── v22-T: Preise (Saison Platz 1–5, Monat Platz 1–3) ───────
// Leer = auf /tippen unsichtbar. Altersgrenze (16/18) → U18 bekommt die
// Alternative (leer = „Softdrink-Variante“). Kabine ist ausgeschlossen.
const PREIS_PLAETZE: { wertung: 'saison' | 'monat'; platz: number; label: string }[] = [
  ...[1, 2, 3, 4, 5].map((n) => ({ wertung: 'saison' as const, platz: n, label: `Saison · Platz ${n}` })),
  ...[1, 2, 3].map((n) => ({ wertung: 'monat' as const, platz: n, label: n === 1 ? 'Monatssieger' : `Monat · Platz ${n}` })),
]

function PreiseVerwaltung() {
  const preise = useTippPreise()
  const fehlt = preise.error && (isMissingSchema(preise.error) || /sva_tipp_preise/.test(String((preise.error as { message?: string }).message)))
  if (fehlt) {
    return (
      <EmptyState
        icon={Trophy}
        title="Preise brauchen die neue Migration"
        description="Die Migration 20261014100000_sva_tippliga_v22.sql fehlt noch. Danach lassen sich hier Preise für Saison und Monat pflegen."
      />
    )
  }
  return (
    <section className="rounded-lg border border-border bg-card" data-testid="tipp-preise">
      <div className="space-y-1 border-b border-border p-4">
        <h2 className="flex items-center gap-2 font-display text-xl">
          <Trophy className="h-5 w-5" /> Preise
        </h2>
        <p className="text-sm text-muted-foreground">
          Erscheinen auf /tippen in der Rangliste unter „Das kannst du gewinnen“ (Saison und Monat). Leer = Bereich unsichtbar. Nüchtern formulieren; bei alkoholischen Preisen
          „ab 18“ wählen — unter 18 gibt es automatisch die Alternative. Kabine-Konten sind ausgeschlossen (Teilnahmebedingungen).
        </p>
      </div>
      {preise.isLoading ? (
        <SkeletonRows rows={4} />
      ) : (
        <ul className="divide-y divide-border">
          {PREIS_PLAETZE.map((pl) => (
            <PreisZeile key={`${pl.wertung}-${pl.platz}`} label={pl.label} wertung={pl.wertung} platz={pl.platz} preis={(preise.data ?? []).find((x) => x.aktiv && x.wertung === pl.wertung && x.platz === pl.platz)} />
          ))}
        </ul>
      )}
    </section>
  )
}

function PreisZeile({ label, wertung, platz, preis }: { label: string; wertung: 'saison' | 'monat'; platz: number; preis?: TippPreis }) {
  const sp = useSponsoren()
  const { speichern, loeschen } = useTippPreisAktionen()
  const toast = useToast()
  const [titel, setTitel] = useState(preis?.titel ?? '')
  const [text, setText] = useState(preis?.beschreibung ?? '')
  const [partner, setPartner] = useState(preis?.partner_id ?? '')
  const [alter, setAlter] = useState<string>(preis?.ab_alter ? String(preis.ab_alter) : '')
  const [alt, setAlt] = useState(preis?.alternative ?? '')
  const geaendert =
    titel.trim() !== (preis?.titel ?? '') ||
    text.trim() !== (preis?.beschreibung ?? '') ||
    partner !== (preis?.partner_id ?? '') ||
    alter !== (preis?.ab_alter ? String(preis.ab_alter) : '') ||
    (alter !== '' && alt.trim() !== (preis?.alternative ?? ''))
  const sichern = async () => {
    if (titel.trim().length < 2) return toast.error('Bitte einen Titel (mind. 2 Zeichen) eintragen.')
    try {
      await speichern.mutateAsync({
        id: preis?.id,
        wertung,
        platz,
        titel: titel.trim(),
        beschreibung: text.trim() || null,
        partner_id: partner || null,
        ab_alter: alter ? (Number(alter) as 16 | 18) : null,
        alternative: alter ? alt.trim() || null : null,
      })
      toast.success(`${label} gespeichert.`)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  return (
    <li className="grid gap-2 px-4 py-3 lg:grid-cols-[140px_1.2fr_1.4fr_190px_390px] lg:items-center">
      <p className="text-sm font-medium">{label}</p>
      <Input aria-label={`${label}: Titel`} maxLength={60} placeholder={platz === 1 ? 'z. B. Trikot nach Wahl' : 'Preis (leer = kein Preis)'} value={titel} onChange={(e) => setTitel(e.target.value)} />
      <Input aria-label={`${label}: Beschreibung`} maxLength={200} placeholder="Beschreibung (optional)" value={text} onChange={(e) => setText(e.target.value)} />
      <Select aria-label={`${label}: präsentiert von`} value={partner} onChange={(e) => setPartner(e.target.value)}>
        <option value="">— ohne Partner —</option>
        {(sp.data ?? [])
          .filter((x) => x.aktiv)
          .map((x) => (
            <option key={x.id} value={x.id}>
              präsentiert von {x.name}
            </option>
          ))}
      </Select>
      <div className="flex flex-wrap items-center gap-2">
        <Select aria-label={`${label}: Altersgrenze`} className="h-9 w-28" value={alter} onChange={(e) => setAlter(e.target.value)}>
          <option value="">alle Alter</option>
          <option value="16">ab 16</option>
          <option value="18">ab 18</option>
        </Select>
        {alter && <Input aria-label={`${label}: Alternative unter ${alter}`} className="h-9 w-44" maxLength={80} placeholder="U18: Softdrink-Variante" value={alt} onChange={(e) => setAlt(e.target.value)} />}
        <Button size="sm" onClick={() => void sichern()} disabled={!geaendert || speichern.isPending || !titel.trim()}>
          Speichern
        </Button>
        {preis && (
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              try {
                await loeschen.mutateAsync(preis.id)
                setTitel('')
                setText('')
                setPartner('')
                setAlter('')
                setAlt('')
                toast.success(`${label} entfernt.`)
              } catch (e) {
                toast.error(friendlyError(e))
              }
            }}
          >
            Entfernen
          </Button>
        )}
      </div>
    </li>
  )
}

function Regeln() {
  const e = useTippEinstellungen()
  const sp = useSponsoren()
  const speichern = useTippEinstellungenSpeichern()
  const toast = useToast()
  const [preise, setPreise] = useState<string | null>(null)
  if (e.isLoading) return <SkeletonRows rows={3} />
  if (!e.data) return null
  const s = e.data
  const ab = async (patch: Parameters<typeof speichern.mutateAsync>[0]) => {
    try {
      await speichern.mutateAsync(patch)
      toast.success('Gespeichert.')
    } catch (err) {
      toast.error(friendlyError(err))
    }
  }
  return (
    <section className="space-y-3 rounded-lg border border-border bg-card p-4">
      <h2 className="flex items-center gap-2 font-display text-xl">
        <Settings2 className="h-5 w-5" /> Regeln & Partner
      </h2>
      <Switch checked={s.aktiv} onChange={(v) => void ab({ aktiv: v })} label="Tipp-Liga aktiv" hint="Aus = Abgaben pausiert (Ranglisten bleiben sichtbar)" />
      <Switch checked={s.elf_frei} onChange={(v) => void ab({ elf_frei: v })} label="„Deine Elf“ frei aufstellen erlaubt" hint="Sonst nur 1 TW/ABW · 2 MIT · 2 ANG" />
      {/* v25-B: Auto-Wertung — wertet Pflichtspiele automatisch, sobald ≥ 30 min beendet */}
      <Switch checked={s.auto_wertung} onChange={(v) => void ab({ auto_wertung: v })} label="Automatisch werten" hint="Wertet jedes Pflichtspiel ~30 Min nach Abpfiff aus Ticker/Bericht (vorläufig bis MOTM). Von Hand „Werten“ geht weiter." />
      <div>
        <Label htmlFor="tp-partner">„Tipp-Liga präsentiert von …“</Label>
        <Select id="tp-partner" value={s.partner_id ?? ''} onChange={(ev) => void ab({ partner_id: ev.target.value || null })}>
          <option value="">— kein Partner (unsichtbar) —</option>
          {(sp.data ?? []).filter((x) => x.aktiv).map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="tp-preise">Preise (optional, von Partnern)</Label>
        <Input id="tp-preise" maxLength={300} placeholder="z. B. Spieltagssieger: Getränk am Stand" value={preise ?? s.preise ?? ''} onChange={(ev) => setPreise(ev.target.value)} onBlur={() => preise !== null && void ab({ preise: preise.trim() || null })} />
        <p className="mt-1 text-xs text-muted-foreground">Kostenlos mitspielen — Preise nur als Dankeschön von Partnern (siehe Teilnahmebedingungen).</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label htmlFor="tp-wv">Winterpause ab (MM-TT)</Label>
          <Input id="tp-wv" defaultValue={s.winter_von} onBlur={(ev) => /^\d{2}-\d{2}$/.test(ev.target.value) && ev.target.value !== s.winter_von && void ab({ winter_von: ev.target.value })} />
        </div>
        <div>
          <Label htmlFor="tp-wb">bis (MM-TT)</Label>
          <Input id="tp-wb" defaultValue={s.winter_bis} onBlur={(ev) => /^\d{2}-\d{2}$/.test(ev.target.value) && ev.target.value !== s.winter_bis && void ab({ winter_bis: ev.target.value })} />
        </div>
      </div>
    </section>
  )
}

// ── v21: Kader für „Deine Elf“ ──────────────────────────────
// Zweitposition (z. B. offensive Mittelfeldspieler auch im Angriff) und
// „nicht verfügbar“ (verletzt/abwesend, mit kurzem Hinweis). Team + Admin.
const POS_NAME: Record<string, string> = { TW: 'Torwart', ABW: 'Abwehr', MIT: 'Mittelfeld', ANG: 'Angriff' }

function KaderTab() {
  const kader = useTippKader()
  const fehlt = kader.error && isMissingSchema(kader.error)
  if (fehlt || (kader.error && /tipp_admin_kader/.test(String((kader.error as { message?: string }).message)))) {
    return (
      <EmptyState
        icon={Shirt}
        title="Kader-Pflege braucht die neue Migration"
        description="Die Migration 20261013100000_sva_tippliga_v21.sql fehlt noch. Danach lassen sich hier Zweitpositionen und „nicht verfügbar“ setzen."
      />
    )
  }
  return (
    <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
      <section className="rounded-lg border border-border bg-card">
        <div className="space-y-1 border-b border-border p-4">
          <h2 className="font-display text-xl">Kader · Deine Elf</h2>
          <p className="text-sm text-muted-foreground">
            Formation: 1 Torwart · 1 Abwehr · 2 Mittelfeld · 1 Angriff. Mit einer <b>Zweitposition</b> darf ein Spieler zusätzlich auf diese Position (z. B. Pejas, Brünjes auch vorne).{' '}
            <b>Nicht verfügbar</b> = in der Auswahl ausgegraut, mit Hinweis.
          </p>
        </div>
        {kader.isLoading ? (
          <SkeletonRows rows={6} />
        ) : (
          <ul className="divide-y divide-border">
            {(kader.data ?? []).map((k) => (
              <KaderZeile key={k.id} k={k} />
            ))}
          </ul>
        )}
      </section>
      <aside className="space-y-3 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <h3 className="font-display text-lg text-foreground">So wirkt es</h3>
        <p>Die Auswahl für einen Platz zeigt alle Spieler mit passender Haupt- oder Zweitposition. Punkte ändern sich dadurch nicht (Zu-null zählt weiter nur für Torwart/Abwehr).</p>
        <p>„Nicht verfügbar“ greift sofort für neue Elfen. Wer den Spieler schon aufgestellt hat, sieht einen Hinweis zum Austauschen; gespeicherte Elfen bleiben gültig.</p>
        <Button asChild variant="outline" className="w-full">
          <a href={TIPP_VORFUEHRUNG_PFAD} target="_blank" rel="noreferrer">
            <MonitorPlay className="h-4 w-4" /> In der Vorführung ansehen
          </a>
        </Button>
      </aside>
    </div>
  )
}

function KaderZeile({ k }: { k: TippKaderZeile }) {
  const speichern = useTippSpielerSpeichern()
  const toast = useToast()
  const [hinweis, setHinweis] = useState(k.hinweis ?? '')
  const sichern = async (teil: Partial<{ zweitposition: string | null; nichtVerfuegbar: boolean; hinweis: string | null }>) => {
    try {
      await speichern.mutateAsync({
        spieler: k.id,
        zweitposition: teil.zweitposition !== undefined ? teil.zweitposition : (k.zweitposition ?? null),
        nichtVerfuegbar: teil.nichtVerfuegbar ?? k.nichtVerfuegbar,
        hinweis: teil.hinweis !== undefined ? teil.hinweis : hinweis || null,
      })
      toast.success(`${k.name} gespeichert.`)
    } catch (e) {
      toast.error(friendlyError(e))
    }
  }
  return (
    <li className={cn('grid gap-3 px-4 py-3 sm:grid-cols-[1fr_170px_auto] sm:items-center', k.nichtVerfuegbar && 'bg-destructive/5')}>
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full bg-secondary font-display">
          {k.cutoutUrl || k.fotoUrl ? <img src={k.cutoutUrl ?? k.fotoUrl} alt="" className="h-full w-full object-cover object-top" /> : k.nummer ?? '–'}
        </span>
        <div className="min-w-0">
          <p className={cn('truncate font-medium', k.nichtVerfuegbar && 'text-muted-foreground line-through')}>
            {k.name} {k.nummer != null && <span className="text-xs text-muted-foreground">#{k.nummer}</span>}
          </p>
          <p className="text-xs text-muted-foreground">
            {POS_NAME[k.position]}
            {k.zweitposition ? ` · auch ${POS_NAME[k.zweitposition]}` : ''}
          </p>
        </div>
      </div>
      <Label className="sr-only" htmlFor={`zw-${k.id}`}>
        Zweitposition {k.name}
      </Label>
      <Select id={`zw-${k.id}`} value={k.zweitposition ?? ''} onChange={(e) => void sichern({ zweitposition: e.target.value || null })} disabled={speichern.isPending}>
        <option value="">Keine Zweitposition</option>
        {(['TW', 'ABW', 'MIT', 'ANG'] as const)
          .filter((p) => p !== k.position)
          .map((p) => (
            <option key={p} value={p}>
              auch {POS_NAME[p]}
            </option>
          ))}
      </Select>
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant={k.nichtVerfuegbar ? 'default' : 'outline'} onClick={() => void sichern({ nichtVerfuegbar: !k.nichtVerfuegbar })} disabled={speichern.isPending}>
          {k.nichtVerfuegbar ? 'Nicht verfügbar ✓' : 'Verfügbar'}
        </Button>
        {k.nichtVerfuegbar && (
          <Input
            className="h-9 w-48"
            placeholder="Hinweis, z. B. Bänderriss"
            maxLength={60}
            value={hinweis}
            onChange={(e) => setHinweis(e.target.value)}
            onBlur={() => hinweis !== (k.hinweis ?? '') && void sichern({ hinweis: hinweis || null })}
          />
        )}
      </div>
    </li>
  )
}
