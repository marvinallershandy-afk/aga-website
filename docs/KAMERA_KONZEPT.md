# Kamerafahrt-Konzept — SV Agathenburg-Dollern 3D-Onepager

**Status: ENTWURF zur Freigabe (GATE-11).** Dieses Dokument ist die
Grundlage für den Umbau von `src/camera/CameraPath.ts` (`STATIONS`) und
`CameraRig.tsx`. **Erst nach Marvins Freigabe/Anpassung wird Code geändert.**
Alle Posen unten sind Vorschläge zum Verwerfen oder Verfeinern.

Katalog #8 (Marvin): „Die Kamerafahrt grundsätzlich neu denken — v. a. die
Mannschafts-Enthüllung." Das ist der Kern dieses Konzepts.

---

## 0. Warum überhaupt neu denken?

Die heutige Fahrt ist technisch sauber (bogenlängen-korrigierte Catmull-Rom,
Boden-/Decken-Clamp, reversibel). Was fehlt, ist eine **erzählerische Absicht
pro Station**. Aktuell ist fast jede Station ein „schräg-von-oben-Blick" aus
leicht anderer Ecke — es gibt keine **Dramaturgie der Höhe** (mal am Boden
mitfühlen, mal drüberstehen), keinen **Signature-Reveal**, und die
Mannschaft wird aus einem beliebigen Diagonalwinkel gezeigt, statt
*enthüllt*.

**Leitidee der neuen Fahrt: „Vom Ankommen zum Dazugehören."**
Der Besucher kommt als Gast am Tor an (Distanz, Übersicht), wird auf
Augenhöhe in Mannschaft und Fankurve hineingezogen (Nähe, Emotion), feiert
im Vereinsheim mit (Innenraum), und steigt am Ende auf, um den ganzen Ort als
„Hier gehörst du hin" zu überblicken (Einladung).

**Drei Höhen-Register** (statt einem):
- **AUGENHÖHE (y ≈ 1,4–1,8):** Emotion, Zugehörigkeit — Anstoß, Mannschaft,
  Fankurve.
- **STANDPUNKT (y ≈ 2,5–5):** Präsentation, Überblick mit Haltung — Verein,
  Sponsoren.
- **VOGELFLUG (y ≈ 7–20):** Ankommen & Einladen — Hero-Auftakt, Finale.

**Kamera-Grammatik (durchgehende Regeln):**
1. **Ein Blickfluss, kein Zappen.** Das Look-Ziel wandert nie schneller als
   die Position — harte Schwenks sind verboten (Ausnahme: der bewusste
   Party-Cut, Dip-to-Black).
2. **Near-Plane-Disziplin.** Nie fährt unscharfe Nahgeometrie (Zaun, Wand,
   Mast) formatfüllend durchs Bild (das ist Katalog #5, Partyraum-Barriere).
3. **Jede Station hat EINEN Helden im Bild** (Mannschaft, Kurve, Tür, Bande…)
   — die Komposition ordnet sich diesem unter (Drittel-Regel, Held rechts,
   DOM-Text links).
4. **Reveals steigen, Abschiede weiten.** Enthüllungen fahren *von unten/nah
   nach oben/frei*; der Abschied (Finale) zieht *auf und weg*.

---

## 1. Stationen — Ist-Pose, Absicht, Vorschlag

Koordinaten: `x` Ost(+)/West(−), `y` Höhe, `z` Süd(+)/Nord(−).
Kader-Wand steht um `x≈−4…+1.6`, Süd-Seitenlinie `z≈+3…4`, Vereinsheim `+x`.

### Station 0 · VEREIN (Hero / Establishing)
- **Ist:** `pos (4.2, 7.0, 15.2) → look (0, 0.5, 0.6)` — schräg von Südost,
  halbe Vogelperspektive. Gut, aber die Flutlicht-Masten ragen als schwarze
  Kästen in den Himmel (Katalog #9 / Hero-Mängel).
- **Absicht:** *Ankommen.* Der Besucher steht vor „seinem" Verein — Weite,
  Dämmerung, das Stadion atmet, bevor es losgeht.
- **Vorschlag:** Register VOGELFLUG beibehalten, aber **etwas tiefer und
  frontaler** (`y 7 → ~6.2`, `z ~14`), sodass der Horizont/Vereinsschild
  trägt und die Masten NICHT frei in den Himmel stechen (Mast-Silhouetten
  gehören in E9). Look leicht anheben (`y 0.5 → 0.9`) → weniger „Tischmodell".

### Station 1 · ANSTOSS (Signature-Beat, keine eigene Sektion)
- **Ist:** `pos (0.35, 0.62, 2.75) → look (−2.6, 1.15, −1.9)` — Sturzflug
  hinter den Anstoßkreis, endet knapp über dem Rasen. Flutlicht flackert an,
  Ball rollt vorbei. **Dieser Beat ist stark und bleibt** (P5-E1 hat ihn nur
  verdichtet).
- **Absicht:** *Der Pfiff.* Adrenalin, Bodennähe, „jetzt geht's los".
- **Vorschlag:** **Kernstück des neuen Reveals umbauen (s. Station 2).** Der
  Sturzflug endet neu **hinter dem West-Tor tief am Boden** (`pos ~(−5.2,
  1.5, 0)`), Blick nach Ost über die noch leere Aufstellung — als **Startrampe
  für das Aufsteigen** in Station 2. Der Ball rollt weiter aus dem Bild,
  Flutlicht steht dann voll.

### Station 2 · MANNSCHAFT — ⭐ DER SIGNATURE-REVEAL (Katalog #8-Kern)
- **Ist:** `pos (5.6, 5.5, 7.2) → look (−1.6, 0.75, 0.4)` — statischer
  Diagonal-Blick von Ost-oben auf die Formation. Funktioniert, ist aber ein
  „Draufschauen", kein „Enthüllen".
- **Absicht:** *Die Truppe wird enthüllt wie eine Stadion-Choreo.* Das ist
  der Moment, für den die Seite gebaut ist.
- **Vorschlag — „Aufsteigen über die Karten-Wand":**
  1. Die Kamera startet (aus dem Anstoß) **tief hinter dem West-Tor / hinter
     dem Torwart** (`pos ~(−5.2, 1.5, 0)`), Blick nach Osten die Formation
     entlang — man sieht die Karten-Wand **von hinten/unten als
     aufragende Wand** (TW-Reihe zuerst, gestaffelt nach hinten hoch — passt
     exakt zur E2-Lift-Staffelung, die die Reihen als Bänder stapelt).
  2. Über den Scroll **steigt** die Kamera auf und schwenkt herum
     (`pos → ~(3.2, 4.6, 7.6)`, `look → (−1.4, 1.4, 0.4)`), bis die volle
     Formation frontal-schräg im Bild steht — **die Karten „wachsen" dem
     Besucher entgegen** statt einfach da zu sein.
  3. Endpose = ruhiger Präsentationsblick (nah an der heutigen Endpose, damit
     die E2-Komposition — 4 Bänder + Staff-Reihe unten — erhalten bleibt und
     die Tap-Ziele sitzen).
  - **Wirkung:** Reveal steigt (Grammatik-Regel 4), Held ist die Wand, Text
    links frei. Der Übergang Anstoß→Reveal wird EIN durchgehender Aufwärts-Zug.

### Station 3 · FANBLOCK (Südkurve)
- **Ist:** `pos (2.9, 1.55, 2.3) → look (3.7, 0.55, 4.0)` — Augenhöhe in die
  SO-Kurve auf Fans + AGA-URKNALL-Banner. **Register stimmt schon (Augenhöhe,
  Emotion).**
- **Absicht:** *Dazugehören.* Mittendrin in der Kurve.
- **Vorschlag:** Halten, nur **minimal näher heran und leichter Seitwärts-
  Drift** während des Scrollens (`z 2.3 → 2.7`), damit das Banner „weht" statt
  still zu stehen — Leben statt Standbild. Nav-Punkt-Artefakte = E9.

### Station 4 · MUSIK / Vereinsheim-Anflug (→ Party-Cut)
- **Ist:** `pos (4.6, 0.9, 1.5) → look (7.1, 0.5, −0.35)` — Anflug zur Tür,
  dann Dip-to-Black in den Partyraum. **Hier sitzt Katalog #5 (Barriere).**
- **Absicht:** *Eintreten.* Ein kontinuierlicher Zug durch die Tür, kein
  Anrempeln an Zaun/Wand.
- **Vorschlag (Konzept-Ebene; Umsetzung = P5-E4 `partyPath.ts`):** Anflug
  **auf die Tür-Mitte zentriert und in Kopfhöhe** (`y ~1.6` statt 0.9 — die
  0.9 lässt die Kamera in Zaun-/Sockelnähe skimmen). Kein Frame, in dem
  Nahgeometrie > 50 % des Bildes unscharf füllt. Der Cut kommt erst, wenn die
  Tür formatfüllend + scharf ist (Windfang aus Commit `afff159` trägt).

### Station 5 · TABELLE (Ergebnis-Beat)
- **Ist:** `pos (4.0, 0.95, 3.1) → look (7.15, 0.32, −0.5)` — ruhiger Blick
  aufs Vereinsheim hinter dem Ost-Tor.
- **Absicht:** *Sachlich, stolz.* Die harten Zahlen der Saison.
- **Vorschlag:** Register STANDPUNKT leicht anheben (`y 0.95 → ~1.8`), damit
  die H2 „DIE WAHRHEIT" nicht mehr unter das SVA-Logo läuft (Kollision aus
  Audit `desktop-14` — Feinschliff in E9) und der Blick „drübersteht".

### Station 6 · SPONSOREN (Banden-Zoom)
- **Ist:** `pos (−0.5, 0.86, 3.05) → look (−0.6, 0.12, 3.985)` — tiefer
  Banden-Zoom auf die Süd-Bande.
- **Absicht:** *Wertigkeit.* „Dein Logo hier" — die Bande als Werbeträger.
- **Vorschlag:** Halten, aber Bande **parallel ins Bild** (leichter
  Seitwärtsstand statt Frontal-Zoom), damit die Bande links nicht unscharf
  angeschnitten ist (Audit `desktop-15-sponsoren`) und der Chip „Kein
  Preisschild" nicht mit dem 3D-Banden-Text kollidiert (E9).

### Station 7 · KONTAKT / FINALE (Abschied & Einladung)
- **Ist:** `pos (2.2, 19.5, 8.4) → look (1.2, 0, −0.4)` — Rauszoom in die
  Vogelperspektive, Platz + Vereinsheim werden zur Standort-Karte.
- **Absicht:** *Einladen.* „Hier sind wir — komm vorbei."
- **Vorschlag:** Register VOGELFLUG behalten (Rauszoom ist richtig), aber der
  **Aufstieg soll die Choreo schließen** — ein weicher, langer Zug nach oben
  (kein Sprung), sodass das Gebäude NICHT als schwarzer Blob von oben liegt
  (Dach-Textur = E7) und die Copyright-Zeile nicht über dem Bodentext klebt
  (E9). Look leicht auf das Vereinsheim (`+x`) gewichten (der LocationMarker).

---

## 2. Was sich NICHT ändert (bewusst)

- Bogenlängen-Korrektur, Boden-/Decken-Clamp, Scroll-Reversibilität, die
  synthetische Anstoß-Station zwischen Verein und Mannschaft — die Mechanik
  ist gut und bleibt.
- Die Stationen bleiben an die DOM-Sektions-Zentren gepinnt (Anker-Messung in
  `useScrollProgress.ts`), damit Text und Kamera synchron ruhen.
- Die E2-Endkomposition der Mannschaft (4 Bänder + Staff-Reihe) bleibt die
  Zielpose von Station 2 — der Reveal führt genau dorthin.

---

## 3. Umsetzungs-Reihenfolge nach Freigabe

1. **Station 2 (Reveal)** zuerst — das ist Katalog #8, der größte Effekt.
   Konkret: Anstoß-Endpose (Station 1) + Mannschaft-Startpose als
   Aufwärts-Zug koppeln; Zielpose = E2-Komposition. Screenshot je 25 %-Schritt
   des Reveals gegen die Soll-Beschreibung.
2. Stationen 0, 5, 6, 7 als **Höhen-/Blick-Feinjustage** (kleine Deltas).
3. Station 4 (Party-Anflug) läuft als eigenes Paket **P5-E4** (partyPath).
4. Nach jedem Schritt: `scripts/shots.mjs`-Set an allen 7 Stationen + Vor-/
   Zurück-Scrub-Check (ruckelfrei), Preview für Marvin.

---

## 4. Offene Fragen an Marvin (GATE-11)

1. **Reveal-Richtung:** „Aufsteigen hinter dem West-Tor über die Karten-Wand"
   (Vorschlag oben) — oder lieber **seitlicher Kran-Schwenk** die Wand
   entlang (wie eine TV-Aufstellung, Kamera fährt an der Reihe vorbei)? Oder
   **Zufahrt von vorn** (Kamera kommt aus der Distanz frontal auf die Wand zu)?
2. **Höhen-Dramaturgie:** Ist der Dreiklang Vogelflug→Augenhöhe→Vogelflug in
   deinem Sinne, oder soll es durchgehend „drüberstehen" bleiben?
3. **Tempo:** Soll der Reveal langsam/feierlich (mehr Scroll-Weg) oder
   knackig sein?
4. **Fanblock-Drift & Sponsoren-Parallelstand:** gewünscht, oder Ruhe halten?

> Sobald du hier ein „so machen" / „so nicht, sondern …" gibst, setze ich
> **Station 2 zuerst** um und lege eine Preview-Screenshotserie des Reveals
> daneben.
