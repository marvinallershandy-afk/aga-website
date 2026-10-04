import { useState } from 'react'
import { Rocket, Loader2, CheckCircle2, Info } from 'lucide-react'
import { Button } from './ui/button'
import { useToast } from './ui/toast'
import { usePublish } from '../lib/queries'
import type { PublishResult } from '../lib/pflege'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v14-C: „Website veröffentlichen“. Ein Klick → Edge Function publish-site →
// Netlify baut die Seite neu (2–4 Minuten) und holt dabei den aktuellen Stand.
// Ohne eingerichtete Function: verständlicher Hinweis statt Fehlermeldung.
// ─────────────────────────────────────────────────────────────

export function describePublish(r: PublishResult): string {
  switch (r.kind) {
    case 'gestartet':
      return 'Läuft! In etwa 2–4 Minuten ist die Website aktuell.'
    case 'warten':
      return `Gerade eben schon gestartet — bitte ${r.sekunden} Sekunden warten.`
    case 'nicht-eingerichtet':
      return `${r.grund} Deine Änderungen sind gespeichert und erscheinen beim nächsten Veröffentlichen.`
    case 'fehler':
      return r.meldung
  }
}

export function PublishButton({
  size = 'lg',
  className,
  onResult,
}: {
  size?: 'lg' | 'compact'
  className?: string
  onResult?: (r: PublishResult) => void
}) {
  const toast = useToast()
  const publish = usePublish()
  const [last, setLast] = useState<PublishResult | null>(null)

  const run = () => {
    publish.mutate(undefined, {
      onSuccess: (r) => {
        setLast(r)
        onResult?.(r)
        const text = describePublish(r)
        if (r.kind === 'gestartet') toast.success(text)
        else if (r.kind === 'fehler') toast.error(text)
        else toast.info(text)
      },
    })
  }

  const busy = publish.isPending
  const started = last?.kind === 'gestartet'

  if (size === 'compact') {
    return (
      <Button onClick={run} disabled={busy} className={cn('w-full', className)} aria-label="Website veröffentlichen">
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : started ? <CheckCircle2 className="h-4 w-4" /> : <Rocket className="h-4 w-4" />}
        {busy ? 'Wird gestartet …' : 'Veröffentlichen'}
      </Button>
    )
  }

  return (
    <div className={cn('space-y-2', className)}>
      <Button
        onClick={run}
        disabled={busy}
        className="h-14 w-full text-base sm:w-auto sm:px-8"
        aria-label="Website veröffentlichen"
      >
        {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Rocket className="h-5 w-5" />}
        {busy ? 'Wird gestartet …' : 'Website veröffentlichen'}
      </Button>
      {last && (
        <p
          role="status"
          className={cn(
            'flex items-start gap-2 text-sm',
            last.kind === 'gestartet' && 'text-green-400',
            last.kind === 'fehler' && 'text-primary',
            (last.kind === 'warten' || last.kind === 'nicht-eingerichtet') && 'text-sva-gold',
          )}
        >
          {last.kind === 'gestartet' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
          {describePublish(last)}
        </p>
      )}
    </div>
  )
}
