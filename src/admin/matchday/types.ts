// Datenmodelle für die vier Matchday-Vorlagen.

export type TemplateKey = 'spieltag' | 'aufstellung' | 'ergebnis' | 'motm' | 'steckbrief'
export type FormatKey = 'square' | 'story' // 1080×1080 | 1080×1920

export interface FormatSpec {
  key: FormatKey
  label: string
  width: number
  height: number
}

export const FORMATS: FormatSpec[] = [
  { key: 'square', label: 'Feed (1:1)', width: 1080, height: 1080 },
  { key: 'story', label: 'Story (9:16)', width: 1080, height: 1920 },
]

export interface MatchdayData {
  // Gemeinsam
  wettbewerb: string // z. B. "Kreisliga Stade · 22. Spieltag"
  heim: string
  gast: string
  // Spieltag-Ankündigung
  datum: string // frei formatiert, z. B. "So, 13.07. · 15:00 Uhr"
  ort: string
  // Startaufstellung
  formation: string // z. B. "4-4-2"
  aufstellung: string[] // Namen der Startelf
  // Endergebnis
  toreHeim: string
  toreGast: string
  torschuetzen: string // mehrzeilig erlaubt
  // MOTM
  spielerName: string
  spielerFoto: string | null // Pfad/URL, optional
  motmZusatz: string // kurzer Text, z. B. "2 Tore, 1 Assist"
  // Steckbrief
  spielerNummer: string
  spielerPosition: string
  steckbrief: Record<string, string> // key → Antwort (STECKBRIEF_FELDER)
}

export const DEFAULT_DATA: MatchdayData = {
  wettbewerb: 'Kreisliga Stade · 22. Spieltag',
  heim: 'SV Agathenburg-Dollern',
  gast: 'TuS Fischbek',
  datum: 'So, 13.07. · 15:00 Uhr',
  ort: 'Sportplatz Agathenburg',
  formation: '4-4-2',
  aufstellung: [
    'Tino Bartels',
    'Carsten Rieck',
    'Nico Hause',
    'Lennard Voß',
    'Julio Fernández',
    'Eli Schmidt',
    'Marvin Allers',
    'Jonas Meyer',
    'Kevin Timm',
    'Paul Wagner',
    'Deniz Yildirim',
  ],
  toreHeim: '3',
  toreGast: '1',
  torschuetzen: "24' Allers · 55' Timm · 78' Voß",
  spielerName: 'Marvin Allers',
  spielerFoto: null,
  motmZusatz: '2 Tore, 1 Vorlage',
  spielerNummer: '7',
  spielerPosition: 'Mittelfeld',
  steckbrief: {
    im_verein_seit: '2015',
    lieblingsessen: 'Currywurst mit Pommes',
    lieblingsverein: 'Werder Bremen',
    staerke: 'Standards',
    motto: 'Einer für alle, alle für einen.',
  },
}

export const TEMPLATES: { key: TemplateKey; label: string; desc: string }[] = [
  { key: 'spieltag', label: 'Spieltag-Ankündigung', desc: 'Gegner, Anstoß, Ort' },
  { key: 'aufstellung', label: 'Startaufstellung', desc: 'Formation & Startelf' },
  { key: 'ergebnis', label: 'Endergebnis', desc: 'Ergebnis & Torschützen' },
  { key: 'motm', label: 'Spieler des Spiels', desc: 'MOTM-Würdigung' },
  { key: 'steckbrief', label: 'Steckbrief', desc: 'Spieler-Vorstellung' },
]
