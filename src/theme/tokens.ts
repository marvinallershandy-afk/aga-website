// ─────────────────────────────────────────────────────────────
// SVA Design Tokens — single source of truth for CI + stage palette
// CI: SVA-Rot #E91D29 · SVA-Schwarz #231F20 · Weiß · warmes Rasengrün
// NICHT Bordeaux (#7D1F2E), NICHT Lavendel.
// ─────────────────────────────────────────────────────────────

export const COLORS = {
  // Core CI
  red: '#E91D29',
  redDeep: '#B4141D',
  black: '#231F20',
  deepBlack: '#0E0D0D',
  white: '#FFFFFF',

  // Stage / atmosphere
  grass: '#2f6b2a',
  grassDark: '#1f4a1c',
  grassLight: '#3d8a2f',

  // Card accent — warmes Gold für den "seltene Karte"-Effekt
  gold: '#E8C15A',
  goldDeep: '#B8912F',

  // Evening / floodlight atmosphere
  floodWarm: '#ffe6b0',
  floodCool: '#9fb4ff',
  skyZenith: '#12162e',
  skyHorizon: '#3a2a3f',
  fog: '#181425',
} as const

// Typografische Stimme:
//   Display  → Anton (ultra-condensed, "Trikot"-Charakter, sportlich, laut)
//   Body     → Archivo Variable (moderne Grotesk, ruhig, gut lesbar)
export const FONTS = {
  display: '"Anton", system-ui, sans-serif',
  body: '"Archivo Variable", system-ui, -apple-system, sans-serif',
} as const

// Fluid type scale (clamp-based)
export const TYPE = {
  hero: 'clamp(3.2rem, 13vw, 11rem)',
  h1: 'clamp(2.4rem, 8vw, 6rem)',
  h2: 'clamp(1.8rem, 5vw, 3.5rem)',
  body: 'clamp(1rem, 1.4vw, 1.2rem)',
  small: '0.8rem',
} as const
