// Supabase Edge Function: drive-bridge
// Liest/legt Google-Drive-Ordner an — für die Live-Ansicht im SVA-Admin.
// Sicherheit:
//  - verify_jwt=true (Gateway) → nur eingeloggte Nutzer erreichen die Function.
//  - zusätzlich: Aufrufer muss in sm_admins stehen (RLS-Self-Select).
//  - Google-Zugriff über OAuth-Refresh-Token (Secrets) — NUR list + create_folder,
//    kein Löschen/Verschieben (minimaler Blast-Radius).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

async function googleAccessToken(): Promise<string | null> {
  const client_id = Deno.env.get('GDRIVE_CLIENT_ID')
  const client_secret = Deno.env.get('GDRIVE_CLIENT_SECRET')
  const refresh_token = Deno.env.get('GDRIVE_REFRESH_TOKEN')
  if (!client_id || !client_secret || !refresh_token) return null
  const body = new URLSearchParams({ client_id, client_secret, refresh_token, grant_type: 'refresh_token' })
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', body })
  if (!r.ok) throw new Error(`Google-Token-Refresh fehlgeschlagen (${r.status})`)
  const j = await r.json()
  return j.access_token as string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    )

    // 1) Eingeloggt?
    const { data: userData } = await supabase.auth.getUser()
    if (!userData?.user) return json({ error: 'not_authenticated' }, 401)

    // 2) sm-Admin? (RLS-Self-Select liefert nur die eigene Zeile, wenn freigeschaltet)
    const { data: adminRows, error: adminErr } = await supabase.from('sm_admins').select('email').limit(1)
    if (adminErr) return json({ error: 'admin_check_failed', detail: adminErr.message }, 500)
    if (!adminRows || adminRows.length === 0) return json({ error: 'not_admin' }, 403)

    // 3) Google-Zugang konfiguriert?
    const token = await googleAccessToken()
    if (!token) return json({ configured: false }, 200)

    const { action, folderId, name, parentId } = await req.json().catch(() => ({}))

    if (action === 'list') {
      if (!folderId) return json({ error: 'folderId_required' }, 400)
      const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`)
      const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,webViewLink,size)')
      const r = await fetch(
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=${fields}&orderBy=folder,name&pageSize=200&supportsAllDrives=true&includeItemsFromAllDrives=true`,
        { headers: { Authorization: `Bearer ${token}` } },
      )
      const j = await r.json()
      if (!r.ok) return json({ error: 'drive_list_failed', detail: j?.error?.message }, 502)
      return json({ configured: true, files: j.files ?? [] })
    }

    if (action === 'create_folder') {
      if (!name || !parentId) return json({ error: 'name_and_parentId_required' }, 400)
      const r = await fetch('https://www.googleapis.com/drive/v3/files?fields=id,name,webViewLink&supportsAllDrives=true', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: [parentId] }),
      })
      const j = await r.json()
      if (!r.ok) return json({ error: 'drive_create_failed', detail: j?.error?.message }, 502)
      return json({ configured: true, folder: j })
    }

    return json({ error: 'unknown_action' }, 400)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
