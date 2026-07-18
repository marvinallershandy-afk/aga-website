import { useMemo, useState } from 'react'
import { Zap, Send, CheckCircle2, Save, AlertTriangle, History } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { useToast } from '../components/ui/toast'
import { useWebhooks, useDeliveries, useWebhookMutations } from '../lib/queries'
import { isMissingTable, type WebhookRow } from '../lib/db'

// ─────────────────────────────────────────────────────────────
// v13-K9 → P2 (Admin-Ausbau): Automationen — die n8n-Andockpunkte.
// Neu: Die Ziel-Webhook-URLs liegen jetzt team-weit in der Tabelle
// `sm_webhooks` (nicht mehr pro Gerät in localStorage) und jeder Versand
// wird in `sm_webhook_deliveries` protokolliert → beobachtbar in der UI.
// Die ECHTE server-seitige Auslösung läuft weiterhin über Supabase Database
// Webhooks bzw. n8n-Cron auf dieselben URLs (hier dokumentiert).
//
// Graceful degradation: Solange die Migration 20260719090000_sm_webhooks.sql
// noch nicht angewandt ist, fehlt die Tabelle (SQLSTATE 42P01). Dann degradiert
// die Seite sichtbar auf einen localStorage-Fallback statt hart zu crashen.
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sm_webhooks_v1'

interface HookDef {
  event: string
  titel: string
  wann: string
  rezept: string
  tabelle: string
  /** true → Trigger-Quelle ist eine eingefrorene sm_-Tabelle, noch nicht verdrahten. */
  gesperrt?: boolean
}

const HOOKS: HookDef[] = [
  {
    event: 'beitrag.fertig',
    titel: 'Beitrag fertig → Team benachrichtigen',
    wann: 'Wenn im Redaktionsplan ein Beitrag auf „Fertig" wechselt.',
    rezept:
      'n8n: Webhook → WhatsApp/Signal-Node an die Team-Gruppe: „,{titel}‘ ist fertig — heute posten!" Supabase-Webhook auf UPDATE sm_content (status=fertig).',
    tabelle: 'sm_content (UPDATE, status → fertig)',
  },
  {
    event: 'spiel.angelegt',
    titel: 'Neues Spiel → Content-Paket anstoßen',
    wann: 'Wenn ein neues Spiel angelegt wird.',
    rezept:
      'n8n: Webhook → Wartezeit bis 3 Tage vor Anpfiff → Reminder „Aufstellungs-Grafik bauen" + Kalendereintrag.',
    // GRENZE: sm_spiele ist eingefroren (STAGE0 R1). Diesen Trigger NICHT auf
    // sm_spiele INSERT verdrahten — nach SME Stage 1 auf `matches` INSERT umziehen.
    tabelle: 'matches (INSERT) — nach SME Stage 1',
    gesperrt: true,
  },
  {
    event: 'insights.faellig',
    titel: 'Insights-Erinnerung (wöchentlich)',
    wann: 'Jeden Montag 09:00 — kein Supabase-Event nötig.',
    rezept:
      'n8n: Cron Mo 09:00 → WhatsApp an Marvin: „Follower & Reichweite der Woche eintragen" mit Direktlink auf /admin/insights.',
    tabelle: '— (n8n-Cron, kein DB-Webhook)',
  },
  {
    event: 'grafik.gerendert',
    titel: 'Matchday-Grafik → Drive-Ablage',
    wann: 'Wenn der Generator eine Grafik in den Storage-Bucket legt.',
    rezept:
      'n8n: Webhook → Google-Drive-Node lädt die Grafik in den Spieltagsordner (SVA Media / Saison … / Spieltag …). Supabase-Webhook auf INSERT storage.objects (bucket sm_grafiken).',
    tabelle: 'storage.objects (INSERT, bucket=sm_grafiken)',
  },
]

function loadLocalUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}
function saveLocalUrls(next: Record<string, string>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore */
  }
}

function fmtTs(ts: string | null | undefined): string {
  if (!ts) return '—'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleString('de-DE', { dateStyle: 'short', timeStyle: 'short' })
}

export function Automationen() {
  const { success, error, info } = useToast()
  const webhooksQ = useWebhooks()
  const deliveriesQ = useDeliveries()
  const { save, record } = useWebhookMutations()

  // DB verfügbar? Nur wenn der Query-Fehler NICHT „Tabelle fehlt" ist, gilt der
  // DB-Weg als aktiv. Bei fehlender Tabelle → localStorage-Fallback.
  const tableMissing = webhooksQ.isError && isMissingTable(webhooksQ.error)
  const dbActive = !tableMissing

  const rowsByEvent = useMemo(() => {
    const map = new Map<string, WebhookRow>()
    for (const r of webhooksQ.data ?? []) map.set(r.event, r)
    return map
  }, [webhooksQ.data])

  // Kein Sync-Effekt: Anzeige = Nutzer-Edit ODER Basiswert (DB bzw. localStorage).
  // localUrls wird lazy initialisiert und nur bei lokalem Speichern fortgeschrieben.
  const [localUrls, setLocalUrls] = useState<Record<string, string>>(loadLocalUrls)
  const [edits, setEdits] = useState<Record<string, string>>({})
  const [testing, setTesting] = useState<string | null>(null)

  const baseUrl = (event: string): string =>
    dbActive ? (rowsByEvent.get(event)?.url ?? '') : (localUrls[event] ?? '')
  const valueOf = (event: string): string => edits[event] ?? baseUrl(event)

  const setDraft = (event: string, url: string) => setEdits((d) => ({ ...d, [event]: url }))
  const clearEdit = (event: string) =>
    setEdits((d) => {
      if (!(event in d)) return d
      const rest = { ...d }
      delete rest[event]
      return rest
    })

  const persist = async (event: string) => {
    const url = valueOf(event).trim()
    if (dbActive) {
      try {
        await save.mutateAsync({ event, url: url || null })
        clearEdit(event) // Basiswert kommt jetzt aus dem Refetch
        success('URL gespeichert (team-weit).')
      } catch {
        error('Speichern fehlgeschlagen.')
      }
    } else {
      const next = { ...localUrls, [event]: url }
      setLocalUrls(next)
      saveLocalUrls(next)
      clearEdit(event)
      info('Lokal gespeichert (Tabelle sm_webhooks fehlt — Migration anwenden für team-weite Ablage).')
    }
  }

  const sendTest = async (event: string) => {
    const url = valueOf(event).trim()
    if (!url) {
      info('Erst die n8n-Webhook-URL eintragen und speichern.')
      return
    }
    setTesting(event)
    const payload = { event, test: true, quelle: 'sva-admin', ts: new Date().toISOString() }
    let ok = true
    try {
      // no-cors: n8n-Webhooks antworten ohne CORS-Header — der Request geht
      // raus, die Antwort ist opak. Erfolg = kein Netzwerkfehler (http_code bleibt null).
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
    } catch {
      ok = false
    }
    // Zustell-Log schreiben (nur wenn DB aktiv — sonst nur Toast).
    if (dbActive) {
      const webhookId = rowsByEvent.get(event)?.id ?? null
      try {
        await record.mutateAsync({
          webhookId,
          event,
          status: ok ? 'ok' : 'fehler',
          httpCode: null,
          payloadExcerpt: JSON.stringify(payload).slice(0, 200),
        })
      } catch {
        /* Log-Fehler nicht eskalieren — der Testversand selbst zählt. */
      }
    }
    setTesting(null)
    if (ok) success(`Test-Event „${event}" gesendet — in n8n prüfen.`)
    else error('Senden fehlgeschlagen — URL prüfen (läuft n8n?).')
  }

  const deliveries = deliveriesQ.data ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl uppercase tracking-wide">
          <Zap className="h-7 w-7 text-primary" /> Automationen
        </h1>
        <p className="mt-1 text-muted-foreground">
          Andockpunkte für den n8n-Server (Jonas). URL aus n8n einfügen, speichern, Test senden —
          die echte Auslösung übernimmt Supabase (Database Webhooks) bzw. der n8n-Cron.
        </p>
      </div>

      {tableMissing && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
          <div>
            <p className="font-medium text-amber-200">Tabelle „sm_webhooks" ist noch nicht angelegt.</p>
            <p className="mt-1 text-amber-200/80">
              Solange die Migration <code>20260719090000_sm_webhooks.sql</code> nicht angewandt ist,
              werden URLs nur lokal auf diesem Gerät gespeichert und der Zustell-Log bleibt leer.
              Nach dem Anwenden greift automatisch die team-weite Ablage.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {HOOKS.map((h) => {
          const row = rowsByEvent.get(h.event)
          const configured = !!valueOf(h.event).trim()
          return (
            <Card key={h.event}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{h.titel}</span>
                  {h.gesperrt ? (
                    <Badge className="shrink-0 bg-amber-600/20 text-amber-300">nach SME Stage 1</Badge>
                  ) : configured ? (
                    <Badge className="shrink-0 bg-emerald-600/20 text-emerald-400">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> verbunden
                    </Badge>
                  ) : (
                    <Badge className="shrink-0 bg-white/10 text-muted-foreground">offen</Badge>
                  )}
                </CardTitle>
                <CardDescription>{h.wann}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`wh-${h.event}`}>n8n-Webhook-URL · Event „{h.event}"</Label>
                  <div className="flex gap-2">
                    <Input
                      id={`wh-${h.event}`}
                      placeholder="https://n8n.…/webhook/…"
                      value={valueOf(h.event)}
                      onChange={(e) => setDraft(h.event, e.target.value)}
                    />
                    <Button variant="outline" onClick={() => void persist(h.event)} title="Speichern">
                      <Save className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => void sendTest(h.event)}
                      disabled={testing === h.event}
                    >
                      <Send className="mr-1.5 h-4 w-4" />
                      {testing === h.event ? 'Sendet…' : 'Test'}
                    </Button>
                  </div>
                </div>

                {dbActive && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span>
                      Letzter Versand: <span className="text-foreground/80">{fmtTs(row?.letzter_versand)}</span>
                    </span>
                    <span>
                      Status:{' '}
                      {row?.letzter_status ? (
                        <span
                          className={
                            row.letzter_status === 'ok' ? 'text-emerald-400' : 'text-red-400'
                          }
                        >
                          {row.letzter_status}
                        </span>
                      ) : (
                        <span className="text-foreground/60">noch keiner</span>
                      )}
                    </span>
                  </div>
                )}

                <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3 text-sm text-muted-foreground">
                  <p className="mb-1 font-medium text-foreground/90">Rezept</p>
                  <p>{h.rezept}</p>
                  <p className="mt-2 text-xs">
                    Trigger-Quelle: <code className="text-foreground/80">{h.tabelle}</code>
                  </p>
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Zustell-Log (Grundgerüst der Beobachtbarkeit) */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4 text-primary" /> Zustell-Log
          </CardTitle>
          <CardDescription>Die letzten Versände (Test &amp; echt) aus sm_webhook_deliveries.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm">
          {!dbActive ? (
            <p className="text-muted-foreground">
              Verfügbar, sobald die Tabellen angelegt sind (Migration anwenden).
            </p>
          ) : deliveries.length === 0 ? (
            <p className="text-muted-foreground">Noch keine Versände protokolliert.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-1 pr-4 font-medium">Zeitpunkt</th>
                    <th className="py-1 pr-4 font-medium">Event</th>
                    <th className="py-1 pr-4 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-t border-white/5">
                      <td className="py-1.5 pr-4 text-foreground/80">{fmtTs(d.gesendet_at)}</td>
                      <td className="py-1.5 pr-4">
                        <code className="text-foreground/80">{d.event}</code>
                      </td>
                      <td className="py-1.5 pr-4">
                        <span className={d.status === 'ok' ? 'text-emerald-400' : 'text-red-400'}>
                          {d.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Einrichtung in Supabase (einmalig, ~5 Minuten)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Migration <code>20260719090000_sm_webhooks.sql</code> anwenden (Tabellen + RLS).</li>
            <li>Supabase-Dashboard → Database → Webhooks → „Create a new hook".</li>
            <li>Tabelle + Ereignis wie oben angegeben wählen (z. B. sm_content, UPDATE).</li>
            <li>Als URL die hier eingetragene n8n-Webhook-URL einsetzen (HTTP POST).</li>
            <li>In n8n den Workflow aktivieren — „Test" hier prüft den Empfang sofort.</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
