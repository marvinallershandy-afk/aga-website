# ADMIN-AUSBAU-VORSCHLAG — SVA-Vereinswebseite `/admin`

> Autor: AGA-Admin-Planer (read-only Audit) · Stand: 2026-07-18
> Basis: `git show release:*` und `git show admin-cockpit:*` (Working Tree NICHT berührt — dort arbeitet der 3D-Builder auf `feat/3d-politur`).
> Abgestimmt mit: `~/code/sva-media/docs/STAGE0_AUDIT.md` + `PHASE1_BRIEF.md` (SVA Media Engine, Stage 0).
> **KEIN Blindbau** — dies ist ein Vorschlag. Marvin wählt, erst dann wird gebaut.

---

## 1. Ist-Stand des Admin-Cockpits (Audit mit Belegen)

### 1.1 Branch-Lage (wichtigster struktureller Fakt)

| Branch | Admin-Stand | Beleg |
|---|---|---|
| `main` (**deployt**) | Admin **v1**: Dashboard, Redaktionsplan, IdeenPool, Matchday, Sponsoren-Stub, Insights-Stub | STAGE0_AUDIT §1.2 |
| `admin-cockpit` | Admin **v2** (P1–P6): + Spiele & Kader, Sponsoren-CRM voll, Insights manuell, Steckbriefe, Drive-Bridge, Security-Härtung | Commits `29b76ee..4b12205` |
| `release` (lokal + origin) | **`admin-cockpit` ist hier VOLLSTÄNDIG gemergt** (Merge-Commit `eb04eaf`), release ist 37 Commits voraus / 0 zurück; ergänzt zusätzlich `src/admin/pages/Automationen.tsx` (Commit `4a0a3bb`, K9) + Security-/Legal-Pass (`5e23dd5`, `9373399`, `943a98a`) | `git merge-base release admin-cockpit` = `4b12205` (= admin-cockpit-HEAD) |

**Konsequenz:** Das im STAGE0_AUDIT (bezogen auf `main`) beschriebene Merge-Risiko R1 ist auf `release` bereits gelöst. Das eigentliche Problem: **Der Vollausbau ist nicht live** — `main` liegt ~80 Commits hinter `release` (GATE-1 in `BUILD_LOG_aga.md` §5). Marvin und das Team arbeiten produktiv mit Admin **v1**, obwohl v2 fertig auf `release` liegt.

### 1.2 Was auf `release` existiert (Seiten)

`src/admin/AdminApp.tsx` — 9 Routen unter `/admin` (BrowserRouter basename, Bundle-getrennt vom 3D-Onepager via `src/main.tsx`-Weiche):

1. **Dashboard** — Wochenstatistik, Heute-fällig, Status-Verteilung, Insights-Sparkline (`pages/Dashboard.tsx`)
2. **Redaktionsplan** — Vollausbau, Kanban-Status, Spieltagspaket-Anbindung
3. **Spiele & Kader** — CRUD auf `sm_spiele` + `sm_roster` inkl. Steckbrief-JSONB
4. **Ideen** — Pool + Team-Eingang mit Triage (`sm_ideen_pool`, `sm_ideen_eingang`)
5. **Produktion & Assets** — inkl. `DriveBrowser.tsx` (Live-Drive über Edge Function)
6. **Matchday-Grafiken** — 5 PNG-Vorlagen (spieltag/aufstellung/ergebnis/motm/steckbrief) × 2 Formate, Export via `html-to-image`, optionaler Upload in Storage-Bucket `sm_grafiken` (`matchday/export.ts`)
7. **Sponsoren** — CRM MVP: Pakete, Laufzeit, Reminder, Plan-Anbindung (`sm_sponsoren`)
8. **Insights** — **reine Handeingabe** wöchentlicher Kanal-KPIs, `sm_insights` mit `unique(datum, kanal)`; Migration-Kommentar: „bewusst ohne Meta/TikTok-API — die kann später dieselbe Tabelle füllen"
9. **Automationen** — n8n-Andockpunkte: 4 dokumentierte Rezepte (beitrag.fertig, spiel.angelegt, insights.faellig, grafik.gerendert) mit Test-Button. **ABER: URLs liegen nur in localStorage, die echten Supabase-Database-Webhooks sind nur als Anleitung dokumentiert, nicht eingerichtet** (`pages/Automationen.tsx`, Kopfkommentar)

### 1.3 Auth / Sicherheit / Infrastruktur

- **Auth:** Supabase Magic-Link + Whitelist `sm_admins`, `is_sm_admin()` security definer, gehärtet (nicht mehr für `anon` ausführbar, Commit `4b12205`). RLS einheitlich auf allen 8 `sm_*`-Tabellen (`20260708000000_sm_baseline.sql`).
- **Supabase-Projekt:** `fwiivwmoyagcdrjvhaou` — Tabellen live: `sm_admins`, `sm_content`, `sm_ideen_pool`, `sm_ideen_eingang`, `sm_sponsoren`, `sm_spiele`, `sm_roster`, `sm_insights`.
- **Drive-Bridge:** Edge Function `supabase/functions/drive-bridge/index.ts` — OAuth-Refresh-Token, bewusst NUR `list` + `create_folder`, doppelter Auth-Check (JWT + sm_admin). Existiert und ist die einzige Drive-OAuth-Strategie (STAGE0 §3.2 Punkt 4: keine zweite bauen).
- **RPC:** `sm_spieltagspaket(spiel_id)` — 1 Klick → 4 geplante Beiträge (Ankündigung/Aufstellung/Endergebnis/MOTM), idempotent (`20260711010000_sm_spiele_roster.sql`).

### 1.4 Die zentrale Lücke: Admin und öffentliche Website sind NICHT verbunden

Die öffentliche 3D-Seite liest **ausschließlich statische TS-Dateien**:

- `src/data/players.ts` — Kader als Seed, **11 von 15 Namen erfunden** (Launch-Blocker #1 im BUILD_LOG), Kommentar: „v2-ready … Umzug nach Supabase ein reines Mapping"
- `src/data/club.ts` — Sektionstexte, `NEXT_MATCH`/`LAST_MATCH`/`TABLE_PREVIEW`/`FORM` statisch; fussball.de nur als **Deep-Link** (`fussballDeTeamUrl`), keine Datenanbindung
- `src/ui/FussballWidget.tsx` — Kommentar: „Tabelle/Ergebnis/Termin sind **bis zur Anbindung Vorschau**"

Der Admin verwaltet also `sm_*`-Daten, die die Website nie erreicht — das Cockpit steuert heute die Social-Media-Planung, **nicht die Vereinswebseite**. Genau hier liegt das größte „größer bauen"-Potenzial.

---

## 2. Rahmenbedingungen aus SME Stage 0 (verbindlich, nicht widersprechen)

Aus `STAGE0_AUDIT.md` §3 (die referenzierte `ARCHITEKTUR_ENTSCHEIDUNG.md` existiert noch nicht als Datei; die Entscheidungsrichtung ist im Audit aber eindeutig):

1. **EIN Supabase-Projekt** (`fwiivwmoyagcdrjvhaou`) — kein zweites. SME baut kanonische Tabellen `players`/`opponents`/`matches`/`sponsors`/`render_jobs`/`analytics_snapshots` **im selben Projekt**.
2. **`sm_spiele`, `sm_roster`, `sm_sponsoren` sind EINGEFROREN** (STAGE0 R1: „keine neuen Features dagegen") — sie werden nach Backfill zugunsten der kanonischen Tabellen deprecated. → **Kein Admin-Ausbau-Vorschlag hier darf auf diesen drei Tabellen aufbauen.** `sm_content`, `sm_insights`, `sm_ideen_*`, `sm_admins` bleiben Cockpit-Hoheit.
3. **Instagram Graph API** = SME Phase 3 (füllt `analytics_snapshots` post-granular; `sm_insights` bleibt als Wochen-Granularität bestehen — andere Körnung, kein Duplikat).
4. **Video/Rendering/Sprach-Pipeline** = SME (Remotion, `render_jobs`, n8n Match-Event-Pipeline). Matchday-**Stills** bleiben Cockpit.
5. **Drive:** Browse-UI + OAuth = Cockpit-Drive-Bridge (existiert); Schreiben/Upload = n8n mit eigener Credential (SME). Kein zweites Browse-UI.

---

## 3. Priorisierte Ausbau-Vorschläge

**Aufwand:** S = 0,5–1 Buildertag · M = 2–4 Tage · L = 1–2 Wochen.
Reihenfolge = empfohlene Priorität.

---

### P0 — Cockpit v2 LIVE schalten (Branch-Konsolidierung + Deploy) — **Aufwand: S**

- **Nutzen:** Höchster Hebel pro Stunde. Spiele & Kader, Sponsoren-CRM, Insights, Steckbriefe, Automationen-Seite existieren fertig auf `release`, sind aber nicht deployt — das Team arbeitet mit Admin v1. Ohne P0 ist jeder weitere Ausbau Bau auf einem toten Branch.
- **Umfang:** GATE-1 auflösen (`release` → `main` bzw. `release` als Deploy-Branch), Netlify-CI-Risiko fixen (Playwright-Chromium-Download für `scripts/prerender.mjs` im CI — BUILD_LOG §4 warnt: „Der erste CI-Build kann daran scheitern"), Deploy verifizieren, `sm_grafiken`-Storage-Bucket anlegen (Code in `matchday/export.ts` referenziert ihn bereits).
- **Abhängigkeiten/Risiken:** GATE-A (Marvin: Branch-Wahrheit). Koordination mit dem laufenden 3D-Builder auf `feat/3d-politur` (dessen Basis ist `release` — Deploy-Zeitpunkt abstimmen). Launch-Blocker der ÖFFENTLICHEN Seite (Impressum, Fake-Kader) betreffen `/admin` nicht — `/admin` ist bereits crawler-gesperrt (`9373399`).
- **SME-Überschneidung:** keine. Reine Vereins-Admin-Infrastruktur. Erfüllt nebenbei die SME-Voraussetzung „Cockpit-Merge vollzogen" für die spätere `sm_*`-Deprecation.

### P1 — Website an die Datenbank anschließen („Cockpit steuert die Webseite") — **Aufwand: L**

- **Nutzen:** Verwandelt den Admin von „Social-Media-Planer" in die echte Vereins-Schaltzentrale: Kader, nächstes Spiel/Countdown, letztes Ergebnis, Sponsorenband und Sektionstexte werden im Admin gepflegt und erscheinen auf der 3D-Seite — ohne Code-Deploy durch einen Entwickler. Löst zugleich strukturell Launch-Blocker #1 (Fake-Kader): echte Namen werden Daten, nicht Code.
- **Umfang:** (a) Öffentliche Lese-Sicht: `published`-Views bzw. Build-Time-Fetch — der Prerender (`scripts/prerender.mjs`, läuft ohnehin per Playwright) holt Daten beim Build und schreibt sie statisch ins Bundle; die 3D-Seite bleibt Supabase-frei (Bundle-Trennung + „0 externe Requests"-Befund der Rechtsseiten bleiben erhalten, kein Cookie-Banner-Trigger). (b) Rebuild-Trigger: Netlify Build-Hook, ausgelöst per n8n/DB-Webhook bei Änderung („Veröffentlichen"-Button im Admin). (c) Admin-Seite „Website" mit Pflege der publizierten Inhalte + Vorschau.
- **Abhängigkeiten/Risiken:** **Kader/Spiele/Sponsoren MÜSSEN aus den kanonischen SME-Tabellen (`players`, `matches`, `sponsors`) kommen, NICHT aus den eingefrorenen `sm_roster`/`sm_spiele`/`sm_sponsoren`** → wartet auf SME Stage 1 (Migrations) + Backfill. Sektionstexte/Copy sind davon unabhängig (neue Tabelle `sm_website_content`, sofort baubar). Risiko: Datenschutz (Spielerfotos → Einwilligungen, Launch-Blocker #6). GATE-B + GATE-C (Marvin).
- **SME-Überschneidung:** bewusst als **Konsument** der SME-Kanonik gebaut — null Doppelbau. Schnittstelle: dieselben Tabellen, lesend.

### P2 — Automationen von „dokumentiert" auf „angeschlossen" heben — **Aufwand: S**

- **Nutzen:** Die Automationen-Seite ist heute eine schöne Anleitung: URLs in localStorage (pro Gerät!), Database-Webhooks nur als 5-Minuten-To-do beschrieben. Produktiv gemacht, liefert sie sofort spürbare Entlastung: „Beitrag fertig → WhatsApp an Team", „Montag 09:00 → Insights-Erinnerung", „Grafik im Bucket → Drive-Ablage".
- **Umfang:** Tabelle `sm_webhooks` (event, url, aktiv, letzter Versand, letzter Status) statt localStorage → team-weit sichtbar und beobachtbar; Supabase Database Webhooks real einrichten (sm_content UPDATE, storage.objects INSERT auf `sm_grafiken`); 2–3 n8n-Flows auf dem VPS aktivieren; Zustell-Log in der Admin-UI.
- **Abhängigkeiten/Risiken:** P0 (Seite muss live sein); n8n-VPS läuft bereits (PHASE1_BRIEF §1). Rezept „spiel.angelegt" (INSERT `sm_spiele`) NICHT verdrahten — eingefrorene Tabelle; stattdessen nach SME Stage 1 auf `matches` INSERT umziehen.
- **SME-Überschneidung:** komplementär — SME baut die Match-Event-Pipeline (eigener Webhook-Strang); die Cockpit-Automationen decken Redaktions-/Erinnerungs-Flows ab. Gleiche n8n-Instanz, getrennte Workflows. Drive-Ablage nutzt die n8n-Drive-Credential (SME-Muster, STAGE0 §3.2 Punkt 4) — kein zweiter OAuth-Strang.

### P3 — fussball.de-Anbindung: echte Tabelle, Ergebnisse, Termine — **Aufwand: M**

- **Nutzen:** `FussballWidget.tsx` zeigt statische „Vorschau"-Daten; der Countdown wurde mangels echter Termine sogar entfernt (`412f7ab`). Echte Tabelle + Ergebnisse machen die öffentliche Seite glaubwürdig und ersparen jede Handpflege von Ständen. Füttert zugleich `matches`-Ergebnisse für SME-Content.
- **Umfang:** n8n-Cron (So abends + Mo) → fussball.de-Daten der Staffel holen (Team-ID existiert: `CLUB.fussballDeTeamId` in `club.ts`) → neue Tabelle `sm_tabelle` (Cockpit-Hoheit, keine Überlappung) + Ergebnis-Update in `matches` → Website-Anbindung über den P1-Mechanismus. Admin-Widget „Tabellenstand" im Dashboard.
- **Abhängigkeiten/Risiken:** **fussball.de hat keine offene API** — Optionen: (a) offizielles DFB-Widget einbetten (ABER: Third-Party-Embed bricht den „0 externe Requests"-Befund → Cookie-Banner-Pflicht, siehe BUILD_LOG §3), (b) serverseitiges Auslesen via n8n (rechtliche Grauzone, Brüchigkeit bei Markup-Änderungen — Fehlerpfad + Stale-Anzeige einbauen), (c) Handeingabe im Admin als Fallback (S-Anteil, sofort möglich). GATE-D (Marvin).
- **SME-Überschneidung:** Ergebnis-Schreibpfad berührt `matches` (kanonisch) → Umsetzung NACH SME Stage 1, Schema-konform. Tabellenstand selbst ist reine Vereins-Admin-Funktion.

### P4 — Matchday-Stills-Durchstich: Generator → Bucket → Drive → Plan — **Aufwand: S–M**

- **Nutzen:** Heute endet der Grafik-Generator beim PNG-Download; Ablage und Verknüpfung mit dem Redaktionsplan sind Handarbeit. Durchstich: Grafik erzeugen → automatisch in `sm_grafiken` + via Webhook (P2) in den richtigen Drive-Spieltagsordner → `drive_asset_url` am zugehörigen `sm_content`-Beitrag gesetzt → Beitrag springt auf „fertig".
- **Umfang:** Bucket + RLS anlegen (Code existiert in `export.ts`), Upload-Flow als Default statt Option, Beitrag-Verknüpfung im Generator (Spieltagspaket-Beiträge tragen bereits `spiel_id`), n8n-Flow „grafik.gerendert" (aus P2), Drive-Zielordner nach SME-Schema `SVA Media / Saison … / Spieltag …` (STAGE0 §2.2 — gemeinsame Ablage-Konvention übernehmen, nicht neu erfinden).
- **Abhängigkeiten/Risiken:** P0 + P2. Generator-Prefill hängt heute an `sm_spiele` (eingefroren) → Prefill-Quelle beim SME-Backfill auf `matches` umstellen (kleiner Adapter in `lib/queries.ts`).
- **SME-Überschneidung:** bewusste Arbeitsteilung nach STAGE0 §3.2 Punkt 7: Stills = Cockpit, Video = SME. Design-Tokens aus `matchday/frame.tsx` sind SME-Referenz für `shared/theme.ts` — keine Duplizierung, Cockpit bleibt Quelle.

### P5 — Vereins-Organisation jenseits Social Media (Termine, Aufgaben, Helfer) — **Aufwand: M**

- **Nutzen:** Das Cockpit heißt „sm_" — es ist ein Social-Media-Tool. Eine echte Vereins-Schaltzentrale braucht mindestens: Vereinstermine (Feste, Arbeitsdienste, Versammlungen) mit ICS-Export, ein leichtes Aufgaben-Board (wer bringt was zum Heimspiel), Helferlisten pro Event. Kein anderes System im SVA-Kosmos deckt das ab — **einziger Vorschlag ohne jede SME-Berührung**.
- **Umfang:** Tabellen `sm_termine`, `sm_aufgaben` (+ RLS nach bestehendem Muster), 1–2 neue Admin-Seiten mit dem vorhandenen UI-Kit (Kanban-Muster aus Redaktionsplan wiederverwendbar), optional Termin-Veröffentlichung auf die Website via P1-Mechanismus, Erinnerungen via P2-Webhooks.
- **Abhängigkeiten/Risiken:** fachlich keine; Risiko ist Scope-Creep Richtung Mitgliederverwaltung (Beiträge, Bankdaten = DSGVO-schweres Terrain) — **bewusst NICHT vorgeschlagen**. GATE-E (Marvin: braucht der Verein das wirklich jetzt, oder trägt es nur Feature-Gewicht ein?).
- **SME-Überschneidung:** keine.

### P6 — Insights-Komfort (klein halten!) — **Aufwand: S**

- **Nutzen:** Solange die Instagram-API (SME Phase 3) nicht liefert, bleibt Handeingabe — die kann man angenehmer machen: Wochen-Erinnerung mit Deep-Link (= P2-Rezept „insights.faellig" aktivieren), Vergleich Vorwoche/Vormonat, Screenshot-Anhang pro Woche.
- **Umfang:** UI-Politur auf `pages/Insights.tsx` + eine Storage-Spalte; KEINE neue Datenstruktur.
- **Abhängigkeiten/Risiken:** keine. **Harte Grenze:** keinerlei Meta/TikTok-API-Anbindung im Cockpit bauen — das ist SME Phase 3 (`analytics_snapshots`, post-granular). `sm_insights` bleibt Wochen-Körnung (STAGE0 §3.2 Punkt 6).
- **SME-Überschneidung:** nur die Grenze — hier bewusst klein bleiben.

---

## 4. Zuordnung: Vereins-Admin vs. SME (nicht doppelt bauen)

| Thema | Gehört zu | Begründung |
|---|---|---|
| Website-CMS, Sektionstexte, Veröffentlichen-Flow (P1) | **Vereins-Admin** | Konsument der Daten, Website-Hoheit liegt beim Cockpit |
| Kader-/Spielplan-/Sponsoren-DATEN | **SME** (kanonische Tabellen `players`/`matches`/`sponsors`) | STAGE0 §3.2 Punkte 1–3; `sm_spiele`/`sm_roster`/`sm_sponsoren` eingefroren |
| Matchday-Stills (PNG-Generator) | **Vereins-Admin** | STAGE0 §3.2 Punkt 7 |
| Video-Templates, `render_jobs`, Sprach-/Event-Pipeline | **SME** | PHASE1_BRIEF §2.2–2.4 |
| Instagram/Meta-Analytics-API | **SME Phase 3** | füllt `analytics_snapshots`; `sm_insights` bleibt manuelle Wochen-Körnung |
| Drive-Browse-UI + OAuth | **Vereins-Admin** (existiert) | einzige OAuth-Strategie, kein Duplikat |
| Drive-Schreiben/Upload (Automationen) | **SME-Muster** (n8n-Credential), vom Cockpit mitgenutzt | STAGE0 §3.2 Punkt 4 |
| Redaktionsplan, Ideen, Automationen-Registry, Termine/Aufgaben | **Vereins-Admin** | Cockpit-Kern ohne SME-Pendant |
| Auth: `sm_admins` bleibt; SME baut `sme_members` daneben | beide, getrennt | STAGE0 §3.2 Punkt 5 |

---

## 5. Entscheidungs-Gates für Marvin (VOR jedem Bau)

- **GATE-A (für P0):** Branch-Wahrheit — wird `release` der neue `main` (empfohlen) oder zieht `main` nach? Und: Deploy-Zeitpunkt mit dem laufenden 3D-Builder (`feat/3d-politur`) abstimmen.
- **GATE-B (für P1):** Website-Datenweg — Build-Time-Fetch via Prerender + Netlify-Build-Hook (empfohlen: kein Cookie-Banner-Risiko, 3D-Bundle bleibt Supabase-frei) vs. Client-seitiges Laden?
- **GATE-C (für P1):** Reihenfolge — P1-Datenteil erst NACH SME Stage 1 (kanonisches Schema) bauen; nur der Copy-/Texte-Teil vorher? (Empfehlung: ja, so schneiden.)
- **GATE-D (für P3):** fussball.de-Strategie — DFB-Widget (Cookie-Banner-Folge) vs. n8n-Auslesen (Grauzone/Brüchigkeit) vs. vorerst Handeingabe?
- **GATE-E (für P5):** Will der Verein Termine/Aufgaben/Helfer wirklich im Cockpit — und ausdrücklich OHNE Mitglieder-/Beitragsverwaltung?

---

*Read-only-Audit; keine Quellcode-Änderung, kein Commit. Einzige geschriebene Datei: dieses Dokument.*
