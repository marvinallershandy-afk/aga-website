import * as React from 'react'
import { Modal } from './modal'
import { Button } from './button'

// Bestätigungs-Dialog für destruktive Aktionen (ersetzt window.confirm).
// Nutzung: const confirm = useConfirm(); if (await confirm({...})) { … }

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

type Resolver = (ok: boolean) => void

export function useConfirm() {
  const ctx = React.useContext(ConfirmCtx)
  if (!ctx) throw new Error('useConfirm braucht <ConfirmProvider>.')
  return ctx
}

const ConfirmCtx = React.createContext<((opts: ConfirmOptions) => Promise<boolean>) | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null)
  const [busy, setBusy] = React.useState(false)
  const resolverRef = React.useRef<Resolver | null>(null)

  const confirm = React.useCallback((o: ConfirmOptions) => {
    setOpts(o)
    setBusy(false)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const done = (ok: boolean) => {
    resolverRef.current?.(ok)
    resolverRef.current = null
    setOpts(null)
  }

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      <Modal
        open={!!opts}
        onClose={() => done(false)}
        title={opts?.title ?? ''}
        description={opts?.description}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => done(false)} disabled={busy}>
              {opts?.cancelLabel ?? 'Abbrechen'}
            </Button>
            <Button
              variant={opts?.destructive ? 'destructive' : 'default'}
              onClick={() => {
                setBusy(true)
                done(true)
              }}
              disabled={busy}
            >
              {opts?.confirmLabel ?? 'Bestätigen'}
            </Button>
          </>
        }
      >
        <span className="sr-only">Bestätigung erforderlich</span>
      </Modal>
    </ConfirmCtx.Provider>
  )
}
