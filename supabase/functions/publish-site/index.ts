// Supabase Edge Function: publish-site
// „Website veröffentlichen" aus dem Admin: stößt einen neuen Netlify-Build an.
// Der Build holt dabei per web_snapshot() den aktuellen Stand aus der DB und
// backt ihn statisch in die Website (scripts/fetch-content.mjs).
//
// Sicherheit:
//  - verify_jwt=true (Gateway-Default) → nur eingeloggte Nutzer erreichen die Function.
//  - zusätzlich: Aufrufer muss in sm_admins stehen (RLS-Self-Select, wie drive-bridge).
//  - Die Build-Hook-URL liegt NUR als Supabase-Secret NETLIFY_BUILD_HOOK vor —
//    nie im Browser-Bundle, nie in der DB.
//  - Schutz vor Dauerklicks: höchstens ein erfolgreicher Build-Anstoß pro 60 s.
//  - Jeder Versuch wird in sva_publish_log protokolliert (wer, wann, Ergebnis).
import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const COOLDOWN_MS = 60_000
// Netlify-Build-Hooks haben immer diese Form — alles andere wird abgelehnt,
// damit ein falsch gesetztes Secret nicht beliebige URLs aufruft.
const HOOK_PATTERN = /^https:\/\/api\.netlify\.com\/build_hooks\/[A-Za-z0-9]+$/

function json(obj: unknown, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization') ?? ''
    const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
    })

    // 1) Eingeloggt?
    const { data: userData } = await supabase.auth.getUser()
    const email = userData?.user?.email ?? null
    if (!userData?.user) return json({ error: 'not_authenticated' }, 401)

    // 2) Vereins-Admin? (RLS-Self-Select liefert nur die eigene Zeile, wenn freigeschaltet)
    const { data: adminRows, error: adminErr } = await supabase.from('sm_admins').select('email').limit(1)
    if (adminErr) return json({ error: 'admin_check_failed', detail: adminErr.message }, 500)
    if (!adminRows || adminRows.length === 0) return json({ error: 'not_admin' }, 403)

    const log = async (status: 'ok' | 'fehler' | 'nicht_konfiguriert', detail: string | null) => {
      const { error } = await supabase
        .from('sva_publish_log')
        .insert({ angefordert_von: email, status, detail })
      if (error) console.error('publish-site: Protokoll fehlgeschlagen', error.message)
    }

    // 3) Build-Hook konfiguriert?
    const hook = Deno.env.get('NETLIFY_BUILD_HOOK')?.trim()
    if (!hook || !HOOK_PATTERN.test(hook)) {
      await log('nicht_konfiguriert', hook ? 'NETLIFY_BUILD_HOOK hat ein unerwartetes Format' : 'NETLIFY_BUILD_HOOK fehlt')
      return json({ configured: false })
    }

    // 4) Cooldown: letzter erfolgreicher Anstoß < 60 s her?
    const { data: last } = await supabase
      .from('sva_publish_log')
      .select('angefordert_at')
      .eq('status', 'ok')
      .order('angefordert_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (last?.angefordert_at) {
      const seit = Date.now() - new Date(last.angefordert_at).getTime()
      if (seit < COOLDOWN_MS) {
        return json({ configured: true, ok: false, cooldown: true, retryInSeconds: Math.ceil((COOLDOWN_MS - seit) / 1000) })
      }
    }

    // 5) Netlify-Build anstoßen (Titel erscheint im Netlify-Deploy-Log).
    const title = encodeURIComponent(`Admin: Website veröffentlichen (${email ?? 'unbekannt'})`)
    const r = await fetch(`${hook}?trigger_title=${title}`, { method: 'POST', body: '{}' })
    if (!r.ok) {
      await log('fehler', `Netlify antwortete mit HTTP ${r.status}`)
      return json({ configured: true, ok: false, error: 'netlify_failed', status: r.status }, 502)
    }

    await log('ok', null)
    return json({ configured: true, ok: true, startedAt: new Date().toISOString() })
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
