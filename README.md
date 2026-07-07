# SV Agathenburg-Dollern — 3D-Vereinswelt

Eine begehbare 3D-Vereinswelt für den Amateurfußball-Verein SV Agathenburg-Dollern:
der Fußballplatz als Bühne bei Flutlicht, eine scroll-gesteuerte Kamerafahrt über vier
Stationen, FIFA-Ultimate-Team-Style Spielerkarten mit Holo-Shimmer und One-Tap-Sharing
als Instagram-Story.

> Awwwards-Anspruch, **eine** Experience für alle Geräte, sauberer statischer Fallback
> ohne WebGL / bei `prefers-reduced-motion`. v1 ohne Backend — Inhalte als Seed-Daten.

## Stack

React 19 · Vite · TypeScript · React Three Fiber + drei · framer-motion · zustand

## Entwicklung

```bash
npm install
npm run dev        # Dev-Server
npm run build      # tsc + Produktions-Build
npm run preview    # Build lokal ansehen
```

Tastatur: **P** blendet das Perf-Overlay (FPS / Draw-Calls / Dreiecke) ein/aus.

## Architektur (Kurzüberblick)

| Bereich | Datei(en) |
|---|---|
| 3D-Bühne (lazy-geladen) | `src/components/*` (Scene, Pitch, Floodlights, Stands, Football …) |
| Scroll-Kamerafahrt | `src/camera/CameraPath.ts`, `src/camera/CameraRig.tsx` |
| Scroll → Store | `src/ui/useScrollProgress.ts` |
| 2D-Sektionen (Overlay) | `src/ui/Sections.tsx` |
| Spielerkarten (Holo) | `src/ui/HoloCard.tsx`, `src/ui/cards.css`, `PlayerCardGrid`, `PlayerModal` |
| Story-Share (1080×1920) | `src/ui/storyShare.ts` |
| Tabelle (fussball.de) | `src/ui/FussballWidget.tsx` |
| Fallback (kein WebGL) | `src/ui/StaticBackdrop.tsx` |
| Seed-Daten (v2-ready) | `src/data/players.ts`, `src/data/club.ts` |
| Design-Tokens | `src/theme/tokens.ts` |

Die 3D-Bühne (three/R3F/drei ≈ 258 KB gzip) liegt in einem eigenen, **lazy** geladenen
Chunk — der Fallback-Pfad lädt sie nie.

## Spielerfotos einpflegen (v5-Pipeline — „Datei nach Schema, fertig")

So kommen die restlichen Fotos in die Karten:

1. **Foto** im Hochformat (ideal 4:5, Kopf im oberen Drittel — wie die
   fünf Beispiel-Fotos in `REFERENZ/Spielerfotos/`). Handy-Foto reicht:
   die Duotone-Behandlung (Variante A, `src/ui/cardConfig.ts`) macht
   aus gemischter Foto-Qualität einen einheitlichen Kader-Look.
2. **Verkleinern** auf 800 px Höhe und als WebP ablegen:
   `public/players/<vorname-klein>.webp` — Einzeiler dafür:
   ```sh
   node -e "require('sharp')('FOTO.jpg').resize({height:800}).grayscale().linear(1.12,-15.4).webp({quality:82}).toFile('public/players/vorname.webp')"
   ```
3. **Eintragen** in `src/data/players.ts`: beim Spieler
   `photoUrl: '/players/vorname.webp'` setzen (und `name` echt machen).
   Kein Foto → `photoUrl: null` = gestaltete Silhouetten-Karte.

Beschnitt/Einfärbung: Focal oben + Team-Duotone macht das CSS; die
Graustufen sind aus Performance-Gründen in der Datei gebaked (s. Einzeiler). Eingebaut sind bereits: Tino (1, TW),
Lennard (4), Julio (7), Carsten (9), Eli (10).

## Sponsoren-Logos einpflegen (v10-E1 — Slot-System)

Die 3D-Banden am Spielfeld UND der DOM-Partner-Strip lesen aus einem Array.
Logo rein → erscheint überall scharf; leer → „HIER KÖNNTE DEIN LOGO STEHEN".

1. **Logo** als PNG (transparent oder weißer Hintergrund), quer, ideal ~1200×400 px,
   ablegen unter `public/sponsors/<name-klein>.png`
   (z. B. `public/sponsors/baeckerei-sonne.png`).
2. **Eintragen** in `src/data/club.ts` → `SPONSORS`:
   ```ts
   export const SPONSORS: Sponsor[] = [
     { name: 'Bäckerei Sonne', logoUrl: '/sponsors/baeckerei-sonne.png', url: 'https://…' },
   ]
   ```
   `url` ist optional (macht den DOM-Strip-Slot klickbar). Ohne `logoUrl` bleibt der Slot Platzhalter.
3. Nicht belegte Slots bis `SPONSOR_PLACEHOLDER_SLOTS` zeigen weiter den Platzhalter — bewusstes Verkaufsargument.

## Marvins To-dos (v1 → echt)

- Restliche Spielerfotos + echte Kadernamen (Pipeline oben; Nachnamen
  der 5 Beispiel-Spieler fehlen bewusst noch).
- Echte fussball.de-Vereins-/Team-ID in `src/data/club.ts` (`fussballDeTeamId`).

Details im Abschlussbericht: `SVA_ABSCHLUSSBERICHT.md`. Plan: `SVA_PLAN.md`.
