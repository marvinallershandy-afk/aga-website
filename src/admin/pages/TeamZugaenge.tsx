import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { UserPlus, ShieldCheck, Users, Trash2, Loader2, Info } from 'lucide-react'
import { PageHeader } from './Placeholder'
import { Button } from '../components/ui/button'
import { Card, CardContent } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { SkeletonRows } from '../components/ui/skeleton'
import { useToast } from '../components/ui/toast'
import { useConfirm } from '../components/ui/confirm'
import { PflegeHinweis } from '../components/PflegeHinweis'
import { useAuth, type Rolle } from '../auth/AuthProvider'
import { supabase } from '../lib/supabase'
import type { Tables } from '../lib/database.types'
import { friendlyError, isMissingSchema } from '../lib/db'
import { relativZeit } from '../lib/format'
import { cn } from '../lib/utils'

// ─────────────────────────────────────────────────────────────
// v15-L „Team & Zugänge" (nur Admin): wer darf in die Vereins-Pflege?
//   admin = alles · team = Übersicht, Aufstellung, Spiele/Ergebnis, Live.
// Eintrag = Zeile in sm_admins. Angemeldet wird per Magic Link; weil neue
// Konten gesperrt sind (Sicherheit), lädt Marvin die Person einmalig in
// Supabase ein. Die eigene Zeile ist hier (und per RLS) nicht änderbar.
// ─────────────────────────────────────────────────────────────

type Zugang = Tables<'sm_admins'>
const KEY = ['sm_admins'] as const

const ROLLEN: { value: Rolle; label: string; text: string; icon: typeof Users }[] = [
  { value: 'team', label: 'Team', text: 'Aufstellung, Ergebnisse, Live-Ticker', icon: Users },
  { value: 'admin', label: 'Admin', text: 'Alles inkl. Kader, Sponsoren, Zugänge', icon: ShieldCheck },
]

async function fetchZugaenge(): Promise<Zugang[]> {
  const { data, error } = await supabase.from('sm_admins').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data ?? []
}

export function TeamZugaenge() {
  const toast = useToast()
  const confirm = useConfirm()
  const qc = useQueryClient()
  const { user } = useAuth()
  const meine = (user?.email ?? '').toLowerCase()
  const q = useQuery({ queryKey: KEY, queryFn: fetchZugaenge, retry: false })
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [rolle, setRolle] = useState<Rolle>('team')

  const add = useMutation({
    mutationFn: async () => {
      const e = email.trim().toLowerCase()
      const { error } = await supabase.from('sm_admins').insert({ email: e, rolle, name: name.trim() || null, angelegt_von: user?.email ?? null })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
  const setR = useMutation({
    mutationFn: async ({ id, r }: { id: string; r: Rolle }) => {
      const { error } = await supabase.from('sm_admins').update({ rolle: r }).eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('sm_admins').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  })

  const emailOk = /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())
  const doppelt = (q.data ?? []).some((z) => z.email.toLowerCase() === email.trim().toLowerCase())
  const schemaFehlt = q.error && isMissingSchema(q.error)
  const zugaenge = q.data ?? []

  return (
    <>
      <PageHeader title="Team & Zugänge" subtitle="Wer darf in die Vereins-Pflege — und was?" />
      {schemaFehlt && <PflegeHinweis schema className="mb-4" />}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
        <Card>
          <CardContent className="space-y-4 p-4 md:p-5">
            <h2 className="flex items-center gap-2 font-display text-lg tracking-wide">
              <UserPlus className="h-5 w-5 text-muted-foreground" /> Zugang hinzufügen
            </h2>
            <div className="space-y-1.5">
              <Label htmlFor="z-mail">E-Mail *</Label>
              <Input id="z-mail" type="email" inputMode="email" autoCapitalize="none" className="h-12 text-base" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="trainer@beispiel.de" />
              {email.trim() && !emailOk && <p className="text-xs text-primary">E-Mail sieht nicht richtig aus.</p>}
              {doppelt && <p className="text-xs text-primary">Diese E-Mail hat schon einen Zugang.</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="z-name">Name (optional)</Label>
              <Input id="z-name" className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Niko (Teammanager)" />
            </div>
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Rolle">
              {ROLLEN.map((r) => (
                <button
                  key={r.value}
                  type="button"
                  role="radio"
                  aria-checked={rolle === r.value}
                  onClick={() => setRolle(r.value)}
                  className={cn(
                    'flex min-h-[72px] flex-col items-start gap-0.5 rounded-lg border p-3 text-left',
                    rolle === r.value ? 'border-primary bg-primary/15' : 'border-border hover:bg-accent',
                  )}
                >
                  <span className="flex items-center gap-1.5 font-semibold">
                    <r.icon className="h-4 w-4" /> {r.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{r.text}</span>
                </button>
              ))}
            </div>
            <Button
              className="h-12 w-full text-base"
              disabled={!emailOk || doppelt || add.isPending || !!schemaFehlt}
              onClick={async () => {
                try {
                  await add.mutateAsync()
                  toast.success(`${email.trim()} ist eingetragen.`)
                  setEmail('')
                  setName('')
                } catch (e) {
                  toast.error(friendlyError(e, 'Eintragen fehlgeschlagen.'))
                }
              }}
            >
              {add.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <UserPlus className="h-5 w-5" />} Zugang anlegen
            </Button>
            <div className="flex gap-2 rounded-lg border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <p>
                So kommt die Person rein: Sie öffnet <b className="text-foreground">/admin</b>, gibt ihre E-Mail ein und bekommt einen{' '}
                <b className="text-foreground">Anmelde-Link per Mail</b> (kein Passwort). Weil neue Konten aus Sicherheitsgründen gesperrt sind,
                lädt <b className="text-foreground">Marvin sie einmalig in Supabase ein</b> (Authentication → Invite user) — Bescheid geben genügt.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 md:p-5">
            <h2 className="mb-3 font-display text-lg tracking-wide">
              Zugänge <span className="font-body text-sm text-muted-foreground">{zugaenge.length}</span>
            </h2>
            {q.isPending ? (
              <SkeletonRows rows={4} />
            ) : q.error && !schemaFehlt ? (
              <p className="text-sm text-primary">{friendlyError(q.error)}</p>
            ) : (
              <ul className="divide-y divide-border">
                {zugaenge.map((z) => {
                  const ich = z.email.toLowerCase() === meine
                  const r = (z.rolle === 'team' ? 'team' : 'admin') as Rolle
                  return (
                    <li key={z.id} className="flex flex-wrap items-center gap-3 py-3">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">
                          {z.name || z.email}
                          {ich && <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">du</span>}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {z.name ? `${z.email} · ` : ''}seit {relativZeit(z.created_at)}
                        </span>
                      </span>
                      <div className="flex rounded-lg border border-border p-0.5" role="radiogroup" aria-label={`Rolle von ${z.email}`}>
                        {ROLLEN.map((o) => (
                          <button
                            key={o.value}
                            type="button"
                            role="radio"
                            aria-checked={r === o.value}
                            disabled={ich || setR.isPending}
                            onClick={() => r !== o.value && setR.mutate({ id: z.id, r: o.value }, { onError: (e) => toast.error(friendlyError(e)) })}
                            className={cn('min-h-[36px] rounded-md px-3 text-sm', r === o.value ? 'bg-primary text-white' : 'text-muted-foreground', ich && 'cursor-not-allowed')}
                          >
                            {o.label}
                          </button>
                        ))}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`${z.email} entfernen`}
                        disabled={ich || del.isPending}
                        title={ich ? 'Den eigenen Zugang kann man nicht entfernen.' : 'Entfernen'}
                        onClick={async () => {
                          const ok = await confirm({ title: 'Zugang entfernen?', description: `${z.email} kommt danach nicht mehr in die Vereins-Pflege.`, confirmLabel: 'Entfernen', destructive: true })
                          if (ok) del.mutate(z.id, { onSuccess: () => toast.success('Zugang entfernt.'), onError: (e) => toast.error(friendlyError(e)) })
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
