// Zentrale Vokabulare für den Redaktionsplan & Ideen-Pool.
// Werte entsprechen exakt den DB-Spalten (sm_content / sm_ideen_pool).

export const KANAELE = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'facebook', label: 'Facebook' },
  { value: 'tiktok', label: 'TikTok' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'website', label: 'Website' },
] as const
export type Kanal = (typeof KANAELE)[number]['value']

export const STATUS = [
  { value: 'idee', label: 'Idee', dot: '#8a8a8a' },
  { value: 'geplant', label: 'Geplant', dot: '#3b82f6' },
  { value: 'in_arbeit', label: 'In Arbeit', dot: '#E8C15A' },
  { value: 'fertig', label: 'Fertig', dot: '#22c55e' },
  { value: 'veroeffentlicht', label: 'Veröffentlicht', dot: '#E91D29' },
] as const
export type Status = (typeof STATUS)[number]['value']

export const FORMATE = ['Post', 'Story', 'Reel', 'Karussell', 'Grafik', 'Video'] as const
export type Format = (typeof FORMATE)[number]

export const KATEGORIEN = ['Spieltag', 'Team', 'Verein', 'Community', 'Sponsoren'] as const
export type Kategorie = (typeof KATEGORIEN)[number]

export const RHYTHMEN = [
  { value: 'pro_spieltag', label: 'Pro Spieltag' },
  { value: 'woechentlich', label: 'Wöchentlich' },
  { value: 'monatlich', label: 'Monatlich' },
  { value: 'einmalig', label: 'Einmalig' },
] as const

// Hilfsfunktionen für Label-Auflösung
export function kanalLabel(v: string): string {
  return KANAELE.find((k) => k.value === v)?.label ?? v
}
export function statusMeta(v: string) {
  return STATUS.find((s) => s.value === v) ?? { value: v, label: v, dot: '#8a8a8a' }
}
export function rhythmusLabel(v: string | null): string {
  if (!v) return '—'
  return RHYTHMEN.find((r) => r.value === v)?.label ?? v
}
