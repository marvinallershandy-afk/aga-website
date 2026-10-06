# UX-Abnahme v21 → v22-T (Tipp-Liga, 06.10.2026)

Abnahme der Checkliste aus `UX_PRUEFUNG_V21.md` (Top-15) plus Marvins Feedback nach dem
eigenen Durchtippen. Geprüft **lokal** (Vite mit gemockter Supabase-URL, Vorführung bzw.
gemockte RPCs — nie die echte Datenbank), Chromium (`--use-angle=metal --enable-gpu
--ignore-gpu-blocklist`) **und** WebKit (isMobile/hasTouch 390×844) sowie Desktop 1440×900.
Branch `v22-tippliga` — **nicht** gepusht/deployt, die Live-/Draft-URL ist also noch v21.

Automatisch: `scripts/tippen-ux-abnahme.mjs` (42 Prüfungen, Chromium + WebKit **grün**),
`scripts/tippen-nav-test.mjs` (Chromium + WebKit **0 Fehler**), `scripts/tippen-album-sitzung-test.mjs`
(Chromium + WebKit **grün**), `scripts/tippen-perf.mjs`, PGlite `supabase/tests/*` (grün).
Belege (Screenshots, Frame-Serien, Videos): `shots-v22-tipp/` (nicht committet).

## A. Erstkontakt (Befund 1)
- [x] Startseite mobil ohne Scroll/Tap: sichtbarer Einstieg → `/tippen` — Kachel „Jetzt tippen“
      **neben** „Werde Teil der Kurve“ (eine Reihe, gleiche Höhe wie früher der Album-Teaser,
      verdeckt weder Pins noch Fußzeile) + „Tippen“ in der Fußleiste. Beleg `abnahme/a-start-m-*.png`
- [x] Desktop dito über der Falz. `abnahme/a-start-d-*.png`
- [x] Fußleiste: Karte · Live · **Tippen** · Mitspielen.
- [x] Kachel mit Zustand: „Jetzt tippen · noch X Tage · +1 Karte“ / „Tipp abgegeben ✓“ /
      „+X Punkte“ (aus dem von /tippen geschriebenen Stand `sva-tipp-stand`).
- [x] **Kein Supabase-Bundle auf der Startseite**: Produktions-Build, 52 JS-Dateien, keine mit
      supabase-js (`GoTrueClient` nur im Chunk `dist-*.js`, der auf `/` nie lädt), 0 Supabase-Aufrufe.
- [x] 3D-Karte, Album-Teaser, CTAs unverändert.

## B. Tipp-Flow (Befunde 2, 3, 4)
- [x] Vorführung frisch: keine Haken, Ergebnis neutral **„– : –“**, Elf leer (5 freie Plätze),
      Angriff antippen → Zweitpositions-Spieler + ausgegraut „nicht verfügbar“. `b1-auswahl`
- [x] Unberührtes Ergebnis → **Rückfrage „Noch offen: Ergebnis · 3 Bonusfragen · Elf 0/5“**
      („Ergebnis wählen“ / „Ja, 0:0 tippen“). Nach Stepper-Klick geht „Tipp abgeben“ direkt durch. `b2-rueckfrage`
- [x] „Startelf übernehmen“ statt 5 leerer Plätze: Vorschlag aus der aktuellen Aufstellung
      (Server: `vorschlagElf` aus `sva_lineup`, Formation 1-1-2-1, nicht verfügbare übersprungen,
      ohne Kapitän) — nie automatisch abgegeben.
- [x] Mobil: Fußstapel **157 px = 18,6 %** (≤ 20 %): eine Chip-Zeile + Abgabe-Knopf, der Kontext
      („für Di 06.10. 15:00 · gegen FIS“) steht im Knopf. Bonus-Antworten vollständig sichtbar,
      Sprünge landen über dem Stapel (`scroll-margin`). `b3-bonus`
- [x] Wisch auf 2er-Bonusfrage beantwortet sie (1/3 → 2/3), Chromium + WebKit.

## C. Poliertes Verhalten (Befunde 5–12)
- [x] 5× schnell tippen / Doppeltipp auf Chips, Stepper, Deck: keine Textselektion,
      kein Tap-Highlight (`user-select`/`-webkit-tap-highlight-color` auf Bedienflächen).
- [x] Legende „? = läuft noch, zählt erst bei Abpfiff“ im Live-Block.
- [x] Abgabe-Knopf nennt Gegner/Datum.
- [x] Count-up **nur bei echter Änderung**: Merker je Spiel **und** Punktestand — 2. Besuch sofort
      Endstand, kommen Punkte dazu (Montag: MOTM) zählt es genau einmal neu.
- [x] „K = Kabine (Spieler-Konto) · von Preisen ausgeschlossen“ unter der Rangliste,
      Tiebreak-Fußnote im Spieltagssieger-Block.
- [x] Desktop „Tipp in die Story“: Download + Rückmeldung „Bild gespeichert — poste es in deiner
      Story“ (`c6-toast`). Mit Web-Share (Safari/Handy) ist der Systemdialog die Rückmeldung.
- [x] Vorführung mobil: Steuer-Kopf klappt beim Scrollen ein.
- [x] „In öffentlichen Ranglisten zeigen“: Opt-in mit **Vorschau** des eigenen Eintrags
      (Anmelden + Profil), Standard aus.
- [x] /live-Kopf mit „Tipp-Liga“-Pill (Befund 14).

## D. Regression
- [x] Tabs 3× im Wechsel, Wischen, Browser-Zurück, `#rangliste`-Deep-Link: `tippen-nav-test.mjs`
      Chromium + WebKit 0 Fehler.
- [x] Bildrate 4× CPU-Drossel, Produktions-Build (`tippen-perf.mjs`): Live 60 fps · p95 19 ms · 0 lange,
      Scrollen 60/18/0, Tab-Wechsel 60/18/0, Auflösung 60/18/0. **TOR!-Einblendung 60 fps · p95 18,6 ms**,
      Gegentor 60/18,5/0, Einführung (18 s) 60/18,5/0. (Zum Vergleich v21 unter gleicher Last: gleichauf.)
- [x] reduced-motion: Auflösung ohne Count-up, TOR!/Einführung ohne Bewegung (Endbild).
- [x] 0 Seitenfehler auf /, /tippen, /live, /album, /partner.
- [ ] Album-Login (E-Mail + Einwilligung) — unverändert, gehört dem Album-Paket (nicht angefasst).

## v22 — Marvins Feedback
1. **Ein Fokus pro Zeitpunkt** — vor Anpfiff nur der anstehende Tipp; live nur das Live-Spiel
   (kein Tippschein, nächster Spieltag als gestrichelte Vorschau „öffnet nach der Auflösung ·
   spätestens Mi 16:53 Uhr“); nach Abpfiff „Abpfiff · Wertung folgt“; das nächste Spiel öffnet mit
   der Wertung, spätestens 24 h nach Abpfiff. **Serverseitig** (Trigger auf Tipp + Elf,
   `tipp_noch_nicht_offen`; `tipp_lage()` liefert `naechstes` statt `offen`). Vorführung mit
   Wertungs-Schritt („Jetzt werten“, sonst automatisch nach 6 s). Belege `f4-wertung-folgt`, `p-live-unten-m`.
2. **Live** — Live-Leiste (Status, Minute, Stand, deine Punkte) immer sichtbar, in allen Bereichen;
   **TOR!** als Vollbild-Einblendung über allem: Lichtstoß, Strahlen, TV-Streifen, Wort knallt rein,
   Torschütze als Freisteller (Greenscreen-Jubel `playerMedia(id).jubel`/`.loop` wird automatisch
   genutzt), Rückennummer im Umriss, Bauchbinde Minute · Name · #Nummer · Vorlage · neuer Stand;
   2,6 s, antippen/Esc schließt, Haptik; Gegentor ruhig/dunkel. Gemeinsame Komponente
   `src/ui/tor/*` in /tippen **und** /live (dort Leiste, sobald der Kopf aus dem Bild ist).
   Echtbetrieb: /tippen holt während des Spiels alle 20 s den Live-Ticker (Minute, Torschütze).
   Belege `tor-m/`, `tor-d/`, `live-tor-m/`, `live-gegen-m/`, `tor-m-webkit/` (Frame-Serien + Video).
3. **Einführung** als Trailer: 5 Mini-Szenen à 3,6 s (Ergebnis tippen → Karte fliegt ins Album →
   Punkte zählen live → Rangliste steigt → Preis winkt) = 18 s, Story-Balken, Tippen rechts/links,
   Halten = Pause, überspringbar, einmalig + jederzeit „So funktioniert’s“; danach „Das bekommst du“.
   Belege `intro-m/`, `intro-m-sheet.png`, `intro-m-webkit/`.
4. **Preise** — „Das kannst du gewinnen“ in Saison- und Monatswertung (Treppe 1–5, Monatssieger,
   „präsentiert von“, „ab 18 · unter 18: Softdrink-Variante“, Kabine-Hinweis +
   Teilnahmebedingungen). Admin → Tipp-Liga → Kabine & Regeln → **Preise**. Leer = unsichtbar.
   Belege `preise-m.png`, `preise-d.png`, `admin-preise-*.png`.
5. **Album-Verbindung** — Vorführung: alle Album-Links → `/album?vorfuehrung=1`. Echtbetrieb:
   gleiche Anmeldung bestätigt (Sitzung aus /tippen → /album drin; Sitzung aus dem Album-Anker
   `/api/album-sitzung` → /tippen drin → /album drin), Chromium + WebKit.

## Offen / bewusst nicht in diesem Paket
- Befund 13 (Startseiten-Rundgang, Einzel-Ruckler beim Stationswechsel) — 3D-Karte, nicht Teil der Tipp-Liga.
- Befund 15 (Album-Landing „So funktioniert’s“) — `src/album/*` gehört dem Album-Paket; der
  unterbrochene Zwischenstand hatte dort Änderungen, die zurückgenommen wurden.
- Live-/Draft-URL-Abnahme folgt nach Merge/Deploy (Migration `20261014100000` vorher einspielen).
