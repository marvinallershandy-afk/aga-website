// Tägliches Backup um 02:00 UTC (= 03:00 CET / 04:00 CEST). Ruft die Supabase-
// Edge-Function `backup` mit dem Cron-Secret auf. Netlify schickt bei einem
// Nicht-200-Ergebnis eine Deploy-/Function-Mail (siehe docs/LIVEGANG.md).
import type { Config } from '@netlify/functions'

export default async () => {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const secret = process.env.BACKUP_CRON_SECRET
  if (!url || !secret) {
    return new Response('backup übersprungen — SUPABASE_URL/BACKUP_CRON_SECRET fehlen', { status: 200 })
  }
  try {
    const r = await fetch(`${url}/functions/v1/backup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
      body: '{}',
    })
    const text = await r.text()
    return new Response(`backup → HTTP ${r.status}: ${text.slice(0, 300)}`, { status: r.ok ? 200 : 502 })
  } catch (e) {
    return new Response(`backup Fehler: ${e instanceof Error ? e.message : String(e)}`, { status: 502 })
  }
}

export const config: Config = { schedule: '0 2 * * *' }
