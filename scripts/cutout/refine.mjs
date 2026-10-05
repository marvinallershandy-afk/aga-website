// v17-D: Freisteller-Feinschliff aus den Print-Originalen (1400×2100)
//   · Matte-Choke (≈0,7 px) + Feather (0,7 px) → keine weiche „Wolke" am Rand
//   · Kanten-Entfärbung: Randpixel bekommen die Farbe aus dem Inneren
//     (alpha-gewichteter Blur), Grünüberhang wird gekappt → kein Grünstich/Halo
//   · Ausgabe: cutout/hd/*.webp 960×1440 (Karte/Modal/Galerie, scharf)
//              cutout/*.webp   640×960  (Gesichter, 3D-Textur, Live — wie bisher)
// node refine.mjs <maskDir> <publicPlayersDir> <sheet.png>
import sharp from 'sharp'
import fs from 'node:fs'
const [inDir, outDir, sheet] = process.argv.slice(2)
fs.mkdirSync(outDir + '/cutout/hd', { recursive: true })
const files = fs.readdirSync(inDir).filter((f) => f.endsWith('.png')).sort()
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t) }
const tiles = []
for (const f of files) {
  const { data, info } = await sharp(`${inDir}/${f}`).toColourspace('srgb').ensureAlpha().raw({ depth: 'uchar' }).toBuffer({ resolveWithObject: true })
  const { width: W, height: H } = info
  const N = W * H
  // sharp premultipliziert beim Blur von RGBA selbst → Farbe = alpha-gewichteter Mittelwert
  const raw4 = { raw: { width: W, height: H, channels: 4 } }
  const aBlur4 = await sharp(data, raw4).blur(0.7).raw().toBuffer()
  const preBlur = await sharp(data, raw4).blur(4).raw().toBuffer()
  const out = Buffer.alloc(N * 4)
  for (let i = 0; i < N; i++) {
    const a0 = aBlur4[i * 4 + 3] / 255
    const a = smooth(0.18, 0.92, a0)
    let r = data[i * 4], g = data[i * 4 + 1], b = data[i * 4 + 2]
    if (a < 0.985 && a > 0) {
      const pb = preBlur[i * 4 + 3] / 255
      if (pb > 0.02) {
        const ir = preBlur[i * 4], ig = preBlur[i * 4 + 1], ib = preBlur[i * 4 + 2]
        const k = Math.pow(a, 1.5) // je transparenter, desto mehr Innenfarbe
        r = ir + (r - ir) * k
        g = ig + (g - ig) * k
        b = ib + (b - ib) * k
      }
      // Grünüberhang kappen (Rasen/Bäume im Hintergrund)
      const cap = Math.max(r, b) + 6
      if (g > cap) g = cap + (g - cap) * a * 0.3
    }
    out[i * 4] = Math.max(0, Math.min(255, r))
    out[i * 4 + 1] = Math.max(0, Math.min(255, g))
    out[i * 4 + 2] = Math.max(0, Math.min(255, b))
    out[i * 4 + 3] = Math.round(a * 255)
  }
  const img = sharp(out, { raw: { width: W, height: H, channels: 4 } })
  const slug = f.replace('.png', '')
  const hd = await img.clone().resize(960, 1440, { kernel: 'lanczos3', fit: 'fill' }).sharpen({ sigma: 0.45 }).webp({ quality: 88, alphaQuality: 92, effort: 6, smartSubsample: true }).toFile(`${outDir}/cutout/hd/${slug}.webp`)
  const sd = await img.clone().resize(640, 960, { kernel: 'lanczos3', fit: 'fill' }).sharpen({ sigma: 0.4 }).webp({ quality: 84, alphaQuality: 90, effort: 6, smartSubsample: true }).toFile(`${outDir}/cutout/${slug}.webp`)
  console.log(slug, W + 'x' + H, 'hd', Math.round(hd.size / 1024) + 'KB', 'sd', Math.round(sd.size / 1024) + 'KB')
  tiles.push(await sharp(`${outDir}/cutout/hd/${slug}.webp`).resize(160, 240).png().toBuffer())
}
if (sheet) {
  const cols = 8, rows = Math.ceil(tiles.length / cols)
  await sharp({ create: { width: cols * 160, height: rows * 240, channels: 4, background: { r: 120, g: 16, b: 22, alpha: 1 } } })
    .composite(tiles.map((t, i) => ({ input: t, left: (i % cols) * 160, top: Math.floor(i / cols) * 240 }))).png().toFile(sheet)
}
