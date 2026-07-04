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

  /** Debug/Perf. */
  perfStats: PerfStats
  setPerfStats: (s: PerfStats) => void
  showPerf: boolean
  togglePerf: () => void
}

export const useStore = create<AppState>((set) => ({
  scrollProgress: 0,
  setScrollProgress: (p) => set({ scrollProgress: p }),

  activeSection: 0,
  setActiveSection: (i) => set((s) => (s.activeSection === i ? s : { activeSection: i })),

  selectedPlayer: null,
  setSelectedPlayer: (p) => set({ selectedPlayer: p }),

  ready: false,
  setReady: (v) => set({ ready: v }),

  loadProgress: 0,
  setLoadProgress: (p) => set((s) => (s.loadProgress === p ? s : { loadProgress: p })),

  reducedMotion: false,
  webglOK: true,
  fallback: false,
  setCaps: ({ reducedMotion, webglOK }) =>
    set({ reducedMotion, webglOK, fallback: reducedMotion || !webglOK }),

  perfStats: { fps: 0, drawCalls: 0, triangles: 0 },
  setPerfStats: (s) => set({ perfStats: s }),
  showPerf: false,
  togglePerf: () => set((s) => ({ showPerf: !s.showPerf })),
}))
