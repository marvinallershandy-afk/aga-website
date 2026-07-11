import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import * as db from './db'
import type {
  ContentInput,
  ContentRow,
  EingangInput,
  EingangRow,
  IdeeInput,
  IdeeRow,
  RosterInput,
  RosterRow,
  SpielInput,
  SpielRow,
  SponsorInput,
  SponsorRow,
} from './db'

// Zentraler Daten-Layer auf TanStack Query: geteilter Cache über alle Seiten
// (Dashboard/Redaktionsplan/Produktion laden sm_content nur noch EINMAL),
// Invalidierung statt Voll-Refetch, optimistische Status-Updates mit Rollback.

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: true,
    },
  },
})

export const keys = {
  content: ['sm_content'] as const,
  ideen: ['sm_ideen_pool'] as const,
  eingang: ['sm_ideen_eingang'] as const,
  spiele: ['sm_spiele'] as const,
  roster: ['sm_roster'] as const,
  sponsoren: ['sm_sponsoren'] as const,
}

export function useContent() {
  return useQuery({ queryKey: keys.content, queryFn: db.fetchContent })
}
export function useIdeen() {
  return useQuery({ queryKey: keys.ideen, queryFn: db.fetchIdeen })
}
export function useEingang() {
  return useQuery({ queryKey: keys.eingang, queryFn: db.fetchEingang })
}
export function useSpiele() {
  return useQuery({ queryKey: keys.spiele, queryFn: db.fetchSpiele })
}
export function useRoster() {
  return useQuery({ queryKey: keys.roster, queryFn: db.fetchRoster })
}
export function useSponsoren() {
  return useQuery({ queryKey: keys.sponsoren, queryFn: db.fetchSponsoren })
}

// Optimistisches Update einer Zeile in einer gecachten Liste; gibt den
// vorherigen Cache-Stand für Rollback zurück.
function patchListCache<T extends { id: string }>(
  qc: ReturnType<typeof useQueryClient>,
  key: readonly string[],
  id: string,
  patch: Partial<T>,
) {
  const prev = qc.getQueryData<T[]>(key)
  if (prev) {
    qc.setQueryData<T[]>(
      key,
      prev.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    )
  }
  return prev
}

export function useContentMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.content })
  }
  const create = useMutation({
    mutationFn: (input: ContentInput) => db.createContent(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: ContentInput }) =>
      db.updateContent(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.content })
      return { prev: patchListCache<ContentRow>(qc, keys.content, id, patch as Partial<ContentRow>) }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.content, ctx.prev)
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => db.deleteContent(id),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}

export function useIdeenMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.ideen })
  }
  const create = useMutation({
    mutationFn: (input: IdeeInput) => db.createIdee(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: IdeeInput }) => db.updateIdee(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.ideen })
      return { prev: patchListCache<IdeeRow>(qc, keys.ideen, id, patch as Partial<IdeeRow>) }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.ideen, ctx.prev)
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => db.deleteIdee(id),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}

export function useEingangMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.eingang })
  }
  const create = useMutation({
    mutationFn: (input: EingangInput) => db.createEingang(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EingangInput }) =>
      db.updateEingang(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.eingang })
      return { prev: patchListCache<EingangRow>(qc, keys.eingang, id, patch as Partial<EingangRow>) }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.eingang, ctx.prev)
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => db.deleteEingang(id),
    onSuccess: invalidate,
  })
  // Übernahme in den Plan berührt BEIDE Caches (content + eingang).
  const intoPlan = useMutation({
    mutationFn: (row: EingangRow) => db.eingangIntoPlan(row),
    onSuccess: () => {
      invalidate()
      qc.invalidateQueries({ queryKey: keys.content })
    },
  })
  return { create, update, remove, intoPlan }
}

export function useSpieleMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.spiele })
  }
  const create = useMutation({
    mutationFn: (input: SpielInput) => db.createSpiel(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SpielInput }) => db.updateSpiel(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.spiele })
      return { prev: patchListCache<SpielRow>(qc, keys.spiele, id, patch as Partial<SpielRow>) }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.spiele, ctx.prev)
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => db.deleteSpiel(id),
    onSuccess: () => {
      invalidate()
      // Paket-Beiträge hängen am Spiel (spiel_id wird genullt) → Content neu laden.
      qc.invalidateQueries({ queryKey: keys.content })
    },
  })
  const paket = useMutation({
    mutationFn: (spielId: string) => db.spieltagspaket(spielId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: keys.content })
    },
  })
  return { create, update, remove, paket }
}

export function useRosterMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.roster })
  }
  const create = useMutation({
    mutationFn: (input: RosterInput) => db.createSpieler(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: RosterInput }) => db.updateSpieler(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.roster })
      return { prev: patchListCache<RosterRow>(qc, keys.roster, id, patch as Partial<RosterRow>) }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.roster, ctx.prev)
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => db.deleteSpieler(id),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}

export function useSponsorenMutations() {
  const qc = useQueryClient()
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: keys.sponsoren })
  }
  const create = useMutation({
    mutationFn: (input: SponsorInput) => db.createSponsor(input),
    onSuccess: invalidate,
  })
  const update = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: SponsorInput }) => db.updateSponsor(id, patch),
    onMutate: async ({ id, patch }) => {
      await qc.cancelQueries({ queryKey: keys.sponsoren })
      return { prev: patchListCache<SponsorRow>(qc, keys.sponsoren, id, patch as Partial<SponsorRow>) }
    },
    onError: (_e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(keys.sponsoren, ctx.prev)
    },
    onSettled: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => db.deleteSponsor(id),
    onSuccess: invalidate,
  })
  return { create, update, remove }
}
