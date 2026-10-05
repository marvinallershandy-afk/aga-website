import { useEffect, useMemo, useState } from 'react'
import { Handshake, Inbox, Mail, Phone, Trash2 } from 'lucide-react'
import { Button } from '../../components/ui/button'
import { Textarea } from '../../components/ui/textarea'
import { SkeletonRows } from '../../components/ui/skeleton'
import { EmptyState } from '../../components/ui/empty-state'
import { ErrorState } from '../../components/ui/error-state'
import { useToast } from '../../components/ui/toast'
import { useConfirm } from '../../components/ui/confirm'
import { PflegeHinweis } from '../../components/PflegeHinweis'
import { friendlyError, isMissingSchema } from '../../lib/db'
import { relativZeit } from '../../lib/format'
import { ANFRAGE_STATUS, useAnfragen, useAnfragenMutations, type AnfrageRow, type AnfrageStatus } from '../../lib/partner'
import { cn } from '../../lib/utils'

// ─────────────────────────────────────────────────────────────
// v16-S: Eingang der Anfragen von /partner. Status neu → in Kontakt →
// gewonnen/abgelehnt, Notiz pro Anfrage. „Gewonnen“ → als Sponsor anlegen.
// Aufräumen passiert automatisch (siehe Datenschutz 7a): abgelehnt nach
// 6 Monaten, unbearbeitet nach 12 Monaten.
// ─────────────────────────────────────────────────────────────

type Filter = 'offen' | 'alle'

export function AnfragenTab({ onAlsSponsor }: { onAlsSponsor: (a: AnfrageRow) => void }) {
  const q = useAnfragen()
  const [filter, setFilter] = useState<Filter>('offen')
  const rows = useMemo(() => q.data ?? [], [q.data])
  const sichtbar = filter === 'offen' ? rows.filter((r) => r.status === 'neu' || r.status === 'in_kontakt') : rows
  const zahl = (s: AnfrageStatus) => rows.filter((r) => r.status === s).length

  if (q.error && isMissingSchema(q.error)) {
    return <PflegeHinweis schema title="Anfragen brauchen die Partner-Migration">Marvin wendet einmalig <code>20261006100000_sva_partner.sql</code> an (docs/PARTNER.md). Bis dahin zeigt /partner im Formular „direkt per E-Mail/WhatsApp“.</PflegeHinweis>
  }

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(['offen', 'alle'] as Filter[]).map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={cn('min-h-10 rounded-full border px-4 text-sm font-medium', filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-muted-foreground hover:text-foreground')}
          >
            {f === 'offen' ? `Offen (${zahl('neu') + zahl('in_kontakt')})` : `Alle (${rows.length})`}
          </button>
        ))}
        <span className="ml-auto text-xs text-muted-foreground">
          {zahl('gewonnen')} gewonnen · {zahl('abgelehnt')} abgelehnt
        </span>
      </div>
      {q.error && !q.isPending && <ErrorState className="mb-4" message={friendlyError(q.error)} onRetry={() => void q.refetch()} />}
      {q.isPending ? (
        <SkeletonRows rows={3} />
      ) : sichtbar.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={rows.length ? 'Alles bearbeitet' : 'Noch keine Anfragen'}
          description={rows.length ? 'Keine offenen Anfragen. Stark!' : 'Teile /partner in der Instagram-Bio und in Stories — Anfragen landen hier.'}
        />
      ) : (
        <ul className="space-y-3">
          {sichtbar.map((a) => (
            <AnfrageKarte key={a.id} a={a} onAlsSponsor={onAlsSponsor} />
          ))}
        </ul>
      )}
    </>
  )
}

function AnfrageKarte({ a, onAlsSponsor }: { a: AnfrageRow; onAlsSponsor: (a: AnfrageRow) => void }) {
  const toast = useToast()
  const confirm = useConfirm()
  const { update, remove } = useAnfragenMutations()
  const [notiz, setNotiz] = useState(a.notiz ?? '')
  useEffect(() => setNotiz(a.notiz ?? ''), [a.notiz])
  const status = ANFRAGE_STATUS.find((s) => s.value === a.status) ?? ANFRAGE_STATUS[0]

  const setze = (patch: { status?: AnfrageStatus; notiz?: string | null }) =>
    update.mutate({ id: a.id, patch }, { onError: (e) => toast.error(friendlyError(e)) })

  const nachricht = (a.nachricht ?? '').trim()
  return (
    <li className={cn('rounded-lg border bg-card p-4', a.status === 'neu' ? 'border-primary/60' : 'border-border')}>
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: status.dot }} aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl leading-tight tracking-wide">{a.firma}</p>
          <p className="text-sm text-muted-foreground">
            {a.ansprechpartner} · {relativZeit(a.created_at)}
            {a.quelle ? ` · über ${a.quelle}` : ''}
          </p>
        </div>
        {a.paket_name && <span className="rounded bg-secondary px-2 py-1 text-xs font-medium">{a.paket_name}</span>}
      </div>
      {nachricht && <p className="mt-3 whitespace-pre-wrap rounded-md bg-muted/30 px-3 py-2 text-sm">{nachricht}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button asChild variant="secondary" size="sm" className="min-h-10">
          <a href={`mailto:${a.email}?subject=${encodeURIComponent('Deine Partner-Anfrage beim SV Agathenburg-Dollern')}`}>
            <Mail className="h-4 w-4" /> {a.email}
          </a>
        </Button>
        {a.telefon && (
          <Button asChild variant="secondary" size="sm" className="min-h-10">
            <a href={`tel:${a.telefon.replace(/[^\d+]/g, '')}`}>
              <Phone className="h-4 w-4" /> {a.telefon}
            </a>
          </Button>
        )}
      </div>
      <div role="radiogroup" aria-label={`Status ${a.firma}`} className="mt-3 grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {ANFRAGE_STATUS.map((s) => (
          <button
            key={s.value}
            type="button"
            role="radio"
            aria-checked={a.status === s.value}
            onClick={() => a.status !== s.value && setze({ status: s.value })}
            className={cn(
              'flex min-h-10 items-center justify-center gap-1.5 rounded-md border px-2 text-sm',
              a.status === s.value ? 'border-foreground/40 bg-accent font-semibold text-foreground' : 'border-border text-muted-foreground hover:text-foreground',
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.dot }} aria-hidden /> {s.label}
          </button>
        ))}
      </div>
      <Textarea
        aria-label={`Notiz zu ${a.firma}`}
        className="mt-3 min-h-[64px]"
        value={notiz}
        maxLength={4000}
        placeholder="Notiz, z. B. „Rückruf Mi 18 Uhr, will Bande + Story“"
        onChange={(e) => setNotiz(e.target.value)}
        onBlur={() => {
          if ((a.notiz ?? '') !== notiz) setze({ notiz: notiz.trim() || null })
        }}
      />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {a.status === 'gewonnen' && (
          <Button size="sm" className="min-h-10" onClick={() => onAlsSponsor(a)}>
            <Handshake className="h-4 w-4" /> Als Sponsor anlegen
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="ml-auto min-h-10 text-muted-foreground"
          onClick={async () => {
            const ok = await confirm({ title: `Anfrage von ${a.firma} löschen?`, description: 'Die Kontaktdaten werden endgültig entfernt (z. B. auf Wunsch der Person).', confirmLabel: 'Löschen', destructive: true })
            if (ok) remove.mutate(a.id, { onSuccess: () => toast.success('Anfrage gelöscht.'), onError: (e) => toast.error(friendlyError(e)) })
          }}
        >
          <Trash2 className="h-4 w-4" /> Löschen
        </Button>
      </div>
    </li>
  )
}
