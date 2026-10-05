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
  signOut: () => Promise<void>
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return
      setSession(data.session)
      setRolle(data.session ? await checkRolle() : null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, s) => {
      if (!active) return
      setSession(s)
      setRolle(s ? await checkRolle() : null)
      setLoading(false)
    })

    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

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
      return { error: error?.message ?? null }
    },
    signInWithPassword: async (email, password) => {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      return { error: error?.message ?? null }
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
