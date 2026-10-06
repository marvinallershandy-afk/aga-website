# Statistik, Kalender-Abo & Probetraining (v18-A „Alltag“)

Stand: 05.10.2026. Drei Bausteine für die Vereinsziele **Zuschauer · Spieler · Sponsoren**,
Hauptkanal **Instagram @svagathenburg**.

---

## 1. Cookiefreie Statistik

### Was gezählt wird
Nach dem ersten Bild (im Leerlauf, `requestIdleCallback`) schickt jede Seite **einen** kleinen
Aufruf an die RPC `web_zaehlen(pfad, quelle, geraet)`. Die Datenbank erhöht nur eine
**Tagessumme** in `sva_statistik_tage`:

| Spalte | Beispiel | Werte |
|---|---|---|
| `tag` | 2026-10-11 | Datum (Europe/Berlin) |
| `pfad` | `/`, `/live`, `/#training` | feste Liste (Seiten, Karten-Orte) |
| `quelle` | `instagram:bio` | `instagram · facebook · google · whatsapp · qr · direkt · intern · sonstige` (+ Medium `bio · story · post · reel · platz · plakat · flyer · status · gruppe`) |
| `geraet` | `mobil` | `mobil` / `desktop` |
| `zaehler` | 37 | Summe |

**Nicht** gespeichert: IP, User-Agent, Uhrzeit, Cookies, IDs, localStorage. Bots/Prerender
(`navigator.webdriver`, „bot/crawler/headless“) werden im Browser aussortiert.

**Ereignisse** (gleiche Tabelle, Pfad `#ereignis:<name>`, je Seitenaufruf höchstens einmal):

| Ereignis | Ziel | Wo ausgelöst |
|---|---|---|
| `kalender-abo` | Zuschauer | Kalender-Sheet → Abo (Apple/Google/Outlook) |
| `kalender-termin` | Zuschauer | Kalender-Sheet → einzelnes Spiel eintragen |
| `kalender-link` | Zuschauer | Kalender-Adresse kopiert |
| `album-checkin` | Zuschauer | `/album?c=…` (QR-Check-in am Platz) |
| `probetraining-start` | Spieler | Probetraining-Assistent geöffnet |
| `probetraining` | Spieler | „In WhatsApp öffnen“ / „Per E-Mail senden“ getippt |
| `partner-anfrage` | Sponsoren | Anfrage auf `/partner` erfolgreich abgeschickt |
| `instagram` | Instagram | irgendein Link zu instagram.com getippt |
| `tipp-abgegeben` · `elf-gespeichert` | Zuschauer | `/tippen`: Tipp bzw. „Deine Elf“ gespeichert (v20-T) |
| `liga-gegruendet` · `liga-beigetreten` · `tipp-teilen` | Instagram/Reichweite | `/tippen`: Stammtisch-Liga gegründet/beigetreten, Story-Bild geteilt |

**Quelle** = `utm_source`/`utm_medium` aus der Adresse; sonst grob aus `document.referrer`
(instagram/facebook/google/whatsapp, eigene Seite = `intern`, Rest `sonstige`); ohne Referrer
erkennt der Browser den Instagram-/Facebook-In-App-Browser am User-Agent (wird nicht übertragen),
sonst `direkt`.

### Schutz gegen Missbrauch (in der DB)
- Pfad, Gerät: nur feste Listen, sonst abgelehnt. Quelle/Medium: feste Liste, sonst `sonstige`
  bzw. ohne Medium → keine freien Texte in der DB, Zeilen pro Tag fest begrenzt.
- Deckel: max. **5 000** je Tageszeile, max. **50 000** Aufrufe pro Tag gesamt.
- anon darf nur `web_zaehlen()` aufrufen — nicht lesen, nicht direkt schreiben.
  Auswertung `web_statistik(p_tage)` nur für `is_sm_admin()`.

### Admin → Statistik
`/admin/statistik`: 7/30 Tage, Seitenaufrufe + Vergleich mit dem Zeitraum davor, Balken je Tag
(Sonntage rot), **Quellen mit Instagram vorn** (Bio vs. Story), Ziele (Zuschauer/Spieler/Sponsoren),
Top-Seiten, Handy-Anteil, Kurz-Links. Hinweis für die Partner-Mediadaten (30-Tage-Aufrufe).

## 2. Kurz-Links für Instagram & Plakate

Netlify leitet um (302, `netlify.toml`):

| Kurz-Link | Ziel | Verwenden für |
|---|---|---|
| **aga-erste.de/ig** | `/?utm_source=instagram&utm_medium=bio` | Instagram-Profil → **Link in der Bio** |
| **aga-erste.de/story** | `/?utm_source=instagram&utm_medium=story` | Instagram-Story → **Link-Sticker** |
| aga-erste.de/qr | `/?utm_source=qr&utm_medium=platz` | QR-Codes auf Plakaten am Platz |
| aga-erste.de/wa | `/?utm_source=whatsapp` | WhatsApp-Gruppen / Status |
| **aga-erste.de/sonntag** | `/live?utm_source=instagram&utm_medium=story` | Spieltags-**Story** → Live-Seite (Zuschauer) |
| **aga-erste.de/kicken** | `/probetraining?utm_source=instagram&utm_medium=bio` | **Bio** → Probetraining-Assistent (Spieler) |
| **aga-erste.de/bande** | `/partner?utm_source=instagram&utm_medium=bio` | **Bio** → Partner/Bande (Sponsoren) |
| **aga-erste.de/tipp** | `/tippen?utm_source=instagram&utm_medium=story` | Fr/Sa-**Story** „Jetzt tippen“ → Tipp-Liga (v20-T) |

Die drei Ziel-Kurz-Links (v19-K) trennen die drei Vereinsziele sauber in der
Statistik: `/sonntag` = Zuschauer am Spieltag, `/kicken` = Spieler-Gewinnung,
`/bande` = Sponsoren. `/kicken` öffnet auf der Karte den Probetraining-Assistenten
direkt (Alias `/probetraining`).

Eigene Links gehen auch: `…/live?utm_source=instagram&utm_medium=post` (Medium aus der Liste oben).
Bis die Domain umgezogen ist, gelten dieselben Pfade auf der Netlify-Adresse.

## 3. Kalender

Gemeinsame Komponente `src/alltag/Kalender.tsx` (`KalenderKnopf`), überall gleich:
Spiel-Kärtchen (Cockpit), Karte → Spieltag & Live, Rundgang → Tabelle, `/live` (Kopf + unten),
Fußzeilen (Karte → Anfahrt, Rundgang-Ende).

- **Einzelnes Spiel** („In den Kalender“): Auswahl Google · Apple · Outlook, passende Option fürs
  Gerät zuerst (iPhone/Mac → Apple, Android → Google, Windows → Outlook).
  Google/Outlook sind Web-Links (funktionieren **ohne** Edge Function), Apple öffnet
  `/kalender.ics?anstoss=…` bzw. `?spiel=<id>` (Edge Function).
- **Abo aller Heimspiele**: Apple = `webcal://…/kalender.ics`, Google = `calendar.google.com/calendar/r?cid=webcal://…`,
  Outlook = `outlook.live.com/calendar/0/addfromweb?url=…`, dazu Adresse zum Kopieren.
  Schalter „Auch Auswärtsspiele“ → `/kalender-alle.ics`.
- Ist die Edge Function noch nicht deployt (HEAD `/kalender.ics` liefert kein `text/calendar`),
  zeigt das Sheet Apple/Abo als „kommt in Kürze“ – Google/Outlook für Einzelspiele gehen trotzdem.
- Edge Function, Deploy und Tests: `supabase/functions/kalender/README.md`.

### So prüfst du es (nach Deploy der Function)
- **iPhone (Safari):** Startseite → Karte → „Spieltag & Live“ → „Heimspiele abonnieren“ → Apple Kalender →
  „Abonnieren“ → in der Kalender-App erscheint „SV Agathenburg-Dollern – Heimspiele“. Einzelspiel:
  im Cockpit „In den Kalender“ → Apple → Termin-Vorschau → „Hinzufügen“; Uhrzeit = Anstoß.
- **Android (Chrome):** gleicher Weg → Google Kalender → „Hinzufügen“; danach in der Google-Kalender-App
  Einstellungen → neuer Kalender → „Synchronisieren“ an. Einzelspiel → Google → „Speichern“.
- **PC:** Google oder Outlook wählen → Termin/Abo im Browser speichern; Uhrzeit prüfen (15:00 Anstoß
  = 15:00 im Kalender, Sommer wie Winter).
- Tests: `node src/alltag/kalenderLinks.test.mjs` (URL-Format, Zeitzone) und
  `node supabase/functions/kalender/ics.test.mjs` (ICS).

## 4. Probetraining per WhatsApp

`src/alltag/Probetraining.tsx`: 2–3 Tipps (Mannschaft → Position → Vorname/Jahrgang, alles
optional außer der Mannschaft) → WhatsApp öffnet sich mit fertiger Nachricht. Nichts wird
gespeichert. Nummer: Mannschafts-WhatsApp → Haupt-WhatsApp (Verein & Links) → sonst E-Mail.
Orte: Karte → Mitspielen (inkl. „Jugend kontaktieren“ mit Vorauswahl), Rundgang → Mitmachen,
„Alle Spieler“ → Ende („Du willst mitspielen?“), Fußzeilen, `/live` → „Mitspielen“ (→ `/probetraining`).

Mannschaften pflegt der Admin unter **Verein & Links → Mannschaften (Probetraining)**
(`sva_mannschaften`, ausgeliefert über `web_mitspielen()` beim Veröffentlichen). Startwerte:
1. Herren, Jugend (unter 18). Weitere (z. B. 2. Herren, Alte Herren) mit eigener Nummer und
Ansprechpartner anlegen, dann „Website veröffentlichen“.

## 5. Scharf schalten (Marvin)

1. Migrationen anwenden (Reihenfolge):
   `20261009090000_sva_alltag.sql` (Kalender-RPC, Mannschaften),
   `20261009100000_sva_statistik.sql` (Zählung, Auswertung).
2. Edge Function: `npx supabase functions deploy kalender --project-ref fwiivwmoyagcdrjvhaou --use-api --no-verify-jwt`
3. Netlify deployen (Redirects `/kalender.ics`, `/kalender-alle.ics`, `/ig`, `/story`, `/qr`, `/wa`, `/sonntag`, `/kicken`, `/bande`).
4. Prüfen:
   ```sql
   select public.web_zaehlen('/', 'direkt', 'desktop');            -- true
   select * from public.sva_statistik_tage order by tag desc limit 5;
   select jsonb_pretty(public.web_kalender(false));
   select jsonb_pretty(public.web_mitspielen());
   ```
5. Tests lokal (PGlite): `supabase/tests/statistik.test.mjs`, `supabase/tests/alltag.test.mjs`.
