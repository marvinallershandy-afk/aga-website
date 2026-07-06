// Portrait-Behandlung für Spielerfotos auf den Karten.
// A/B-Entscheidung für Marvin — hier umschalten:
//   'duotone' → Foto wird in Team-Farben (Rot/Schwarz) eingefärbt,
//               maximal einheitlicher Kader-Look, verzeiht gemischte
//               Foto-Qualität (empfohlen für Handy-Fotos).
//   'cutout'  → Freisteller-Look in Farbe mit Studio-Licht von oben,
//               näher am FIFA-Original, braucht saubere Freisteller.
export type PortraitStyle = 'duotone' | 'cutout'
// v5.5 (Vorstands-Politur): Variante B — echte Higgsfield-Freisteller
// mit Spotlight-Bühne. Duotone bleibt als Fallback-Variante erhalten.
export const PORTRAIT_STYLE: PortraitStyle = 'cutout'
