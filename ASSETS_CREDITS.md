# Asset-Herkunft & Lizenzen

Alle 3D-Fremdassets sind **CC0** (Public Domain, keine Namensnennung nötig — hier trotzdem dokumentiert).

## 3D-Modelle

### Kenney — „Nature Kit" (CC0)
- **Quelle:** https://kenney.nl/assets/nature-kit
- **Lizenz:** CC0 1.0 Universal (Public Domain)
- **Verwendet (in `public/models/`):**
  - `tree_pineDefaultA.glb`, `tree_pineDefaultB.glb`, `tree_pineRoundA.glb`
    → Waldrand-Saum (`src/components/ForestTrees.tsx`), als InstancedMesh je Variante,
      Nacht-getönt (Blätter → Waldgrün, Rinde → Braun in Vertex-Colors gebacken).
- **Warum dieses Pack:** EIN konsistenter Low-Poly-Stil; Kiefern passen zum echten
  Waldsportplatz (Platz liegt am Waldrand).

### Football (bestehend)
- `public/models/football.glb` — projekteigen/vorbestehend.

## 2D / Bild (bestehend, Higgsfield)
Siehe `SVA_ABSCHLUSSBERICHT_V5.md` — 5 Spielerfotos, Partyraum-Poster, OG-Image,
Kino-Referenzframe, Waldrand-Textur (alle in `REFERENZ/higgsfield/`, gitignored bzw. abgeleitet).

## v9-E6: Tore & Fans — Entscheidung „prozedural statt Fremd-Asset"

**Ergebnis:** Kein neues Fremd-Asset geladen. Tore und Fans blieben **projekteigene,
prozedurale Geometrie** und wurden nur aufgewertet — bewusst, mit Begründung:

- **Tore** (`src/components/Goals.tsx`): Das „unrealistisch"-Problem war nicht das
  Material, sondern die **fehlende Rahmenform** — das Netz hing als schwebende Fläche
  ohne sichtbare Streben. E6 ergänzt zwei Diagonal-Streben (Latten-Ecke → Boden hinten)
  + Boden-Querstange, vertieft das Netz leicht (0,16 → 0,20) und ersetzt das Chrom-Material
  durch mattes Pulverweiß (echte Vereinstore sind lackiert). Ein CC0-Tor-Modell hätte
  einen fremden Maßstab/Netzstil eingeführt und die weltmaßstäbliche Rauten-Netztextur
  (v5.6) verworfen — schlechterer Trade als die gezielte Rahmen-Ergänzung.
- **Fans** (`src/components/FanBlock.tsx`): Low-Poly-Figuren lasen als „Kegel" (Rumpf-Kopf
  ohne Schultern). E6 ergänzt schlanke Arme + Hals-Absatz, Kopf minimal kleiner. Bewusst
  weiter **abstrahiert, ohne Gesichter** — ein CC0-People-Pack hätte den einheitlichen,
  vereinseigenen Abstraktionsgrad gebrochen.

**CC0-Kandidaten (falls Marvin später doch Fremd-Assets will — NICHT geladen):**
- Tor: Quaternius „Ultimate Modular Sports" / Poly Pizza „Soccer Goal" (CC0) — nur, wenn
  ein foto-echtes Kastentor gewünscht ist; erfordert Maßstab-Anpassung an `PITCH.goalWidth`.
- Fans/Crowd: Quaternius „Ultimate Modular Characters" (CC0) — nur, wenn animierte/detailierte
  Figuren gewünscht sind; kostet Draw-Calls (aktuell: InstancedMesh-freundliche Primitives).

Kein Higgsfield-Kandidat nötig (Guthaben ohnehin aufgebraucht — nicht selbst aufgeladen).
