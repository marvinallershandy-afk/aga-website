// Gemeinsamer Trigger für die geplanten FuPa-Abgleiche.
// Ruft die Supabase-Edge-Function `fupa-sync` mit dem Cron-Secret auf.
// Liegt bewusst UNTER netlify/lib (nicht netlify/functions) — damit Netlify es
// NICHT selbst als Function einsammelt, sondern nur die dünnen Zeitplan-Wrapper.
export async function triggerFupaSync(label: string): Promise<Response> {
  const url = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const secret = process.env.FUPA_CRON_SECRET
  if (!url || !secret) {
    // Kein Fehler-Alarm: solange die Secrets fehlen, ist der Zeitplan schlicht untätig.
    return new Response(`fupa-sync (${label}) übersprungen — SUPABASE_URL/FUPA_CRON_SECRET fehlen`, { status: 200 })
  }
  try {
    const r = await fetch(`${url}/functions/v1/fupa-sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-cron-secret': secret },
      body: '{}',
    })
    const text = await r.text()
    return new Response(`fupa-sync (${label}) → HTTP ${r.status}: ${text.slice(0, 300)}`, { status: r.ok ? 200 : 502 })
  } catch (e) {
    return new Response(`fupa-sync (${label}) Fehler: ${e instanceof Error ? e.message : String(e)}`, { status: 502 })
  }
}
