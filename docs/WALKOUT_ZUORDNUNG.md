# Walkout — Zuordnung Clip → Spieler

Stand: 05.10.2026 · Material: `~/Desktop/Dolly/` (37 DJI-Clips vom 14.07.2026, 19:10–19:24 Uhr)
Kontaktbogen (Clip-Gesicht · Clip-Körper · Hosennummer · Freisteller-Foto · fertiges Walkout):
`shots-walkout/zuordnung-kontaktbogen.jpg`

## Wie zugeordnet wurde

1. **Gruppen nach Aufnahmezeit**: Die DJI-Zähler (…_0213_…) laufen fortlaufend; zwei bis drei
   Clips im Abstand von 6–8 s gehören zum selben Spieler (Pausen von 30–40 s = nächster
   Spieler). So entstehen 17 Personen + 2 Drohnen-Rundflüge („mastershotclip“ 0220/0221,
   kein Einzelspieler, nicht verwendet).
2. **Gesicht** per Apple Vision (`VNDetectFaceRectanglesRequest`, lokal) in jedem Clip gefunden,
   Gesichtsausschnitte neben die Gesichter der Freisteller-Fotos (`public/players/cutout/`) gelegt
   und verglichen. Zusätzlich `VNGenerateImageFeaturePrintRequest` (Spalte „FP“, Distanz,
   kleiner = ähnlicher) — **als Gesichtserkennung nur schwach** (allgemeiner Bild-Fingerabdruck,
   Licht/Hintergrund dominieren), daher nur Nebenindiz.
3. **Hosennummer** (Vergrößerung aus dem 4K-Bild, mehrere Zeitpunkte) — das stärkste Indiz:
   Die Spieler tragen ihre eigene Nummer auf der Hose.
4. **Trikot/Outfit**: grünes TW-Trikot (Pils), dunkles TW-Trikot Nr. 38 (Ebeling), schwarzes
   Stab-Outfit mit „30“ (Hause) bzw. Initialen „AE“ (A. Ebeling); Unterarm-Tattoo (Biedermann).

## Tabelle

| Spieler | id | Clips (DJI-Nr.) | gewählt | Indizien | FP-Top-1 | Konfidenz |
|---|---|---|---|---|---|---|
| Justin Sladek | p-sladek | 0213, 0214 | 0214 ab 1,4 s | Hose **11**, Gesicht | sladek 0,73 | **sicher** |
| Janek Brünjes | p-bruenjes | 0217, 0218, 0219 | 0219 ab 0,3 s | Hose **33**, Unterarm-Tattoo; Haar wirkt im Gegenlicht dunkler als auf dem Foto | (elias 0,75) | **wahrscheinlich** — kurz bestätigen |
| Elias Pejas | p-pejas-e | 0222, 0223 | 0223 ab 0,1 s | Hose **22**, Gesicht | elias 0,71 | **sicher** |
| Marcel Neuber | p-neuber-m | 0224, 0225 | 0225 ab 1,5 s | Hose **14**, Gesicht (Glatze, Bart) | (noah 0,74) | **sicher** |
| Paul Matthes | p-matthes | 0226, 0227 | 0227 ab 5,0 s | Hose **44**, Gesicht | matthes 0,69 | **sicher** |
| Tino Ebeling | p-ebeling-t | 0228, 0229 | 0228 ab 0,1 s | Hose **38**, dunkles TW-Trikot | (noah 0,66) | **sicher** |
| Malte Pils | p-pils | 0230, 0231 | 0230 ab 0,1 s | grünes TW-Trikot, Bart | (noah 0,73) | **sicher** |
| Isaak Warkehr | p-warkehr-i | 0232, 0233 | 0232 ab 1,3 s | Hose **1?** (zweite Ziffer verdeckt: 17 oder 13); **kein Vergleichsfoto** im Kader | (elias 0,80) | **von Marvin bestätigt** (05.10.2026) |
| Niko Hause (Teammanager) | s-hause | 0234, 0235 | 0235 ab 4,6 s | schwarzes Stab-Outfit, **30** auf der Hose (wie auf seinem Foto), Gesicht | (elias 0,78) | **sicher** |
| Julio Paruzel | p-paruzel | 0236, 0237 | 0237 ab 1,3 s | Hose **7**, Kinnbart | paruzel 0,67 | **sicher** |
| Joshua Elsen | p-elsen | 0238, 0239 | 0239 ab 1,2 s | Hose **32**, Gesicht | (matthes 0,71) | **sicher** |
| Aaron Warkehr | p-warkehr-a | 0240, 0241 | 0241 ab 0,1 s | Hose **6**, blondes Haar | (elias 0,74) | **sicher** |
| Niclas Becker | p-becker | 0242, 0243 | 0243 ab 1,1 s | Hose **8**, Vollbart | (noah 0,79) | **sicher** |
| Lennard Brettschneider | p-brettschneider | 0244, 0245 | 0245 ab 1,4 s | Hose **4**, Gesicht | (dawid 0,70) | **sicher** |
| Justin Hüttry | p-huettry | 0246, 0247 | 0246 ab 0,4 s | Hose **3**, Gesicht | (matthes 0,68) | **sicher** |
| Marc Kevin Biedermann | p-biedermann | 0248, 0249 | 0248 ab 0,1 s | Hose **3x** (37), Unterarm-Tattoo wie auf dem Foto | (elias 0,67) | **sicher** |
| Adolf Ebeling (Co-Trainer) | s-ebeling-a | 0250, 0251 | 0250 ab 0,1 s | Initialen **AE** auf der Hose, Gesicht | (elias 0,74) | **sicher** |

„gewählt“ = automatisch vom Skript bestimmt (ruhigstes, vollständig sichtbares 2,2-s-Fenster
aller Clips des Spielers, mit Strafe für Gegenlicht-Dunst). Überschreibbar in
`scripts/walkout/walkout.config.json` (`clip` + `start`).

## Ohne Walkout-Clip

Lukas-Alexander Litwitz, Lennox Viedts, Dawid Neuber, Isaak Warkehr, Justin Kalwa*, Noel Nauerz,
Oliver Marchel, Noah Pejas, Tobias Helck (Kapitän), Carsten Junge (Trainer) — kein Clip in
`Dolly/`. (*falls 0232/0233 doch Kalwa ist, siehe oben.)

## Für Marvin zu bestätigen

- **0232/0233**: Wer ist das? Jochim (17) oder Kalwa (13)? → in `walkout.config.json` `id`/`slug`
  ggf. ändern, `confirmed: true`, dann `node scripts/walkout/build.mjs --only <slug>` (+ Atlas
  wird automatisch neu gebaut).
- **Janek Brünjes** (0217–0219): Nummer 33 ist eindeutig, Gesicht nur „passt“ — kurz draufschauen.
