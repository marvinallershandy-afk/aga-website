# Backup & Restore (v19-B)

Das Supabase-Free-Tier hat **keine automatischen Restore-Punkte**. Kader, Spiele,
Album-Stände und Statistik leben nur in dieser einen Datenbank. Darum sichert ein
täglicher Job alles Wichtige als JSON in einen privaten Storage-Bucket.

## Was gesichert wird

- **Alle Tabellen** `sva_*` und `sm_*` (Kader, Spiele, Tabelle, Album, Statistik,
  Einstellungen, Ticker, Partner, Galerien, Protokolle …).
- **Kochsafe** (`sme_*`, `rezepte`, `haushalte` …) wird bewusst **nicht**
  mitgesichert.
- Dateien im Storage (Fotos im Bucket `sva_public`) sind **kein** Teil dieses
  Backups — sie liegen gespiegelt in `public/generated/` aus jedem Website-Build.

## Wie es läuft

| Teil | Datei |
|---|---|
| Voll-Export als `jsonb` (SECURITY DEFINER, nur service_role) | RPC `sva_backup_dump()` (Migration `20261010120000_sva_backup_bucket.sql`) |
| Privater Bucket, nur service_role | `sva_backup` (gleiche Migration) |
| Export + Upload + Aufräumen (> 30 Tage) | Edge Function `backup` (`supabase/functions/backup/`) |
| Zeitplan 02:00 UTC (≈ 03:00–04:00 Ortszeit) | Netlify Scheduled Function `backup-taeglich.mts` |

Jeder Tag landet als `sva_backup/backup-YYYY-MM-DD.json`. Gleicher Tag überschreibt
sich. Dateien älter als **30 Tage** werden automatisch gelöscht.

## Einrichten (einmalig, Deploy)

1. Migration anwenden: `supabase db push` (oder die Datei im Dashboard ausführen).
2. Edge Function deployen: `supabase functions deploy backup --no-verify-jwt`.
3. Secret setzen (gleicher Wert in Supabase **und** Netlify):
   - `supabase secrets set BACKUP_CRON_SECRET=<zufälliger langer Wert>`
   - Netlify → Site settings → Environment variables → `BACKUP_CRON_SECRET` = derselbe Wert.
4. `SUPABASE_URL` muss in Netlify gesetzt sein (ist es für den Build schon).
5. Nach dem nächsten Production-Deploy läuft `backup-taeglich` automatisch.

**Probe:** Edge Function einmal von Hand auslösen (im Supabase-Dashboard →
Functions → backup → Invoke, Header `x-cron-secret`), dann im Storage prüfen, dass
`backup-<heute>.json` liegt. Oder `curl` siehe unten.

```bash
curl -X POST "$SUPABASE_URL/functions/v1/backup" \
  -H "x-cron-secret: $BACKUP_CRON_SECRET" -H "Content-Type: application/json" -d '{}'
# → {"ok":true,"datei":"backup-2026-10-06.json","bytes":…,"tabellen":…,"geloescht":…}
```

## Restore (im Notfall)

Das Skript `scripts/backup/restore.mjs` spielt ein Backup zurück. **Standard ist
Trockenlauf** — es schreibt nur mit `--execute --yes`. Es **löscht nie**, sondern
spielt per Upsert (`onConflict id`) ein.

```bash
# 1) Trockenlauf aus der jüngsten Bucket-Datei (zeigt Tabellen + Zeilenzahlen):
export SUPABASE_URL=https://fwiivwmoyagcdrjvhaou.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>   # NIE committen/teilen
node scripts/backup/restore.mjs --from-bucket

# 2) Eine einzelne Tabelle zurückspielen (z. B. versehentlich gelöschte Spiele):
node scripts/backup/restore.mjs --from-bucket --table sm_spiele --execute --yes

# 3) Aus einer heruntergeladenen Datei:
node scripts/backup/restore.mjs --file backup-2026-10-06.json --execute --yes
```

### Wichtig beim Restore

- **Erst Trockenlauf**, Zeilenzahlen prüfen, dann `--execute --yes`.
- Upsert überschreibt vorhandene Zeilen gleicher `id`, legt fehlende neu an.
  Zeilen, die seit dem Backup **neu** dazukamen und nicht im Backup stehen,
  bleiben erhalten (es wird nichts gelöscht).
- Bei kompletten Wiederherstellungen sinnvolle Reihenfolge wegen Fremdschlüsseln:
  zuerst `sm_spiele`, `sm_roster`, `sva_settings`, dann abhängige Tabellen
  (`sva_ticker`, `sva_lineup`, `sva_album_*`). Das Skript geht alphabetisch durch;
  bei FK-Fehlern einzelne Tabellen gezielt mit `--table` nachziehen.
- Der Service-Role-Key ist ein Vollzugriff-Schlüssel: nur lokal in der Shell
  setzen, niemals in Dateien/Chats.
