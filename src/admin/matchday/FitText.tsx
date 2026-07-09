import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'

// Verkleinert die Schriftgröße deterministisch, bis der Text in Breite UND Höhe
// des Containers passt. Wichtig für lange Vereins-/Spielernamen in den Grafiken.
export function FitText({
  children,
  max,
  min = 12,
  className,
  style,
  lines = 1,
}: {
  children: string
  max: number // Start-/Maximalgröße in px
  min?: number
  className?: string
  style?: CSSProperties
  lines?: number // erlaubte Zeilen (für Umbruch)
}) {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState(max)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let current = max
    el.style.fontSize = `${current}px`
    // Schrittweise verkleinern, bis Inhalt nicht mehr überläuft.
    let guard = 0
    while (
      guard < 200 &&
      current > min &&
      (el.scrollWidth > el.clientWidth + 1 || el.scrollHeight > el.clientHeight + 1)
    ) {
      current -= 1
      el.style.fontSize = `${current}px`
      guard += 1
    }
    setSize(current)
  }, [children, max, min, lines])

  return (
    <div
      ref={ref}
      className={className}
      style={{
        fontSize: size,
        lineHeight: 1.02,
        display: '-webkit-box',
        WebkitLineClamp: lines,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
