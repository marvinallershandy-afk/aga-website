// v20-K: Fotos für Moment-/Kurve-Karten aufbereiten (picture by Nele).
// Quelle: kuratierte Vereinsfotos im Repo → public/karten/<name>.webp
// (lange Kante 1400 px) + <name>-640.webp (Raster/Handy).
// Auswahl-Regeln: keine erkennbaren Kinder, kein Alkohol im Fokus.
//   node scripts/karten-fotos.mjs
import sharp from 'sharp'
import fs from 'node:fs'

const G = 'public/galerie/urknall-pokal-2026/'
const M = 'scripts/mail/fotos/'
const FOTOS = {
  'meister-elf': M + 'mannschaftsfoto-meister.jpg',
  'meister-shirt': 'public/fans/meister.webp',
  'lauf-zu-den-fans': M + 'lauf-zu-den-fans.jpg',
  umarmung: M + 'jubel-umarmung.jpg',
  pokal: G + '03-pokal.webp',
  siegerfoto: G + '02-siegerfoto.webp',
  hochwerfen: G + '11-hochwerfen.webp',
  parade: G + '07-gefangen.webp',
  kurve: M + 'jubel-traube.jpg',
  fahne: G + '09-fahne.webp',
}
fs.mkdirSync('public/karten', { recursive: true })
for (const [name, src] of Object.entries(FOTOS)) {
  for (const [suffix, kante, q] of [['', 1400, 80], ['-640', 640, 76]]) {
    const out = `public/karten/${name}${suffix}.webp`
    await sharp(src).rotate().resize(kante, kante, { fit: 'inside', withoutEnlargement: true }).webp({ quality: q }).toFile(out)
    console.log(out, Math.round(fs.statSync(out).size / 1024) + ' KB')
  }
}
