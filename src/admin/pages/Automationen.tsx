import { useState } from 'react'
import { Zap, Send, CheckCircle2 } from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { useToast } from '../components/ui/toast'

// ─────────────────────────────────────────────────────────────
// v13-K9: Automationen — die n8n-Andockpunkte („Jonas"-Server).
// Diese Seite verwaltet die Ziel-Webhook-URLs pro Ereignis und kann
// Test-Events feuern. Die ECHTE server-seitige Auslösung läuft über
// Supabase Database Webhooks (Dashboard → Database → Webhooks) auf
// dieselben URLs — hier dokumentiert, damit Einrichtung in Minuten geht.
// URLs liegen bewusst in localStorage (kein Secret: n8n-Webhooks sind
// über ihre unguessbare URL geschützt; Team-Gerät = Team-Zugriff).
// ─────────────────────────────────────────────────────────────

const STORAGE_KEY = 'sm_webhooks_v1'

interface HookDef {
  event: string
  titel: string
  wann: string
  rezept: string
  tabelle: string
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
    wann: 'Wenn unter Spiele & Kader ein neues Spiel angelegt wird.',
    rezept:
      'n8n: Webhook → Wartezeit bis 3 Tage vor Anpfiff → Reminder „Aufstellungs-Grafik bauen" + Kalendereintrag. Supabase-Webhook auf INSERT sm_spiele.',
    tabelle: 'sm_spiele (INSERT)',
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
      'n8n: Webhook → Google-Drive-Node lädt die Grafik in den Vereins-Ordner (Drive-Bridge-Zugang existiert). Supabase-Webhook auf INSERT storage.objects (bucket sm_grafiken).',
    tabelle: 'storage.objects (INSERT, bucket=sm_grafiken)',
  },
]

function loadUrls(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function Automationen() {
  const { success, error, info } = useToast()
  const [urls, setUrls] = useState<Record<string, string>>(loadUrls)
  const [testing, setTesting] = useState<string | null>(null)

  const save = (event: string, url: string) => {
    const next = { ...urls, [event]: url }
    setUrls(next)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      /* ignore */
    }
  }

  const sendTest = async (event: string) => {
    const url = urls[event]?.trim()
    if (!url) {
      info('Erst die n8n-Webhook-URL eintragen.')
      return
    }
    setTesting(event)
    try {
      // no-cors: n8n-Webhooks antworten ohne CORS-Header — der Request
      // geht raus, die Antwort ist opak. Erfolg = kein Netzwerkfehler.
      await fetch(url, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event, test: true, quelle: 'sva-admin', ts: new Date().toISOString() }),
      })
      success(`Test-Event „${event}" gesendet — in n8n prüfen.`)
    } catch {
      error('Senden fehlgeschlagen — URL prüfen (läuft n8n?).')
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="flex items-center gap-2 font-display text-3xl uppercase tracking-wide">
          <Zap className="h-7 w-7 text-primary" /> Automationen
        </h1>
        <p className="mt-1 text-muted-foreground">
          Andockpunkte für den n8n-Server (Jonas). URL aus n8n einfügen, Test senden, fertig —
          die echte Auslösung übernimmt Supabase (Database Webhooks) bzw. der n8n-Cron.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {HOOKS.map((h) => {
          const configured = !!urls[h.event]?.trim()
          return (
            <Card key={h.event}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  <span>{h.titel}</span>
                  {configured ? (
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
                      value={urls[h.event] ?? ''}
                      onChange={(e) => save(h.event, e.target.value)}
                    />
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

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Einrichtung in Supabase (einmalig, ~5 Minuten)</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          <ol className="list-decimal space-y-1 pl-5">
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
