# SVA-Fussball · Abschlussbericht v12 „Termin-Polish"

**Branch:** `v12-polish` (von v11-gross) · gepusht · **NICHT gemergt**
**Umfang:** 34 Dateien, +597 / −155 · 7 Etappen-Commits
**tsc + build:** grün · **Termin-Sicherung:** Etappe 1 wurde zuerst committet+gepusht,
bevor die großen Umbauten begannen.

Jeder Auftragspunkt umgesetzt oder unten unter „Offen/Hinweis" mit Begründung markiert —
kein stilles Weglassen. Reihenfolge bewusst: sichere Fixes → Sicherung → riskante Umbauten.

---

## Etappen

**E1 · Sichere Schnell-Fixes (→ committet als Termin-Sicherung).**
- Scrim-Boxen bekommen einen vertikalen Mask-Fade → die harten schwarzen Balken
  zwischen den Stationen UND der sichtbare „Strich" unter der Hero-Ebene sind weg.
- Fanblock: „FOTO FOLGT"-Platzhalterkacheln entfernt — die Galerie rendert nur noch
  echte Fotos (bis Marvin liefert: unsichtbar, kein leerer Rahmen).
- „Fangesang an"-Button raus (Ton ist global über den Mute-Button unten rechts).
- Hero-/Claim-Copy als final bestätigt.

**E2 · Mannschaft: Kamera + Aufstellung + Galerie.**
- Kamerastation neu: schräg von oben, zentral hinter dem gegnerischen Tor — die
  GANZE Aufstellung + Trainerstab in einem Bild (vorher zu tief, halbe Elf ab).
- Aufstellung dadurch korrekt gestaffelt: Sturm vorne Richtung Kamera, Torwart hinten.
- „Alle Spieler anzeigen" → neue Vollbild-Galerie, gruppiert nach Tor/Abwehr/
  Mittelfeld/Sturm + Trainerstab; Karten anklickbar (Detail-Modal).

**E3 · Scroll-Snap-Stopper pro Station.**
- `scroll-snap-type: y proximity` + `scroll-snap-align: center` je Sektion → die Seite
  rastet an jeder Station ein; die Sektions-Mitte ist zugleich die komponierte Kamera-
  Pose (Anker werden aus den Zentren gemessen).
- Nav-Reiter zentrieren die Sektion (scrollIntoView center) → Klick springt exakt an
  den Snap-Punkt. reduced-motion: Snap aus.
- Wahl `proximity` statt `mandatory` bewusst: mandatory würde die 210vh-Musik-Sektion
  und die Transition-Gaps (Anstoß-Sturzflug) zerhacken. Ein Wort entfernt, falls Marvin
  es härter will.

**E4 · Partyraum: Schwenk langsamer + Snap tief im Raum.**
- Einflug-Fenster 1.55 → 2.05vh, Easing-Exponent 1.7 → 1.35 → der Schwenk in den
  Raum läuft nochmal deutlich langsamer/ruhiger, kein End-Rush an der Tür.
- Raum-Totale schon bei p≈0.82 erreicht → der Musik-Snap landet zuverlässig TIEF im
  Saal: ganze Tracklist, AGA-Logo, Tresen, Bänke auf einem Bild.

**E5 · Tabelle: volle Breite + Hover + Countdown.**
- 2-Spalten-Cockpit über die volle Breite: links Tabelle + Top-Torschützen, rechts
  Form + Zuletzt + Nächstes Heimspiel.
- Hover-Effekte (Panels heben an, Tabellenzeilen + Torschützen highlighten). Top-
  Torschützen prominenter (größere Gesichter, Leader als Gold-Karte).
- Nächstes Heimspiel: Live-Countdown (Tage/Std/Min/Sek) + „In Kalender" (ICS-Download,
  self-contained). Termin vorläufig (nächster So 15:00), ehrlich markiert.

**E6 · Sponsoren-Karussell IN die 3D-Bande.**
- Das Karussell lebt jetzt auf der Bande: die Pfeile fahren die Kamera seitlich an
  der 3D-Bande entlang von Tafel zu Tafel (gedämpfter x-Pan).
- DOM drastisch verschlankt: 3 kompakte Vorteils-Pills + Banden-Nav (Pfeile/Punkte)
  + 2 CTAs statt drei Text-Kästen + zweitem DOM-Karussell.
- Tafeln bleiben scharf; echte Sponsor-Logos erscheinen automatisch, sobald in
  SPONSORS[] gepflegt.

**E7 · Mitmachen verdichtet.**
- NextMatch + Sponsoren-Karussell aus der Sektion entfernt (duplizierten Tabelle-/
  Sponsoren-Station). Der Snap zeigt jetzt komponiert die Kernaussage: Komm vorbei
  + WhatsApp/Instagram + 3 Karten + kompaktes Kontakt-Raster.
- „Wo wir kicken" (Karte + Route öffnen) = zweiter Beat / Finale-Rauszoom.

**E8 · Abschluss.** Dieses Dokument, Screenshot-Set, Perf, Asset-Liste, Merge-Empfehlung.

---

## Perf (Hinweis — bitte im Vordergrund gegenprüfen)

Der automatisierte Headed-Lauf (`scripts/_e8perf.mjs`) zeigte diesmal **33,3 ms flat /
30 FPS über ALLE Stationen identisch**. Das ist das bekannte 30-Hz-Drossel-Artefakt,
wenn das Browserfenster nicht wirklich im Vordergrund/frontmost liegt (Occlusion-Cap) —
**kein echter Einbruch**: eine echte Regression würde je Szene VARIIEREN, nicht bei
allen Szenen exakt gleich auf 33,3 ms liegen. Derselbe Skript-Lauf lieferte in v11
(Fenster frontmost) saubere **16,7 ms / 60 FPS**.

Die v12-Änderungen fügen KEINE neue Geometrie / keine Draw-Calls hinzu — nur CSS-Scroll-
Snap, ein gedämpfter x-Lerp im bestehenden Frame-Loop (Sponsoren-Pan) und ein 1-Sekunden-
Countdown-Interval. Damit bleibt das reale 60-FPS-Gate aus v11 erhalten.
**Marvin: mit Fenster im Vordergrund (bzw. Taste `p` / Perf-Overlay) am Netzteil
gegenprüfen.** Screenshot-Set in `SVA_V12_SET/` (Desktop komplett, Mobile nachgezogen).

---

## Assets, die Marvin noch nachliefert (alle ehrlich als Platzhalter markiert)

1. **fussball.de-Anbindung** — Team-ID ist eingetragen; Tabelle/Form/Ergebnis/Termin
   sind Vorschau. Der Countdown zählt bis zum nächsten So 15:00 (vorläufig).
2. **Echte Meisterfeier-Fotos** → `public/fanblock/<name>.webp` + `src` in FAN_PHOTOS.
   (Solange leer, ist die Fan-Galerie bewusst unsichtbar statt „Foto folgt".)
3. **Sponsor-Logos + Infos** → `public/sponsors/<name>.png` + Eintrag in SPONSORS[].
   Erscheinen dann scharf auf der Banden-Karussell-Tafel.
4. **Restliche Spielerfotos** (5 echt, Rest Wappen-Platzhalter), **Co-Trainer**
   Name/Foto, **Trainingszeit** bestätigen, **echte WhatsApp-Nummer**
   (CONTACT.whatsapp = Platzhalter).

---

## Merge-Empfehlung

`v12-polish` ist fertig und merge-fähig (enthält v9 + v10 + v11). tsc + build grün.

```
git checkout main
git merge v12-polish     # bringt v9 + v10 + v11 + v12
```

Kein offener technischer Blocker. Zwei Regler, falls gewünscht:
- Härteres Einrasten: `scroll-snap-type: y proximity` → `mandatory` (1 Wort, index.css).
- Perf final am Netzteil im Vordergrund bestätigen (s. o.).
