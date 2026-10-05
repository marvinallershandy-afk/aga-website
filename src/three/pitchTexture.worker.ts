/// <reference lib="webworker" />
// v16-K: Rasen-Textur im Hintergrund malen (OffscreenCanvas) und als
// ImageBitmaps zurückgeben — der Hauptthread bleibt für die Karte frei.
import { paintPitch, TEX_W, TEX_H, type Ctx2D } from './pitchPaint'

self.onmessage = () => {
  const cv = new OffscreenCanvas(TEX_W, TEX_H)
  const rcv = new OffscreenCanvas(TEX_W, TEX_H)
  const ctx = cv.getContext('2d') as Ctx2D
  const rctx = rcv.getContext('2d') as Ctx2D
  paintPitch(ctx, rctx, (w, h) => new OffscreenCanvas(w, h))
  // Rauheit auf 512 px runter (wie bisher, cache-freundliche Probe)
  const sw = 512
  const sh = Math.round(512 * (TEX_H / TEX_W))
  const small = new OffscreenCanvas(sw, sh)
  ;(small.getContext('2d') as Ctx2D).drawImage(rcv, 0, 0, sw, sh)
  const map = cv.transferToImageBitmap()
  const rough = small.transferToImageBitmap()
  ;(self as unknown as Worker).postMessage({ map, rough }, [map, rough])
}
