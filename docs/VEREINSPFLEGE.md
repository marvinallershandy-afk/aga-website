# Vereins-Pflege: Admin → Website

Stand: 04.10.2026 (v14-C). Der Admin unter `/admin` pflegt jetzt die **Website**. Social Media ist ins „Archiv“ gewandert.

Teil A ist für Marvin (einmalig scharf schalten). Teil B ist die Bedienanleitung für den Trainer.

---

## So fließen die Daten

```
Trainer im Admin ──speichert──▶ Supabase (sm_roster, sm_spiele, sm_tabelle,
                                 sm_sponsoren, sva_lineup, sva_settings)
                                 RLS: nur is_sm_admin()
        │
        └─ „Website veröffentlichen“ ─▶ Edge Function publish-site
                                         (Login + sm_admins geprüft,
                                          Build-Hook nur als Secret)
                                              │
                                              ▼
                                  Netlify-Build: scripts/fetch-content.mjs
                                  ─ RPC web_snapshot() mit anon-Key
                                  ─ lädt Fotos/Logos nach public/generated/
                                  ─ schreibt src/data/generated/website-content.generated.ts
                                              │
                                              ▼
                                  Website (statisch, 0 externe Requests)
```

- Die Website liest **nie** direkt aus der Datenbank. Sie bekommt nur, was `web_snapshot()` herausgibt: aktive Spieler und Trainerstab, Aufstellung, nächstes und letztes Spiel, Form, Tabelle, aktive Sponsoren (ohne Kontakte und Pakete), Links und Kontakt.
- Gibt es ein Problem (Projekt pausiert, Migration fehlt, Timeout nach 10 s, leerer Snapshot), baut Netlify trotzdem. Die Website zeigt dann die bisherigen Seeds aus `src/data/*.ts`, und im Build-Log steht eine laute `!!`-Warnung.
- **Datenmodell-Entscheidung:** Kader, Spiele, Sponsoren und Tabelle bleiben in den bestehenden `sm_*`-Tabellen und wurden nur **erweitert**, es gibt keine Parallel-Tabellen. Der Matchday-Generator im Archiv liest damit dieselben Spieler, und `sm_content.spiel_id` bleibt gültig. Neu sind nur `sva_lineup` (Aufstellung als Verlauf), `sva_settings` (genau eine Zeile), `sva_publish_log` und der Bucket `sva_public`. Die Begründung steht im Kopf der Migration `20261004100000`.

---

## Teil A: Scharf schalten (Marvin)

> Bis hier wurde **nichts** gegen die echte Datenbank ausgeführt. Die Migrationen sind lokal gegen eine In-Memory-Postgres (PGlite) mit Supabase-Stubs getestet: alle Dateien, zweimal hintereinander angewandt, dazu Constraint-Fälle und Rechte.

### 1. Supabase-Projekt entpausen (dringend)
Dashboard → Projekt `fwiivwmoyagcdrjvhaou` → **Restore**. Pausierte Free-Projekte lassen sich nach einer Frist nicht mehr per Klick wiederherstellen. Gegen erneutes Pausieren hilft ein täglicher Zugriff, zum Beispiel ein n8n-Cron, der `web_snapshot()` aufruft. Alternativ Pro buchen.

### 2. Auth absichern
- Authentication → Providers → Email: **„Allow new users to sign up“ AUS**, „Confirm email“ AN.
- Der Magic-Link legt keine Konten mehr an (`shouldCreateUser: false`). Ein neuer Admin braucht deshalb zweierlei: ein Konto unter Authentication → Users → „Invite user“ **und** seine E-Mail in `sm_admins`:
  ```sql
  insert into public.sm_admins (email) values ('trainer@beispiel.de');
  ```

### 3. Migrationen anwenden (in dieser Reihenfolge)
Zuerst prüfen, was schon angewandt ist: Dashboard → Database → Migrations, oder per MCP `list_migrations`. Die Baseline `20260708000000` **nicht** erneut anwenden, ihr Inhalt existiert remote schon. Laut Bestand fehlen:

| # | Datei | Pflicht? |
|---|---|---|
| 1 | `20260719090000_sm_webhooks.sql` | für das Archiv |
| 2 | `20260719091000_sm_grafiken_bucket.sql` | für das Archiv |
| 3 | `20260719092000_sm_website_content.sql` | empfohlen (Sektionstexte) |
| 4 | `20260719093000_sm_tabelle.sql` | **ja** (Tabelle) |
| 5 | `20260731120000_sm_insights_daily.sql` | optional (Insights) |
| 6 | `20261004100000_sva_vereinspflege.sql` | **ja** |
| 7 | `20261004101000_sva_web_snapshot.sql` | **ja** |
| 8 | `20261004102000_sva_security_haertung.sql` | **ja** |
| 9 | `20261005100000_sva_spieltag_live.sql` | **ja** (v15-L Live-Ticker, Rollen, Trainingsort — siehe `docs/SPIELTAG.md`) |
| 10 | `20261006100000_sva_partner.sql` | **ja** (v16-S Partner-Bereich `/partner` — siehe `docs/PARTNER.md`) |
| … | `20261007100000` … `20261008110000` | Album, Galerien (siehe `docs/ALBUM.md`, `docs/DESIGN.md`) |
| 11 | `20261009090000_sva_alltag.sql` | **ja** (v18-A Kalender-Abo + Mannschaften fürs Probetraining — siehe `docs/STATISTIK.md`) |
| 12 | `20261009100000_sva_statistik.sql` | **ja** (v18-A cookiefreie Statistik — siehe `docs/STATISTIK.md`) |

Anwenden geht einzeln im SQL-Editor (Datei-Inhalt einfügen) oder per MCP `apply_migration`. `supabase db push` nur verwenden, wenn die Remote-Migrationshistorie zu den Dateinamen passt. Sonst versucht es die Baseline erneut.

Was Nr. 6 mit dem **Altbestand** macht: Gibt es in `sm_roster` schon Zeilen, werden sie beim ersten Lauf **inaktiv** gesetzt (nicht gelöscht). Danach wird der echte Kader aus `players.ts` angelegt, mit Fotos aus `public/players/`. Alte Einträge lassen sich im Admin unter Kader → „inaktive zeigen“ wieder aktivieren.

Danach kurz prüfen:
```sql
select jsonb_pretty(public.web_snapshot());
select has_function_privilege('anon', 'public.is_sm_admin()', 'execute');  -- muss false sein
```

### 4. Edge Functions deployen
```bash
npx supabase functions deploy kalender --project-ref fwiivwmoyagcdrjvhaou --use-api --no-verify-jwt   # v18-A, öffentlich
supabase link --project-ref fwiivwmoyagcdrjvhaou
supabase functions deploy publish-site        # neu (verify_jwt bleibt an)
supabase functions deploy drive-bridge        # Sicherheits-Fix folderId
```

### 5. Netlify-Build-Hook anlegen und als Secret hinterlegen
1. Netlify → Site → Site configuration → Build & deploy → **Build hooks** → „Add build hook“. Name: „Admin veröffentlichen“, Branch: der Production-Branch.
2. Die URL sieht so aus: `https://api.netlify.com/build_hooks/…`. Sie gehört **nur** in Supabase, nicht ins Repo und nicht in Netlify-Env:
   ```bash
   supabase secrets set NETLIFY_BUILD_HOOK=https://api.netlify.com/build_hooks/XXXXXXXX
   ```
   Die Function akzeptiert nur URLs dieser Form und schützt mit 60 s Cooldown vor Doppelklicks.

### 6. Netlify-Umgebungsvariablen
Site configuration → Environment variables:

| Name | Wert | Wofür |
|---|---|---|
| `SUPABASE_URL` | `https://fwiivwmoyagcdrjvhaou.supabase.co` | Build-Fetch |
| `SUPABASE_READ_KEY` | anon-Key (öffentlich) | Build-Fetch (`web_snapshot`) |
| `VITE_SUPABASE_URL` | wie oben | Admin im Browser (vermutlich schon gesetzt) |
| `VITE_SUPABASE_ANON_KEY` | anon-Key | Admin im Browser |

Fehlen `SUPABASE_URL`/`SUPABASE_READ_KEY`, steht im Build-Log `!! fetch-content: WARNUNG …`.

### 7. Durchstich testen
1. `/admin` → einloggen → **Übersicht** → „Website veröffentlichen“.
2. Netlify → Deploys: Der Build trägt den Titel „Admin: Website veröffentlichen (…)“. Im Log muss `fetch-content: Overlay geschrieben (players=24, …)` stehen.
3. Website prüfen: Kader, nächstes Spiel, Tabelle.
4. Danach `src/admin/lib/database.types.ts` neu generieren (MCP `generate_typescript_types`) und mit der Hand-Ergänzung vergleichen.

### 8. Inhaltliche Pflichtinfos (stehen auch in der Checkliste der Übersicht)
WhatsApp-Nummer eintragen. Trainingszeit bestätigen. FuPa-Link setzen. Impressum und Datenschutz füllen und unter „Verein & Links“ abhaken. Das echte nächste Spiel und die Tabelle eintragen.

### Bekannte Grenzen (bewusst nicht angefasst, weil Website-Komponenten tabu waren)
- `src/ui/StaffCard.tsx` und `src/ui/PlatzFinden.tsx` importieren `CONTACT`/`whatsappUrl` direkt aus `club.ts` statt aus `content.ts`. Dort kommen WhatsApp-Nummer und Adresse aus dem Admin erst an, wenn die beiden Importe auf `../data/content` umgestellt sind (je eine Zeile).
- Der Kontakt-Sektionstext (`SECTIONS` „Di & Do ab 19 Uhr“) ist Copy und keine Kontakt-Variable. Ändern lässt er sich über `sm_website_content` (Sektion `kontakt`), eine Admin-Maske dafür gibt es noch nicht.
- Die Website rendert `LINEUP` noch nicht. Der Vertrag (`src/data/lineup.ts`) wird exakt befüllt, die Darstellung macht der Website-Strang.
- ~~Sponsoren-Feld `bande` wird nicht ausgewertet~~ — seit v16-S zeigt die 3D-Bande nur Sponsoren mit „Auf der Bande“ (`BANDEN_SPONSOREN` in `content.ts`).
- Neue Fotos haben keinen Freisteller (macOS-Vision-Pipeline läuft offline). Die Karte zeigt dann das Foto im Duotone-Rahmen.
- „Nächstes Spiel“ wird zum Build-Zeitpunkt berechnet. Nach dem Anpfiff bleibt es bis zum nächsten Veröffentlichen stehen.

---

## Teil B: Bedienanleitung für den Trainer (1 Seite)

**Adresse:** `…/admin`, am Handy am besten als Lesezeichen auf dem Home-Bildschirm. Anmelden mit deiner E-Mail, dann kommt ein Link per Mail.

**Die wichtigste Regel:** Alles, was du änderst, ist sofort **gespeichert**. Auf der Website erscheint es aber erst, wenn du **„Website veröffentlichen“** drückst. Nach 2–4 Minuten ist die Seite aktuell. Die Übersicht zeigt dir, was seit dem letzten Veröffentlichen geändert wurde.

**Unten am Handy:** Übersicht · Kader · Aufstellung · Spiele · Mehr. Unter „Mehr“ findest du Tabelle, Sponsoren, Verein & Links und den Veröffentlichen-Knopf.

### Vor dem Spiel: Aufstellung
1. **Aufstellung** öffnen und oben die Formation tippen (4-4-2, 4-3-3 …).
2. Einen Kreis auf dem Feld antippen und den Spieler aus der Liste wählen. Steht der Spieler schon woanders, wird getauscht. Alternativ: Spieler gedrückt halten und auf den Platz ziehen.
3. Bank: „+ Spieler“ tippen oder Spieler auf „Bank“ ziehen. Das ✕ nimmt einen Spieler wieder runter.
4. Bei „Für welches Spiel?“ das Spiel wählen. Dann steht auf der Website „Aufstellung gegen …“.
5. **Aufstellung speichern**. Das geht erst, wenn genau 11 Spieler stehen. Danach **Veröffentlichen**.

### Nach dem Spiel: Ergebnis
**Spiele** öffnen. Unter „Ergebnis fehlt“ beide Tore eintragen und auf **Speichern** tippen. Danach **Veröffentlichen**. Die Tabelle schreibst du bei Gelegenheit von fussball.de ab (Knopf „fussball.de öffnen“).

### Neues Spiel eintragen
Spiele → **+ Spiel**. Gegner, Heim oder Auswärts, Datum und Anstoß eintragen. Der Ort ist bei Heimspielen schon vorausgefüllt.

### Spieler austauschen
- **Neuer Spieler:** Kader → **+ Spieler**. Name eintragen, Position tippen, Nummer optional. „Foto wählen“ öffnet die Kamera oder Galerie. Dann das Bild mit dem Finger verschieben, mit dem Regler zoomen und den Kopf ins obere Drittel setzen.
- **Spieler weg:** Spieler antippen und **„Aktiv“ ausschalten**. Er verschwindet von der Website, bleibt aber gespeichert. Löschen nur bei Tippfehlern.
- **Kapitän:** Schalter beim neuen Kapitän einschalten. Der alte wird automatisch abgelöst.
- **Reihenfolge:** Mit den Pfeilen ▲▼ rechts neben dem Namen verschieben.

### Sponsoren
Sponsoren → **+ Sponsor**. Name eintragen, Logo hochladen (PNG mit durchsichtigem Hintergrund ist ideal) und optional den Link. „Auf der Bande“ legt fest, ob das Logo auch am Spielfeldrand erscheint.

### Verein & Links
Hier stehen fussball.de, FuPa, Instagram, WhatsApp, E-Mail, Trainingszeiten und Adresse. Links kannst du einfach aus dem Browser einfügen. Mit „Testen“ prüfst du, ob ein Link funktioniert.

### Wenn etwas komisch ist
- Gelber Kasten **„Datenbank ist noch nicht vorbereitet“**: Marvin Bescheid geben. Teil A ist dann noch nicht erledigt.
- **„Veröffentlichen ist noch nicht eingerichtet“**: Deine Änderungen sind trotzdem gespeichert. Marvin richtet den Knopf ein (Teil A, Schritt 4–5).
- Das Archiv „Social Media“ unten links brauchst du für die Website nicht.
