# SVA-FUSSBALL — Master-Prompt v10: Der Politur-Lauf nach visuellem Audit (autonom)

Branch `v10-politur`. Autonom, Gate für Gate, Commit + Push + Screenshots (v10-). SPARSAM.
Leitplanken: 60 FPS am Netzteil, reduced-motion/Fallback intakt, SVA-Rot `#E91D29`, ADDITIV
(nichts Gutes löschen — Feinschliff, kein Umbau). Basis: Audit-Bericht `SVA_AUDIT_BERICHT.md`.

## E1 — Sponsoren-Bande scharf & lesbar (PRIO 1, Geld-Station)
1. Banden-Textur hochauflösend neu rendern (genug Pixeldichte, anisotropy max, scharfer Text).
2. Text nie spiegelverkehrt — UV/Mesh so, dass Schrift von Kameraseite korrekt liest.
3. Fangzaun darf Banden nicht verdecken (Geometrie/Reihenfolge).
4. Foto-Slot-System: `sponsors[]` mit `logoUrl` → echtes Logo scharf; leer → „HIER KÖNNTE DEIN LOGO STEHEN".
   Namensschema in README.
🟢 Gate 1: Banden Hero + Musik-Anflug scharf/lesbar (Zoom-Beweis), kein Zaun davor, Test-Logo scharf. 60 FPS.

## E2 — Trainerstab als eigene Kategorie
1. `rolle` ('spieler'|'trainer'|'co-trainer'|'teammanager'). Carsten → 'trainer'.
2. Eigener Bereich „TRAINERSTAB" (anderer Kartenstil: Rolle + seit + optional Kontakt, keine Tore/Assists).
3. Spieler-Grid nur noch echte Spieler.
🟢 Gate 2: Carsten im Trainerstab (nicht ANG), Grid ohne Trainer, Trainerkarten unterscheidbar. Screenshot.

## E3 — Karten-Foto-System & Geister-Silhouette beheben
1. Leere `photoUrl` → edler Platzhalter (großes Wappen + Rückennummer groß), kein schwebender Kopf-Kreis.
2. Namensschema für Fotos in README.
🟢 Gate 3: Leere Karte edel (kein Geist), Test-photoUrl korrekt Duotone. Vorher/Nachher.

## E4 — Kleinere verifizierte Fehler
1. Hero-Claim „ein Flutlicht" vs. 4 Masten — Formulierung anpassen.
2. Ton-Button neu (dezent, CI, klar Mute/Unmute, Position überdenken).
3. Fan-Arme an Körper anbinden (kein Schweben), Haltung natürlicher.
4. Bande-Rahmen-Füße immer sichtbar (nicht abschneiden).
5. AGA-URKNALL-Banner-Orientierung korrigieren (nicht spiegelverkehrt).
6. Fanblock-Sponsoren ans Geländer (wenn ohne großen Umbau), sonst Kandidat.
🟢 Gate 4: jeder Punkt vorher/nachher belegt, 60 FPS.

## E5 — Abschluss
Push, Screenshot-Set (alle Stationen D+M), Perf-Tabelle, 6-Punkte-Bericht + Asset-Nachliefer-Liste
(Dateien/Namen/Ablage: Sponsoren-Logos, Spielerfotos, Trainer/Co/Manager-Fotos, Trainingszeiten,
Spieltermine, fussball.de-ID, Streaming-Links). Merge-Empfehlung.

## NICHT in diesem Lauf
Deployment, Cel-Shading, großer Vereinsheim-Umbau, Higgsfield.
