import { useStore, FX_BY_TIER, type CinemaFx, type CinemaTier } from '../store/useStore'

// Debug-Panel der Kino-Ebene (Taste „e"): jeder Effekt einzeln
// zuschaltbar, Qualitätsstufe umschaltbar — Beweis-Werkzeug für
// die Frametime-Tabelle (Gate 3), im Prod-Build erreichbar aber
// unsichtbar, solange niemand „e" drückt.
const LABELS: Record<keyof CinemaFx, string> = {
  bloom: 'Bloom (selektiv)',
  grade: 'Film-Grading',
  vignette: 'Vignette',
  grain: 'Filmkorn',
  ca: 'Chromatische Aberration',
  mist: 'Bodennebel',
  letterbox: 'Letterbox (Anstoß)',
}

export function FxPanel() {
  const show = useStore((s) => s.showFxPanel)
  const fx = useStore((s) => s.cinemaFx)
  const tier = useStore((s) => s.cinemaTier)
  const setFx = useStore((s) => s.setFx)
  const setTier = useStore((s) => s.setCinemaTier)

  if (!show) return null

  return (
    <div
      style={{
        position: 'fixed',
        left: 12,
        bottom: 12,
        zIndex: 500,
        background: 'rgba(8,6,10,0.92)',
        border: '1px solid rgba(240,236,228,0.2)',
        borderRadius: 8,
        padding: '10px 14px',
        color: '#f2eee6',
        font: '12px/1.7 Archivo, system-ui, sans-serif',
      }}
    >
      <div style={{ fontWeight: 700, marginBottom: 4 }}>Kino-Ebene · Taste „e"</div>
      <div style={{ marginBottom: 6 }}>
        {(['full', 'reduced'] as CinemaTier[]).map((t) => (
          <label key={t} style={{ marginRight: 10, cursor: 'pointer' }}>
            <input type="radio" checked={tier === t} onChange={() => setTier(t)} /> {t}
          </label>
        ))}
      </div>
      {(Object.keys(LABELS) as (keyof CinemaFx)[]).map((k) => (
        <label key={k} style={{ display: 'block', cursor: 'pointer', opacity: FX_BY_TIER[tier][k] ? 1 : 0.75 }}>
          <input type="checkbox" checked={fx[k]} onChange={(e) => setFx(k, e.target.checked)} /> {LABELS[k]}
        </label>
      ))}
    </div>
  )
}
