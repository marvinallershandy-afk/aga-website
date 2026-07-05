export { COLORS } from '../theme/tokens'

// Pitch dimensions (real 105x68m, scaled to 10.5x6.8 units)
export const PITCH = {
  width: 10.5,
  height: 6.8,
  penaltyWidth: 4.032,
  penaltyDepth: 1.65,
  goalAreaWidth: 1.832,
  goalAreaDepth: 0.55,
  centerRadius: 0.915,
  goalWidth: 0.732,
  goalHeight: 0.244,
  goalDepth: 0.15,
} as const

// Rasen-Auslauf über die Spielfeldlinien hinaus (4 m)
export const APRON = 0.4

// Ground extends beyond pitch
export const GROUND_SIZE = 60
