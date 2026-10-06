# BUILD_LOG v26 — Album-Runde (Ziele 69, Kabinen-Kult, Fan-Barometer, Endgame)

**Branch/Worktree:** `agent-a148f90464a5d427e` (Basis `v14-premium` @ 83b2ea8, enthält v24+v25).
**Spec:** `BUILDSPEC_V26_ALBUM.md`, Reihenfolge Z1 → Z2 → K → B → E → S (alle gebaut).
**Stand:** alle 28 PGlite-Migrationstests grün · `tsc -b` 0 Fehler · `vite build` grün ·
Simulation läuft · Screenshots (WebKit 390×844 + Chromium/Desktop 1440×900) + Perf erzeugt.
**Nicht deployt, keine echte DB berührt, keine Konten.** Working Tree clean, 9 Commits (s. u.).

## Migrationen (ab 20261021100000, nach allen vorhandenen)
| Datei | Paket | Inhalt |
|---|---|---|
| `20261021100000_sva_album_v26_ziele.sql` | Z1 | Ziel-Schema (kategorie/hinweis/bedingung/belohnung_kult), Typen bestand/woche/monat, Prüf-Logik, Tipp-Hooks, **Hotfix §0.4** (`tipp_kapitaen_trifft`), Katalog 68, album_mein (geheimZiele), Statistik |
| `20261021110000_sva_album_v26_kult.sql` | K | Kult-Spalten + Constraint, Kult-Slot im Spieltags-Pack, belohnung_kult, `album_admin_kult_karte`/`_schalten`, Pejas-Platzhalter + `pejas_kollektion` (Katalog → 69), Katalog/Statistik |
| `20261021120000_sva_album_v26_barometer.sql` | B | Barometer-Spalten, `album_barometer` (anon), Verteilung im Check-in-Kern (Event-Pack idempotent), `album_admin_barometer` (Vorschlag ×1,15), Statistik |
| `20261021130000_sva_album_v26_endgame.sql` | E | `sva_album_wall_of_fame`, Wall-Eintrag bei `meilenstein_100`, `album_wall_optin`, `album_wall_of_fame` (anon), album_mein (komplett), Statistik komplettFans |
| `20261021140000_sva_album_v26_bilder.sql` | K-Content | `album_admin_kult_standard()`: 9 aktive Kabinen-Kult + 16 inaktiver Monats-Moment-Pool (I11) — Admin-RPC, **nicht** beim Migrieren geseedet (sonst zählen Tests mit) |
| `20261021150000_sva_album_v26_barometer_neutral.sql` | G6 | `sva_album_barometer_pack`: album-neutrales Gemeinschafts-Pack (Silber-Glanz/Kult/Wochenkarte, sonst Lose); `sva_album_barometer_verteilen` neu gefasst |

## Erledigt je Paket
- **Z1 🔴** Ziel-Maschine (bestand/woche/monat mit Perioden-Bezug), 68-Katalog, Tipp-Hooks
  (`elf_aufgestellt`, `tipp_bonus_perfekt`, `tipp_erster_torschuetze`, `tipp_hellseher`). **Hotfix
  §0.4 behoben + Durchstich-Test** (`tipp_admin_werten` vergibt `tipp_kapitaen_trifft` wirklich,
  `album_v26.test.mjs`). `album_mein.geheimZiele` nur id+hinweis (R4-Wächter grün).
- **Z2 🔴** Eigene Ziele-Seite im Heft: großer Ring, Filter-Chips (role=tablist/aria-pressed),
  fast-geschafft-Sortierung (offene Periode oben), ???-Geheimkacheln, „Top 3"-Teaser auf Sammeln.
  Shots ohne DB-Anfrage, Perf Ziele-Scroll **p95 17,4 ms** (Budget ≤ 18,4; 2/146 Startframes >34 ms).
- **K** Kabinen-Kult: DB-Infrastruktur, Kult-Slot (25 %, nur fehlende), Ziel-Belohnung Kult,
  Admin „Neue Kult-Karte" (Pflicht-Haken „Spieler hat zugestimmt"), Pejas 4 Platzhalter (aktiv=false),
  Kult-Optik in `SvaKarte` (Spind-Grau, Gaffer-Sticker, KULT-Tag, Polaroid), Heft-Kult-Seite,
  Labor-Filter, zählt nie fürs Album (model.ts). 9 Bild-Kult-Karten + 16 Moment-Pool angelegt.
- **B** Fan-Barometer: anon `album_barometer`, Event-Pack idempotent für alle Eingecheckten,
  späte Check-ins direkt, Admin-Steuerung (WocheTab, Vorschlag + Story-Bild), Balken in Album
  (Start + Check-in-Banner) und Live-Ticker; unter Schwelle 5 „Es geht los …".
- **E** Goldene Seite bei 100 % (Präge-Animation, Teilen, Opt-in) + öffentliche Wall of Fame
  (Opt-in/anonym, Name-Snapshot überlebt Konto-Löschung), `storyKomplett`-Export.
- **S** Simulation v24+v26 (Ziele/Kult/Barometer), 10 000-Läufe-Abnahmeband, Doku
  (KARTEN.md/ALBUM.md/RUNBOOK.md). **Hebel 1 angewandt** (neue Sets + glanz_5/bonus_seite_5/
  tausch_3/freunde_3 → Lose) synchron in Migration + Sim.

## Simulationsergebnis (10 000 Läufe, nach G6 = album-neutrales Barometer)
| Persona | Ø Album % | komplett % | Ø fertig | Ø Ziele | Ø Kult |
|---|---|---|---|---|---|
| Gelegenheits-Follower | 58,6 | 0,0 % | Mai | 21,3 | 1,3 |
| Typischer Follower | 67,8 | 0,6 % | Mai | 26,3 | 2,1 |
| Stammfan | 99,6 | **94,3 %** | **April** | 52,3 | 5,3 |

Band: Stammfan 80–95 % ✓ · Ø April ✓ · Kult ~4–5 ✓ · Gelegenheits-Follower 55–70 % + ≥ 8 Ziele ✓ ·
Typischer Follower ≥ 15 Ziele ✓. ⚠ Typischer Follower Album **67,8 %** knapp unter 70 % (Nebeneffekt
des album-neutralen Barometers; bewusst in Kauf genommen — Gelegenheits- und Stammfan solide im Band).

## Entschiedene Gates
- **G6 (Ökonomie) — ✅ ENTSCHIEDEN (Leitstand 06.10.) + UMGESETZT:** Barometer-Belohnung **album-
  neutral** statt Band weiten. Neue Migration `20261021150000_sva_album_v26_barometer_neutral.sql`:
  `sva_album_barometer_pack` zieht das Gemeinschafts-Pack (3 Karten, Titel „Gemeinschafts-Pack") nur
  aus Silber-Glanz-Varianten, aktiven Kabinen-Kult-Karten (ohne Doppelte) und der ziehbaren
  Wochenkarte (MOTM/Derby, Event-Chance); leere Quelle → Los. Ergebnis: Stammfan zurück im Band
  (vorher 97,5 %/März → **94,3 %/April**). `album_v26.test.mjs` prüft die Album-Neutralität.

## Offene Gates für Marvin
- **G2 (Einverständnis/Namen Pejas + Kabinen-Kult-Zuordnung):** Pejas-Kollektion liegt als 4
  **inaktive** Platzhalter bereit (Namen/Einverständnis von Elias Pejas offen). Die 9 Kabinen-Kult-
  Karten sind aktiv **ohne** Spielerzuordnung (Marvins Freigabe 06.10.); Namen trägt Marvin im Admin
  nach. Constraint lässt inaktive Kult-Karten ohne Einverständnis zu, Aktivierung erzwingt den Haken.
- **G8 (Titel-Abnahme Zielkatalog):** Titel sind Vorschläge — bitte drüberlesen (Migration = Quelle).

## Marvins To-dos (nach Merge/Deploy)
1. (G6 ist entschieden + umgesetzt — Barometer album-neutral; nur zur Info: Typischer Follower
   landet dadurch bei ~68 % statt ~71 %. Bei Bedarf eine Follower-freundliche Mini-Kompensation,
   sonst so lassen.)
2. `album_admin_katalog_standard()` + `album_admin_ziele_standard()` + `album_admin_kult_standard()`
   im Admin **einmal** ausführen (seedet Katalog, 69 Ziele, Kult-Startbestand/Moment-Pool).
3. Pejas-Kollektion: Einverständnis klären, dann im Admin aktiv schalten (Haken).
4. Kabinen-Kult: echte Spieler den 9 Karten zuordnen (Admin), Titel/Anekdoten feinschleifen.
5. Sonntags: Fan-Barometer fürs nächste Heimspiel setzen (WocheTab, Vorschlag übernehmen).
6. Draft-Deploy-Smoke: `/album` (Ziele, Kult-Seite, Wall), `/live` (Barometer), Admin (Ziele 69,
   Kult-Anlage, Barometer-Feld). `/live`-Barometer in dieser lokalen Umgebung nicht prüfbar
   (Live-Ticker nicht konfiguriert) — Komponente ist identisch zur verifizierten Album-Variante.

## Bild-Auswahl (A-kabinen-kult / C-action / D-momente / E-stimmung)
Schärfeprüfung (Laplacian-Varianz auf Motivbereich, PIL/numpy) + Sichtprüfung je Kontaktbogen;
Verkleinerung ≤ 1600px/webp (`scripts/kult-bilder.mjs`), Credit „picture by Nele".
- **Kabinen-Kult (9 aktiv):** Bromance, Der Pokalträger, Der Freudenhaufen, Alle drauf!, Der Krampf,
  Der Salto, Trikot hoch, König der Latte, Psst! → `public/album/karten/kult/`.
- **Monats-Moment-Pool (16 inaktiv):** 8 Action (C) + 8 Momente (D) → `public/album/karten/moment-pool/`.
- **Stimmung (6):** fahne-tor, fahne-zaun, kreis-abend, pokal, anzeigetafel, flutlicht →
  `public/stimmung/` **und** `public/checkin/stimmung/` (keine erkennbaren Kinder; Marvin-Vorgabe).
  CheckinAnzeige.tsx/checkin-anzeige.css **nicht angefasst** (anderer Agent).
- **Ausgeschlossen:** unscharfe/dunkle/ferne Motive (z. B. ahl_022/024, pokal1_007, gross_005) sowie
  Bilder mit Fokus auf Bechern. Jubel-Freisteller (B-jubel) **nicht verbaut** — Notiz für Greenscreen:
  Kandidaten in `~/Desktop/SVA-Auswahl/B-jubel` für den späteren Freisteller-Schritt vorgemerkt.

## Visuelle Follow-ups (bewusst 1. Fassung, keine offenen Bugs)
- Kult-Reveal nutzt die bestehende Reveal-Bühne mit Kult-Optik; der elaborierte „Spind-Reveal"
  (Tür/Lüftungsschlitze/Polaroid-Blitz als eigene Animation) ist als Design-Feinschliff offen.
- Canvas-Parität (Story-Export) der Kult-Karte zeigt den KULT-Rahmen; pixelgenaue Deckung mit der
  DOM-Karte wäre ein weiterer Feinschliff.

## Commits
`v26-Z1` · `v26-Z2` · `v26-K (DB+Daten)` · `v26-K (Frontend)` · `v26-B (DB)` · `v26-B (UI)` ·
`v26-E (DB)` · `v26-E (UI)` · `v26-S`.
