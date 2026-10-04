import { Component, type ReactNode } from 'react'
import { useStore } from '../store/useStore'

// ─────────────────────────────────────────────────────────────
// v14: Sicherheitsnetz um die 3D-Bühne. Vorher leerte ein Chunk-404,
// ein Shader-Fehler oder ein GLB-Ladefehler die ganze Seite. Jetzt:
// Fehler → statische Version (StaticBackdrop) + Tor geht auf, der
// Inhalt bleibt komplett erreichbar.
// ─────────────────────────────────────────────────────────────

export function switchToStaticFallback(reason: string) {
  console.warn('[SVA] 3D aus, statische Version aktiv:', reason)
  useStore.setState({ fallback: true, ready: true })
}

export class StageBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: unknown) {
    switchToStaticFallback(error instanceof Error ? error.message : String(error))
  }

  render() {
    return this.state.failed ? null : this.props.children
  }
}
