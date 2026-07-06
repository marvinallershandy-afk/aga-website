# SVA-FUSSBALL — Abschlussbericht v6

**Lauf:** Das große Ganze + Stil-Entscheidung. Autonom, Gate für Gate, main immer grün.
**Branch main:** Kino-Look (poliert). **Branch `stil-cel-shading`:** Cel-Test (wartet auf Entscheidung).

## 1. Was gemacht wurde (6 Punkte)
1. **E0 · Nordstern-Audit** (`SVA_NORDSTERN_AUDIT.md`) — ganze Seite als Insta-Handy-Erstbesucher bewertet, größter Hebel = Kamera, Faktenfehler erfasst.
2. **E1 · Kamera-Politur** — Bogenlängen-Tempo (Zerren 17,7×→8,3×), Höhen-Klammer (Min+Max), **immersiver Hero** (y 12,5→7,0) → „Tischmodell"-Eindruck weg. Desktop+Mobil belegt.
3. **E2 · Cel-Shading-Test** (Branch, `SVA_CEL_TEST.md`) — 1 Szene + 1 Karte im Zeichentrick-Look, A/B-Screenshots, ehrliche Empfehlung. **STOPP für dich.**
4. **E4 · Route-Feature** — „Wo wir kicken": SVG-Mini-Map + plattform-bewusster Route-Button (iOS Apple / sonst Google), Link-Format belegt.
5. **E5 · Fakten** — Adresse korrigiert (Waldsportplatz/Zur Mehrzweckhalle), Aga-Urknall-Story (Riesenkicker 2024), Karten-Copy an Foil angepasst, Trainingszeit als Platzhalter markiert.
6. **Doku & Commits** — jede Etappe committet + gepusht, Screenshots (v6-Präfix).

## 2. Cel-Shading — A/B-Vorlage (deine Entscheidung)
Ansehen: `git checkout stil-cel-shading`, `npm run dev`, `http://localhost:5199/?celtest=1`.
Screenshots: `SVA_SCREENSHOTS/v6-cel-desktop.png` · `v6-cel-mobile.png`.
- **Cel** = mutigere, ownable, Instagram-native Identität; löst „sieht nach Model aus" an der Wurzel. **Aber:** Vollumbau ~3–4 Tage (v7).
- **Kino** (main) = premiumiger, emotionaler, **heute schon vorzeigbar**.
- **Meine Empfehlung:** Cel, wenn max. Unverwechselbarkeit + Umbauzeit drin sind; sonst Kino jetzt, Cel als v7. Details in `SVA_CEL_TEST.md`.

## 3. Perf v5 → v6
Kamera-Änderung ist **perf-neutral** (Arc-LUT = ~28er-Lookup/Frame). Post-Processing-Kette unangetastet.
Echt-GPU-Messung (M3, headless-Automation): ~30–34 ms/Frame, p95 bis 50 ms — **unverändert zum v5.5-Muster**.
⚠️ **Offen:** Diese Messung liegt über dem 16,6-ms-Ziel. In v5.5 als Fremdlast/DPR-Kette eingeordnet;
**interaktiv am Netzteil gegenprüfen** (Automations-Frametimes sind nicht die gefühlte Perf). Kein Regress durch v6.

## 4. Nordstern-Selbsteinschätzung (zieht die Seite Spieler/Sponsoren/Fans?)
- **Spieler** 🟢 — Hero immersiv, klarer „Probetraining"-CTA, jetzt + Route zum Platz.
- **Sponsoren** 🟢 — „Bande sichern"-CTA, echter Ort per Karte/Route sichtbar (Reichweite/Herz-Argument steht).
- **Fans** 🟡→🟢 — Insta-Link, teilbare Karten, Route zum Sonntagsspiel. **Bremse:** 2/3 Karten fotlos (Stolz/Wiedererkennung leidet).
- **Gesamt:** Erlebnis ist stimmiger und hochwertiger als v5. Größte verbliebene Lücke = **Spielerfotos**.

## 5. Bewusst NICHT gemacht (Begründung)
- **E3 · CC0-Objekte** — hängt an der Stil-Entscheidung (E2). Erst nach deinem Go stylen, sonst Wegwerf-Arbeit.
- **Voller 3D-Herauszoom auf Luftbild** (E4-Kür) — stil-abhängig + groß; Nordstern-Wert (hinfinden+Route) ist stil-unabhängig geliefert. v7.

## 6. Offene Punkte (Marvin)
- **Stil-Entscheidung Cel vs. Kino** (blockt E3 + evtl. v7).
- **Trainingszeit bestätigen** (aktuell Platzhalter „Di & Do ab 19:00").
- **Restliche ~10 Spielerfotos** — Higgsfield-Credits leer (Balance 1, Free) → aufladen ODER echte Fotos liefern.
- **fussball.de Team-ID** (Platzhalter).
- **Interaktive Perf** am Netzteil gegenprüfen.
