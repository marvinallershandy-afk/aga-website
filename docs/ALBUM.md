# SVA-Stickerheft („Sammelalbum“) mit QR-Check-in

Stand v17-A. Fans scannen bei jedem Heimspiel am Eingang einen QR-Code, reißen ein
Sticker-Tütchen auf und kleben die Sticker in ihr digitales Heft auf **`/album`**.
Ab dem 5. und 10. Check-in gibt es Gutscheine (eingelöst am Stand per PIN), wer die
ganze Mannschaft im Heft hat, nimmt an der Saison-Verlosung teil.
Gleichzeitig zählt der Verein damit **echte Zuschauer** — die Zahl steht automatisch
in den Mediadaten auf `/partner`.

Design: Marvins Higgsfield-Entwurf „Das offizielle Stickerheft“ (Cover auf dem
Kneipentisch, Retro-Papier-Seiten). Assets in `public/album/` (ohne Bier/Aschenbecher).

---

## 1. Einmal einrichten (Marvin)

1. **Migration** `supabase/migrations/20261007100000_sva_album.sql` anwenden (nach
   `20261006100000_sva_partner.sql`). Legt nur `sva_album_*`-Objekte an und erneuert
   `web_snapshot()` (Mediadaten + Check-in-Zahl). Idempotent.
   Test vorher lokal: `supabase/tests/album.test.mjs` (PGlite, 139 Prüfungen).
2. **Supabase → Authentication → Settings**
   - **„Confirm email“ muss AN sein.** Wichtig: Das Projekt hat Signups an. Ohne
     E-Mail-Bestätigung könnte sich jemand per Passwort-Signup mit der Adresse eines
     Admins registrieren und bekäme über `is_sm_admin()` (Allowlist per E-Mail)
     Admin-Rechte. Mit Bestätigung ist das ausgeschlossen.
   - **Redirect URLs**: `https://aga-erste.de/album*` (bzw. die Netlify-Domain) eintragen,
     sonst landet der Login-Link auf der Site-URL.
   - **E-Mail-Vorlage „Magic Link“**: zusätzlich den Code ausgeben, z. B.
     `Dein Code: {{ .Token }}`. Hintergrund: Öffnet der Fan den Link in einem anderen
     Browser als dem, in dem er gescannt hat (Mail-App → Safari), tippt er einfach den
     6-stelligen Code auf `/album` ein.
   - Für mehr als ein paar Login-Mails pro Stunde einen **eigenen SMTP-Versand**
     einrichten (Supabase-Standardversand ist stark limitiert). Anbieter dann in
     `public/datenschutz.html` Abschnitt 7b nachtragen.
3. Admin → **Album → Sticker** → „Sticker aus Kader erzeugen“ (Spieler als Kader-Sticker,
   Kapitän zusätzlich als Gold-Sticker, Trainerstab für die Trainerstab-Seite).
   Dann Momente („Foto des Jahres“), Partner- und Fan-Sticker mit Foto anlegen.
4. Admin → **Album → Regeln & PIN** → **Stand-PIN** setzen (4 Ziffern) und Belohnungen
   mit „präsentiert von“-Partnern prüfen.
5. „Website veröffentlichen“ — erst dann erscheint die Check-in-Zahl auf `/partner`.

Der Startseite liegt nur ein Link-Eintrag bei (`ALBUM_LINK` in `src/data/club.ts`);
eingebunden wird er beim Umbau der Startseite.

## 2. Ablauf am Spieltag

**Vorher (bis Freitag):**
1. Admin → Album → **Spieltage** → beim Heimspiel „QR-Code erzeugen“.
2. „Check-in präsentiert von“ wählen (Partner-Logo kommt aufs Plakat und aufs Tütchen).
3. **PDF (A4)** herunterladen, in tatsächlicher Größe drucken, laminieren.

**Am Platz:**
- Plakat gut sichtbar an den Eingang (Kasse/Tor) hängen, zweites am Stand.
- Der Code gilt **1 Std. vor Anstoß bis ca. 30 min nach Abpfiff** (Standard: bis 135 min
  nach Anstoß; läuft der Live-Ticker länger, bis 30 min nach dem Abpfiff-Ereignis).
- Jeder Fan kann **einmal pro Spiel** einchecken. Bei einem **Heimsieg** bekommt jeder
  Eingecheckte automatisch ein Bonus-Tütchen, sobald das Ergebnis feststeht
  (Abpfiff im Ticker oder Ergebnis unter „Spiele“).
- Live-Zähler: Admin → Album → Spieltage (aktualisiert alle 15 s).

**Gutschein einlösen (Stand-Team):**
1. Fan öffnet `/album` → Inhalt → Gutschein → „Am Stand zeigen“.
   Die laufende Uhr und die bewegten Streifen zeigen: kein Screenshot.
2. Helfer tippt „Helfer: jetzt einlösen“ und gibt die **Stand-PIN** auf dem Handy des
   Fans ein → grüner Stempel „Eingelöst“.
3. Nach 5 falschen PINs ist der Gutschein 15 min gesperrt.
4. Notfall (Akku leer): Admin → Album → Gutscheine → Code suchen → „Einlösen“.

**Wenn der QR-Code geteilt wird** (Foto in der WhatsApp-Gruppe): Admin → Spieltage →
„Neu erzeugen“ → neues Plakat drucken. Der alte Code ist sofort ungültig.

## 3. Regeln (Admin → Album → Regeln & PIN)

| Einstellung | Standard | Wirkung |
|---|---|---|
| Chancen Kader / Silber / Gold / Glitzer | 70 / 22 / 7 / 1 | je Sticker; Stufen ohne aktiven Sticker fallen raus |
| Sticker pro Tütchen | 3 | 1–5 |
| Doppelten-Bremse | 50 % | so oft wird innerhalb der Stufe ein noch fehlender Sticker bevorzugt |
| Fenster vor / nach Anstoß | 60 / 135 min | Gültigkeit des QR-Codes |
| Belohnungen | 5. Heimspiel: Freibier oder Bratwurst · 10.: Fanartikel · Mannschaft komplett: Verlosungs-Los | je mit optionalem Partner |
| Album aktiv | an | aus = Check-ins freundlich abgelehnt (Sommerpause) |

**Rechenbeispiel:** 24 Spieler, 3 Sticker pro Tütchen, ~13 Heimspiele + Heimsieg-Boni
≈ 20 Tütchen = 60 Sticker → mit der Doppelten-Bremse ist die Mannschaft für echte
Stammzuschauer bis Saisonende schaffbar, aber nicht nach drei Spielen.

Die Ziehung passiert **ausschließlich in der Datenbank** (`sva_album_pack_ziehen`),
nie im Browser. Sticker werden beim Öffnen des Tütchens gutgeschrieben.

## 4. Pflege

- **Neuer Spieler im Kader** → Album → Sticker → „Sticker aus Kader erzeugen“ (legt nur
  Fehlende an).
- **Sonderversionen** (Gold „Torjäger“, Glitzer „Spieler des Spiels“): „Neuer Sticker“ →
  Art Spieler → Spieler wählen → Seltenheit + Untertitel. Zählt für denselben Platz.
- **Moment-Sticker**: Art Moment, Titel = Bildunterschrift (z. B. „Das Tor zur
  Meisterschaft“), Untertitel = Kontext („90+7. Minute · Meister 2026“). Meist Gold/Glitzer.
  Keine Kinder ohne Einwilligung der Eltern, keine Alkohol-Motive im Vordergrund.
- **Partner-Sticker** (verkaufbar: „Deine Firma als Sticker im SVA-Heft“): Art Partner →
  Partner wählen; ohne Foto wird das Logo gezeigt.
- **Walkout-Videos**: liegen sie unter `public/players/walkout/<datei>.webm|mp4|mov`
  (Dateiname wie das Spielerfoto, z. B. `malte-pils.webm`, oder Kader-Slug),
  verknüpft „Walkouts suchen“ sie. Die Detailansicht spielt sie ab und fällt bei einem
  Ladefehler auf das Foto zurück.
- **Löschen vs. Deaktivieren**: Löschen entfernt den Sticker aus allen Heften —
  besser deaktivieren.
- **Saisonwechsel**: Saison unter „Verein & Links“ umstellen → neue Sticker erzeugen.
  Sticker mit Saison = alte Saison verschwinden, Sticker ohne Saison bleiben.

## 5. Kennzahlen

- **Ø gezählte Zuschauer pro Heimspiel** (Album → Spieltage, `/partner` Mediadaten,
  öffentlich als Summe über `album_checkins_pro_spiel()` — später auch für die
  Tipp-Bonusfrage „Zuschauerzahl“).
- Fans mit Heft, Check-ins der Saison, offene/eingelöste Gutscheine, volle Hefte.
- **E-Mails mit Einwilligung** (CSV) — nur Fans mit „Erinnerung vor Heimspielen“.
  Nur dafür nutzen, nicht weitergeben.

## 6. Sicherheit & Datenschutz (Kurzfassung)

- Fans sind normale Logins **ohne** Eintrag in `sm_admins` → `is_sm_admin()` = false.
  Fans haben auf keine Tabelle direkten Zugriff, nur auf die `album_*`-RPCs
  (alle `SECURITY DEFINER`, prüfen `auth.uid()`). Getestet in `album.test.mjs`.
- Der Album-Login nutzt einen eigenen Speicherschlüssel (`sva-album-auth`), er landet
  also nie in einer Admin-Sitzung.
- Stand-PIN nur als gesalzener SHA-256; falsche PINs werden protokolliert (1 Tag).
- „Konto löschen“ (auf `/album`): Profil, Sticker, Gutscheine weg, Check-ins nur noch
  anonym. Das Login wird mitgelöscht, wenn es über das Album angelegt wurde
  (`user_metadata.app = 'sva-album'`) und kein Admin-Zugang ist. Das Auth-Schema teilt
  sich das Projekt mit einer fremden App — deren Konten fasst das Album nie an.
- Datenschutzerklärung: Abschnitt **7b** (`/datenschutz#album`).

## 7. Tests & Prüfskripte

- `supabase/tests/album.test.mjs` — PGlite (Migration, Ziehung 70/22/7/1 über 4000
  Sticker, Fenster, Doppel-Check-in, PIN-Sperre, Heimsieg-Bonus, Missbrauch durch Fans).
- `scripts/album-audit.mjs` — `/album` mit Mocks (Login, Profil, Check-in, Tütchen je
  Seltenheit, Einkleben, Fehlerzustände, Gutschein + PIN, Konto löschen).
- `scripts/album-admin-audit.mjs` — Admin „Album“ inkl. QR-Lesbarkeit des Plakats
  (BarcodeDetector) und PDF-Export.

## 8. Offen / Ideen

- Derby-Tag-Gold-Tütchen, „Freund mitbringen“-Extrasticker (Pack-Art `geschenk` ist
  vorbereitet).
- Optionale Standort-Prüfung (Waldsportplatz ± 300 m) — bewusst nicht gebaut.
- Sticker tauschen zwischen Fans.
- Spieltags-Erinnerung per E-Mail (Einwilligung wird schon gespeichert; Versand per n8n).
