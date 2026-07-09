import { create } from 'zustand'
import type { Player } from '../data/players'

export interface PerfStats {
  fps: number
  drawCalls: number
  triangles: number
}

interface AppState {
  /** 0..1 normalisierter Scroll-Fortschritt über die ganze Seite (Ziel-Wert). */
  scrollProgress: number
  setScrollProgress: (p: number) => void

  /** Index der aktiven Sektion (für Nav-Highlight etc.). */
  activeSection: number
  setActiveSection: (i: number) => void

  /** Für Karten-Detail-Modal. */
  selectedPlayer: Player | null
  setSelectedPlayer: (p: Player | null) => void

  /** Fanblock-Foto-Lightbox (v-website-polish): Index in FAN_PHOTOS des
   *  aktuell groß gezeigten Fotos, oder null. Wird von den 3D-Schildern im
   *  Fanblock (Canvas) UND den DOM-Kacheln gesetzt → eine gemeinsame Lightbox
   *  am App-Root (analog PlayerModal). */
  fanPhoto: number | null
  setFanPhoto: (i: number | null) => void

  /** 3D-Assets geladen → Loader ausblenden. */
  ready: boolean
  setReady: (v: boolean) => void

  /** Ladefortschritt 0..100 (aus dem R3F-Tree gemeldet). */
  loadProgress: number
  setLoadProgress: (p: number) => void

  /** Umgebungs-Fähigkeiten (einmal beim Start ermittelt). */
  reducedMotion: boolean
  webglOK: boolean
  fallback: boolean // true → statische Version
  setCaps: (caps: { reducedMotion: boolean; webglOK: boolean }) => void

  /** Eingangstor: offen = Seite freigegeben (Vorhang gefahren). */
  gateOpen: boolean
  setGateOpen: (v: boolean) => void

  /** Partyraum im Vereinsheim — die Musik-Station der Fahrt.
   *  partyProgress: 0..1 Durchfahrts-Fortschritt (0 = draußen,
   *  1 = Raum-Totale; Hop bei PARTY_HOP) — scroll-getrieben.
   *  partyOpen: Kamera ist drin (abgeleitet, für Audio/DOM-Klasse).
   *  partyNear: Sektion nähert sich → Raum-Chunk vorladen. */
  partyProgress: number
  setPartyProgress: (p: number) => void
  partyOpen: boolean
  setPartyOpen: (v: boolean) => void
  partyNear: boolean
  setPartyNear: (v: boolean) => void

  /** Sponsoren-Karussell (v12-E6): fokussierte Banden-Tafel 0..N-1.
   *  Die Pfeile in der Sponsoren-Sektion setzen den Fokus; die Kamera
   *  fährt an der 3D-Bande entlang auf die fokussierte Tafel. */
  sponsorFocus: number
  sponsorCount: number
  setSponsorFocus: (i: number) => void

  /** Ton an/aus (Nutzer-Entscheidung am Tor bzw. Mute-Toggle). */
  soundOn: boolean
  setSoundOn: (v: boolean) => void

  /** Fangesang-Ambience (v9-E2, Fanblock) — bewusst DEFAULT AUS, Toggle. */
  fanChantOn: boolean
  setFanChant: (v: boolean) => void

  /** Debug/Perf. */
  perfStats: PerfStats
  setPerfStats: (s: PerfStats) => void
  showPerf: boolean
  togglePerf: () => void

  /** Kino-Ebene (v5): Qualitätsstufe + Einzel-Schalter je Effekt.
   *  'full' = Desktop-Kette, 'reduced' = Mobile-sicher
   *  (Grading + Vignette + Korn; teure Effekte aus). */
  cinemaTier: CinemaTier
  setCinemaTier: (t: CinemaTier) => void
  cinemaFx: CinemaFx
  setFx: (k: keyof CinemaFx, v: boolean) => void
  showFxPanel: boolean
  toggleFxPanel: () => void
}

export type CinemaTier = 'full' | 'reduced'

export interface CinemaFx {
  bloom: boolean
  grade: boolean
  vignette: boolean
  grain: boolean
  ca: boolean
  mist: boolean
  letterbox: boolean
}

export const FX_BY_TIER: Record<CinemaTier, CinemaFx> = {
  full: { bloom: true, grade: true, vignette: true, grain: true, ca: true, mist: true, letterbox: true },
  reduced: { bloom: false, grade: true, vignette: true, grain: true, ca: false, mist: false, letterbox: true },
}

export const useStore = create<AppState>((set) => ({
  scrollProgress: 0,
  setScrollProgress: (p) => set({ scrollProgress: p }),

  activeSection: 0,
  setActiveSection: (i) => set((s) => (s.activeSection === i ? s : { activeSection: i })),

  selectedPlayer: null,
  setSelectedPlayer: (p) => set({ selectedPlayer: p }),

  fanPhoto: null,
  setFanPhoto: (i) => set({ fanPhoto: i }),

  ready: false,
  setReady: (v) => set({ ready: v }),

  loadProgress: 0,
  setLoadProgress: (p) => set((s) => (s.loadProgress === p ? s : { loadProgress: p })),

  reducedMotion: false,
  webglOK: true,
  fallback: false,
  setCaps: ({ reducedMotion, webglOK }) =>
    set({ reducedMotion, webglOK, fallback: reducedMotion || !webglOK }),

  gateOpen: false,
  setGateOpen: (v) => set({ gateOpen: v }),

  partyProgress: 0,
  setPartyProgress: (p) => set((s) => (s.partyProgress === p ? s : { partyProgress: p })),
  partyOpen: false,
  setPartyOpen: (v) => set({ partyOpen: v }),
  partyNear: false,
  setPartyNear: (v) => set((s) => (s.partyNear === v ? s : { partyNear: v })),

  // v12-E6: 4 „dein-Logo"-Tafeln (Banden-Slots) — Fokus wandert per Pfeil.
  sponsorFocus: 0,
  sponsorCount: 4,
  setSponsorFocus: (i) => set((s) => {
    const n = s.sponsorCount
    const wrapped = ((i % n) + n) % n
    return s.sponsorFocus === wrapped ? s : { sponsorFocus: wrapped }
  }),

  soundOn: false,
  setSoundOn: (v) => {
    try {
      localStorage.setItem('sva-sound', v ? 'on' : 'off')
    } catch { /* private mode */ }
    set({ soundOn: v })
  },

  fanChantOn: false,
  setFanChant: (v) => {
    try {
      localStorage.setItem('sva-fanchant', v ? 'on' : 'off')
    } catch { /* private mode */ }
    set({ fanChantOn: v })
  },

  perfStats: { fps: 0, drawCalls: 0, triangles: 0 },
  setPerfStats: (s) => set({ perfStats: s }),
  showPerf: false,
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),

  cinemaTier: 'full',
  setCinemaTier: (t) => set({ cinemaTier: t, cinemaFx: { ...FX_BY_TIER[t] } }),
  cinemaFx: { ...FX_BY_TIER.full },
  setFx: (k, v) => set((s) => ({ cinemaFx: { ...s.cinemaFx, [k]: v } })),
  showFxPanel: false,
  toggleFxPanel: () => set((s) => ({ showFxPanel: !s.showFxPanel })),
}))
