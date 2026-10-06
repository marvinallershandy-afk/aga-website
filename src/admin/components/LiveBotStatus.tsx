import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Radio, RefreshCw, AlertTriangle, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Button } from './ui/button'
import { useToast } from './ui/toast'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v23-L: Bot-Status im Ticker-Pult. Zeigt nur etwas, wenn der FuPa-Live-Bot
// aktiv ist (Modus 'an') und das Spiel eine FuPa-ID hat. Quelle umschalten
// (Auto/FuPa/Selbst tickern), rotes „FuPa schweigt"-Banner, „Jetzt abrufen".
// ─────────────────────────────────────────────────────────────

interface LiveStatus {
  modus: string
  quelleEffektiv: 'fupa' | 'pult'
  quelleEingestellt: 'auto' | 'fupa' | 'pult'
  hatFupaId: boolean
  section?: string | null
  tickerTyp?: string | null
  fehler?: string | null
  fehlerSerie?: number
  fupaToreSva?: number | null
  fupaToreGegner?: number | null
  unsereToreSva?: number | null
  unsereToreGegner?: number | null
  sekundenSeitEreignis?: number | null
  unzugeordnet?: number
}

export function LiveBotStatus({ spielId, istLive, onPruefen }: { spielId: string; istLive: boolean; onPruefen?: () => void }) {
  const toast = useToast()
  const qc = useQueryClient()
  const [letzterAbruf, setLetzterAbruf] = useState(0)
  const [laedt, setLaedt] = useState(false)

  const q = useQuery({
    queryKey: ['sva_admin_live_status', spielId],
    queryFn: async (): Promise<LiveStatus | null> => {
      const { data, error } = await supabase.rpc('sva_admin_live_status', { p_spiel: spielId })
      if (error) throw error
      return data as unknown as LiveStatus
    },
    refetchInterval: istLive ? 15_000 : false,
    retry: false,
  })

  const s = q.data
  if (!s || s.modus !== 'an' || !s.hatFupaId) return null

  const setzen = async (quelle: 'auto' | 'fupa' | 'pult') => {
    try {
      const { error } = await supabase.rpc('sva_admin_live_quelle', { p_spiel: spielId, p_quelle: quelle })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['sva_admin_live_status', spielId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Umschalten fehlgeschlagen.')
    }
  }

  const jetztAbrufen = async () => {
    if (Date.now() - letzterAbruf < 20_000) return toast.info('Bitte 20 Sekunden warten.')
    setLetzterAbruf(Date.now())
    setLaedt(true)
    try {
      const { error } = await supabase.functions.invoke('fupa-live', { body: { aufgabe: 'spiel', spiel_id: spielId } })
      if (error) throw error
      await qc.invalidateQueries({ queryKey: ['sva_admin_live_status', spielId] })
      await qc.invalidateQueries({ queryKey: ['sva_ticker', spielId] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Abruf fehlgeschlagen.')
    } finally {
      setLaedt(false)
    }
  }

  const sek = s.sekundenSeitEreignis ?? null
  const schweigt = istLive && s.quelleEffektiv === 'fupa' && ((sek != null && sek > 600) || (s.fehlerSerie ?? 0) >= 5 || !!s.fehler)
  const standAbweichung = s.quelleEffektiv === 'fupa' && s.fupaToreSva != null
    && (s.fupaToreSva !== (s.unsereToreSva ?? 0) || (s.fupaToreGegner ?? 0) !== (s.unsereToreGegner ?? 0))
  const soft = s.quelleEffektiv === 'fupa' && s.tickerTyp === 'soft'

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2 text-sm font-semibold"><Radio className="h-4 w-4 text-sky-400" /> Quelle</span>
        <div className="flex overflow-hidden rounded-md border border-border text-xs">
          {(['auto', 'fupa', 'pult'] as const).map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => void setzen(opt)}
              className={cn('px-2.5 py-1.5 font-medium', s.quelleEingestellt === opt ? 'bg-primary text-white' : 'bg-secondary text-muted-foreground')}
            >
              {opt === 'auto' ? 'Auto' : opt === 'fupa' ? 'FuPa' : 'Selbst tickern'}
            </button>
          ))}
        </div>
      </div>

      {schweigt ? (
        <div className="rounded-md bg-primary/10 p-2.5 text-sm">
          <p className="flex items-center gap-1.5 font-semibold text-primary"><AlertTriangle className="h-4 w-4" />
            {s.fehler ? 'FuPa nicht erreichbar' : `FuPa liefert seit ${sek ? Math.round(sek / 60) : '?'} min nichts`}
          </p>
          <Button className="mt-2 h-10 w-full" onClick={() => void setzen('pult')}>Selbst tickern</Button>
        </div>
      ) : (
        <p className={cn('text-sm', soft ? 'text-sva-gold' : s.quelleEffektiv === 'fupa' ? 'text-green-400' : 'text-muted-foreground')}>
          {s.quelleEffektiv === 'fupa'
            ? soft
              ? 'FuPa: nur Spielstand (Soft-Ticker) — Torschützen bitte hier eintragen.'
              : `FuPa läuft${sek != null ? ` · letzter Eintrag vor ${Math.max(0, Math.round(sek / 60))} min` : ''}${s.fupaToreSva != null ? ` · FuPa-Stand ${s.fupaToreSva}:${s.fupaToreGegner ?? 0}` : ''}`
            : 'Selbst tickern (Pult). Der Bot schreibt nicht.'}
        </p>
      )}

      {standAbweichung && (
        <p className="flex items-center justify-between gap-2 text-xs text-sva-gold">
          <span>FuPa sagt {s.fupaToreSva}:{s.fupaToreGegner ?? 0}, wir zählen {s.unsereToreSva ?? 0}:{s.unsereToreGegner ?? 0}.</span>
          {onPruefen && <button type="button" className="underline" onClick={onPruefen}>Prüfen</button>}
        </p>
      )}
      {!!s.unzugeordnet && s.unzugeordnet > 0 && (
        <p className="text-xs text-sva-gold">{s.unzugeordnet} FuPa-Spieler ohne Kader-Zuordnung — in „Kader" zuordnen.</p>
      )}

      <Button variant="outline" className="h-9 w-full text-sm" onClick={() => void jetztAbrufen()} disabled={laedt}>
        {laedt ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Jetzt abrufen
      </Button>
    </div>
  )
}
