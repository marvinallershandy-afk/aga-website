# REFERENZ_MODELL — Sportplatz Agathenburg (rekonstruiert aus REFERENZ/)

Quellenlage: 71 Videos → 421 Frames (`REFERENZ/frames/<video>/fNNN.jpg`),
2 Satelliten-Screenshots, 1 Boden-Foto (Google Maps), 3 DJI-Fotos, Logo, 2 Cover.
Koordinaten: 53.5605 N, 9.527 O (Google-Maps-URL im Screenshot).

## Kompass & Grundgeometrie

- **Platz-Längsachse verläuft O–W** (leicht rotiert, Westende minimal nach Süd).
  Beleg: `Google Maps Draufblick.png` (Norden oben, Platz liegt quer),
  `Apple Karten Draufblick.png` (N-Pfeil, grünes Rechteck).
- **Ein einziger Rasenplatz**, keine Tribüne, umlaufende **niedrige Barriere**
  (verzinkte Rohr-Reling, dunkle Pfosten). Beleg: `IMG_6074/f001`,
  `dji_…142322_0155…/f020.jpg`, `dji_…143242_0162…/f001.jpg`.
- **Wald umschließt Süd + Südwest + Ost** (hoher Buchen-/Mischwald, Platz ist in
  den Waldrand geschnitten). Beleg: Satellit + praktisch jedes Drohnen-Frame.
- **Norden: offen zum Dorf** (rote Dächer, Schulstraße), einzelne Bäume.
  Beleg: `dji_…142306_0154…/f001`, Satellit.

## Bauwerke

1. **Vereinsheim/Mehrzweckhalle — hinter dem OST-Tor** (Geometrie-Anker!):
   langgestreckt, 1,5-geschossig wirkend, **weiße Fassade**, **flaches dunkelgraues
   Satteldach** mit **breitem Ziegel-Schornstein** rechts der Mitte, Fensterband im EG,
   **flacher Anbau zur Platzseite** (Terrasse mit Biertisch-Garnituren unterm Vordach).
   Boden-Foto (Feb 2018): Anbau mit **blauem Fascia-Band, blauen Türen,
   Klinker-Sockel**, Fahrradständer, gepflasterter Weg.
   Belege: `dji_…142322_0155…/f020.jpg` (bester Gesamtblick),
   `dji_…170204_0176…` Serie, `Bildschirmfoto…13.24.16.png` (Detail),
   `IMG_6072/f005` (Umfeld).
2. **Ballfangzaun** (hoch, dunkle Pfosten, Maschendraht) direkt hinter BEIDEN Toren;
   am Ost-Zaun blaues **„mohr sports"-Banner**. Beleg: `…0155…/f020`, `IMG_6082/f001`.
3. **Rote Klinker-Hütte mit Ziegel-Satteldach** (Geräte/Unterstand, Bank + Mülleimer
   davor, offene blaue Tür) an der **NW-Ecke / Nordseite**. Beleg:
   `dji_…140658_0052…/f00x`, `dji_…142906_0158…/f001`, Satellit (oranges Dach NW).
4. **2–3 Fahnenmasten** zwischen Ost-Zaun und Gebäude (Deutschland- + Vereinsflagge).
   Beleg: `…0155…/f020`, `dji_…143548_0165…/f001`.
5. **Parkplatz + Zufahrt nordöstlich** des Gebäudes (Autos sichtbar), sandiger
   Weg entlang des Ost-Zauns. Beleg: `…0155…/f020`, `IMG_6083/f00x`.

## Bande / Werbung / Fanblock

- **Sponsor-Tafeln auf der SÜD-Reling** (vor dem Wald): weiße Einzeltafeln
  („Lackiererei Schmitz", „Reiner Kintopf", „Paint Shop", bunt gemischt).
  Beleg: `dji_…143024_0160…/f001`, `dji_…171244_0185…/f001`.
- **FANBLOCK-Ecke: SÜDOST** — an der Süd-Reling nahe der östlichen Ecke
  (am Tor-Ende beim Vereinsheim): großes **rotes „AGA URKNALL est. 2024"-Banner**
  (schwarzes Diagonalband, weiße Schrift, Lorbeer, Spinnennetz-Motiv,
  Bierkrug-Grafik), **rot-schwarz geteilte Fahne**, Bierkiste.
  Beleg: `dji_…143242_0162…/f001.jpg` (Nahaufnahme), Cover 2.
  *Korrektur v5: aus den Drohnen-Frames war SÜDWEST geschlossen — Marvins
  v4-Review stellt klar: richtige Seite, falsches Tor-Ende → SÜDOST.*
- Matchday: **Zuschauer dicht an der NORD-Reling** (Sonne im Rücken), Spieler
  lehnen an der Reling. Beleg: `IMG_6074/f001`, `dji_…140126_0047…/f003`.

## Vereins-Identität

- **Echtes Wappen liegt vor**: `AGA Logo.png` — Schild diagonal geteilt,
  rot oben / schwarz unten, weiß „S.V. AGATHENBURG / DOLLERN **1949** e.V."
  → **Korrektur: Gründungsjahr 1949, nicht 1948** (Seed-Daten anpassen!).
- Trikots: **Rot mit schwarzen Ärmeln** (Matchday `IMG_6071…`), Ausweich schwarz,
  Torwart orange. Fahne/Fanblock: rot-schwarz.
- Cover 2 (`AGA Urknall - Heimspiel Überall Cover 2.jpeg`): Banner im Tornetz bei
  Dämmerung — Vorlage für Partyraum-Poster + Musik-Menü-Artwork.

## Musik (alle von Marvin, frei nutzbar)

10 Tracks (WAV, gesamt ~320 MB → als MP3 konvertieren):
Anpfiff (2:13) · Das ist AGA! (3:33) · AGA, egal wo (2:43) · Nach dem Urknall (2:55) ·
Dritte Halbzeit (2:49) · Kreisklasse Royal (3:07) · Bis alles knallt (2:51) ·
Kabine nach Abpfiff (2:24) · Noch nicht nüchtern (1:59) · AGA fährt nach Malle (3:11).

## Konsequenzen für die 3D-Szene (Etappe 1)

| v2-Szene | Realität | Änderung |
|---|---|---|
| Vereinsheim: rotes Satteldach, seitlich | weißes langes Gebäude, dunkles flaches Satteldach + Schornstein, HINTER dem Ost-Tor | Rebuild + Umzug |
| Tribüne (5 Stufen) | existiert nicht — niedrige Reling | Tribüne raus, Reling rein |
| Bande rundum rot/SVA | Sponsor-Tafeln Süd + Reling | Süd: weiße Tafeln-Mix + SVA-Slots; Nord: Reling |
| Wald-Ring gleichmäßig | Wald S/W/O dicht, Nord offen (Dorf) | Treeline asymmetrisch, Nord: Häuser-Silhouetten |
| kein Ballfangzaun | hohe Zäune hinter beiden Toren | ergänzen |
| — | rote Klinker-Hütte NW, Fahnenmasten, Parkplatz-Andeutung O | ergänzen |
| Wappen „A"-Platzhalter | echtes Logo vorhanden | einsetzen (freigestellt) |
| Gründung 1948 | **1949** | Seed korrigieren |

## Bewusste Stilisierungs-Abweichung (dokumentiert)

- **Flutlichtmasten sind in KEINEM Frame zu sehen** — der echte Platz hat offenbar
  keine. Unsere Abendspiel-/Flutlicht-Inszenierung ist das visuelle Konzept der
  Seite (v1/v2 von Marvin abgenommen) und bleibt als künstlerische Freiheit.
  Neue Anordnung: 4 schlanke Masten AUSSERHALB der Reling (statt „Stadion-Ecken"),
  damit sie die reale Anlage nicht verstellen.

## Offene Fragen an Marvin (mit gewählten Defaults)

1. **Partyraum**: keine Innenraum-Fotos in REFERENZ → Interpretation aus
   Cover-Vibe (dunkel, warm, Lichterkette, Tresen). *Default: bauen wie geplant,
   als Interpretation markiert.*
2. ~~**Fanblock-Ecke SW** — aus `…0160/0162` geschlossen~~ **Beantwortet
   (v4-Review): die Kurve steht SÜDOST** — umgesetzt in v5.
3. **Trainingszeiten** für den CTA im Finale sind weiter Platzhalter („Di & Do 19 Uhr").
4. **Gründungsjahr**: Logo sagt 1949 — übernehme ich. Widerspruch zum v1-Prompt (1948).
5. Das kleine zweite Spielfeld/Bolzplatz hinter dem Ost-Zaun (in `IMG_6082/f001`
   angedeutet) lasse ich weg (außerhalb der Kamera-Fahrt). *Default: weglassen.*
