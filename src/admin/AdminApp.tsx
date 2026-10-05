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
// v14-C Vereins-Pflege (Hauptnavigation)
import { Uebersicht } from './pages/Uebersicht'
import { Kader } from './pages/Kader'
import { Aufstellung } from './pages/Aufstellung'
import { Spiele } from './pages/Spiele'
import { Tabelle } from './pages/Tabelle'
import { Sponsoren } from './pages/Sponsoren'
import { Verein } from './pages/Verein'
// v15-L Spieltag-Modus
import { Live } from './pages/Live'
import { TeamZugaenge } from './pages/TeamZugaenge'
// Archiv: Social Media (nicht mehr in der Hauptnavigation, Routen unverändert)
import { Archiv } from './pages/Archiv'
import { Dashboard } from './pages/Dashboard'
import { Redaktionsplan } from './pages/Redaktionsplan'
import { IdeenPool } from './pages/IdeenPool'
import { Produktion } from './pages/Produktion'
import { Matchday } from './pages/Matchday'
import { SponsorenCrm } from './pages/SponsorenCrm'
import { Insights } from './pages/Insights'
import { Automationen } from './pages/Automationen'

export function AdminApp() {
  return (
    <div className="admin-root">
      <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthProvider>
            <BrowserRouter basename="/admin">
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
            </BrowserRouter>
          </AuthProvider>
        </ConfirmProvider>
      </ToastProvider>
      </QueryClientProvider>
    </div>
  )
}
