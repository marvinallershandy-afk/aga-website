# SVA-FUSSBALL — Abschlussbericht v7

**Lauf:** CC0-Objekte + Kino-Feinschliff. Branch `v7-politur` (von main). Kino-Look final, Cel verworfen.

## 1. Was gemacht wurde (6 Punkte)
1. **E0 · Baseline** — v7-Branch von main, tsc=0, Build grün, Perf-Baseline (Automation ~31–36 ms) festgehalten, Cel-Branch gelöscht (lokal+remote).
2. **E1 · CC0-Waldrand** — Kenney Nature Kit (CC0) Kiefern, 3 Varianten als **InstancedMesh** (1 Draw-Call/Variante, ~100 Bäume), S/W/O dicht, Nord offen. Nacht-getönt (Blätter→Waldgrün, Rinde→Braun, in Vertex-Colors gebacken). Lizenz in `ASSETS_CREDITS.md`.
3. **E2 · Kino-Feinschliff** — Bäume via instanzierte AO-Scheiben **geerdet** (Kontaktschatten). Befund: übrige Tiefe-Punkte standen schon (Fassaden-Textur, Flutlicht-Emissive, Fog) — kein Schein-Umbau.
4. **E3 · Kohärenz** — voller Durchlauf Desktop+Mobile: **kein Clipping** (Bäume Radius 11+, Flug max ~7), Waldrand vertieft die Fahrt (Swoop belegt), Fallback unberührt (reduced-motion/kein-WebGL → StaticBackdrop ohne Stage).
5. **Doku & Commits** — jede Etappe committet + gepusht (v7-Präfix-Screenshots).
6. **Merge-Empfehlung** (s.u.).

## 2. Perf v6 → v7 (gleiche Automation, M3, headless)
| Station | v6 | v7 | Δ |
|---|---|---|---|
| hero | 31,3 ms | 34,3 ms | +3,0 |
| team | 36,1 ms | 39,0 ms | +2,9 |
| finale | 33,7 ms | 38,2 ms | +4,5 |

Bäume kosten **~3–5 ms** (Instancing = nur 3 zusätzliche Draw-Calls; Kosten sind Vertices/Fragmente).
Muster unverändert (p95 ~50 ms = Automations-Fenster-Drosselung, kein echter 20-FPS-Einbruch).
⚠️ **Wie in v5/v6: interaktive 60 FPS am Netzteil bitte per Perf-Overlay (Taste „p") gegenprüfen** —
die Automation ist kein Maß für die gefühlte Perf. Falls interaktiv zu schwer: Bäume ließen sich
per `cinemaTier` reduzieren (Hebel vorhanden).

## 3. Nordstern-Selbsteinschätzung
- **Spieler/Sponsoren/Fans** — der Platz wirkt jetzt als **echter Ort im Wald** (Waldsportplatz-Gefühl), hochwertiger und stimmiger. Zahlt auf „echter Verein, echter Ort" ein (Sponsoren-Argument, Fan-Stolz).
- **Roter Faden** — der CC0-Waldrand fügt sich in den Kino-Look (Nacht-Tönung, geerdet), kein Stilbruch.
- **Größte verbliebene Lücke bleibt:** Spielerfotos (2/3 Karten ohne Gesicht).

## 4. Merge-Empfehlung
**`v7-politur` → main mergen.** tsc=0, Build grün, kein Clipping, Fallback intakt, Perf-Delta klein
und über `cinemaTier` regelbar. Kein Risiko für den bestehenden Kino-Look — nur additive Tiefe.
```
git checkout main && git merge v7-politur && git push origin main
```

## 5. Offen (Marvin, nicht im Lauf lösbar)
- **Echte Spielerfotos** (~10, Handyfotos beim Training > Higgsfield; Credits leer).
- **Trainingszeit bestätigen** (Platzhalter „Di & Do ab 19:00").
- **fussball.de-Vereins-ID** (Kandidat aus Recherche: `00ES8GN7SS00004CVV0AG08LVUPGND5I` — prüfen/einsetzen für Live-Tabelle).
- **Deployment-Entscheidung** (Netlify o. ä.).
- **Interaktive 60-FPS-Bestätigung** am Netzteil.
