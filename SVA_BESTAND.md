# SVA_BESTAND — Bestandsschutz-Inventar (v9 E0)

**Schutzliste. Was hier steht, wird in v9 NICHT gelöscht — nur eingeordnet.**
Stand: Branch `v9-reise` (von `v8-flow`), 7. Juli 2026. Baseline-Screenshots =
die v8-E6-Sätze `SVA_SCREENSHOTS/e6-{desktop,mobile}-*.png` (identischer Stand,
da v9-reise ohne Änderung von v8-flow abzweigt).

## Gute Stationen / Inhalte (BEHALTEN)
| Element | Datei | Status / Einordnung in die 7-Reise |
|---|---|---|
| **Hero „Willkommen am Platz"** | `Sections.tsx` §verein, `CameraPath` Station 0 | Station 1 — bleibt unangetastet |
| **Anstoß-Übergang** (Sinkflug) | `CameraPath` Station 1 (synthetisch), `useScrollProgress` ANSTOSS_FRAC | Ist bereits PASSAGE (keine eigene Sektion) — E1 glättet nur |
| **Mannschaft** (Sammelkarten) | `Sections.tsx` §mannschaft, `PlayerCardGrid`, `cards.css` Metall-Foil | Station 3 — bleibt |
| **FAN-BLOCK (Geometrie komplett da!)** | `components/FanBlock.tsx` (in `Scene.tsx` gerendert) | Geometrie intakt: 8+ Fans SVA-Farben, AGA-URKNALL-Banner (wogt), rot-schwarz-Fahne, Schal, Bierkiste, SO-Ecke CX=3.6/z≈+3.95. **Verloren ging nur die KAMERA-STATION** → E2 holt Station zurück + baut aus |
| **Musik/Partyraum-Durchfahrt** | `components/PartyRoom.tsx`, `camera/partyPath.ts`, `ui/PartyDirector.tsx` | Station 5 — bleibt; E3 nur Geometrie-Fix am Vereinsheim |
| **Tabelle** (fussball.de-Slot) | `Sections.tsx` §tabelle, `FussballWidget` | Teil Station 7 — bleibt |
| **Sponsoren-Strip** (v8 E5) | `ui/SponsorsStrip.tsx`, `club.ts` SPONSORS[] | Wird zur eigenen Station 6 ausgebaut (E4), DOM-Strip bleibt als Fallback/Ergänzung |
| **Maps/Route** | `ui/PlatzFinden.tsx` (SVG-Karte + Route-Button) | Teil Finale — E5 baut echten Rauszoom, PlatzFinden bleibt Fallback |
| **Finale-Rauszoom + Marker** (v8 E4) | `components/LocationMarker.tsx`, `CameraPath` Station 5 (y=13.5) | Basis fürs E5-Maps-Finale — wird verfeinert (flache 2D-Karte), nicht gelöscht |

## Gute Effekte / Systeme (BEHALTEN)
| Element | Datei |
|---|---|
| Kino-Kette (Bloom/Grade/Vignette/Noise/CA/ToneMapping) | `src/cinema/*`, Taste `e`=FxPanel, `p`=Perf |
| Bogenlängen-korrigierte Kamerafahrt | `camera/CameraPath.ts` (arcLengthU/segArc) |
| Zonenweiser Kamera-Boden + Finale-Y-Decke | `camera/CameraPath.ts` flightFloorAt/maxFlightYAt |
| CC0-Waldrand (InstancedMesh) | `components/ForestTrees.tsx` + `public/models/tree_pine*.glb` |
| Flutlicht-Choreografie (Anstoß) | `components/Floodlights.tsx`, `CameraPath` floodLevelAt |
| Echtes Wappen überall | `public/brand/wappen.png`, `public/favicon.svg` |
| AudioManager (atmo/music/fx, **atmoBoost „Fanblock"** schon angelegt) | `src/audio/AudioManager.ts` |
| Fallback/reduced-motion (statische Seite) | Store `fallback`, kein 3D |

## Assets
- CC0-Modelle vorhanden: `tree_pineDefaultA/B.glb`, `tree_pineRoundA.glb`, `football.glb` (Kenney/CC0, s. `ASSETS_CREDITS.md`).
- **Für Fans (E2/E6) noch KEIN CC0-Personen-Modell** → E2 nutzt die bestehenden stilisierten Low-Poly-Fans (additiv ausbauen); CC0-Personen als E6-Kandidat.
- Marvins Musik/Cover in `src/audio/tracks/`, `kickoff-swell.mp3`.

## Struktur-Notiz (für E2/E4 — additiver Umbau)
- DOM-Sektionen aktuell (5): `verein, mannschaft, musik, tabelle, kontakt` (`useScrollProgress` SECTION_IDS).
- Kamera-Stationen aktuell (6): hero, anstoss(synth), mannschaft, musik, tabelle, kontakt/finale (`CameraPath` STATIONS).
- v9 ergänzt ZWEI Sektionen/Stationen: **Fan-Block** (nach mannschaft) und **Sponsoren** (nach musik) → 7-Reise. Nichts wird ersetzt, nur eingefügt + Anker/Stationen neu geordnet.
