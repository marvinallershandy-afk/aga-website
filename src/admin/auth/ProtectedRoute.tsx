import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button } from '../components/ui/button'

// DEV-Vorschau: erlaubt es, die Admin-UI ohne Live-Login zu rendern
// (z. B. für Screenshots während der Entwicklung). In PROD-Builds ist
// import.meta.env.DEV === false → der Schutz greift IMMER.
// Einmal mit ?preview betreten, bleibt die Vorschau für die Session aktiv
// (In-App-Navigation lässt den Query-Param sonst fallen).
function devPreview(): boolean {
  if (!import.meta.env.DEV) return false
  if (new URLSearchParams(window.location.search).has('preview')) {
    try {
      sessionStorage.setItem('sm_preview', '1')
    } catch {
      /* ignore */
    }
    return true
  }
  try {
    return sessionStorage.getItem('sm_preview') === '1'
  } catch {
    return false
  }
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

  // Pfad RELATIV zum basename="/admin" — "/login" ergibt /admin/login.
  if (!session) return <Navigate to="/login" replace />

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
