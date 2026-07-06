# SVA-FUSSBALL — Master-Prompt v5: DER KINO-LAUF (autonom, Fable 5)

> **An Claude Code:** Speichere diesen Plan als `SVA_PLAN_V5.md`. Autonom, Gate für Gate, Commit + Push (Remote sollte jetzt stehen — fehlt es weiterhin: STOPP nach Etappe 0 und melden, es liegt zu viel ungesicherte Arbeit vor) + Screenshots (Präfix v5-). ARBEITSMODUS SPARSAM. Leitplanken unverändert: 60 FPS (am Netzteil messen — Batterie drosselt, siehe v4-Fußnote), reduced-motion/Fallback intakt, SVA-CI, nur CC0 + Marvins Assets.
>
> **Auftrag in einem Satz:** Von „sieht gut aus" zu „sieht aus wie ein Film" — Marvins Diagnose: aktuell 480p-Vibe, Ziel ist 4K-Vibe. Der Hebel ist die Kino-Ebene (Post-Processing, Grading, Kamera-Sprache, Mikro-Detail), nicht mehr Geometrie.

**HIGGSFIELD-MANDAT (begrenzt):** Higgsfield-MCP (KI-Bildgenerierung) verfügbar. Erlaubte Zwecke: (1) Kino-Referenzframes als Look-Messlatte für Grading/Loops, (2) 2D-Assets: Poster-/Wand-Art für den Partyraum im AGA-URKNALL-Vibe, ein starkes OG-Bild. NICHT erlaubt: Videos, Texturen-Massenproduktion, Experimente außerhalb der Zwecke. Harter Deckel: max. 8 Generierungen im gesamten Lauf. Alles nach `REFERENZ/higgsfield/`, im Abschlussbericht listen (Prompt + Verwendungsort). Nicht endlos neu würfeln — ohne weitermachen, als Marvin-To-do notieren.

## 0. Etappe 0 — Inputs & Korrektur-Verständnis

1. `REFERENZ/Spielerfotos/` sichten (Beispiel-Fotos für die Karten-Pipeline — Qualität/Formate notieren).
2. Git-Remote prüfen (siehe oben).
3. Marvins vier Korrekturen aus dem v4-Review verstehen und im Plan verorten (unten wörtlich spezifiziert).
**🟢 Gate 0:** Foto-Befund + Remote-Status dokumentiert.

## 1. Etappe 1 — Die drei Präzisions-Korrekturen (Marvins Review, wörtlich)

1. **Kamerahöhe:** Die Fahrt geht beim Scrollen zu tief auf den Rasen — das sieht nicht gut aus. Definiere eine Mindest-Kamerahöhe über Rasenniveau für die gesamte Fahrt (Ausnahme: der bewusste Sturzflug-Beat, aber auch der endet in einer kontrollierten, komponierten Höhe statt „im Gras"). Alle Stationen danach neu framen und als Screenshots belegen.
2. **Fanblock-Torseite:** Die Fans mit Banner stehen auf der richtigen Seite des Platzes, aber am **falschen Tor-Ende**. Verschiebe den Fanblock entlang derselben Seite ans andere Tor-Ende. Gleiche REFERENZ_MODELL.md dagegen ab und korrigiere ggf. dort den Eintrag (Marvins Aussage ist die Wahrheit); Finale-Kamerafahrt entsprechend anpassen.
3. **(Vorbereitung für Etappe 2)** Prüfe die aktuelle Vereinsheim-Geometrie gegen die Raumbeschreibung unten — was muss für eine echte Durchfahrt modelliert werden (Tür, kurzer Flur, Türöffnung rechts)?
**🟢 Gate 1:** Vorher/Nachher-Screenshots Kamerahöhe an 3 Stationen + Fanblock am korrekten Tor-Ende, Frametime gehalten.

## 2. Etappe 2 — Partyraum-Anflug: echte Durchfahrt statt Schnitt

Marvins Feedback: Der Übergang in den Musikbereich kommt nicht flüssig mit der Fahrt ins Gebäude. Der Dip-to-Black wird ersetzt durch eine **kontinuierliche Kamerafahrt**, gebaut nach seiner Raumbeschreibung (verbindlich):
- Man kommt **am Gebäude rein** (Tür), dann **rechts in den Raum**.
- Der Raum ist **quadratisch**.
- Beim Reinkommen steht der **Tresen hinten an der linken Seite** (aus Sicht in den Raum schauend).
Umsetzung: Tür öffnet sich beim Anflug (oder steht einladend offen mit Lichtschein), Kamera fliegt durch die Tür, kurze Rechtskurve in den Raum, endet in einer komponierten Raum-Totale mit Tresen hinten links. Scroll-getrieben und rückwärts sauber (rausfahren = denselben Weg zurück). Der Innenraum bleibt lazy-geladen — Preload triggert beim Annähern ans Gebäude, damit die Durchfahrt ohne Ruckler läuft (Preload-Timing beweisen). Licht-Übergang statt Schwarzblende: von Flutlicht-Nacht zu warmem Innenlicht innerhalb der Durchfahrt. Audio-Crossfade (Atmo→Musik) an die Fahrt gekoppelt statt an den Schnitt. Reduced-motion/Fallback: dort bleibt der Dip-to-Black als sanfte Variante.
**🟢 Gate 2:** Durchfahrt rein und raus flüssig (Frametime-Beweis während der Passage), Raum-Layout entspricht der Beschreibung (Screenshot aus Eingangsperspektive: quadratischer Raum, Tresen hinten links), kein Lade-Ruckler (Preload belegt).

## 3. Etappe 3 — Die Kino-Ebene (der Kern dieses Laufs)

Baue die Post-Processing- und Grading-Pipeline (`@react-three/postprocessing`) — jeder Effekt einzeln zuschaltbar (Debug-Panel, Taste), jeder muss sein Frametime-Budget verdienen:
1. **Selektives Bloom** auf Emissive-Flächen (Flutlicht-Lampen, Neon im Raum, Fenster) — dezent, kein Glow-Matsch.
2. **Color-Grading:** ein durchgängiger Film-Look (kühle Nacht-Schatten, warme Lichtquellen, sanfte S-Kurve, leicht entsättigte Mitten) — als LUT oder Grading-Pass; EIN Look für die ganze Außenwelt, ein wärmerer Schwester-Look im Partyraum.
3. **Vignette + feines Filmkorn** (kaum sichtbar, aber fühlbar) + optional minimale chromatische Aberration an den Rändern.
4. **Licht in der Luft:** Godray-/Lichtschaft-Andeutung an den Flutlichtern (fake, budget-schonend), Staub-/Insekten-Partikel in 1–2 Lichtkegeln, feine Bodennebel-Schicht in der Tiefe.
5. **Kamera-Sprache:** kaum merkliches organisches Kamera-Atmen (Idle-Sway), weichere Beschleunigungskurven zwischen Stationen, **Letterbox-Balken (21:9) die beim Anstoß-Beat sanft einfahren** und danach wieder verschwinden — der Beat wird damit offiziell Kino.
6. **Tiefenschärfe** nur an 1–2 komponierten Momenten (z.B. Raum-Ankunft: Tresen scharf, Vordergrund weich) — kein Dauereffekt.
7. **Mikro-Detail-Pass** wo die Kamera nah kommt: Rasen-Nahbereich, Banner-Stoffgefühl, Tresen-Oberfläche.
**Mobile-Strategie:** Effekt-Kette in zwei Qualitätsstufen (voll/reduziert) mit Geräte-Heuristik — Mobile bekommt Grading+Vignette+Korn sicher, teure Effekte nach Budget.
Falls in `REFERENZ/kino-referenzen/` Ziel-Frames liegen (optional, ggf. später von Marvin): nutze sie als Look-Messlatte in den Loops.
**🟢 Gate 3:** Vorher/Nachher-Paare an 4 Stationen (mit/ohne Kino-Ebene), Frametime-Tabelle pro Effekt, beide Qualitätsstufen belegt, 60 FPS am Netzteil.

## 4. Etappe 4 — Spielerfotos in die Karten

Die Beispiel-Fotos aus `REFERENZ/Spielerfotos/` durch die Duotone-Pipeline (Variante A) in die Karten bringen: Zuordnung Foto→Spieler (Dateinamen/bestes Matching, sonst als Beispiel-Spieler), automatischer Beschnitt auf Karten-Ausschnitt (Kopf/Oberkörper, Focal oben), Pipeline-Doku in README („so kommen die restlichen Fotos rein: Datei nach Schema X, fertig"). Prüfe, ob die Duotone-Behandlung mit echten Fotos hält, was sie versprach — wenn Feinjustage nötig (Kontrast, Ton-Mapping der Haut), jetzt machen. Ein Karten-Screenshot mit echtem Foto neben Silhouetten-Karte: der Unterschied ist das Argument für die restlichen Fotos.
**🟢 Gate 4:** Mind. 2 Karten mit echten Fotos gerendert, Pipeline-Doku steht, Grid-Performance unverändert.

## 5. Etappe 5 — Jury-Loops, Messlatte KINO

Wie v4-Loops (screenshotten → 3-Rollen-Scores → Top-5 fixen), aber die Juror-Frage verschärft: **„Könnte dieses Frame ein Still aus einem Sportfilm sein?"** Mindestens 2, maximal 3 Loops. Abbruch: alle Scores ≥ 9,0 oder zwei Loops ohne messbare Verbesserung (dann ehrlich: was braucht externe Assets/Marvins Blick).
**🟢 Gate 5:** Score-Verlauf fortgeschrieben, finale Restliste.

## 6. Etappe 6 — Abschluss

Push, Screenshot-Set, Perf-Tabelle v4→v5 (am Netzteil!), Abschlussbericht im 6-Punkte-Format + Score-Verlauf + „was echte Kino-Referenzen/weitere Fotos noch freischalten" + Netlify-Deploy als empfohlener nächster Schritt.

## Nicht in diesem Lauf
Deployment, Supabase/Admin, neue Sektionen, Stilwechsel (Look ist gesetzt — er wird verfilmt, nicht ersetzt).

---
**Los. Erst die drei Korrekturen, dann die Durchfahrt, dann wird's Kino. Jeder Effekt verdient sein Budget, jedes Frame will ein Film-Still sein. Am Ende: Abschlussbericht mit Vorher/Nachher-Beweisen.**

---
---

# ETAPPE 0 — BEFUND (Gate 0, 2026-07-06)

## 0.1 Foto-Befund: `REFERENZ/Spielerfotos/`

5 Dateien, alle WebP, professionelle Qualität:

| Datei | Auflösung | Format |
|---|---|---|
| Carsten.webp | 1920×2400 | 4:5 Hochformat |
| Eli.webp | 1920×2400 | 4:5 Hochformat |
| Julio.webp | 1920×2400 | 4:5 Hochformat |
| Lennard.webp | 1920×2402 | 4:5 Hochformat |
| Tino.webp | 1920×2400 | 4:5 Hochformat |

Sichtprüfung (Tino.webp): professionelles Portrait, verschränkte Arme, unscharfer
Rasen-/Wald-Hintergrund, Gesicht im oberen Drittel, Trikot mit echtem Vereinswappen.
**Konsequenz für Etappe 4:** einheitliches Format → deterministischer Beschnitt möglich
(Focal-Point oben zentriert, Crop auf Kopf/Oberkörper). Dateiname = Spielername
(Vorname) → Matching gegen Seed-Daten über Vornamen. Der grüne Torwart-/Rasenton
in manchen Fotos ist für die Duotone-Pipeline irrelevant (wird auf Rot/Schwarz gemappt),
aber Haut-Kontrast muss geprüft werden.

## 0.2 Remote-Status

**`git remote -v` ist LEER — kein Remote konfiguriert.** Laut Plan-Anweisung:
**STOPP nach Etappe 0.** Die gesamte Arbeit (v1–v4, alle Commits) liegt nur lokal vor.

## 0.3 Verortung der vier Korrekturen (Code-Karte)

1. **Kamerahöhe** → `src/camera/CameraPath.ts:16-33` (`STATIONS`-Array, CatmullRom).
   Zu tiefe Y-Werte: ANSTOSS y=0.26 (= bewusster Sturzflug-Beat, endet aber „im Gras"),
   MUSIK y=0.60, KONTAKT y=0.80, TABELLE y=0.85. Plan: Mindesthöhe (ca. y≥0.9) als
   Konstante + Clamp im Curve-Sampling; Sturzflug-Beat endet kontrolliert auf der
   Mindesthöhe statt auf 0.26. Reframing danach über `look`-Targets.
2. **Fanblock-Torseite** → `src/components/FanBlock.tsx:15-16`: `CX = -3.6` (Süd-Reling,
   **West**-Ende). Marvins Korrektur: gleiche Seite (Süd), aber **Ost**-Ende (Richtung
   Vereinsheim-Tor) → `CX = +3.6` (Feinjustage wegen Ballfangzaun/Flutlichtmast prüfen).
   `REFERENZ_MODELL.md:46` („FANBLOCK-Ecke: SÜDWEST") und `:97` werden auf **SÜDOST**
   korrigiert — Marvins Aussage ist die Wahrheit; die offene Frage 2 dort ist damit
   beantwortet. Finale-Kamera: Station KONTAKT (`CameraPath.ts:31-32`) neu framen.
3. **Partyraum-Durchfahrt (Etappe 2)** → Ist-Zustand: PartyRoom ist eine
   „Pocket-Dimension" bei y=−40 (`PartyRoom.tsx:14`), Kamera-Schnitt in
   `CameraRig.tsx:43-54`, Dip-to-Black + Audio-Umschaltung scrollgetrieben in
   `ui/PartyDirector.tsx`, Lazy-Load in `Scene.tsx:23,57-61`. Das Vereinsheim
   (`Clubhouse.tsx`, Position x=7.15/z=−0.3 hinter dem Ost-Tor) hat eine blaue Tür zur
   Platzseite (L186-189), aber **keinen Innenraum, keinen Flur, keine Türöffnung** —
   für die echte Durchfahrt muss modelliert werden: Türblatt (öffnend oder offen mit
   Lichtschein), kurzer Flur hinter der Tür, Türöffnung **rechts** in einen
   **quadratischen** Raum mit **Tresen hinten links** (aus Eingangssicht). Entscheidung
   für Etappe 2: Innenraum vom Pocket-Standort in das Gebäude verlegen ODER nahtloser
   Teleport im Türrahmen (Kamera-Pfad kontinuierlich, Welt wechselt im verdeckten
   Frame) — wird in Etappe 2 nach Perf-Test entschieden.
4. **Kino-Ebene (Etappe 3)** → `@react-three/postprocessing` ist **noch keine
   Dependency** (nur drei/fiber/drei); Bloom bisher als Fake-Glow-Sprite
   (`Floodlights.tsx`). Canvas/Renderer: `Stage.tsx:35-51` (ACESFilmic, Exposure 1.15,
   DPR-Clamp 2). Debug-Infrastruktur vorhanden: Taste „p" = Perf-Overlay
   (`App.tsx:42-48`) → wird zum Effekt-Debug-Panel erweitert. Qualitätsstufen:
   bisher nur binärer Fallback (WebGL/reduced-motion → `StaticBackdrop`), keine
   Mobile-Tier-Heuristik → `utils/device.ts:getDeviceInfo()` existiert als Basis.

## 0.4 Higgsfield-Mandat

Verbucht: 0 von max. 8 Generierungen. Zielordner `REFERENZ/higgsfield/` wird bei
erster Nutzung angelegt. Geplante Einsätze: Kino-Referenzframes (Etappe 3/5),
Partyraum-Wand-Art + OG-Bild (Etappe 3/5).

**🟢 Gate 0 erreicht — aber STOPP wegen fehlendem Remote (Plan-Anweisung).**
