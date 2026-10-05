# Spieltag-Modus: Live-Ticker

Stand: 05.10.2026 (v15-L, Vorführ-Spiel v18-T).

Der Spieltag hat eine eigene, schnelle Seite: **`/live`**. Dort sehen Fans:
- Spielstand und laufende Minute
- den Ticker
- die Aufstellung mit Wechseln und Karten
- vor dem Spiel einen Countdown und die Anfahrt

Der 3D-Onepager bleibt ruhig. Er zeigt nur eine dünne Leiste, und zwar nur von 48 h vor bis 3 h nach dem Anpfiff.

Teil A ist für die Ticker-Person (Trainer, Teammanager). Teil B ist für Marvin (einmalig).

---

## Teil A: Ticker am Spielfeldrand (1 Seite)

**Vorher:** Am Handy `…/admin` als Lesezeichen auf den Home-Bildschirm legen und einmal anmelden (E-Mail eingeben, Link aus der Mail antippen). Unten in der Leiste: **Übersicht · Live · Aufstellung · Spiele**.

**Vor dem Spiel (ca. 1 h vorher)**
1. Unter **Aufstellung** die Elf und die Bank setzen, bei „Für welches Spiel?“ das Spiel wählen und **speichern**. Auf `/live` ist die Aufstellung sofort sichtbar.
2. **Live** öffnen. Das heutige Spiel ist schon ausgewählt.

**Während des Spiels**
- **ANPFIFF** drücken. Ab dann läuft die Minute von selbst.
- Geht die Schiri-Uhr anders: **Uhr** antippen und die Minute einstellen.
- Für ein einzelnes Ereignis lässt sich die Minute mit **– / +** ändern. „zurück auf Auto“ stellt wieder um.
- **TOR SVA:** Torschütze antippen. Die Vorlage und ein Zusatz wie „Elfmeter“ oder „Kopfball“ sind freiwillig. Dann **Tor eintragen**.
- **GEGENTOR:** Ein kurzer Text ist freiwillig. Dann **Gegentor eintragen**.
- **GELB / ROT:** Spieler antippen, damit ist die Karte sofort eingetragen. Bekommt ein Spieler zum zweiten Mal Gelb, wird daraus automatisch Gelb-Rot. Für Karten gegen den Gegner gibt es den Knopf „Gegenspieler“.
- **WECHSEL:** Erst antippen, wer **raus** geht, dann wer **rein** kommt.
- **KOMMENTAR:** Freien Text schreiben oder einen Schnell-Knopf nutzen („Pfosten!“, „Elfmeter gehalten!“).
- **HALBZEIT**, dann **WIEDERANPFIFF**, am Ende **ABPFIFF** (mit Rückfrage). Damit ist das Ergebnis gespeichert.
- **Vertippt?** Mit **Rückgängig** wird das letzte Ereignis gelöscht. Der Spielstand rechnet sich dabei selbst neu.

**Schlechtes Netz?** Einfach weitermachen. Was noch nicht angekommen ist, zeigt eine Wolke und den gelben Hinweis „wartet“. Es wird automatisch nachgesendet, sobald wieder Netz da ist. Die Uhrzeit des Tippens bleibt dabei erhalten. Die Seite darf in der Zwischenzeit auch zugehen.

**Nach dem Abpfiff**
- Unter **Spieler des Spiels** einen Spieler antippen. Er erscheint auf `/live`.
- **Story-Grafik erstellen:** Das Bild (Endstand, Torschützen, Karte des Spielers des Spiels) geht direkt ins Teilen-Menü (Instagram-Story) oder wird heruntergeladen.
- Admins tippen danach **Website veröffentlichen**, damit Ergebnis und Form auch im Onepager stehen. Auf `/live` ist alles schon sofort sichtbar.

**Vorführ-Spiel zeigen** (nur Admin, z. B. für Sponsoren oder neue Ticker-Leute)
1. Im Admin auf **Übersicht** ganz nach unten zur Karte **Vorführ-Spiel**. Gegner lassen („FC Vorführung“) oder ändern, **Vorführ-Spiel starten** tippen. Mit „Mit Beispiel-Ereignissen“ stehen schon Anpfiff, Chance, Tor und Gelbe Karte mit echten Spielern im Ticker.
2. Das Gegenüber scannt den **QR-Code** (oder **Kopieren** und per WhatsApp schicken). Der Link ist `…/live?vorfuehrung=1`. Dort steht oben „Vorführung – kein echtes Spiel“. Wer selbst tickern will: **Ticker-Pult** tippen. Das Pult ist rot gestrichelt als **VORFÜHRUNG** markiert und funktioniert wie am Spieltag.
3. Danach **Beenden** (Abpfiff) oder **Löschen**. Mit **Neu starten** geht es wieder bei 0:0 los.

Ohne den Link sieht niemand etwas davon: nicht auf `/live`, nicht auf der Karte, nicht im Kalender-Abo, nicht in Ergebnis/Form, nicht im Album und nicht in der Statistik. Es gibt immer höchstens ein Vorführ-Spiel. Auf der Karte zeigt `/?vorfuehrung=1` die Spieltag-Leiste mit dem Vorführ-Spiel.

**Wer darf was?**
- **Team-Zugang:** Übersicht, Live, Aufstellung und bei Spielen nur das Ergebnis.
- **Admin:** alles, auch Kader, Sponsoren, Verein & Links, Team & Zugänge und Veröffentlichen.

---

## Teil B: Einmalig scharf schalten (Marvin)

> Gegen die echte Datenbank wurde nichts ausgeführt. Die Migration ist lokal getestet: PGlite mit Supabase-Stubs, alle Migrationen der Reihe nach, die neue mehrfach. Der Test liegt in `supabase/tests/spieltag_live.test.mjs`.

### 1. Migration anwenden
`supabase/migrations/20261005100000_sva_spieltag_live.sql` einspielen (SQL-Editor oder MCP `apply_migration`). Vorher müssen `20261004100000…102000` angewandt sein, das ist laut Live-Snapshot der Fall.

Die Migration macht Folgendes:
- **Rollen:** `sm_admins.rolle` (`admin`/`team`). Alle heutigen Einträge werden `admin`. `is_sm_admin()` gilt ab jetzt nur noch für `admin`. Neu sind `is_sva_team()` und `sva_meine_rolle()`.
- **Spiel und Ticker:** `sm_spiele` bekommt die Spalten `status`, `anpfiff_at`, `wiederanpfiff_at`, `live_tore_*` und `motm_roster_id`. Neu ist die Tabelle `sva_ticker`. Ein Trigger rechnet daraus Spielstand, Status und Endergebnis.
- **Team-Rechte:** Das Team darf Ticker und Aufstellung schreiben, an `sm_spiele` aber nur die Ergebnis- und Live-Felder. Ein Wächter-Trigger lässt keine Änderung an den Stammdaten durch.
- **Verein & Links:** Neue Felder `training_ort`, `fussball_de_widget_tabelle` und `fussball_de_widget_spielplan`. Steht in `adresse` heute die **B73/Paschberg-Adresse**, wandert sie einmalig nach `training_ort`. `adresse` wird dann der **Waldsportplatz**.
- **Lesefunktionen:** `web_snapshot()` liefert zusätzlich `trainingOrt` und die Widget-IDs. Neu ist die öffentliche RPC **`web_live()`** (anon).

Danach prüfen:
```sql
select jsonb_pretty(public.web_live());
select email, rolle from public.sm_admins;
select adresse, training_ort from public.sva_settings;
select has_function_privilege('anon','public.is_sva_team()','execute');  -- false
```

### 2. Edge Functions neu deployen
`publish-site` und `drive-bridge` prüfen jetzt die Rolle `admin`. Team-Zugänge dürfen nicht veröffentlichen.
```bash
supabase functions deploy publish-site
supabase functions deploy drive-bridge
```

### 3. Netlify
- **Build:** Kein neues Env nötig, `/live` nutzt `VITE_SUPABASE_URL` und `VITE_SUPABASE_ANON_KEY`.
- **Redirect:** `netlify.toml` leitet `/live` auf `live.html` um. Sie ist ein eigenes Bundle ohne three.js und hat eigene OG-Meta.
- **Domain:** Nach dem Domain-Umzug in `live.html` canonical, og:url und og:image anpassen. Das sind dieselben Stellen wie in `index.html`.

### 4. fussball.de-Widgets erzeugen
1. Auf [fussball.de/widgets](https://www.fussball.de/widgets) mit einem fussball.de-Konto anmelden.
2. „Widget erstellen“ wählen, dann Typ **Mannschaft** und unsere 1. Herren. Als Inhalt **Tabelle** einstellen.
3. Als Website-Domain **jede Domain eintragen, auf der `/live` läuft**: die Netlify-Domain und später `aga-erste.de`. Das Widget prüft den Aufrufer.
4. Den Einbettungs-Code unter **Verein & Links → Widget-ID Tabelle** einfügen. Die 32-stellige ID wird automatisch erkannt.
5. Dasselbe noch einmal mit dem Inhalt **Spielplan**.

Auf `/live` lädt das Widget erst nach Klick. Es kommt als direktes iFrame ohne fremdes Skript, und `datenschutz.html` beschreibt das in Abschnitt 6b.

### 5. Team-Zugänge anlegen
1. Als Admin unter **Team & Zugänge** die E-Mail eintragen, Rolle **Team**.
2. Weil Signups aus sind: in Supabase unter **Authentication → Users → Invite user** dieselbe E-Mail einladen.
3. Danach meldet sich die Person unter `/admin` per Magic Link an.

### 6. Datenschutz
In `public/datenschutz.html` stehen neu die Abschnitte 6a (Supabase-Abruf auf `/live` und im Spieltagsfenster, ohne Cookies) und 6b (fussball.de nach Klick). Offen sind darin nur:
- die Anbieter-Anschriften (TODO-MARVIN)
- der AV-Vertrag mit Supabase
- die juristische Prüfung (TODO-JURIST)

### Gut zu wissen
- **Spieltag-Leiste im Onepager:** Sie nutzt den Anstoß aus dem letzten **Veröffentlichen**. Wird ein Spiel verlegt, also erst neu veröffentlichen. Außerhalb von 48 h vor bis 3 h nach dem Anpfiff gibt es keine Leiste und keinen Request. Live-Daten holt sie erst ab 15 min vor dem Anpfiff.
- **Ergebnis von Hand:** Wurde ein Spiel ohne Ticker gespielt, trägt man das Ergebnis wie bisher unter **Spiele** ein.
- **Tests:**
  - `node scripts/live-audit.mjs` für `/live` in allen Zuständen
  - `ONLY=live OUT=./shots-live/admin node scripts/admin-audit.mjs` für das Ticker-Pult mit Funkloch, die Rollen und die Zugänge
  - `node scripts/matchday-bar-audit.mjs` für die Leiste und die Request-Zählung
  - Für alle drei läuft vorher der Dev-Server mit `npx vite --port 5186`. Die Datenbank ist dabei gemockt.
