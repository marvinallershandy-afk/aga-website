import { useEffect, useRef } from 'react'
import { ZoomIn, RotateCcw } from 'lucide-react'
import { Button } from './ui/button'
import { CROP_DEFAULT, cropRect, type CropState } from '../lib/image'

// ─────────────────────────────────────────────────────────────
// v14-C: Foto zuschneiden — Rahmen 2:3 wie auf der Website-Karte.
// Bild mit dem Finger/der Maus verschieben, mit dem Regler zoomen.
// Rendert eine Live-Vorschau per Canvas (gleiche Mathematik wie der Export).
// ─────────────────────────────────────────────────────────────

const ASPECT = 2 / 3

export function FotoZuschnitt({
  img,
  value,
  onChange,
}: {
  img: HTMLImageElement
  value: CropState
  onChange: (c: CropState) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<{ x: number; y: number; start: CropState } | null>(null)
  const w = 240
  const h = Math.round(w / ASPECT)

  useEffect(() => {
    const c = canvasRef.current
    const ctx = c?.getContext('2d')
    if (!c || !ctx) return
    const dpr = window.devicePixelRatio || 1
    c.width = w * dpr
    c.height = h * dpr
    const r = cropRect(img.naturalWidth, img.naturalHeight, ASPECT, value)
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(img, r.sx, r.sy, r.sw, r.sh, 0, 0, c.width, c.height)
  }, [img, value, w, h])

  // Verschieben: Pixel-Weg im Rahmen → Anteil am Spielraum (−1 … 1).
  const onPointerDown = (e: React.PointerEvent) => {
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, start: value }
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current
    if (!d) return
    const r = cropRect(img.naturalWidth, img.naturalHeight, ASPECT, d.start)
    const scale = r.sw / w // Quellpixel je Bildschirmpixel
    const maxX = (img.naturalWidth - r.sw) / 2
    const maxY = (img.naturalHeight - r.sh) / 2
    const dx = maxX > 0 ? (-(e.clientX - d.x) * scale) / maxX : 0
    const dy = maxY > 0 ? (-(e.clientY - d.y) * scale) / maxY : 0
    const clamp = (v: number) => Math.max(-1, Math.min(1, v))
    onChange({ ...d.start, x: clamp(d.start.x + dx), y: clamp(d.start.y + dy) })
  }
  const onPointerUp = () => {
    drag.current = null
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <canvas
        ref={canvasRef}
        style={{ width: w, height: h, touchAction: 'none' }}
        className="cursor-grab rounded-lg border-2 border-sva-gold/60 bg-black active:cursor-grabbing"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-label="Fotoausschnitt — zum Verschieben ziehen"
      />
      <div className="flex w-full max-w-[260px] items-center gap-2">
        <ZoomIn className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={value.zoom}
          onChange={(e) => onChange({ ...value, zoom: Number(e.target.value) })}
          className="h-8 flex-1 accent-[hsl(var(--primary))]"
          aria-label="Zoom"
        />
        <Button type="button" variant="ghost" size="icon" onClick={() => onChange(CROP_DEFAULT)} aria-label="Ausschnitt zurücksetzen">
          <RotateCcw className="h-4 w-4" />
        </Button>
      </div>
      <p className="text-center text-xs text-muted-foreground">Ziehen zum Verschieben · Regler zum Zoomen. Kopf ins obere Drittel.</p>
    </div>
  )
}
