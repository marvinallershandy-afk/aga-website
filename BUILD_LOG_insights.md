# BUILD_LOG — Instagram-Tageserfassung

**Branch:** `feat/insights-daily` (von `release`) · **Kein Push, kein Merge, kein Go-Live.**
**Grundsatz:** roh speichern, aufbereitet anzeigen — Tages-Rohtabelle, append-only, nie UPDATE.

## Was gebaut wurde (3 Pakete, je 1 Commit)

| # | Artefakt | Commit |
|---|---|---|
| 1 | `supabase/migrations/20260731120000_sm_insights_daily.sql` | `f4b1605` |
| 2 | `n8n/instagram-insights-daily.json` | `5d5769b` |
| 3 | `docs/INSTAGRAM_INSIGHTS.md` | `3e225cb` |

### 1 · Migration `sm_insights_daily`
- Neue, von `sm_insights` getrennte Rohtabelle (Begründung gegen echtes Schema in der Doku,
  Abschnitt 1): `sm_insights` ist upsert-basierte Wochen-Handeingabe ohne Beitrags-/Story-
  Ebene/Roh-JSON → bleibt unangetastet.
- Diskriminator `ebene` (konto/beitrag/story) + `object_id` + `snapshot_date` + `captured_at`;
  typisiertes Metrik-Superset (nullable) + `raw jsonb` für ALLES.
- **Append-only hart:** BEFORE-UPDATE-Trigger sperrt jedes UPDATE (auch service_role).
  Partielle Unique-Indizes: Konto/Beitrag = 1 Zeile/Objekt/Tag (Re-Run → ON CONFLICT DO
  NOTHING); Story = mehrere Captures/Tag erlaubt (Metriken wachsen über 24 h, Read nimmt MAX).
- RLS: nur `is_sm_admin()` select; Schreibpfad ausschließlich `service_role` via RPC
  `sm_insert_insights_daily(jsonb)` (execute nur service_role).
- **Statisch geprüft:** pglast/libpg_query — 23 Statements parsen sauber. Migration-Kommentar
  „anzuwenden nach Restore (Leitstand/MCP)". **Nicht angewendet.**

### 2 · n8n-Workflow (ein importierbares JSON, `active:false`)
- Pipeline Konto+Beiträge: 60-Tage-Fenster (self-healing), gespeist von [Schedule täglich
  03:15] UND [Manueller Backfill] — Backfill = Run-now derselben 60-Tage-Logik (Juli komplett).
  Medienliste paginiert, Metric-Set je Medientyp getailort.
- Pipeline Stories: [Schedule alle 3 h], greift aktive Stories vor 24-h-Ablauf.
- Append nur via RPC (service_role). Rate-Limit via httpRequest-Batching; Fehlerpfade
  (onError-Ausgang → NoOp überspringen, retry). Token/Key nur als Credential-Referenzen,
  ig-user-id/Supabase-URL als markierte Platzhalter.
- **Statisch geprüft:** jq-valide · 25 Nodes · alle Connections auflösbar · Node-Namen
  eindeutig · 7 jsCode-Blöcke via `node --check` gültig · keine Secrets im JSON.
  **Nicht importiert, nicht aktiviert, keine Live-Calls.**

### 3 · Doku `docs/INSTAGRAM_INSIGHTS.md`
Zieltabellen-Begründung · Graph-API-Metriken je Ebene · Backfill-Grenzen
(60 Tage/1000 Posts/Stories-24 h) · Intervall-Begründung · vollständige Go-Live-Checkliste.

## Marvins Go-Live-Schritte (Kurzfassung, Details in der Doku Abschnitt 6)
1. Supabase entpausen (Restore). 2. Migration anwenden (Leitstand/MCP). 3. Meta: IG-Business
+ FB-Seite, App-Review `instagram_basic`/`instagram_manage_insights`, Long-lived Token +
ig-user-id. 4. n8n-Credentials anlegen (Meta Query-Auth + Supabase service_role). 5. Platz-
halter `__IG_USER_ID__` / `__PROJECT_REF__` in beiden Config-Nodes füllen. 6. Workflow
importieren. 7. Backfill-Trigger einmal starten, per SELECT prüfen. 8. Schedules aktivieren.

## Offene Punkte / ehrlich gekennzeichnet
- Alles ohne Live-DB/echte API ist **statisch geprüft** (pglast, jq, `node --check`) — echte
  End-to-End-Verifikation gehört in Marvins Go-Live.
- v21-deprecatete Konto-Metriken (profile_views/website_clicks/impressions) sind nullable +
  `follower_demographics` best-effort — reale Verfügbarkeit zeigt sich erst am Live-Token.
- n8n-Pagination/Batching-Parameter strukturell gesetzt, am Live-Volumen feinjustierbar.

## Disziplin
- 3 Pakete, je eigener Commit auf `feat/insights-daily`. Working Tree clean (die untracked
  `screenshots-*/` und `BUILDSPEC_aga.md` wurden absichtsgemäß NICHT angefasst/committet).
- Vereins-Supabase `fwiivwmoyagcdrjvhaou` pausiert — nicht restauriert, keine Live-API-Calls.
