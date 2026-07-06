import { chromium } from 'playwright'
const PORT = process.env.PORT || '5199'
const b = await chromium.launch({ args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader'] })

async function setup(viewport, sound) {
  const p = await (await b.newContext({ viewport, deviceScaleFactor: 2 })).newPage()
  p.on('pageerror', e => console.log('PE:', e.message))
  await p.goto(`http://localhost:${PORT}`, { waitUntil: 'load', timeout: 60000 })
  await p.waitForFunction(() => !document.querySelector('[data-testid=gate] button[disabled]'), null, { timeout: 60000 })
  await p.click(sound ? 'text=Mit Ton betreten' : 'text=Lieber leise')
  await p.waitForTimeout(2000)
  return p
}
const scrollMusik = (p, off = 0) => p.evaluate((o) => {
  const el = document.getElementById('musik')
  const center = el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2
  window.scrollTo({ top: center + o, behavior: 'instant' })
}, off)

// A · Desktop: Raum-Framing
{
  const p = await setup({ width: 1440, height: 900 }, true)
  // Anflug: kurz VOR der Sektion (Oberkante noch unter der Mitte)
  await p.evaluate(() => {
    const el = document.getElementById('musik')
    window.scrollTo({ top: el.offsetTop - window.innerHeight * 0.75, behavior: 'instant' })
  })
  await p.waitForTimeout(2500)
  const gAussen = await p.evaluate(() => window.AudioManager.debugGains())
  await p.screenshot({ path: 'SVA_SCREENSHOTS/v4-party-approach.png' })
  // Drin: Sektionszentrum
  await scrollMusik(p)
  await p.waitForTimeout(2500)
  const gDrin = await p.evaluate(() => window.AudioManager.debugGains())
  const flags = await p.evaluate(() => ({
    partyOpen: window.useStore.getState().partyOpen,
    inPartyClass: document.body.classList.contains('in-party'),
  }))
  await p.screenshot({ path: 'SVA_SCREENSHOTS/v4-party-room.png' })
  // Raus: Tabelle
  await p.evaluate(() => {
    const el = document.getElementById('tabelle')
    window.scrollTo({ top: el.offsetTop + el.offsetHeight / 2 - window.innerHeight / 2, behavior: 'instant' })
  })
  await p.waitForTimeout(3000)
  const gRaus = await p.evaluate(() => window.AudioManager.debugGains())
  const partyAfter = await p.evaluate(() => window.useStore.getState().partyOpen)
  await p.screenshot({ path: 'SVA_SCREENSHOTS/v4-party-exit-tabelle.png' })
  console.log('aussen:', JSON.stringify(gAussen))
  console.log('drin:  ', JSON.stringify(gDrin), JSON.stringify(flags))
  console.log('raus:  ', JSON.stringify(gRaus), 'partyOpen:', partyAfter)
  await p.context().close()
}

// B · Dip-Moment: Sektionskante exakt an der Viewport-Mitte
{
  const p = await setup({ width: 1440, height: 900 }, false)
  await p.evaluate(() => {
    const el = document.getElementById('musik')
    window.scrollTo({ top: el.offsetTop - window.innerHeight / 2, behavior: 'instant' })
  })
  await p.waitForTimeout(800)
  const dipOpacity = await p.evaluate(() => {
    const divs = [...document.querySelectorAll('div')].filter(d => d.style.zIndex === '380')
    return divs.map(d => d.style.opacity)
  })
  console.log('dip an Kante:', JSON.stringify(dipOpacity))
  await p.screenshot({ path: 'SVA_SCREENSHOTS/v4-party-dip.png' })
  await p.context().close()
}

// C · Mobile: Raum-Framing
{
  const p = await setup({ width: 390, height: 844 }, false)
  await scrollMusik(p)
  await p.waitForTimeout(2500)
  await p.screenshot({ path: 'SVA_SCREENSHOTS/v4-party-room-mobile.png' })
  await p.context().close()
}
await b.close()
console.log('done')
