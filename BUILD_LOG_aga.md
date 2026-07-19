# BUILD_LOG — AGA (SV Agathenburg-Dollern 1949)

## Admin-Ausbau 19.07.2026 (Branch `feat/admin-ausbau`)

Autonomer Wochenend-Push auf Basis von `docs/ADMIN_AUSBAU_VORSCHLAG.md`. Alle
risikoarmen Punkte gebaut (Marvin wählt beim Review). Branch von `release`, kein
Push/Deploy/DB-Apply. Migrationen liegen als DATEIEN vor, NICHT angewandt. Die
untracked 3D-Artefakte (`BUILDSPEC_aga.md`, `screenshots-*/`, `audit-screenshots/`)
wurden nie ge-add-et (immer gezielt `git add <pfad>`).

### Definition of Done (Belege)

| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | **Exit 0** — 0 Fehler, kein `any`, kein `@ts-ignore` |
| `pnpm build` inkl. Prerender | **grün** (Exit 0) — „Prerender ok: 33.3 kB Inhalts-DOM" (byte-identisch zum Vor-Stand → 3D-Seite unverändert) |
| `fetch-content.mjs` (env-los) | „Overlay=null (statischer Fallback greift)" — deterministisch, kein git-Diff am generierten File |
| eslint auf allen geänderten Dateien | Alle **von mir neu geschriebenen** Dateien sauber. Verbleibend nur **3 vorbestehende** Fehler + 1 Warnung in Dateien, die ich nur an der Import-Zeile berührt habe (per `git stash` als vor-bestehend verifiziert): `Matchday.tsx:99` set-state-in-effect (Deep-Link-Prefill, war schon da), `Scoreboard.tsx:77` use-memo, `Brandbar.tsx:28` only-export-components. **Nicht durch diesen Ausbau eingeführt.** |

### P2 — Automationen produktiv (VOLL gebaut)

- **Migration-DATEI** `supabase/migrations/20260719090000_sm_webhooks.sql`:
  `sm_webhooks` (Registry je Event: url, aktiv, letzter_versand, letzter_status)
  + `sm_webhook_deliveries` (Zustell-Log: webhook_id FK, event, status, http_code,
  payload_excerpt, gesendet_at). RLS 1:1 nach `sm_insights`-Muster (nur
  `is_sm_admin`). Seed der 4 Andockpunkte.
- **Code:** `database.types.ts` (Typen), `db.ts` (CRUD + `recordDelivery` +
  `isMissingTable`-Helfer SQLSTATE 42P01), `queries.ts` (Hooks, `retry:false`).
  `pages/Automationen.tsx` von localStorage auf `sm_webhooks` umgestellt: URLs
  team-weit, Test-Button nutzt gespeicherte URL und protokolliert Versand, „letzter
  Versand/Status" je Event + Zustell-Log-Tabelle in der UI.
- **Graceful degradation:** Fehlt die (noch nicht angewandte) Tabelle, zeigt die
  Seite einen sichtbaren Hinweis und fällt auf localStorage zurück — kein Crash.
- **Grenze eingehalten:** `spiel.angelegt` NICHT auf `sm_spiele` INSERT verdrahtet
  (eingefroren) — Doku-Platzhalter, Kommentar „nach SME Stage 1 auf `matches`".

### P4 — Matchday-Stills-Durchstich (VOLL gebaut, Bucket env-gatet)

- **Migration-DATEI** `supabase/migrations/20260719091000_sm_grafiken_bucket.sql`:
  privater Storage-Bucket `sm_grafiken` (public=false, nur image/png) + RLS auf
  `storage.objects` (nur `is_sm_admin`). Deckt zugleich P0-Bucket ab (eine Datei).
- **Code:** `matchday/export.ts` (Drive-Zielordner-Helfer `SVA Media / Saison /
  Spieltag`, `currentSaison`, `isBucketMissing`), `db.ts` (`fireWebhook` löst
  n8n-Andockpunkt `grafik.gerendert` aus + protokolliert, `linkContentAsset` setzt
  `drive_asset_url` + Status „fertig"). `pages/Matchday.tsx`: „In Storage speichern"
  ist jetzt der Durchstich (Upload-Default → Beitrag verknüpfen → Drive-Flow).
  Beitrag-Auswahl aus Spieltagspaket (`spiel_id`).
- **Sauberer Fallback:** Fehlt der Bucket, lädt der Generator das PNG herunter und
  meldet es klar — kein Hard-Crash.
- **Adapter-Hinweis:** Prefill-Quelle `sm_spiele` mit Kommentar „beim SME-Backfill
  auf `matches` umstellen".

### P0 — Cockpit-v2-Vorbereitung (die baubaren Teile)

- **Netlify-CI-Prerender-Fix** in `netlify.toml`: Build-Command auf
  `pnpm exec playwright install --with-deps chromium && pnpm build`. CI-scoped —
  lokaler `pnpm build`/`package.json` unverändert, 3D-Onepager-Prerender unberührt.
  Lokal belegt: `pnpm build` inkl. Prerender grün (33.3 kB).
  *Hinweis:* Der eigentliche CI-Lauf auf Netlify ist von hier aus nicht testbar
  (kein Deploy erlaubt). `--with-deps` ist der von Playwright empfohlene Weg; sollte
  die Netlify-Umgebung `--with-deps` (apt) verweigern, ist der Fallback
  `playwright install chromium` (ohne deps) in einer Zeile ersetzbar.
- **`sm_grafiken`-Bucket-Migration:** = P4-Datei (nicht doppelt).
- **NICHT gebaut** (bewusst, = Marvin/GATE): GATE-1/„live schalten"/Deploy.

### P1 — Website an DB anschließen (ENV-GATED, sauberer Fallback)

- **Build-time Fetch** `scripts/fetch-content.mjs`: liest — NUR wenn Build-Env
  (`SUPABASE_URL`+`SUPABASE_READ_KEY`, Fallback `VITE_*`) gesetzt — Kader/Spiele/
  Sponsoren/Tabelle aus den kanonischen Tabellen `players`/`matches`/`sponsors` +
  `sm_tabelle` und backt sie als statisches Overlay ins Bundle. Node-Env, **nicht**
  `VITE_`-prefixed → **kein Supabase im Client-Bundle** (3D-Seite bleibt
  Supabase-frei, 0-externe-Requests-Befund erhalten). Jede Teilabfrage einzeln
  abgesichert; der Build kippt **nie** am Fetch (Fallback Overlay=null).
- **Resolver** `src/data/content.ts` (Fassade): Overlay bevorzugen, sonst
  statischer Seed. `players.ts`/`club.ts` **unverändert**, nur lesend als Fallback.
- **Konsumenten umgezogen** auf die Fassade: Kader (PlayerCardGrid, PlayerGallery,
  PlayerCards3D, FussballWidget), Sponsoren (SponsorsStrip, Barrier), Spiel/Tabelle
  (Scoreboard, FussballWidget). Tabellen aktuell leer → Overlay=null → Ausgabe
  byte-identisch (Prerender unverändert 33.3 kB).
- **Copy-Teil (optional, gebaut):** Migration-DATEI
  `supabase/migrations/20260719092000_sm_website_content.sql` (Sektionstexte je
  Abschnitt, RLS wie oben). Fassade merged Copy **konservativ** — Reihenfolge/IDs
  (Kamera-Stationen) bleiben aus dem Seed, Overlay überschreibt pro Abschnitt nur
  vorhandene Textfelder. SECTIONS-Konsumenten (Brandbar, useScrollProgress,
  Sections) umgezogen.
- **NICHT gebaut** (= Marvin/Deploy): echter Netlify-Build-Hook. Der
  „Veröffentlichen"-Auslöser bleibt Doku/Platzhalter.

### P3 — fussball.de-Seite vorbereitet (Quelle = GATE-D, nicht geraten)

- **Migration-DATEI** `supabase/migrations/20260719093000_sm_tabelle.sql`:
  Ligatabelle (Cockpit-Hoheit), `diff` als generierte Spalte, `self`-Flag, RLS wie
  oben. Ergebnis-Schreibpfad auf `matches` NICHT gebaut (SME Stage 1).
- **Admin-Handeingabe:** neue Seite `pages/Tabelle.tsx` (Add/Edit/Delete, eigene
  Mannschaft hervorgehoben), Route `/tabelle` + Nav „Ligatabelle". `db.ts`/
  `queries.ts` CRUD.
- **Website-Anbindung** über den P1-Mechanismus (fetch-content liest `sm_tabelle`,
  `content.ts` overlayed `TABLE_PREVIEW`, Fallback statisch).
- **GATE-D offen gelassen:** fussball.de→`sm_tabelle`-Auslesepfad NICHT verdrahtet;
  in der Admin-UI + im Migration-Kommentar als 3 Optionen (DFB-Widget / n8n /
  Handeingabe) dokumentiert.

### Migrations-DATEIEN dieses Ausbaus (alle NICHT angewandt)

| Datei | Inhalt |
|---|---|
| `20260719090000_sm_webhooks.sql` | P2: `sm_webhooks` + `sm_webhook_deliveries` + RLS |
| `20260719091000_sm_grafiken_bucket.sql` | P0/P4: Storage-Bucket `sm_grafiken` + RLS |
| `20260719092000_sm_website_content.sql` | P1-Copy: `sm_website_content` + RLS |
| `20260719093000_sm_tabelle.sql` | P3: `sm_tabelle` + RLS |

### WARTET-AUF-MARVIN (env-geparkte Handgriffe / Gates)

- **Migrationen anwenden** (in dieser Reihenfolge, nach Review): `20260719090000`,
  `20260719091000`, `20260719092000`, `20260719093000`. Erst danach greifen
  `sm_webhooks`/Zustell-Log, der Grafik-Durchstich, die Copy-Pflege und die
  Ligatabelle produktiv.
- **`sm_grafiken`-Bucket anlegen** (via Migration `20260719091000` oder Dashboard).
- **n8n-Flows aktivieren** und URLs in `/admin/automationen` eintragen
  (`beitrag.fertig`, `insights.faellig`, `grafik.gerendert`).
- **GATE-D entscheiden** (fussball.de-Quelle: DFB-Widget / n8n / Handeingabe) —
  bis dahin ist die Handeingabe unter `/admin/tabelle` die Quelle.
- **Supabase-Build-Env für P1 setzen** (`SUPABASE_URL` + `SUPABASE_READ_KEY` im
  Netlify-Build) — sonst bleibt der statische Fallback aktiv (aktuell erwünscht,
  da die kanonischen Tabellen leer sind → wartet auf SME Stage 1 + Backfill).
- **Netlify-Build-Hook** für „Veröffentlichen" real einrichten (Deploy-Sache).
- **GATE-1 / GATE-A** (Branch-Wahrheit `release`→`main`, Deploy-Zeitpunkt mit
  3D-Builder) — unverändert offen, nicht Teil dieses Ausbaus.
- **Netlify-CI-Prerender:** erster echter CI-Build beobachten (Playwright-Install).

---

## Safe-Blocker + Sicherung 15.07.2026

Auftrag: die Blocker bauen, die **keinen Content von Marvin brauchen**, und die
ungepushte 3D-Politur sichern. Eng begrenzt.

> ## 🚨 NICHTS WURDE ÖFFENTLICH GESCHALTET
> Ausdrücklich bestätigt:
> - **Kein Push auf `release`.** `origin/release` steht unverändert auf `b1fd734`
>   (vorher wie nachher — verifiziert per `git ls-remote`).
> - **Kein Netlify-Prod-Deploy**, kein Deploy überhaupt, kein DNS, keine Domain.
> - Der **Fake-Kader wurde nicht angefasst** und ist weiterhin nicht öffentlich freigegeben.
> - Die neuen Rechtsseiten stehen auf `noindex, nofollow`, solange sie Lücken haben.
>
> Die Seite bleibt gesperrt bis: echter Kader + Impressum/Datenschutz gefüllt und geprüft.

---

### 1. Sicherung der 3D-Politur (Aufgabe 1)

**Problem:** 5 Commits der 3D-Politur vom 14.07. existierten **nur auf dieser Festplatte**.
`release` ist laut `netlify.toml` gleichzeitig der **Produktions-Branch** — ein
`git push origin release` hätte also genau das ausgelöst, was verboten ist
(Fake-Kader + fehlendes Impressum live). Sichern und Live-Schalten mussten getrennt werden.

**Gewählter Weg: Push auf einen Nicht-Branch-Ref.**

```
git push origin release:refs/backup/release-politur-20260715
```

Begründung:
- Bringt die Arbeit **von der Platte runter** (ein Bundle auf derselben 96 % vollen
  Platte schützt gegen nichts).
- Netlify baut auf Pushes nach **`refs/heads/*`**. `refs/backup/*` ist kein Branch →
  kann **kein** Branch-Deploy werden, nicht Produktions-Branch werden, keinen PR öffnen.
  Das gilt auch dann, wenn im Netlify-UI „Branch deploys: all" eingestellt sein sollte
  (aus dem Repo nicht prüfbar — deshalb bewusst der Weg, der davon unabhängig sicher ist).
- Ganz normal wiederherstellbar per `git fetch`.

**Nachweis, dass alle 5 Commits drin sind** — Ref vom Remote zurückgefetcht und geprüft:

| # | Commit | Inhalt |
|---|--------|--------|
| 1 | `2e3204b` | P1: Karten-Wand |
| 2 | `afff531` | P2: Menschen 3.0 |
| 3 | `e4d4c80` | P3: Licht |
| 4 | `afff159` | P4: Tür-Eintritt |
| 5 | `6729865` | P5: Gebäude |

- `git rev-list --count b1fd734..refs/remotes/backupcheck` → **5** ✅
- `git diff --stat release refs/remotes/backupcheck` → **leer** (Baum identisch) ✅
- `git ls-remote origin` → `refs/backup/release-politur-20260715` = `6729865` ✅
- `refs/heads/release` **weiterhin `b1fd734`** → Produktion unberührt ✅

**Zweite Kopie (gegen lokale Git-Unfälle, z. B. versehentliches Reset):**
`/Users/marvinallers/code/aga-politur-5commits-20260715.bundle` (28 K, `git bundle verify` ok).

> ⚠️ **Der Backup-Ref wurde nach jedem Paket aktualisiert** und enthält am Ende auch die
> 4 neuen Safe-Blocker-Commits.

**Wiederherstellung** (falls je nötig):
```
git fetch origin refs/backup/release-politur-20260715:refs/heads/rettung
```

---

### 2. Worktree-Cleanup (Aufgabe 1)

- `sva-fussball-web` war ein **verlinkter Worktree** auf `v13-premium` (`dca9f67`).
- **Vorher geprüft:** `git log release..v13-premium` = **0** und
  `git merge-base --is-ancestor dca9f67 release` = **ja** → `v13-premium` enthält
  **nichts**, was nicht schon in `release` ist. Kein Verlust möglich.
- **Aber:** Der Worktree enthielt 3 *untracked* Dinge, die `git worktree remove` gelöscht hätte.
  Statt zu löschen → **gerettet** nach `/Users/marvinallers/code/aga-worktree-reste-20260715/`:
  - `_og-template.html` (2 K, nie committed — Scratch-Template zur OG-Bild-Erzeugung,
    verweist auf `/private/tmp/...`-Pfade; vermutlich wertlos, aber nicht meine Entscheidung)
  - `screenshots-audit-v13/` (**144 MB** Screenshots)
  - `.netlify/` (lokaler CLI-State) — als einziges verworfen, da reproduzierbar
- Danach sauber entfernt: `git worktree remove` ✅. Ordner weg, `git worktree list` zeigt
  nur noch das Haupt-Repo. **Branch `v13-premium` bleibt bestehen** (Removal löscht nur den Checkout).
- Nebeneffekt: durch die entfernten `node_modules` ist wieder ~1 GB frei (17 → 20 GiB).

**→ Marvin-To-do:** Die geretteten 144 MB Screenshots prüfen und freigeben, ob sie weg können.
Bei 96 % voller Platte der größte schnelle Gewinn. **Nicht ohne Freigabe gelöscht.**

---

### 3. Safe-Blocker (Aufgabe 2) — alle 4 erledigt

#### ✅ 3.1 Debug-Hotkeys hinter Dev-Guard (`5e23dd5`)
`src/App.tsx`: `p` (Perf-Overlay) / `e` (Kino-Effekt-Panel) hingen ungeschützt am `window` —
jeder Besucher konnte die Debug-Panels öffnen, auch versehentlich beim Tippen.
Listener jetzt hinter `import.meta.env.DEV` (zur Build-Zeit konstant → Vite entfernt den Block).

**Beleg:** Im Prod-Bundle `dist/assets/App-*.js` existiert **kein `p`/`e`-Key-Vergleich** mehr.
Die verbleibenden 4 `keydown`-Listener wurden einzeln geprüft und sind unbeteiligt
(framer-motion-Interna + `Escape`/Pfeiltasten für Modal, Lightbox, Gate).

**Zusätzlich abgesichert:** `App.tsx` war der **einzige** Aufrufer von `togglePerf`/`toggleFxPanel`,
und `showPerf`/`showFxPanel` werden **nicht** persistiert (localStorage hält nur `sva-sound`/
`sva-fanchant`). `window.useStore` wird in `main.tsx` ebenfalls nur im DEV gesetzt →
es bleibt in Produktion **kein** Weg, die Panels zu öffnen.

#### ✅ 3.2 Fake-Countdown entfernt (`412f7ab`)
`nextSunday1500()` erzeugte den Anstoß synthetisch → die Seite zählte **live auf ein Spiel
herunter, das es nicht gibt**. Schlimmer: Der Kalender-Button exportierte diesen erfundenen
Termin als **ICS in den Kalender der Besucher**.

Gelöst analog zum vorhandenen `whatsappReady`-Idiom (bewusst kein neues Muster erfunden):
- `Match.kickoff` (ISO-String mit Zeitzonen-Offset) als optionales Feld
- `nextKickoff()` → `null`, solange kein echter Termin hinterlegt ist
- ohne `kickoff`: **kein Countdown, kein ICS-Button**, und die irreführende Zeile
  „So 15:00 · Termin vorläufig" ist weg

**Beleg (prerendertes `dist/index.html`):** `class="countdown"` → **0 Treffer**,
„Termin vorläufig" → **0 Treffer**, `nextSunday` im gesamten Bundle → **0 Treffer**.
Die Karte sagt jetzt: *„SVA vs Gegner folgt · Sonntag · Termin folgt — sobald der Spielplan
steht, läuft hier der Countdown."*
Trägt Marvin einen echten `kickoff` ein, erscheinen Countdown + Kalender **automatisch**.

#### ✅ 3.3 robots.txt: `/admin` gesperrt (`9373399`)
`Disallow: /admin` ergänzt (Cockpit liegt laut `netlify.toml` im selben Build, also unter
derselben Domain). Im Kommentar festgehalten: **robots.txt ist kein Zugriffsschutz**, nur eine
Bitte an brave Crawler — der echte Schutz bleibt die Supabase-Auth.

**Sitemap-Zeile bewusst unverändert** auf `sva-agathenburg-dollern.netlify.app` gelassen
(GATE-5: Domain nicht entschieden/gekauft). Eine Sitemap-URL auf eine Wunschdomain, die
niemandem gehört, wäre schlechter als der Status quo.

#### ✅ 3.4 Impressum + Datenschutz als Gerüst (`943a98a`)
Vorbefund selbst verifiziert: `grep -ril "impressum|datenschutz" src/ public/` → **0 Treffer**.

Angelegt als **eigenständige statische HTML-Seiten** (`public/impressum.html`,
`public/datenschutz.html`) — *nicht* als In-App-Route. Grund: Ein Impressum muss **ständig
verfügbar** sein (§ 5 DDG), also auch dann, wenn WebGL fehlt oder das 3D-Bundle nicht lädt.
- `netlify.toml`: zwei Rewrites **vor** dem SPA-Catch-all (erster Treffer gewinnt), sonst
  bögen `/impressum` und `/datenschutz` auf den 3D-Onepager um.
- Footer-Links in `src/ui/Sections.tsx` liegen im **prerenderten** `.scroll-root` → auch
  ohne JS im Quelltext (verifiziert in `dist/index.html`).

**Es wurde NICHTS erfunden** — keine Adresse, kein Vorstand, keine VR-Nummer, kein Amtsgericht.
Struktur nach § 5 DDG (Verein: Vorstand § 26 BGB, Registergericht, VR-Nummer) und Art. 13 DSGVO.
Offene Felder sind `<!-- TODO-MARVIN -->` (Daten) bzw. `<!-- TODO-JURIST -->` (Prüfung) — im
Quelltext **und sichtbar rot auf der Seite** (13 + 14 Marker), damit niemand sie versehentlich
mit Lücken live schaltet. Beide Seiten stehen bis zur Freigabe auf **`noindex, nofollow`**.

**Positiver Befund verifiziert und festgehalten:** Es werden **keine Third-Party-Ressourcen**
geladen (Fonts self-hosted; Maps/fussball.de/Instagram nur *verlinkt*) → **kein Cookie-Banner
nötig**. In der Datenschutz-Struktur bewusst als **Bedingung** dokumentiert: Die Aussage gilt
nur, solange nichts eingebettet wird, das beim Laden externe Server kontaktiert (Google Maps
iFrame, YouTube, Instagram-Feed, Google Fonts, Analytics). Dann werden Einwilligung + Banner nötig.

**Zusatzfund, ehrlich deklariert statt verschwiegen:** Die Seite schreibt zwei
localStorage-Schlüssel (`sva-sound`, `sva-fanchant`) — erst *nach* Klick des Nutzers, ohne
Kennung. Statt eines pauschalen „wir speichern nichts" sind beide benannt, mit
`TODO-JURIST` zur Einordnung als „unbedingt erforderlich" (§ 25 Abs. 2 Nr. 2 TDDDG).

**Beleg (headless geprüft):** Beide Seiten HTTP 200, **0 externe Requests**, 0 JS-Fehler —
die Rechtsseiten selbst verletzen den „keine Third-Party"-Befund also nicht (System-Fonts).

---

### 4. Build / Verifikation

| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | **Exit 0** — keine Fehler, kein `any`, kein `@ts-ignore` |
| `npx eslint` (geänderte Dateien) | **Exit 0** |
| `pnpm build` (inkl. Prerender) | **grün** — „Prerender ok: 33.3 kB Inhalts-DOM" |

**Der Build ist entgegen der Warnung durchgelaufen.** Der Playwright/Chromium-Prerender
funktionierte, weil Chromium lokal bereits im Cache lag (`~/Library/Caches/ms-playwright/`) —
es musste nichts geladen werden (wichtig bei 96 % voller Platte).

> ⚠️ **Bleibendes Risiko, nicht durch mich gelöst:** Auf Netlify-CI ist der Prerender
> **weiterhin ungetestet**. Dort ist der Chromium-Cache leer, d. h. `scripts/prerender.mjs`
> braucht einen Chromium-Download im CI. Es gibt aktuell **keinen** `postinstall`-Schritt
> mit `playwright install --with-deps`. **Der erste CI-Build kann daran scheitern.**
> Das ist ein eigenes Paket, kein Safe-Blocker — bewusst nicht angefasst.

---

### 5. Offen / wartet auf Marvin

**Launch-Blocker (Seite darf bis dahin nicht öffentlich):**
1. **Echter Kader** — 11 von 15 Namen sind erfunden, inkl. „Top-Torschützen".
   Bewusst **nicht** angefasst: wartet auf echte Namen/Fotos. Erfundenes durch anderes
   Erfundenes zu ersetzen wäre keine Lösung.
2. **Impressum füllen** — Vereinsname laut Register, ladungsfähige Anschrift (⚠️ **nicht**
   ungeprüft die Sportplatz-Adresse aus `club.ts` nehmen — das ist der *Spielort*),
   Vorstand § 26 BGB, Registergericht + VR-Nummer, Telefon.
3. **Datenschutz füllen** — Verantwortlicher, Hoster-Firmierung, Log-Speicherdauer,
   zuständige Aufsichtsbehörde (folgt aus dem Vereinssitz).
4. **AV-Vertrag mit dem Hoster (Netlify) abschließen** — Pflicht nach Art. 28 DSGVO
   **vor** dem Livegang. Dazu Drittlandtransfer USA bewerten (`TODO-JURIST`).
5. **Juristische Prüfung** beider Seiten (`TODO-JURIST`), danach `noindex` entfernen.
6. **Einwilligungen für Personenfotos** (`public/fans/`, Kaderfotos) — DSGVO/KUG.
7. Echte Spieltermine (`NEXT_MATCH.kickoff`) → Countdown erscheint dann von selbst.
8. Echte WhatsApp-Nummer (`club.ts` hält noch `491700000000`) → dann Datenschutz-Abschnitt
   „WhatsApp" ergänzen (Drittlandtransfer).

**Gates (Entscheidung liegt NICHT beim Builder):**
- **GATE-1 — `main` liegt 80 Commits hinter `release`.** Strukturfrage: Welcher Branch ist
  die Wahrheit, wird `main` nachgezogen oder ersetzt? **Bewusst nicht gelöst, nur gemeldet.**
  Es wurde nichts an `main` verändert.
- **GATE-5 — Domain.** Nicht gekauft → Sitemap/canonical bleiben auf der Netlify-URL.

**Marvins To-dos (klein):**
- Freigabe: Dürfen die geretteten 144 MB `screenshots-audit-v13/` gelöscht werden?
- Freigabe: `_og-template.html` (Scratch-Datei) — behalten oder weg?
- Die Platte bleibt bei **~20 GiB frei** knapp.

---

### 6. Commits dieses Auftrags (alle lokal auf `release`, **nicht** gepusht)

| Commit | Paket |
|---|---|
| `5e23dd5` | `fix(security)`: Debug-Hotkeys nur noch im Dev-Build |
| `412f7ab` | `fix(content)`: Fake-Countdown entfernt |
| `9373399` | `chore(seo)`: `/admin` für Crawler gesperrt |
| `943a98a` | `feat(legal)`: Impressum + Datenschutz als Gerüst |

Nicht angefasst (wie beauftragt): Fake-Kader, 3D-Qualität (P5-E1–E9), Kamerafahrt,
Instagram/Drive/n8n, `main`, sowie die untracked `BUILDSPEC_aga.md`, `audit-screenshots/`,
`screenshots-release/`.
