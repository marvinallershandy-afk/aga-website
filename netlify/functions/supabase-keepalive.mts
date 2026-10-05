// Täglicher Ping, damit das Supabase-Gratisprojekt nicht nach 7 Tagen ohne
// Aktivität pausiert (Okt. 2026 schon einmal passiert → Admin war offline).
// Netlify Scheduled Function: läuft nur auf Produktions-Deploys.
// Nutzt dieselben Build-Env-Vars wie scripts/fetch-content.mjs.
import type { Config } from '@netlify/functions'

export default async () => {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
  const key = process.env.SUPABASE_READ_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return new Response('SUPABASE_URL/SUPABASE_READ_KEY fehlen', { status: 500 })
  const res = await fetch(`${url}/rest/v1/rpc/web_snapshot`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: '{}',
  })
  return new Response(`keepalive ${res.status}`, { status: res.ok ? 200 : 502 })
}

export const config: Config = { schedule: '@daily' }
