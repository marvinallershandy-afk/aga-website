import { toBlob } from 'html-to-image'
import { supabase } from '../lib/supabase'

export const STORAGE_BUCKET = 'sm_grafiken'

// Rendert einen DOM-Knoten exakt in seiner natürlichen Pixelgröße als PNG-Blob.
export async function nodeToPngBlob(node: HTMLElement, width: number, height: number): Promise<Blob> {
  // Fonts (Anton/Archivo) müssen geladen sein, sonst fällt der Export auf System-Fonts zurück.
  if (document.fonts?.ready) await document.fonts.ready
  const blob = await toBlob(node, {
    width,
    height,
    pixelRatio: 1,
    cacheBust: true,
    backgroundColor: '#0E0D0D',
  })
  if (!blob) throw new Error('PNG-Export fehlgeschlagen.')
  return blob
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

// Optionaler Upload in den privaten Bucket sm_grafiken (nur Admins via RLS).
export async function uploadGrafik(blob: Blob, path: string): Promise<string> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) throw error
  return path
}

// Dateiname deterministisch aus Feldern bauen (ohne Date.now — reproduzierbar).
export function buildFilename(template: string, format: string, heim: string, gast: string): string {
  const combiningMarks = /[̀-ͯ]/g
  const slug = (s: string) =>
    s
      .toLowerCase()
      .normalize('NFD')
      .replace(combiningMarks, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 40)
  return `sva-${template}-${slug(heim)}-vs-${slug(gast)}-${format}.png`
}
