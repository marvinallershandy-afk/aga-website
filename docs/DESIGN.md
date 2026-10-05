# SVA-Designsystem (v17-D)

Verbindlich für alle öffentlichen Seiten: Karte + Panels, Rundgang, `/live`,
`/partner`, `/galerie`, `/album`, Impressum/Datenschutz.
Tokens: `src/theme/design.css` (wird in jeder HTML-Seite als erstes CSS geladen).

> **Leitbild:** große echte Fotos, große Typo, viel Ruhe, wenige Farben.
> Die Fotografie trägt die Seite — die Oberfläche tritt zurück.
> Referenzen: Union Berlin, FC St. Pauli, Nike Football, EA FC UI.

## 1. Ist-Analyse: was nach „KI-/Baukasten-Webseite" aussah

Screens vorher: `shots-premium/vorher/` (desktop `-d-`, mobil `-m-`).

| # | Befund | Wo | Geändert zu |
|---|--------|----|-------------|
| 1 | Spiel-Marker wie aus einem Mobile-Game: cremefarbene Pins mit weißem Ring, Tropfenspitze, Dauer-Hüpfen, pulsierende Ringe, Kästen mit Schatten | Karte | dunkler Punkt mit Haarlinie, dünnes Linien-Icon, Versal-Label auf ruhiger Fläche; Bewegung nur bei „Live" |
| 2 | Holzschild mit Maserungs-Verlauf und Clip-Path (Bastel-Look) | Karte, Wegweiser B73 | gleiches Schild wie alle Marker, roter Kantenstrich + Pfeil-Icon |
| 3 | Glas-Panels (Blur, Verlauf, 20 px Radius) + runde Creme-Medaille vor jedem Titel | Orts-Panels | flache Fläche, eine Haarlinie, 12 px Radius, Titel ohne Medaille |
| 4 | Rote Flächen mit rotem Glow-Schatten, Hover „hüpft" (translateY + Schatten) | CTAs, Knöpfe, Karten | flaches Rot, Hover = Farbwechsel; nichts springt |
| 5 | Kästen in Kästen (Wann/Wo, Unter 18, Kontakt, Cockpit mit Gold-Rahmen) | Panels, Rundgang | Zeilen mit Haarlinien; Kacheln nur, wo Inhalt eine Fläche braucht |
| 6 | Fremdmarken-Farben: Instagram-Verlauf (gelb-pink-lila), WhatsApp-Grün | Kontakt-Knöpfe | Linien-Knopf mit Icon — Marke über das Icon, nicht über die Farbe |
| 7 | Pills überall: Rundgang, Dock, „Ton an" mit Glow, Fangesang, Story teilen, Chips im Modal | überall | rechteckige Knöpfe (4 px), Text-Links, Punkt-getrennte Labels |
| 8 | 18 verschiedene Radien (2 … 22 px, 999 px, 5cqw …) | alle CSS | genau zwei: `--r-s` 4 px, `--r-l` 12 px (+ Kreis für Avatare/Icon-Knöpfe) |
| 9 | Leuchtränder: roter Glow um Karten-Hover und um Freisteller, Streifen-Verläufe in Heros | Karten, /partner, /live | ein Schatten (`--shadow-float`) nur für schwebende Ebenen; Hero = Foto statt Verlauf |
| 10 | Glyphen als Icons (→ ▸ ‹ › ×), Emoji-Optik | Panels, Lightbox, Modal | lucide, Strichstärke 1.5 |
| 11 | Federnde Easings (`cubic-bezier(.34,1.56,…)`, Springs) | Marker, Modal | `--ease` (ease-out), 200–400 ms |
| 12 | Template-Floskeln/Blöcke: „So einfach geht's 1-2-3", gestrichelte „Hier ist noch Platz"-Box, zweifarbige Headlines (DIE **PAKETE**) | /partner | Text in Vereinsstimme, einfarbige Headlines, Partner-Wand mit Nele als erstem Eintrag |
| 13 | Kleine Fotos mit Text-Pills drüber (Meisterfeier 3 Mini-Kacheln) | Fans-Panel | Galerie „Spieltag in Bildern": großes Raster + Vollbild-Lightbox, Credit |
| 14 | Spieler unscharf (640-px-Freisteller aus 800-px-Web-JPGs, Grünsaum), Walkout-Videos verwaschen | Karten, Modal | Freisteller aus den Print-Originalen (1400×2100), Kanten entfärbt, HD 960×1440; Walkout aus |

## 2. Tokens

### Farbe — Rot / Schwarz / Weiß + ein Akzent
| Token | Wert | Verwendung |
|---|---|---|
| `--c-red` | `#E91D29` | Handlung (Primär-Knopf), Live, Kicker. **Nie** als Glow. |
| `--c-red-press` | `#C3141F` | Hover/gedrückt auf Rot |
| `--c-black` | `#0B0A0B` | Seitengrund |
| `--c-ink` / `--c-ink-2` | `#141213` / `#1C1A1B` | Flächen / angehobene Flächen, Felder |
| `--c-white` | `#F4F2EF` | Text (warmes Weiß) |
| `--c-text-2` / `--c-text-3` | 70 % / 48 % | Fließtext 2. Ordnung / Metadaten |
| `--c-line` / `--c-line-strong` | 12 % / 28 % | Haarlinien / Knopf-Linien |
| `--c-accent` | `#E8C15A` Gold | **nur** Rückennummer, Kapitän, Meister/Pokal |

### Schrift — Anton (Display, Versalien) + Archivo (Text)
| Stufe | Token | Größe |
|---|---|---|
| Hero | `--t-d1` | clamp(3.25rem, 8.5vw, 7.5rem) |
| Seiten-/Sektionstitel | `--t-d2` | clamp(2.5rem, 5.2vw, 4.5rem) |
| Panel-/Blocktitel | `--t-d3` | clamp(1.75rem, 3vw, 2.5rem) |
| Karten-/Marker-Titel | `--t-d4` | 1.375rem |
| Lead | `--t-lead` | clamp(1.0625rem, 1.3vw, 1.25rem) |
| Text | `--t-body` / `--t-small` | 1rem / .875rem |
| Label (Versal, +14 % Laufweite) | `--t-label` / `--t-micro` | .75rem / .6875rem |

Regeln: Headlines einfarbig (keine Rot-Weiß-Splits). Kicker = Label in Rot,
optional mit 24-px-Haarlinie davor.

### Abstand — 4/8-Raster
`--s-1` 4 · `--s-2` 8 · `--s-3` 12 · `--s-4` 16 · `--s-5` 24 · `--s-6` 32 · `--s-7` 48 · `--s-8` 64 · `--s-9` 96 px;
Seitenrand `--gutter` = clamp(16px, 4vw, 48px).

### Form
* **Zwei Radien:** `--r-s` 4 px (Knöpfe, Felder, kleine Bilder), `--r-l` 12 px (Panels, Sheets, große Medien). Kreis nur für Avatare und runde Icon-Knöpfe.
* **Linien statt Leuchtränder:** `--border` (1 px `--c-line`). Kein farbiger Glow, kein Gold-Rahmen.
* **Ein Schatten:** `--shadow-float` nur für Ebenen, die über der Bühne schweben (Panel, Galerie).
* **Kein Glas:** kein `backdrop-filter` auf Inhaltsflächen (teuer auf Handys, wirkt nach Vorlage).

### Bewegung
`--d-1` 200 ms (Farbe/Hover) · `--d-2` 300 ms (Ein-/Ausblenden) · `--d-3` 400 ms (Panels, Bilder) · `--ease` = cubic-bezier(.22, 1, .36, 1).
Nichts wackelt ohne Grund: keine Dauer-Animationen außer „Live" und dem
Scroll-Hinweis. `prefers-reduced-motion` setzt alle Dauern auf 0.

### Icons
lucide-react, `strokeWidth={1.5}`, 16–20 px, `currentColor`. Keine Emoji,
keine Unicode-Pfeile als Icon.

## 3. Bausteine

* **Knopf** (`.ds-btn` bzw. `.btn` im Onepager): 48 px hoch, 4 px Radius,
  Versal-Label. Primär = Rot. Sekundär = 1 px Linie. Tertiär = Text-Link mit Pfeil.
  WhatsApp/Instagram = Sekundär mit Marken-Icon.
* **Label** (`.ds-label`), **Display** (`.ds-display`), **Foto-Credit** (`.ds-credit`).
* **Panel**: Kopf (Kicker + Titel + Schließen-Kreis), Haarlinie, Inhalt.
  Großes Medium (Foto/Video) randlos oben (`.kp-media`).
* **Fakten**: `<dl>` mit Haarlinien-Zeilen (`.kp-facts`), keine Kästen.
* **Fotos**: randlos oder 4 px; kein Rahmen, kein Schatten; Hover = 3 % Zoom im Bild.
  Credit „Fotos: picture by Nele" mit Link (`NELE_INSTAGRAM`, src/data/club.ts).

## 4. Startseite: Intro + Scroll = Rundgang

* Erster Besuch (`localStorage['sva-intro']`, try/catch): Kamera steht im
  Hero-Bild, Poster blendet über, dann ~8 s Fahrt (Flutlicht geht an → über
  den Platz → hinauf in die Karten-Totale). „Zur Karte", Tipp, Rad, Wischen
  oder Taste brechen ab. Nicht bei Deep-Links, reduced-motion, ohne WebGL,
  im Prerender (`navigator.webdriver`). Erzwingen zum Testen: `/?intro=1`.
* Karte: Scrollen/Wischen nach unten (oder ↓/Bild↓/Leertaste) startet den
  Rundgang nahtlos; im Rundgang ganz oben weiter hochscrollen → Karte.
* Code: `src/map/intro.ts`, `src/map/IntroOverlay.tsx`, `CameraRig.introFrame`.

## 5. Trainings-Video

Hintergrund-Loop im Panel „Mitspielen & Training" (`src/map/TrainingMedia.tsx`):
Drohnenaufnahme `~/Desktop/AGA Training/dji_fly_20260707_194322_0189_…_quickshot.mov`,
Sek. 8–11,6, ×1,25 verlangsamt, vorwärts + rückwärts (nahtlos), 9 s, stumm,
1280×720 — `public/training/training-loop.mp4` (H.264, 1,3 MB),
`training-loop.webm` (VP9, 1,1 MB), `training-poster.webp` (73 KB).
Neu erzeugen: `scripts/training-loop.mjs` (ffmpeg-static, Parameter
`SRC`, `SS`, `T`) — Ausschnitt so wählen, dass keine Nahaufnahmen von
Zuschauern/Kindern im Bild sind.
