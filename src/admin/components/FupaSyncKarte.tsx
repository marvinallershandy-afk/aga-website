import { RefreshCw, Loader2, CheckCircle2, AlertTriangle, PauseCircle, Download } from 'lucide-react'
import { Card, CardContent } from './ui/card'
import { Button } from './ui/button'
import { Switch } from './ui/switch'
import { useToast } from './ui/toast'
import { useFupaAuto, useJetztAbgleichen, useLetzterSync, useSetFupaAuto, type SyncLogRow } from '../lib/fupa'
import { isMissingSchema } from '../lib/db'
import { relativZeit } from '../lib/format'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v19-B „FuPa-Abgleich“ (nur Admin): Spielplan, Ergebnisse und Tabelle
// kommen automatisch von FuPa — kein Abtippen mehr. Zeigt den letzten
// Abgleich, erlaubt „Jetzt abgleichen“ und hat einen Schalter für den
// automatischen Zeitplan (täglich + sonntagabends).
// ─────────────────────────────────────────────────────────────

function zusammenfassung(row: SyncLogRow): string {
  if (row.status === 'uebersprungen') return row.details.grund === 'fupa_auto=false' ? 'Automatik war aus' : 'übersprungen'
  if (row.status === 'nicht_konfiguriert') return 'FuPa-Link fehlt'
  if (row.status === 'fehler') return row.fehler ? row.fehler.slice(0, 120) : 'Fehler'
  const d = row.details
  if ((row.geaendert ?? 0) === 0) return 'nichts Neues — alles aktuell'
  const teile: string[] = []
  if (d.spiele_neu) teile.push(`${d.spiele_neu} Spiel(e) neu`)
  if (d.spiele_aktualisiert) teile.push(`${d.spiele_aktualisiert} aktualisiert`)
  if (d.tabelle_geaendert) teile.push('Tabelle neu')
  let txt = teile.join(', ') || `${row.geaendert} Änderung(en)`
  if (d.publish === 'ausgeloest') txt += ' · Website wird veröffentlicht'
  else if (d.publish === 'nicht_konfiguriert') txt += ' · Veröffentlichen noch nicht eingerichtet'
  return txt
}

export function FupaSyncKarte({ className }: { className?: string }) {
  const { toast } = useToast()
  const syncQ = useLetzterSync()
  const autoQ = useFupaAuto()
  const setAuto = useSetFupaAuto()
  const abgleichen = useJetztAbgleichen()

  // Fehlt die Migration → ruhiger Hinweis, keine rohe DB-Meldung.
  if (syncQ.isError && isMissingSchema(syncQ.error)) {
    return (
      <Card className={className}>
        <CardContent className="p-5">
          <div className="mb-1 flex items-center gap-2 font-semibold">
            <Download className="size-4" /> FuPa-Abgleich
          </div>
          <p className="text-sm text-muted-foreground">
            Noch nicht eingerichtet (Datenbank-Update fehlt). Bitte Marvin Bescheid geben.
          </p>
        </CardContent>
      </Card>
    )
  }

  const letzter = syncQ.data
  const auto = autoQ.data ?? true
  const laeuft = abgleichen.isPending

  const statusFarbe =
    letzter?.status === 'ok' ? 'text-green-500'
      : letzter?.status === 'fehler' ? 'text-primary'
        : 'text-muted-foreground'
  const StatusIcon =
    letzter?.status === 'ok' ? CheckCircle2
      : letzter?.status === 'fehler' ? AlertTriangle
        : PauseCircle

  async function jetzt() {
    const r = await abgleichen.mutateAsync()
    if (r.kind === 'ok') {
      toast(r.geaendert > 0 ? `Abgeglichen: ${r.geaendert} Änderung(en).` : 'Alles schon aktuell — nichts zu tun.', 'success')
    } else if (r.kind === 'uebersprungen') {
      toast(r.grund, 'info')
    } else if (r.kind === 'nicht-eingerichtet') {
      toast(r.grund, 'info')
    } else {
      toast(r.meldung, 'error')
    }
  }

  return (
    <Card className={className}>
      <CardContent className="flex flex-col gap-4 p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 font-semibold">
            <Download className="size-4" /> FuPa-Abgleich
          </div>
          <Button onClick={jetzt} disabled={laeuft} size="sm" className="shrink-0">
            {laeuft ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            {laeuft ? 'Läuft …' : 'Jetzt abgleichen'}
          </Button>
        </div>

        <p className="text-sm text-muted-foreground">
          Spielplan, Ergebnisse und Tabelle kommen automatisch von FuPa — kein Abtippen. Der Liveticker am
          Spieltag bleibt reine Handarbeit.
        </p>

        <div className="rounded-lg border bg-secondary/30 p-3 text-sm">
          {letzter ? (
            <div className="flex items-start gap-2">
              <StatusIcon className={cn('mt-0.5 size-4 shrink-0', statusFarbe)} />
              <div>
                <div className="font-medium">
                  Zuletzt {relativZeit(letzter.zeit)}
                  <span className="text-muted-foreground"> · {letzter.ausloeser === 'auto' ? 'automatisch' : 'von Hand'}</span>
                </div>
                <div className="text-muted-foreground">{zusammenfassung(letzter)}</div>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground">Noch nie abgeglichen. Mit „Jetzt abgleichen“ starten.</div>
          )}
        </div>

        <Switch
          checked={auto}
          onChange={(v) => {
            setAuto.mutate(v, {
              onSuccess: () => toast(v ? 'Automatischer Abgleich an.' : 'Automatischer Abgleich aus.', 'success'),
              onError: (e) => toast(e instanceof Error ? e.message : 'Konnte nicht gespeichert werden.', 'error'),
            })
          }}
          label="Automatischer Abgleich"
          hint={auto ? 'Täglich früh und sonntagabends automatisch.' : 'Aktuell aus — es wird nur von Hand abgeglichen.'}
        />
      </CardContent>
    </Card>
  )
}
