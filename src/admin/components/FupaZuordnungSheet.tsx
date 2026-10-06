import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Select } from './ui/select'
import { useToast } from './ui/toast'
import type { RosterRow } from '../lib/db'

// ─────────────────────────────────────────────────────────────
// v23-U: FuPa-Spieler ohne Kader-Zuordnung in einem Tipp zuordnen.
// Daten aus sva_admin_fupa_kandidaten (Name, Nummer, Namensvorschlag), ein Tipp
// ordnet per sva_admin_fupa_zuordnung zu. Genutzt im Ticker-Pult und im Kader.
// ─────────────────────────────────────────────────────────────

interface Kandidat {
  fupaId?: number | null
  name: string
  nummer?: number | null
  vorschlag?: string | null // Slug
  vorschlagId?: string | null // Roster-UUID
}

const sheetCls = 'max-sm:top-auto max-sm:bottom-0 max-sm:max-h-[88dvh] max-sm:w-full max-sm:translate-y-0 max-sm:rounded-b-none'

export function FupaZuordnungSheet({ spielId, open, onClose, roster }: { spielId: string; open: boolean; onClose: () => void; roster: RosterRow[] }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<string | null>(null)
  const spieler = useMemo(
    () => roster.filter((r) => r.aktiv && (r.rolle ?? 'spieler') === 'spieler').sort((a, b) => (a.nummer ?? 999) - (b.nummer ?? 999)),
    [roster],
  )

  const q = useQuery({
    queryKey: ['sva_admin_fupa_kandidaten', spielId],
    queryFn: async (): Promise<Kandidat[]> => {
      const { data, error } = await supabase.rpc('sva_admin_fupa_kandidaten', { p_spiel: spielId })
      if (error) throw error
      return (data as unknown as Kandidat[]) ?? []
    },
    enabled: open,
    retry: false,
  })

  const zuordnen = async (fupaId: number | null | undefined, rosterId: string | null) => {
    if (!fupaId || !rosterId) return toast.info('Bitte einen Spieler wählen.')
    setBusy(`${fupaId}`)
    try {
      const { error } = await supabase.rpc('sva_admin_fupa_zuordnung', { p_roster: rosterId, p_fupa: fupaId })
      if (error) throw error
      toast.success('Zugeordnet. Beim nächsten Abruf übernimmt der Bot den Namen.')
      await qc.invalidateQueries({ queryKey: ['sva_admin_fupa_kandidaten', spielId] })
      await qc.invalidateQueries({ queryKey: ['sva_admin_live_status', spielId] })
      await qc.invalidateQueries({ queryKey: ['sva_ticker', spielId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Zuordnen fehlgeschlagen.')
    } finally {
      setBusy(null)
    }
  }

  const kandidaten = (q.data ?? []).filter((k) => k.fupaId != null)

  return (
    <Modal open={open} onClose={onClose} title="FuPa-Spieler zuordnen" description="Diese FuPa-Spieler kennt die Website noch nicht. Ordne sie einem Kader-Spieler zu — der Vorschlag passt meist schon." className={sheetCls}>
      {q.isPending ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> lädt …</p>
      ) : kandidaten.length === 0 ? (
        <p className="text-sm text-muted-foreground">Alles zugeordnet. 👍</p>
      ) : (
        <ul className="space-y-3">
          {kandidaten.map((k) => (
            <KandidatZeile key={k.fupaId} k={k} spieler={spieler} busy={busy === `${k.fupaId}`} onZuordnen={(rid) => void zuordnen(k.fupaId, rid)} />
          ))}
        </ul>
      )}
    </Modal>
  )
}

function KandidatZeile({ k, spieler, busy, onZuordnen }: { k: Kandidat; spieler: RosterRow[]; busy: boolean; onZuordnen: (rosterId: string) => void }) {
  const [wahl, setWahl] = useState<string>(k.vorschlagId ?? '')
  return (
    <li className="rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">
          {k.nummer != null && <span className="mr-1 text-muted-foreground">#{k.nummer}</span>}
          {k.name}
        </span>
        <span className="rounded bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-sky-400">FuPa</span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Select aria-label={`Kader-Spieler für ${k.name}`} className="h-10 flex-1" value={wahl} onChange={(e) => setWahl(e.target.value)}>
          <option value="">— Kader-Spieler wählen —</option>
          {spieler.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nummer != null ? `#${s.nummer} ` : ''}
              {s.name}
            </option>
          ))}
        </Select>
        <Button className="h-10 shrink-0" disabled={!wahl || busy} onClick={() => wahl && onZuordnen(wahl)}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Zuordnen
        </Button>
      </div>
    </li>
  )
}
