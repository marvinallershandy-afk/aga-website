// v19-S (Audit B §2.4 / A §2.7): eigene OG-/Teilen-Bilder für /partner und /live.
// 1200×630. Hintergrund aus vorhandenen Projekt-Fotos (Banden-Spieltagsfoto bzw.
// Flutlicht), dunkler Verlauf links für Lesbarkeit, Vereinswappen + Headline.
// Textschrift wie in scripts/album-teaser.mjs: font-family-Fallback (Anton →
// Impact), da Anton nur als woff vorliegt und librsvg keine @font-face lädt.
//   node scripts/og-bilder.mjs
import sharp from 'sharp'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { mkdirSync } from 'node:fs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const W = 1200
const H = 630
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const ANTON = "Anton, Impact, 'Arial Narrow', sans-serif"
const ARCHIVO = "Archivo, 'Helvetica Neue', Arial, sans-serif"

async function wappen(size) {
  return sharp(join(ROOT, 'public/brand/wappen.png')).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer()
}

/**
 * @param {string} quelle  Hintergrundbild (public/…)
 * @param {string} kicker  roter Kicker
 * @param {string[]} zeilen Headline (1–2 Zeilen, Anton)
 * @param {string} sub     Unterzeile
 * @param {string} ziel    Ausgabedatei (public/og/…)
 */
async function bauen(quelle, kicker, zeilen, sub, ziel) {
  const grund = await sharp(join(ROOT, quelle)).resize(W, H, { fit: 'cover', position: 'centre' }).toBuffer()
  const headY = zeilen.length > 1 ? [300, 418] : [360]
  const headSvg = zeilen.map((z, i) => `<text x="64" y="${headY[i]}" font-family="${ANTON}" font-size="124" letter-spacing="1" fill="#F4F2EF">${esc(z.toUpperCase())}</text>`).join('')
  const overlay = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#0B0A0B" stop-opacity="0.94"/>
        <stop offset="0.55" stop-color="#0B0A0B" stop-opacity="0.72"/>
        <stop offset="1" stop-color="#0B0A0B" stop-opacity="0.18"/>
      </linearGradient>
      <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0.45" stop-color="#0B0A0B" stop-opacity="0"/>
        <stop offset="1" stop-color="#0B0A0B" stop-opacity="0.65"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#g)"/>
    <rect width="${W}" height="${H}" fill="url(#b)"/>
    <text x="146" y="104" font-family="${ARCHIVO}" font-weight="700" font-size="27" letter-spacing="3" fill="#E91D29">${esc(kicker.toUpperCase())}</text>
    ${headSvg}
    <text x="66" y="${headY[headY.length - 1] + 70}" font-family="${ARCHIVO}" font-weight="500" font-size="33" fill="#CFCCCB">${esc(sub)}</text>
    <text x="64" y="590" font-family="${ARCHIVO}" font-weight="700" font-size="24" letter-spacing="2" fill="#8C8A88">AGA-ERSTE.DE</text>
  </svg>`)
  mkdirSync(join(ROOT, 'public/og'), { recursive: true })
  await sharp(grund)
    .composite([{ input: overlay, top: 0, left: 0 }, { input: await wappen(64), top: 52, left: 64 }])
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(join(ROOT, ziel))
  console.log('geschrieben:', ziel)
}

await bauen(
  'public/partner/spieltag-bande.webp',
  'SV Agathenburg-Dollern · Partner',
  ['Deine Bande', 'wartet'],
  'Werde sichtbar am Waldsportplatz — auf jedem Spielfoto.',
  'public/og/partner.jpg',
)
await bauen(
  'public/fans/torjubel.webp',
  'Spieltag · Liveticker',
  ['SVA Live'],
  'Countdown, Aufstellung und Liveticker — Spieltag für Spieltag.',
  'public/og/live.jpg',
)
console.log('fertig.')
