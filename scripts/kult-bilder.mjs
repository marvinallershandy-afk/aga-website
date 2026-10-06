import sharp from 'sharp'
import fs from 'node:fs'
const SRC = '/Users/marvinallers/Desktop/SVA-Auswahl'
const REPO = '/Users/marvinallers/code/sva-fussball/.claude/worktrees/agent-a148f90464a5d427e'
const MAX = 1600

const JOBS = [
  // Kabinen-Kult (aktiv) → public/album/karten/kult/
  ['A-kabinen-kult/pokal1_013-IMG_2530.jpg', 'public/album/karten/kult/kult-bromance.webp'],
  ['A-kabinen-kult/pokal1_019-IMG_2509.jpg', 'public/album/karten/kult/kult-pokaltraeger.webp'],
  ['A-kabinen-kult/pokal5_197-IMG_1973.jpg', 'public/album/karten/kult/kult-freudenhaufen.webp'],
  ['A-kabinen-kult/pokal2_087-IMG_2236.jpg', 'public/album/karten/kult/kult-alle-drauf.webp'],
  ['A-kabinen-kult/pokal3_121-IMG_2126.jpg', 'public/album/karten/kult/kult-der-krampf.webp'],
  ['A-kabinen-kult/drochI_173-IMG_6071.jpg', 'public/album/karten/kult/kult-der-salto.webp'],
  ['A-kabinen-kult/pokal2_093-IMG_2206.jpg', 'public/album/karten/kult/kult-trikot-hoch.webp'],
  ['A-kabinen-kult/pokal1_033-IMG_2436.jpg', 'public/album/karten/kult/kult-koenig-der-latte.webp'],
  ['A-kabinen-kult/oste_022-IMG_1893.jpg', 'public/album/karten/kult/kult-psst.webp'],
  // Monats-Moment · Action (inaktiv) → public/album/karten/moment-pool/
  ['C-action/drochI_146-IMG_5936.jpg', 'public/album/karten/moment-pool/action-01.webp'],
  ['C-action/pokal3_122-IMG_2123.jpg', 'public/album/karten/moment-pool/action-02.webp'],
  ['C-action/drochI_010-IMG_6235.jpg', 'public/album/karten/moment-pool/action-03.webp'],
  ['C-action/oste_063-IMG_1903.jpg', 'public/album/karten/moment-pool/action-04.webp'],
  ['C-action/trikots_046-IMG_9655.jpg', 'public/album/karten/moment-pool/action-05.webp'],
  ['C-action/ahl_182-IMG_3608.jpg', 'public/album/karten/moment-pool/action-06.webp'],
  ['C-action/drochI_162-IMG_5993.jpg', 'public/album/karten/moment-pool/action-07.webp'],
  ['C-action/drochI_175-IMG_6084.jpg', 'public/album/karten/moment-pool/action-08.webp'],
  // Monats-Moment · Momente (inaktiv)
  ['D-momente/drochI_047-IMG_6346.jpg', 'public/album/karten/moment-pool/moment-01.webp'],
  ['D-momente/pokal4_155-IMG_2060.jpg', 'public/album/karten/moment-pool/moment-02.webp'],
  ['D-momente/pokal1_037-IMG_2397.jpg', 'public/album/karten/moment-pool/moment-03.webp'],
  ['D-momente/pokal2_083-IMG_2246.jpg', 'public/album/karten/moment-pool/moment-04.webp'],
  ['D-momente/pokal2_091-IMG_2211.jpg', 'public/album/karten/moment-pool/moment-05.webp'],
  ['D-momente/pokal1_046-IMG_2357.jpg', 'public/album/karten/moment-pool/moment-06.webp'],
  ['D-momente/trikots_017-IMG_9529.jpg', 'public/album/karten/moment-pool/moment-07.webp'],
  ['D-momente/oste_153-IMG_1885.jpg', 'public/album/karten/moment-pool/moment-08.webp'],
  // Stimmung (Hintergrund-Pool) → public/stimmung/
  ['E-stimmung/pokal2_086-IMG_2241.jpg', 'public/stimmung/stimmung-fahne-tor.webp'],
  ['E-stimmung/oste_012-IMG_2036.jpg', 'public/stimmung/stimmung-fahne-zaun.webp'],
  ['E-stimmung/pokal2_099-IMG_2188.jpg', 'public/stimmung/stimmung-kreis-abend.webp'],
  ['E-stimmung/pokal1_038-IMG_2391.jpg', 'public/stimmung/stimmung-pokal.webp'],
  ['E-stimmung/drass_155-IMG_1773.jpg', 'public/stimmung/stimmung-anzeigetafel.webp'],
  ['E-stimmung/drass_166-IMG_1652.jpg', 'public/stimmung/stimmung-flutlicht.webp'],
]
let n = 0
for (const [src, dest] of JOBS) {
  const out = REPO + '/' + dest
  fs.mkdirSync(out.slice(0, out.lastIndexOf('/')), { recursive: true })
  const info = await sharp(SRC + '/' + src).rotate().resize({ width: MAX, height: MAX, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(out)
  const kb = Math.round(fs.statSync(out).size / 1024)
  console.log(`${dest}  ${info.width}x${info.height}  ${kb} KB`)
  n++
}
console.log(`\n${n} Bilder verkleinert (≤ ${MAX}px, webp, Credit: picture by Nele)`)
