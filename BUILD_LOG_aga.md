# BUILD_LOG — AGA (SV Agathenburg-Dollern 1949)

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

---

## 3D-Politur (16.07.2026)

Auftrag: Marvins 8-Punkte-Fehlerkatalog als iterative 3D-Qualitäts-Schleife,
Priorität auf die eindeutig baubaren Punkte 6/7/8. Deploy-Preview für Marvins
Freigabe.

> ## 🚨 NICHTS ÖFFENTLICH GESCHALTET
> - **Kein Push auf `release`/origin.** Alle Arbeit liegt auf dem Nicht-Prod-Branch
>   **`feat/3d-politur`** (abgezweigt vom lokalen `release`-HEAD `dabc091`).
>   `origin/release` unberührt.
> - **Kein Netlify-Prod-Deploy, kein Branch-Deploy, kein DNS.** Preview = lokal
>   (`pnpm build` grün + `vite preview` auf `dist`).
> - **Fake-Kader NICHT durch erfundene Namen/Fotos ersetzt** — nur die räumliche
>   Anordnung der bestehenden Karten geändert.
> - Zusätzliche Sicherung: Tag `backup/release-politur-20260716-builder` = `dabc091`
>   (die im Auftrag genannte Remote-Ref `refs/backup/release-politur-20260715` war
>   lokal nicht vorhanden; die Commits liegen aber im `release`-Branch — Tag zur
>   Sicherheit gesetzt).

### Branch & Commits
`feat/3d-politur`, abgezweigt von `dabc091`:

| Commit | Etappe |
|---|---|
| `f1384d1` | **P5-E1** Scroll-Anker oben (Katalog #6) |
| `cdf167b` | **P5-E2** FIFA-Karten-Formation (Katalog #7) |
| `e117e76` | **P5-E3** Kamerafahrt-Konzept als Dokument (Katalog #8, GATE-11) |

### E1 — Scroll-Anker oben (Katalog #6) ✅ gebaut
`src/ui/Sections.tsx`: Anstoß-Gap **80vh → 40vh** verdichtet. Vorher lagen zwei
volle Leer-Viewports zwischen Hero-Ende und Karten-Enthüllung. Der Anstoß-/
Flutlicht-Beat bleibt erhalten (er hängt an `u`/`kickoffPhase`, nicht an der
Gap-Höhe) — nur dichter. Ergänzend das Karten-Reveal-Fenster minimal früher
(`u` 0.20 → 0.18, im E2-Commit).
**Beleg:** Scroll-Serie (`screenshots-mann/p5e1-10.png`): ~1 Viewport nach Hero
läuft der Sturzflug + Flutlicht UND die ersten Karten (KÖHLER/TINO) tauchen auf;
bei 1,5 Viewport steht die volle Formation. Rückwärts-Scrub glitchfrei
(Reveal = reine Funktion von `u`, kein Animations-State).

### E2 — FIFA-Karten-Formation (Katalog #7) ✅ gebaut (Desktop), mobil verbessert
`src/components/PlayerCards3D.tsx`. Marvins Befund war: Karten-Chaos, „Carsten"
überdeckt 16/13, Wolff/Neumann halb versteckt, Namen laufen ineinander.
- **Reihen-Lift gespreizt** `LINE_LIFT [1.55,1.0,0.48,0] → [2.75,1.85,0.95,0]`:
  die vier Reihen (TW/ABW/MIT/ANG) lesen als getrennte horizontale Bänder statt
  als diagonaler Haufen — keine Namensplatte verdeckt mehr eine andere.
- **Mehr Luft in der Reihe** (Spacing `5.3/1.45 → 5.9/1.6`).
- **Trainerstab raus aus dem Cluster:** Carsten + Nico als eigene Vordergrund-Reihe
  am unteren Bildrand, entlang der Bild-Horizontalen verteilt (Screen-Right =
  `+x/−z`) → beide voll im Bild, überdecken keine Spielerkarte mehr.
- **Mobil:** Reihen-Staffelung gestaucht (`liftScale 0.64`) + Cluster nach unten
  (`yLift −0.25`), damit die Karten dem Text ausweichen statt dahinter zu schmieren.
**Beleg:** `screenshots-mann/prod-desktop.png` (Prod-Build via `vite preview`):
alle **15 Spielerkarten + 2 Staff einzeln identifizierbar** auf 1440.
`prod-mobile.png`: deutlich verbessert (Text lesbar, Cluster tiefer) — die volle
Anforderung „17 Karten einzeln auf 375px" ist mobil **noch nicht** erreicht;
bleibt iterativ (s. offene Punkte).

### E3 — Kamerafahrt-Konzept (Katalog #8) 📄 Konzept vorgelegt, HALT an GATE-11
`docs/KAMERA_KONZEPT.md` geschrieben — **kein Code an `CameraPath.ts` geändert**
(GATE-11: Marvin gibt das Konzept frei/justiert, DANN Umbau).
**Kernidee:** Leitmotiv „Vom Ankommen zum Dazugehören" mit drei Höhen-Registern
(Vogelflug / Standpunkt / Augenhöhe). Signature-Reveal der Mannschaft neu als
**„Aufsteigen über die Karten-Wand"**: Kamera startet tief hinter dem West-Tor
(aus dem Anstoß-Sturzflug), steigt über die gestaffelte Karten-Wand auf und
schwenkt in die E2-Endkomposition — Reveal wie eine Stadion-Choreo statt
statischem Diagonal-Blick. Pro Station Ist-Pose + Absicht + konkreter Vorschlag.
4 offene Fragen an Marvin am Dokumentende (Reveal-Richtung, Höhen-Dramaturgie,
Tempo, Fanblock-Drift).

### Build / Verifikation
| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | **Exit 0** — kein `any`, kein `@ts-ignore` |
| `npx eslint` (geänderte Dateien) | sauber |
| `pnpm build` (inkl. Prerender) | **grün** — „Prerender ok: 33.3 kB Inhalts-DOM" |
| Prod-Preview (`vite preview` auf `dist`) | Karten-Fix sichtbar (prod-desktop.png) |

Chromium lag im Cache — der Prerender lief durch. **CI-Risiko unverändert:** auf
Netlify ist der Chromium-Cache leer, es gibt keinen `postinstall`-Schritt mit
`playwright install`; der erste CI-Build kann daran scheitern (eigenes Paket,
nicht Teil dieser Runde).

### Wie Marvin es sieht (Preview)
Kein Netlify-Zugang aus dieser Umgebung → **lokale Preview** statt Branch-Deploy:
```
cd /Users/marvinallers/code/sva-fussball
git checkout feat/3d-politur
pnpm build          # braucht Chromium (liegt im Cache)
npx vite preview     # → http://localhost:4173/  (bzw. angezeigter Port)
```
Station „Mannschaft" ansteuern (scrollen bis zur Formation) — Desktop zeigt die
saubere FIFA-Formation, Scrollen ab Hero führt direkt in den Reveal.
Screenshot-Belege liegen unter `screenshots-mann/` (nicht committet, lokal).
Falls Branch-Deploys in Netlify aktiv sind, kann Marvin `feat/3d-politur` auch
als Preview-Deploy bauen lassen — ein Push dorthin ist **kein** Prod-Deploy
(Prod = `release`).

### Offen / iterativ
- **E2 mobil:** 17 Karten einzeln auf 375px noch nicht voll erreicht. Vorschlag
  zum Iterieren: entweder Karten weiter aus dem Text schieben/verkleinern, oder
  auf Mobil bewusst als Backdrop + DOM-Grid („ALLE SPIELER ANZEIGEN") setzen.
  Marvin-Feedback auf der Preview holen.
- **E3 Umsetzung:** wartet auf GATE-11 (Konzept-Freigabe). Danach zuerst Station 2.
- **E4–E9** (Partyraum-Übergang, Spielerfiguren, Türen, Fassade, Zaun,
  DOM×3D-Kollisionen): nicht begonnen — Asset-/Shader-Themen, iterativ, nach den
  Kern-Punkten. Für E5 offen: GATE-12 (prozedural vs. CC0-Modelle).

### Marvins To-dos (diese Runde)
1. **Preview freigeben oder nachjustieren:** Karten-Formation (Desktop) + Scroll-
   Anker — passt die Anordnung, oder Feinwünsche (Karten größer/kleiner, andere
   Staffelung)?
2. **GATE-11:** `docs/KAMERA_KONZEPT.md` lesen und die 4 Fragen beantworten
   (v. a. Reveal-Richtung der Mannschaft), damit E3 in Code gehen kann.
3. Entscheiden, wie das Mobil-Karten-Layout final aussehen soll (s. offen).
4. Übernahme nach `release` bleibt **Marvins** Entscheidung (Prod ist live).

---

## 3D-Politur Etappe 2 (16.07.2026)

Auftrag: nächste Politur-Etappe aus Marvins Fehlerkatalog — Türen, Mauern/
Fassade (schwarzer Blob im Finale), Zaun, Partyraum-Übergang, Mobile FIFA-
Karten. Additiv auf `feat/3d-politur`, iterativ mit Screenshot-Feedback.

> ## 🚨 NICHTS ÖFFENTLICH GESCHALTET
> - **Kein Push** (weder `release` noch sonst) — alle Arbeit liegt lokal auf
>   `feat/3d-politur`. `origin/release` unberührt.
> - **Kein Netlify-Deploy** (Prod/Preview), kein DNS, kein Launch.
> - **`main` nicht angefasst.** **`src/camera/CameraPath.ts` NICHT geändert**
>   (GATE-11, kamera-unabhängige Etappe). Fake-Kader/Legal-Inhalte unberührt.
> - Preview = lokal: `pnpm build` grün + `vite preview` visuell verifiziert.

### Commits (auf `feat/3d-politur`, nach `3d5a8df`)
| Commit | Etappe |
|---|---|
| `7edf5e3` | **P5-E8** Zaun: alphaTest-Cutout (Katalog #4) |
| `a5a1e2e` | **P5-E7** Vereinsheim-Dach im Finale lesbar (Katalog #3) |
| `d4820d2` | **P5-E6** Türen als echte Tür-Elemente (Katalog #2) |
| `08e25a6` | **P5-E4** Partyraum-Übergang als warme Blende (Katalog #5) |
| `becf0ad` | **P5-E2** Mobile FIFA-Karten als inline DOM-Grid (Katalog #7) |
| `89c0765` | chore(ci): postinstall `playwright install chromium` |

### E8 — Zaun / depthWrite-Artefakte (Katalog #4) ✅
`src/components/BallStopFence.tsx`. Vorbefund (Screenshot Tabelle-/Sponsoren-
Station): `meshBasicMaterial transparent + depthWrite:false` erzeugte Sortier-/
Flimmer-Artefakte (Zaun sortierte mal vor, mal hinter Banner/Gebäude) und wirkte
unter Flutlicht zu hell. **Fix:** Textur-Stränge jetzt OPAK (alpha 0.96) + Ton
gedämpft, Material auf **`alphaTest:0.5` + `transparent:false`** → der Zaun
rendert im OPAKEN Pass, schreibt Tiefe und sortiert korrekt (Artefakt an der
Wurzel weg, nicht kaschiert). **Beleg:** `screenshots-mann/e8-desktop-036.png` —
Banner sortiert sauber vor dem Gitter, Zaun ruhig.

### E7 — Fassade / „schwarzer Blob" im Finale (Katalog #3) ✅
`src/components/Clubhouse.tsx`. Vorbefund (Finale-Rauszoom, Vogelperspektive
y≈19.5): das Vereinsheim war eine schwarze Masse, weil die Dachfläche mit
`#26262a` nachts fast schwarz absoff. **Fix:** Dach-Grundton auf Schiefer-Grau
`#565a64` aufgehellt, Quer-Sicken als von-oben-lesbare Dach-Gliederung ergänzt,
+ kleiner Emissive-Boden (`#2a2e38`, Intensität 0.32) → das Dach fällt nie unter
eine Mindesthelligkeit. **Beleg:** `screenshots-mann/prev-finale.png` (Prod-
Preview) — Gebäude liest als Gebäude: sichtbares Dach, blaues Fascia-Band,
Vereins-Schild, warme Fenster, Standort-Pin. Die Flutlicht-Mast-Köpfe von oben
lesen nach dem Dach-Fix mit ihren Licht-Kegeln/Glow **akzeptabel** — bewusst
NICHT angefasst (Floodlights.tsx ist in jeder Szene aktiv → höheres Regressions-
Risiko als Nutzen; Notiz falls Marvin sie später noch feiner will).

### E6 — Türen (Katalog #2) ✅
`src/components/Clubhouse.tsx` + `BrickHut.tsx`. Vorbefund (Tür-Anflug 0.41):
das blaue Türblatt war eine flache Box ohne Rahmen/Griff/Glas, die Öffnung ohne
Zarge. **Fix Clubhouse:** feste **Tür-Zarge** (Sturz + zwei Seitenpfosten, dreht
NICHT mit dem Blatt mit — gehört zur Wand) rahmt die Windfang-Öffnung; das
**Türblatt** ist jetzt ein echtes Element (blauer Rahmen + warm durchleuchtetes
**Glas-Oberfeld** + vertieftes Füllpanel + **Edelstahl-Griff**), bodennah &
zargen-hoch → kein Durch-die-Wand/kein Schweben. **BrickHut:** dunkle Laibung
hinter dem warmen Licht-Rechteck → offene Tür im Klinkerbau statt schwebendes
Glow-Quad. **Beleg:** `screenshots-mann/e6-desktop-041.png`.

### E4 — Partyraum-/Musikraum-Übergang (Katalog #5) ✅ + ⚠️ GATE-12-Frage
`src/ui/PartyDirector.tsx`. Vorbefund (party-p≈0.46–0.48, gemessen): kurz vor
dem Welt-Hop sitzt die Kamera IM winzigen Windfang, die warme Putzwand füllt den
Screen (>50 % unscharfe Nahgeometrie = „durch-die-Wand"-Barriere). Die alte
Blende (0.75·Dreieck) tönte die ohnehin warme Wand nur, statt sie zu decken.
**Fix:** die vorhandene warme Blende zu einem **Plateau nahe HOP** verstärkt
(0.97, Exponent 1.6 hält die Mitte hoch, fällt zu den Rändern weich) + wärmeres
**Bernstein-Zentrum** → der Nahflug-Moment liest als „ins warme Licht treten",
der Hop bleibt verdeckt; der schöne Tür-Schwellen-Frame davor (p≈0.30) bleibt
klar/blendfrei. Rein p-getrieben → Rückwärts-Scrub symmetrisch. **Belege:**
Serie `screenshots-mann/e4-desktop-041/043/045/046.png` (Schwelle → warmer
Schwall → verdeckter Hop → Emergenz im Raum mit Wappen/Tresen) + Prod
`prev-party.png`. Auch der **Zaun-Anflug** davor (0.39) ist durch E8 ruhiger.

> **⚠️ GATE-12-Klasse-Entscheidung (konservativer Default gebaut, Frage an
> Marvin):** Für den Hop-Moment gibt es drei Gestaltungswege — **(a) harter
> Schnitt** (schneller Cut, verliert das Kontinuierliche), **(b) Blende**
> (warmer Lichtschwall deckt den Cut — GEBAUT), **(c) reine Durchfahrt**
> (Windfang so aufweiten, dass nie Nahgeometrie den Screen füllt — invasiver,
> Geometrie-/Near-Plane-Umbau). Ich habe **(b) Blende** als sinnvollen, risiko-
> armen Default gebaut (nutzt die vorhandene Architektur, kein Geometrie-Umbau).
> **Frage:** Passt die warme Blende, oder willst du Richtung (c) „echte
> Durchfahrt ohne jede Blende"? Das wäre eine eigene, größere Etappe (Windfang
> aufweiten + partyPath-Feintuning).

### E2 — Mobile FIFA-Karten (Katalog #7) ✅
`PlayerCards3D.tsx`, `PlayerCardGrid.tsx`, `useScrollProgress.ts`, `Sections.tsx`,
`index.css`, `cards.css`. Vorbefund (375px): 17 Karten als 3D-Perspektiv-
Formation überlappen hinter dem Text, Namen unlesbar. **Fachliche Entscheidung:
Backdrop + DOM-Grid** (17 Karten können auf 375px physisch nicht als 3D-Formation
einzeln lesbar stehen — das ist keine Tuning-Frage, sondern Bildausschnitt).
Umsetzung:
- **PlayerCardGrid:** auf schmalen Viewports (≤640px, reaktiv via `matchMedia`)
  ein inline **2-Spalten-DOM-Grid** aller 15 Spieler + 2 Staff (HoloCards) —
  jede Karte voll lesbar (Rating/Position/Name/Stats/Foto), **tappbar → selbes
  Detail-Modal** wie auf dem Platz.
- **PlayerCards3D:** der überlappende 3D-Kartencluster wird auf Mobil
  unterdrückt (leeres Layout) → Platz/Stadion bleibt atmosphärischer **Backdrop**,
  kein Doppel-Rendering, kein Text-Overlap.
- **Grundursache-Fix in `useScrollProgress.ts`:** Nicht-`snap-start`-Sektionen
  hatten ein Präsenz-Fenster von nur EINEM Punkt (Center) → das hohe Karten-Grid
  fadete beim Scrollen weg (die unteren Karten verschwanden komplett, obwohl im
  DOM). Jetzt behandeln **Kamera-Anker UND Präsenz-Fenster jede Sektion höher als
  der Viewport generisch wie snap-start** (Ruhepunkt/Sichtbarkeit über den ganzen
  Scroll-Bereich). Desktop-Mannschaft ≈ 1 Viewport → nicht „tall" → **komplett
  unverändert** (3D-Formation aus E2 bleibt).
- **CSS:** `.section--roster` mobil `flex-start`/`snap-start`/Kopf-Padding;
  Grid 2 Spalten; pointer-events für HoloCards in der `passthrough`-Sektion
  zurück (sonst Tap nicht möglich — die Karten sind `<div role=button>`,
  keine `<a>/<button>`).
**Belege:** `screenshots-mann/roster-1-top.png` … `roster-4.png` (alle 15 Spieler
+ Trainerstab einzeln lesbar, 2 Spalten, kein Overlap), `roster-tap.png` (Tap →
Detail-Modal TINO), Prod `prev-roster.png`. Desktop-Gegencheck:
`e2desk-desktop-016.png` (volle 3D-Formation unverändert).

### Build / Verifikation
| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | **Exit 0** — kein `any`, kein `@ts-ignore` |
| `npx eslint` (geänderte Dateien) | **0 Fehler** (¹) |
| `pnpm build` (inkl. Prerender) | **grün** — „Prerender ok: 33.3 kB Inhalts-DOM" |
| Prod-Preview (`vite preview` auf `dist`) | alle 5 Fixes sichtbar (prev-*.png) |

¹ **Ausnahme, ehrlich:** `Clubhouse.tsx` hat weiterhin **einen vorbestehenden**
`react-refresh/only-export-components`-Fehler auf dem `CLUBHOUSE_POS`-Export
(Zeile 97) — **nicht** von dieser Etappe eingeführt (codebase-weites Muster, vgl.
BUILDSPEC P4: 39 Alt-Errors). Meine geänderten Zeilen sind lint-sauber; ein Fix
hieße `CLUBHOUSE_POS` in eine eigene Datei auslagern (berührt `partyPath.ts`) —
bewusst nicht Teil dieser 3D-Politur-Etappe.

### CI-Prerender-Absicherung (aus letzter Etappe offen)
`package.json`: **`postinstall: "playwright install chromium"`** ergänzt. Der
Netlify-CI-Chromium-Cache ist leer; `scripts/prerender.mjs` nutzt
`chromium.launch()` → ohne diesen Schritt scheitert der erste CI-Prerender-Build.
Bewusst **nur Chromium**, **kein `--with-deps`** (die System-Libs setzt der
Prerender ohnehin schon voraus → kein neues Deploy-Risiko, keine root/apt-
Abhängigkeit). Lokal idempotent (Cache). Netto strikt besser/gleich: entweder
der Build läuft nun durch, oder er scheitert klar am Install mit Playwright-
Meldung statt still am Prerender.

### Wie Marvin es lokal sieht
```
cd /Users/marvinallers/code/sva-fussball
git checkout feat/3d-politur
pnpm build           # Chromium liegt im Cache
npx vite preview     # → angezeigter Port
```
- **Finale** (ganz runterscrollen): Vereinsheim rechts liest als Gebäude (E7).
- **Musik/Partyraum** (Station Musik ansteuern): warmer Blende-Übergang statt
  Wand-Barriere (E4), Tür mit Rahmen/Griff/Glas beim Anflug (E6).
- **Tabelle/Sponsoren:** Zaun ruhig, kein Flimmern beim Scrub (E8).
- **Mobil (375px), Station Mannschaft:** inline Karten-Grid, alle 17 Karten
  einzeln lesbar & tappbar (E2). Desktop unverändert (3D-Formation).
Screenshot-Belege liegen unter `screenshots-mann/` (nicht committet, lokal).

### Offen / bewusst nicht angefasst
- **GATE-12 (E4):** Blende-Default gebaut, Frage an Marvin (harter Schnitt vs.
  Blende vs. echte Durchfahrt) — s. ⚠️ oben.
- **Flutlicht-Mast-Köpfe von oben (E9-Teil):** nach dem Dach-Fix akzeptabel,
  bewusst nicht angefasst (Regressions-Risiko in Floodlights.tsx).
- **E3 Kamerafahrt:** wartet weiter auf GATE-11 (Konzept-Freigabe).
- **E5 Spielerfiguren, restliche E9-Kollisionen:** nicht Teil dieser Etappe.
- Vorbestehender `CLUBHOUSE_POS`-Lint (s. ¹).

### Marvins To-dos (diese Etappe)
1. **Preview freigeben/justieren:** die 5 Punkte (Türen, Fassade-Finale, Zaun,
   Party-Blende, Mobile-Karten) auf `vite preview` prüfen.
2. **GATE-12 beantworten:** Party-Übergang — warme Blende ok, oder echte
   Durchfahrt (eigene größere Etappe) gewünscht?
3. Übernahme nach `release` bleibt **Marvins** Entscheidung (Prod ist live).

---

## 3D-Politur Etappe 3 (18.07.2026)

Auftrag: gate-freie Weiterarbeit an der 3D-Politur — den **E9-Kollisions-Sweep
DOM×3D** aus dem Fehlerkatalog abarbeiten, soweit ohne GATE-11/12 baubar.
Additiv auf `feat/3d-politur`, iterativ mit Screenshot-Belegen.

> ## 🚨 NICHTS ÖFFENTLICH GESCHALTET
> - **Kein Push** (weder `release`=Prod noch origin), kein Deploy, kein DNS,
>   kein Launch. Alle Arbeit lokal auf `feat/3d-politur`.
> - **`main` nicht angefasst.** **`src/camera/CameraPath.ts` NICHT geändert**
>   (GATE-11). **Party-/Musikraum-Übergang: Default (b) warme Blende
>   unangetastet** (GATE-12 nicht vorgegriffen). Fake-Kader/Legal-Inhalte
>   unberührt.
> - Preview = lokal: `pnpm build` grün + `vite preview` visuell verifiziert.

### Vorgehen: erst Ist-Stand des BRANCHES verifiziert
Die `audit-screenshots/` sind der **Vor-Politur-Baustand** und wurden mit dem
alten Review-Skript per *Zentrieren* der Sektionen erstellt. Für den aktuellen
Branch habe ich die betroffenen Stationen an ihren **echten Ruhepunkten**
gescreenshottet (`section--snap-start` → `offsetTop`, sonst Mitte; lokal in
`screenshots-e9*`, **nicht committet**). Daraus zwei ehrliche Befunde:

- **H2-unter-Logo (Tabelle/Kontakt) ist am realen Snap-Ruhepunkt NICHT defekt.**
  Der Überlapp im Audit (`desktop-14`, `desktop-16`) war ein **Artefakt der
  Screenshot-Methode**: das alte Skript *zentriert* die Sektion, und weil
  Tabelle/Kontakt höher als der Viewport sind, schob das Zentrieren den
  riesigen Titel nach oben unters Logo. Beim tatsächlichen Snap (Start =
  `offsetTop`, Padding-Top trägt) steht der Kicker sauber unter dem Logo.
  → **Bewusst NICHT „gefixt"** (kein erfundener Fix an einem Nicht-Bug).
- **Fanblock-Kachel-Captions** sind aktuell **nicht** abgeschnitten (2 Zeilen,
  voll lesbar) → nicht angefasst.

### Gebaut (2 reale, aktuelle Kollisionen + 1 Hero-Mitigation)

**E9-1 · Finale: Copyright/Pflicht-Links über 3D-Bodentext** ✅
`src/ui/Sections.tsx`, `src/index.css`. Befund (aktuell, `screenshots-e9/desktop-finale`):
im Finale-Rauszoom liegt der große 3D-Bodentext „Waldsportplatz" **genau unter**
der Impressum/Datenschutz- + Copyright-Zeile (grau auf hellgrau = unlesbar) —
und die **juristisch geforderte Erkennbarkeit** (§ 5 DDG) der Pflicht-Links war
dahin. **Fix:** eigener Lesbarkeits-Träger `.finale-legal` (dezenter dunkler,
weich auslaufender Grund + leichter Blur), Pflicht-Links kontraststärker
(unterstrichen, 0.92 statt 0.75). **Beleg:** `screenshots-e9b/desktop-finale.png`
(Desktop) + `screenshots-e9b-mob/finale.png` (Mobil) — Zeile klar lesbar über
dem Bodentext. Prerender enthält die echten `<a>`-Links weiterhin (kein JS nötig).

**E9-2 · Sponsoren: DOM-Textspalte × 3D-Banden-Text** ✅
`src/ui/Sections.tsx`, `src/index.css`, `src/ui/cards.css`. Befund (aktuell,
`screenshots-e9/desktop-sponsoren`): der 3D-Banden-Text „DIESE BANDE SUCHT DICH /
WERDE SPONSOR" kreuzt diagonal die DOM-Textspalte; Fließtext („…freigelassen.")
und die Pill **„Kein Preisschild — einfach fragen"** verwaschen mit dem
3D-Text. **Fix:** neue Modifier-Klasse `section--scrim-dense` (nur Desktop,
`min-width:641px`) — dichterer, weiter reichender Links-Scrim trägt die
Textspalte (bis ~52 % Breite), ab ~70 % aus → die **rechte Banden-Hälfte bleibt
bewusst voll sichtbar** („schau auf die Bande" bleibt intakt). Zusätzlich
`.sponsor-pill`-Chips deckend (`rgba(12,9,13,0.62)` statt `0.06`). Mobil
unverändert (dort greift der bestehende vertikale Scrim; per Media-Query
abgegrenzt, damit die dichtere Regel nicht in Mobil leakt). **Belege:**
`screenshots-e9b/desktop-sponsoren.png`, `screenshots-e9b-mob/sponsoren.png`.

**E9-3 · Hero-Flutlichtmast: „schwarzer Kasten"** ✅ (Mitigation)
`src/components/Floodlights.tsx`. Befund (aktuell, `screenshots-e9/desktop-01-hero`):
der kamera-nächste Rand-Mast zeigt dem Betrachter die **unbeleuchtete
Gehäuse-Rückseite**, die gegen den Nachthimmel als harter schwarzer Kasten las.
**Fix (isoliert auf das Gehäuse-Material):** Ton `#101014 → #1e1c22` + minimaler
warmer Emissive-Anteil (`#2a2014`, Intensität 0.32) = „Lampen-Spill am eigenen
Gehäuse" → nie mehr reines Schwarz, liest als Struktur. **Panel/Kegel/Glow der
leuchtenden Masten unverändert.** An den lit stations (Tabelle/Finale, wo die
Masten Hintergrund sind) **regressionsfrei verifiziert** (`screenshots-e9c/`).

> ⚠️ **Ehrlich abgegrenzt — NICHT blind ins Kamera-Framing gegriffen:** Der
> **weiße „Tropfen"/Häkchen-Glitch** am linken Rand-Mast ist der **gecroppte
> helle Panel-Front** des nächsten Masts — die Kamera schneidet den Mast so an,
> dass nur der leuchtende Kopf „schwebt". Das ist ein **Framing-Problem** und
> hängt an `CameraPath.ts` = **GATE-11** (nicht angefasst). Ihn ohne Kamera zu
> „beheben" hieße das Panel/Glow **global** zu dimmen → würde die Flutlicht-
> Atmosphäre („Flutlicht an") an allen Stationen beschädigen. Die vorherige
> Etappe hatte Floodlights.tsx aus genau diesem Regressions-Grund gemieden;
> ich habe daher nur den isoliert-sicheren Gehäuse-Ton angehoben.

### Nicht gebaut — bewusst, mit Begründung (kein Blind-Fix)
- **Wappen-in-H1 (Musik):** das 3D-Wappen (Wandschild im Partyraum,
  `PartyRoom.tsx`, Weltposition) ragt am Musik-Kamera-Ruhepunkt in die H1
  „AGA URKNALL". Die H1 selbst bleibt **lesbar** (weiß, fett, Text-Shadow) —
  es ist ein **Kompositions-**, kein Lesbarkeits-Defekt. Es sauber zu lösen
  heißt entweder die Kamera reframen (**GATE-11**, gesperrt) oder das Wandschild
  in der Welt verschieben — was die Partyraum-Innenkomposition über die ganze
  Durchfahrt riskiert. → **Empfehlung: gemeinsam mit der Kamera-Etappe (E3/
  GATE-11) angehen**, nicht blind nudgen.
- **Nav-Konfetti-Punkte (Fanblock):** ein paar rote/weiße Feier-Partikel
  (Meisterfeier-Konfetti) treiben nahe der Nav-Zeile. Sie sind **gewollte
  Atmosphäre**; ein stärkerer Top-Scrim würde global (auch Hero) eingreifen.
  Nutzen/Risiko zu gering → nicht angefasst.
- **H2-unter-Logo:** siehe oben — am realen Ruhepunkt kein Bug.

### Build / Verifikation
| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | **Exit 0** — kein `any`, kein `@ts-ignore` |
| `npx eslint` (geänderte Zeilen) | **sauber** — `Sections.tsx` 0 Probleme (¹) |
| `pnpm build` (inkl. Prerender) | **grün** — „Prerender ok: 33.1 kB Inhalts-DOM" |
| Prod-Preview (`vite preview` auf `dist`) | alle 3 Fixes sichtbar, Desktop+Mobil |

¹ `Floodlights.tsx` trägt weiterhin **2 vorbestehende** `react-hooks/immutability`-
Errors auf den `useFrame`-Mutationen (Z. 148/157) — per `git stash` gegen die
committed HEAD-Version verifiziert: **existierten schon vorher**, nicht von dieser
Etappe (Klasse der im BUILDSPEC dokumentierten Alt-Errors). Meine geänderten
Zeilen (Gehäuse-Material) sind sauber. CSS wird von eslint nicht geprüft.

### Commits (auf `feat/3d-politur`, nach `d0728d0`)
| Commit | Etappe |
|---|---|
| `cbfc222` | **P5-E9** DOM×3D: Finale-Footer-Träger + Sponsoren-Banden-Scrim |
| `2b9cda2` | **P5-E9** Hero-Flutlichtmast-Gehäuse (kein schwarzer Kasten mehr) |

### Wie Marvin es lokal sieht
```
cd /Users/marvinallers/code/sva-fussball
git checkout feat/3d-politur
pnpm build           # Chromium liegt im Cache
npx vite preview     # → angezeigter Port
```
- **Finale** (ganz runterscrollen): Impressum/Datenschutz + Copyright lesbar auf
  eigenem Träger über dem „Waldsportplatz"-Bodentext.
- **Sponsoren:** Fließtext + Pills tragen sauber über der 3D-Bande; Bande rechts
  bleibt sichtbar.
- **Hero:** der rechte Rand-Mast liest als dunkle Struktur statt schwarzer Kasten.
Screenshot-Belege lokal unter `screenshots-e9/` (vorher), `screenshots-e9b/`,
`screenshots-e9b-mob/`, `screenshots-e9c/` (nachher) — **nicht committet**.

### Offen / hängt an Gates
- **GATE-11 (CameraPath):** Hero-Masten-Framing (schwebende Köpfe / weißer
  Tropfen), Reveal-Kamerafahrt (E3), Wappen-in-H1-Framing.
- **GATE-12 (Party-Übergang):** Default (b) warme Blende bleibt (unangetastet).
- **E5 Spielerfiguren:** prozedurale Verfeinerung wäre gate-frei, CC0-Modelle
  nicht (GATE-12-Klasse) — in dieser Etappe nicht begonnen (Fokus E9).

### Marvins To-dos (diese Etappe)
1. **Preview freigeben/justieren:** die 3 E9-Fixes (Finale-Footer, Sponsoren-
   Bande, Hero-Mast) prüfen.
2. **GATE-11:** entscheidet zugleich Hero-Masten-Framing + Wappen-in-H1 (beide
   kamera-/framing-gebunden, bewusst offen gelassen).
3. Übernahme nach `release` bleibt **Marvins** Entscheidung (Prod ist live).

---

## 3D-Politur Etappe 4 — GATE-11 & GATE-12 fertig (feat/3d-politur)

**Branch:** `feat/3d-politur` · **Ausgangspunkt:** WIP `e7f4f09` (Vorgänger starb am
Limit, „mitten in echte Durchfahrt"). Diese Etappe schließt GATE-12 ab und
verifiziert die GATE-11-Reste.

### GATE-12 · echte Durchfahrt (Option c) — FERTIG ✅
`src/camera/partyPath.ts` (Commit `6beed46`), aufbauend auf WIP `e7f4f09`
(Windfang aufgeweitet `OPEN_W 0.2→0.34`, `drive`/`veil`-Schalter in `useStore` +
`PartyDirector`, `?party=drive|veil`).

**Befund (am echten Code/Live gemessen, nicht am Log):** Der Anflug endete bei
`x=6.5` — nur 0.08 hinter der Türebene (6.42), aber **0.22 VOR der Glow-Rückwand**
(6.72). Mit einer eigens instrumentierten Kamera-Auslese (`window.__camdbg`,
danach **wieder entfernt**) an realen Scroll-Positionen belegt: am letzten Außen-
Frame vor dem Welt-Hop füllte die (aufgeweitete) Öffnung erst **~40 % des Bildes**
(rechts, weil links der H1-Raum „AGA URKNALL" steht). Der Welt-Hop war damit ein
**sichtbarer Schnitt**, den im `drive`-Modus nur der dezente 0.34-Schleier deckte —
also faktisch noch „halbe Blende", nicht die versprochene Durchfahrt.

**Fix:** 6. Stützpunkt in `approachPos` (`x≈6.665`, nur ~0.055 vor der Glow-Wand).
Die Kamera **taucht auf den letzten Metern körperlich in den warm glühenden
Windfang** → die Rückwand blüht auf und **füllt das Bild** → der Hop wird jetzt
von **echter Geometrie** verdeckt („durch die Tür ins Licht treten"), nicht mehr
von einer Blende. Belegt (Scroll-getrieben, Kamerapose bestätigt):
- Lead-in bleibt weich: `x 6.16 → 6.65` über `p 0.30..0.47` — **kein Lunge**,
  kein Clipping (Near-Plane im Fenster `pp∈(0.3,0.55)` bereits auf 0.045 gesenkt).
- Letzter Außen-Frame: **voller warmer Glow-Wash** statt 40%-Tür rechts.
- In der **Prod-Preview** (`vite preview` auf `dist`) verifiziert: Anflug → Glow-
  Bloom → Hop → Innenraum-Totale läuft sauber durch (Screenshots lokal, **nicht
  committet**).

**(b) warme Blende bleibt als Fallback/Schalter:** `?party=veil` deckt den Hop
weiterhin klassisch mit fast deckendem 0.97-Schleier — von der tieferen Durchfahrt
**unberührt** (verifiziert). Marvin kann `drive` (Default) vs `veil` direkt
vergleichen.

### GATE-11 · Reste — verifiziert
- **Reveal-Kamerafahrt (E3):** bereits `2316027` — nicht erneut angefasst.
- **Wappen-in-H1:** im WIP `e7f4f09` gelöst (Wandschild `z 0.5→1.25`, `y 1.06→1.0`).
  Am gesettelten Musik-Ruhepunkt verifiziert: **H1 sitzt sauber auf dunklem Raum,
  kein Schild mehr dahinter** (Beleg lokal `screenshots-g11/party-settled.png`).
- **Hero-Masten-Framing:** am Hero-Ruhepunkt geprüft — Masten sind sauber
  gerahmt, **kein „weißer Tropfen"-Glitch** sichtbar (`screenshots-g11/hero.png`).
  Bewusst **NICHT** ins `CameraPath`-Hero-Framing gegriffen: der Vorgänger hatte
  dokumentiert, dass ein „Fix" die Flutlicht-Atmosphäre **global** riskiert; die
  aktuelle Rahmung ist tragfähig → subjektive Feinjustage bleibt Marvins Call.

### Gate-freie 3D-Politur — bewusst nichts Neues geöffnet
Einziger real dokumentierter gate-freier Rest ist **E5 (prozedurale Spielerfiguren-
Verfeinerung)** — eine **spekulative Aufwertung, kein belegter Defekt**, unbegrenzt
im Umfang und regressionsanfällig. Kein Blind-Aufmachen (kein Gold-Plating).

### Build / Verifikation
| Prüfung | Ergebnis |
|---|---|
| `npx tsc -b` | **Exit 0** — kein `any`, kein `@ts-ignore` |
| `npx eslint src/camera/partyPath.ts` | **sauber** (Exit 0) |
| `pnpm build` (inkl. Prerender) | **grün** — „Prerender ok: 33.1 kB Inhalts-DOM" |
| Prod-Preview (`vite preview` auf `dist`) | Durchfahrt `drive` + `veil` sichtbar |

### Commits (auf `feat/3d-politur`, nach `e7f4f09`)
| Commit | Etappe |
|---|---|
| `6beed46` | **P5-E4/GATE-12** echte Durchfahrt (Option c) — Kamera taucht in den Windfang |

### ⏳ WARTET AUF MARVIN
1. **Review Kamera + Party `drive` vs `veil`** in Bewegung (nicht nur Stills):
   `drive` (Default) = Glow-Bloom trägt den Hop · `veil` (`?party=veil`) = warme
   Blende. Feinjustage Peak/Falloff bzw. Tauchtiefe `x=6.665` nach Geschmack.
2. **Hero-Masten-Framing:** falls gewünscht, gemeinsam am `CameraPath`-Hero-Beat
   nachjustieren (bewusst nicht blind angefasst — Flutlicht-Regressionsrisiko).
3. **Merge nach `release`** bleibt **Marvins** Entscheidung (Prod ist live; kein
   Push/Deploy von mir, gemäß Grenzen).

### Wie Marvin es lokal sieht
```
cd /Users/marvinallers/code/sva-fussball
git checkout feat/3d-politur
pnpm build && npx vite preview     # → angezeigter Port
# Musik-Sektion runterscrollen: Anflug → in den Windfang tauchen (Glow füllt
# das Bild) → Innenraum. Vergleich:  …/            (drive, Default)
#                                    …/?party=veil  (warme Blende)
```
