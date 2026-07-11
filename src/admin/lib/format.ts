// Datums-Helfer für die Wochenansicht (ISO-Wochen, Mo–So).

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

export function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

// Montag der Woche, in der `ref` liegt.
export function startOfWeek(ref: Date): Date {
  const d = new Date(ref)
  d.setHours(0, 0, 0, 0)
  const day = (d.getDay() + 6) % 7 // Mo=0 … So=6
  d.setDate(d.getDate() - day)
  return d
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export function weekDays(monday: Date): { date: Date; iso: string; label: string; dayLabel: string }[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(monday, i)
    return {
      date,
      iso: toISODate(date),
      label: `${date.getDate()}.${date.getMonth() + 1}.`,
      dayLabel: WOCHENTAGE[i],
    }
  })
}

export function formatDateShort(iso: string | null): string {
  if (!iso) return '—'
  const [y, m, d] = iso.split('-')
  return `${d}.${m}.${y.slice(2)}`
}

// KW-Nummer (ISO 8601) für die Wochen-Überschrift.
export function isoWeekNumber(ref: Date): number {
  const d = new Date(Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate()))
  const dayNum = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dayNum + 3)
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  return 1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000))
}

/** Anstoß-Zeit als „So, 13.07. · 15:00 Uhr" (lokale Zeit). */
export function formatAnstoss(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const tag = d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')
  const datum = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })
  const zeit = d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
  return `${tag}, ${datum} · ${zeit} Uhr`
}
