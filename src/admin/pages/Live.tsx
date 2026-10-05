import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  Undo2,
  CloudOff,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Minus,
  Plus,
  Clock,
  ExternalLink,
  Share2,
  RefreshCw,
  Trash2,
  Star,
} from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Select } from '../components/ui/select'
import { Modal } from '../components/ui/modal'
import { Textarea } from '../components/ui/textarea'
import { SkeletonRows } from '../components/ui/skeleton'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { PflegeHinweis } from '../components/PflegeHinweis'
import { PublishButton } from '../components/PublishButton'
import { useAuth } from '../auth/AuthProvider'
import type { RosterRow, SpielRow } from '../lib/db'
import { friendlyError, isMissingSchema } from '../lib/db'
import { useRoster, useSpieleMitVorfuehrung } from '../lib/queries'
import { istVorfuehrSpiel } from '../lib/vorfuehrung'
import { formatAnstoss } from '../lib/format'
import { hatErgebnis, naechstesSpiel, paarung } from '../lib/spiele'
import { fetchLineupFuerSpiel, liveQueue, neueId, setMotm, type TickerInsert } from '../lib/live'
import { spielLage, useTicker, type AdminEvent } from '../lib/useTicker'
import { teileStory } from '../lib/storyGrafik'
import { fetchLivePartner } from '../lib/partner'
import { laufendeMinute, minuteLabel, platzStand, TYP_LABEL, type TickerTyp } from '../../live/model'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v15-L „Live": Ticker-Pult für den Spielfeldrand. Mobil zuerst, einhändig:
// oben Spielstand + großer Phasen-Knopf, darunter sechs große Ereignis-
// Knöpfe, Spieler als Chips aus der Aufstellung. Alles optimistisch über die
// Offline-Warteschlange (lib/live.ts) — jede Zeile zeigt „gesendet" oder
// „ausstehend". Spielstand/Status rechnet die DB aus den Ereignissen.
// ─────────────────────────────────────────────────────────────

type Sheet =
  | { art: 'tor' }
  | { art: 'gegentor' }
  | { art: 'karte'; farbe: 'gelb' | 'rot' }
  | { art: 'wechsel' }
  | { art: 'kommentar' }
  | { art: 'uhr' }
  | null

const nachname = (n: string) => n.trim().split(/\s+/).slice(-1)[0] ?? n
const berlinTag = (d: Date) => d.toLocaleDateString('de-DE', { timeZone: 'Europe/Berlin' })

function standardSpiel(alle: SpielRow[]): SpielRow | null {
  // v18-T: das Vorführ-Spiel nie automatisch wählen (nur per Auswahl oder ?spiel=)
  const spiele = alle.filter((s) => !istVorfuehrSpiel(s))
  const live = spiele.find((s) => s.status === 'live' || s.status === 'halbzeit')
  if (live) return live
  const heute = berlinTag(new Date())
  const heutige = spiele.filter((s) => berlinTag(new Date(s.anstoss)) === heute).sort((a, b) => +new Date(a.anstoss) - +new Date(b.anstoss))
  const offen = heutige.find((s) => !hatErgebnis(s))
  if (offen) return offen
  if (heutige.length) return heutige[heutige.length - 1]
  return naechstesSpiel(spiele) ?? [...spiele].sort((a, b) => +new Date(b.anstoss) - +new Date(a.anstoss))[0] ?? null
}

/** Gesamtminute (z. B. 47 in der 1. HZ) → minute + Nachspielzeit (45+2). */
function teilen(total: number, half: 1 | 2): { minute: number; extra: number | null } {
  const ende = half === 1 ? 45 : 90
  if (total > ende) return { minute: ende, extra: total - ende }
  return { minute: Math.max(0, total), extra: null }
}

export function Live() {
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const { rolle } = useAuth()
  // v18-T: inkl. Vorführ-Spiel (normal bedienbar, klar markiert)
  const spieleQ = useSpieleMitVorfuehrung()
  const rosterQ = useRoster()
  const spiele = useMemo(() => spieleQ.data ?? [], [spieleQ.data])
  const [params] = useSearchParams()
  const [spielId, setSpielId] = useState<string | null>(() => params.get('spiel'))
  useEffect(() => {
    if (!spiele.length) return
    if (spielId && spiele.some((s) => s.id === spielId)) return
    setSpielId(standardSpiel(spiele)?.id ?? null)
  }, [spiele, spielId])
  const spiel = spiele.find((s) => s.id === spielId) ?? null
  const vorfuehrung = istVorfuehrSpiel(spiel)

  const { query: tickerQ, queue, events } = useTicker(spielId)
  const lineupQ = useQuery({ queryKey: ['sva_lineup_spiel', spielId], queryFn: () => fetchLineupFuerSpiel(spielId), enabled: !!spielId, retry: false })
  const roster = useMemo(() => rosterQ.data ?? [], [rosterQ.data])
  const byId = useMemo(() => new Map(roster.map((r) => [r.id, r])), [roster])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 5000)
    return () => window.clearInterval(t)
  }, [])

  const lage = spielLage(spiel, events)
  const lm = laufendeMinute(lage.status, lage.anpfiffAt, lage.wiederanpfiffAt, now)
  const half: 1 | 2 = lage.wiederanpfiffAt ? 2 : 1
  const autoTotal = lm ? lm.minute + lm.extra : lage.status === 'beendet' ? 90 : 1
  const [override, setOverride] = useState<number | null>(null)
  const total = override ?? autoTotal

  const lineup = lineupQ.data?.lineup ?? null
  const stand = useMemo(() => platzStand(lineup ? { startelf: lineup.startelf, bank: lineup.bank } : null, events), [lineup, events])
  const aktive = useMemo(
    () => roster.filter((r) => r.aktiv && (r.rolle ?? 'spieler') === 'spieler').sort((a, b) => (a.nummer ?? 999) - (b.nummer ?? 999)),
    [roster],
  )
  const aufDemPlatz: RosterRow[] = lineup
    ? stand.slots.filter((id) => !stand.rot.has(id)).map((id) => byId.get(id)).filter((r): r is RosterRow => !!r)
    : aktive
  const bank: RosterRow[] = lineup ? stand.bank.map((id) => byId.get(id)).filter((r): r is RosterRow => !!r) : aktive
  const imSpiel: RosterRow[] = lineup
    ? [...new Set([...lineup.startelf, ...stand.eingewechselt.keys()])].map((id) => byId.get(id)).filter((r): r is RosterRow => !!r)
    : aktive

  const [sheet, setSheet] = useState<Sheet>(null)

  // ── Ereignis eintragen (optimistisch über die Warteschlange) ──────────────
  const eintragen = (typ: TickerTyp, extra: Partial<TickerInsert> = {}, minuteTotal = total) => {
    if (!spiel) return
    const m = typ === 'anpfiff' ? { minute: 1, extra: null } : typ === 'wiederanpfiff' ? { minute: 46, extra: null } : teilen(minuteTotal, half)
    const row: TickerInsert = {
      id: neueId(),
      spiel_id: spiel.id,
      typ,
      minute: m.minute,
      nachspielzeit: m.extra,
      zeitpunkt: new Date().toISOString(),
      ...extra,
    }
    liveQueue.einreihen({ kind: 'insert', row })
    setOverride(null)
    setSheet(null)
    if (navigator.vibrate) navigator.vibrate(30)
  }

  const letztes = events[events.length - 1] ?? null
  const rueckgaengig = async () => {
    if (!letztes || !spiel) return
    const ok = await confirm({
      title: 'Letztes Ereignis löschen?',
      description: `${TYP_LABEL[letztes.type]} ${minuteLabel(letztes.minute, letztes.extra)}${letztes.player ? ` · ${byId.get(letztes.player)?.name ?? ''}` : ''}`,
      confirmLabel: 'Rückgängig',
      destructive: true,
    })
    if (!ok) return
    liveQueue.einreihen({ kind: 'delete', id: letztes.id, spielId: spiel.id })
    toast.success('Rückgängig gemacht.')
  }

  const phase = async () => {
    if (!spiel) return
    if (lage.status === 'geplant') return eintragen('anpfiff')
    if (lage.status === 'live' && half === 1) return eintragen('halbzeit', {}, Math.max(45, total))
    if (lage.status === 'halbzeit') return eintragen('wiederanpfiff')
    if (lage.status === 'live' && half === 2) {
      const ok = await confirm({ title: 'Abpfiff?', description: `Endstand ${ergebnisPaarung(spiel, lage.tore)} — wird als Ergebnis gespeichert.`, confirmLabel: 'Abpfiff' })
      if (ok) eintragen('abpfiff', {}, Math.max(90, total))
    }
  }

  const uhrStellen = (zielTotal: number) => {
    if (!spiel) return
    const anker = [...events].reverse().find((e) => e.type === (half === 2 ? 'wiederanpfiff' : 'anpfiff'))
    if (!anker) return
    const basis = half === 2 ? 46 : 1
    const zeitpunkt = new Date(Date.now() - (zielTotal - basis) * 60000 - 1000).toISOString()
    liveQueue.einreihen({ kind: 'update', id: anker.id, spielId: spiel.id, patch: { zeitpunkt } })
    setOverride(null)
    setSheet(null)
    toast.success(`Uhr gestellt: ${zielTotal}. Minute.`)
  }

  const schemaFehlt = (tickerQ.error && isMissingSchema(tickerQ.error)) || (spieleQ.error && isMissingSchema(spieleQ.error))
  const pending = queue.items.filter((i) => !i.fehler).length
  const fehler = queue.items.filter((i) => i.fehler)
  const spielGestartet = lage.status !== 'geplant'

  if (spieleQ.isPending || rosterQ.isPending) return <SkeletonRows rows={6} />

  return (
    <div className="mx-auto max-w-xl pb-6">
      <PageHeader title="Live" subtitle="Liveticker vom Spielfeldrand — erscheint sofort auf /live." />
      {schemaFehlt && <PflegeHinweis schema className="mb-4" />}

      <div className="mb-3 flex items-center gap-2">
        <Select aria-label="Spiel wählen" className="h-12 flex-1 text-base" value={spielId ?? ''} onChange={(e) => { setSpielId(e.target.value || null); setOverride(null) }}>
          {spiele.length === 0 && <option value="">Noch kein Spiel angelegt</option>}
          {[...spiele]
            .sort((a, b) => +new Date(b.anstoss) - +new Date(a.anstoss))
            .map((s) => (
              <option key={s.id} value={s.id}>
                {istVorfuehrSpiel(s) ? 'VORFÜHRUNG · ' : ''}
                {paarung(s)} · {formatAnstoss(s.anstoss)}
              </option>
            ))}
        </Select>
        <Button asChild variant="outline" size="icon" className="h-12 w-12 shrink-0" aria-label="Öffentliche Live-Seite öffnen">
          <a href={vorfuehrung ? '/live?vorfuehrung=1' : '/live'} target="_blank" rel="noreferrer">
            <ExternalLink className="h-5 w-5" />
          </a>
        </Button>
      </div>

      {vorfuehrung && (
        <div className="mb-3 rounded-lg border border-dashed border-primary/70 bg-primary/10 px-3 py-2.5 text-sm" role="note" data-testid="live-vorfuehrung">
          <b className="font-display text-base tracking-wider text-primary">VORFÜHRUNG</b> — kein echtes Spiel. Alles hier ist nur über den Vorführ-Link{' '}
          <a className="underline" href="/live?vorfuehrung=1" target="_blank" rel="noreferrer">/live?vorfuehrung=1</a> zu sehen, nicht auf der Website.
        </div>
      )}

      {!spiel ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">Unter „Spiele“ zuerst ein Spiel anlegen.</CardContent>
        </Card>
      ) : (
        <>
          {/* ── Spielstand + Phase ─────────────────────────────────── */}
          <Card className={cn('overflow-hidden', lage.status === 'live' && 'border-primary/60')}>
            <CardContent className="p-4">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-center">
                <span className="truncate text-sm font-bold uppercase">{spiel.heim ? 'SVA' : spiel.gegner}</span>
                <span className="font-display text-6xl leading-none tabular-nums" aria-live="polite" data-testid="live-score">
                  {ergebnisPaarung(spiel, lage.tore)}
                </span>
                <span className="truncate text-sm font-bold uppercase">{spiel.heim ? spiel.gegner : 'SVA'}</span>
              </div>
              <div className="mt-2 flex items-center justify-center gap-2 text-sm">
                <StatusChip status={lage.status} label={lm?.label} />
              </div>

              <Button
                className={cn(
                  'mt-4 h-16 w-full font-display text-2xl tracking-wider',
                  lage.status === 'halbzeit' && 'bg-sva-gold text-black hover:bg-sva-gold/90',
                  lage.status === 'beendet' && 'hidden',
                )}
                onClick={() => void phase()}
                data-testid="phase"
              >
                {lage.status === 'geplant' ? 'ANPFIFF' : lage.status === 'halbzeit' ? 'WIEDERANPFIFF' : half === 1 ? 'HALBZEIT' : 'ABPFIFF'}
              </Button>

              {spielGestartet && lage.status !== 'beendet' && (
                <div className="mt-3 flex items-center justify-between gap-2 rounded-lg bg-secondary/60 px-2 py-1.5">
                  <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Minute zurück" onClick={() => setOverride(Math.max(1, total - 1))}>
                    <Minus className="h-5 w-5" />
                  </Button>
                  <div className="text-center leading-tight">
                    <div className="font-display text-2xl tabular-nums">{minuteLabel(teilen(total, half).minute, teilen(total, half).extra)}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {override == null ? 'Minute automatisch' : (
                        <button type="button" className="underline" onClick={() => setOverride(null)}>
                          von Hand · zurück auf Auto
                        </button>
                      )}
                    </div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Minute vor" onClick={() => setOverride(total + 1)}>
                    <Plus className="h-5 w-5" />
                  </Button>
                  <Button variant="ghost" size="sm" className="h-11 text-xs" onClick={() => setSheet({ art: 'uhr' })} disabled={lage.status === 'halbzeit'}>
                    <Clock className="h-4 w-4" /> Uhr
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <SyncLeiste pending={pending} fehler={fehler.length} online={queue.online} naechster={queue.naechsterVersuch} sendet={queue.sendet} />

          {/* ── Ereignis-Knöpfe ────────────────────────────────────── */}
          {lage.status !== 'beendet' && (
            <div className="mt-3 grid grid-cols-2 gap-2.5">
              <BigBtn className="bg-primary text-white" disabled={!spielGestartet} onClick={() => setSheet({ art: 'tor' })} testid="btn-tor">
                ⚽ TOR SVA
              </BigBtn>
              <BigBtn className="border border-border bg-card" disabled={!spielGestartet} onClick={() => setSheet({ art: 'gegentor' })}>
                GEGENTOR
              </BigBtn>
              <BigBtn className="bg-[#f5c518] text-black" disabled={!spielGestartet} onClick={() => setSheet({ art: 'karte', farbe: 'gelb' })}>
                GELB
              </BigBtn>
              <BigBtn className="border-2 border-primary bg-primary/15 text-white" disabled={!spielGestartet} onClick={() => setSheet({ art: 'karte', farbe: 'rot' })}>
                ROT
              </BigBtn>
              <BigBtn className="bg-green-700 text-white" disabled={!spielGestartet} onClick={() => setSheet({ art: 'wechsel' })}>
                WECHSEL
              </BigBtn>
              <BigBtn className="border border-border bg-secondary" onClick={() => setSheet({ art: 'kommentar' })}>
                KOMMENTAR
              </BigBtn>
            </div>
          )}
          {!spielGestartet && <p className="mt-2 text-center text-sm text-muted-foreground">Erst „Anpfiff“ drücken — dann läuft die Minute automatisch mit.</p>}
          {!lineup && spielGestartet && (
            <p className="mt-2 flex items-center gap-1.5 text-sm text-sva-gold">
              <AlertTriangle className="h-4 w-4" /> Keine Aufstellung gespeichert — zur Auswahl stehen alle Spieler.
            </p>
          )}
          {lineup && !lineupQ.data?.fuerSpiel && (
            <p className="mt-2 text-xs text-muted-foreground">Spieler-Auswahl aus der zuletzt gespeicherten Aufstellung (nicht ausdrücklich für dieses Spiel).</p>
          )}

          {lage.status === 'beendet' && (
            <NachDemSpiel spiel={spiel} tore={lage.tore} kandidaten={imSpiel} events={events} byId={byId} istAdmin={rolle !== 'team' && !vorfuehrung} onMotm={async (id) => {
              try {
                await setMotm(spiel.id, id)
                await qc.invalidateQueries({ queryKey: ['sm_spiele'] })
                toast.success(id ? 'Spieler des Spiels gespeichert.' : 'Auswahl entfernt.')
              } catch (e) {
                toast.error(friendlyError(e))
              }
            }} />
          )}

          {/* ── Verlauf ────────────────────────────────────────────── */}
          <div className="mt-5 flex items-center justify-between">
            <h2 className="font-display text-lg tracking-wide">Verlauf</h2>
            {letztes && (
              <Button variant="outline" className="h-11" onClick={() => void rueckgaengig()} data-testid="undo">
                <Undo2 className="h-4 w-4" /> Rückgängig
              </Button>
            )}
          </div>
          {fehler.length > 0 && (
            <div className="mt-2 space-y-2">
              {fehler.map((f) => (
                <div key={f.opId} className="flex items-center gap-2 rounded-lg border border-primary/50 bg-primary/10 p-2 text-sm">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">{f.fehler}</span>
                  <Button size="sm" variant="outline" onClick={() => liveQueue.erneut(f.opId)}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" aria-label="Verwerfen" onClick={() => liveQueue.verwerfen(f.opId)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {events.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">Noch keine Ereignisse.</p>
          ) : (
            <ol className="mt-2 divide-y divide-border overflow-hidden rounded-lg border border-border bg-card">
              {[...events].reverse().map((e) => (
                <EventZeile key={e.id} e={e} byId={byId} />
              ))}
            </ol>
          )}
        </>
      )}

      {/* ── Auswahl-Fenster ────────────────────────────────────────── */}
      <TorSheet open={sheet?.art === 'tor'} onClose={() => setSheet(null)} spieler={aufDemPlatz} minute={minuteLabel(teilen(total, half).minute, teilen(total, half).extra)}
        onSave={(schuetze, vorlage, text) => eintragen('tor', { roster_id: schuetze, roster_id_2: vorlage, text })} />
      <TextSheet open={sheet?.art === 'gegentor'} titel={`Gegentor · ${spiel?.gegner ?? ''}`} knopf="Gegentor eintragen" chips={['Elfmeter', 'Kopfball', 'Konter', 'Freistoß', 'Eigentor']}
        onClose={() => setSheet(null)} onSave={(text) => eintragen('gegentor', { text })} />
      <KartenSheet open={sheet?.art === 'karte'} farbe={sheet?.art === 'karte' ? sheet.farbe : 'gelb'} spieler={aufDemPlatz} gelbSchon={stand.gelb}
        onClose={() => setSheet(null)} onSave={(typ, id, text) => eintragen(typ, { roster_id: id, text })} />
      <WechselSheet open={sheet?.art === 'wechsel'} raus={aufDemPlatz} rein={bank} onClose={() => setSheet(null)}
        onSave={(rein, raus) => eintragen('wechsel', { roster_id: rein, roster_id_2: raus })} />
      <KommentarSheet open={sheet?.art === 'kommentar'} onClose={() => setSheet(null)} onSave={(typ, text) => eintragen(typ, { text })} />
      <UhrSheet open={sheet?.art === 'uhr'} start={total} half={half} onClose={() => setSheet(null)} onSave={uhrStellen} />
    </div>
  )
}

function ergebnisPaarung(s: SpielRow, tore: [number, number]) {
  return s.heim ? `${tore[0]}:${tore[1]}` : `${tore[1]}:${tore[0]}`
}

function StatusChip({ status, label }: { status: string; label?: string }) {
  if (status === 'live')
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/20 px-3 py-1 font-bold uppercase tracking-wider text-white">
        <span className="h-2 w-2 animate-pulse rounded-full bg-primary motion-reduce:animate-none" /> Live {label}
      </span>
    )
  if (status === 'halbzeit') return <span className="rounded-full bg-sva-gold/20 px-3 py-1 font-bold uppercase tracking-wider text-sva-gold">Halbzeit</span>
  if (status === 'beendet') return <span className="rounded-full bg-secondary px-3 py-1 font-bold uppercase tracking-wider">Abpfiff · Endstand</span>
  return <span className="rounded-full bg-secondary px-3 py-1 font-bold uppercase tracking-wider text-muted-foreground">Vor dem Spiel</span>
}

function SyncLeiste({ pending, fehler, online, naechster, sendet }: { pending: number; fehler: number; online: boolean; naechster: number | null; sendet: boolean }) {
  if (fehler) return null
  if (!pending)
    return (
      <p className="mt-2 flex items-center justify-center gap-1.5 text-xs text-green-400" data-testid="sync">
        <CheckCircle2 className="h-3.5 w-3.5" /> Alles gesendet
      </p>
    )
  return (
    <div className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-sva-gold/40 bg-sva-gold/10 px-3 py-2 text-sm text-sva-gold" data-testid="sync">
      {online ? <Loader2 className={cn('h-4 w-4', sendet && 'animate-spin')} /> : <CloudOff className="h-4 w-4" />}
      <span>
        {pending} {pending === 1 ? 'Ereignis wartet' : 'Ereignisse warten'}
        {!online ? ' — kein Netz, wird automatisch nachgesendet' : naechster ? ' — neuer Versuch gleich' : ' — wird gesendet'}
      </span>
      {!sendet && (
        <button type="button" className="ml-1 underline" onClick={() => liveQueue.jetzt()}>
          Jetzt
        </button>
      )}
    </div>
  )
}

function BigBtn({ children, className, onClick, disabled, testid }: { children: React.ReactNode; className?: string; onClick: () => void; disabled?: boolean; testid?: string }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      data-testid={testid}
      className={cn(
        'flex min-h-[76px] items-center justify-center rounded-xl font-display text-xl tracking-wider shadow-sm transition-transform active:scale-[.97] disabled:opacity-35 motion-reduce:active:scale-100',
        className,
      )}
    >
      {children}
    </button>
  )
}

const TYP_FARBE: Partial<Record<TickerTyp, string>> = {
  tor: 'bg-primary text-white',
  gegentor: 'bg-secondary',
  gelb: 'bg-[#f5c518] text-black',
  rot: 'bg-primary/80 text-white',
  gelbrot: 'bg-primary/80 text-white',
  wechsel: 'bg-green-700 text-white',
}

function EventZeile({ e, byId }: { e: AdminEvent; byId: Map<string, RosterRow> }) {
  const p1 = e.player ? byId.get(e.player) : null
  const p2 = e.player2 ? byId.get(e.player2) : null
  let detail = ''
  if (e.type === 'tor') detail = [p1?.name ?? 'ohne Namen', p2 && `Vorlage ${nachname(p2.name)}`].filter(Boolean).join(' · ')
  else if (e.type === 'wechsel') detail = `↑ ${p1?.name ?? '?'}  ↓ ${p2?.name ?? '?'}`
  else if (e.type === 'gelb' || e.type === 'rot' || e.type === 'gelbrot') detail = p1?.name ?? 'Gegenspieler'
  return (
    <li className={cn('flex items-start gap-3 px-3 py-2.5', e.sync !== 'gesendet' && 'bg-sva-gold/5')}>
      <span className="w-12 shrink-0 pt-0.5 text-right font-display text-lg tabular-nums">{minuteLabel(e.minute, e.extra)}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('mr-2 inline-block rounded px-1.5 py-0.5 text-[11px] font-bold uppercase', TYP_FARBE[e.type] ?? 'bg-secondary text-muted-foreground')}>
          {TYP_LABEL[e.type]}
        </span>
        {detail && <span className="text-sm">{detail}</span>}
        {e.text && <span className="block text-sm text-muted-foreground">{e.text}</span>}
      </span>
      <span className="shrink-0 pt-1" title={e.sync === 'gesendet' ? 'gesendet' : e.sync === 'fehler' ? e.fehler : 'ausstehend'}>
        {e.sync === 'gesendet' ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" aria-label="gesendet" />
        ) : e.sync === 'fehler' ? (
          <AlertTriangle className="h-4 w-4 text-primary" aria-label="Fehler" />
        ) : (
          <CloudOff className="h-4 w-4 text-sva-gold" aria-label="ausstehend" />
        )}
      </span>
    </li>
  )
}

// ── Spieler-Chips ───────────────────────────────────────────────────────────
function Chips({ spieler, value, onPick, extra }: { spieler: RosterRow[]; value?: string | null; onPick: (id: string) => void; extra?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap gap-2">
      {spieler.map((s) => (
        <button
          key={s.id}
          type="button"
          onClick={() => onPick(s.id)}
          aria-pressed={value === s.id}
          className={cn(
            'flex min-h-[48px] items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-sm font-medium',
            value === s.id ? 'border-primary bg-primary text-white' : 'border-border bg-secondary',
          )}
        >
          {s.foto_url ? (
            <img src={s.foto_url} alt="" className="h-9 w-9 rounded-full object-cover object-top" />
          ) : (
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-muted font-display">{s.nummer ?? '?'}</span>
          )}
          <span>
            {s.nummer != null && <b className="mr-1 tabular-nums opacity-70">{s.nummer}</b>}
            {nachname(s.name)}
          </span>
        </button>
      ))}
      {extra}
    </div>
  )
}

const sheetCls = 'max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[88dvh] max-sm:w-full max-sm:translate-y-0 max-sm:rounded-b-none'

function TorSheet({ open, onClose, spieler, minute, onSave }: { open: boolean; onClose: () => void; spieler: RosterRow[]; minute: string; onSave: (schuetze: string | null, vorlage: string | null, text: string | null) => void }) {
  const [schuetze, setSchuetze] = useState<string | null>(null)
  const [vorlage, setVorlage] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [zusatz, setZusatz] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setSchuetze(null)
      setVorlage(null)
      setText('')
      setZusatz(null)
    }
  }, [open])
  const gesamt = [zusatz, text.trim()].filter(Boolean).join(' — ') || null
  return (
    <Modal open={open} onClose={onClose} title={`TOR SVA · ${minute}`} className={sheetCls}
      footer={<Button className="h-14 w-full text-lg" onClick={() => onSave(schuetze, vorlage === schuetze ? null : vorlage, gesamt)} data-testid="tor-speichern">⚽ Tor eintragen</Button>}>
      <div>
        <p className="mb-2 text-sm font-semibold">Wer hat getroffen?</p>
        {/* Sturm zuerst: Torschützen stehen meist vorn */}
        <Chips spieler={[...spieler].reverse()} value={schuetze} onPick={(id) => setSchuetze(id === schuetze ? null : id)} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold">Vorlage <span className="font-normal text-muted-foreground">(optional)</span></p>
        <Chips spieler={[...spieler].reverse().filter((s) => s.id !== schuetze)} value={vorlage} onPick={(id) => setVorlage(id === vorlage ? null : id)} />
      </div>
      <div className="flex flex-wrap gap-2">
        {['Elfmeter', 'Kopfball', 'Freistoß', 'Abstauber', 'Traumtor'].map((z) => (
          <button key={z} type="button" aria-pressed={zusatz === z} onClick={() => setZusatz(zusatz === z ? null : z)}
            className={cn('min-h-[40px] rounded-full border px-3 text-sm', zusatz === z ? 'border-sva-gold bg-sva-gold/20' : 'border-border')}>
            {z}
          </button>
        ))}
      </div>
      <Textarea rows={2} className="text-base" placeholder="Kurz beschreiben (optional)" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
    </Modal>
  )
}

function TextSheet({ open, titel, knopf, chips, onClose, onSave }: { open: boolean; titel: string; knopf: string; chips: string[]; onClose: () => void; onSave: (text: string | null) => void }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])
  return (
    <Modal open={open} onClose={onClose} title={titel} className={sheetCls}
      footer={<Button className="h-14 w-full text-lg" onClick={() => onSave(text.trim() || null)}>{knopf}</Button>}>
      <div className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c} type="button" onClick={() => setText((t) => (t ? `${t} ${c}` : c))} className="min-h-[40px] rounded-full border border-border px-3 text-sm">
            {c}
          </button>
        ))}
      </div>
      <Textarea rows={2} className="text-base" placeholder="Wie fiel das Tor? (optional)" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} />
    </Modal>
  )
}

function KartenSheet({ open, farbe, spieler, gelbSchon, onClose, onSave }: { open: boolean; farbe: 'gelb' | 'rot'; spieler: RosterRow[]; gelbSchon: Set<string>; onClose: () => void; onSave: (typ: 'gelb' | 'rot' | 'gelbrot', id: string | null, text: string | null) => void }) {
  const [art, setArt] = useState<'rot' | 'gelbrot'>('rot')
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) {
      setArt('rot')
      setText('')
    }
  }, [open])
  const typ = farbe === 'gelb' ? 'gelb' : art
  return (
    <Modal open={open} onClose={onClose} title={farbe === 'gelb' ? 'Gelbe Karte — wer?' : 'Platzverweis — wer?'} description={farbe === 'gelb' ? 'Spieler antippen = sofort eintragen. Zweite Gelbe wird automatisch Gelb-Rot.' : 'Spieler antippen = sofort eintragen.'} className={sheetCls}>
      {farbe === 'rot' && (
        <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Art">
          {(['rot', 'gelbrot'] as const).map((a) => (
            <button key={a} type="button" role="radio" aria-checked={art === a} onClick={() => setArt(a)}
              className={cn('min-h-[48px] rounded-lg border font-semibold', art === a ? 'border-primary bg-primary text-white' : 'border-border')}>
              {a === 'rot' ? 'Rot' : 'Gelb-Rot'}
            </button>
          ))}
        </div>
      )}
      <Textarea rows={1} className="text-base" placeholder="Grund (optional), z. B. Foulspiel" value={text} onChange={(e) => setText(e.target.value)} maxLength={200} />
      <Chips
        spieler={spieler}
        onPick={(id) => onSave(farbe === 'gelb' && gelbSchon.has(id) ? 'gelbrot' : typ, id, text.trim() || null)}
        extra={
          <button type="button" onClick={() => onSave(typ, null, text.trim() ? `Gegner: ${text.trim()}` : 'Gegner')} className="min-h-[48px] rounded-full border border-dashed border-border px-4 text-sm">
            Gegenspieler
          </button>
        }
      />
    </Modal>
  )
}

function WechselSheet({ open, raus, rein, onClose, onSave }: { open: boolean; raus: RosterRow[]; rein: RosterRow[]; onClose: () => void; onSave: (rein: string, raus: string) => void }) {
  const [r, setR] = useState<string | null>(null)
  const [e, setE] = useState<string | null>(null)
  useEffect(() => {
    if (open) {
      setR(null)
      setE(null)
    }
  }, [open])
  return (
    <Modal open={open} onClose={onClose} title="Wechsel" className={sheetCls}
      footer={<Button className="h-14 w-full text-lg" disabled={!r || !e} onClick={() => r && e && onSave(e, r)}>Wechsel eintragen</Button>}>
      <div>
        <p className="mb-2 text-sm font-semibold text-red-300">▼ Raus</p>
        <Chips spieler={raus} value={r} onPick={(id) => setR(id === r ? null : id)} />
      </div>
      <div>
        <p className="mb-2 text-sm font-semibold text-green-400">▲ Rein</p>
        {rein.length ? <Chips spieler={rein} value={e} onPick={(id) => setE(id === e ? null : id)} /> : <p className="text-sm text-muted-foreground">Niemand mehr auf der Bank.</p>}
      </div>
    </Modal>
  )
}

function KommentarSheet({ open, onClose, onSave }: { open: boolean; onClose: () => void; onSave: (typ: TickerTyp, text: string) => void }) {
  const [text, setText] = useState('')
  useEffect(() => {
    if (open) setText('')
  }, [open])
  const schnell: [string, TickerTyp][] = [
    ['Elfmeter verschossen', 'elfmeter'],
    ['Elfmeter gehalten!', 'elfmeter'],
    ['Pfosten!', 'kommentar'],
    ['Riesenchance', 'kommentar'],
    ['Trinkpause', 'kommentar'],
  ]
  return (
    <Modal open={open} onClose={onClose} title="Kommentar" className={sheetCls}
      footer={<Button className="h-14 w-full text-lg" disabled={!text.trim()} onClick={() => onSave('kommentar', text.trim())}>Kommentar senden</Button>}>
      <div className="flex flex-wrap gap-2">
        {schnell.map(([t, typ]) => (
          <button key={t} type="button" onClick={() => onSave(typ, t)} className="min-h-[44px] rounded-full border border-border px-3 text-sm">
            {t}
          </button>
        ))}
      </div>
      <Textarea rows={3} className="text-base" placeholder="Was passiert gerade?" value={text} onChange={(e) => setText(e.target.value)} maxLength={500} autoFocus />
    </Modal>
  )
}

function UhrSheet({ open, start, half, onClose, onSave }: { open: boolean; start: number; half: 1 | 2; onClose: () => void; onSave: (total: number) => void }) {
  const [m, setM] = useState(start)
  useEffect(() => {
    if (open) setM(start)
  }, [open, start])
  const min = half === 2 ? 46 : 1
  return (
    <Modal open={open} onClose={onClose} title="Uhr stellen" description="Welche Minute läuft laut Schiri-Uhr gerade? Die automatische Minute rechnet ab jetzt von dort weiter." className={sheetCls}
      footer={<Button className="h-14 w-full text-lg" onClick={() => onSave(m)}>Auf {m}. Minute stellen</Button>}>
      <div className="flex items-center justify-center gap-4">
        <Button variant="outline" size="icon" className="h-14 w-14" onClick={() => setM((x) => Math.max(min, x - 1))} aria-label="weniger"><Minus className="h-6 w-6" /></Button>
        <span className="w-24 text-center font-display text-5xl tabular-nums">{m}'</span>
        <Button variant="outline" size="icon" className="h-14 w-14" onClick={() => setM((x) => Math.min(130, x + 1))} aria-label="mehr"><Plus className="h-6 w-6" /></Button>
      </div>
    </Modal>
  )
}

// ── Nach dem Spiel: Spieler des Spiels + Story-Grafik ───────────────────────
function NachDemSpiel({ spiel, tore, kandidaten, events, byId, istAdmin, onMotm }: { spiel: SpielRow; tore: [number, number]; kandidaten: RosterRow[]; events: AdminEvent[]; byId: Map<string, RosterRow>; istAdmin: boolean; onMotm: (id: string | null) => Promise<void> }) {
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  const motm = spiel.motm_roster_id ? byId.get(spiel.motm_roster_id) ?? null : null
  const torschuetzen = events
    .filter((e) => e.type === 'tor')
    .map((e) => `${e.player ? nachname(byId.get(e.player)?.name ?? '?') : 'Tor'} ${minuteLabel(e.minute, e.extra)}`)
  return (
    <Card className="mt-3 border-sva-gold/40">
      <CardContent className="space-y-3 p-4">
        <h2 className="flex items-center gap-2 font-display text-lg tracking-wide">
          <Star className="h-5 w-5 text-sva-gold" /> Spieler des Spiels
        </h2>
        <Chips spieler={kandidaten} value={spiel.motm_roster_id} onPick={(id) => void onMotm(id === spiel.motm_roster_id ? null : id)} />
        <Button
          className="h-12 w-full text-base"
          variant="outline"
          disabled={busy}
          onClick={async () => {
            setBusy(true)
            try {
              // v16-S: „Live-Ticker präsentiert von“ kommt mit auf die Grafik
              const partner = await fetchLivePartner()
              const r = await teileStory({ spiel, toreSva: tore[0], toreGegner: tore[1], torschuetzen, motm, partner })
              toast.success(r === 'geladen' ? 'Story-Grafik heruntergeladen.' : 'Story-Grafik geteilt.')
            } catch (e) {
              toast.error(friendlyError(e, 'Grafik konnte nicht erstellt werden.'))
            } finally {
              setBusy(false)
            }
          }}
          data-testid="story"
        >
          {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Share2 className="h-5 w-5" />} Story-Grafik erstellen
        </Button>
        {istAdmin && (
          <div className="rounded-lg border border-border p-3">
            <p className="mb-2 text-sm text-muted-foreground">Das Ergebnis ist gespeichert. Damit es auch im Onepager steht:</p>
            <PublishButton size="compact" />
          </div>
        )}
      </CardContent>
    </Card>
  )
}
