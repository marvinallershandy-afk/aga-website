# FuPa-Live-Bot — Betrieb, Aktivierung, Störungen (v23-L)

Der Bot spiegelt **während eines SVA-Spiels** die Fakten des FuPa-Tickers (Tore, Karten,
Wechsel, Minute, Stand) nach `sva_ticker` und füllt damit `/live` und die Tipp-Liga. Dazu
kommen die Spieltags-**Konferenz** (andere Kreisliga-Spiele) und eine **Live-Tabelle**.
Texte baut das UI aus eigenen Vorlagen; Reportertexte werden nur mit Freigabe 1:1 gezeigt.

> **Rechtlich:** Der Bot läuft nur mit schriftlicher FuPa-Zustimmung (Nutzungsbedingungen
> Ziffer 4.1.4, siehe `KONZEPT_LIVE_WETTBEWERB.md` 2.2/2.7 und `docs/RECHT_OFFEN.md`).
> Ohne Eintrag der Erlaubnis-Notiz lässt sich der Bot technisch nicht einschalten (Trigger).

## Bausteine
- **Migration** `20261015100000_sva_live_v23.sql` — Datenmodell + RPCs. Setzt `fupa_live_modus = 'aus'`.
- **Edge Function** `supabase/functions/fupa-live/` — `index.ts` + reine Module `live_map.mjs`,
  `abgleich.mjs`, `tabelle_live.mjs`.
- **Cron** `20261015110000_sva_live_v23_cron.sql` — `pg_cron` ruft alle 30 s `sva_fupa_live_tick()`,
  die **in SQL** prüft, ob ein Spielfenster läuft, und nur dann per `pg_net` die Function ruft.

## Datenfluss
```
pg_cron 30 s → sva_fupa_live_tick() [SQL]
   · Modus 'an'? Spiel im Fenster (Anstoß −30 min … +3 h, Fensterende POST+20 min)?
   · nur dann net.http_post → /functions/v1/fupa-live {aufgabe:'spiel', spiel_id}
   · ~alle 60 s zusätzlich {aufgabe:'konferenz', datum} an SVA-Ligaspieltagen
fupa-live:
   GET /v1/matches/<id>        → sm_spiele.fupa_* (Section, Stand, Minute, streamUpdatedAt, Autor)
   (nur wenn ts/Stand neu) GET /v2/matches/<id>/stream?ts=… → live_map → abgleich →
     sva_fupa_ticker_anwenden (eine Transaktion; Stand/Status-Trigger feuert konsistent)
   (einmal nach POST) GET /v1/matches/<id>/lineup → sva_fupa_aufstellung (Spielbericht-Vorbefüllung)
   (konferenz) GET /v1/competitions/<comp>/seasons/<s>/matches?from=<datum> → sva_konferenz
web_live() v2 → /live (15 s), Spieltag-Leiste, /tippen
```

## Aktivierung (Reihenfolge)
Siehe `docs/SPIELTAG.md` → „Teil B". Kurz:
1. G-FUPA (schriftliche Zustimmung) liegt vor.
2. `20261015100000_sva_live_v23.sql` anwenden.
3. `pg_cron`/`pg_net` prüfen/aktivieren; Vault-Secrets `sva_fupa_live_url`, `sva_fupa_live_secret`;
   Function-Secret `FUPA_LIVE_CRON_SECRET` (= `sva_fupa_live_secret`).
4. `supabase functions deploy fupa-live --no-verify-jwt`.
5. `20261015110000_sva_live_v23_cron.sql` anwenden.
6. Netlify deployen.
7. Admin → Verein & Links: Erlaubnis eintragen, **Bot aktiv** an.
8. Admin → Kader: FuPa-IDs zuordnen.

## Quelle je Spiel (`sm_spiele.live_quelle`)
- `auto` (Standard): Bot schreibt, wenn FuPa einen `live`/`soft`-Ticker meldet, sonst Pult.
- `fupa`: immer Bot. `pult`: immer Pult (Bot fasst nichts an, nur Kopf wird für die Anzeige aktualisiert).
Umschalten im Pult (Segment **Auto · FuPa · Selbst tickern**).

## Konflikt- und Schutzregeln
- Bot fasst **nur** `quelle='fupa'`-Zeilen an; `pult`-Zeilen sind tabu.
- **Hand schlägt Bot:** Bearbeiten/Löschen einer Bot-Zeile im Pult → `gesperrt`/`versteckt`; der Bot
  ändert/löscht sie nie wieder (Trigger `sva_ticker_pult_waechter`).
- **Duplikate:** Bot-Zeile gleich einer Pult-Zeile (gleicher Typ, ±3 min, gleicher/offener Spieler) →
  `versteckt` + `duplikat_von`. Gezählt werden nur sichtbare Zeilen.
- **Soft-Ticker:** nur Stand → Platzhalter-Tor „Torschütze folgt", wird beim echten Ereignis ersetzt.
- **Stand-Abweichung:** nur Hinweis im Pult, keine Automatik.

## Störungen
- **„FuPa liefert seit … nichts" / „nicht erreichbar"** (rotes Banner): Spiel ≥ 10 min live ohne Update
  oder 5 Fehler in Folge → im Pult **Selbst tickern** tippen (Minute läuft weiter).
- **403/429 von FuPa:** Die Function pausiert das Spiel automatisch 15 min (`fupa_pause_bis`) und meldet
  „nicht erreichbar". Danach versucht der Cron es erneut.
- **Spieler ohne Zuordnung:** Ereignis erscheint mit FuPa-Namen; im Pult/Kader zuordnen
  (`sva_admin_fupa_zuordnung`), bestehende Bot-Zeilen werden beim nächsten Tick nachgetragen.
- **Protokoll:** `select * from sva_sync_log where quelle in ('fupa_live','fupa_konferenz') order by zeit desc limit 20;`
  (nur Änderungen und Fehler werden geloggt).

## Ausschalten
Admin → Verein & Links → **Bot aktiv** aus. `fupa_live_modus='aus'` → die Function kehrt sofort mit
`{uebersprungen:'modus_aus'}` zurück, der Cron läuft weiter, tut aber nichts. Zum Entfernen des
Zeitplans: `select cron.unschedule('sva_fupa_live_tick');`.

## Tests (ohne FuPa-Netz)
- `supabase/tests/fupa_live_map.test.mjs`, `fupa_live_abgleich.test.mjs`, `tabelle_live.test.mjs` (Node)
- `supabase/tests/live_v23.test.mjs` (PGlite: Gate, Dedupe, Hand-Schutz, Reaktionen, web_live v2, Konferenz, Rollen)
- Fixtures: `supabase/tests/fixtures/fupa_live/real/` (einmalig abgerufenes, bereinigtes SVA-Spiel).
