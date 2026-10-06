import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, UserPlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { useToast } from './ui/toast'

// ─────────────────────────────────────────────────────────────
// v23-U: „Bei FuPa im Kader, aber nicht auf der Website". Daten aus
// sva_admin_fupa_fehlende (füllt der fupa-sync-Bot in sva_fupa_kader).
// „Als Spieler anlegen" legt einen Platzhalter-Spieler ohne Foto an
// (sva_admin_fupa_spieler_anlegen) und verknüpft die FuPa-ID.
// Zeigt nichts, wenn alles zugeordnet ist oder die Migration noch fehlt.
// ─────────────────────────────────────────────────────────────

interface Fehlend {
  fupaId: number
  name: string
  nummer?: number | null
  spiele?: number
  tore?: number
  vorlagen?: number
}

export function FupaFehlende() {
  const toast = useToast()
  const qc = useQueryClient()
  const [busy, setBusy] = useState<number | null>(null)

  const q = useQuery({
    queryKey: ['sva_admin_fupa_fehlende'],
    queryFn: async (): Promise<Fehlend[]> => {
      const { data, error } = await supabase.rpc('sva_admin_fupa_fehlende')
      if (error) throw error
      return (data as unknown as Fehlend[]) ?? []
    },
    retry: false,
    // Vor der Migration fehlt die RPC → still nichts anzeigen.
    throwOnError: false,
  })

  const fehlende = q.data ?? []
  if (fehlende.length === 0) return null

  const anlegen = async (f: Fehlend) => {
    setBusy(f.fupaId)
    try {
      const { error } = await supabase.rpc('sva_admin_fupa_spieler_anlegen', { p_fupa: f.fupaId })
      if (error) throw error
      toast.success(`${f.name} angelegt (Platzhalter-Karte — Foto kannst du später ergänzen).`)
      await qc.invalidateQueries({ queryKey: ['sm_roster'] })
      await qc.invalidateQueries({ queryKey: ['sva_admin_fupa_fehlende'] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Anlegen fehlgeschlagen.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="mb-4 rounded-lg border border-sky-500/40 bg-sky-500/5 p-3">
      <p className="mb-2 text-sm font-semibold text-sky-300">
        Bei FuPa im Kader, aber nicht auf der Website:
      </p>
      <ul className="space-y-2">
        {fehlende.map((f) => (
          <li key={f.fupaId} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card px-3 py-2">
            <span className="text-sm">
              {f.nummer != null && <span className="mr-1 text-muted-foreground">#{f.nummer}</span>}
              <b>{f.name}</b>
              {(f.spiele ?? 0) > 0 && <span className="ml-2 text-xs text-muted-foreground">{f.spiele} Spiele{f.tore ? ` · ${f.tore} Tore` : ''}</span>}
            </span>
            <Button size="sm" variant="outline" disabled={busy === f.fupaId} onClick={() => void anlegen(f)}>
              {busy === f.fupaId ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Als Spieler anlegen
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-muted-foreground">Legt einen Platzhalter-Spieler ohne Foto an und verknüpft die FuPa-ID — Foto und Position kannst du danach bearbeiten.</p>
    </div>
  )
}
