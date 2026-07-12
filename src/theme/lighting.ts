// Zentrale Licht-/Grading-Werte der Bühne — eine Stelle zum Stimmen.
export const LIGHTING = {
  exposure: 1.15,

  ambient: { intensity: 0.3, color: '#5a6a9c' },
  hemi: { sky: '#232c54', ground: '#141810', intensity: 0.68 },
  // v13-X3: shadowIntensity = Mond als Key-Shadow-Licht (sichtbare, weiche
  // Schlagschatten brauchen mehr Punch als das alte reine Fülllicht).
  moon: { intensity: 0.32, shadowIntensity: 0.55, color: '#8f9fd0', position: [-6, 9, -4] as const },
  ballAccent: { intensity: 7, distance: 9, color: '#ffe6b0' },

  // Flutlicht (wird ab Etappe 2/3 zentral über "level" 0..1 getrieben)
  flood: {
    spotIntensity: 190,
    spotAngle: 0.62,
    spotPenumbra: 0.6,
    spotDistance: 26,
    lampEmissive: 3.2,
    color: '#ffe6b0',
  },

  // Linearer Fog: Platz klar, Welt dahinter verschwimmt
  fog: { color: '#14111f', near: 14, far: 48 },
} as const
