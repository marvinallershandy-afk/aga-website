import * as THREE from 'three'

// ─────────────────────────────────────────────────────────────
// v14: Der Partyraum lebt in einer EIGENEN THREE.Scene (createPortal in
// Scene.tsx) und wird von einer zweiten RenderPass ohne Clear in denselben
// Composer-Puffer gezeichnet (CinemaEffects.tsx). Der Tiefenpuffer bleibt
// erhalten → Außenwände verdecken den Raum korrekt und umgekehrt.
//
// Warum: In einer gemeinsamen Szene rechnete JEDES Außen-Material (Wald,
// Gras, Fans, Karten) die 11 Partyraum-Punktlichter mit → Desktop fiel an
// Mannschaft/Fanblock/Finale auf 30 FPS (gemessen, v14-Integrationslauf).
// Getrennt sieht jede Szene nur ihre eigenen Lichter.
// ─────────────────────────────────────────────────────────────

export const partyScene = new THREE.Scene()
partyScene.name = 'partyroom'
