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

## Marvins To-dos (v1 → echt)

- Echte Kadernamen + Spielerfotos in `src/data/players.ts` (`photoUrl`).
- Vereinswappen statt „A"-Platzhalter (Karten + Story-Bild).
- Echte fussball.de-Vereins-/Team-ID in `src/data/club.ts` (`fussballDeTeamId`).
- `public/og-image.png` (Social-Preview) ergänzen.

Details im Abschlussbericht: `SVA_ABSCHLUSSBERICHT.md`. Plan: `SVA_PLAN.md`.
