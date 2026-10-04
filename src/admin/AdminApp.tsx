import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import './admin.css'
import { queryClient } from './lib/queries'
import { ToastProvider } from './components/ui/toast'
import { ConfirmProvider } from './components/ui/confirm'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
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
                  <Route path="kader" element={<Kader />} />
                  <Route path="aufstellung" element={<Aufstellung />} />
                  <Route path="spiele" element={<Spiele />} />
                  <Route path="tabelle" element={<Tabelle />} />
                  <Route path="sponsoren" element={<Sponsoren />} />
                  <Route path="verein" element={<Verein />} />

                  <Route path="archiv" element={<Archiv />} />
                  <Route path="social" element={<Dashboard />} />
                  <Route path="redaktionsplan" element={<Redaktionsplan />} />
                  <Route path="ideen" element={<IdeenPool />} />
                  <Route path="produktion" element={<Produktion />} />
                  <Route path="matchday" element={<Matchday />} />
                  <Route path="sponsoren-crm" element={<SponsorenCrm />} />
                  <Route path="insights" element={<Insights />} />
                  <Route path="automationen" element={<Automationen />} />
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
