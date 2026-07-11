import {
  QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query'
import * as db from './db'
import type { ContentInput, ContentRow, EingangInput, EingangRow, IdeeInput, IdeeRow } from './db'

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
