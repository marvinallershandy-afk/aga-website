# BUILD_LOG v25 — Audit-Befunde zur Note 1+ (SV Agathenburg-Dollern)

Branch: `worktree-agent-adad2690c502d5df9` (Basis v14-premium). Alles committet, Working Tree clean.
Quelle: `AUDIT_V25_ERLEBNIS.md` + zwei Präzisierungen des Koordinators zu Teil D (Check-in-Highlight).
Parallelarbeit v24 (Pack-System) NICHT angefasst: `src/album/PackOpening.tsx`, Pack-Gutschrift-SQL,
„Ins Album“-Knopf in /tippen, Migration `20261017100000`. Meine Migrationen beginnen bei `20261018100000`.

## Verifikation (Belege)
- `tsc -b`: 0 Fehler (nach jedem Paket geprüft).
- `pnpm build`: grün (inkl. Prerender) — mit den Dependency-Bumps.
- PGlite-Tests: **25/25 grün, 0 Fehler** (Runner über alle `supabase/tests/*.test.mjs` außer den
  5 reinen Node-Modul-Tests fupa_live_map/abgleich/tabelle_live/fupa_map/fupa_squad_map, die ich
  nicht verändert habe). Darunter neu: `tipp_auto_wertung` (37), `checkin_rotation` (30); unverändert
  grün: `tippliga` (181), `tippliga_v21` (48), `tippliga_v22` (52), `album`, `karten`, `live_v23` …
- Browser: Chromium (angle/metal) + WebKit, 390×844 und 1440×900.
  - CSP: alle Routen (/, /live, /tippen, /album, /partner, /galerie, /admin, Rechtsseiten)
    durchgeklickt — **0 echte Verstöße** (nur WebKits report-only-Hinweis zu `frame-ancestors`,
    der beim Scharfschalten entfällt; der „Supabase-Env fehlt“-Fehler auf /admin ist ein lokales
    Build-Artefakt ohne gesetzte Env, kein CSP-Thema). → Header von Report-Only auf scharf umgestellt.
  - Screenshots (lokal unter `audit-v25/fix/`, nicht committet): Startseite + Mobile-Dock (Befund 14),
    alle Routen unter scharfer CSP, Neulings-Landing `/album?ci=&rc=` (Chromium+WebKit), iPad-Bühne
    quer 1180×820 + hoch 820×1180 (Chromium+WebKit, über DEV-Preview mit gemockter DB).
- Kein Schreiben in die echte DB, kein Deploy, keine Konten.

## Angewandte Migrationen (neu)
1. `20261018100000_sva_tipp_auto_wertung.sql` — Auto-Wertung (Kern, Auto-Bericht, Tick, Status-RPC).
2. `20261018110000_sva_tipp_auto_wertung_cron.sql` — pg_cron alle 10 min (SQL-only, PGlite-sicher).
3. `20261018120000_sva_rls_initplan_fk_indizes.sql` — RLS `auth.uid()`→`(select auth.uid())` (7 Tipp-Policies), FK-Deck-Indizes.
4. `20261018130000_sva_checkin_rotation.sql` — rotierender Check-in-Code, Vormerken, Einlösen.

## Neue Netlify Function / Edge
- `netlify/functions/live.mts` → `/api/live` (CDN-Cache vor der DB).
- Edge Functions unverändert im Vertrag, aber: konstant-zeitlicher Cron-Secret-Vergleich in
  `backup`, `fupa-sync`, `fupa-live`.
- `supabase/config.toml` neu (verify_jwt je Function).

## Neue Admin-Seite
- `src/admin/pages/CheckinAnzeige.tsx` (+ `checkin-anzeige.css`), Route `/admin/checkin-anzeige`.

---

## A) Erlebnis P0+P1 — erledigt

| Befund | Umsetzung | Datei(en) |
|---|---|---|
| 1 | Offener Tipp gewinnt vor „Abpfiff · Wertung folgt“; Doppelbox weg, altes Spiel nur Nebenzeile | `tippen/NaechsterSchritt.tsx`, `SpieltagTab.tsx`, `tippen.css` |
| 3 | /live-Teaser aus `ALBUM_LINK.belohnung` (club.ts) → „Getränk nach Wahl“, nie „Freibier“ | `live/LiveApp.tsx`, `data/club.ts` |
| 4 | /live-Kopf + Tab-Leiste opak (z-index über dem Pitch) | `live/live.css` |
| 5 | Eine zustandsabhängige Quellenzeile; Vorführung „Text: Vorführung“ statt „via FuPa“ | `live/saetze.ts`, `LiveApp.tsx` |
| 6 | Aufstellungs-Label nach Status: Voraussichtliche Elf / Startelf / Aufstellung · n Wechsel | `live/aufstellung/TvAufstellung.tsx` |
| 8 | Album-Einführung `user-select:none` + Wischen blättert | `album/Einfuehrung.tsx`, `einfuehrung.css` |
| 11 | Kapitän „+13 ×2 = +26“ | `tippen/Aufloesung.tsx`, `tippen.css` |
| 12 | Kurzname statt 3er-Kürzel im Abgabe-Knopf | `tippen/model.ts`, `TippFormular.tsx` |
| 13 | Tipp-Zähler erst ab 10, sonst „Sei einer der Ersten“ | `tippen/SpieltagTab.tsx` |
| 14 | Mitspielen = neutraler Tab (roter CTA bleibt in der Kachel) | `map/MapView.tsx` |
| 15 | Rundgang-Finale: scroll-padding (Titel/Back-Knopf frei) | `ui/Sections.tsx`, `index.css` |
| 16 | „Tippen zum Aufschlagen“ klickbar (gleicher onClick wie Cover) | `album/AlbumApp.tsx`, `album.css` |
| 17 | Desktop-Abgabepanel andocken (nicht überlagern) + Live-Leiste-Platz | `tippen/tippen.css` |
| 18 | Vorführ-Pill klappt beim Scrollen ein; Packs-Sticky endet über der Fußzeile | `album/vorfuehrung/Steuerleiste.tsx`, `AlbumApp.tsx`, CSS |
| 20 | Live-Tabelle: Badge „Stand vor diesem Spieltag“ + Link zur Live-Tabelle; Quellen vereinheitlicht | `live/LiveTabelle.tsx`, `live.css` |
| Idee S | Rang-Film nach Wertung (Platz X→Y, +Δ, noch N bis Platz 3) | `tippen/SpieltagTab.tsx`, `tippen.css` |
| Idee S | Joker „×2 aktiv“ pulsierend in der Live-Leiste | `ui/tor/LiveLeiste.tsx`, `TippApp.tsx`, `tor.css` |

## B) Auto-Wertung „Auflösung am selben Abend“ — erledigt
- Kern `_sva_tipp_werten_kern(uuid, text)` aus `tipp_admin_werten` ausgelagert (ohne Admin-Prüfung,
  nur service_role/cron; Admin-RPC delegiert nach Prüfung).
- `_sva_tipp_auto_bericht(uuid)` baut den Bericht aus dem Ticker (Einsätze/Tore/Vorlagen/Karten/Zu-null),
  sichert das Ergebnis aus dem Live-Stand, füllt Auflösung + ersten Torschützen automatisch (nur leere Felder).
- `sva_tipp_auto_tick()` (Cron, alle 10 min): wertet Pflichtspiele (`sva_tipp_wertung='saison'`, schließt
  Demo + Testspiele aus), die **seit ≥ 30 min beendet** sind (Abpfiff-Ticker-Zeit bzw. Anstoß+2 h), und
  markiert sie **vorläufig** (bis MOTM). **0-Tipp-Spiele** werden ebenfalls gewertet → /tippen schaltet weiter.
  Nachwertung bei `bericht_at > gewertet_at` (MOTM-Eintrag oder Bericht-Korrektur), idempotent.
- Admin-Schalter „Automatisch werten“ (Standard an) in Album→… nein: **Tipp-Liga → Kabine & Regeln**
  (`sva_tipp_einstellungen.auto_wertung`). Manuelles „Werten“ übernimmt (`auto_gewertet=false`).
- Admin-Übersicht: roter Banner „Spieltag X ungewertet seit N Std“ + Zeile „vorläufig — MOTM fehlt“
  (`tipp_admin_wertung_status()` → `admin/pages/Uebersicht.tsx`).
- PGlite-Test `tipp_auto_wertung.test.mjs` (37 Prüfungen).

## C) Sicherheit/Technik — erledigt
- `react-router-dom` ^7.18.2 (→ 7.18.4), `fflate` <0.6.11 → ^0.6.11 (pnpm-Override, nur three-stdlib
  betroffen; `@react-three/drei` bleibt auf 0.8.3). `pnpm build` grün.
- `supabase/config.toml`: `verify_jwt=false` für kalender/backup/fupa-sync/fupa-live; `true` (explizit)
  für publish-site/drive-bridge/tabelle-aus-bild.
- Konstant-zeitlicher Cron-Secret-Vergleich (SHA-256 + Byte-XOR) in backup/fupa-sync/fupa-live.
- Migration `20261018120000`: 7 Tipp-SELECT-Policies auf `(select auth.uid())` (auth_rls_initplan);
  FK-Deck-Indizes über DO-Block für `sva_ticker`, `sva_tipp_*`, `sva_album_*`, `sm_spiele` — robust:
  liest FK-Spalten aus `pg_constraint`, überspringt noch nicht existierende Tabellen (parallel entstehendes
  v24-Album-Pack-System) und bereits gedeckte FKs. `matches`/`match_events`/`match_current_score`
  bewusst nicht angefasst; `sme_members` (Fremd-App) ebenfalls nicht.
- `/api/live`: Netlify Function ruft `web_live()` mit Anon-Key, `Netlify-CDN-Cache-Control:
  public, s-maxage=10, stale-while-revalidate=20`; Rewrite vor dem 404-Catch-all. `/live` + `/tippen`
  pollen darüber (`src/live/api.ts fetchLive`) mit Fallback auf den direkten RPC; Vorführung unverändert.
- CSP scharf geschaltet (siehe Verifikation oben).

## D) Check-in-Highlight — erledigt
- **Rotation**: Code wechselt alle N Minuten (Einstellung 1–10, Standard 3), Server akzeptiert aktuelles
  **± 1** Intervall; statischer QR bleibt Notfall-Fallback. Standard AN. Zeitbasiert aus dem geheimen
  Spiel-Token (md5, kein pgcrypto nötig). `album_checkin_code` liefert Team/Admin den aktuellen Code
  **plus die Codes der nächsten 2 h** (Offline-Puffer). `album_checkin_rot` ruft intern das bestehende
  `album_checkin` (Pack-Gutschrift v24 NICHT angefasst).
- **iPad-Bühne** `/admin/checkin-anzeige` (ohne Admin-Layout): großer QR in edlem Rahmen mit rotem
  Countdown-Ring + weichem Wechsel, Ken-Burns-Spielerbilder (nur CSS-Transforms), Spieltags-Kopf
  (SVA–Gegner, Anstoß bzw. Live-Stand aus `/api/live`), Zeile „Scannen · Pack holen · mitmachen“,
  Live-Zähler „heute schon X eingecheckt“ + Fortschritt zur 1. Belohnung, Screen Wake Lock, Offline-Punkt,
  Ausstieg nur per langem Druck. Quer **und** hoch (Screenshots belegt). Schalter in Tipp-Liga? nein:
  **Admin → Album → Regeln** (Rotation an/aus + Intervall + „Check-in-Anzeige öffnen“).
- **Neulings-Landing** `/album?ci=<spiel>&rc=<code>`: barrierearm (große Schrift ≥18px, hoher Kontrast,
  Panini-Sprache „Sammelkarten wie früher Panini — kostenlos, nur fürs Dabeisein“, Schritt 1/2/3,
  ein Schritt pro Bildschirm, große Knöpfe, 3 Nutzen-Punkte, Belohnungen ab 3./6. Besuch). OTP (Code aus
  der Mail) bleibt im selben Browser; Magic-Link geht auch.
- **Check-in überlebt den Login im fremden Browser**: Bei E-Mail-Eingabe wird der Check-in SERVERSEITIG
  für die E-Mail vorgemerkt (`album_checkin_vormerken`, anon, 30 min ab Scan, nur mit gültigem
  Rotationscode, Flutschutz). Nach JEDEM Login löst `album_checkin_offen_einloesen()` die Vormerkung ein
  (checkt ein + Pack). Rotations-Absicht (ci/rc) wird zusätzlich in sessionStorage für den Magic-Link-
  Rücksprung gehalten.
- **Moment-abhängiger nächster Schritt** nach dem Check-in: vor Anpfiff „Tipp fürs Spiel gleich abgeben —
  noch X Min“ (→ /tippen), live „Live mitverfolgen & mitjubeln“ (→ /live), nach Abpfiff „Schau dir deine
  Ziele an / nächstes Spiel tippen“. Status aus `/api/live` mit Anstoß-Heuristik-Fallback.
- PGlite-Test `checkin_rotation.test.mjs` (30 Prüfungen: Rotation ±1, 2-h-Vorschau, Vormerken,
  Einlösen „anderer Browser“, 30-min-Frist, kein Doppel-Check-in, Rechte).

---

## Offene Punkte (mit Grund)
- **I12 (Hinspiel/Form-Kontext im Tippschein)**: NICHT umgesetzt — die Daten liegen heute nicht im
  `tipp_lage()`-Payload / in `TippSpiel`. Das Audit nennt es ausdrücklich „wenn Daten vorhanden“.
  Nächster Schritt wäre, `tipp_lage()` um Hinspiel-Ergebnis + Form (letzte 5) zu erweitern (Backend-Feld),
  dann im Tippschein anzeigen. Bewusst nicht in dieser Runde, um die große `tipp_lage`-RPC nicht zu riskieren.
- **Befund 9 (TOR!-Jubel-Pose), 10 (Rundgang-Rohbau-Frames), 7 (Album-Desktop-Schaufenster)**: im Audit
  als P2/P3 eingestuft (Assets/Kamerapfad/Design-Ausbau), nicht Teil von P0/P1 — bewusst außerhalb dieser Runde.
- Screenshots `audit-v25/fix/` sind absichtlich NICHT committet (wie die Audit-Konvention; via
  `.git/info/exclude`).

## Marvins To-dos (Scharfschalten)
1. Migrationen in Reihenfolge anwenden: `20261018100000` → `…110000` → `…120000` → `…130000`
   (nach dem v24-Pack-System `20261017100000`).
2. **pg_cron** im Supabase-Dashboard aktiv? Dann wertet `sva_tipp_auto_tick()` automatisch (alle 10 min).
   Abschalten pro Betrieb: Admin → Tipp-Liga → Kabine & Regeln → „Automatisch werten“ aus,
   oder `update sva_tipp_einstellungen set auto_wertung=false;`.
3. Edge Functions neu deployen (konstant-zeitlicher Vergleich): `backup`, `fupa-sync`, `fupa-live`
   weiterhin mit `--no-verify-jwt` (jetzt auch in `config.toml` hinterlegt).
4. Netlify deployen: neuer `/api/live`-Rewrite + Function; CSP ist jetzt **scharf** — bitte nach dem
   ersten Deploy einmal real durch alle Seiten klicken (sollte, wie lokal belegt, 0 Verstöße zeigen).
5. Check-in-Rotation: Standard AN. Für jedes Heimspiel wie bisher einmal den QR-Token anlegen
   (Admin → Album → Spieltage) — der rotierende Code leitet sich daraus ab. Am Eingang:
   Admin → Album → Regeln → „Check-in-Anzeige öffnen“ auf dem iPad, „Geführter Zugriff“ + „Automatische
   Sperre: Nie“ einstellen (Wake Lock greift zusätzlich).
6. Supabase → Authentication → Redirect URLs: `/album*` deckt die Check-in-Landing bereits ab (ci/rc sind Query-Parameter).
