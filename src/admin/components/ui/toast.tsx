import * as React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'

// Leichtgewichtiges Toast-System (kein Radix) — Provider + useToast-Hook + Toaster-Stack.
// Feedback für Speichern/Löschen/Fehler, oben rechts, auto-dismiss.

type ToastVariant = 'success' | 'error' | 'info'
interface ToastItem {
  id: number
  message: string
  variant: ToastVariant
}

interface ToastCtx {
  toast: (message: string, variant?: ToastVariant) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const Ctx = React.createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const ctx = React.useContext(Ctx)
  if (!ctx) throw new Error('useToast muss innerhalb von <ToastProvider> genutzt werden.')
  return ctx
}

let counter = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = React.useState<ToastItem[]>([])

  const remove = React.useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const push = React.useCallback(
    (message: string, variant: ToastVariant) => {
      const id = ++counter
      setItems((prev) => [...prev, { id, message, variant }])
      window.setTimeout(() => remove(id), variant === 'error' ? 6000 : 3500)
    },
    [remove],
  )

  const api = React.useMemo<ToastCtx>(
    () => ({
      toast: (m, v = 'info') => push(m, v),
      success: (m) => push(m, 'success'),
      error: (m) => push(m, 'error'),
      info: (m) => push(m, 'info'),
    }),
    [push],
  )

  return (
    <Ctx.Provider value={api}>
      {children}
      <Toaster items={items} onClose={remove} />
    </Ctx.Provider>
  )
}

const ICON: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
}

function Toaster({ items, onClose }: { items: ToastItem[]; onClose: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end">
      {items.map((t) => {
        const Icon = ICON[t.variant]
        return (
          <div
            key={t.id}
            role="status"
            className={cn(
              'sm-toast-in pointer-events-auto flex w-full max-w-sm items-start gap-2.5 rounded-lg border px-3.5 py-3 shadow-lg backdrop-blur',
              t.variant === 'success' && 'border-green-600/40 bg-green-950/80 text-green-100',
              t.variant === 'error' && 'border-primary/50 bg-primary/15 text-foreground',
              t.variant === 'info' && 'border-border bg-card/95 text-foreground',
            )}
          >
            <Icon
              className={cn(
                'mt-0.5 h-4 w-4 shrink-0',
                t.variant === 'success' && 'text-green-400',
                t.variant === 'error' && 'text-primary',
                t.variant === 'info' && 'text-muted-foreground',
              )}
            />
            <span className="flex-1 text-sm leading-snug">{t.message}</span>
            <button
              onClick={() => onClose(t.id)}
              className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
              aria-label="Schließen"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
