import { useMemo, useState } from 'react'
import {
  Plus,
  RefreshCw,
  Handshake,
  Pencil,
  CalendarPlus,
  AlarmClock,
  Mail,
} from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Card, CardContent } from '../components/ui/card'
import { SkeletonRows } from '../components/ui/skeleton'
import { EmptyState } from '../components/ui/empty-state'
import { ErrorState } from '../components/ui/error-state'
import { useToast } from '../components/ui/toast'
import { SponsorEditor } from '../components/SponsorEditor'
import type { SponsorInput, SponsorRow } from '../lib/db'
import { useContentMutations, useSponsoren, useSponsorenMutations } from '../lib/queries'
import { paketMeta } from '../lib/constants'
import { toISODate, formatDateShort, tageBis } from '../lib/format'
import { cn } from '../lib/utils'

export function Sponsoren() {
  const toast = useToast()
  const sponsorenQ = useSponsoren()
  const { create, update, remove } = useSponsorenMutations()
  const { create: createContent } = useContentMutations()
  const sponsoren = sponsorenQ.data ?? []
  const [editorOpen, setEditorOpen] = useState(false)
  const [editRow, setEditRow] = useState<SponsorRow | null>(null)

  const auslaufend = useMemo(
    () =>
      sponsoren.filter((s) => {
        const t = tageBis(s.laufzeit_bis)
        return s.aktiv && t != null && t <= 60
      }),
    [sponsoren],
  )

  const handleSave = async (input: SponsorInput, id?: string) => {
    if (id) await update.mutateAsync({ id, patch: input })
    else await create.mutateAsync(input)
  }
  const handleDelete = async (id: string) => {
    await remove.mutateAsync(id)
  }

  // Sponsor-des-Monats-Beitrag direkt aus dem CRM in den Plan legen.
  const sdmPlanen = (row: SponsorRow) => {
    createContent.mutate(
      {
        titel: `Sponsor des Monats: ${row.name}`,
        beschreibung: row.leistungen ? `Leistungen: ${row.leistungen}` : 'Partner vorstellen, Danke sagen.',
        kanal: ['instagram', 'facebook'],
        status: 'geplant',
        format: 'Post',
        kategorie: 'Sponsoren',
        geplant_am: toISODate(new Date()),
      },
      {
        onSuccess: () => toast.success(`„Sponsor des Monats: ${row.name}" im Plan angelegt.`),
        onError: (e) => toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.'),
      },
    )
  }

  const openNew = () => {
    setEditRow(null)
    setEditorOpen(true)
  }

  return (
    <>
      <PageHeader
        title="Sponsoren-CRM"
        subtitle="Pakete, Laufzeiten, Leistungen — und der direkte Weg in den Redaktionsplan."
        actions={
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => void sponsorenQ.refetch()} aria-label="Neu laden">
              <RefreshCw className={cn('h-4 w-4', sponsorenQ.isFetching && 'animate-spin')} />
            </Button>
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Neuer Sponsor
            </Button>
          </div>
        }
      />

      {auslaufend.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-sva-gold/40 bg-sva-gold/10 px-3 py-2.5 text-sm">
          <AlarmClock className="mt-0.5 h-4 w-4 shrink-0 text-sva-gold" />
          <div>
            <b>Verträge laufen aus:</b>{' '}
            {auslaufend.map((s) => `${s.name} (${formatDateShort(s.laufzeit_bis)})`).join(', ')} —
            rechtzeitig das Verlängerungsgespräch planen.
          </div>
        </div>
      )}

      {sponsorenQ.error && !sponsorenQ.isPending && (
        <ErrorState className="mb-4" message={sponsorenQ.error.message} onRetry={() => void sponsorenQ.refetch()} />
      )}

      {sponsorenQ.isPending ? (
        <SkeletonRows rows={4} />
      ) : sponsoren.length === 0 ? (
        <EmptyState
          icon={Handshake}
          title="Noch keine Sponsoren erfasst"
          description="Lege Partner mit Paket und Laufzeit an — das Cockpit erinnert vor Vertragsende und plant Danke-Posts."
          action={
            <Button onClick={openNew}>
              <Plus className="h-4 w-4" /> Neuer Sponsor
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sponsoren.map((s) => {
            const paket = paketMeta(s.paket)
            const tage = tageBis(s.laufzeit_bis)
            const warnung = s.aktiv && tage != null && tage <= 60
            return (
              <Card key={s.id} className={cn('flex flex-col', !s.aktiv && 'opacity-55')}>
                <CardContent className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2.5">
                      {s.logo_url ? (
                        <img
                          src={s.logo_url}
                          alt=""
                          className="h-9 w-9 shrink-0 rounded-md border border-border bg-white object-contain p-0.5"
                          loading="lazy"
                        />
                      ) : (
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted font-display text-primary">
                          {s.name.slice(0, 1).toUpperCase()}
                        </div>
                      )}
                      <h3 className="truncate font-display text-lg leading-tight tracking-wide">{s.name}</h3>
                    </div>
                    {paket && (
                      <span
                        className="shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-semibold"
                        style={{ borderColor: `${paket.color}66`, backgroundColor: `${paket.color}22`, color: paket.color }}
                      >
                        {paket.label}
                      </span>
                    )}
                  </div>

                  <div className="space-y-1 text-sm text-muted-foreground">
                    {(s.laufzeit_von || s.laufzeit_bis) && (
                      <p className={cn(warnung && 'text-sva-gold')}>
                        {warnung && <AlarmClock className="mr-1 inline h-3.5 w-3.5" />}
                        Laufzeit: {formatDateShort(s.laufzeit_von)} – {formatDateShort(s.laufzeit_bis)}
                        {warnung && tage != null && ` · endet in ${tage} Tagen`}
                      </p>
                    )}
                    {s.leistungen && <p className="line-clamp-2">{s.leistungen}</p>}
                    {(s.ansprechpartner || s.kontakt) && (
                      <p className="flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5" />
                        {[s.ansprechpartner, s.kontakt].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </div>

                  {!s.aktiv && (
                    <Badge variant="outline" className="w-fit">
                      inaktiv
                    </Badge>
                  )}

                  <div className="mt-auto flex gap-2 pt-2">
                    <Button size="sm" variant="secondary" className="flex-1" onClick={() => sdmPlanen(s)}>
                      <CalendarPlus className="h-4 w-4" /> Sponsor des Monats
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setEditRow(s)
                        setEditorOpen(true)
                      }}
                      aria-label="Bearbeiten"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      <SponsorEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        onSave={handleSave}
        onDelete={handleDelete}
        row={editRow}
      />
    </>
  )
}
