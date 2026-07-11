import * as React from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

// Modal auf Radix-Dialog-Basis: echter Fokus-Trap, Fokus-Restore beim
// Schließen, Escape & Overlay-Klick. Bewusst OHNE Portal gerendert, damit die
// Design-Tokens (CSS-Variablen auf .admin-root) weiter greifen.
export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: React.ReactNode
  footer?: React.ReactNode
  className?: string
}) {
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm" />
      <Dialog.Content
        aria-describedby={description ? undefined : ''}
        className={cn(
          'fixed left-1/2 top-1/2 z-50 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-xl',
          className,
        )}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <Dialog.Title className="font-display text-xl tracking-wide">{title}</Dialog.Title>
            {description && (
              <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                {description}
              </Dialog.Description>
            )}
          </div>
          <Dialog.Close asChild>
            <Button variant="ghost" size="icon" aria-label="Schließen">
              <X className="h-5 w-5" />
            </Button>
          </Dialog.Close>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </Dialog.Content>
    </Dialog.Root>
  )
}
