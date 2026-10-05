import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

/** v15-L: admin = alles; team = Übersicht, Aufstellung, Spiele/Ergebnis, Live. */
export type Rolle = 'admin' | 'team'

interface AuthState {
  session: Session | null
  user: User | null
  /** Ist der eingeloggte User in sm_admins freigeschaltet (egal welche Rolle)? */
  isAdmin: boolean
  /** v15-L: Rolle aus sm_admins.rolle (null = kein Zugang). */
  rolle: Rolle | null
  loading: boolean
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  /** v15-P: Passwort für den eingeloggten Nutzer festlegen/ändern. nonce nur,
   *  wenn Supabase „Secure password change" verlangt (Code per E-Mail). */
  updatePassword: (password: string, nonce?: string) => Promise<{ error: string | null; needsCode?: boolean }>
  /** v15-P: Bestätigungscode für die Passwort-Änderung anfordern. */
  requestPasswordCode: () => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

// v15-P: Supabase-Fehlertexte (englisch) → verständliches Deutsch.
// eslint-disable-next-line react-refresh/only-export-components
export function authFehler(msg: string | null | undefined, code?: string): string | null {
  if (!msg && !code) return null
  const m = (msg ?? '').toLowerCase()
  if (code === 'invalid_credentials' || m.includes('invalid login credentials'))
    return 'E-Mail oder Passwort stimmt nicht. Noch kein Passwort? Einmal per Magic-Link anmelden und unter „Konto" festlegen.'
  if (code === 'email_not_confirmed' || m.includes('email not confirmed')) return 'Die E-Mail-Adresse ist noch nicht bestätigt.'
  if (code === 'same_password' || m.includes('should be different')) return 'Das ist schon dein aktuelles Passwort — bitte ein neues wählen.'
  if (code === 'weak_password' || m.includes('password should')) return 'Das Passwort ist zu schwach. Bitte länger oder mit Zahlen/Sonderzeichen.'
  if (code === 'reauthentication_needed' || m.includes('reauthentication')) return 'Zur Sicherheit bitte den Bestätigungscode aus der E-Mail eingeben.'
  if (code === 'reauthentication_not_valid' || m.includes('nonce')) return 'Der Bestätigungscode passt nicht oder ist abgelaufen.'
  if (code === 'over_email_send_rate_limit' || code === 'over_request_rate_limit' || m.includes('rate limit'))
    return 'Zu viele Versuche — bitte kurz warten und es dann erneut probieren.'
  if (m.includes('signups not allowed') || code === 'otp_disabled') return 'Diese Adresse ist nicht freigeschaltet.'
  if (m.includes('failed to fetch') || m.includes('network')) return 'Keine Verbindung — bitte Internet prüfen.'
  return msg ?? 'Unbekannter Fehler.'
}

const AuthContext = createContext<AuthState | undefined>(undefined)

// v15-L: Rolle über die RPC sva_meine_rolle(). Fehlt sie (Migration
// 20261005100000 noch nicht angewandt), gilt der alte Weg: RLS-Self-Select
// auf sm_admins — jede freigeschaltete Zeile ist dann Admin.
async function checkRolle(): Promise<Rolle | null> {
  const { data, error } = await supabase.rpc('sva_meine_rolle')
  if (!error) return data === 'admin' || data === 'team' ? data : null
  const alt = await supabase.from('sm_admins').select('email').limit(1)
  if (alt.error) return null
  return alt.data && alt.data.length > 0 ? 'admin' : null
}

// DEV-Vorschau (ProtectedRoute: ?preview bzw. ?preview=team): Rolle ohne Login.
// eslint-disable-next-line react-refresh/only-export-components
export function devPreviewRolle(): Rolle | null {
  if (!import.meta.env.DEV) return null
  try {
    const q = new URLSearchParams(window.location.search)
    if (q.has('preview')) sessionStorage.setItem('sm_preview_rolle', q.get('preview') === 'team' ? 'team' : 'admin')
    const r = sessionStorage.getItem('sm_preview_rolle')
    return r === 'team' ? 'team' : r === 'admin' ? 'admin' : null
  } catch {
    return null
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [rolle, setRolle] = useState<Rolle | null>(null)
  const [initialLoading, setInitialLoading] = useState(true)
  // v15-P: Für welchen User wurde die Rolle zuletzt geprüft? Solange die
  // Prüfung für den aktuellen User läuft, gilt „lädt" — sonst blitzte nach
  // dem Passwort-Login kurz „Kein Zugang" auf.
  const [checkedFor, setCheckedFor] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    let lastUser: string | null | undefined

    // Rolle nur bei User-Wechsel neu prüfen (nicht bei Token-Refresh oder
    // Passwort-Änderung). Bewusst NICHT im onAuthStateChange-Callback
    // awaiten: Supabase hält dort den Auth-Lock (Deadlock-Gefahr bei
    // weiteren Supabase-Aufrufen) → per setTimeout entkoppelt.
    const apply = (s: Session | null) => {
      if (!active) return
      setSession(s)
      setInitialLoading(false)
      const uid = s?.user.id ?? null
      if (uid === lastUser) return
      lastUser = uid
      if (!uid) {
        setRolle(null)
        setCheckedFor(null)
        return
      }
      setTimeout(async () => {
        const r = await checkRolle()
        if (!active || lastUser !== uid) return
        setRolle(r)
        setCheckedFor(uid)
      }, 0)
    }

    supabase.auth.getSession().then(({ data }) => apply(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => apply(s))

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const loading = initialLoading || (!!session && checkedFor !== session.user.id)

  const value: AuthState = {
    session,
    user: session?.user ?? null,
    isAdmin: (devPreviewRolle() ?? rolle) !== null,
    rolle: devPreviewRolle() ?? rolle,
    loading,
    signInWithMagicLink: async (email) => {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        // shouldCreateUser:false → ein Magic-Link legt NIE ein neues Konto an.
        // Nur bereits angelegte (und in sm_admins freigeschaltete) Nutzer
        // kommen rein. Zusätzlich in Supabase Auth „Signups" abschalten.
        options: { emailRedirectTo: `${window.location.origin}/admin`, shouldCreateUser: false },
      })
      return { error: error ? authFehler(error.message, error.code) : null }
    },
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error ? authFehler(error.message, error.code) : null }
    },
    updatePassword: async (password, nonce) => {
      const { error } = await supabase.auth.updateUser(nonce ? { password, nonce } : { password })
      if (!error) return { error: null }
      const needsCode = error.code === 'reauthentication_needed' || /reauthentication/i.test(error.message)
      return { error: authFehler(error.message, error.code), needsCode }
    },
    requestPasswordCode: async () => {
      const { error } = await supabase.auth.reauthenticate()
      return { error: error ? authFehler(error.message, error.code) : null }
    },
    signOut: async () => {
      await supabase.auth.signOut()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth muss innerhalb von <AuthProvider> genutzt werden')
  return ctx
}
