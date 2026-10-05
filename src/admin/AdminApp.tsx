import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './admin.css'
import { queryClient } from './lib/queries'
import { ToastProvider } from './components/ui/toast'
import { ConfirmProvider } from './components/ui/confirm'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute, NurAdmin } from './auth/ProtectedRoute'
import { Login } from './auth/Login'
import { AdminLayout } from './AdminLayout'
// v14-C Vereins-Pflege (Hauptnavigation) — am Spieltag gebraucht, daher eager
import { Uebersicht } from './pages/Uebersicht'
import { Kader } from './pages/Kader'
import { Aufstellung } from './pages/Aufstellung'
import { Spiele } from './pages/Spiele'
import { Tabelle } from './pages/Tabelle'
import { Sponsoren } from './pages/Sponsoren'
import { Verein } from './pages/Verein'
// v17-D: Galerien „Spieltag in Bildern“
import { Galerien } from './pages/Galerien'
// v18-A: anonyme Statistik (Instagram-Zuordnung, Ziele)
import { Statistik } from './pages/Statistik'
// v15-L Spieltag-Modus
import { Live } from './pages/Live'
import { TeamZugaenge } from './pages/TeamZugaenge'
// v17-A Sammelalbum (Stickerheft, QR-Check-in)
import { Album } from './pages/Album'

// v19-S (Audit C): Archiv/Social-Media-Seiten per lazy() aus dem mountAdmin-
// Bundle lösen — am Platz-Handy wird nur geladen, was gebraucht wird
// (mountAdmin 637 → grob 350 KB). Named Exports → default mappen.
const Archiv = lazy(() => import('./pages/Archiv').then((m) => ({ default: m.Archiv })))
const Dashboard = lazy(() => import('./pages/Dashboard').then((m) => ({ default: m.Dashboard })))
const Redaktionsplan = lazy(() => import('./pages/Redaktionsplan').then((m) => ({ default: m.Redaktionsplan })))
const IdeenPool = lazy(() => import('./pages/IdeenPool').then((m) => ({ default: m.IdeenPool })))
const Produktion = lazy(() => import('./pages/Produktion').then((m) => ({ default: m.Produktion })))
const Matchday = lazy(() => import('./pages/Matchday').then((m) => ({ default: m.Matchday })))
const SponsorenCrm = lazy(() => import('./pages/SponsorenCrm').then((m) => ({ default: m.SponsorenCrm })))
const Insights = lazy(() => import('./pages/Insights').then((m) => ({ default: m.Insights })))
const Automationen = lazy(() => import('./pages/Automationen').then((m) => ({ default: m.Automationen })))

function LadeSeite() {
  return <div className="p-6 text-sm text-muted-foreground">Lädt …</div>
}

export function AdminApp() {
  return (
    <div className="admin-root">
      <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter basename="/admin">
              <Suspense fallback={<LadeSeite />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<Uebersicht />} />
                  {/* v15-L: Team-Zugang darf Aufstellung, Spiele (Ergebnis) und Live */}
                  <Route path="aufstellung" element={<Aufstellung />} />
                  <Route path="spiele" element={<Spiele />} />
                  <Route path="live" element={<Live />} />
                  <Route path="kader" element={<NurAdmin><Kader /></NurAdmin>} />
                  <Route path="tabelle" element={<NurAdmin><Tabelle /></NurAdmin>} />
                  <Route path="sponsoren" element={<NurAdmin><Sponsoren /></NurAdmin>} />
                  <Route path="album" element={<NurAdmin><Album /></NurAdmin>} />
                  <Route path="galerien" element={<NurAdmin><Galerien /></NurAdmin>} />
                  <Route path="statistik" element={<NurAdmin><Statistik /></NurAdmin>} />
                  <Route path="verein" element={<NurAdmin><Verein /></NurAdmin>} />
                  <Route path="team" element={<NurAdmin><TeamZugaenge /></NurAdmin>} />

                  <Route path="archiv" element={<NurAdmin><Archiv /></NurAdmin>} />
                  <Route path="social" element={<NurAdmin><Dashboard /></NurAdmin>} />
                  <Route path="redaktionsplan" element={<NurAdmin><Redaktionsplan /></NurAdmin>} />
                  <Route path="ideen" element={<NurAdmin><IdeenPool /></NurAdmin>} />
                  <Route path="produktion" element={<NurAdmin><Produktion /></NurAdmin>} />
                  <Route path="matchday" element={<NurAdmin><Matchday /></NurAdmin>} />
                  <Route path="sponsoren-crm" element={<NurAdmin><SponsorenCrm /></NurAdmin>} />
                  <Route path="insights" element={<NurAdmin><Insights /></NurAdmin>} />
                  <Route path="automationen" element={<NurAdmin><Automationen /></NurAdmin>} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </Suspense>
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
      </QueryClientProvider>
    </div>
  )
}
