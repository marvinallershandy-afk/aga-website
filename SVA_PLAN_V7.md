# SVA-FUSSBALL — Master-Prompt v7: CC0-Objekte + Kino-Feinschliff (autonom)

> Autonom, Gate für Gate, Commit + Push + Screenshots (Präfix v7-). ARBEITSMODUS SPARSAM.
> Leitplanken: 60 FPS am Netzteil, reduced-motion/Fallback intakt, SVA-Rot `#E91D29`/Schwarz
> nur für was WIR bauen, reale Dinge behalten echte Farben. Nur CC0-Assets.
>
> **Entscheidung: Cel verworfen — der Kino-Look BLEIBT** (mehr Schatten, Tiefe, Abendstimmung,
> premium). Dieser Lauf VERTIEFT den Kino-Look, wechselt ihn nicht. Branch stil-cel-shading gelöscht.

**NORDSTERN:** Insta → Spieler/Sponsoren/Fans, hochwertig, stimmig, roter Faden. Regisseur der Reise.

## Etappen
- **E0** Baseline: v7-Branch von main, tsc=0, Build grün, echte 60-FPS-Baseline (Perf-Overlay), Cel-Branch weg. 🟢 Gate 0
- **E1** CC0-Objekte statt Klumpen (Kern): EIN konsistentes CC0-Pack (Quaternius/Kenney/Poly Pizza),
  Lizenz in `ASSETS_CREDITS.md`. Kandidaten: Bäume/Waldrand, Bänke, Zaun/Bande, Kleinrequisiten.
  Kino-Look/Material für alle. **InstancedMesh für Bäume** (Wald aus Einzel-Meshes killt FPS). 🟢 Gate 1
- **E2** Kino-Feinschliff: Vereinsheim-Materialtiefe, Flutlicht-Lampen glühen selbst (Emissive),
  Kontaktschatten unter allen Objekten, Fog-Tiefenstaffelung, Grading außen↔Partyraum. 🟢 Gate 2
- **E3** Gesamt-Politur: Kamera gegen v6-Regeln (kein Clipping an neuen Meshes), Übergänge, mobile
  Perf, reduced-motion/Fallback mit neuen Assets, Insta-Erstbesucher-Durchlauf. 🟢 Gate 3
- **E4** Abschluss: Push, Screenshots, Perf v6→v7, Bericht + Nordstern-Selbstcheck + Merge-Empfehlung.

## Offen (Marvin, nicht im Lauf)
Echte Spielerfotos (~10, Handyfotos > Higgsfield), Trainingszeiten (Platzhalter ersetzen),
fussball.de-Vereins-ID (Kandidat 00ES8GN7SS00004CVV0AG08LVUPGND5I — prüfen), Deployment.

## Nicht in diesem Lauf
Stilwechsel (Kino final), Higgsfield-Assets (Credits leer), Deployment/Domain, Supabase.
