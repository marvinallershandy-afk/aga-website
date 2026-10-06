// v25-C5: Öffentlicher Live-Endpunkt mit CDN-Cache vor der Datenbank.
//
// Problem: /live und /tippen pollen während eines Spiels alle 15–20 s web_live().
// An einem Spieltag mit vielen Zuschauern am Handy summiert sich das zu vielen
// identischen RPC-Aufrufen gegen Supabase. Diese Function ruft web_live() EINMAL
// mit dem Anon-Key und lässt das Netlify-CDN die Antwort 10 s cachen (plus 20 s
// stale-while-revalidate) — die DB sieht höchstens ~1 Abruf alle 10 s, egal wie
// viele Fans zuschauen. RLS/SECURITY DEFINER schützen die Daten wie bisher.
//
// Die Seite nutzt diesen Endpunkt fürs öffentliche Polling und fällt bei einem
// Fehler auf den direkten RPC zurück (fetchLive). Die Vorführung (web_live_demo)
// bleibt unverändert und geht NICHT über diese Function.
export default async (_req: Request) => {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const key = process.env.SUPABASE_READ_KEY ?? process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) {
    return new Response(JSON.stringify({ fehler: 'nicht_eingerichtet' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  let upstream: Response
  try {
    upstream = await fetch(`${url}/rest/v1/rpc/web_live`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
    })
  } catch {
    return new Response(JSON.stringify({ fehler: 'upstream' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  if (!upstream.ok) {
    return new Response(JSON.stringify({ fehler: 'upstream', status: upstream.status }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    })
  }
  const body = await upstream.text()
  return new Response(body, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      // Nur das Netlify-CDN cacht; der Browser nicht (immer frisch vom Edge holen).
      'Netlify-CDN-Cache-Control': 'public, s-maxage=10, stale-while-revalidate=20',
      'Cache-Control': 'no-store',
      'X-Robots-Tag': 'noindex',
    },
  })
}

// Kein config.path: erreichbar über /.netlify/functions/live, /api/live per Rewrite
// in netlify.toml (vor dem 404-Catch-all) — mit config.path wäre der Rewrite tot.
