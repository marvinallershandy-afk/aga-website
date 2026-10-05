// ─────────────────────────────────────────────────────────────────────────────
// Supabase Edge Function: backup (v19-B)
// Täglicher JSON-Export aller sva_*/sm_*-Tabellen (ohne Kochsafe) in den
// privaten Storage-Bucket `sva_backup`. Datei pro Tag; älter als 30 Tage wird
// gelöscht.
//
// Aufruf:
//   · Zeitplan (Netlify Scheduled Function backup-taeglich.mts) → Header
//     x-cron-secret: <BACKUP_CRON_SECRET>.
//   · Admin-Knopf (optional) → Authorization mit User-JWT, is_sm_admin().
//
// DEPLOY: mit --no-verify-jwt (der Cron-Aufruf hat kein JWT). Secret:
// BACKUP_CRON_SECRET. SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY stellt die
// Plattform bereit. Der Dump läuft mit service_role (RPC sva_backup_dump).
// ─────────────────────────────────────────────────────────────────────────────
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const BUCKET = 'sva_backup'
const AUFBEWAHRUNG_TAGE = 30

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  const url = Deno.env.get('SUPABASE_URL')!
  const admin: SupabaseClient = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  })

  // ── Berechtigung: Cron-Secret ODER Admin-JWT ──────────────────────────────
  const cronSecret = Deno.env.get('BACKUP_CRON_SECRET')?.trim()
  const reqSecret = req.headers.get('x-cron-secret')?.trim()
  if (!(cronSecret && reqSecret && reqSecret === cronSecret)) {
    const authHeader = req.headers.get('Authorization') ?? ''
    if (!authHeader) return json({ error: 'not_authenticated' }, 401)
    const asUser = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData } = await asUser.auth.getUser()
    if (!userData?.user) return json({ error: 'not_authenticated' }, 401)
    const rpc = await asUser.rpc('is_sm_admin')
    if (rpc.error || rpc.data !== true) return json({ error: 'not_admin' }, 403)
  }

  try {
    // ── 1. Voll-Dump ziehen ─────────────────────────────────────────────────
    const { data: dump, error: dumpErr } = await admin.rpc('sva_backup_dump')
    if (dumpErr) throw new Error(`sva_backup_dump fehlgeschlagen: ${dumpErr.message}`)

    const inhalt = JSON.stringify(dump)
    const heute = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
    const datei = `backup-${heute}.json`

    // ── 2. Hochladen (gleicher Tag überschreibt) ──────────────────────────────
    const { error: upErr } = await admin.storage.from(BUCKET).upload(datei, new Blob([inhalt], { type: 'application/json' }), {
      contentType: 'application/json',
      upsert: true,
    })
    if (upErr) {
      if (/bucket not found/i.test(upErr.message)) {
        throw new Error('Bucket sva_backup fehlt — Migration 20261010120000 noch nicht angewandt.')
      }
      throw new Error(`Upload fehlgeschlagen: ${upErr.message}`)
    }

    // ── 3. Alte Backups (> 30 Tage) löschen ───────────────────────────────────
    const grenze = Date.now() - AUFBEWAHRUNG_TAGE * 24 * 3600 * 1000
    const { data: dateien, error: listErr } = await admin.storage.from(BUCKET).list('', { limit: 1000 })
    let geloescht = 0
    if (!listErr && dateien) {
      const zuAlt = dateien
        .filter((f) => {
          const m = f.name.match(/backup-(\d{4}-\d{2}-\d{2})\.json$/)
          const stamp = m ? new Date(m[1]).getTime() : (f.created_at ? new Date(f.created_at).getTime() : NaN)
          return Number.isFinite(stamp) && stamp < grenze
        })
        .map((f) => f.name)
      if (zuAlt.length) {
        const { error: delErr } = await admin.storage.from(BUCKET).remove(zuAlt)
        if (!delErr) geloescht = zuAlt.length
        else console.error('backup: Aufräumen fehlgeschlagen:', delErr.message)
      }
    }

    const tableCount = (dump as { tableCount?: number } | null)?.tableCount ?? null
    return json({ ok: true, datei, bytes: inhalt.length, tabellen: tableCount, geloescht })
  } catch (e) {
    const fehler = e instanceof Error ? e.message : String(e)
    console.error('backup:', fehler)
    return json({ ok: false, error: 'backup_failed', detail: fehler }, 500)
  }
})
