# Instagram-Tageserfassung (Insights)

**Grundsatz:** ROH SPEICHERN, AUFBEREITET ANZEIGEN. Instagram gibt Historie nur
begrenzt rückwirkend her — was nicht täglich weggeschrieben wird, ist später weg.

**Status:** Artefakte gebaut und statisch geprüft, **NICHT deployed / NICHT Go-Live.**
Das Vereins-Supabase `fwiivwmoyagcdrjvhaou` ist pausiert; die Migration ist **nach
Restore** anzuwenden, der n8n-Flow ist **nicht** importiert. Live-Verifikation =
Marvins Go-Live (siehe Abschnitt 6).

Artefakte:
- Migration: `supabase/migrations/20260731120000_sm_insights_daily.sql`
- n8n-Workflow: `n8n/instagram-insights-daily.json`
- diese Doku

---

## 1 · Zieltabelle & Begründung

**Entscheidung: neue eigene Tabelle `sm_insights_daily`** im Vereinsprojekt — bewusst
getrennt von `sm_insights` und von SME-`analytics_snapshots`.

Geprüft gegen das **echte** `sm_insights`-Schema (Migration `20260711020000`):

| Aspekt | `sm_insights` (Bestand) | Anforderung Tageserfassung |
|---|---|---|
| Felder | `follower · reichweite · top_beitrag · notizen`, `unique(datum,kanal)` | Konto + je-Beitrag + je-Story, Rohwerte |
| Schreibmuster | **Upsert mit `update`-Policy** (Handeingabe, überschreibbar) | **append-only, nie UPDATE** |
| Körnung | wochenverdichtet (`reichweite` ohne dokumentiertes Bezugsfenster) | tagesgranular, Bezugstag typisiert |
| Beitrags-/Story-Ebene | keine (nur `top_beitrag` als Freitext) | eigene Zeilen je `media_id` / `story_id` |
| Roh-JSON | keine | `raw jsonb` für ALLES |

`sm_insights` ist damit strukturell ungeeignet und bleibt für die Alt-Handeingaben
erhalten. `analytics_snapshots` gehört zu SME (post-granular, eigenes Phasenmodell) und
wird hier nicht zweckentfremdet. → **Getrennte Roh-Tabelle bestätigt.**

### Schema-Kern (`sm_insights_daily`)
- **Diskriminator** `ebene` ∈ `konto | beitrag | story` + `object_id` (ig-user-id /
  media-id / story-id) + `snapshot_date` + `captured_at`.
- **Typisiertes Metrik-Superset** (nullable, je Ebene ist die relevante Teilmenge
  gefüllt): `reach, impressions, follower_count, views, likes, comments, shares, saved,
  engagement, total_interactions, profile_views, website_clicks, replies, exits,
  taps_forward, taps_back` + `online_followers jsonb`, `audience jsonb`.
- **`raw jsonb`** = ungefilterte API-Antwort je Objekt (Vollständigkeit vor Verdichtung
  — auch was heute niemand braucht).

### Append-only, kein UPDATE
- **BEFORE-UPDATE-Trigger** `sm_insights_daily_no_update` blockiert **jedes** UPDATE
  (auch `service_role`) → einmal erfasste Rohzeilen sind unveränderlich. Korrektur =
  neue Zeile mit späterem `captured_at`, nie Überschreiben.
- **Konto/Beitrag:** partieller Unique-Index `(ebene, object_id, snapshot_date)` →
  genau **eine Zeile je Objekt und Tag**. Re-Run desselben Tags → `ON CONFLICT DO
  NOTHING` (erste Erfassung gewinnt, keine Doppelzählung). Begründung: das 60-Tage-
  Fenster heilt verpasste Tage beim nächsten Lauf selbst — ein Re-Run darf den bereits
  gespeicherten Tageswert nicht klobbern.
- **Story:** partieller Unique-Index `(ebene, object_id, snapshot_date, captured_at)` →
  **mehrere Captures/Tag/Story erlaubt.** Begründung: Story-Metriken **wachsen** über die
  24 h; der enge Takt hängt je Lauf eine neue Zeile an, die Read-Seite nimmt den **MAX/
  letzten** Stand vor Ablauf. Nur exakt gleiches `captured_at` wird dedupliziert.

### RLS / Schreibpfad
- `enable row level security`; **nur** `is_sm_admin()` darf **select**en. Kein `anon`.
- **Keine** insert/update/delete-Policy für `authenticated` → aus dem Client kann niemand
  Rohdaten schreiben.
- Schreiben ausschließlich durch den **n8n-Writer über `service_role`** (umgeht RLS) via
  RPC **`sm_insert_insights_daily(p_rows jsonb)`** — kapselt Batch-Insert +
  `ON CONFLICT DO NOTHING` in versionierter SQL; `execute` nur für `service_role`
  (revoke von public/anon/authenticated).

---

## 2 · Graph-API-Metriken je Ebene

Basis: `https://graph.facebook.com/v21.0`. Voraussetzung: **Instagram Business/Creator-
Konto** verbunden mit einer **Facebook-Seite**; App-Review für `instagram_basic` +
`instagram_manage_insights`. Long-lived Token.

### Konto (`GET /{ig-user-id}/insights`, Zeitreihe)
- `reach` (`period=day`, `since`/`until`), `follower_count` (`period=day`).
- Best-effort: `follower_demographics` (`period=lifetime`, `metric_type=total_value`,
  `breakdown=country`) → Spalte `audience`.
- **Deprecatet mit v21 (08.01.2025)** und daher nicht verlässlich: `profile_views`,
  `website_clicks`, `impressions` (Kontoebene) u. a. Spalten existieren, werden aber nur
  gefüllt, falls die API sie noch liefert.

### Beitrag (`GET /{ig-media-id}/insights`)
- Metric-Set **je Medientyp getailort** (unsupported Metrik → Meta antwortet 400 für den
  ganzen Call):
  - Bild/Carousel: `reach,saved,likes,comments,shares,total_interactions`
  - Video/Reel: zusätzlich `views`
- Medien-Metadaten aus `GET /{ig-user-id}/media?fields=id,caption,media_type,
  media_product_type,permalink,timestamp,like_count,comments_count` (paginiert).

### Story (`GET /{ig-story-id}/insights`)
- `reach,replies,exits,taps_forward,taps_back,shares` — nur **während der 24-h-Lebens-
  dauer** abrufbar (Liste über `GET /{ig-user-id}/stories`).

### Rate-Limit
~200 Insights-Calls/Stunde/Nutzer. Der Workflow drosselt per httpRequest-**Batching**
(Beitrag: 30/Batch @1,2 s; Story: 20/Batch @1,2 s) und paginiert die Medienliste mit
`requestInterval` 700 ms, max. 20 Seiten.

---

## 3 · Backfill-Grenzen (API-hart)

- **Konto-Zeitreihe: nur ~60 Tage rückwirkend.** Älteres gibt die API nicht mehr her →
  **ab Juli täglich wegschreiben, sonst weg.** (Der einmalige Backfill zieht genau
  dieses 60-Tage-Fenster, inkl. Juli.)
- **Beitragsdaten:** letzte ~1000 Posts erreichbar, aber immer nur der **aktuelle**
  Zählerstand — kein Tagesverlauf pro Post ohne eigenes Log (das dieses Schema anlegt).
- **Stories: keinerlei Historie** (24 h). Lücke > 24 h = Story-Werte **endgültig weg**,
  heilen nie nach.

---

## 4 · Intervall-Begründung

- **Konto + Beitrag: täglich** genügt. Das 60-Tage-Fenster heilt eine verpasste Tageszeile
  beim nächsten Lauf selbst nach (`ON CONFLICT DO NOTHING` überschreibt nichts). Lauf
  03:15 Uhr.
- **Stories: enger Takt < 24 h (Vorrang!).** Eigener Job **alle 3 h**, greift aktive
  Stories vor Ablauf. Kritisch für das Man-of-the-Match-Format (Sponsoren-Nachweis).
  Bei Cron-Lücke: Konto/Beitrag nachholbar bis 60 Tage, **Stories verloren**.

---

## 5 · Workflow-Aufbau (`n8n/instagram-insights-daily.json`)

Ein Workflow, `active:false`, drei Trigger:

| Trigger | Pipeline | Zweck |
|---|---|---|
| Schedule „Täglich 03:15" | Konto + Beitrag | laufende Tageserfassung (60-Tage-Fenster) |
| Manuell „Backfill (60 Tage, einmalig)" | Konto + Beitrag | **einmaliger Backfill** = Run-now derselben 60-Tage-Logik |
| Schedule „Alle 3h (Stories)" | Stories | Story-Erfassung vor 24-h-Ablauf |

Der manuelle Backfill-Trigger und der tägliche Schedule speisen **dieselbe** Konto+Beitrag-
Pipeline (identisches 60-Tage-Fenster, da 60 Tage die API-Obergrenze ist) — den Backfill
startet man einmal von Hand, danach übernimmt der Schedule. Fehlgeschlagene Einzel-Calls
(Beitrag/Story) laufen über den Fehlerausgang in einen NoOp (überspringen), ohne den Lauf
zu killen. Append passiert gebündelt pro Lauf über einen einzigen RPC-Call.

**Statisch geprüft:** jq-valide · 25 Nodes · alle Connections auflösbar · Node-Namen
eindeutig · 7 jsCode-Blöcke via `node --check` gültig · keine Secrets im JSON (nur
Credential-Referenzen `PLACEHOLDER_SVA_META_TOKEN`, `PLACEHOLDER_SVA_SUPABASE` und die
markierten Platzhalter `__IG_USER_ID__`, `__PROJECT_REF__`). **Nicht importiert, nicht
aktiviert, keine Live-Calls** — Live-Verifikation ist Teil des Go-Live.

---

## 6 · Marvins Schritte zum Go-Live (nichts davon vom Builder ausgeführt)

1. **Supabase entpausen** (Restore von `fwiivwmoyagcdrjvhaou`). Ohne Ziel kein Schreiben.
   Der tägliche Zugriff verhindert danach das erneute Auto-Pausieren.
2. **Migration anwenden** `20260731120000_sm_insights_daily.sql` — über Leitstand/MCP
   nach Restore (nicht via ungeprüftem CLI-Push).
3. **Meta/Instagram vorbereiten:**
   - IG-Konto auf **Business/Creator** stellen und mit einer **Facebook-Seite** verbinden.
   - Meta-App mit **App-Review** für `instagram_basic` + `instagram_manage_insights`.
   - **Long-lived Access Token** erzeugen, die **ig-user-id** notieren.
4. **n8n-Credentials anlegen** (Werte nur in n8n, nie ins Repo):
   - `SVA Meta Graph Token (access_token)` — Typ **Query Auth**, Param-Name `access_token`,
     Wert = Long-lived Token → ersetzt `PLACEHOLDER_SVA_META_TOKEN`.
   - `SVA Supabase (service_role)` — Typ **Supabase API**, Host = Projekt-URL, Service-Role-
     Key → ersetzt `PLACEHOLDER_SVA_SUPABASE`.
5. **Platzhalter im Workflow füllen:** in beiden „Config"-Set-Nodes `__IG_USER_ID__` →
   echte ig-user-id, `https://__PROJECT_REF__.supabase.co` → echte Projekt-URL.
6. **Workflow importieren** (`n8n/instagram-insights-daily.json`) auf dem VPS.
7. **Backfill einmal starten:** manuellen Trigger „Backfill (60 Tage, einmalig)" ausführen
   → Juli + die letzten 60 Tage rein. Danach in `sm_insights_daily` per SELECT prüfen
   (Zeilen je Ebene/Tag vorhanden).
8. **Schedules aktivieren** (`active:true`). Fertig; Stories-Job läuft alle 3 h,
   Konto+Beitrag täglich 03:15.

---

## 7 · Offene Punkte / Ehrlichkeit

- Metric-Namen/Perioden folgen dem Stand v21 (Recherche 31.07.2026, BESTAND N3/N4). Die
  exakte Verfügbarkeit einzelner (v21-deprecateter) Konto-Metriken zeigt sich erst am
  Live-Token — deshalb ist `follower_demographics` best-effort (darf den Lauf nicht killen)
  und deprecatete Spalten sind nullable.
- Die n8n-Pagination-/Batching-Parameter sind strukturell gesetzt; Feintuning
  (Seiten-Cap, Intervalle) am Live-Volumen anpassbar.
- Alles ohne Live-DB/echte API ist **statisch geprüft** (pglast für SQL, jq + `node
  --check` für den Flow) — die echte End-to-End-Verifikation gehört in Marvins Go-Live.
