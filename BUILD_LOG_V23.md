# BUILD_LOG v23-L — Live-Backend, FuPa-Bot, Reaktionen, Konferenz

**Branch:** `v23-live-backend` (ab `v14-premium` 107faa6) · **Stand:** 06.10.2026
**Umfang:** Backend/Daten/Admin aus `BUILDSPEC_LIVE_V23.md`. **Nicht** gebaut: öffentliche
Oberfläche von `/live` und `/tippen` (`src/live/*`, `src/tippen/*` — Parallel-/UI-Runde).
**Nicht** gepusht, gemergt, deployt; **nichts** in die echte DB geschrieben; Modus bleibt `aus`.

## Was gebaut wurde

### P1 — Migration `supabase/migrations/20261015100000_sva_live_v23.sql`
- `sva_settings`: `fupa_live_modus` (Default `aus`) mit Wächter-Trigger (an nur mit Erlaubnis-Notiz, nur Admin), `fupa_erlaubnis_notiz/_datum/_art`, `fupa_texte_autoren`, `konferenz_an`, `reaktionen_an`.
- `sm_spiele`: `fupa_*`-Felder + Funktion `sva_live_quelle()`; Team-Wächter erweitert (Team darf `live_quelle`, keine `fupa_*`).
- `sva_ticker`: `quelle/versteckt/duplikat_von/gesperrt/platzhalter/text_quelle/fupa_name(+_2)/team`, Typen `elfmeter_verschossen`/`wechsel_gegner`, Hand-Schutz-Trigger (Edit → gesperrt; Delete durch authenticated → versteckt+gesperrt; service_role frei), Status/Stand-Ableitung zählt nur sichtbare Zeilen.
- `sm_roster.fupa_spieler_id`; neue Tabellen `sva_konferenz`, `sva_fupa_aufstellung`, `sva_reaktion`, `sva_reaktion_summe` (RLS an, kein direkter anon/authenticated-Zugriff).
- RPCs: `sva_fupa_ticker_anwenden` (nur service_role), `sva_reagieren` / `sva_meine_reaktionen` / `sva_reaktion_verdichten`, `tipp_live_kurz` (anon), `sva_admin_live_status` / `sva_admin_live_quelle`, `sva_admin_fupa_kandidaten` / `sva_admin_fupa_zuordnung` / `sva_name_norm`, `tipp_admin_fupa_vorschlag`, **`web_live()` v2** (über `sva_live_daten` — Quelle, Reaktionen, Konferenz, Tipp-Kurz; Demo-Trennung + Partner bleiben).

### P2 — Reine Module `supabase/functions/fupa-live/`
`live_map.mjs` (FuPa-Stream → Ticker, Eigentor/Stand-Regel, Reporter-Text nur mit Freigabe, synthetischer Zeitpunkt, Aufstellung ohne birthday/image), `abgleich.mjs` (Dedupe gegen Pult, Hand-Schutz, Platzhalter), `tabelle_live.mjs` (+ `stimmtMitFupa`). Fixtures: `supabase/tests/fixtures/fupa_live/real/` (einmalig abgerufenes, bereinigtes SVA-Spiel Deinste 04.10.).

### P3 — Edge Function `supabase/functions/fupa-live/index.ts` + Cron
Modus-aus-Guard zuerst (0 FuPa-Abrufe bei `aus`), Cron-Secret ODER Admin-JWT, Aufgaben `spiel`/`konferenz`, 403/429 → 15 min Pause, Logging nur bei Änderung/Fehler. Cron-Migration `20261015110000_sva_live_v23_cron.sql` (SQL-Fensterprüfung, `pg_net`-Aufruf, tägliche Verdichtung) — PGlite-sicher (Extensions/Schedule in Exception-Blöcken).

### P4 — Admin
- **Verein & Links:** Abschnitt „Live-Daten von FuPa" (Erlaubnis-Formular, Schalter „Bot aktiv" nur mit Notiz, Reporter-IDs, Konferenz/Reaktionen).
- **Ticker-Pult:** Komponente `LiveBotStatus` (Quelle Auto/FuPa/Selbst tickern, Status grün/gelb/rot, rotes „FuPa schweigt"-Banner, Stand-Abweichung, „Jetzt abrufen"), Bot-Zeilen mit „FuPa"-Etikett/Schloss, versteckte Duplikate eingeklappt, Platzhalter „(Torschütze folgt)".
- `database.types.ts` von Hand um die neuen Spalten/RPCs ergänzt (bis zur Neu-Generierung nach der Migration). `src/live/model.ts` **nicht** angefasst.

### P7 — Spielbericht-Vorbefüllung
RPC `tipp_admin_fupa_vorschlag(spiel)` (Minuten/Tore/Vorlagen/Start je Kader-Spieler aus der FuPa-Aufstellung). Die große `tipp_admin_bericht` bleibt unverändert. Admin-Knopf dazu: UI-Runde.

### P9 — Doku/Recht
`docs/SPIELTAG.md` (Teil A „Wenn FuPa tickert" + Teil B „einschalten"), neu `docs/LIVE_BOT.md`, `docs/TIPPLIGA.md` (Live im Echtbetrieb), `public/datenschutz.html` (5a Reaktionen + 5b FuPa-Quelle, TODO-JURIST), `docs/RECHT_OFFEN.md` (FuPa-Zustimmung, Reporter-Einwilligung, Reaktionen).

## Tests (alle grün, ohne FuPa-Netz)
- Node-Module: `fupa_live_map`, `fupa_live_abgleich`, `tabelle_live` — grün.
- PGlite: `live_v23.test.mjs` (Erlaubnis-Gate, Bot-RPC nur service_role, Dedupe, Hand-Schutz Edit/Delete, Reaktionen inkl. Limit 30/Demo-Verbot/Konto-Kaskade/Verdichtung, web_live v2, tipp_live_kurz vor/nach Tippschluss + Demo-Ausschluss, Konferenz-Frische, Rollen) — grün.
- **Regression:** alle 20 bestehenden PGlite/Node-Tests grün (inkl. Cron-Migration im Glob). `demo.test` Baseline für die additiven web_live-v2-Felder aktualisiert (ZEIT-Ignore-Menge).
- Migration zweimal hintereinander fehlerfrei (Idempotenz) im `live_v23`-Test.
- `tsc -b`: 0 Fehler. `deno lint` der Function: nur die üblichen jsr-Import-Hinweise (identisch zur produktiven `fupa-sync`).
- Lauf: PGlite-Umgebung (vorgegebener Pfad), `MIGRATIONS=<worktree>/supabase/migrations/ node <datei>`.

## RPC-Liste für die UI-Runde (/live, /tippen)
- `web_live()` **v2** (anon): zusätzlich `match.source` (`'fupa'|'pult'`), `match.fupaUrl`, `match.fupaAutor` (nur freigegeben), Minute aus `fupa_minute` bei Quelle fupa; je Ereignis `source/team/name/name2/textSource/placeholder` (versteckte raus); `reactions` (Summen je Ereignis), `conference` (nur ≤ 10 min alt + an), `tipp` (= `tipp_live_kurz`). Abwärtskompatibel (match/partner/previous als null-Form, Demo-Trennung).
- `tipp_live_kurz(p_spiel uuid)` (anon): `{tipps}` bzw. nach Tippschluss `{tipps, sieg, remis, niederlage}` (%). Nur Pflichtspiele, nie Demo.
- `sva_reagieren(p_ticker uuid, p_emoji text|null)` (authenticated): upsert/zurücknehmen, liefert neue Summen. Emojis: `tor|feuer|applaus|schock|wut`. Session-Token: localStorage `sva-album-auth` (kein Supabase-SDK auf `/live`).
- `sva_meine_reaktionen(p_spiel uuid)` (authenticated): `[{tickerId, emoji}]`.
- (Admin, schon in der Pult-UI genutzt) `sva_admin_live_status`, `sva_admin_live_quelle`, `sva_admin_fupa_kandidaten`, `sva_admin_fupa_zuordnung`, `tipp_admin_fupa_vorschlag`.

## Deine Aktivierungsschritte (Marvin) — Reihenfolge
1. **G-FUPA:** schriftliche FuPa-Zustimmung einholen (Entwurf `KONZEPT_LIVE_WETTBEWERB.md` 2.7). Ohne sie bleibt der Bot aus.
2. Migration `20261015100000_sva_live_v23.sql` anwenden.
3. Extensions prüfen: `select extname, extversion from pg_extension where extname in ('pg_cron','pg_net');` (pg_cron ≥ 1.5). Fehlendes im Dashboard aktivieren.
4. Vault-Secrets: `sva_fupa_live_url` = `https://<ref>.supabase.co/functions/v1/fupa-live`, `sva_fupa_live_secret` = Zufallswert. Function-Secret `FUPA_LIVE_CRON_SECRET` = **gleicher Wert**.
5. `supabase functions deploy fupa-live --no-verify-jwt`.
6. Migration `20261015110000_sva_live_v23_cron.sql` anwenden.
7. Netlify deployen.
8. Admin → Verein & Links: Erlaubnis-Notiz/Datum/Art eintragen, ggf. Reporter-IDs (nur mit Einwilligung), **Bot aktiv** an.
9. Admin → Kader: FuPa-IDs zuordnen (am besten nach dem ersten Bot-Spiel über die Aufstellung).
10. Erstes Spiel beobachten; `select * from sva_sync_log where quelle like 'fupa_%' order by zeit desc` zur Kontrolle.

## Offen / nächste Schritte
- **UI-Runde (`/live`, `/tippen`):** Satz-Vorlagen (`src/live/saetze.ts`), Reaktionen-Leiste, Konferenz-Karte, Live-Tabelle, Brückenzeile, Mini-Ticker, Quelle-Fuß — RPCs stehen (siehe Liste).
- **Admin-Rest (klein):** FuPa-ID-Feld in `Kader.tsx` und das Ein-Tipp-Zuordnungs-Sheet (RPCs `sva_admin_fupa_kandidaten/_zuordnung` sind da; Pult zeigt bereits die Zahl unzugeordneter Spieler); „FuPa-Werte übernehmen"-Knopf im Spielbericht (RPC `tipp_admin_fupa_vorschlag` da). Rückfrage-Sheet „FuPa tickert schon" vor TOR/GEGENTOR/… im Pult.
- **P8 ICS-Rückfall** (Spielplan ohne API) bewusst **nicht** gebaut (nicht beauftragt; nur bei FuPa-Absage nötig).
- **Konnte hier nicht laufen:** `npm run build`/`vite build` und `scripts/admin-audit.mjs ONLY=live-v23` (Playwright) — der Worktree hat kein eigenes `node_modules` (für `tsc` per Symlink aus dem Haupt-Checkout geprüft, 0 Fehler). Bitte nach `npm ci` lokal `tsc -b`, `vite build` und den Admin-Audit mit gemockten RPCs ergänzen/laufen lassen.

## Marvins To-dos
- FuPa-Anfrage senden (E1); Niko & Marcel wegen Textübernahme fragen (E4).
- Nach Migration: `database.types.ts` neu generieren (`supabase gen types`), damit die manuellen Ergänzungen durch echte Typen ersetzt werden.
- Datenschutz 5a/5b und `RECHT_OFFEN.md` juristisch prüfen (TODO-JURIST).
