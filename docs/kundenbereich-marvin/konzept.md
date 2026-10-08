# Kundenbereich Marvin Allers: Konzept (Phase 2)

Stand: 08.10.2026 · Status: **zur Freigabe** · Grundlage: `research.md` (Phase 1) + Sichtung der Repos `marvin-os`, `picture-by-nele`, `aga-website`
Prototyp: `mockup.html` (klickbar, Handy + Desktop, Beispieldaten)

---

## 0. Was ich vorgefunden habe

| Repo | Was drin ist | Was ich übernehme |
|---|---|---|
| **marvin-os** (privat) | Dein Berater-Cockpit: Haushalte, Personen, Transkripte (Zoom → Deepgram → Claude), Beratungsprotokolle §34d mit PDF, Aufgaben/Todoist, Partner-Routing, Trigger-Engine, Health-Checks. Supabase Frankfurt, Magic Link, Tenant-RLS, Resend EU, Anonymizer-Pflicht vor jedem KI-Call. | **Ist die Datenquelle.** Der Kundenbereich bekommt seine Inhalte aus marvin-os (Freigabe-Klick). Konventionen 1:1: TS, Tailwind, Migrations-Format, Tenant-Spalte, Anonymizer, Du/Sie-Logik, Ton. |
| **picture-by-nele** | Kundenbereich mit eigenem Passwort-/Session-System (kein Supabase Auth), Galerien auf Cloudflare R2 mit signierten URLs, Deny-all-RLS + Service-Role-Proxy, Kontaktformular → n8n, Web-Push für Admin, Passkeys für Admin. | Muster: signierte Kurzzeit-URLs, „erst speichern, dann an n8n weiterreichen", Aufräum-Cron, Push-Benachrichtigung, Brute-Force-Drossel. **Nicht** übernehmen: Passwort-Login, öffentlicher Bucket, Webhook ohne Secret. |
| **aga-website** (SV) | Supabase Edge Functions, `drive-bridge` (Google Drive: Ordner lesen/anlegen, ID-Validierung), Backup-Cron, Resend-DNS-Doku, Prerender für SEO. | `drive-bridge`-Muster (falls Drive genutzt wird), Prerender-Skript, Backup-Function. |

**Zwei Abweichungen von deiner Beschreibung, damit wir nicht aneinander vorbeireden:**
1. In `picture-by-nele` gibt es **keinen** Google-Drive-Sync, keine automatisierten Kunden-Mails (Freigabe läuft über WhatsApp) und der PDF-Flow ist stillgelegt (Funktionen da, aber kein Aufrufer). Ein Drive-Anschluss existiert nur in der SV-Seite (`supabase/functions/drive-bridge`). Falls der Drive-Sync woanders lebt (n8n-Workflow auf dem IONOS-VPS?), brauche ich den Export.
2. Ein Repo für **deine eigene Website** (marvinallers.de) habe ich nicht gefunden. marvin-os verweist auf einen „marvin-allers.de-Bau" mit Depotanalyse und Rechts-Audit. Der liegt nicht in deinem GitHub-Zugriff für diese Session.

---

## 1. Architektur-Entscheidung (Empfehlung)

```
                ┌───────────────────────────── marvinallers.de (Netlify) ─────────────────────────────┐
 Interessent →  │ Öffentliche Seiten (vorgerendert, SEO) · Rechner · Termin · Kontakt                  │
 Kunde       →  │ /kunde/*  Kundenbereich (React, gleiche Codebasis, gleiches Design-System)           │
                └──────────────┬───────────────────────────────────────────────────────────────────────┘
                               │ Supabase Auth (E-Mail-Code / Magic Link, optional TOTP/Passkey)
                ┌──────────────▼──────────────┐      Freigabe-Push        ┌─────────────────────────────┐
                │ Supabase „portal" (FRA)     │ ◄──────────────────────── │ Supabase „marvin-os" (FRA)  │
                │ nur freigegebene Inhalte,   │   Edge Function           │ Transkripte, Memory,        │
                │ Kunden-Uploads, Audit-Log   │ ────────────────────────► │ Empathie, Protokolle, Leads │
                └─────────────────────────────┘   Uploads/Leads zurück    └─────────────────────────────┘
                               ▲                                                       ▲
                               └──────────────── n8n (IONOS): Mails, Erinnerungen, Fristen ┘
```

**Kern: zweites Supabase-Projekt als „Schaufenster" statt Kunden-Logins im marvin-os-Projekt.**
- marvin-os gibt jedem eingeloggten User mit `tenant_id`-Claim Zugriff auf **alle** Haushalte des Mandanten (Migration 059). Ein Kunde dort wäre genau eine falsch gesetzte Metadaten-Zeile von deinem gesamten Bestand inklusive Transkripten und Empathie-Profilen entfernt.
- Im Portal-Projekt liegt nur, was du aktiv freigibst. Wird das Portal kompromittiert, sind Transkripte, Memory und interne Notizen nicht betroffen.
- Kosten: ein weiteres Projekt in deiner Supabase-Organisation (laut Supabase-Preisliste ca. 10 $/Monat Compute zusätzlich, bitte im Dashboard bestätigen).
- Alternative (nicht empfohlen): gleiche DB, eigenes Schema `portal` + Rollen-Claim `kunde`. Spart 10 $/Monat, erhöht das Risiko dauerhaft.

**Frontend: eine Codebasis für Website + Kundenbereich.** React + Vite + TypeScript + Tailwind (wie marvin-os vorschreibt), öffentliche Seiten vorgerendert (Muster aus `aga-website/scripts/prerender.mjs`). Ein Design-System, ein Deploy. Kundenbereich unter `/kunde`, eigener Lazy-Chunk.

---

## 2. Informationsarchitektur

```
marvinallers.de
├── Start (Claim, Haltung, Leistungen, Über mich, Bewertungen)
├── Leistungen: Absicherung · Vorsorge · Vermögensaufbau · bAV
├── So arbeite ich (Ablauf, Vergütung transparent, Evidenz)
├── Rechner (öffentlich, Leadmagnet)
│   ├── Kostenrechner  ← Kern-USP, Startseiten-Teaser
│   ├── Rentenlücke
│   ├── BU-Bedarf
│   ├── Zinseszins / Inflation
│   └── (Login) Entnahmeplan, bAV-/Altersvorsorgedepot-Förderung personalisiert
├── Wissen (Evidenz-Bausteine als Artikel: SPIVA, Faktoren, CAPE, Verhalten)
├── Termin buchen
├── Rechtliches (Impressum, Erstinformation, Datenschutz, Beschwerde) ← austauschbar, s. §8
└── /kunde (Login)
    ├── Übersicht: Begrüßung · To-dos · nächster Termin · Plan auf einen Blick · Neu seit letztem Besuch
    ├── Mein Plan: 3 Säulen → Bausteine → Baustein-Detail („Warum genau das")
    ├── Gespräche: Timeline (Datum, Thema, Ergebnis, nächste Schritte DU/MARVIN, Protokoll)
    ├── Dokumente: Beratung · Verträge · Pflichtinfos · Von dir · Upload
    ├── Rechner: vorbelegt mit deinen Zahlen
    ├── Nachrichten (P2)
    └── Profil: Kontaktdaten, Haushaltsmitglieder, Sicherheit (2FA/Passkey), Datenexport
```

### User-Flows

**A · Interessent ohne Login**
1. Landet über Google/Instagram/Empfehlung auf einem Rechner (Kostenrechner).
2. Rechnet anonym, ohne Eingabe persönlicher Daten.
3. CTA: „Ich schau mir deinen Vertrag an" → Termin buchen **oder** Ergebnis-PDF per Mail (Double-Opt-in, Einwilligung protokolliert).
4. Lead landet in marvin-os als Haushalt `status = lead` + Todoist-Aufgabe. Kein Konto im Portal.

**B · Neukunde (nach Erstgespräch)**
1. In marvin-os klickst du beim Haushalt „Kundenbereich einladen".
2. Edge Function legt im Portal Haushalt + Einladung an, Mail mit Einmal-Link (72 h gültig).
3. Kunde klickt, bestätigt Mail-Adresse, sieht Onboarding in 3 Schritten: Willkommen (Video/Foto von dir, 3 Sätze), Datenschutz + Erstinformation bestätigen, optional Passkey einrichten.
4. Übersicht ist vom ersten Tag an gefüllt: Erstgespräch in der Timeline, Erstinformation bei den Dokumenten, erste To-dos (z. B. Gesundheitsfragen, Unterlagen hochladen).

**C · Bestandskunde**
1. Mail „Neues in deinem Kundenbereich" (ohne Inhalt, nur Link) nach jeder Freigabe.
2. Login per Code oder Passkey → Übersicht zeigt „Neu seit deinem letzten Besuch".
3. Jahresgespräch: 11 Monate nach dem letzten Gespräch Einladung mit Buchungslink + kurzem Fragebogen („Hat sich was geändert?": Job, Familie, Immobilie, Gesundheit). Antworten landen in marvin-os als Lebensereignisse.

---

## 3. Inhalte, priorisiert

Legende: **MVP** = erste Version · **P2** = nächster Schritt · **P3** = später/optional

| # | Inhalt | Prio | Warum / Anmerkung |
|---|---|---|---|
| 1 | Login (E-Mail-Code + Magic Link), Einladung aus marvin-os | MVP | Ohne das nichts. |
| 2 | **Übersicht** mit To-dos, nächstem Termin, Plan auf einen Blick | MVP | Der Ort, an dem der Kunde in 5 Sekunden sieht, wo er steht. |
| 3 | **Gesprächs-Timeline** (Datum, Thema, Ergebnis, nächste Schritte mit DU/MARVIN, Protokoll-PDF) | MVP | Kommt fast geschenkt aus deiner Zoom-Pipeline. Wird vom Kunden nie ungeprüft gesehen (Freigabe). |
| 4 | **Dokumente** (Download) + **Upload** | MVP | Ersetzt PDF-Mail-Anhänge mit sensiblen Daten. |
| 5 | **To-dos für den Kunden** (Upload, Bestätigen, Info) | MVP | Beschleunigt Umsetzung, du jagst weniger hinterher. |
| 6 | **Mein Plan** (3 Säulen, Bausteine mit Status aktiv/geplant/in Prüfung/bewusst nicht) | MVP | Gesamtkonzept auf einen Blick. „Bewusst nicht" ist ein starkes Vertrauenssignal. |
| 7 | **Baustein-Detail „Warum genau das"**: Begründung, Kosten in % **und Euro**, Evidenz, Risiken mit Lösung | MVP (für Vermögensaufbau + Fondsrente), P2 für alle Sparten | Dein USP. Erst für die Bausteine, bei denen Kosten den Unterschied machen. |
| 8 | **Evidenz-Bibliothek** (wiederverwendbare Bausteine: SPIVA, Fama-French, Carhart, CAPE, Behavioral Finance, je mit Quelle) | MVP (10 Stück) | Einmal schreiben, in jedem Baustein verlinken, öffentlich auch als „Wissen". |
| 9 | **Kostenrechner** öffentlich + vorbelegt im Login | MVP | Leadmagnet Nr. 1 und Argument im Kundenbereich. |
| 10 | Termin buchen | MVP | Kein Eigenbau: Google-Kalender-Terminbuchung (du hast Google-Kalender-Lesezugriff in marvin-os) oder Cal.com EU. Siehe Frage 6. |
| 11 | Versicherungsmantel/Tarif-Erklärung (Anbieter, warum, wie funktioniert der Nettotarif) | P2 | Gleiches Template wie #7, andere Felder. |
| 12 | Weitere Rechner: Rentenlücke, BU-Bedarf, Zinseszins, Inflation | P2 | Rentenlücke + BU-Bedarf öffentlich (Leadmagnet), Rest beides. |
| 13 | **Altersvorsorgedepot-Rechner** (Zulagen + Kosten vs. 1,0 %-Deckel des Standarddepots) | **P2, vor 01.01.2027** | Gesetz ist verkündet (BGBl. I 2026 Nr. 156), Förderung startet 01.01.2027. Zeitfenster für einen starken Leadmagneten. Zulagenwerte vor Livegang am Gesetzestext prüfen. |
| 13b | Entnahmeplan, bAV-Förderung | P2/P3 | Entnahmeplan nur im Login, vorbelegt. |
| 14 | Nachrichten (sicherer Kanal statt Mail/WhatsApp) | P2 | §18a FinVermV (Taping) erfasst „sonstige elektronische Kommunikation" zu Finanzanlagen → Nachrichten unveränderbar (append-only, kein Edit/Delete) 10 Jahre archivieren. Vorher mit IHK Stade klären (Frage 9). |
| 15 | Vertragsübersicht | P2 | **Nicht doppelt bauen**, siehe §4. Im MVP stehen Verträge als Bausteine im Plan. |
| 16 | Haushaltsmitglieder (Partner/in mit eigenem Login, geteilte Sicht) | P2 | Datenmodell ist von Anfang an darauf ausgelegt. |
| 17 | „Neu seit deinem letzten Besuch" + Jahresgespräch-Fragebogen | P2 | |
| 18 | Ex-post-Kostenreport jährlich, Depotwert live | P3 | Depotwert nur mit Schnittstelle zur Depotbank; ohne API kein Eigenbau. |
| 19 | Empfehlen-Funktion („Schick das einer Freundin") | P3 | Wettbewerbsrecht/Prämien vorher prüfen. |

**Ergänzungen von mir (über deine Liste hinaus):** „Bewusst nicht"-Status im Plan (#6), Evidenz-Bibliothek als eigenes Objekt (#8), Risiko-Lösung-Paare als Pflichtfeld in jedem Baustein, Onboarding mit Erstinformation-Bestätigung, Datenexport für den Kunden (Art. 20 DSGVO), sichtbarer Sicherheits-Hinweis bei Dokumenten.

---

## 4. Abgrenzung zu blau direkt (aus research.md §5)

**Nicht nachbauen.** Die blau-direkt-Kunden-App heißt **simplr** (App + Web-App, in jeder Lizenz enthalten). Sie deckt ab: Vertragsübersicht per BiPRO, Versicherer-Dokumente, Upload, Schadenmeldung, Adress-/Bankänderung an alle Versicherer, Fremdverträge per Foto, Sach-Vergleichsrechner.

**Dein Portal macht, was simplr nicht macht:** Begründung („Warum"), Kosten in Euro, Evidenz, Gesprächshistorie, Gesamtkonzept über alle drei Säulen, Investment und Altersvorsorgedepot, Beratungsdokumentation, sichere Nachrichten, Jahresreview. Das ist laut Recherche auch die Marktlücke: Keine der geprüften deutschen Pool- oder Vertriebs-Apps erklärt erkennbar das Warum oder zeigt Kosten in Euro.

**Integration in drei Stufen**
1. **MVP:** Kachel „Meine Versicherungsverträge" → Deep-Link `login.simplr.de`. Keine Datenkopie, keine nachgebaute Login-Maske.
2. **Klären** (Frage 7): Welche API-/Qonekto-Rechte stecken in deiner Lizenz, sind Depots abgebildet, kann das Pool-Logo weg, wer ist datenschutzrechtlich verantwortlich (du, Königswege, blau direkt)?
3. **Erst wenn es sich rechnet:** Vertragsdaten über Qonekto ONE/Make (49–99 €/Monat) oder Enterprise-API/dailyUP (998 €/Monat) ins Portal spiegeln, damit Bausteine im Plan automatisch Vertragsnummer, Beitrag und Status zeigen.

Terminbuchung: **meetergo** hat eine fertige AMEISE-Integration. Alternative ohne neues Tool ist die Google-Kalender-Terminbuchung (Frage 6).

---

## 5. Datenmodell (Supabase „portal")

Konventionen aus marvin-os: `tenant_id` überall, `deleted_at` für Soft-Delete, Migrationsformat `YYYYMMDDHHMMSS_NNN_name.sql`, RLS auf jeder Tabelle.

```sql
-- Rollen
create type portal_rolle as enum ('kunde','berater','partner','mitarbeiter');

create table app_users (           -- 1:1 zu auth.users
  id uuid primary key references auth.users,
  tenant_id uuid not null,
  rolle portal_rolle not null default 'kunde',
  anzeigename text, du_form boolean default true,
  os_partner_id uuid,              -- Verweis in marvin-os (Partner-Routing, D4)
  created_at timestamptz default now(), deleted_at timestamptz
);

create table haushalte (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  os_haushalt_id uuid unique not null,   -- Schlüssel zu marvin-os
  bezeichnung text not null,
  betreuer_id uuid references app_users,  -- Marvin oder Partner
  status text check (status in ('aktiv','ruhend','beendet')) default 'aktiv',
  mandat_beendet_am date,                 -- startet Löschfristen
  deleted_at timestamptz
);

create table haushalt_mitglieder (
  haushalt_id uuid references haushalte, user_id uuid references app_users,
  rolle text check (rolle in ('hauptkunde','mitglied')) default 'hauptkunde',
  os_person_id uuid, primary key (haushalt_id, user_id)
);

create table einladungen (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  haushalt_id uuid references haushalte, email text not null,
  token_hash text not null, gueltig_bis timestamptz not null, eingeloest_am timestamptz
);

create table gespraeche (            -- Timeline
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  haushalt_id uuid not null references haushalte,
  os_transkript_id uuid,             -- Herkunft
  datum timestamptz not null, dauer_min int, kanal text,  -- video/vor_ort/telefon
  titel text not null, ergebnis_md text, naechste_schritte jsonb,  -- [{text, wer:'kunde'|'berater', erledigt}]
  status text check (status in ('entwurf','freigegeben')) default 'entwurf',
  freigegeben_am timestamptz, freigegeben_von uuid, deleted_at timestamptz
);

create table plan_bausteine (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  haushalt_id uuid not null references haushalte,
  saeule text check (saeule in ('absicherung','vorsorge','vermoegen')) not null,
  sortierung int, titel text not null, untertitel text,
  status text check (status in ('aktiv','geplant','in_pruefung','bewusst_nicht','beendet')),
  anbieter text, produkt text, tarif text,
  begruendung_md text,                 -- „Warum genau das"
  kennzahlen jsonb,                    -- {sparrate, ter, effektivkosten, horizont, ...}
  allokation jsonb,                    -- [{name, anteil}]
  kosten jsonb,                        -- [{posten, betrag_eur, prozent}]
  risiken jsonb,                       -- [{risiko, loesung}]  ← Pflicht, mind. 1
  evidenz_ids uuid[],
  gespraech_id uuid references gespraeche,
  sichtbar boolean default false, deleted_at timestamptz
);

create table evidenz (                 -- Bibliothek, mandantenweit
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  slug text unique, titel text, kurz_md text, label text,  -- z. B. 'SPIVA'
  quelle_titel text, quelle_url text, stand date, oeffentlich boolean default true
);

create table dokumente (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  haushalt_id uuid not null references haushalte,
  kategorie text check (kategorie in ('beratung','vertrag','pflicht','upload','sonstiges')),
  titel text not null, storage_path text not null, mime text, bytes int, sha256 text,
  quelle text check (quelle in ('berater','kunde','system')),
  sensibel boolean default false,      -- Gesundheitsdaten → nur mit 2. Faktor
  gespraech_id uuid references gespraeche, baustein_id uuid references plan_bausteine,
  sichtbar boolean default false,
  aufbewahren_bis date,                -- aus Löschkonzept
  hochgeladen_von uuid, created_at timestamptz default now(), deleted_at timestamptz
);

create table todos (
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  haushalt_id uuid not null references haushalte,
  typ text check (typ in ('upload','bestaetigen','info','termin')),
  titel text not null, beschreibung_md text, faellig_am date,
  dokument_id uuid references dokumente, erledigt_am timestamptz, erledigt_von uuid,
  erinnert_am timestamptz[], deleted_at timestamptz
);

create table nachrichten (            -- P2
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  haushalt_id uuid not null references haushalte,
  von uuid not null references app_users, text text not null,
  gelesen_am timestamptz, created_at timestamptz default now()
);

create table audit_log (              -- append-only
  id bigserial primary key, tenant_id uuid not null, user_id uuid,
  aktion text not null,               -- login, dokument_abruf, upload, freigabe, export …
  objekt text, objekt_id uuid, ip_hash text, created_at timestamptz default now()
);

create table leads (                  -- öffentliche Rechner, minimal
  id uuid primary key default gen_random_uuid(), tenant_id uuid not null,
  email text, rechner text, eingaben jsonb, einwilligung_text text, einwilligung_am timestamptz,
  doi_bestaetigt_am timestamptz, an_os_uebergeben_am timestamptz, created_at timestamptz default now()
);
```

### Row Level Security

```sql
-- Hilfsfunktionen (security definer, search_path fix)
create function ist_mitglied(h uuid) returns boolean ...   -- auth.uid() in haushalt_mitglieder
create function ist_berater() returns boolean ...          -- rolle = 'berater' AND aal = 'aal2'
create function betreut(h uuid) returns boolean ...        -- rolle = 'partner' AND haushalte.betreuer_id = auth.uid() AND aal2
create function hat_aal2() returns boolean as $$ select coalesce(auth.jwt()->>'aal','') = 'aal2' $$;

-- Muster für Kundensicht (gespraeche, plan_bausteine, dokumente, todos)
create policy kunde_liest on gespraeche for select to authenticated
  using (ist_mitglied(haushalt_id) and status = 'freigegeben' and deleted_at is null);
create policy team_alles on gespraeche for all to authenticated
  using (ist_berater() or betreut(haushalt_id)) with check (ist_berater() or betreut(haushalt_id));

-- Dokumente: sensible nur mit zweitem Faktor
create policy kunde_liest_dok on dokumente for select to authenticated
  using (ist_mitglied(haushalt_id) and sichtbar and deleted_at is null and (not sensibel or hat_aal2()));
create policy kunde_upload on dokumente for insert to authenticated
  with check (ist_mitglied(haushalt_id) and quelle = 'kunde' and kategorie = 'upload');

-- To-dos: Kunde darf nur abhaken, über RPC todo_erledigen(id) statt UPDATE-Recht
-- audit_log: insert nur über security-definer-Funktion, select nur ist_berater()
-- anon: revoke all auf allen Tabellen; leads nur über Edge Function (Captcha/Turnstile + Rate-Limit)
```

**Storage:** ein privater Bucket `dokumente`, Pfad `<tenant>/<haushalt>/<uuid>.<ext>`. Kein öffentlicher Bucket. Download nur über Edge Function `dokument-abrufen`: prüft RLS, schreibt `audit_log`, gibt signierte URL mit 60 s Laufzeit zurück. Upload: Edge Function prüft MIME + Magic Bytes (Muster aus Nele: `%PDF-`-Check), max. 20 MB.

**Rollen-Matrix**

| | Kunde | Berater (du) | Partner | Mitarbeiter (später) |
|---|---|---|---|---|
| Eigene Haushalte sehen | nur eigener, nur freigegeben | alle | nur betreute | konfigurierbar |
| Entwürfe sehen/freigeben | nein | ja | betreute | nein (nur vorbereiten) |
| Dokumente hochladen | in eigenen Haushalt | ja | betreute | ja |
| Sensible Dokumente | mit 2. Faktor | mit 2. Faktor | mit 2. Faktor | nein |
| 2. Faktor Pflicht | optional (Pflicht für sensible Dok.) | **Pflicht** | **Pflicht** | **Pflicht** |

---

## 6. Login und Sicherheit (abgeglichen mit research.md §B5)

- **Erstanmeldung:** Einladungs-Mail mit Magic Link **und** 6-stelligem Code. Den Code braucht es, weil Firmen-Mailfilter Links vorab öffnen und damit entwerten.
- **Danach Passkey einrichten** (Face ID/Fingerabdruck), RP-ID dauerhaft auf die Hauptdomain festlegen. Das BSI empfiehlt Passkeys; Codes per Mail gelten nicht als phishing-resistent. Supabase-Passkeys sind laut Doku noch **experimentell** → SDK-Version festschreiben, **TOTP-App als Fallback immer aktiv**.
- **Zweiter Faktor (aal2) per RLS erzwungen** für: alle Team-Rollen (du, Partner, Mitarbeiter) immer; für Kunden beim Öffnen sensibler Dokumente (Gesundheitsdaten) und Nachrichten. Ein Code per Mail allein reicht nicht als Dauer-Login für Art.-9-Daten.
- **Sessions:** Inaktivitäts-Logout nach 30 min, Hinweis-Mail bei neuem Gerät, Wiederherstellung nur über dich (z. B. kurzer Videocall), nie automatisch.
- **Kein localStorage für Daten** (Regel aus marvin-os).
- **Header:** CSP enforced (bei Nele nur Report-Only), HSTS, X-Frame-Options DENY.
- **E-Mails enthalten nie Inhalte**, nur „Es gibt Neues" + Link. Gesundheitsdaten per Mail bräuchten laut DSK-Orientierungshilfe in der Regel Ende-zu-Ende-Verschlüsselung.
- **Hosting-Regeln:** Supabase-Projekt fest in eu-central-1, **Edge Functions auf Frankfurt pinnen** (laufen sonst nutzernah). **Netlify nur fürs statische Frontend**: keine Kundendaten durch Netlify Functions (Standard-Region Ohio) oder Netlify Forms.
- **Gesundheitsdaten:** gesonderte ausdrückliche Einwilligung (Art. 9), zusätzliche anwendungsseitige Verschlüsselung der Datei (Schlüssel im Supabase Vault), Zugriff nur aal2.
- **Datenexport + Löschung:** Kunde kann alles als ZIP exportieren; Löschung nach Fristen (§7 Nr. 9).
- **Fristen** (research.md §B3): FinVermV-Unterlagen und Taping 10 Jahre, Beratungsdoku VVG empfohlen 10 Jahre (Haftung), danach löschen und Löschung protokollieren.

---

## 7. Automatisierungen

Aufteilung: **Supabase Edge Functions** für alles, was Daten zwischen den Projekten bewegt (transaktional, getypt, testbar). **n8n** für Zeitpläne, Mails und Benachrichtigungen. Jeder n8n-Webhook bekommt ein Shared Secret (bei Nele fehlt das).

| # | Auslöser | Ablauf | Wo |
|---|---|---|---|
| 1 | Gespräch analysiert (marvin-os Pipeline) | Neuer Step `portal_entwurf`: Claude (über Anonymizer) schreibt Kundenfassung in Du/Sie: Titel, Ergebnis, nächste Schritte. Landet als **Entwurf** in marvin-os. | marvin-os Edge |
| 2 | Du klickst „Im Kundenbereich freigeben" | Edge Function `portal-publish` schreibt Gespräch + Protokoll-PDF + neue To-dos ins Portal. | marvin-os → portal |
| 3 | Freigabe erfolgt | Mail „Neues in deinem Kundenbereich" (ohne Inhalt). Bündelung: max. 1 Mail pro Tag. | n8n + Resend EU |
| 4 | Beratungsprotokoll erzeugt | Statt PDF als Mail-Anhang (heute `send-protokoll-pdf`): Ablage im Portal, Mail mit Link. Versandnachweis = Audit-Log-Eintrag „bereitgestellt" + „abgerufen". | marvin-os |
| 5 | Kunde lädt hoch | Datei bleibt im Portal; Kopie/Referenz nach marvin-os; Todoist-Aufgabe „Unterlage prüfen" für dich (bestehende Integration). | portal Edge → marvin-os |
| 6 | To-do offen | Erinnerung nach 3 und 7 Tagen, danach Aufgabe für dich. | n8n (täglich) |
| 7 | 11 Monate nach letztem Gespräch | Jahresgespräch-Einladung + Fragebogen; Antworten → `lebensereignisse` in marvin-os. | n8n |
| 8 | Lead aus Rechner | Double-Opt-in → Haushalt `status=lead` in marvin-os → Todoist. Ohne DOI nach 30 Tagen löschen. | portal Edge + n8n |
| 9 | Täglich nachts | Löschkonzept: abgelaufene `aufbewahren_bis` markieren und dir zur Bestätigung vorlegen (kein Blind-DELETE, wie D6 in marvin-os). Backup (Logik aus `aga-website/supabase/functions/backup`, aber als Supabase-Cron in Frankfurt, nicht als Netlify Function). | Supabase pg_cron / n8n |
| 10 | Optional: Google Drive | Wenn du Kundenordner in Drive pflegst: neuer PDF in `Kunden/<Name>/Kundenbereich/` → Dokument-Entwurf im Portal (Muster `drive-bridge`). Nur lesen, nie löschen. | Edge / n8n |

---

## 8. Design-System

Tokens werden **als Erstes** angelegt (Phase 3, Schritt 1) und von Website, Kundenbereich und später marvin-os gemeinsam genutzt (`shared/design/tokens.ts` erweitern).

**Farbe**
| Token | Hell | Dunkel | Einsatz |
|---|---|---|---|
| `bordeaux` | #7D1C36 | #9E2D4C | Marke, Primär-Buttons |
| `accent` (Text) | #7D1C36 | #EC94A9 | Links, Zahlen, Fokus |
| `accent-soft` | #F6ECEF | #2D1A21 | CTA-Flächen |
| `ink` (Anthrazit) | #232024 | #F3EFF0 | Text |
| `ink-2` / `ink-3` | #5D575A / #8D8588 | #BFB6B9 / #8F8589 | Sekundärtext, Labels |
| `surface` / `line` | #F7F5F5 / #E8E3E4 | #1D1A1D / #332D31 | Flächen, Linien |
| `ok` / `warn` | #2E7550 / #9A5F0E | #7CC79C / #E3B061 | Status, Risiko/Lösung |

Hinweis: marvin-os nutzt aktuell **#7D1F2E**, du hast **#7D1C36** genannt. Siehe offene Frage 3.

**Typografie (Empfehlung)**
- **Überschriften: Lora** (600). Passt zu deinen Kunden-PDFs, liest sich bei großen Größen ruhig und hochwertig, Ziffern sauber. Georgia als Fallback, damit es dem CI entspricht.
- **Text & UI: Geist.** Helvetica gibt es nicht frei fürs Web; Geist ist eine neutrale, moderne Grotesk im Helvetica-Geist, sehr gut lesbar auf dem Handy, und sie läuft bereits in marvin-os. Helvetica bleibt Fallback.
- **Zahlen: Geist Mono** mit Tabellenziffern für Beträge, Prozente, Kosten. Kosten sind dein Thema, also bekommen Zahlen eine eigene Stimme.
- **Alle Schriften selbst gehostet** (Fontsource), kein Google-Fonts-CDN (Urteil LG München I, 20.01.2022, 3 O 17493/20). Der Prototyp lädt sie nur zur Vorschau von Google.

**Raster & Form:** 4er-Spacing (4/8/12/16/24/32/48/72), Radien 8/14/22, Schatten nur für hervorgehobene Objekte, Karten nur wo sie Objekte trennen. Mobile: Tab-Leiste unten, eine Spalte. Desktop: Seitenleiste, Inhalt max. 1080 px. Dark Mode von Anfang an.

**Sprachregeln für UI-Texte:** Du-Form (Sie-Variante über `du_form` pro Haushalt), kurze Sätze, Aktiv, jede Risiko-Aussage mit Lösung, keine Floskeln. Beispiel aus dem Prototyp: „Ein Crash von 30–50 % ist bei Aktien zwischendurch normal." → „Notgroschen liegt separat. Du musst nie im Tief verkaufen."

**Impressum/Pflichtangaben austauschbar:** zentrale Datei `rechtliches.ts` (Firma, Rechtsform, Register, IHK-Nr., Erlaubnisse §34d/§34f, Kooperation Königswege, Pool, Schlichtungsstellen, VSH). Website-Footer, Impressum, Erstinformation, PDF-Footer und Mail-Signatur lesen alle daraus. GmbH-Umstellung = eine Datei ändern.

---

## 9. Rechner: öffentlich vs. Login

| Rechner | Öffentlich | Login (vorbelegt) | Leadmagnet | Prio |
|---|---|---|---|---|
| Kostenrechner (TER/Effektivkosten, % und €) | ✓ | ✓ alt vs. neu aus Gespräch | **stark** | MVP |
| Rentenlücke | ✓ | ✓ | stark | P2 |
| BU-Bedarf | ✓ | ✓ | mittel | P2 |
| Zinseszins | ✓ | ✓ | schwach (SEO) | P2 |
| Inflation | ✓ | ✓ | schwach (SEO) | P2 |
| Entnahmeplan | – | ✓ | – | P2 |
| Altersvorsorgedepot (Zulagen + Kosten) | ✓ | ✓ | **stark, Timing 2027** | P2 |
| bAV-Förderung | – | ✓ | – | P3 |

Jeder Rechner: eine reine Rechenfunktion in TypeScript mit Unit-Tests (Rechenlogik versioniert, Stand-Datum sichtbar), Disclaimer gemäß research.md §B8, keine Speicherung der Eingaben ohne Einwilligung. **Öffentliche Rechner nennen keine konkreten Produkte** (sonst Nähe zur Anlageberatung); frühere Wertentwicklung nur mit mind. 5 Jahren, Quelle und Warnhinweis.

---

## 10. Umsetzung Phase 3 (nach Freigabe)

1. **Fundament:** Repo `marvin-website` anlegen, Design-Tokens, Basis-Komponenten, `rechtliches.ts`, Supabase-Projekt „portal" + Migrationen 001–00x mit RLS-Tests (Muster `supabase/tests/059_rls_check.sql`).
2. **Öffentlich:** Startseite + Kostenrechner (live, mit Tests) + Termin-CTA + Rechtsseiten.
3. **Kundenbereich MVP:** Login/Einladung, Übersicht, Plan + Baustein-Detail, Timeline, Dokumente + Upload, To-dos.
4. **marvin-os-Anbindung:** `portal-publish`, Einladung, Upload-Rückweg, Step `portal_entwurf`.
5. **n8n:** Mails, Erinnerungen, Jahresgespräch, Lead-DOI.
6. **Abnahme:** Sicherheitsreview, Lighthouse/Accessibility, Testkunde Max Mustermann, dann erste 3 echte Kunden als Pilot.

Danach iterativ P2.

---

## 11. Offene Fragen an dich (in Abarbeitungsreihenfolge)

1. **Repo deiner Website:** Ich habe kein Repo für marvinallers.de gefunden (nur marvin-os, picture-by-nele, aga-website). Prüf, ob es eins gibt, und schick mir Link oder Pfad. *Empfehlung:* Wenn keins existiert oder nur ein Entwurf, starte ich ein neues Repo `marvin-website`. Bitte Ja/Nein.
2. **Domain:** marvin-os nutzt `marvinallers.de` (Mail `beratung@marvinallers.de`), in GATE_ENTSCHEIDUNGEN steht `marvin-allers.de`. Welche ist die Hauptdomain? *Empfehlung:* `marvinallers.de`, Kundenbereich unter `marvinallers.de/kunde`. Das ist wichtig, weil Passkeys fest an die Domain gebunden werden.
3. **Bordeaux-Ton:** marvin-os nutzt #7D1F2E, du hast #7D1C36 genannt. Prüf, was in deinen PDFs und auf den Visitenkarten steht. *Empfehlung:* #7D1C36 überall, ich ziehe marvin-os nach.
4. **Typografie:** Lora für Überschriften, Geist für Text, Geist Mono für Zahlen (im Prototyp so umgesetzt). *Empfehlung:* Ja.
5. **Eigenes Supabase-Projekt „portal"** getrennt von marvin-os, ca. 10 $/Monat (Preis im Supabase-Dashboard prüfen). *Empfehlung:* Ja, aus Sicherheitsgründen (§1).
6. **Terminbuchung:** meetergo (fertige AMEISE-Integration, eigene Lizenz) oder Google-Kalender-Terminbuchung (kein neues Tool). Prüf, ob du meetergo schon hast. *Empfehlung:* Google-Kalender, solange du kein meetergo hast.
7. **blau direkt anschreiben:** Frag schriftlich nach den API- und Qonekto-Rechten deiner Lizenz, ob Depots abgebildet werden, ob das Pool-Logo in simplr weg kann und wer datenschutzrechtlich verantwortlich ist (du, Königswege, Pool). Antwort an mich weiterleiten. *Empfehlung:* Ja. Bis dahin baue ich nur den Deep-Link.
8. **Google-Drive-Sync:** In Neles Repo gibt es keinen. Lebt er als n8n-Workflow auf deinem IONOS-VPS? Wenn ja, exportier den Workflow (JSON) und schick ihn mir. Und: Pflegst du Kundenordner in Drive, die ins Portal sollen? *Empfehlung:* Für den MVP ohne Drive, PDFs kommen direkt aus marvin-os.
9. **IHK Stade (Taping):** Frag nach, ob Portal-Nachrichten und Videocalls zu Finanzanlagen unter §18a FinVermV fallen. *Empfehlung:* Bis zur Antwort archiviere ich Nachrichten unveränderbar 10 Jahre und lasse Videocalls außen vor.
10. **Datenschutz:** Lass einen Datenschutzbeauftragten oder Anwalt die DSFA-Schwellwertprüfung, den Einwilligungstext für Gesundheitsdaten und den Rechner-Disclaimer prüfen (Entwürfe in research.md §B4 und §B8). *Empfehlung:* Ja, vor dem Livegang mit echten Kunden.
11. **Zulassungen:** Bestätige, dass du §34d **und** §34f hältst und beide über dieselbe Person laufen (GmbH später). In marvin-os ist das Protokoll-Modul nur auf §34d ausgerichtet. *Empfehlung:* Ich lege in `rechtliches.ts` beide Erlaubnisse an.
12. **Logo und Foto:** Im Projekt liegt kein sauberes Logo. Schick mir das Logo als SVG und ein Porträtfoto. *Empfehlung:* Bis dahin nutze ich die „M"-Marke aus dem Prototyp als Platzhalter.
13. **Freigabe:** Ist der MVP-Umfang aus §3 + §10 so okay? *Empfehlung:* Ja. Danach starte ich Phase 3 mit Design-Tokens und Kostenrechner.
