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

// Upload in den privaten Bucket sm_grafiken (nur Admins via RLS).
export async function uploadGrafik(blob: Blob, path: string): Promise<string> {
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, {
    contentType: 'image/png',
    upsert: true,
  })
  if (error) throw error
  return path
}

// Fehlt der Bucket (Migration 20260719091000 noch nicht angewandt), meldet
// Supabase Storage „Bucket not found" (Status 404). Dann degradiert der
// Generator sauber auf reinen PNG-Download.
export function isBucketMissing(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false
  const e = err as { message?: string; statusCode?: string; status?: number }
  const msg = (e.message ?? '').toLowerCase()
  return msg.includes('bucket not found') || e.statusCode === '404' || e.status === 404
}

// Drive-Zielordner nach SME-Ablage-Konvention (STAGE0 §2.2):
//   SVA Media / Saison <saison> / Spieltag <nr>
// Der eigentliche Upload in Drive läuft über den n8n-Flow „grafik.gerendert"
// (P2-Webhook) — dieser Pfad wird nur als Zielangabe im Payload mitgegeben.
export function driveTargetFolder(saison: string, spieltagNr: number | null): string {
  const st = spieltagNr != null ? `Spieltag ${spieltagNr}` : 'Spieltag –'
  return `SVA Media / Saison ${saison} / ${st}`
}

// Aktuelle Saison als „YYYY/YY" (Fußball-Saison läuft über den Jahreswechsel).
// Quelle bewusst simpel gehalten; beim SME-Backfill kann die Saison aus
// `matches` kommen statt aus dem Kalenderdatum.
export function currentSaison(now = new Date()): string {
  const y = now.getFullYear()
  // Ab Juli zählt die neue Saison (y/y+1), davor die laufende (y-1/y).
  const start = now.getMonth() >= 6 ? y : y - 1
  return `${start}/${String((start + 1) % 100).padStart(2, '0')}`
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
