import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './admin.css'
import { AuthProvider } from './auth/AuthProvider'
import { ProtectedRoute } from './auth/ProtectedRoute'
import { Login } from './auth/Login'
import { AdminLayout } from './AdminLayout'
import { Dashboard } from './pages/Dashboard'
import { Placeholder } from './pages/Placeholder'
import { Redaktionsplan } from './pages/Redaktionsplan'
import { IdeenPool } from './pages/IdeenPool'
import { Matchday } from './pages/Matchday'

function Sponsoren() {
  return <Placeholder title="Sponsoren-CRM" subtitle="Pakete, Laufzeiten, Leistungen" note="Coming soon — Stub (Phase 4)." />
}
function Insights() {
  return <Placeholder title="Insights" subtitle="Meta / TikTok Analytics" note="Coming soon — Stub (Phase 4)." />
}

export function AdminApp() {
  return (
    <div className="admin-root">
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
              <Route index element={<Dashboard />} />
              <Route path="redaktionsplan" element={<Redaktionsplan />} />
              <Route path="ideen" element={<IdeenPool />} />
              <Route path="matchday" element={<Matchday />} />
              <Route path="sponsoren" element={<Sponsoren />} />
              <Route path="insights" element={<Insights />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </div>
  )
}
