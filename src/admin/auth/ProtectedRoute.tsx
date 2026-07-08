import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button } from '../components/ui/button'

// DEV-Vorschau: erlaubt es, die Admin-UI ohne Live-Login zu rendern
// (z. B. für Screenshots während der Entwicklung). In PROD-Builds ist
// import.meta.env.DEV === false → der Schutz greift IMMER.
function devPreview(): boolean {
  return import.meta.env.DEV && new URLSearchParams(window.location.search).has('preview')
}

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { session, isAdmin, loading, signOut } = useAuth()

  if (devPreview()) return <>{children}</>

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        Lädt …
      </div>
    )
  }

  if (!session) return <Navigate to="/admin/login" replace />

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h2 className="text-2xl">Kein Zugang</h2>
        <p className="max-w-sm text-muted-foreground">
          Dieser Account ist nicht als SVA-Admin freigeschaltet. Bitte melde dich mit einem
          freigeschalteten Konto an.
        </p>
        <Button variant="outline" onClick={() => signOut()}>
          Abmelden
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
