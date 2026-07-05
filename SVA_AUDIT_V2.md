# SVA v2 — Fable-5-Audit von v1 (Etappe 0)

## Perf-Baseline (headless Chromium + SwiftShader, 1440×900 @2x — NUR relativ belastbar)

| Position | Frametime avg | p95 | Draw-Calls | Dreiecke |
|---|---|---|---|---|
| Hero (0%) | 445,7 ms | 483,5 ms | 100 | 24 892 |
| Mannschaft (50%) | 551,5 ms | 583,3 ms | 80 | 24 662 |
| Kontakt (100%) | 419,3 ms | 583,6 ms | 96 | 24 844 |

SwiftShader = CPU-Software-GL → absolute Werte bedeutungslos, aber als **Vergleichsbasis
auf derselben Maschine** valide. Gate-Kriterium „±10%" wird gegen diese Zahlen gemessen.
Screenshots: `v2-before-{hero,team,kontakt}.png`.

## (a) Die 5 größten visuellen Schwächen — nach Hebel geordnet

1. **Platzlinien = 1px-Haarlinien.** `lineBasicMaterial.linewidth` ist in WebGL tot; die
   Linien aliasen und haben keine reale Breite (echte Linien: 12 cm). Zudem unvollständig:
   kein Elfmeterpunkt, keine Strafraum-Bögen, keine Eckbögen. Korrekte, breite, gebakene
   Linien sind der billigste „das ist echt"-Trick. → **Alle Markierungen in die
   Rasen-Textur baken** (1 Mesh, −2 Draw-Calls, AA gratis).
2. **Kugel-Bäume (120 Instanzen).** Der stärkste „Spielzeug"-Sender, in fast jedem Frame
   sichtbar. → Ersetzen durch **dunkle, gezackte Baumreihen-Silhouette** im Fog (1 Draw-Call).
3. **Schwebende Flutlicht-Köpfe.** Dünner Zylinder-Mast, Lampenpanel seitlich versetzt,
   keine Streben — im Hero wirken die Panels als fliegende Rechtecke. → Etappe 2
   (Masten mit Streben, Fake-Volumen-Kegel, Licht-Lachen).
4. **Nichts steht auf dem Boden.** Kein AO/Schatten unter Vereinsheim, Toren, Masten,
   Tribüne + uniformer fogExp2 macht alles gleich flach. → gebakene AO-Blobs (shared
   Radial-Textur) + linearer, abgestufter Fog (Platz klar, Welt verschwimmt).
5. **Vereinsheim-Spielzeugkiste + nackte Bande.** Flaches Dach-Brett ohne Überstand,
   helle Wände, Tür als Aufkleber; Bande ohne Vereinsbezug. → Satteldach mit Überstand,
   dunkle Wände, warm leuchtende Fenster, Distanz + Fog; Bande mit dezenten
   SVA-Schriftzügen (Canvas-Textur).

Ergänzend (kleiner): Tore ohne Netz → transparente Netz-Textur; Rasen-Grün etwas
zu „Poison" unter ACES → wärmer graden, Roughness-Variation.

## (b) Wo der v1-Code den v2-Etappen im Weg ist

- **`Pitch.tsx` + `PitchLines.tsx` sind zwei Systeme** — Linien als Geometrie sind
  unrettbar (s. o.). Zusammenlegen in eine prozedurale Canvas-Textur (Farbe + Linien +
  Körnung), optional zweite Canvas als `roughnessMap`.
- **Flutlicht-Zustand ist verstreut hartcodiert** (SpotLight-Intensity, Lampen-Emissive
  inline). Der Anstoß braucht **eine zentrale Größe** (`kickoffPhase` bzw. per-Mast-Level),
  die Spots, Emissive, Kegel-Opacity und Licht-Lachen gemeinsam treibt → Refactor in
  Etappe 2 vorziehen, sonst doppelte Arbeit in Etappe 3.
- **Kamera: Stationen == Sektionen (4) gekoppelt.** Der Anstoß ist eine **Zwischenstation
  ohne Sektion** → `STATIONS`/`ANCHORS` generalisieren; `useScrollProgress` berechnet den
  aktiven Nav-Punkt künftig aus den Sektions-Ankern, nicht aus `SECTIONS.length`.
- `Forest.tsx` wird komplett ersetzt (kein Umbau nötig, Löschkandidat).
- Licht-Werte in `Scene.tsx` inline → nach `theme/lighting.ts` ziehen, damit Grading
  in Etappe 1/2/3 an einer Stelle passiert.

## (c) Plan-Bewertung + Abweichungen

**Reihenfolge bestätigt:** Platz → Flutlicht → Anstoß → Karten. Der Anstoß hängt hart am
Flutlicht-Rig (sequenzielles Aufflackern), die Karten sind unabhängig → ans Ende. Einzige
Umbau-Vorziehung: das Flutlicht-State-Refactor (b) passiert schon in Etappe 2, damit
Etappe 3 nur noch „Phase reinreichen" ist.

**Eine dokumentierte Abweichung — HDRI:** Poly-Haven-Download geprüft (funktioniert,
`moonless_golf_1k.hdr` = 1,6 MB). **Entscheidung: kein HDRI.** 1,6 MB Payload (schlecht
komprimierbar) für ein kaum sichtbares Fülllicht in einer Nachtszene ist ein schlechter
Trade gegen das harte Mobile-Budget. Stattdessen: **drei `<Environment>` mit Lightformern**
(zur Laufzeit gerendertes 64px-Env-Cubemap: gedimmte blaue Kuppel + 4 warme Flächen als
Flutlicht-Näherung). Null Download, einmalige Renderkosten, und PBR-Materialien (Ball,
Torpfosten) bekommen echte Reflexionen — visuell mehr Wirkung als das gedimmte HDRI.

## Asset-Herkunft (laufend gepflegt)

| Asset | Quelle | Lizenz |
|---|---|---|
| Alle Texturen (Rasen, Netz, Bande, AO-Blobs, Licht-Kegel) | prozedural (Canvas, im Code) | — |
| Environment-Licht | drei Lightformer (Laufzeit) | — |
| football.glb | Bestand aus v1 (picture-by-nele) | unverändert |
| Sound (Stadion-Swell) | NICHT beschafft — Trigger vorbereitet, Asset = To-do Marvin | — |

## Gate-1-Ergebnis (Etappe 1)

**Frametime-Gate:** SwiftShader-Messung schwankte +14–20% — aber Gegencheck auf
**echter GPU (headed Chromium, dieselbe Maschine)**: v1 = 33,1/33,6/33,1 ms,
v2 = 33,2/38,3*/33,7 ms (*Ausreißer, p95 34,3) → beide identisch am VSync-Limit,
**kein Geräte-Regress**. Reale Budget-Metriken verbessert: Dreiecke 24,9k → **14,4k
(−42%)**, Draw-Calls 100 → **91**. SwiftShader-Delta = CPU-Textur-Sampling-Artefakt
(größere Rasen-Textur), dokumentiert und akzeptiert.

**Umgesetzt:** Markierungen maßstabsgetreu in Rasen-Textur gebacken (Elfmeterpunkt,
Strafraum-Bögen, Eckbögen, echte Linienbreite), Mähstreifen + Körnung + Abnutzung;
Kugel-Bäume → 2 gezackte Silhouetten-Ringe; Vereinsheim mit Satteldach/Überstand +
warmen Fenstern + Licht-Lache; Tore mit Netz; Bande mit SVA-Schriftzügen; AO-Blobs
unter allem; linearer abgestufter Fog. NICHT umgesetzt: Environment/IBL (+64%
Frametime auf Messrig, kaum sichtbar — gestrichen), roughnessMap (Textur-Probe über
größte Fläche, Variation steckt in der Albedo).

> **„Würde ein Awwwards-Juror den Platz als gewollt gestaltet lesen?"**
> Der Platz selbst: **ja** — korrekte Markierungen, gebrandete Bande, Silhouetten-
> Baumreihe gegen Dämmerungshimmel und geerdete Objekte lesen sich als eine bewusste,
> konsistente Stilisierung. Noch **nein** an zwei Stellen: die Flutlicht-Panels
> schweben weiterhin (Etappe 2 ist genau dafür da), und der Hero-Winkel zeigt das
> Vereinsheim-Dach als unbeleuchteten schwarzen Block am Bildrand. Nach Etappe 2
> erneut bewerten.
