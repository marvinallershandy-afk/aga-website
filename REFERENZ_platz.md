# REFERENZ_platz — Drohnenmaterial 26.07.2026 aufbereitet (Planer, Stand 31.07.2026)

Quellmaterial: 2 DJI-Videos in `REFERENZ/`
- `dji_fly_20260726_132738_0269_…_video.mov` — 4K50, 75,5 s (Kurzvideo, Anstoß/Übersicht)
- `dji_fly_20260726_142818_0271_…_video.mov` — 4K50, 277,5 s (Hauptvideo, Spiel inkl. Freistoß-Seitfahrt)

Alle Standbilder in voller 4K-Auflösung (3840×2160, JPEG q=2). Kein Video verändert,
bestehende Ordner (`Spielerfotos/`, `frames/`, `higgsfield/`, Logos) unangetastet.

---

## 1. Erzeugte Standbilder + Verteilung

**216 Frames gesamt**, so extrahiert:
- Grundraster alle 5 s: `platz_001–055` (Hauptvideo), `platzk_001–015` (Kurzvideo)
- Dichte Abtastung 1 Bild/s in den Gebäude-Fenstern (**Dateinummer = Sekunde im Video**):
  - `geb_raw_148–232` — Hauptvideo t=148–232 s (Freistoß + seitliche Fahrt, Gebäude durchgehend im Bild)
  - `geb_raw_083–100` — Hauptvideo t=83–100 s (Bodenhöhe an der Bande; wenig brauchbar, s. u.)
  - `gebk_raw_018–060` — Kurzvideo t=18–60 s (Gebäude aus Distanz West)

Einsortierung:

| Ordner | Anzahl | Inhalt |
|---|---|---|
| `REFERENZ/gebaeude/` | 138 | Vereinsheim erkennbar (beste Serie: `geb_raw_148–232`) |
| `REFERENZ/platz_uebersicht/` | 38 | Platz-Totalen aus der Luft ohne/mit kaum Gebäude |
| `REFERENZ/details/` | 13 | Reling/Bande, Zuschauerweg, Klinker-Hütte aus Distanz, Bodentotalen |
| `REFERENZ/unbrauchbar/` | 27 | Wald pur, verdeckte Linse, Boden-Frames mit dominanten Gesichtern von Zuschauern (inkl. Kind) — als Referenz ungeeignet, aus Datenschutzgründen bewusst hierhin |

Hinweis PII: Das Zeitfenster t=83–100 s des Hauptvideos ist fast ausschließlich Nahaufnahme
von Zuschauern an der Bande (Gesichter klar erkennbar). Komplett nach `unbrauchbar/`
sortiert; für Modell-Zwecke nicht verwenden, ggf. löschen (Entscheidung Marvin).

## 2. Die 10 besten Gebäudeaufnahmen (alle in `REFERENZ/gebaeude/`)

1. **`geb_raw_232.jpg`** — beste Nahaufnahme (SW-Blick): Anbau-Front mit 5–6 blau-grau
   gerahmten Fensterachsen, Sitzbank davor, Mülltonnen an der SO-Ecke, fensterloser
   weißer Südgiebel mit Wetterspuren, bemooste Dachfläche, Backstein-Schornstein.
2. **`geb_raw_213.jpg`** — bester Gesamtblick: kompletter Komplex (hohe Halle Süd +
   niedriger Nordflügel + Flachdach-Anbau), Parkplatz mit Autos, Fahrradständer unter
   Vordach, Fachwerkhaus mit rotem Steildach nördlich, 3 Fahnenmasten, Ballfangzaun,
   weißes Auto im Hof direkt hinter dem Tor.
3. **`geb_raw_190.jpg`** — näherer SW-Blick: Anbau-Fensterband, Tor + Zaunverlauf,
   Kies-Hof, Dachkante/Traufe der Halle, Mülltonnen, Übergang zum Parkplatz.
4. **`platz_036.jpg`** — hohe Halbtotale: Halle mit Satteldach + Schornstein, Anbau,
   Terrassenzone mit Tischen zwischen Fassade und Zaun, „mohr sports"-Banner am Zaun,
   Strafraum davor, Dorfkontext (Schule, Fachwerkhäuser) dahinter.
5. **`gebk_raw_026.jpg`** — Achsblick von West über den ganzen Platz: N-S-Ausdehnung des
   Komplexes relativ zu Tor/Strafraum ablesbar, Fahnenmasten und Parkplatz links (nördlich).
6. **`gebk_raw_033.jpg`** — wie 5, etwas näher/tiefer: Verhältnis Anbauhöhe zu Hallenhöhe
   und die Staffelung Halle/Nordflügel gut erkennbar.
7. **`geb_raw_165.jpg`** — Mitteldistanz W-Blick: Gebäude + Ballfangzaun in einer Flucht,
   Sandweg am Zaun, Vordach-/Fahrradzone am Nordende.
8. **`geb_raw_155.jpg`** — höherer W-Blick mit viel Dorfkontext (Straße, Nachbarhäuser,
   Parkplatz-Zufahrt) — gut für Lage/Umfeld des Gebäudes.
9. **`platz_033.jpg`** — Halbtotale mit Pavillon/Zuschauern an der Nord-Reling und
   Gebäude hinter dem Ost-Tor — gut für die Gesamt-Raumbeziehung Platz↔Gebäude.
10. **`geb_raw_150.jpg`** — Beginn der Seitfahrt, Gebäude klein aber komplett mit
    Umgebung (Fachwerkhaus, Schuppen, Flaggen) — Kalibrier-Frame für Abstände.

Bonus Bodenperspektive: `platz_018–020` (in `gebaeude/`) zeigen die Anbau-Front von
Spielfeldhöhe über den Platz hinweg — einzige „Augenhöhe"-Sicht, aber mit Personen
prominent im Vordergrund.

## 3. Was das Material über das echte Gebäude sagt

- **Komplex aus drei Teilen**: (a) hohe 1,5-geschossige Halle am Südende — weißer/
  cremefarbener Putz, dunkles, stark bemoostes Satteldach (~30° Neigung), großer
  roter Backstein-Schornstein auf dem First (etwa im südlichen Drittel), kleine
  quadratische Fenster als Reihe im Obergeschoss; (b) **niedrigerer Nordflügel**
  (eingeschossig, flaches/blaugraues Dach) Richtung Parkplatz; (c) **Flachdach-Anbau
  über die gesamte Platzseite** (West) — Bitumendach, blau-graues/petrolfarbenes
  Fascia-Band, große Fenster mit blau-grauen Rahmen, Sitzbank, Regenfallrohre.
- **Firstrichtung ≈ Nord-Süd** (parallel zur Ost-Torlinie) — der Achsblick
  `gebk_raw_026/033` zeigt die Längsausdehnung quer zur Blickachse von West.
- **Lage**: hinter dem Ost-Tor, aber **deutlich nach Norden versetzt** — der Südgiebel
  endet etwa auf Höhe des Tores, der Komplex zieht sich nach Norden bis zum Parkplatz.
  Zwischen Zaun und Fassade: Sandweg + schmale Terrassenzone (Bänke, Tische), im
  Hof hinter dem Tor parkt ein Auto (Kies).
- **Südgiebel weitgehend fensterlos** (nur kleine Lüfter/Fensterchen oben).
- **Umfeld Nord/NO**: Parkplatz (6–10 Autos), Fahrradständer mit Vordach/Pavillon am
  Nordende des Anbaus, 3 Fahnenmasten (2× Deutschland, 1× blaue Flagge) **am Parkplatz,
  nicht am Platz**, dahinter Fachwerkhaus mit steilem roten Ziegeldach an der Straße,
  weitere Dorfhäuser (u. a. große rote Klinkergebäude/Schule), alter bemooster
  Ziegel-Schuppen + Sandfläche mit Basketballkorb und Minitor nordwestlich des Parkplatzes.
- Zuschauer + Pavillon an der **Nord-Reling**, „mohr sports"-Banner am Ost-Ballfangzaun
  **südlich des Tores**, rote Klinker-Hütte an der NW-Ecke (bestätigt Modell-Annahme).

## 4. Lückenliste — was fürs Gebäudemodell FEHLT (wichtigste Ausgabe)

1. **Eingang/Tür nirgends klar im Bild.** Der wahrscheinliche Eingang liegt am
   Nordende des Anbaus / an der NW-Ecke Richtung Parkplatz (dort sammeln sich Räder,
   Vordach, Personen) — aber keine einzige Aufnahme zeigt die Tür frontal. Die
   Modell-Tür („blaue Tür an der Platzseite") ist mit diesem Material **nicht
   verifizierbar**. Das 2018er Boden-Foto (blaue Türen) bleibt die einzige Quelle.
2. **Nord- und Ostseite fehlen komplett.** Alle Flüge blieben über dem Platz (West/SW).
   Rückseite (Ost, zum Wald) und Nordfassade (Parkplatzseite mit Eingang): 0 Bilder.
3. **Keine Detail-Distanz.** Nächste Aufnahme (geb_raw_232) ist ~50–70 m entfernt;
   Fensterteilung, Türfarbe, Sockelmaterial (Klinker?), Beschilderung sind nur zu erahnen.
4. **Höhen nicht direkt messbar.** Traufe/First lassen sich nur relativ schätzen
   (Traufe Halle ~4–4,5 m, First ~7,5–8,5 m, Anbau ~3 m) — kein Vorbeiflug auf
   Traufhöhe, keine Frontalansicht als „Fassadenabwicklung".
5. Südgiebel nur schräg und teils von Bäumen angeschnitten.

### Konkrete Flugempfehlung für den nächsten Flug (10–15 min, am besten ohne Betrieb)

1. **Langsame 360°-Umrundung des Vereinsheims** auf ~10–12 m Höhe (knapp über First),
   Radius ~25 m, Kamera leicht geneigt — liefert alle 4 Seiten + Dachkanten in einem Take.
2. **Tiefer Vorbeiflug auf Traufhöhe (~4–5 m)** an der Westfront (Platzseite) und um
   die Nordseite herum; **am Eingang 3–5 s frontal stehen bleiben** (Tür formatfüllend).
3. **Je eine orthogonale Frontalaufnahme pro Fassade** (W, N, S, wenn möglich O):
   schwebend, Kamera waagerecht auf halber Fassadenhöhe, ganze Fassade im Bild —
   das sind die eigentlichen Modellier-/Textur-Referenzen („Aufriss").
4. **Ein Nadir-Blick (senkrecht von oben)** über dem Gebäude für den Dach-Grundriss
   (L-Form Halle+Anbau+Nordflügel, Schornstein-Position).
5. **Eine hohe Totale von West** (~40–50 m) mit ganzem Platz + Gebäude in einem Bild
   zur Maßstabs-Kalibrierung (Tor = 7,32 m als Referenzmaß im Bild).
6. Stills im Vorbeigehen (Handy reicht): Tür, Fascia-Band, Fensterrahmen, Sockel,
   Schornstein, Vereins-Beschilderung; dazu die Klinker-Hütte NW von 2 Seiten.
   Diffuses Licht (bedeckt) ist ideal; Menschen vermeiden (Datenschutz + saubere Referenz).

## 5. Abweichungen aktuelles 3D-Modell vs. Realität (nur Befund, kein Umbau)

Basis: `src/components/Clubhouse.tsx` (CLUBHOUSE_POS x=7.15/z=−0.85, LEN=5.6, DEPTH=0.85,
EAVES=0.34, RISE=0.24, ANNEX_H=0.24), Maßstab 1 Unit = 10 m; ferner `BrickHut.tsx`,
`BallStopFence.tsx`, `REFERENZ_MODELL.md`.

**Was stimmt (bestätigt):**
- Lage hinter dem Ost-Tor, Firstrichtung N-S, weiße Fassade, dunkles Satteldach,
  Backstein-Schornstein, Flachdach-Anbau mit blauem Band zur Platzseite, Ballfangzaun
  mit mohr-sports-Banner, Klinker-Hütte NW, Zuschauer an der Nord-Reling. Die
  Grundidee des Modells ist richtig.

**Erkennbare Abweichungen (nach Sichtbarkeit priorisiert):**
1. **Zu lang und zu schlank**: Modell-Halle = 56 m × 8,5 m (LEN 5.6 wurde in v11-E3
   bewusst über die dokumentierten ~42 m hinaus verlängert). Real ist die hohe Halle
   eher ~25–30 m lang, aber ~12–14 m tief; der Gesamtkomplex inkl. Nordflügel kommt
   auf ~35–40 m Frontlänge. Wirkung im Modell: gestreckter Riegel statt kompakter Halle.
2. **Zu niedrig**: Traufe 3,4 m / First 5,8 m im Modell vs. real ~4–4,5 m / ~7,5–8,5 m.
   Die reale Halle ist ein markant hoher Baukörper (Mehrzweckhalle), das Modell wirkt
   wie ein Flachbau.
3. **Nordflügel fehlt**: Real ist der Komplex gestaffelt (hohe Halle Süd + niedriger
   Flügel Nord + Anbau West). Das Modell kennt nur Halle + dünnen Anbau.
4. **Position/Versatz**: Modellkorpus spannt z≈−3.65…+1.95 (reicht ~19 m südlich der
   Platzachse). Real endet der Südgiebel etwa auf Tor-Höhe und alles Weitere liegt
   nördlich — das Modell steht ~15–20 m zu weit südlich verteilt.
5. **Fassade Platzseite**: Modell malt ein durchgehendes EG-Fensterband mit warmen
   Fenstern auf die HALLE; real hat die Halle oben kleine quadratische Einzelfenster,
   die großen Fenster sitzen im ANBAU (blau-graue Rahmen). Der gemalte Klinker-Sockel
   ist aus der Luft nicht verifizierbar.
6. **Südgiebel**: Real fast fensterlos mit Wetterspuren — im Modell hängt dort
   Fensterband + beleuchtetes Vereinsschild (Schild = bewusste CI-Freiheit, ok,
   aber der Giebel darunter sollte „blank" lesen).
7. **Fahnenmasten**: Modell flankiert mit 2 Masten die Tür an der Platzseite; real
   stehen 3 Masten (2× Deutschland, 1× blau) am Parkplatz nördlich — von den
   Kamerastationen aus kaum sichtbar. (SVA-Flagge = künstlerische Freiheit.)
8. **Terrasse**: Biertisch-Reihe direkt an der Fassade stimmt der Idee nach; real
   liegt zwischen Fassade und hohem Ballfangzaun zusätzlich ein Sandweg — die
   Terrassenzone ist schmaler und liegt HINTER dem Zaun (vom Platz aus).
9. **Dach**: Stehfalz-Textur im Modell; real alte, stark bemooste dunkle Deckung
   (Wellplatten/Pappe) mit sichtbaren Flecken — für Exposé-Anmutung reicht eine
   moosig-gescheckte Textur statt Metallfalz.
10. **Tür**: Modell-Tür an der Platzseite (Welt z≈−2.5) ist plausibel, aber unbelegt;
    reale Eingangssituation vermutlich NW-Ecke/Parkplatzseite → **nicht mit diesem
    Material korrigierbar** (siehe Lücken).
11. Kleinigkeiten Umfeld: bemooster Schuppen + Sandplatz mit Basketballkorb NO fehlen
    (optional); weißes parkendes Auto im Hof hinter dem Tor (charmantes Detail, optional).

**Mit vorhandenem Material korrigierbar:** Punkte 1–9 (Proportionen, Staffelung,
Versatz, Fensterlogik, Giebel, Masten-Umzug, Dachtextur) — die Frames aus
`gebaeude/` reichen dafür aus.
**Braucht neues Material:** Punkt 10 (Tür/Eingang), Nord-/Ost-Fassade, alle
Textur-Details in Nahdistanz, exakte Höhen.

## 6. Aufwandsschätzung Überarbeitung (Builder)

| Paket | Inhalt | Aufwand |
|---|---|---|
| A (🔴) | Baukörper: LEN/DEPTH/EAVES/RISE anpassen, Nordflügel ergänzen, Komplex nach Norden schieben; `CLUBHOUSE_POS` + `DOOR` in `camera/partyPath.ts` + Kamera-Anflug synchron nachziehen (Tür-Transit hängt daran!) | 0,5–1 Tag |
| B | Fassaden-/Dachtexturen nach Referenz (Anbau-Fensterraster blau-grau, kleine OG-Quadratfenster, Moos-Dach, blanker Südgiebel) | ~0,5 Tag |
| C | Umfeld: Masten an den Parkplatz, Parkplatz-/Fachwerkhaus-Andeutung, optional Schuppen+Sandplatz NO | ~0,5 Tag |
| D | Tür/Eingang korrekt | erst nach neuem Flug |

Risiko bei Paket A: Der gesamte Tür-Flug (Windfang, DoorDust, LightPools, partyPath)
ist auf die heutige Geometrie kalibriert — Änderung ist kein reiner Zahlendreh,
sondern braucht einen Kamera-Retest.

## Entscheidungs-Gates für Marvin (nicht geraten, bitte entscheiden)

1. **Tür-Position**: Beim Ist-Stand lassen (Platzseite, dramaturgisch stark) oder auf
   die real vermutete Parkplatz-/NW-Seite verlegen (dann neuer Flug nötig + Kamera-
   Choreografie ändert sich deutlich)?
2. **PII**: Die 27 Frames in `REFERENZ/unbrauchbar/` (Gesichter von Zuschauern, inkl.
   Kind) löschen oder behalten? Empfehlung: löschen.
3. **Detailtreue vs. Exposé-Stil**: Sollen Nordflügel + Parkplatz-Umfeld ins Modell
   (mehr Realismus hinter dem Tor) oder bleibt der Fokus auf der Platzseite?
4. Die großen Videodateien (1,5 GB gesamt) im Repo lassen oder auslagern? (gitignore
   regelt der Leitstand — aber Speicherort-Entscheidung steht aus.)
