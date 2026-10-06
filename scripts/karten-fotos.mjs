// v20-K / v21-A: Fotos für Moment- und Kurve-Karten aufbereiten (picture by Nele).
// v21-A: Jede Karte bekommt einen eigenen Ausschnitt im Format des Foto-Fensters
// der Karte (Breite : Höhe = 100 : 106,4 — siehe .sk__foto img in karten.css),
// damit nichts Wichtiges vom object-fit abgeschnitten wird.
// Ausgabe: public/album/karten/<name>.webp (1080 px breit, ≤ 200 KB) +
// <name>-640.webp (Raster/Handy). Die alten Dateien unter public/karten/ bleiben
// liegen, bis die Migration 20261013200000 in der echten DB gelaufen ist.
// Auswahl-Regeln: keine erkennbaren Kinder, kein Alkohol im Fokus, Fans eher
// als Masse denn als Porträt.
//   node scripts/karten-fotos.mjs
import sharp from 'sharp'
import fs from 'node:fs'

const G = 'public/galerie/urknall-pokal-2026/'
const M = 'scripts/mail/fotos/'
const RATIO = 100 / 106.4
// x, y = linke obere Ecke, b = Breite — alles als Anteil der Quelle (0…1);
// die Höhe folgt aus RATIO.
const FOTOS = {
  // Momente · Meister 2026
  'meister-elf': { src: M + 'mannschaftsfoto-meister.jpg', x: 0.215, y: 0.18, b: 0.57 },
  'meister-shirt': { src: 'public/fans/meister.webp', x: 0, y: 0.06, b: 1 },
  'ab-in-die-kurve': { src: M + 'lauf-zu-den-fans.jpg', x: 0.16, y: 0.08, b: 0.6 },
  umarmung: { src: M + 'jubel-umarmung.jpg', x: 0.18, y: 0.12, b: 0.6 },
  // Momente · Urknall-Pokal 2026
  pokal: { src: G + '01-pokal-jubel.webp', x: 0, y: 0, b: 0.56 },
  siegerfoto: { src: G + '02-siegerfoto.webp', x: 0.18, y: 0.12, b: 0.6 },
  'einer-fliegt': { src: G + '11-hochwerfen.webp', x: 0.2, y: 0, b: 0.62 },
  parade: { src: G + '07-gefangen.webp', x: 0.24, y: 0, b: 0.62 },
  // Kurve
  kurve: { src: M + 'lauf-zu-den-fans.jpg', x: 0, y: 0.1, b: 0.45 },
  fahne: { src: G + '05-kreis.webp', x: 0.03, y: 0, b: 0.56 },
  'urknall-banner': { src: G + '09-fahne.webp', x: 0.11, y: 0, b: 0.625 },
}
const ZIEL = 'public/album/karten'
fs.mkdirSync(ZIEL, { recursive: true })
const nur = process.argv[2]
for (const [name, f] of Object.entries(FOTOS)) {
  if (nur && name !== nur) continue
  const meta = await sharp(f.src).rotate().metadata()
  const W = meta.width
  const H = meta.height
  const left = Math.round(f.x * W)
  const width = Math.min(W - left, Math.round(f.b * W))
  const height = Math.min(H - Math.round(f.y * H), Math.round(width / RATIO))
  const top = Math.min(Math.round(f.y * H), H - height)
  for (const [suffix, breite, q] of [['', 1080, 78], ['-640', 640, 74]]) {
    const out = `${ZIEL}/${name}${suffix}.webp`
    // Qualität senken, bis die Datei ≤ 195 KB ist (feines Laub/Netz ist teuer)
    for (let qq = q; qq >= 50; qq -= 4) {
      await sharp(f.src).rotate().extract({ left, top, width, height }).resize(breite, Math.round(breite / RATIO), { fit: 'cover' }).webp({ quality: qq, effort: 6 }).toFile(out)
      if (fs.statSync(out).size <= 195 * 1024) break
    }
    const kb = Math.round(fs.statSync(out).size / 1024)
    console.log(out.padEnd(48), `${width}×${height} aus ${W}×${H}`.padEnd(26), kb + ' KB', kb > 200 ? '  ← ZU GROSS' : '')
  }
}
