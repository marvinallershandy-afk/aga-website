import { useMemo, useState } from 'react'
import { Plus, RefreshCw, BarChart3, Trash2, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Select } from '../components/ui/select'
import { Modal } from '../components/ui/modal'
import { Sparkline } from '../components/ui/sparkline'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import type { InsightRow } from '../lib/db'
import { useInsights, useInsightsMutations } from '../lib/queries'
import { kanalLabel } from '../lib/constants'
import { KanalIcons } from '../components/ui/status'
import { toISODate, formatDateShort } from '../lib/format'
import { cn } from '../lib/utils'

// KPI-Kanäle (WhatsApp/Website haben keine Follower-Metrik)
const KPI_KANAELE = ['instagram', 'tiktok', 'facebook'] as const

export function Insights() {
  const toast = useToast()
  const confirm = useConfirm()
  const insightsQ = useInsights()
  const { upsert, remove } = useInsightsMutations()
  const rows = insightsQ.data ?? []
  const [editorOpen, setEditorOpen] = useState(false)

  // Pro Kanal: chronologische Reihe + aktueller Stand + Delta zur Vorwoche
  const proKanal = useMemo(
    () =>
      KPI_KANAELE.map((k) => {
        const serie = rows.filter((r) => r.kanal === k && r.follower != null)
        const aktuell = serie.at(-1) ?? null
        const vorher = serie.at(-2) ?? null
        const delta =
          aktuell?.follower != null && vorher?.follower != null
            ? aktuell.follower - vorher.follower
            : null
        return { kanal: k, serie, aktuell, delta }
      }),
    [rows],
  )

  const handleDelete = async (row: InsightRow) => {
    const ok = await confirm({
      title: 'Eintrag löschen?',
      description: `${kanalLabel(row.kanal)} vom ${formatDateShort(row.datum)} wird entfernt.`,
      confirmLabel: 'Löschen',
      destructive: true,
    })
    if (!ok) return
    remove.mutate(row.id, {
      onSuccess: () => toast.success('Eintrag gelöscht.'),
      onError: (e) => toast.error(e instanceof Error ? e.message : 'Löschen fehlgeschlagen.'),
    })
  }

  const neueste = [...rows].reverse()

  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Follower & Reichweite im Blick — einmal pro Woche eintragen, Trends ablesen."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => void insightsQ.refetch()} aria-label="Neu laden">
              <RefreshCw className={cn('h-4 w-4', insightsQ.isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={() => setEditorOpen(true)}>
              <Plus className="h-4 w-4" /> KPIs eintragen
            </Button>
          </div>
        }
      />

      {insightsQ.error && !insightsQ.isPending && (
        <ErrorState className="mb-4" message={insightsQ.error.message} onRetry={() => void insightsQ.refetch()} />
      )}

      {insightsQ.isPending ? (
        <SkeletonRows rows={4} />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={BarChart3}
          title="Noch keine Kennzahlen"
          description="Trage einmal pro Woche Follower & Reichweite je Kanal ein (Zahlen stehen in den Instagram-/TikTok-Insights) — ab dem zweiten Eintrag entstehen Trends."
          action={
            <Button onClick={() => setEditorOpen(true)}>
              <Plus className="h-4 w-4" /> Ersten Eintrag anlegen
            </Button>
          }
        />
      ) : (
        <>
          {/* Kanal-KPIs */}
          <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {proKanal.map(({ kanal, serie, aktuell, delta }) => (
              <Card key={kanal}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <KanalIcons kanaele={[kanal]} />
                    <span className="text-sm font-medium">{kanalLabel(kanal)}</span>
                    {delta != null && (
                      <span
                        className={cn(
                          'ml-auto inline-flex items-center gap-1 text-xs font-semibold',
                          delta > 0 ? 'text-green-500' : delta < 0 ? 'text-primary' : 'text-muted-foreground',
                        )}
                      >
                        {delta > 0 ? (
                          <TrendingUp className="h-3.5 w-3.5" />
                        ) : delta < 0 ? (
                          <TrendingDown className="h-3.5 w-3.5" />
                        ) : (
                          <Minus className="h-3.5 w-3.5" />
                        )}
                        {delta > 0 ? `+${delta}` : delta}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-end justify-between gap-2">
                    <div>
                      <p className="font-display text-2xl leading-none tabular-nums">
                        {aktuell?.follower != null ? aktuell.follower.toLocaleString('de-DE') : '—'}
                      </p>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        Follower{aktuell ? ` · Stand ${formatDateShort(aktuell.datum)}` : ''}
                      </p>
                    </div>
                    <Sparkline values={serie.slice(-8).map((r) => r.follower ?? 0)} />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Verlauf */}
          <h2 className="mb-2 font-display text-lg tracking-wide">Verlauf</h2>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b border-border bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Datum</th>
                  <th className="px-3 py-2 font-medium">Kanal</th>
                  <th className="px-3 py-2 font-medium">Follower</th>
                  <th className="px-3 py-2 font-medium">Reichweite (7 Tage)</th>
                  <th className="px-3 py-2 font-medium">Top-Beitrag</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {neueste.map((r) => (
                  <tr key={r.id} className="border-b border-border/60 last:border-0 hover:bg-accent/40">
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateShort(r.datum)}</td>
                    <td className="px-3 py-2">{kanalLabel(r.kanal)}</td>
                    <td className="px-3 py-2 tabular-nums">{r.follower?.toLocaleString('de-DE') ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{r.reichweite?.toLocaleString('de-DE') ?? '—'}</td>
                    <td className="max-w-[260px] truncate px-3 py-2 text-muted-foreground">{r.top_beitrag ?? '—'}</td>
                    <td className="px-3 py-2 text-right">
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(r)} aria-label="Löschen">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <InsightEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={async (input) => {
          await upsert.mutateAsync(input)
          toast.success('KPIs gespeichert.')
        }}
      />
    </>
  )
}

function InsightEditor({
  open,
  onClose,
  onSave,
}: {
  open: boolean
  onClose: () => void
  onSave: (input: {
    datum: string
    kanal: string
    follower: number | null
    reichweite: number | null
    top_beitrag: string | null
  }) => Promise<void>
}) {
  const [datum, setDatum] = useState(() => toISODate(new Date()))
  const [kanal, setKanal] = useState<string>('instagram')
  const [follower, setFollower] = useState('')
  const [reichweite, setReichweite] = useState('')
  const [topBeitrag, setTopBeitrag] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!datum) {
      setError('Datum ist erforderlich.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave({
        datum,
        kanal,
        follower: follower !== '' ? Number(follower) : null,
        reichweite: reichweite !== '' ? Number(reichweite) : null,
        top_beitrag: topBeitrag.trim() || null,
      })
      setFollower('')
      setReichweite('')
      setTopBeitrag('')
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Speichern fehlgeschlagen.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="KPIs eintragen"
      description="Gleiches Datum + Kanal überschreibt den bestehenden Eintrag."
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Abbrechen
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Speichern…' : 'Speichern'}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="in-datum">Stichtag</Label>
          <Input id="in-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="in-kanal">Kanal</Label>
          <Select id="in-kanal" value={kanal} onChange={(e) => setKanal(e.target.value)}>
            {KPI_KANAELE.map((k) => (
              <option key={k} value={k}>
                {kanalLabel(k)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="in-follower">Follower</Label>
          <Input
            id="in-follower"
            type="number"
            min={0}
            value={follower}
            onChange={(e) => setFollower(e.target.value)}
            placeholder="z. B. 412"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="in-reichweite">Reichweite (7 Tage)</Label>
          <Input
            id="in-reichweite"
            type="number"
            min={0}
            value={reichweite}
            onChange={(e) => setReichweite(e.target.value)}
            placeholder="z. B. 2600"
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="in-top">Top-Beitrag (optional)</Label>
        <Textarea
          id="in-top"
          rows={2}
          value={topBeitrag}
          onChange={(e) => setTopBeitrag(e.target.value)}
          placeholder="Welcher Beitrag lief am besten? Titel oder Link"
        />
      </div>

      {error && <p className="text-sm text-primary">{error}</p>}
    </Modal>
  )
}
