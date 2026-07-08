import { useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from './AuthProvider'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card'

type Mode = 'magic' | 'password'

export function Login() {
  const { session, isAdmin, signInWithMagicLink, signInWithPassword } = useAuth()
  const navigate = useNavigate()
  const [mode, setMode] = useState<Mode>('magic')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sent, setSent] = useState(false)

  // Bereits als Admin eingeloggt → direkt ins Dashboard.
  if (session && isAdmin) return <Navigate to="/admin" replace />

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    if (mode === 'magic') {
      const { error } = await signInWithMagicLink(email.trim())
      if (error) setError(error)
      else setSent(true)
    } else {
      const { error } = await signInWithPassword(email.trim(), password)
      if (error) setError(error)
      else navigate('/admin', { replace: true })
    }
    setBusy(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <img src="/brand/wappen.png" alt="SV Agathenburg-Dollern" className="mb-2 h-16 w-auto" />
          <CardTitle className="text-2xl">
            SVA <span className="text-primary">Admin</span>
          </CardTitle>
          <CardDescription>Social-Media-Redaktion · nur für das Team</CardDescription>
        </CardHeader>
        <CardContent>
          {sent ? (
            <div className="space-y-3 text-center text-sm">
              <p className="text-foreground">
                Magic-Link an <b>{email}</b> geschickt. Öffne den Link auf diesem Gerät, um dich
                anzumelden.
              </p>
              <Button variant="ghost" className="w-full" onClick={() => setSent(false)}>
                Andere Adresse verwenden
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">E-Mail</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="du@sv-agathenburg-dollern.de"
                />
              </div>

              {mode === 'password' && (
                <div className="space-y-2">
                  <Label htmlFor="password">Passwort</Label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              )}

              {error && <p className="text-sm text-primary">{error}</p>}

              <Button type="submit" className="w-full" disabled={busy}>
                {busy ? 'Moment …' : mode === 'magic' ? 'Magic-Link senden' : 'Anmelden'}
              </Button>

              <button
                type="button"
                className="w-full text-center text-xs text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setMode(mode === 'magic' ? 'password' : 'magic')
                  setError(null)
                }}
              >
                {mode === 'magic' ? 'Stattdessen mit Passwort anmelden' : 'Stattdessen Magic-Link nutzen'}
              </button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
