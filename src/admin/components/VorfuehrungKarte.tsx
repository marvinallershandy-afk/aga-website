import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Presentation, Play, Flag, Trash2, Copy, ExternalLink, Radio, Loader2, Map as MapIcon, Trophy, BookOpen } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Switch } from './ui/switch'
import { useToast } from './ui/toast'
import { useConfirm } from './ui/confirm'
import { useSpieleMitVorfuehrung } from '../lib/queries'
import { istVorfuehrSpiel, useVorfuehrungAktionen, VORSCHLAG_GEGNER } from '../lib/vorfuehrung'
import { qrMatrix, zeichneQr } from '../lib/qr'
import { paarung } from '../lib/spiele'
import { laufendeMinute, type LiveStatus } from '../../live/model'
import { vorfuehrungsLink } from '../../live/vorfuehrung'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v18-T „Vorführ-Spiel“ (Übersicht, nur Admin): ein Testspiel per Knopf,
// das NUR über den Vorführ-Link /live?vorfuehrung=1 zu sehen ist. Website,
// Karte, Kalender, Album und Statistik merken nichts davon.
//   Starten (bzw. neu starten = zurücksetzen) · Beenden · Löschen
//   Im Ticker-Pult bedienen · Vorführ-Link öffnen/kopieren + QR-Code
// ─────────────────────────────────────────────────────────────

export function VorfuehrungKarte({ className }: { className?: string }) {
  const toast = useToast()
  const confirm = useConfirm()
  const spieleQ = useSpieleMitVorfuehrung()
  const demo = (spieleQ.data ?? []).find(istVorfuehrSpiel) ?? null
  const { starten, beenden, loeschen } = useVorfuehrungAktionen()
  const [gegner, setGegner] = useState(VORSCHLAG_GEGNER)
  const [beispiele, setBeispiele] = useState(true)
  const [anpfiff, setAnpfiff] = useState(true)
  const link = vorfuehrungsLink(window.location.origin)
  const busy = starten.isPending || beenden.isPending || loeschen.isPending

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!demo || demo.status !== 'live') return
    const t = window.setInterval(() => setNow(Date.now()), 15_000)
    return () => window.clearInterval(t)
  }, [demo])

  const fehler = (e: unknown) => toast.error(e instanceof Error ? e.message : 'Das hat nicht geklappt.')

  const los = async () => {
    if (demo) {
      const ok = await confirm({
        title: 'Vorführ-Spiel neu starten?',
        description: 'Das laufende Vorführ-Spiel wird zurückgesetzt: Ticker leer, Spielstand 0:0.',
        confirmLabel: 'Neu starten',
      })
      if (!ok) return
    }
    starten.mutate(
      { gegner, beispiele, anpfiff },
      { onSuccess: () => toast.success('Vorführ-Spiel läuft. Link öffnen oder QR-Code zeigen.'), onError: fehler },
    )
  }
  const ende = () => beenden.mutate(undefined, { onSuccess: () => toast.success('Abgepfiffen.'), onError: fehler })
  const weg = async () => {
    const ok = await confirm({
      title: 'Vorführ-Spiel löschen?',
      description: 'Spiel und Ticker der Vorführung werden gelöscht. Echte Spiele bleiben unberührt.',
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (ok) loeschen.mutate(undefined, { onSuccess: () => toast.success('Vorführ-Spiel gelöscht.'), onError: fehler })
  }
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Vorführ-Link kopiert.')
    } catch {
      toast.error('Kopieren nicht möglich — Link bitte von Hand markieren.')
    }
  }

  const lm = demo ? laufendeMinute(demo.status as LiveStatus, demo.anpfiff_at, demo.wiederanpfiff_at, now) : null
  const stand = demo ? `${demo.heim ? demo.live_tore_sva : demo.live_tore_gegner}:${demo.heim ? demo.live_tore_gegner : demo.live_tore_sva}` : ''
  const statusText = !demo
    ? null
    : demo.status === 'live'
      ? `LIVE ${stand}${lm ? ` · ${lm.label}` : ''}`
      : demo.status === 'halbzeit'
        ? `Halbzeit ${stand}`
        : demo.status === 'beendet'
          ? `Endstand ${stand}`
          : 'vor dem Anpfiff'

  return (
    <Card className={cn('border-dashed', className)} data-testid="vorfuehrung">
      <CardContent className="space-y-4 p-5">
        <div>
          <h2 className="flex items-center gap-2 font-display text-xl tracking-wide">
            <Presentation className="h-5 w-5 text-primary" /> Vorführ-Spiel
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Ein Testspiel zum Zeigen von Live-Seite und Ticker-Pult. Sichtbar <b className="text-foreground">nur über den Vorführ-Link</b> —
            Website, Karte, Kalender und Statistik merken nichts davon.
          </p>
        </div>

        {/* Zustand */}
        <div className={cn('flex min-h-[56px] items-center gap-3 rounded-lg border px-3 py-2', demo ? 'border-primary/50 bg-primary/10' : 'border-border')} data-testid="vorfuehrung-status">
          <Radio className={cn('h-5 w-5 shrink-0', demo?.status === 'live' ? 'animate-pulse text-primary motion-reduce:animate-none' : 'text-muted-foreground')} />
          {demo ? (
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-semibold uppercase tracking-wider text-primary">Vorführung · {statusText}</span>
              <span className="block truncate font-medium">{paarung(demo)}</span>
            </span>
          ) : (
            <span className="flex-1 text-sm text-muted-foreground">Gerade kein Vorführ-Spiel.</span>
          )}
          {demo && (
            <Button asChild size="sm" variant="outline" className="h-10 shrink-0">
              <Link to={`/live?spiel=${demo.id}`}>Ticker-Pult</Link>
            </Button>
          )}
        </div>

        {/* Starten */}
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="vf-gegner">Gegner</Label>
            <Input id="vf-gegner" className="h-11 text-base" value={gegner} maxLength={60} placeholder={VORSCHLAG_GEGNER} onChange={(e) => setGegner(e.target.value)} />
          </div>
          <Switch checked={anpfiff} onChange={setAnpfiff} label="Sofort anpfeifen" hint={anpfiff ? 'Das Spiel läuft gleich ab Start (LIVE).' : 'Countdown — „ANPFIFF“ dann im Ticker-Pult drücken.'} />
          <Switch
            checked={beispiele && anpfiff}
            disabled={!anpfiff}
            onChange={setBeispiele}
            label="Mit Beispiel-Ereignissen"
            hint="Chance, Tor und Gelbe Karte mit echten Spielern — sonst nur „Anpfiff“."
          />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <Button className="h-12 text-base sm:col-span-1" onClick={() => void los()} disabled={busy} data-testid="vf-starten">
              {starten.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
              {demo ? 'Neu starten' : 'Vorführ-Spiel starten'}
            </Button>
            <Button variant="outline" className="h-12 text-base" onClick={ende} disabled={busy || !demo || demo.status === 'beendet'} data-testid="vf-beenden">
              <Flag className="h-5 w-5" /> Beenden
            </Button>
            <Button variant="outline" className="h-12 text-base text-primary" onClick={() => void weg()} disabled={busy || !demo} data-testid="vf-loeschen">
              <Trash2 className="h-5 w-5" /> Löschen
            </Button>
          </div>
        </div>

        {/* Link + QR */}
        <div className="flex flex-col gap-4 rounded-lg border border-border p-3 sm:flex-row sm:items-center">
          <QrBild text={link} />
          <div className="min-w-0 flex-1 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Vorführ-Link · am Handy scannen</p>
            <p className="break-all font-mono text-sm" data-testid="vf-link">{link}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="sm" className="h-10">
                <a href={link} target="_blank" rel="noreferrer">
                  <ExternalLink className="h-4 w-4" /> Öffnen
                </a>
              </Button>
              <Button size="sm" variant="outline" className="h-10" onClick={() => void kopieren()}>
                <Copy className="h-4 w-4" /> Kopieren
              </Button>
              <Button asChild size="sm" variant="ghost" className="h-10">
                <a href={vorfuehrungsLink(window.location.origin, 'karte')} target="_blank" rel="noreferrer">
                  <MapIcon className="h-4 w-4" /> Auf der Karte
                </a>
              </Button>
              {/* v21-T: Tipp-Liga als Simulation (Phasen per Knopf, nichts wird gespeichert) */}
              <Button asChild size="sm" variant="outline" className="h-10" data-testid="vf-tippliga">
                <a href="/tippen?vorfuehrung=1" target="_blank" rel="noreferrer">
                  <Trophy className="h-4 w-4" /> Tipp-Liga-Vorführung öffnen
                </a>
              </Button>
              {/* v22-A: Album als Simulation (Demo-Fan, Test-Packs, Kartenlabor, nichts wird gespeichert) */}
              <Button asChild size="sm" variant="outline" className="h-10" data-testid="vf-album">
                <a href="/album?vorfuehrung=1" target="_blank" rel="noreferrer">
                  <BookOpen className="h-4 w-4" /> Album-Vorführung öffnen
                </a>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function QrBild({ text }: { text: string }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    try {
      zeichneQr(ctx, qrMatrix(text), 0, 0, c.width, '#111')
    } catch {
      /* zu lang für den QR-Encoder — Link bleibt kopierbar */
    }
  }, [text])
  return <canvas ref={ref} width={320} height={320} className="h-40 w-40 shrink-0 self-center rounded bg-white" role="img" aria-label={`QR-Code: ${text}`} />
}
