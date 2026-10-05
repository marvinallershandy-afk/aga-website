// ─────────────────────────────────────────────────────────────
// v17-D: Datenzugriff Admin → Galerien („Spieltag in Bildern“).
// Tabellen sva_galerien + sva_galerie_bilder (RLS: is_sm_admin()), Bilder im
// öffentlichen Bucket sva_public unter galerien/<slug>/. Die Tabellen stehen
// (noch) nicht in database.types.ts → schmale Zeilen-Typen + untypisierter
// Client NUR hier (wie lib/album.ts). retry:false → fehlt die Migration,
// erscheint sofort der ruhige Hinweis.
// ─────────────────────────────────────────────────────────────
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from './supabase'
import { PUBLIC_BUCKET } from './pflege'
import { loadImage } from './image'

const db = supabase as unknown as SupabaseClient

export interface GalerieRow {
  id: string
  slug: string
  titel: string
  untertitel: string | null
  datum: string | null
  spiel_id: string | null
  fotograf: string
  fotograf_url: string | null
  veroeffentlicht: boolean
  sortierung: number
  created_at: string
  updated_at: string
}
export type GalerieInput = Partial<Omit<GalerieRow, 'id' | 'created_at' | 'updated_at'>>

export interface BildRow {
  id: string
  galerie_id: string
  pfad: string
  vorschau_pfad: string | null
  breite: number | null
  hoehe: number | null
  reihenfolge: number
  alt_text: string | null
  titelbild: boolean
  created_at: string
}

/** Vereinsfotografin (Vorbelegung neuer Galerien). Handle: src/data/club.ts */
export const NELE_DEFAULT = { fotograf: 'picture by Nele', fotograf_url: 'https://instagram.com/pictureby.nele' }

export const galerieKeys = {
  liste: ['sva_galerien'] as const,
  bilder: (id: string) => ['sva_galerie_bilder', id] as const,
}

/** „AGA Urknall — Pokal 2026“ → „aga-urknall-pokal-2026“ */
export function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .replace(/ä/g, 'ae')
      .replace(/ö/g, 'oe')
      .replace(/ü/g, 'ue')
      .replace(/ß/g, 'ss')
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60) || 'galerie'
  )
}

export function publicUrl(pfad: string): string {
  if (/^https?:\/\//.test(pfad)) return pfad
  return supabase.storage.from(PUBLIC_BUCKET).getPublicUrl(pfad).data.publicUrl
}

// ── Galerien ────────────────────────────────────────────────
export function useGalerien() {
  return useQuery({
    queryKey: galerieKeys.liste,
    retry: false,
    queryFn: async (): Promise<(GalerieRow & { anzahl: number; cover: string | null })[]> => {
      const { data, error } = await db
        .from('sva_galerien')
        .select('*, sva_galerie_bilder(pfad, vorschau_pfad, titelbild, reihenfolge)')
        .order('datum', { ascending: false, nullsFirst: false })
        .order('sortierung')
      if (error) throw error
      type Mit = GalerieRow & { sva_galerie_bilder: Pick<BildRow, 'pfad' | 'vorschau_pfad' | 'titelbild' | 'reihenfolge'>[] }
      return ((data ?? []) as Mit[]).map(({ sva_galerie_bilder: b, ...g }) => {
        const sorted = [...(b ?? [])].sort((x, y) => x.reihenfolge - y.reihenfolge)
        const c = sorted.find((x) => x.titelbild) ?? sorted[0]
        return { ...g, anzahl: sorted.length, cover: c ? c.vorschau_pfad ?? c.pfad : null }
      })
    },
  })
}

export function useGalerieMutations() {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: galerieKeys.liste })
  const save = useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: GalerieInput }): Promise<string> => {
      if (id) {
        const { error } = await db.from('sva_galerien').update({ ...input, updated_at: new Date().toISOString() }).eq('id', id)
        if (error) throw error
        return id
      }
      const { data, error } = await db.from('sva_galerien').insert(input).select('id').single()
      if (error) throw error
      return (data as { id: string }).id
    },
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: async (g: GalerieRow) => {
      const { data } = await db.from('sva_galerie_bilder').select('pfad, vorschau_pfad').eq('galerie_id', g.id)
      const { error } = await db.from('sva_galerien').delete().eq('id', g.id)
      if (error) throw error
      // Dateien im Speicher aufräumen (Fehler hier sind nicht kritisch)
      const pfade = ((data ?? []) as Pick<BildRow, 'pfad' | 'vorschau_pfad'>[])
        .flatMap((b) => [b.pfad, b.vorschau_pfad])
        .filter((p): p is string => !!p && !/^https?:/.test(p))
      if (pfade.length) await supabase.storage.from(PUBLIC_BUCKET).remove(pfade)
    },
    onSuccess: invalidate,
  })
  return { save, remove }
}

// ── Bilder ──────────────────────────────────────────────────
export function useBilder(galerieId: string | null) {
  return useQuery({
    queryKey: galerieKeys.bilder(galerieId ?? '-'),
    enabled: !!galerieId,
    retry: false,
    queryFn: async (): Promise<BildRow[]> => {
      const { data, error } = await db.from('sva_galerie_bilder').select('*').eq('galerie_id', galerieId).order('reihenfolge').order('created_at')
      if (error) throw error
      return (data ?? []) as BildRow[]
    },
  })
}

/** Lange Kante auf `maxSide` verkleinern (kein Zuschnitt), WebP. */
async function renderMax(img: HTMLImageElement, maxSide: number, quality: number): Promise<{ blob: Blob; w: number; h: number }> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight))
  const w = Math.max(1, Math.round(img.naturalWidth * scale))
  const h = Math.max(1, Math.round(img.naturalHeight * scale))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas nicht verfügbar.')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  const toBlob = (type: string, q: number) => new Promise<Blob | null>((res) => canvas.toBlob(res, type, q))
  let blob = await toBlob('image/webp', quality)
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg', quality)
  if (!blob) throw new Error('Bild konnte nicht umgewandelt werden.')
  return { blob, w, h }
}

async function upload(path: string, blob: Blob) {
  const { error } = await supabase.storage.from(PUBLIC_BUCKET).upload(path, blob, {
    contentType: blob.type || 'image/webp',
    cacheControl: '31536000',
    upsert: false,
  })
  if (error) {
    if (/bucket not found/i.test(error.message)) throw new Error('Der Foto-Speicher ist noch nicht eingerichtet (Migration fehlt). Bitte Marvin Bescheid geben.')
    throw error
  }
}

export function useBilderMutations(galerie: GalerieRow | null) {
  const qc = useQueryClient()
  const invalidate = () => {
    if (galerie) void qc.invalidateQueries({ queryKey: galerieKeys.bilder(galerie.id) })
    void qc.invalidateQueries({ queryKey: galerieKeys.liste })
  }

  /** Mehrfach-Upload: jedes Foto im Browser auf 2000 px + 800-px-Vorschau
   *  verkleinern (Handyfotos 5–12 MB → ~300 KB + ~60 KB), hochladen, eintragen. */
  const hochladen = useMutation({
    mutationFn: async ({ files, start, onFortschritt }: { files: File[]; start: number; onFortschritt?: (fertig: number) => void }) => {
      if (!galerie) throw new Error('Keine Galerie gewählt.')
      let fertig = 0
      for (const [i, file] of files.entries()) {
        const img = await loadImage(file)
        const gross = await renderMax(img, 2000, 0.82)
        const klein = await renderMax(img, 800, 0.74)
        const stamm = `galerien/${galerie.slug}/${String(start + i + 1).padStart(3, '0')}-${Date.now().toString(36)}`
        const ext = gross.blob.type === 'image/jpeg' ? 'jpg' : 'webp'
        await upload(`${stamm}.${ext}`, gross.blob)
        await upload(`${stamm}-800.${ext}`, klein.blob)
        const { error } = await db.from('sva_galerie_bilder').insert({
          galerie_id: galerie.id,
          pfad: `${stamm}.${ext}`,
          vorschau_pfad: `${stamm}-800.${ext}`,
          breite: gross.w,
          hoehe: gross.h,
          reihenfolge: (start + i + 1) * 10,
          alt_text: null,
        })
        if (error) throw error
        fertig++
        onFortschritt?.(fertig)
      }
    },
    onSettled: invalidate,
  })

  const aendern = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<BildRow, 'alt_text' | 'reihenfolge'>> }) => {
      const { error } = await db.from('sva_galerie_bilder').update(patch).eq('id', id)
      if (error) throw error
    },
    onSuccess: invalidate,
  })

  /** Titelbild setzen: erst alle zurücksetzen (Unique-Index „ein Titelbild“). */
  const titelbild = useMutation({
    mutationFn: async (id: string) => {
      if (!galerie) return
      const r1 = await db.from('sva_galerie_bilder').update({ titelbild: false }).eq('galerie_id', galerie.id).eq('titelbild', true)
      if (r1.error) throw r1.error
      const r2 = await db.from('sva_galerie_bilder').update({ titelbild: true }).eq('id', id)
      if (r2.error) throw r2.error
    },
    onSuccess: invalidate,
  })

  const loeschen = useMutation({
    mutationFn: async (b: BildRow) => {
      const { error } = await db.from('sva_galerie_bilder').delete().eq('id', b.id)
      if (error) throw error
      const pfade = [b.pfad, b.vorschau_pfad].filter((p): p is string => !!p && !/^https?:/.test(p))
      if (pfade.length) await supabase.storage.from(PUBLIC_BUCKET).remove(pfade)
    },
    onSuccess: invalidate,
  })

  return { hochladen, aendern, titelbild, loeschen }
}
