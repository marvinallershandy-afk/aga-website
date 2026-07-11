/** Mini-Trendlinie als Inline-SVG — für KPI-Karten (keine Chart-Dependency). */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  stroke = '#E91D29',
}: {
  values: number[]
  width?: number
  height?: number
  stroke?: string
}) {
  const pts = values.filter((v) => Number.isFinite(v))
  if (pts.length < 2) return null
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const span = max - min || 1
  const pad = 2
  const step = (width - pad * 2) / (pts.length - 1)
  const points = pts
    .map((v, i) => `${(pad + i * step).toFixed(1)},${(height - pad - ((v - min) / span) * (height - pad * 2)).toFixed(1)}`)
    .join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden className="shrink-0">
      <polyline points={points} fill="none" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
