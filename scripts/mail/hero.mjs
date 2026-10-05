// Rendert die Bild-Köpfe für die Login-Mails (1200×760, JPEG). Fotos: picture by Nele, Meisterspieltag 2026
import { chromium } from '/Users/marvinallers/code/sva-fussball/node_modules/playwright/index.mjs'
import { readFileSync } from 'node:fs'
const R = '/Users/marvinallers/code/sva-fussball'
const N = new URL('fotos/', import.meta.url).pathname
const OUT = new URL('.', import.meta.url).pathname
const uri = (p, t) => `data:${t};base64,${readFileSync(p).toString('base64')}`
const TRAUBE = uri(N + 'jubel-traube.jpg', 'image/jpeg')
const UMARMUNG = uri(N + 'jubel-umarmung.jpg', 'image/jpeg')
const LAUF = uri(N + 'lauf-zu-den-fans.jpg', 'image/jpeg')
const TEAM = uri(N + 'mannschaftsfoto-meister.jpg', 'image/jpeg')
const wappen = uri(R + '/public/brand/wappen.png', 'image/png')
const anton = uri(R + '/dist/assets/anton-latin-400-normal-Byf51wtH.woff2', 'font/woff2')

const VARIANTEN = {
  login: [TRAUBE, '50% 40%', 'Mitglieder-Login', 'DEIN LOGIN.'],
  willkommen: [UMARMUNG, '50% 40%', 'Willkommen im Verein', 'SCHÖN, DASS DU DA BIST.'],
  team: [TEAM, 'TEAM', 'Vereins-Pflege', 'WILLKOMMEN IM TEAM.'],
  passwort: [LAUF, '50% 40%', 'Konto', 'NEUES PASSWORT.'],
  email: [LAUF, '50% 40%', 'Konto', 'NEUE E-MAIL-ADRESSE.'],
}

const html = (foto, pos, kicker, titel) => `<!doctype html><html><head><style>
@font-face{font-family:Anton;src:url(${anton}) format('woff2')}
*{margin:0;box-sizing:border-box}
body{width:1200px;height:760px;position:relative;overflow:hidden;background:#0d0b0c;font-family:Anton}
.foto{position:absolute;left:0;right:0;top:${pos==='TEAM'?'-400px':'0'};height:${pos==='TEAM'?'1180px':'800px'};background:url(${foto}) ${pos==='TEAM'?'50% 50%':pos}/cover;filter:saturate(1.06) contrast(1.06)}
.oben{position:absolute;inset:0 0 auto 0;height:220px;background:linear-gradient(180deg,rgba(12,9,10,.75),rgba(12,9,10,0))}
.unten{position:absolute;inset:auto 0 0 0;height:420px;background:linear-gradient(0deg,rgba(12,9,10,1) 0%,rgba(12,9,10,.88) 34%,rgba(12,9,10,0) 100%)}
.wappen{position:absolute;left:64px;top:48px;width:76px;filter:drop-shadow(0 6px 14px rgba(0,0,0,.5))}
.verein{position:absolute;left:158px;top:62px;color:#fff;font-size:28px;letter-spacing:1.5px;line-height:1;text-shadow:0 2px 12px rgba(0,0,0,.5)}
.verein span{display:block;color:rgba(255,255,255,.7);font-family:Arial,sans-serif;font-weight:700;font-size:14px;letter-spacing:5px;margin-top:10px}
.kicker{position:absolute;left:66px;bottom:170px;color:#ff3540;font-family:Arial,sans-serif;font-weight:700;font-size:20px;letter-spacing:6px;text-transform:uppercase}
.titel{position:absolute;left:62px;right:40px;bottom:52px;color:#fff;font-size:104px;line-height:1;letter-spacing:1px;white-space:nowrap}
.bar{position:absolute;left:0;right:0;bottom:0;height:10px;background:#e91d29}
.credit{position:absolute;right:28px;top:24px;color:rgba(255,255,255,.55);font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px}
</style></head><body>
<div class="foto"></div><div class="oben"></div><div class="unten"></div>
<img class="wappen" src="${wappen}">
<div class="verein">SV AGATHENBURG-DOLLERN<span>EIN DORF · EIN VEREIN · EIN PLATZ</span></div>
<div class="credit">Foto: picture by Nele</div>
<div class="kicker">${kicker}</div>
<div class="titel">${titel}</div>
<div class="bar"></div>
</body></html>`

const b = await chromium.launch()
const p = await b.newPage({ viewport: { width: 1200, height: 760 } })
for (const [k, [foto, pos, kicker, titel]] of Object.entries(VARIANTEN)) {
  await p.setContent(html(foto, pos, kicker, titel))
  await p.evaluate(() => document.fonts.ready)
  // Titel bei Bedarf schrumpfen, damit er in eine Zeile passt
  await p.evaluate(() => { const t = document.querySelector('.titel'); let s = 104; while (t.scrollWidth > t.clientWidth && s > 60) { s -= 2; t.style.fontSize = s + 'px' } })
  await p.waitForTimeout(150)
  await p.screenshot({ path: `${OUT}hero-${k}.jpg`, type: 'jpeg', quality: 80 })
}
await b.close()
console.log('ok')
