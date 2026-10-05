# Greenscreen-Pipeline (v17-G)

Aus dem Training-Dreh ([`GREENSCREEN_DREHPLAN.md`](GREENSCREEN_DREHPLAN.md): je Spieler eine durchgehende
4K/60-Hochkant-Aufnahme mit 7 Takes + ein Foto) entstehen freigestellte Assets für Karten, Album,
Aufstellung und Tor-Videos. Alles läuft **lokal** auf dem Mac (ffmpeg-static, sharp, Apple Vision per
JavaScript for Automation). Nichts wird hochgeladen.

## Der eine Befehl (nach dem Dreh)

```bash
node scripts/greenscreen/build.mjs
```

Das liest `~/Desktop/Greenscreen/`, ordnet zu, schneidet die Takes, stellt frei, kodiert und schreibt
`public/players/gs/<slug>/` + `src/data/greenscreen.ts`. Dauer: ca. 4,5 min je Spieler auf einem M3
(gemessen am synthetischen 43-s-Clip), bei 20 Spielern also ungefähr 1,5 h — am besten nebenbei/abends
laufen lassen. `--jobs 2` brachte auf dem M3 nichts (Speicher/CPU-Konkurrenz), Standard ist daher 1. Arbeitsordner (Frames, Masken, Kontaktbögen):
`$TMPDIR/sva-greenscreen`, wird nicht committet.

Empfohlene Reihenfolge:

```bash
node scripts/greenscreen/build.mjs --dry      # 1. nur Zuordnung + Takes (≈ 10 s je Clip)
open docs/GREENSCREEN_ZUORDNUNG.md            # 2. unsichere Fälle ansehen, Kontaktbögen prüfen
#    ggf. scripts/greenscreen/zuordnung.json ergänzen
node scripts/greenscreen/build.mjs            # 3. bauen
npx tsc -p tsconfig.app.json --noEmit         # 4. prüfen, dann public/players/gs + src/data/greenscreen.ts committen
```

Optionen: `--src <ordner>`, `--work <ordner>` (oder `GS_WORK`), `--only <Datei|Player.id|slug,…>`,
`--jobs <n>` (Standard 1), `--keep` (Zwischenframes behalten), `--registry-only` (nur `greenscreen.ts` neu).

## Was passiert

1. **Eingang.** Videos `*.MOV/*.MP4` (4K60 hochkant; iPhone-Rotation wird beachtet), Fotos `*.HEIC/*.JPG`.
   HEIC → JPG per `sips`. iPhone-HDR (HLG/Dolby Vision) wird automatisch nach SDR BT.709 umgerechnet
   (`zscale`, Referenzweiß 203 nits). Besser: HDR beim Dreh ausschalten (siehe Drehplan).
2. **Zuordnung per Rückennummer.** Aus den ersten 3,2 s werden 4 Bilder/s gelesen und mit
   `VNRecognizeTextRequest` (Apple Vision, accurate) nach 1–2-stelligen Zahlen durchsucht. Große Ziffern
   (Zettel) zählen mehr als kleine (Hosennummer), Jahreszahlen/Texte („1949“, Sponsor) werden ignoriert.
   **Sicher** = dieselbe Zahl in ≥ 2 Bildern, keine starke Zweitzahl, Nummer genau einmal im Kader
   (`src/data/players.ts`). Keine Zahl erkannt → Rückfall: ausgestreckte Finger
   (`VNDetectHumanHandPoseRequest`), das ist aber immer **unsicher**.
   Unsichere Clips werden nur in `<work>/unbestaetigt/` gebaut (kein falscher Name online) und stehen in
   [`GREENSCREEN_ZUORDNUNG.md`](GREENSCREEN_ZUORDNUNG.md). **Spieler ohne Nummer** (z. B. Isaak Warkehr) und
   der **Trainerstab** brauchen immer einen Eintrag in `zuordnung.json`.
3. **Foto → Clip** über die Aufnahmezeit (EXIF, sonst Dateizeit): das Foto gehört zum letzten Clip, der
   davor begonnen hat (≤ 10 min). Korrektur: `zuordnung.json → fotos`.
4. **Take-Erkennung.** Analyse mit 10 fps in 1/8-Auflösung: Grün-Silhouette (geöffnet, damit Stative und
   Tuchkanten nicht mitzählen), Höhe, Schulterbreite, Fläche, Bewegungsenergie (Kopf/Körper getrennt).
   Eine dynamische Programmierung legt die 7 Takes in **Drehplan-Reihenfolge** mit beliebigen Pausen
   dazwischen so, dass jeder Take zu seinem Profil passt: Stehen = ruhig, „Kopf hoch“ = Bewegung oben,
   Walkout = Silhouette wächst, Jubel = viel Bewegung + seitlich, Ball = mehr Fläche, Seitlich = schmale
   Schultern; Sollzeiten 5/4/5/5/3/3/3 s (×0,6 … ×1,5). Ergebnis + **Kontaktbogen** (Anfang/Mitte/Ende je Take)
   unter `<work>/kontakt/<clip>.jpg`. Korrektur einzelner Takes: `zuordnung.json → clips → takes`.
5. **Keying** je Take in 1,5-facher Ausgabeauflösung (fester Ausschnitt — Stativ, kein Wackeln):
   - **ffmpeg** dekodiert/schneidet und liefert in derselben Dekodierung `chromakey` (Key-Farbe automatisch aus
     den Bildrändern) → sichere Hintergrundpixel.
   - **Hintergrund-Platte:** aus diesen Pixeln (+ grün, + außerhalb der Person) je Frame eine weiche Karte
     des Tuchs (Push-Pull-Füllung, zeitlich geglättet) → Lichtverlauf, Vignette, Falten sind egal.
   - **Ratio-Key** gegen die lokale Platte: `1 − (G − max(R,B))/(G+20)` relativ zur Platte → Schatten auf dem
     Boden-Tuch bleiben Hintergrund, schwarze Schuhe Vordergrund.
   - **Vision-Personenmaske** (`VNGenerateForegroundInstanceMaskRequest`, hält auch den Ball) als
     Plausibilität, über ±2 Frames gemittelt: *außerhalb* der geweiteten Maske alles weg (Stativ,
     Lampenstativ, Tuchkante, Wand); *im Kern* der Person kein Loch, außer der Pixel hat wirklich
     Platten-Farbe (grünliche Reflexe/Logos bleiben).
   - **Zeitlich stabil:** Alpha mit Nachbarframes gemittelt, Gewicht nach Farbabstand (Bewegung → keine
     Geisterbilder).
   - **Kanten:** geführter Filter (Luma als Führung) im Unsicherheitsband, Entmischung halbtransparenter
     Pixel gegen die Platte (Haare ohne grünen Saum), Spill-Unterdrückung `G ≤ max(R,B)` (Haut/Blond/Weiß
     bleiben, im Vereinsdress gibt es kein Grün), Randfarbe unter Alpha 0 ausgedehnt.
6. **Kodieren** wie die Walkouts (`docs/WALKOUT.md`): WebM VP9 mit Alpha, HEVC mit Alpha
   (`hevc_videotoolbox`, Rückfall `avconvert`), Stacked-Alpha-MP4 (H.264), Poster-WebP.
   Loops: Qualität/Bitrate so, dass WebM und MOV ≤ 600 KB bleiben.

## Ausgaben je Spieler (`public/players/gs/<slug>/`)

| Datei | Quelle | Format | Zweck |
|---|---|---|---|
| `card.webp` | Foto (sonst ruhigstes Frame Take 1) | 800×1200, WebP+Alpha, Kartenkonvention wie `/players/cutout` (Scheitel 18,5 %, unten ≈ Hüfte) | Sammelkarte, Album, Brustbild |
| `pose-loop.{webm,mov,mp4,webp}` | Take 2 | 720×1440, 30 fps, nahtlose Schleife 2–3 s (bestes Bildpaar + 8 Frames Überblendung), ≤ 600 KB | lebende Karte |
| `walkout.*` | Take 3 | 720×1440, Rahmen nach der End-Pose (Spieler wächst ins Bild) | Aufstellungs-Reveal |
| `jubel.*` | Take 4 | 1080×1920 (Story), Vereinigung aller Positionen | Tor-Videos |
| `zeigen.*` | Take 5 | 720×1440 | Man of the Match |
| `seite.webp` | Take 7 (ruhigstes Frame) | 720×1440 | TV-Grafiken |
| `ball.webp` | Take 6 (ruhigstes Frame) | 720×1440 | Steckbrief/Neuzugang |
| `meta.json` | — | Clip, Takes, Größen | Nachvollziehbarkeit |

Video-Geometrie (pose-loop/walkout/zeigen/seite) = Konvention der Walkouts (1:2, Scheitel 5 %, Sohle 96 %),
nur doppelte Auflösung → die Karten-Komponente braucht keine Sonderfälle.

## Schnittstelle zur Website: `playerMedia(id)`

`src/data/playerMedia.ts` ist die **einzige** Stelle, die entscheidet, welches Bild/Video ein Spieler bekommt
(für den parallelen Karten-Design-Durchgang: bitte nur diese Funktion nutzen, keine Pfade selbst bauen).

```ts
import { playerMedia } from '../data/playerMedia'
const m = playerMedia(player.id, player)   // player: { cutoutUrl?, photoUrl? } als Rückfall
m.figure    // Freisteller (Alpha) für Karten: Greenscreen-card.webp → cutoutUrl → null
m.bild      // Brustbild/Avatar: figure → photoUrl → null;  m.cutout = ob mit Alpha
m.loop      // { webm, mov, mp4, poster } lebende Karte: Greenscreen-pose-loop → Dolly-Walkout → null
m.loopSize  // { w, h, headY, feetY } der Loop-Quelle
m.walkout / m.jubel / m.zeigen   // Greenscreen-Videos (sonst null)
m.seite / m.ball                 // Greenscreen-Standbilder (sonst null)
m.source    // 'greenscreen' | 'walkout' | 'foto' | 'keins'
```

Angebunden (minimal, nur Quellenwahl): `HoloCard.tsx` (Figur + `CardWalkout`-Geometrie), `StaffCard.tsx`,
`PlayerModal.tsx`/`storyShare.ts` (Story-Karte), `WalkoutVideo.tsx` + `walkoutSupport.ts` (Loop-Quelle),
Live-Aufstellung (`src/live/aufstellung/daten.ts`). Nicht angebunden: die 3D-Karten-Texturen
(`src/three/playerCardTexture.ts`) — die nutzen weiter `cutoutUrl`. Sobald `src/data/greenscreen.ts`
Einträge hat, nutzt die Website die Greenscreen-Assets automatisch; ohne Einträge bleibt alles wie bisher.

## Test mit synthetischem Material (heute, ohne Dreh)

```bash
node scripts/greenscreen/synth-test.mjs --out /tmp/gs-in --player tobias-helck --number 24 --name IMG_0101 --photo
node scripts/greenscreen/synth-test.mjs --out /tmp/gs-in --player marc-kevin-biedermann --number 37 --name IMG_0103
node scripts/greenscreen/synth-test.mjs --out /tmp/gs-in --player julio-paruzel --name IMG_0105 --seconds 8 --nonumber
node scripts/greenscreen/build.mjs --src /tmp/gs-in --work /tmp/gs-work
node scripts/greenscreen/compare.mjs /tmp/gs-work/p/tobias-helck/cmp-jubel shots-gs/gs-kanten-zoom.png
```

Der Generator montiert einen vorhandenen Freisteller auf absichtlich schwieriges Grün (Lichtverlauf,
dunkleres Boden-Tuch mit Schatten, Falten, sichtbare Tuchkante + Wand, Lampenstativ im Bild, Grünschimmer an
den Kanten, grünliche Stelle auf dem Trikot, Rauschen, Helligkeitsflackern) und spielt den Drehplan ab
(Zettel mit Nummer, 7 Takes mit Pausen). **Achtung:** Testausgaben nicht committen
(`public/players/gs/` danach leeren, `node scripts/greenscreen/build.mjs --registry-only`).

Ergebnis 05.10.2026 (M3): Nummern 24/37 sicher erkannt, Clip ohne Nummer korrekt „unsicher“; alle 7 Takes
je Clip innerhalb ±0,4 s der Sollzeiten; Stativ/Tuchkante vollständig entfernt, grünliche Trikotstelle ohne
Loch (reiner ffmpeg-Key: Loch), Haarkante ohne Grünsaum/Lichtsaum. Loop 2 s, WebM 340–541 KB, MOV 460–530 KB
(≤ 600 KB). Foto (HEIC) per Uhrzeit dem richtigen Clip zugeordnet. Beweise: `shots-gs/beweise/gs-*.jpg`
(Kanten-Zoom Vorher/Nachher, Ausgaben, Kontaktbogen).

## Bekannte Grenzen

- Take-Erkennung ist eine Heuristik: echte Pausen, Lachen, Zur-Seite-Gehen können Takes verschieben →
  Kontaktbögen ansehen, ggf. Zeitmarken in `zuordnung.json`.
- Finger-Zählung ist nur ein Hinweis (immer „unsicher“). Zettel mit großer Zahl ist deutlich robuster.
- Grünes TW-Trikot würde mit ausgekeyt (Drehplan: anderes Trikot). Die Spill-Unterdrückung entfernt
  jedes Grün am Spieler — für grüne Schuhe/Schoner gilt dasselbe.
- Kodier-Bitrate HEVC per VideoToolbox schwankt; das Skript zielt auf 62 % des Budgets.
