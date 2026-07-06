# SVA Flow-Befund (v8 · Etappe 0)

Baseline = aktueller main-Stand (v7). Baseline-Screenshots: `SVA_SCREENSHOTS/v7-e3-*.png` (Desktop),
`v6-e3-*.png` (Mobile) — Hero/Swoop/Team/Approach/Finale.

## Stationen-Reihenfolge (Ist)
Kamera-Kurve (`CameraPath.ts` STATIONS) + DOM-Sektionen (`Sections.tsx`) + Anker (`useScrollProgress.ts`):

| # | Station | DOM-Sektion | Zweck |
|---|---|---|---|
| 0 | VEREIN (Hero, y=7.0) | `verein` | Establishing |
| 1 | **ANSTOSS** (Dive, y=0.5) | **`anstoss` (115vh, Titelkarte)** | ⚠️ eigener Text-Stopp |
| 2 | MANNSCHAFT (y=2.6) | `mannschaft` | Karten |
| 3 | MUSIK (y=0.9) | `musik` | Vereinsheim-Anflug → Partyraum |
| 4 | TABELLE (y=0.95) | `tabelle` | Tabelle |
| 5 | KONTAKT (y=0.95) | `kontakt` | Finale/Route |

Anker werden aus den 6 DOM-Sektions-Zentren gemessen (STATION_IDS, `useScrollProgress.ts:7`).

## Befund gegen Marvins Kritik
1. **Sinnloser ANSTOSS-Stopp** — `anstoss` ist eine ECHTE 115vh-DOM-Sektion mit Titelkarte
   „ANSTOSS · FLUTLICHT AN · DER BALL ROLLT" (`Sections.tsx:51`). Sie hält den Scroll an und
   liest als eigene Station statt als Übergang. → **E1.1: DOM-Sektion raus**, Dive als Anker
   zwischen Verein↔Mannschaft synthetisieren (Kamera-Station 1 bleibt, Text/Stopp weg).
2. **Kamera zu tief im Rasen** — `MIN_FLIGHT_Y=0.9` (`CameraPath.ts:103`); die offenen Feld-
   Übergänge (Hero→Mannschaft→Musik) skimmen zu tief. Die Vereinsheim-Stationen (3/4/5, y≈0.9)
   müssen aber tief bleiben (Tür-Anflug). → **E1.2: Boden zonenweise** — Feld höher, Vereinsheim tief.
3. **Sektions-Überlappung** — Party-Anflug startet bei `rect.top < vh*1.9` (`PartyDirector.tsx:47`),
   also 1.9 Screens früh → beginnt, während die Mannschaft-Karten oben noch sichtbar sind.
   → **E1.3: Anflug-Fenster nach hinten** (startet erst, wenn Musik-Sektion eintritt / Mannschaft weg).

## Weitere Etappen (Kurz)
- **E2** Vereinsheim-Geometrie: Eingang weiter links, Falsch-Tür raz, Anflug in den Fenster-Raum links.
- **E3** Echtes Wappen auf Karten/Share statt Platzhalter-Schild.
- **E4** Rauszoom-Finale in die Standort-Karte.
- **E5** Content: Sponsoren-Array, Heimspiel-Slot, Mannschaftsfoto-Slot, Instagram prominent.
