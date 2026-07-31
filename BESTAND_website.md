# BESTAND — SVA-Vereinswebsite (sva-fussball)

> Bestandsaufnahme durch den PLANER, Stand 31.07.2026. Read-only: kein Commit, kein
> Push, kein Checkout, keine Codeänderung. Quellen: Working Tree (Branch
> `feat/admin-ausbau`), `git show`/`git ls-tree` für andere Branches, Migrationsdateien,
> Repo-Dokumente (`BUILD_LOG_aga.md`, `docs/ADMIN_AUSBAU_VORSCHLAG.md`).
> Das Vereins-Supabase-Projekt ist derzeit **PAUSIERT (INACTIVE)** — alle Live-Zahlen
> (Zeilenzahlen, Live-RLS, tot/aktiv) sind hier als „→ Leitstand/MCP" markiert.

---

## 1. Repo, Branches, Deploy-Status

**Repo:** `/Users/marvinallers/code/sva-fussball` · Remote: `github.com/marvinallershandy-afk/aga-website`
**Working Tree:** Branch `feat/admin-ausbau`, sauber bis auf untracked Audit-Artefakte
(`BUILDSPEC_aga.md`, `screenshots-*/`, `audit-screenshots/` u. a. — unangetastet gelassen).

### Branch-Lage (verifiziert per merge-base / log-Ranges)

| Branch | letzter Commit | in `main`? | auf origin? | Inhalt |
|---|---|---|---|---|
| `main` (= `admin-backend`) | 07-08 `45431f0` | — | ja (identisch) | **VERALTET.** Alte 3D-Version + Admin **v1** (6 Routen, Sponsoren/Insights nur Stubs) |
| `release` | 07-15 `dabc091` | **nein** (~80 Commits voraus) | **teilweise** — origin/release steht auf `b1fd734` (07-12), **10 lokale Commits nicht gepusht** | v13-Website + Admin **v2** komplett + Security-/Legal-Pass |
| `admin-cockpit` | 07-11 `4b12205` | nein | **nein** (nur lokal) | **vollständig in `release` enthalten** (merge-base = Branch-Tip; `release..admin-cockpit` ist leer) |
| `feat/admin-ausbau` | 07-19 `db0a2c3` | nein | **nein** (nur lokal) | = `release` + 8 Commits Admin-Ausbau P0–P4 (4 neue Migrations-DATEIEN, Tabelle-Seite, Build-Fetch, Webhook-Registry) |
| `feat/3d-politur` | 07-19 `b692455` | nein | **nein** (nur lokal) | = `release` + 3D-Politur (neue Kamerafahrt, Party-Durchfahrt, mobile Karten als DOM-Grid). **Divergiert von `feat/admin-ausbau`** (beide zweigen von `release` ab, ~43 Dateien Unterschied) |
| `v13-premium` | 07-12 | nein | nein | in `release` gemergt (`eb04eaf`) |
| `website-polish`, v7–v12 | 07-06…07-09 | teils | teils | historische Etappen |

**Kritische Push-Lücke:** Die 10 nicht gepushten Commits auf `release` enthalten
ausgerechnet den **Security-/Legal-Pass** (Debug-Hotkeys nur im Dev-Build `5e23dd5`,
`/admin`-Crawlersperre `9373399`, Fake-Countdown-Fix `412f7ab`, Impressum/Datenschutz-Gerüst
`943a98a`) sowie P1–P5-Politur. `feat/admin-ausbau` und `feat/3d-politur` existieren
**ausschließlich lokal auf diesem Rechner** — bei Plattenverlust wäre der gesamte
Admin-Ausbau + die 3D-Politur weg.

### Deploy

- **Netlify-Site verknüpft:** `.netlify/state.json` → siteId `e3883f3e-7acc-43b9-816c-2f7f12a40141`;
  URL laut `index.html`-canonical / `robots.txt`: `https://sva-agathenburg-dollern.netlify.app`.
- `netlify.toml` (auf `feat/admin-ausbau`/`release`): publish=`dist`, Build
  `pnpm exec playwright install --with-deps chromium && pnpm build` (Prerender braucht Chromium im CI —
  **dieser CI-Fix ist noch nie in einem echten Netlify-Build gelaufen**, lokal grün).
  Redirects: `/impressum`, `/datenschutz` → statische HTML (vor SPA-Fallback), `/*` → `index.html`
  (deckt Onepager + `/admin`). Cache-Header für Assets/Audio/Modelle.
- **Welcher Branch produktiv deployed ist, steht nicht im Repo.** Laut
  `docs/ADMIN_AUSBAU_VORSCHLAG.md` (18.07.) ist **`main` deployt** → live wäre die alte
  Website + Admin v1, während v13 + Admin v2 nur auf `release` liegen. → **Leitstand:
  Production-Branch + letzten Build in der Netlify-UI verifizieren.**
- Domain: nicht gekauft (GATE-5); Sitemap/canonical bewusst auf der Netlify-URL belassen.
- Keine Netlify Functions im Repo (rein statischer Build).

---

## 2. Öffentliche Website (Stufe A)

**Architektur:** Kein klassischer Router. `src/main.tsx` ist eine Weiche:
`/admin*` → Admin-Sub-App (Supabase/Tailwind, eigenes Bundle), alles andere → 3D-Onepager
(React Three Fiber, **lädt nie Supabase** — 0 externe Requests, bewusst wegen
Cookie-Banner-Freiheit). Der Onepager ist EINE Seite mit 7 Scroll-Stationen
(Kamerafahrt); `scripts/prerender.mjs` backt die Kern-Copy für Crawler statisch in
`dist/index.html`. Fallback ohne WebGL / bei `prefers-reduced-motion` vorhanden
(`StaticBackdrop`).

**Inhaltsquelle generell:** Statische Seeds (`src/data/players.ts`, `src/data/club.ts`).
Auf `feat/admin-ausbau` zusätzlich eine Build-Time-DB-Fassade (`src/data/content.ts` +
`scripts/fetch-content.mjs`), **ENV-gated und aktuell wirkungslos** (keine Build-Env,
kanonische Tabellen leer) → faktisch ist heute ALLES hardcoded.

| Station / Route | Zweck | Status | Inhaltsquelle | Mobil |
|---|---|---|---|---|
| `/` · `verein` | Willkommen/Hero | **fertig** | hardcoded Copy (overlay-fähig) | ja (v13-Audits) |
| `/` · `mannschaft` | Kader als FIFA-Style-Holo-Karten + Story-Share | Feature **fertig**, Inhalt **FAKE**: 11 von 15 Spielernamen erfunden, inkl. erfundener Tore/Ratings (Launch-Blocker #1). 6 echte Fotos (Tino, Lennard, Julio, Eli, Nico Hause, Trainer Carsten) | `players.ts` (Seed) | auf `release` 3D-Karten-Cluster; das mobile DOM-Grid (`becf0ad`) liegt **nur auf `feat/3d-politur`** |
| `/` · `fanblock` | Meisterfeier-Fotos (echt, Aufstieg 2026), Lightbox | **fertig** | `club.ts` `FAN_PHOTOS` + `public/fans/` | ja |
| `/` · `musik` | „AGA Urknall"-Album, Player, Tracks | **fertig** | hardcoded + `public/audio/tracks` | ja |
| `/` · `tabelle` | Saison-Cockpit: Tabelle, Form, letztes/nächstes Spiel | **Platzhalter-Daten**: `TABLE_PREVIEW` mit „TuS Beispielstadt"/„SV Musterdorf", `FORM` erfunden, `NEXT_MATCH` = „Gegner folgt" (Fake-Countdown wurde 15.07. bewusst entfernt — ohne echten `kickoff` kein Countdown/ICS). Echt ist nur der fussball.de-Deep-Link (Team-ID real) | `club.ts` (Seed); auf `feat/admin-ausbau` wäre `sm_tabelle` anbindbar | ja |
| `/` · `sponsoren` | 3D-Bande + Sponsor-Strip, „Deine Bande wartet"-CTA | Feature **fertig**, `SPONSORS = []` → 4 Platzhalter-Slots „Hier könnte dein Logo stehen" | `club.ts` | ja |
| `/` · `kontakt` | Mitmachen/Probetraining/Anfahrt | **weitgehend fertig**: echte Adresse (Waldsportplatz), echte E-Mail, IG-Handle. ABER: WhatsApp-Nummer = Dummy `491700000000` → alle WA-CTAs fallen sauber auf `mailto:` zurück (`whatsappReady`-Vertrag); Trainingszeit „Di & Do ab 19 Uhr" ist als PLATZHALTER markiert (bestätigen) | `club.ts` `CONTACT` | ja |
| `/impressum` | Rechtsseite, statisches HTML (ohne JS verfügbar, § 5 DDG) | **Gerüst**: durchgängig `TODO-MARVIN`/`TODO-JURIST` (Vereinsname lt. Register, ladungsfähige Anschrift ≠ Sportplatz!, Vorstand § 26 BGB, VR-Nummer, Telefon, Fotocredits). Steht auf `noindex` | statisch `public/` | ja |
| `/datenschutz` | Rechtsseite | **Gerüst**, gleiche TODO-Lage (Verantwortlicher, Hoster, Aufsichtsbehörde), `noindex` | statisch `public/` | ja |
| alle anderen Pfade | SPA-Fallback auf den Onepager | — | — | — |

Mobil-Einschätzung basiert auf Code (`device.ts`-Caps, mobile Deck-Share, `_e8mob`/`_e9mob`-Auditläufe)
und den vorhandenen Audit-Screenshots; in dieser Bestandsaufnahme wurde kein neuer
Live-Durchklick gefahren.

---

## 3. Admin-Cockpit `/admin` (Stufe B — KERN)

**Absicherung (alle Stände):** Supabase-Auth (Magic-Link + Passwort), Whitelist-Tabelle
`sm_admins`, `is_sm_admin()` SECURITY DEFINER (seit `4b12205` nicht mehr für `anon`
ausführbar), RLS auf allen `sm_*`-Tabellen ausschließlich `is_sm_admin()`. `ProtectedRoute`
hat einen `?preview`-Bypass, der **nur in DEV-Builds** greift (`import.meta.env.DEV`).
`/admin` per `robots.txt` gesperrt (nur auf `release`+, nicht auf `main`). Secrets: `.env`
nur `VITE_SUPABASE_URL`/`ANON_KEY` (gitignored; Anon-Key im Client ist by design).

### Funktions-Inventur — getrennt nach Branch

| Funktion (Route) | Was sie tut | Tabellen | `main` (evtl. live) | `release` | `feat/admin-ausbau` |
|---|---|---|---|---|---|
| Login/Auth | Magic-Link/Passwort + sm_admins-Check | `sm_admins` | ✅ | ✅ | ✅ |
| Dashboard | Wochenstatistik, heute fällig, Status-Verteilung, Insights-Sparkline | `sm_content`, `sm_insights` | ✅ v1 (einfacher) | ✅ voll | ✅ |
| Redaktionsplan | Beiträge planen, Kanban-Status, Kanäle, Spieltagspaket-Anbindung | `sm_content` | ✅ | ✅ | ✅ |
| Spiele & Kader | CRUD Spiele + Kader inkl. Steckbrief-JSONB; RPC „Spieltagspaket" (1 Klick → 4 geplante Beiträge) | `sm_spiele`, `sm_roster`, RPC `sm_spieltagspaket` | ❌ **fehlt** | ✅ | ✅ |
| Ideen (Pool + Team-Eingang mit Triage) | Format-Bibliothek + Eingangs-Triage, transaktionale Übernahme in den Plan | `sm_ideen_pool`, `sm_ideen_eingang`, RPC `sm_eingang_into_plan` | ⚠️ nur Pool, kein Eingang | ✅ | ✅ |
| Produktion & Assets | Produktions-Board + **DriveBrowser** (Live-Google-Drive über Edge Function) | `sm_content` + Edge Fn `drive-bridge` | ❌ **fehlt** | ✅ | ✅ |
| Matchday-Grafiken | 5 PNG-Vorlagen × 2 Formate (html-to-image), Prefill aus Spielen/Kader | `sm_spiele`, `sm_roster`, Storage `sm_grafiken` | ⚠️ frühe Version | ✅ (Upload optional) | ✅ **Durchstich**: Storage-Upload als Default → Beitrag verknüpfen (`drive_asset_url`, Status „fertig") → Webhook `grafik.gerendert`. Degradiert sauber, solange Bucket fehlt |
| Sponsoren-CRM | Pakete, Laufzeiten, Reminder, Plan-Anbindung | `sm_sponsoren` | ⚠️ **Stub** | ✅ voll | ✅ |
| Insights | **Handeingabe** wöchentlicher Kanal-KPIs (IG/TikTok/FB), Trends/Sparklines | `sm_insights` | ⚠️ **Stub** | ✅ voll | ✅ |
| Ligatabelle | Handeingabe-Maske für die Ligatabelle (speist Website via Build-Fetch) | `sm_tabelle` | ❌ | ❌ | ✅ **nur hier** — Migration NICHT angewandt |
| Automationen | 4 n8n-Andockpunkte (beitrag.fertig, spiel.angelegt, insights.faellig, grafik.gerendert) mit Test-Button | — / `sm_webhooks` + `sm_webhook_deliveries` | ❌ | ⚠️ URLs nur in **localStorage** (pro Gerät) | ✅ team-weit in DB + Zustell-Log; **Fallback auf localStorage, solange Migration nicht angewandt** |
| Drive-Bridge (Edge Fn) | Google-Drive list + create_folder, OAuth-Refresh-Token in Supabase-Secrets, doppelter Auth-Check (JWT + sm_admin), bewusst kein Delete/Move | — | ❌ (Code nicht in main) | ✅ Code | ✅ Code — **Deploy-Status der Function + Google-Secrets → Leitstand/MCP** |

**Benutzbarkeits-Fazit:** Auf `release`/`feat/admin-ausbau` ist der Admin funktional
fertig gebaut und typsauber (`tsc -b` Exit 0 laut BUILD_LOG-DoD). ABER: (a) vermutlich
ist nur Admin **v1** live (main deployt), (b) die 4 neuen Migrationen
(`sm_webhooks`, `sm_grafiken`-Bucket, `sm_website_content`, `sm_tabelle`) liegen als
**Dateien vor und sind NICHT angewandt** — Automationen-DB-Teil, Grafik-Durchstich,
Copy-Pflege und Ligatabelle laufen daher heute nur im Fallback- bzw. Leerlauf-Modus,
(c) das Supabase-Projekt ist pausiert → aktuell funktioniert **gar kein** Admin-Login.

---

## 4. Datenmodell (Stufe C — aus Migrationsdateien; Live-Fakten → Leitstand/MCP)

> **Leitstand-Live-Befund (31.07.2026, MCP):** Das Vereins-Supabase-Projekt
> `fwiivwmoyagcdrjvhaou` steht auf **`INACTIVE` (Free-Plan pausiert)** — Abfragen laufen in
> den Timeout. **Echte Zeilenzahlen, aktiver RLS-Status und „tot vs. aktiv" sind ohne Restore
> nicht abrufbar** (Restore = Marvin-Entscheidung, bei einem Read-only-Auftrag nicht ungefragt
> ausgeführt). Das Schema/RLS unten ist aus den Migrationsdateien inventarisiert und belastbar;
> es fehlen nur die *lebenden* Zahlen. **Für Saisonstart ohnehin nötig: Projekt entpausen.**

RLS-Muster überall identisch: `enable row level security` + 4 Policies
(select/insert/update/delete) `to authenticated` mit `is_sm_admin()`. Kein `anon`-Zugriff
auf irgendeine `sm_*`-Tabelle. Die öffentliche Website liest zur Laufzeit NICHTS aus
Supabase (nur Build-Time-Fetch, und der ist ungenutzt).

| Tabelle/Objekt | Zweck | RLS (lt. Migration) | Liest (Code) | Schreibt (Code) | Angewandt? |
|---|---|---|---|---|---|
| `sm_admins` | Admin-Whitelist (E-Mail) | Self-Select only | AuthProvider, drive-bridge | — (Pflege via Dashboard/MCP) | ✅ remote (Baseline dokumentierend) |
| `is_sm_admin()` (Fn) | RLS-Kern, SECURITY DEFINER, für `anon` revoked | — | alle Policies | — | ✅ |
| `sm_content` | Redaktionsplan-Beiträge (Status-Workflow idee→veröffentlicht, Hook/Caption/CTA, Drive-Links, `spiel_id`) | admin-only | Dashboard, Redaktionsplan, Produktion, Matchday | CRUD + RPCs | ✅ |
| `sm_ideen_pool` | Format-Bibliothek | admin-only | IdeenPool | CRUD | ✅ |
| `sm_ideen_eingang` | Team-Ideen-Eingang/Triage | admin-only | IdeenPool | CRUD + RPC | ✅ |
| `sm_sponsoren` | Sponsoren-CRM | admin-only | Sponsoren | CRUD | ✅ |
| `sm_spiele` | Spielplan/Ergebnisse (⚠️ lt. SME Stage 0 **eingefroren**, wird zugunsten `matches` deprecated) | admin-only | Spiele, Matchday-Prefill | CRUD | ✅ |
| `sm_roster` | Kader (⚠️ eingefroren, → `players`) | admin-only | Spiele, Matchday | CRUD | ✅ |
| `sm_insights` | Wöchentliche Kanal-KPIs, Handeingabe, `unique(datum, kanal)` | admin-only | Dashboard, Insights | Upsert | ✅ |
| RPC `sm_eingang_into_plan` | Transaktionale Idee→Plan-Übernahme | invoker | IdeenPool | — | ✅ |
| RPC `sm_spieltagspaket` | 1 Spiel → 4 Beiträge, idempotent | invoker | Spiele | — | ✅ |
| `sm_webhooks` | n8n-Webhook-Registry je Event (+ Seed der 4 Events) | admin-only | Automationen, Matchday (`fireWebhook`) | Upsert | ❌ **nur Datei** |
| `sm_webhook_deliveries` | Append-only Zustell-Log | admin-only | Automationen | Insert | ❌ nur Datei |
| Storage-Bucket `sm_grafiken` | privater PNG-Bucket für Matchday-Grafiken (10 MB, nur image/png) | storage.objects-Policies admin-only | — | Matchday-Export | ❌ nur Datei |
| `sm_website_content` | Sektionstexte der öffentlichen Website (Copy-CMS) | admin-only | `fetch-content.mjs` (Build) | ⚠️ **keine Admin-Maske vorhanden** — Tabelle wäre nach Anwendung nur per SQL pflegbar | ❌ nur Datei |
| `sm_tabelle` | Ligatabelle (Handeingabe; `diff` generiert; `unique(saison, platz)`) | admin-only | Tabelle-Seite, `fetch-content.mjs` | CRUD | ❌ nur Datei |
| `players`/`matches`/`sponsors`/`opponents` (kanonisch, SME) | Ziel-Datenherz lt. SME Stage 0/1 | **nicht in diesem Repo definiert** (keine Migration hier) | `fetch-content.mjs` (Build, defensiv gemappt) | **niemand in diesem Repo** | → SME-Repo / Leitstand |
| Edge Fn `drive-bridge` | Drive list/create_folder via OAuth-Refresh-Token | verify_jwt + sm_admin-Check | Produktion (DriveBrowser) | — | Deploy-Status → Leitstand/MCP |

**Zeilenzahlen, Live-RLS-Bestätigung, tot/aktiv je Tabelle: → Leitstand/MCP
(Projekt `fwiivwmoyagcdrjvhaou` derzeit pausiert; erst Restore nötig).**

**Struktureller Kernbefund (unverändert seit dem Admin-Audit):** Der Admin schreibt
ausschließlich `sm_*`-Tabellen; der Website-Build-Fetch liest für Kader/Spiele/Sponsoren
die **kanonischen SME-Tabellen** (`players`/`matches`/`sponsors`), die leer sind und in
diesem Repo gar nicht existieren. **Admin-Pflege erreicht die öffentliche Website heute
an keiner Stelle** — verbunden sind (nach Migration + Build-Env) nur `sm_tabelle` und
`sm_website_content`. Der Rest wartet auf SME Stage 1 + Backfill (bewusste Entscheidung,
kein Versehen).

---

## 5. Lücken bis Saisonstart (Stufe D — ehrlich, nach Aufwand)

### Blockiert das Öffentlich-Gehen (muss)
1. **Impressum + Datenschutz füllen** — beides reines TODO-Gerüst auf `noindex`; ohne
   geht die Seite rechtlich nicht live. Reine Inhalts-/Juristenarbeit, kein Code. (Dazu:
   AV-Vertrag Netlify, Einwilligungen für Personenfotos in `public/fans/` + Kaderfotos.)
2. **Fake-Kader ersetzen** — 11 von 15 Namen samt Torschützenliste sind erfunden; so darf
   die Mannschafts-Station nicht öffentlich. Echte Namen/Fotos ODER Station vorerst auf
   Platzhalter-Karten. (Daten, kein Code — Struktur ist fertig.)
3. **Branch-/Deploy-Wahrheit herstellen (GATE-1/A)** — live ist mutmaßlich der Stand vom
   08.07. Ohne `release` (bzw. `feat/*`) → Production-Branch ist jeder weitere Handgriff
   Bau auf einem toten Branch. Zusätzlich: **10 Release-Commits und beide feat-Branches
   pushen** (aktuell Single-Point-of-Failure lokale Platte). Aufwand klein, Entscheidung Marvin.
4. **Supabase-Projekt entpausen** — pausiert funktioniert weder Admin-Login noch
   Drive-Bridge noch irgendein künftiger Daten-Fetch.

### Halbfertig / peinlich, wenn es jemand merkt
5. **Tabellen-Station zeigt erfundene Vereine** („TuS Beispielstadt"). Schnellster ehrlicher
   Weg existiert bereits auf `feat/admin-ausbau` (Migration `sm_tabelle` anwenden +
   Handeingabe + Build-Env setzen) — oder Station bis GATE-D neutraler formulieren.
6. **Kein einziger echter Spieltermin** (`NEXT_MATCH.kickoff` leer) — Countdown/ICS bleiben
   unsichtbar (korrekt so), aber „Gegner folgt" zum Saisonstart wirkt verlassen.
7. **WhatsApp-Dummy-Nummer** — CTAs fallen auf E-Mail zurück (funktioniert), aber der
   beste Conversion-Pfad liegt brach. Eine echte Nummer eintragen = 1 Zeile + Datenschutz-Absatz.
8. **Sponsoren leer** — 4 Platzhalter-Banden. Verkaufsargument oder Peinlichkeit, je nach Lesart.
9. **Trainingszeiten unbestätigt** (Platzhalter-Kommentar in `club.ts`).

### Gebaut, aber nicht angeschlossen / nicht verlinkt
10. **Vier Migrationen liegen als Dateien** (`sm_webhooks`, Bucket, `sm_website_content`,
    `sm_tabelle`) — bis zur Anwendung laufen Automationen im localStorage-Fallback, der
    Grafik-Durchstich im Download-Fallback, Copy-CMS und Ligatabelle ins Leere.
11. **`sm_website_content` hat keine Admin-Maske** — Tabelle + Build-Fetch existieren,
    aber keine Pflege-UI (nach Anwendung nur per SQL editierbar).
12. **Build-Time-DB-Fassade komplett env-gated** — ohne `SUPABASE_URL`/`SUPABASE_READ_KEY`
    im Netlify-Build bleibt alles Seed (aktuell gewollt, aber der Schalter ist nirgends gesetzt).
13. **n8n-Andockpunkte ohne n8n-Flows** — 4 Events dokumentiert + Test-Button, keine URL
    eingetragen, kein Database-Webhook eingerichtet.
14. **`feat/3d-politur` vs. `feat/admin-ausbau` sind divergente Geschwister** — die neue
    Kamerafahrt/Party-Durchfahrt und der Admin-Ausbau müssen erst zusammengeführt werden,
    bevor „ein" Stand deploybar ist (~43 Dateien Unterschied, aber disjunkte Bereiche:
    3D vs. Admin/Migrations — Merge sollte konfliktarm sein; nicht verifiziert).
15. **Netlify-CI-Prerender nie real getestet** (Playwright-Chromium-Install im CI) — erster
    Deploy des neuen Stands kann daran scheitern; Fallback ist dokumentiert.

### Entscheidungs-Gates (Marvin, aus den Repo-Dokumenten — hier nur gebündelt)
- **GATE-1/A:** Branch-Wahrheit (`release` → `main` oder `main` nachziehen) + Merge-Reihenfolge der beiden feat-Branches + Deploy-Zeitpunkt.
- **GATE-D:** Tabellen-/Ergebnisquelle: DFB-Widget (bricht 0-Requests → Cookie-Banner) vs. n8n-Scraping fussball.de (Grauzone/brüchig) vs. Handeingabe (sofort möglich, gebaut).
- **GATE-5:** Domain kaufen (Sitemap/canonical/OG hängen daran).
- **Migrationen anwenden ja/nein + Zeitpunkt** (Builder-Regel: nur als Dateien angelegt).
- **Supabase-Build-Env in Netlify setzen** (aktiviert die DB→Website-Schiene).

---

## 6. Instagram (Stufe E)

**Befund: Es existiert KEINE Instagram-/Meta-API-Anbindung.** Grep über
`instagram|graph.facebook|access_token|ig_` findet nur: den IG-Profil-Link auf der
Website (`CONTACT.instagramUrl` → `@sva_fussball`), Kanal-Labels/Icons im Admin und die
**Handeingabe**-Seite Insights. Der einzige `access_token` im Repo ist der
Google-OAuth-Flow der Drive-Bridge. Keine Edge Function, kein n8n-Flow, kein Secret für Meta.

**Dafür gedachte Tabelle:** `sm_insights` (Migration `20260711020000`):
`datum date · kanal text · follower int · reichweite int · top_beitrag text · notizen`,
`unique(datum, kanal)`, RLS admin-only. Migration-Kommentar ausdrücklich: „bewusst ohne
Meta/TikTok-API — die kann später dieselbe Tabelle füllen". Laut SME-Abgrenzung ist die
Graph-API SME Phase 3 (`analytics_snapshots`, post-granular); `sm_insights` bleibt
Wochen-Körnung.

**Kleinster Weg (Skizze, NICHT gebaut):** täglicher n8n-Cron auf dem bestehenden VPS →
IG Graph API (setzt Business-/Creator-Konto + verknüpfte FB-Page + long-lived Token
voraus) → pro Tag eine Rohzeile je Kanal (Follower, Reach, Interaktionen, Profilaufrufe)
+ optional pro Beitrag in eine **neue Tages-Rohtabelle** (z. B. `sm_insights_daily` oder
gleich SME-`analytics_snapshots`) im selben Supabase-Projekt; `sm_insights`
(Wochen-Handeingabe) unangetastet lassen. Voraussetzung Nr. 1 ist unabhängig von allem:
**Projekt entpausen**, sonst gibt es kein Ziel zum Reinschreiben.

---

## 7. Datenhaltung: roh vs. aggregiert (Nachtrag Marvin)

Bewertungsgrundsatz: **Roh speichern, aufbereitet anzeigen.** Instagram liefert
Historie nur begrenzt rückwirkend — nicht täglich Gespeichertes ist später weg.

### N1 — Aggregiert statt roh?
- **`sm_insights`** ist das Hauptproblemkind: Das Schema ist zwar **tages-fähig**
  (`datum date`, unique je Datum+Kanal — beliebig viele Stichtage möglich), aber
  (a) die UI ist auf „einmal pro Woche eintragen" ausgelegt (freier Stichtag, Handeingabe),
  (b) `follower` ist ein echter Momentanwert (roh), **`reichweite` ist eine bereits
  verdichtete Zahl, deren Bezugszeitraum nirgends im Schema steht** (implizit „die Woche",
  wie sie in der IG-App ablesbar war) — nicht rekonstruierbar, welches Fenster gemeint war,
  (c) **keine Beitrags-Ebene** (nur `top_beitrag` als Freitext), keine Interaktionen,
  keine Profilaufrufe. Fazit: Wochen-verdichtete Handeingabe, keine Tagesrohdaten.
- **`sm_tabelle`** ist per Definition ein Aggregat (Tabellenstand) und hält nur den
  **aktuellen** Stand (siehe N2) — der Saisonverlauf („Platz je Spieltag") ist nicht
  rekonstruierbar. Für eine Vereinswebsite verschmerzbar, für Content („Aufholjagd-Grafik")
  verschenkt.
- Sonst keine verdichteten Tabellen; `sm_spiele` speichert Ergebnisse als Einzelfakten (ok).
  Eine Tages-Rohtabelle für Social-KPIs **existiert nicht** — das ist die eigentliche Lücke.

### N2 — Verlauf oder Momentaufnahme? (alle Tabellen)

| Tabelle | Schreibmuster | Verlauf rekonstruierbar? |
|---|---|---|
| `sm_insights` | Upsert `onConflict: datum,kanal` — überschreibt nur denselben Stichtag, neue Stichtage = neue Zeilen | ✅ über die Zeitachse ja (append-per-Stichtag); Korrektur am selben Tag überschreibt ohne Historie |
| `sm_webhook_deliveries` | reines Insert, Index nach Zeit | ✅ **einziges echtes Append-only-Log im System** — gutes Muster |
| `sm_webhooks` | Upsert je Event; `letzter_versand`/`letzter_status` werden überschrieben | ⚠️ Kopfzeile Momentaufnahme, Verlauf steckt im Deliveries-Log → zusammen ok |
| `sm_tabelle` | UPDATE-in-place je (saison, platz) | ❌ nur aktueller Stand, kein Spieltags-Verlauf |
| `sm_roster` | UPDATE-in-place (inkl. Steckbrief-JSONB, Saisonstatistiken im Steckbrief) | ❌ nur aktueller Stand — Spieler-Stats je Saison/Spieltag nicht historisiert |
| `sm_spiele` | UPDATE-in-place pro Spiel | ✅ faktisch Verlauf (jedes Spiel = eigene Zeile mit Anstoß-Zeitpunkt); Ergebnis-Korrekturen unhistorisiert (unkritisch) |
| `sm_content` / `sm_ideen_*` | Status-UPDATE-in-place, nur `updated_at` | ❌ Workflow-Historie (wann geplant→fertig→veröffentlicht) nicht rekonstruierbar — für spätere „was hat funktioniert"-Auswertung relevant |
| `sm_sponsoren` | UPDATE-in-place | ❌ nur aktueller Stand (Laufzeit-Felder mildern das) |
| `sm_website_content` | UPDATE-in-place | ❌ keine Copy-Versionierung |
| `sm_admins` | Insert/Delete | Momentaufnahme (ok) |

Durchgängiges Muster: überall `updated_at`-Stempel, aber **nirgends Snapshot-Zeilen**
außer bei `sm_insights` (Stichtags-Zeilen) und `sm_webhook_deliveries` (Log). Für eine
künftige Tages-Erfassung sollte das Deliveries-/Insights-Muster (neue Zeile je Zeitpunkt,
nie überschreiben außer Same-Day-Korrektur) der Standard sein.

### N3/N4 — Instagram Graph API (Leitstand ergänzt, Web-Recherche 31.07.2026)

Voraussetzung: **Instagram Business/Creator-Konto** verbunden mit einer Facebook-Seite; Zugriff über
die Instagram Graph API (bzw. „Instagram API with Instagram Login") mit App-Review für
`instagram_basic` / `instagram_manage_insights`. Kein persönliches Konto.

**N3 — Was die API liefert:**
- **Kontoebene** (`GET /{ig-user-id}/insights`, Zeitreihe): `reach`, `follower_count`,
  `online_followers`, `audience_city` / `audience_country` / `audience_gender_age` /
  `audience_locale`. Weitere frühere Konto-Metriken (`profile_views`, `website_clicks`,
  `phone_call_clicks`, `text_message_clicks`, `email_contacts`-Zeitreihe, `impressions` teils)
  wurden mit **Graph API v21 (08.01.2025) deprecatet** — nicht mehr verlässlich planbar.
- **Beitragsebene** (`GET /{ig-media-id}/insights`): `reach`, `impressions`, `saved`,
  `engagement`, `views` (Video/Reel). Pro Post einmalig zum Erfassungszeitpunkt abgreifbar.
- **Stories:** eigene Metriken (`reach`, `replies`, `exits`, `taps_forward/back`), aber nur
  **während der 24-h-Lebensdauer** abrufbar.
- Rate-Limit: ~200 Calls/Stunde/Nutzer für Insights.

**N4 — Reichweite rückwirkend + Intervall + Lückenverhalten (der eigentliche Dringlichkeitshebel):**
- **Konto-Zeitreihe reicht nur ~60 Tage rückwirkend.** Was älter als 60 Tage ist, gibt die API
  nicht mehr her → bestätigt Marvins Grundsatz hart: **ab Juli täglich wegschreiben, sonst weg.**
- **Beitragsdaten:** die letzten ~1000 Posts sind erreichbar (bei Vereinskadenz Monate–Jahre),
  aber immer nur der *aktuelle* Zählerstand — kein Tagesverlauf pro Post ohne eigenes Log.
- **Stories: keinerlei Historie** (24 h). Eine Lücke > 24 h = Story-Werte endgültig verloren.
- **Intervall:** **täglich** genügt für Konto- + Beitragswerte (60-Tage-Fenster heilt eine
  verpasste Tageszeile beim nächsten Lauf selbst nach). **Wer Story-KPIs will, braucht < 24 h**
  Kadenz und muss Stories vor Ablauf greifen — die heilen nie nach.
- Bei einer Cron-Lücke also: Konto/Beitrag = nachholbar bis 60 Tage; Stories = verloren.

*Sources: [Meta Graph API v21 Insights-Deprecations](https://docs.supermetrics.com/docs/instagram-insights-field-changes-december-11-2024) · [60-Tage-Backfill / 1000-Post-Grenze](https://www.sprinklr.com/help/articles/reporting-glossary/instagram-historical-backfill-capabilities-and-limitations/63e384a2a9d511790301662e) · [Graph-API-Kennzahlen 2026](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/)*

### N5 — Wo gehört ein täglicher Abruf technisch hin?

Bestand im Vereins-Aufbau (aus Repo/Migrationen verifiziert):
- **n8n auf dem VPS: existiert und ist bereits die designierte Automations-Ebene** — die
  komplette Automationen-Seite, die `sm_webhooks`-Registry und das Event
  `insights.faellig` sind ausdrücklich als n8n-Andockpunkte gebaut; auch SME plant seine
  Pipelines dort.
- **Supabase Edge Functions: Muster vorhanden** (drive-bridge), aber **kein `pg_cron`
  nirgendwo in den Migrationen** — Scheduling in Supabase wäre Neuland; zudem trifft die
  aktuelle Free-Tier-Pausierung Edge Functions + Cron gleich mit.
- **Netlify: rein statischer Build, null Functions im Repo**, Build-Env nicht mal für den
  Content-Fetch gesetzt; Scheduled Functions wären ein dritter Secret-/Deploy-Ort ohne
  jeden Bestand.

**Einschätzung (nicht gebaut):** Der tägliche IG-Abruf gehört auf **n8n/VPS** — Cron
eingebaut, Meta-Token liegt außerhalb jedes Client-Bundles, Fehler-/Retry-Handling und
Logs vorhanden, und es ist exakt die Rolle, die die bestehende Architektur n8n bereits
zuweist (gleiche Instanz, eigener Workflow). Schreibziel: Tages-Rohtabelle in Supabase
(Muster `sm_insights_daily`/`analytics_snapshots`, append-only, Snapshot-Datum + Rohwerte).
Zweitbeste Option Supabase Edge Function + pg_cron (alles in einem Projekt, aber neues
Muster + derzeit pausiert). Netlify Scheduled Functions passen am schlechtesten.
Harte Vorbedingung aller Varianten: **Projekt entpausen** — und der tägliche Zugriff
verhindert künftig zugleich das erneute Auto-Pausieren.

---

*Read-only-Bestandsaufnahme. Einzige geschriebene Datei: dieses Dokument. Kein Commit
(übernimmt der Leitstand).*
