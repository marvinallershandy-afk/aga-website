import { useState } from 'react'
import { CheckCircle2, KeyRound, Smartphone } from 'lucide-react'
import { useAuth } from '../auth/AuthProvider'
import { Modal } from './ui/modal'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { useToast } from './ui/toast'

// ─────────────────────────────────────────────────────────────
// v15-P „Konto": Passwort festlegen/ändern für den eingeloggten Nutzer —
// danach geht der Login ohne Magic-Link (E-Mail + Passwort). Mindestens
// 10 Zeichen, Bestätigungsfeld. Verlangt Supabase „Secure password change"
// (Login älter als 24 h), wird ein Code per E-Mail angefordert und hier
// eingegeben.
// ─────────────────────────────────────────────────────────────

const MIN_PASSWORT = 10

export function KontoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { user, updatePassword, requestPasswordCode } = useAuth()
  const toast = useToast()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [code, setCode] = useState('')
  const [needsCode, setNeedsCode] = useState(false)
  const [busy, setBusy] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const [fertig, setFertig] = useState(false)

  const zuKurz = pw.length > 0 && pw.length < MIN_PASSWORT
  const ungleich = pw2.length > 0 && pw !== pw2
  const ok = pw.length >= MIN_PASSWORT && pw === pw2 && (!needsCode || code.trim().length > 0)

  function schliessen() {
    setPw('')
    setPw2('')
    setCode('')
    setNeedsCode(false)
    setFehler(null)
    setFertig(false)
    onClose()
  }

  async function speichern(e: React.FormEvent) {
    e.preventDefault()
    if (!ok || busy) return
    setBusy(true)
    setFehler(null)
    const r = await updatePassword(pw, needsCode ? code.trim() : undefined)
    if (r.error) {
      if (r.needsCode && !needsCode) {
        // Supabase verlangt eine Bestätigung → Code anfordern
        const c = await requestPasswordCode()
        setNeedsCode(true)
        setFehler(c.error)
      } else {
        setFehler(r.error)
      }
    } else {
      setFertig(true)
      setPw('')
      setPw2('')
      setCode('')
      setNeedsCode(false)
      toast.success('Passwort gespeichert.')
    }
    setBusy(false)
  }

  return (
    <Modal open={open} onClose={schliessen} title="Konto" description={user?.email ?? 'Vorschau ohne Login'}>
      {fertig ? (
        <div className="space-y-4" role="status">
          <div className="flex items-start gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-400" />
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-foreground">Passwort gespeichert.</p>
              <p className="text-muted-foreground">
                Ab jetzt meldest du dich mit <b className="text-foreground">E-Mail + Passwort</b> an — kein Magic-Link
                mehr nötig. Auf diesem Gerät bleibst du ohnehin eingeloggt.
              </p>
            </div>
          </div>
          <Button className="w-full" onClick={schliessen}>
            Fertig
          </Button>
        </div>
      ) : (
        <form onSubmit={speichern} className="space-y-4" noValidate>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <KeyRound className="h-4 w-4 text-primary" /> Passwort festlegen / ändern
          </div>
          <p className="text-sm text-muted-foreground">
            Mit Passwort meldest du dich künftig direkt an („Stattdessen mit Passwort anmelden") — ohne auf eine
            Mail zu warten.
          </p>
          {/* Für Passwort-Manager: Benutzername zum neuen Passwort */}
          <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
          <div className="space-y-2">
            <Label htmlFor="konto-pw">Neues Passwort</Label>
            <Input
              id="konto-pw"
              type="password"
              autoComplete="new-password"
              minLength={MIN_PASSWORT}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              aria-invalid={zuKurz || undefined}
              aria-describedby="konto-pw-hint"
            />
            <p id="konto-pw-hint" className={zuKurz ? 'text-xs text-primary' : 'text-xs text-muted-foreground'}>
              Mindestens {MIN_PASSWORT} Zeichen{pw.length > 0 && ` · ${pw.length}/${MIN_PASSWORT}`}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="konto-pw2">Passwort bestätigen</Label>
            <Input
              id="konto-pw2"
              type="password"
              autoComplete="new-password"
              value={pw2}
              onChange={(e) => setPw2(e.target.value)}
              aria-invalid={ungleich || undefined}
              aria-describedby="konto-pw2-hint"
            />
            {ungleich && (
              <p id="konto-pw2-hint" className="text-xs text-primary">
                Die beiden Passwörter sind nicht gleich.
              </p>
            )}
          </div>
          {needsCode && (
            <div className="space-y-2">
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                Zur Sicherheit haben wir dir einen <b className="text-foreground">Bestätigungscode per E-Mail</b>{' '}
                geschickt. Bitte hier eingeben und erneut speichern.
              </p>
              <Label htmlFor="konto-code">Bestätigungscode aus der E-Mail</Label>
              <Input
                id="konto-code"
                inputMode="numeric"
                autoComplete="one-time-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
            </div>
          )}
          {fehler && (
            <p className="text-sm text-primary" role="alert">
              {fehler}
            </p>
          )}
          <Button type="submit" className="w-full" disabled={!ok || busy || !user}>
            {busy ? 'Speichert …' : 'Passwort speichern'}
          </Button>
          <p className="flex items-start gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
            <Smartphone className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Tipp: Über „Zum Home-Bildschirm" im Browser-Menü liegt die Pflege als App-Symbol „SVA Pflege" auf dem
            Handy.
          </p>
        </form>
      )}
    </Modal>
  )
}
