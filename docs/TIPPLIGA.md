# SVA Tipp-Liga + „Deine Elf“ (`/tippen`)

Stand v20-T (06.10.2026). Umsetzung von SVA_KONZEPT_FANERLEBNIS.md, Abschnitt 3 + Update B/C/D.
Kostenloses Tippspiel für alle Fans, Kickbase-Gefühl im SVA-Designsystem, in 20 Sekunden
gespielt. **Gleiches Konto wie das Sammelalbum** (ein Login für Album + Tipp-Liga).
Haupt-Aufhänger für Instagram (@svagathenburg).

---

## 1. Regeln

### Ergebnis-Tipp (Teil A)
| Treffer | Punkte |
|---|---|
| exaktes Ergebnis | 4 |
| richtige Tordifferenz | 3 |
| richtige Tendenz | 2 |
| erster SVA-Torschütze | +3 |
| Spieler des Spiels (Wahl auf Instagram) | +2 |
| jede richtige Bonusfrage (3 pro Spieltag) | +1 |
| **Joker** (1× pro Kalendermonat) | Teil A ×2 |

**Bonusfragen-Pool** (3 je Spieltag, automatischer Vorschlag wechselt pro Spiel, im Admin änderbar):
Gelbe Karten SVA (0 / 1–2 / 3+) · Rote Karte im Spiel (ja/nein, inkl. Gelb-Rot) · Tor vor der
20. Minute · Tore 1. Halbzeit (0 / 1 / 2+) · Elfmeter im Spiel · Zuschauer über/unter X
(nur Heimspiele, aufgelöst über Album-Check-ins; X = Ø der letzten 5 Heimspiele, auf 5 gerundet,
oder im Admin gesetzt) · Wer trifft zuerst (SVA / Gegner / niemand).

### „Deine Elf“ (Teil B)
5 SVA-Spieler: hinten TW/ABW, 2× MIT, 2× ANG — oder **frei** (Admin-Schalter, Standard an).
Einer trägt die Kapitänsbinde (zählt doppelt). Kein Geld, kein Transfermarkt.

| Ereignis (je Spieler) | Punkte |
|---|---|
| Einsatz | +1 |
| Tor | +5 |
| Vorlage | +3 |
| Zu null (TW/ABW, mind. 60 Min.) | +4 |
| Spieler des Spiels | +5 |
| Sieg (alle Eingesetzten) | +2 |
| Gelb / Gelb-Rot / Rot | −1 / −3 / −4 |

### Wer, was, wann
- Getippt werden **nur Pflichtspiele** (heim + auswärts). Vorführ-Spiele **nie**. Testspiele nur
  per Admin-Schalter → eigene **Winterwertung** (zählt nicht zur Saison).
- **Tippschluss = Anpfiff** (geplanter Anstoß bzw. früherer Ticker-Anpfiff) — serverseitig per
  Trigger erzwungen. Tipps anderer sind erst danach sichtbar (RLS + RPCs).
- Jeder **erste** Tipp eines Spieltags bringt **+1 Karte fürs Album** (über
  `album_karte_gutschreiben('tipp', spiel)` aus dem Karten-Paket, falls installiert).
- **Winterpause** 15.11.–14.03. (im Admin änderbar): `/tippen` zeigt „Winterpause – weiter am 14.03.“
  und den Saisonstand.
- Ranglisten: Spieltag, Monat, Saison (+ Winter). Gleichstand: mehr exakte Tipps vorne.
  Öffentlich nur Namen von Fans, die „öffentlich zeigen“ eingeschaltet haben (Vorname + Initial).
- **Stammtisch-Ligen** per 6-stelligem Code / Link `/tippen?liga=CODE` (max. 5 eigene, 300 Mitglieder).
- **Fans vs. Kabine**: Spieler-Konten markiert der Admin als „Kabine“; Duell = Ø Punkte pro
  Spieltag-Teilnahme. Kabine ist von Preisen ausgeschlossen (Teilnahmebedingungen).
- **Abzeichen**: Anstoß (erster Tipp) · Hellseher (3× exakt) · Treuer Tipper (10 Spieltage am Stück) ·
  Kartenexperte (5 Karten-Bonusfragen) · Kapitänsgriff (Kapitän ≥ 10 P.) · Volltreffer (exakt + 3/3 Bonus) ·
  Jokerkönig (Joker auf exakt) · Torriecher (3× erster Torschütze) · Spieltagssieger · Stammtisch (Liga mit 5+).
- Keine numerischen Spieler-Bewertungen — Spielerkarten zeigen nur Name, Nummer, Position,
  Auswahl-Listen Spiele/Tore.

## 2. Ablauf am Spieltag (Admin, 5 Schritte)

1. **Bis Freitag** — Admin → **Tipp-Liga → Spieltage**: Bonusfragen prüfen (Vorschlag passt meist),
   bei Heimspielen ggf. die Zuschauer-Linie setzen. Story-Grafik **„Jetzt tippen“** posten
   (Admin → Tipp-Liga → Story), Link-Sticker **aga-erste.de/tipp**.
2. **Samstag** — optional **Story-Code der Woche** eintragen (Story-Tab), Grafik **„Noch nicht getippt?“** posten.
3. **Sonntag, Anpfiff** — nichts zu tun: Tippschluss kommt automatisch mit dem Anpfiff im Ticker
   (bzw. zur Anstoßzeit). Ticker wie gewohnt führen (Tore mit Vorlage, Karten, Wechsel).
4. **2 Minuten nach Abpfiff** — im Ticker-Pult „**Tipp-Liga: Spielbericht & Werten**“ (oder
   `…/admin/spielbericht/<spiel-id>`): Einsätze/Minuten/Tore/Karten sind aus Ticker + Aufstellung
   vorbefüllt → fehlende **Vorlagen**, Minuten, **Zu null** ergänzen, Bonusfragen bestätigen
   (meist automatisch) → **Werten**. Ohne Ticker: Ergebnis oben eintragen.
5. **Montag** — MOTM aus der Instagram-Abstimmung im Spielbericht eintragen → **Neu werten**
   (+2 bzw. +5 Punkte kommen dazu), daneben „**MOTM-Karte veröffentlichen**“ (Album-Modul).
   Story-Grafiken **Tipp-Sieger**, **Top 5**, **Fans vs. Kabine** posten.

Korrekturen (falsche Karte, vergessene Vorlage) jederzeit: Bericht ändern → **Neu werten**.
Berechtigung: Spielbericht + Spieltage = Team-Zugang und Admin; Story + Kabine & Regeln = nur Admin.

## 3. Instagram-Wochenplan

| Tag | Instagram | Website/Admin liefert |
|---|---|---|
| **Fr** | Story „**Jetzt tippen**“ + Link-Sticker `aga-erste.de/tipp` | Grafik per Klick (Admin → Tipp-Liga → Story) |
| **Sa** | Story „**Noch nicht getippt?**“ (+ Story-Code der Woche) | Grafik mit Anzahl Tipps + Code |
| **So** | Spieltagsbegleitung; nach Abpfiff „Auflösung auf /tippen“ | Spielbericht → Werten; /live zeigt „Auflösung“ |
| **Mo** | **Tipp-Sieger** + **Fans vs. Kabine** (+ Top 5), MOTM | Grafiken per Klick; Kabine nur als Schnitt, Einzelne nur positiv |

Fans teilen selbst: „Mein Tipp“, „Meine Elf“, „Platz X in Liga Y“, Abzeichen (1080×1920, Teilen-Menü).

## 4. Einstiege auf der Website
Karte → Spieltag-Panel („Tipp-Liga · Jetzt tippen“), `/live` (vor Anpfiff „Jetzt tippen“, live
„Tipp-Liga läuft“, nach Abpfiff „Auflösung & Rangliste“; nie im Vorführ-Modus), `/album`
(Startseite + Fußzeile), Fußzeilen (Karte/Rundgang, /live), Instagram-Zeile („Tipp-Sieger“).
Kurz-Link: **aga-erste.de/tipp** → `/tippen?utm_source=instagram&utm_medium=story`.

## 5. Technik

- Seite: `tippen.html` → `src/tippen/*` (eigenes Bundle, kein three.js; statischer Vorab-Inhalt
  in tippen.html für Crawler/ohne JS; OG-Bild `public/og/tippen.jpg` aus `scripts/og-bilder.mjs`).
- **Karten-Adapter**: `src/tippen/karteAdapter.ts` + `SpielerKarte.tsx` — einzige Stelle, die
  Spielerbilder/-karten holt (heute HoloCard + `playerMedia`: Greenscreen → Freisteller → Foto;
  neue Greenscreen-Aufnahmen wirken automatisch). Umstieg auf `src/karten/*` nur dort.
- Story-Bilder: `src/tippen/share.ts` (Canvas 1080×1920, Fans + Admin).
- Admin: `src/admin/pages/TippLiga.tsx`, `src/admin/lib/tippliga.ts`; Routen `/admin/tippliga`,
  `/admin/tippliga/{spieltage|story|kabine}`, `/admin/spielbericht/:spielId`.
- DB: `supabase/migrations/20261012100000_sva_tippliga.sql` (Tabellen `sva_tipp_*`, RPCs
  `tipp_*` / `tipp_admin_*`, reine Rechenfunktionen `sva_tipp_ergebnis_punkte`,
  `sva_tipp_tipp_punkte`, `sva_tipp_spieler_punkte`). `web_snapshot()` unverändert.
  Gekapselte Aufrufe ins Album-Modul (nur wenn vorhanden): `album_karte_gutschreiben(text, uuid)`,
  `album_ziel_ausloesen('tipp_exakt' | 'kapitaen_trifft' | 'tipp_spieltagssieg', spiel[, user])`,
  `album_motm_karte_veroeffentlichen(uuid)`.
- Statistik-Ereignisse: `tipp-abgegeben`, `elf-gespeichert`, `liga-gegruendet`, `liga-beigetreten`, `tipp-teilen`
  (+ Seiten `/tippen`, `/teilnahmebedingungen`).
- Konto löschen (auf /album) löscht per Fremdschlüssel auch alle Tipp-Liga-Daten.
- Recht: `public/teilnahmebedingungen.html` (/teilnahmebedingungen), Datenschutz Abschnitt **7c** (`/datenschutz#tippliga`).

## 6. Scharf schalten (Marvin)

1. Migration `20261012100000_sva_tippliga.sql` anwenden (nach `20261011110000_sva_am_platz.sql`).
   Lokal getestet: `supabase/tests/tippliga.test.mjs` (PGlite, 180 Prüfungen).
2. Supabase → Authentication → **Redirect URLs**: `https://<domain>/tippen*` ergänzen (wie `/album*`).
3. Netlify deployen (Redirects `/tippen`, `/teilnahmebedingungen`, Kurz-Link `/tipp`).
4. Admin → Tipp-Liga → Kabine & Regeln: Partner „präsentiert von“ und Preise (optional) setzen,
   Spieler-Konten als Kabine markieren, sobald sich Spieler angemeldet haben.
5. Prüfen:
   ```sql
   select jsonb_pretty(public.tipp_lage());
   select public.sva_tipp_wertung(id), gegner, anstoss from public.sm_spiele where anstoss > now() order by anstoss limit 5;
   ```

## 7. Tests & Prüfskripte
- `supabase/tests/tippliga.test.mjs` — Punkte (viele Fälle), Sperre nach Anpfiff (RPC + Trigger),
  RLS, Joker-Limit, Liga-Codes, Demo-/Testspiel-Ausschluss, Bericht aus Ticker, Werten + Neuberechnung,
  Ranglisten mit Trend, Fans vs. Kabine, Abzeichen, Album-Karte/-Missionen (gekapselt), Konto löschen.
- `scripts/tippen-audit.mjs` — `/tippen` in allen Zuständen (Gast, vorbelegt, Bonus-Wisch, Elf-Auswahl,
  Belohnung, gesperrt/live, Auflösung animiert + reduced-motion, Ranglisten, Ligen, Profil,
  Winterpause, Teilen-Bilder). `scripts/tippliga-admin-audit.mjs` — Admin (Spielbericht als Team,
  Spieltage, Story, Kabine). Beide mit gemockter DB:
  `VITE_SUPABASE_URL=https://mock.supabase.co VITE_SUPABASE_ANON_KEY=x npx vite --port 5193`, dann
  `BASE=http://localhost:5193 OUT=./shots-v20-tipp node scripts/tippen-audit.mjs`.
