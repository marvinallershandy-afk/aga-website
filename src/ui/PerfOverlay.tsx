import { useStore } from '../store/useStore'

// Temporäres Stats-Overlay (Frametime-Check für die Gates). Toggle mit "P".
export function PerfOverlay() {
  const show = useStore((s) => s.showPerf)
  const { fps, drawCalls, triangles } = useStore((s) => s.perfStats)
  if (!show) return null
  const col = fps >= 50 ? '#38ff8f' : fps >= 30 ? '#ffd400' : '#ff4d5d'
  return (
    <div
      style={{
        position: 'fixed', bottom: 12, left: 12, zIndex: 400,
        background: 'rgba(0,0,0,0.85)', border: '1px solid #333', borderRadius: 6,
        padding: '8px 12px', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.7,
        pointerEvents: 'none',
      }}
    >
      <div>FPS <b style={{ color: col, fontSize: 14 }}>{fps}</b></div>
      <div style={{ color: '#aaa' }}>Draws {drawCalls}</div>
      <div style={{ color: '#aaa' }}>Tris {triangles.toLocaleString()}</div>
    </div>
  )
}
