# Partner-Bereich: Sponsoren gewinnen

Stand: 05.10.2026 (v16-S).

Die Seite **`/partner`** ist die Verkaufsseite für Sponsoren. Sie ist schlank und schnell wie `/live` und eignet sich als Link in der Instagram-Bio („Partner werden“). Aufbau:

1. Hero
2. Zahlen (Mediadaten)
3. Partner-Wand
4. Pakete
5. „So einfach geht’s“
6. Anfrage-Formular

Im Onepager zeigt die Sponsoren-Station eine Leiste mit den Partner-Logos und den Knopf „Alle Pakete & Zahlen →“.

Teil A ist für Marvin (einmalig scharf schalten). Teil B erklärt die Pflege. Teil C ist der Verkaufsleitfaden.

---

## Teil A: Scharf schalten (Marvin)

> Gegen die echte Datenbank wurde nichts ausgeführt. Die Migration ist lokal mit PGlite und Supabase-Stubs getestet: alle Migrationen der Reihe nach, die neue dreimal. Der Test liegt in `supabase/tests/partner.test.mjs`.

1. **Migration** `supabase/migrations/20261006100000_sva_partner.sql` einspielen (SQL-Editor oder MCP `apply_migration`). Vorher muss `20261005100000_sva_spieltag_live.sql` angewandt sein. Die Migration legt an:
   - `sva_partner_pakete` mit 6 Vorschlags-Paketen (nur in eine leere Tabelle)
   - `sva_partner_info` (Mediadaten und „Live-Ticker präsentiert von“)
   - `sva_partner_anfragen`
   - `sm_sponsoren.stufe` und `partner_paket_id`
   - die öffentliche RPC `partner_anfrage()`

   Außerdem ersetzt sie `web_snapshot()` und `web_live()`, die danach zusätzlich ein Feld `partner` liefern.

   > **Achtung beim Mergen:** Ändert ein paralleler Strang `web_snapshot()` oder `web_live()`, müssen die mit `v16-S` markierten Blöcke übernommen werden. Sonst fehlt `partner`, und `/partner` fällt auf die Seeds zurück. Die Spieltag-Migration darf **nach** dieser nicht erneut laufen, denn sie überschreibt die beiden Funktionen.

2. **Prüfen:**
   ```sql
   select jsonb_pretty(public.web_snapshot() -> 'partner');
   select jsonb_pretty(public.web_live() -> 'partner');
   select has_function_privilege('anon','public.partner_anfrage(text,text,text,text,uuid,text,boolean,text,integer,text)','execute'); -- true
   ```

3. **Netlify:** Es braucht kein neues Env. `netlify.toml` leitet `/partner` auf `partner.html` um. Nach dem Domain-Umzug in `partner.html` die Werte für canonical, og:url und og:image anpassen, wie in `live.html`.

4. **Benachrichtigung (optional):**
   1. In Supabase unter Database → Extensions **pg_net** aktivieren.
   2. Im Admin unter Archiv → Automationen beim Event **`partner.anfrage`** die n8n-Webhook-URL eintragen (https).

   Danach meldet die Datenbank jede neue Anfrage selbst, mit Firma, Ansprechpartner, Paket und Quelle, ohne Kontaktdaten. Ohne pg_net passiert nichts, und die Anfrage wird trotzdem gespeichert.

5. **Datenschutz:** `public/datenschutz.html` hat den neuen Abschnitt **7a**. Offen sind darin noch `TODO-MARVIN` (Benachrichtigungs-Anbieter) und `TODO-JURIST`.

6. **Instagram:** In die Bio-Links „Partner werden → …/partner?utm_source=instagram“ eintragen. Dann zeigt der Eingang „über instagram“.

**Tests:**
- `node scripts/partner-audit.mjs` klickt den Admin durch (mit Mocks) und zeichnet die Story-Grafik.
- `supabase/tests/partner.test.mjs` prüft die Migration.

Für die Audit-Skripte läuft vorher der Dev-Server mit `npx vite --port 5189`.

---

## Teil B: Pflege (Admin → Partner)

Alles, was auf `/partner` und im Onepager steht, erscheint erst nach **„Website veröffentlichen“**. Ausnahmen sind der Live-Ticker-Partner auf `/live` und neue Anfragen, beide wirken sofort.

| Tab | Was du tust |
|---|---|
| **Sponsoren** | Name, Logo, Link. Dazu die **Stufe** (Hauptpartner = groß oben, Partner, Unterstützer = klein) und das **gebuchte Paket**. Mit dem Paket rechnet sich „noch x frei“ von selbst. „Auf der Bande“ steuert die 3D-Bande. Oben wählst du, wer den **Live-Ticker präsentiert**. |
| **Pakete** | Name, ein Satz Beschreibung, Leistungen (eine pro Zeile), Preis „ab … €“ pro Saison, Spieltag, Monat oder einmalig. Ein leerer Preis heißt „Preis auf Anfrage“. Dazu die **Plätze**: leer heißt unbegrenzt. Mit dem Auge blendest du ein Paket aus, mit ▲▼ änderst du die Reihenfolge, der Stern markiert ein Paket als „Beliebt“. |
| **Zahlen** | Instagram-Follower, Ø Reichweite pro Monat, Ø Zuschauer, Website-Besuche, Heimspiele und der **Stand**. Nur gefüllte Felder erscheinen. Etwa einmal im Monat aktualisieren. |
| **Anfragen** | Hier landet der Eingang vom Formular. Der Status läuft **Neu → In Kontakt → Gewonnen** bzw. **Abgelehnt**, dazu kommt eine Notiz. Bei „Gewonnen“ legt **„Als Sponsor anlegen“** den Partner mit Namen und Paket an. Neue Anfragen zeigt die Übersicht als gelbes Badge. |

Die Vorschlagspreise aus dem Seed sind Startwerte für die Kreisliga: Bande ab 250 €, Social Media ab 150 €, „Spieltag präsentiert von“ ab 75 € pro Spieltag, Live-Ticker ab 300 €, Unterstützer ab 50 €, Trikot auf Anfrage. **Bitte vor dem ersten Veröffentlichen prüfen.**

Aufräumen passiert automatisch:
- Abgelehnte Anfragen werden 6 Monate nach der letzten Bearbeitung gelöscht.
- Offene Anfragen werden nach 12 Monaten gelöscht.
- Der IP-Hash wird nach 7 Tagen geleert.
- Gewonnene Anfragen bleiben.

### Vorschlag: Nele als Medienpartnerin eintragen (v17-D)

Nele (**picture by Nele**) ist offizielle Vereinsfotografin. Bis sie im Admin
steht, zeigt `/partner` sie fest als eigenen Block „Offizielle Vereinsfotografin“
oben auf der Partner-Wand (Logo, Instagram-Link). Sobald ein Sponsor mit „Nele“
im Namen existiert, verschwindet der feste Block automatisch (keine Doppelung).

Eintrag unter **Admin → Partner → Sponsoren**:

| Feld | Wert |
|---|---|
| Name | picture by Nele |
| Logo | `public/brand/picture-by-nele.webp` (aus „Nele Logo Transparent.png“, 480 px) |
| Link | https://instagram.com/pictureby.nele — **Handle bitte bestätigen** (Konstante `NELE_INSTAGRAM` in `src/data/club.ts`) |
| Stufe | Partner |
| Paket | keins (Gegenleistung: Fotos gegen Nennung) |
| Auf der Bande | nein |

Credit überall: „Fotos: picture by Nele“ mit Link — Galerien (Karte → Fans,
`/galerie`), Partner-Seite (Hero-Foto). Galerien pflegt der Admin unter **Galerien**.

---

## Logos auf der Bande (v18-P)

Jedes Partnerlogo wird **einmal** im Browser aufbereitet (`src/partner/bande/logo.ts`,
Cache pro URL) und danach überall gleich gezeichnet (`tafel.ts`): 3D-Bande,
„Schon dabei" im Partner-Panel/Rundgang, Partner-Wand auf `/partner`.

| Schritt | Was passiert |
|---|---|
| Trimmen | transparente Ränder weg; **einfarbige** Ränder (weißes JPG) werden vom Rand her freigestellt — Weiß *im* Logo bleibt |
| Größe | nach **Fläche** normiert (Höhe ∝ Seitenverhältnis^-0,4): ein quadratisches Bildzeichen wirkt so groß wie eine lange Wortmarke |
| Abstand | 9 % (3D-Bande) bzw. 13 % Rand oben/unten, mind. 4 % seitlich; auf der langen 3D-Tafel bleibt der Inhalt in den mittleren 62 % (die Kamera fährt nah heran) |
| Untergrund | warmes Weiß, außer das Logo wäre darauf schlecht lesbar (z. B. weißes Logo) → Schwarz |
| Name | reines **Bildzeichen ohne Schrift** (wenige Formteile) → Firmenname daneben, in der Logofarbe. Logos mit Schrift bekommen keinen Namen dazu |
| Schärfe | jede 3D-Tafel hat eine eigene Textur (256 px hoch, exaktes Seitenverhältnis, Mipmaps, Anisotropie) |

**Logo anfordern:** am besten PNG mit transparentem Hintergrund oder SVG→PNG, mind.
800 px breit. JPG mit weißem Rand geht auch (wird freigestellt). Ins Admin
(Partner → Sponsoren) hochladen und veröffentlichen.

Geprüft (v18-P) mit dem echten Logo (Marvin Allers Finance) und drei synthetischen
Problemfällen: weiße Wortmarke auf weißem JPG, weißes Logo auf transparent, Hochformat
mit viel Rand — Screens lokal unter `shots-partner/` (nicht im Repo).

## Konfigurator „Diese Bande sucht dich" (v18-P)

* **Partner-Panel der Karte + Rundgang-Station:** Firmenname tippen, optional Logo
  wählen → erscheint sofort auf der **ersten freien 3D-Tafel**, die Kamera fährt hin.
  Pfeile fahren von Tafel zu Tafel („Tafel 2 von 5 · noch frei").
* **`/partner#deine-bande`:** dieselben Felder (+ zweite Zeile, Untergrund
  Auto/Hell/Dunkel/Rot), flache Tafel und **„So sieht's am Spieltag aus"**: das
  Spieltagsfoto (picture by Nele, Meisterspieltag 2026) hat zwischen zwei Banden eine
  echte Lücke — dort wird der Entwurf perspektivisch eingesetzt (Unschärfe/Licht des
  Fotos, Gras davor). Daneben Banden-Paket mit Preis/Plätzen und Reichweite (nur
  gepflegte Mediadaten; ohne Admin-Wert „630+ Follower" laut Verein, Okt. 2026).
* **„Mit diesem Entwurf anfragen"** → Anfrage-Formular mit Firmenname, Paket „Bande"
  und dem Entwurf als Text (Name, zweite Zeile, Untergrund, „eigenes Logo im
  Entwurf"). Die RPC `partner_anfrage()` nimmt keine Bilder — **keine Migration nötig**;
  Quelle = `bande-konfigurator` (wenn kein `utm_source`). Das Logo schickt der
  Interessent danach per E-Mail (steht im Danke-Text).
* **„Vorschau als Bild speichern"**: PNG (Foto + Tafel + Firmenname) zum
  Weiterschicken an Chef/Team.
* **Datenschutz:** Das Logo wird nur im Browser gelesen (Canvas), nichts wird
  hochgeladen. Der Entwurf liegt im `sessionStorage` (Tab-Sitzung), damit er von der
  Karte nach `/partner` mitkommt.

Foto neu wählen: `FOTO.ecken` in `src/partner/bande/foto.ts` (4 Ecken der freien
Fläche im 2000-px-Foto) und `public/partner/spieltag-bande*.webp` ersetzen.

---

## Teil C: Verkaufsleitfaden (1 Seite)

**Grundsatz:** Sponsoren kaufen keine Holzbande, sie kaufen **Sichtbarkeit bei Menschen aus der Region**. Deshalb gehören die Zahlen an den Anfang, und die Bande kommt erst danach.

**Vor dem Gespräch (5 Minuten)**
- Die Zahlen im Admin aktualisieren und `/partner` am Handy öffnen. Das ist dein Prospekt.
- Im Gespräch: `/partner#deine-bande` öffnen, **ihren** Firmennamen eintippen (Logo von
  ihrer Website speichern und wählen) — „So sieht's am Spieltag aus" zeigen und das Bild
  per „Vorschau als Bild speichern" direkt rüberschicken. Das verkauft mehr als jede Liste.
- Über das Unternehmen klären: Wer sind ihre Kunden? Liegt die Firma in Agathenburg, Dollern oder Stade? Sucht sie Mitarbeiter? Azubi-Suche ist oft das stärkste Argument.

**Gesprächsablauf**
1. **Zuhören statt Preisliste:** „Was wollt ihr erreichen: mehr Kunden aus dem Ort, Mitarbeiter oder einfach Präsenz zeigen?“
2. **Zahlen zeigen, nicht vorlesen:** „Wir erreichen auf Instagram rund **[Ø Reichweite]** Konten im Monat. Bei jedem Heimspiel stehen etwa **[Zuschauer]** Leute am Platz. Bei **[Heimspiele]** Heimspielen sind das gut **[Zuschauer × Heimspiele]** Kontakte direkt an der Bande.“ Die Seite rechnet diese Summe selbst aus.
3. **Ein Paket vorschlagen, nicht sechs:**
   - Neue Kunden aus dem Ort → **Bande**
   - Mitarbeiter oder Azubis → **Social-Media-Paket** (Reel „Arbeiten bei …“)
   - Image oder großer Auftritt → **Trikot** oder **Live-Ticker**
   - Kleines Budget → **Unterstützer** oder **„Spieltag präsentiert von“** zum Testen
4. **Knappheit ehrlich nennen:** „Von 8 Banden sind noch 2 frei.“ Die Seite zeigt das, sobald gebuchte Sponsoren ein Paket zugeordnet haben. Nie erfinden.
5. **Kombinieren statt rabattieren:** Lieber eine Story oder einen Spieltag dazugeben als den Preis senken.
6. **Nächster Schritt mit Datum:** „Ich schick dir heute das Angebot, und am Samstag beim Heimspiel zeige ich dir den Platz.“ Danach die Anfrage im Admin auf **In Kontakt** setzen und die Notiz eintragen.

**Nach dem Abschluss**
- Im Admin unter **Gewonnen** auf „Als Sponsor anlegen“ tippen, Logo hochladen, Stufe und Paket setzen und **veröffentlichen**.
- Zeitnah einen **Dankes-Post** mit Markierung machen. Neue Partner sehen so, dass der Verein liefert, und andere Firmen sehen, wer schon dabei ist.
- Einmal pro Saison die Zahlen und ein Foto der Bande an den Partner schicken. Das sichert die Verlängerung.

**Einwände**
- *„Zu teuer“* → „Dann starten wir mit einem Spieltag für [Preis] und schauen, was zurückkommt.“
- *„Bringt das was?“* → Die Zahlen zeigen. Bei der Social-Media-Leistung Reichweite und Klicks nachreichen.
- *„Wir sponsern schon woanders“* → „Bei uns bist du nicht einer von 40. Die Wand ist überschaubar, du fällst auf.“
