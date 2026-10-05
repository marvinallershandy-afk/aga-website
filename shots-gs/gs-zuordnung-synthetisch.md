# Greenscreen: Zuordnung Clip → Spieler

Generiert von `scripts/greenscreen/build.mjs` am 5.10.2026, 14:41:24. Quelle: `~/code/sva-fussball/.claude/worktrees/agent-a2ef6262ef525965a/.sp/input`.

Zuordnung über die Rückennummer, die der Spieler am Clip-Anfang in die Kamera hält (Apple-Vision-Texterkennung, je 4 Bilder/s in den ersten 3 s).
Nur **sichere** oder **manuell bestätigte** Zuordnungen landen in `public/players/gs/` und auf der Website; unsichere Fälle werden im
Arbeitsordner (`unbestaetigt/`) gebaut. Korrektur/Bestätigung: `scripts/greenscreen/zuordnung.json` (siehe docs/GREENSCREEN.md), dann erneut bauen.

| Clip | Dauer | erkannt | Methode | Spieler | Status | Foto | Takes 1–7 (s) |
|---|---|---|---|---|---|---|---|
| IMG_0101.MOV | 43 s | **24** | ocr (10 Bilder) | Tobias Helck (`p-helck`) | sicher | IMG_0102.HEIC | 4.2–9.2 · 10.8–14.8 · 16.0–21.0 · 22.1–27.1 · 29.3–32.1 · 34.2–37.2 · 38.6–41.5 |
| IMG_0103.MOV | 43 s | **37** | ocr (10 Bilder) | Marc Kevin Biedermann (`p-biedermann`) | sicher | — | 4.2–9.2 · 10.9–14.9 · 15.8–20.8 · 22.1–27.1 · 29.3–32.1 · 34.3–37.3 · 38.6–41.5 |
| IMG_0105.MOV | 8 s | — | keine | — | **unsicher → prüfen** — keine Nummer erkannt | — | — |

Kontaktbögen (Anfang/Mitte/Ende je Take) liegen im Arbeitsordner unter `kontakt/<clip>.jpg` — vor der Freigabe kurz ansehen.
