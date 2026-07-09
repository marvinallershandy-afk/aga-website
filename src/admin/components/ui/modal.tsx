import * as React from 'react'
import { X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './button'

// Schlankes Modal ohne Radix-Dialog-Dependency.
// Schließt per Escape, Klick auf Overlay und X-Button; sperrt Body-Scroll.
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
  React.useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 sm:items-center"
      onMouseDown={onClose}
    >
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      <div
        className={cn(
          'relative z-10 my-8 w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl',
          className,
        )}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl tracking-wide">{title}</h2>
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Schließen">
            <X className="h-5 w-5" />
          </Button>
        </div>
        <div className="space-y-4">{children}</div>
        {footer && <div className="mt-6 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  )
}
