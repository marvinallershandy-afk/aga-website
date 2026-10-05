// v18-P: kleines Teaser-Bild für die Album-Zugänge (Karte, Panels, Rundgang,
// /live): zwei aufgefächerte Sticker mit Freistellern im Album-Look
// (dunkle Folie, helle Sticker-Kante). Erzeugt public/album/teaser.webp.
//   node scripts/album-teaser.mjs
import sharp from 'sharp'

const W = 360
const H = 280
const SW = 150
const SH = 206

async function sticker(datei, nummer, gold) {
  const kante = 7
  const innenW = SW - 2 * kante
  const innenH = SH - 2 * kante
  const spieler = await sharp(`public/players/cutout/${datei}.webp`).resize({ width: innenW, height: innenH, fit: 'cover', position: 'top' }).toBuffer()
  const grund = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2a2627"/><stop offset="1" stop-color="#141213"/></linearGradient></defs>
    <rect width="${SW}" height="${SH}" rx="8" fill="#F4F2EF"/>
    <rect x="${kante}" y="${kante}" width="${innenW}" height="${innenH}" rx="3" fill="url(#g)"/>
  </svg>`)
  const zahl = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${SW}" height="${SH}">
    <text x="${kante + 8}" y="${kante + 30}" font-family="Anton, Impact, sans-serif" font-size="30" fill="${gold ? '#E8C15A' : '#F4F2EF'}">${nummer}</text>
  </svg>`)
  const fuss = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${innenW}" height="22"><rect width="${innenW}" height="22" fill="#E91D29"/></svg>`)
  const maske = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${innenW}" height="${innenH}"><rect width="${innenW}" height="${innenH}" rx="3" fill="#fff"/></svg>`)
  const innen = await sharp({ create: { width: innenW, height: innenH, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([
      { input: spieler, left: 0, top: 0 },
      { input: fuss, left: 0, top: innenH - 22 },
      { input: maske, blend: 'dest-in' },
    ])
    .png()
    .toBuffer()
  return sharp(grund)
    .composite([
      { input: innen, left: kante, top: kante },
      { input: zahl, left: 0, top: 0 },
    ])
    .png()
    .toBuffer()
}

const a = await sticker('tobias-helck', 24, true)
const b = await sticker('malte-pils', 1, false)
const dreh = (buf, grad) => sharp(buf).rotate(grad, { background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
const ra = await dreh(a, -7)
const rb = await dreh(b, 6)
await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
  .composite([
    { input: rb, left: 150, top: 14 },
    { input: ra, left: 38, top: 22 },
  ])
  .webp({ quality: 82, alphaQuality: 90 })
  .toFile('public/album/teaser.webp')
console.log('public/album/teaser.webp')
