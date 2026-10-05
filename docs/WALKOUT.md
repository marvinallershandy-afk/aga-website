# Walkout-Videos (v16-W)

Freigestellte, nahtlos loopende Spieler-Videos aus den DJI-Dolly-Clips
(`~/Desktop/Dolly/`). Einsatz: Spielerkarten (Galerie, Modal, Trainerstab) und die
„3D-Aufstellung“ auf `/live`. Alles läuft **lokal** auf dem Mac (ffmpeg-static, sharp,
Apple Vision per JavaScript for Automation) — kein Upload an Dritte. Das Material zeigt
Vereinsspieler und ist nur für die Vereinswebsite bestimmt.

Zuordnung Clip → Spieler: [`docs/WALKOUT_ZUORDNUNG.md`](WALKOUT_ZUORDNUNG.md).

## Bedienung

```bash
# alle Spieler aus scripts/walkout/walkout.config.json (≈ 5 min für 17 Spieler)
node scripts/walkout/build.mjs --work ~/sva-walkout-work

# nur einzelne (Atlas + src/data/walkout.ts werden immer neu geschrieben)
node scripts/walkout/build.mjs --only malte-pils,elias-pejas

# nur Atlas + Manifest neu (z. B. nach confirmed: true)
node scripts/walkout/build.mjs --atlas-only

# andere Quelle
node scripts/walkout/build.mjs --src /Volumes/SD/DCIM
```

`--work` (oder `WALKOUT_WORK`) = Arbeitsordner für Frames/Masken/Zwischenvideos
(Standard: `$TMPDIR/sva-walkout`). Nichts davon gehört ins Repo. Die Analyse je Clip
wird dort gecacht.

### Neuen Spieler hinzufügen

1. Clips (DJI „QuickShot“ Dolly-Zoom, Spieler frontal, ganzer Körper im Bild) in den
   Quellordner legen.
2. In `scripts/walkout/walkout.config.json` einen Eintrag ergänzen:
   `{ "id": "<Player.id = slug im Admin>", "slug": "<vorname-nachname>", "clips": ["0252", "0253"], "confirmed": true }`
   (`clips` = DJI-Zählernummer aus dem Dateinamen `…_0252_…`).
   Optional: `"clip": "0253", "start": 1.2` (Fenster erzwingen), `"spill": false`
   (Grünstich-Entfernung aus — bei grünem TW-Trikot).
3. `node scripts/walkout/build.mjs --only <slug>` → prüfen (Poster `public/players/walkout/<slug>.webp`).
4. `src/data/walkout.ts` + `public/players/walkout/*` committen. Die Website zeigt das Video
   automatisch (Karte) bzw. nimmt den Spieler in den Atlas auf (3D).

`confirmed: false` → Assets landen nur im Arbeitsordner (`<work>/unbestaetigt/`), nicht in
`public/`, und die Website zeigt nichts. Erst nach Bestätigung auf `true` setzen.

## Was das Skript macht

1. **Analyse** je Clip: Frames mit 10 fps in 960×540, Freistellung (Vision), größte
   Person nahe der Bildmitte → Box je Frame + Kontrast der Person.
2. **Fensterwahl**: das ruhigste 2,2-s-Stück über alle Clips eines Spielers (wenig
   Bewegung von Mitte/Größe/Fußpunkt, Person nicht am Rand abgeschnitten, Strafe für
   Gegenlicht-Dunst und Helligkeitsschwankung).
3. **Freistellen** in 4K-Ausschnitt: `VNGenerateForegroundInstanceMaskRequest`
   (`scripts/walkout/segment.js`, JXA). Verglichen mit `VNGeneratePersonSegmentationRequest`
   (accurate, über `VNSequenceRequestHandler`) an 3 Frames: die Personen-Segmentierung
   lieferte grobe, „blobbige“ Kanten mit Rasen-Resten, die Instanzmaske saubere
   Kanten (Haare, Finger, Schuhe) → Instanzmaske. Nur die Hauptkomponente bleibt.
4. **Ausrichten**: je Frame auf einheitliche Spielerhöhe (Scheitel 5 %, Sohle 96 % von
   360×720), Größe stark geglättet (kein Pumpen beim Dolly-Zoom), Lage leicht geglättet.
5. **Kanten & Farbe**: Alpha zeitlich über ±2 Frames geglättet (gegen Kantenflackern) +
   weiche Kurve (≈ ½ px Erosion), Grünstich an halbtransparenten Kanten entfernt,
   Helligkeit/Kontrast je Frame an das kontrastreichste Frame angeglichen (die Drohne
   fliegt durch Gegenlicht → sonst „atmet“ der Loop), Hintergrund mit ausgedehnter
   Randfarbe gefüllt (kein dunkler Saum beim Sampeln).
6. **Loop**: Ping-Pong (66 Frames vor, 64 zurück = 130 Frames, 4,3 s) → nahtlos.
7. **Kodieren** (je Spieler):

| Datei | Format | Zweck | Größe |
|---|---|---|---|
| `<slug>.mp4` | H.264, 360×1440, oben Farbe / unten Alpha (Graustufe), CRF 27 | WebGL (Stacked Alpha, alle Browser) | 185–276 KB |
| `<slug>.webm` | VP9 mit Alpha (yuva420p), CRF 44 | DOM: Chrome, Firefox, Edge | 211–329 KB |
| `<slug>.mov` | HEVC mit Alpha (hvc1), 200 kbit/s, alpha_quality 0,3 | DOM: Safari, alle iOS-Browser | 207–353 KB |
| `<slug>.webp` | WebP mit Alpha, erstes Frame | Poster / reduced-motion | 12–18 KB |
| `atlas.mp4` | H.264, alle bestätigten Spieler im Raster (Farbe oben, Alpha unten), ≤ 2048 px | 3D-Aufstellung, **ein** Dekoder | 702 KB (16 Spieler, 960×1920) |

HEVC mit Alpha: über ffmpeg `hevc_videotoolbox` (Apple-Encoder, Bitrate steuerbar).
`avconvert -p PresetHEVCHighestQualityWithAlpha` funktioniert auch (Rückfall im Skript),
liefert aber ~1,5 MB je Spieler. Prüfen lässt sich die Alpha-Ebene mit
`qlmanage -t -s 720 -o /tmp <slug>.mov` (Vorschau-PNG hat Alpha); ffmpeg 6 dekodiert die
Alpha-Ebene nicht.

Atlas-Raster: das Skript wählt Spalten/Zeilen so, dass die Zellen (1:2) innerhalb von
2048 px möglichst groß werden (Obergrenze `atlasCell`, derzeit 160×320). Ab ~40 Spielern
würden die Zellen < 64 px → dann zweiten Atlas einführen (Skript bricht mit Hinweis ab).

## Einsatz auf der Website

- **Karten** (`src/ui/HoloCard.tsx`, `StaffCard.tsx`, `WalkoutVideo.tsx`): Gibt es für die
  id ein Walkout (`src/data/walkout.ts`, generiert), zeigt die Karte statt des Freisteller-Fotos
  das Video im selben Fenster (Kopf auf gleicher Höhe, Körper läuft in die Namensplatte aus).
  - Quellen erst kurz vor Sichtbarkeit (IntersectionObserver, 300 px Vorlauf), abgespielt nur
    solange sichtbar, sonst pausiert; versteckter Tab pausiert.
  - Reihenfolge: WebKit (Safari, iOS) → `.mov` (HEVC-Alpha) zuerst; sonst `.webm` zuerst.
    Grund: Chrome auf dem Mac meldet `hvc1` als abspielbar, zeigt aber dessen Alpha nicht.
  - `prefers-reduced-motion` → nur das Poster-WebP.
  - Ladefehler aller Quellen → Karte fällt auf das Foto zurück.
- **3D-Aufstellung** (`/live`, `src/live/Aufstellung3D.tsx` + `src/live/lineup3d/scene.ts`):
  Knopf „3D-Aufstellung“ über dem Taktik-Board. three.js wird erst beim Klick geladen
  (dynamischer Import; `/live` ohne Klick unverändert three-frei). Stilisierter Rasen,
  Startelf als Billboards, die den Atlas per UV sampeln (ein Videodekoder), Namensschild,
  Kamera hinter dem eigenen Tor mit Orbit per Ziehen. Neues Tor im Ticker → Torschütze
  leuchtet ~4 s golden (Umriss + Bodenring); Wechsel blenden den neuen Spieler ein. Spieler
  ohne Walkout erscheinen als Trikot-Aufsteller mit Nummer.
- **Admin** (`Kader`, Listenansicht): „Walkout vorhanden ✓“ je Spieler.

## Messwerte (05.10.2026)

- 3D-Aufstellung, Produktions-Build: three.js 188 KB gzip + Szene 4,5 KB gzip + Atlas 702 KB
  ≈ **0,9 MB** nach dem Klick (Ziel ≤ 3 MB). Vor dem Klick: kein three-Request.
- Frametimes (Playwright, Chromium mit Metal-GPU, Dev-Server): Desktop 16,7 ms Ø / 17,6 ms p95,
  iPhone-13-Emulation 16,7 ms Ø / 17,6 ms p95 (60 fps); WebKit 16,5–17,2 ms Ø / 18 ms p95.
  Echte iPhones sind nicht gemessen (Emulation ≠ Gerät).
