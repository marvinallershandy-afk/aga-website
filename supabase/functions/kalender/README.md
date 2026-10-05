# Edge Function `kalender` (v18-A)

Spielplan als Kalender (ICS, RFC 5545) — öffentlich, ohne Login.

| Adresse (Website, Netlify-Proxy) | Inhalt |
|---|---|
| `/kalender.ics` | Abo: alle Heimspiele (aktualisiert sich alle 6 h) |
| `/kalender-alle.ics` | Abo: Heim- und Auswärtsspiele |
| `/kalender.ics?spiel=<id>` bzw. `?anstoss=<ISO>` | ein einzelnes Spiel zum Hinzufügen (iPhone/Mac) |

Daten: nur die öffentliche RPC `web_kalender()` (Migration
`20261009090000_sva_alltag.sql`) mit dem anon-Key — keine Notizen, Testspiele
mit „(TEST)“ im Gegnernamen ausgeblendet. Die Function speichert nichts.

## Deploy (nach Review)

1. Migration `supabase/migrations/20261009090000_sva_alltag.sql` anwenden.
2. Function deployen — **ohne JWT-Prüfung**, weil Kalender-Apps keinen Login schicken:
   ```bash
   npx supabase functions deploy kalender --project-ref fwiivwmoyagcdrjvhaou --use-api --no-verify-jwt
   ```
3. Optional: Website-Adresse für die Links in den Terminen (Standard: Netlify-Adresse;
   `aga-erste.de` wird automatisch erkannt, sobald die Domain über Netlify läuft):
   ```bash
   npx supabase secrets set SITE_URL=https://aga-erste.de --project-ref fwiivwmoyagcdrjvhaou
   ```
4. Prüfen:
   ```bash
   curl -sI https://fwiivwmoyagcdrjvhaou.supabase.co/functions/v1/kalender | grep -i content-type   # text/calendar
   curl -s  https://<website>/kalender.ics | head -20
   ```

## Tests

```bash
node supabase/functions/kalender/ics.test.mjs
# mit echtem Parser (Scratch, keine Projekt-Abhängigkeit):
mkdir -p /tmp/ical && (cd /tmp/ical && npm i ical.js)
ICALJS=/tmp/ical/node_modules/ical.js/dist/ical.js node supabase/functions/kalender/ics.test.mjs
```
