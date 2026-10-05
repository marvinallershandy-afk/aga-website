# Livegang-Checkliste SV Agathenburg-Dollern

Konsolidiert aus Audit v19 Block B §5 + Block C §5. **Abhaken, von oben nach
unten.** Alles unter „Blockierend" muss erledigt sein, bevor `aga-erste.de`
öffentlich geht. Kommandos sind so, dass sie sich kopieren lassen — Platzhalter
in `<…>` vorher ersetzen.

Projekt-Eckdaten:
- Supabase: `fwiivwmoyagcdrjvhaou` (eu-central-1) → URL `https://fwiivwmoyagcdrjvhaou.supabase.co`
- Netlify-Site heute: `sva-agathenburg-dollern.netlify.app`
- Zieldomain: `aga-erste.de` (DNS bei IONOS)
- Supabase CLI: `supabase link --project-ref fwiivwmoyagcdrjvhaou` (einmalig)

---

## A. Blockierend — ohne das nicht live

### A1. Production ersetzen (Netlify ↔ GitHub)
- [ ] Netlify-Site mit dem GitHub-Repo verbinden, Production-Branch auf den
      `v14-premium`-Stand setzen. **`main` ersetzen, nicht mergen** (25 Konflikte
      laut v14-Audit) — der heutige Live-Stand (08.07., Fake-Spieler, ohne
      Impressum) ist der größte Einzelschaden.
- [ ] Erster Production-Deploy läuft grün durch.

### A2. Build-Env setzen (sonst baut CI mit Seeds)
Netlify → Site settings → Environment variables:
- [ ] `SUPABASE_URL = https://fwiivwmoyagcdrjvhaou.supabase.co`
- [ ] `SUPABASE_READ_KEY = <anon-key>` (öffentlicher anon-Key, kein service_role!)
- [ ] `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` prüfen (für den Admin im Browser)
- [ ] Build-Log kontrollieren: Zeile `fetch-content: Overlay geschrieben (players=…)`
      erscheint (nicht die `!!`-Warnung).

### A3. „Website veröffentlichen" durchstechen (Build-Hook)
- [ ] Netlify → Build & deploy → Build hooks → neuen Hook anlegen, URL kopieren.
- [ ] Secret in Supabase hinterlegen:
      ```bash
      supabase secrets set NETLIFY_BUILD_HOOK=https://api.netlify.com/build_hooks/<id>
      ```
- [ ] Edge Function ist deployt: `supabase functions deploy publish-site`
- [ ] Im Admin „Website veröffentlichen" drücken → Eintrag in `sva_publish_log`
      mit `status='ok'` = Beweis, dass die Kette läuft.

### A4. Domain aga-erste.de (IONOS → Netlify)
- [ ] IONOS: `A @` und `CNAME www` auf Netlify zeigen lassen (Werte aus der
      Netlify-Domain-UI). **MX nicht anfassen** — die Resend-Records bleiben.
- [ ] Netlify: Domain hinzufügen, HTTPS-Zertifikat abwarten/prüfen.

### A5. URL-Umzug im Code
- [ ] canonical / `og:url` / `og:image` in `index.html`, `live.html`,
      `partner.html`, `album.html`, `galerie.html` auf `https://aga-erste.de` ändern.
- [ ] `public/robots.txt` (Sitemap-Zeile) + `public/sitemap.xml` auf die Domain.
- [ ] Sitemap um `/live`, `/galerie`, `/impressum` ergänzen.

### A6. Edge-Function-Secret für den Kalender
- [ ] ```bash
      supabase secrets set SITE_URL=https://aga-erste.de
      ```
      Sonst stehen Netlify-URLs in jedem abonnierten Kalender (Abo-Links bauen auf
      `SITE_URL`).

### A7. Supabase Auth-URLs
- [ ] Authentication → URL Configuration: `Site URL = https://aga-erste.de`,
      Redirect-Allowlist auf `https://aga-erste.de/**` (Einträge existieren bereits).
- [ ] „Confirm email" **AN** (Admin-/Album-Schutz, docs/ALBUM.md §1).

### A8. Caching-Bug /galerie
- [ ] In `netlify.toml` eine explizite Regel `for = "/galerie"` mit
      `Cache-Control: max-age=0, must-revalidate` **vor** `/galerie/*` setzen
      (HTML kommt heute mit `max-age=604800` → bis zu 7 Tage altes Bundle).
      *(Diese Datei pflegt Paket P2a — hier nur als Livegang-Haken.)*

### A9. Impressum / Datenschutz
- [ ] VR-Nummer (Amtsgericht Tostedt) ins Impressum, rote Hinweis-Box entfernen,
      `noindex` aus `public/impressum.html` raus.
- [ ] Datenschutz: TODO-MARVIN füllen (Hoster-/Supabase-Firmierung,
      Benachrichtigungs-Anbieter), AV-Verträge Netlify + Supabase abschließen,
      TODO-JURIST prüfen lassen, `noindex` aus `public/datenschutz.html` raus.

### A10. Keepalive bis zum Livegang
- [ ] Die Scheduled Function `supabase-keepalive` läuft erst mit dem
      Production-Deploy. Bis dahin das Supabase-Projekt wöchentlich einmal von
      Hand „wecken" (Dashboard öffnen), sonst pausiert es nach 7 Tagen Ruhe.

---

## B. Betrieb scharfschalten (v19-B — diese Pakete)

### B1. FuPa-Abgleich (Paket 1)
- [ ] Function deployen: `supabase functions deploy fupa-sync --no-verify-jwt`
- [ ] Cron-Secret erzeugen und **beidseitig** setzen (gleicher Wert):
      ```bash
      supabase secrets set FUPA_CRON_SECRET=<langer-zufallswert>
      ```
      Netlify-Env: `FUPA_CRON_SECRET = <derselbe Wert>`
- [ ] FuPa-Teamseite steht in „Verein & Links" (ist gepflegt:
      `https://www.fupa.net/team/sv-agathenburg-dollern-m1-2026-27`).
- [ ] Probe: im Admin (Übersicht → Karte „FuPa-Abgleich") „Jetzt abgleichen".
      Erwartung: `sva_sync_log` bekommt `status='ok'`; bei Änderungen wird
      zusätzlich ein Build angestoßen.
- [ ] Zeitplan läuft automatisch über die Netlify Scheduled Functions
      `fupa-sync-taeglich` (05:00 UTC), `fupa-sync-sonntag-abend` (16:30 UTC),
      `fupa-sync-sonntag-spaet` (19:30 UTC). Nach dem ersten Production-Deploy im
      Netlify-Dashboard unter „Functions → Scheduled" sichtbar.
- [ ] *(Optional, exaktere Ortszeit)* statt Netlify-Cron `pg_cron`+`pg_net`
      aktivieren (Dashboard → Database → Extensions) und drei `cron.schedule`-
      Jobs anlegen, die per `net.http_post` die Function mit `x-cron-secret`
      rufen. Heute **nicht** installiert → Netlify ist der verdrahtete Weg.

### B2. Backup (Paket 2)
- [ ] Migration anwenden (siehe C.) legt Bucket `sva_backup` + `sva_backup_dump()` an.
- [ ] Function deployen: `supabase functions deploy backup --no-verify-jwt`
- [ ] Cron-Secret setzen (beidseitig):
      ```bash
      supabase secrets set BACKUP_CRON_SECRET=<langer-zufallswert>
      ```
      Netlify-Env: `BACKUP_CRON_SECRET = <derselbe Wert>`
- [ ] Probe: Function einmal auslösen, dann im Storage prüfen, dass
      `sva_backup/backup-<heute>.json` liegt (Details: docs/BACKUP.md).
- [ ] Zeitplan: Netlify `backup-taeglich` (02:00 UTC) läuft nach dem Deploy.
- [ ] Restore einmal proben (Trockenlauf): `node scripts/backup/restore.mjs --from-bucket`.

### B3. Kochsafe-Härtung (Paket 3)
- [ ] Nach Anwenden der Migration prüfen (Advisor): keine anon-SECDEF-RPCs mehr.
- [ ] *(Separat, Dashboard)* die 4 Kochsafe-Edge-Functions (`deepgram-token`,
      `recipe-chat`, `suggest-week`, `bring-export`) löschen — hängen ggf. an
      bezahlten API-Keys. `kochsafe.netlify.app` aus der Auth-Redirect-Allowlist
      entfernen.

---

## C. Migrationen anwenden (Reihenfolge!)

Neue v19-B-Migrationen, **in dieser Reihenfolge** nach dem bestehenden Stand:

```bash
supabase link --project-ref fwiivwmoyagcdrjvhaou   # einmalig
supabase db push
# wendet an: 20261010110000_sva_fupa_sync.sql
#            20261010120000_sva_backup_bucket.sql
#            20261010130000_sva_haertung.sql
```

Alternativ je Datei im Dashboard (SQL Editor) in genau dieser Reihenfolge
ausführen. Alle drei sind idempotent (mehrfaches Anwenden schadet nicht).

Secrets-Übersicht (Supabase) nach dem Livegang:
`NETLIFY_BUILD_HOOK`, `SITE_URL`, `FUPA_CRON_SECRET`, `BACKUP_CRON_SECRET`
(+ die bestehenden Google-/Resend-Secrets). In Netlify zusätzlich:
`SUPABASE_URL`, `SUPABASE_READ_KEY`, `FUPA_CRON_SECRET`, `BACKUP_CRON_SECRET`.

---

## D. Erste Woche danach

- [ ] **HIBP an:** Supabase → Authentication → Policies → „Leaked password
      protection" aktivieren (Advisor-Warnung verschwindet, geklaute Passwörter
      für Album-/Admin-Konten blockiert).
- [ ] **Uptime-Monitor:** UptimeRobot (kostenlos) auf `https://aga-erste.de/`,
      `/live` und `https://aga-erste.de/kalender.ics` — Benachrichtigung per Mail.
- [ ] **Deploy-Fail-Mail:** Netlify → Notifications → „Deploy failed" → E-Mail an
      Marvin. Sonst drückt jemand „Veröffentlichen" und niemand merkt den roten Build.
- [ ] **Zweiter Admin (Bus-Faktor):** im Admin unter „Team & Zugänge" eine zweite
      Person (Niko?) als `admin` anlegen; Notfall-Zugang im Passwort-Manager des
      Vereins hinterlegen. `sm_admins` hat heute genau 1 Eintrag.
- [ ] **Security-Header** (Paket P2a, `netlify.toml`): X-Frame-Options,
      X-Content-Type-Options, Referrer-Policy, Permissions-Policy; CSP zunächst
      report-only.
- [ ] Lighthouse + Search Console einmalig; Sitemap einreichen.
- [ ] Preview-URLs nie teilen (noindex ist auf Previews automatisch gesetzt).

---

## Kurz-Referenz „Was wohin"

| Was | Wo gesetzt |
|---|---|
| `NETLIFY_BUILD_HOOK`, `SITE_URL`, `FUPA_CRON_SECRET`, `BACKUP_CRON_SECRET` | Supabase Secrets (`supabase secrets set`) |
| `SUPABASE_URL`, `SUPABASE_READ_KEY`, `FUPA_CRON_SECRET`, `BACKUP_CRON_SECRET` | Netlify Environment variables |
| Auth Site-URL + Redirect-Allowlist, HIBP, Confirm email | Supabase → Authentication |
| Build-Hook, Scheduled Functions, Deploy-Fail-Mail, Domain | Netlify-Dashboard |
| A/CNAME-Records, MX unverändert | IONOS |
