// ─────────────────────────────────────────────────────────────
// v20-T/v21: Teilen-Bilder 1080×1920 (Instagram-Story) — Canvas.
// Fans: „Mein Tipp“, „Meine Elf“, „Platz X“, „Abzeichen“. Admin (Story der
// Woche): „Jetzt tippen“ (Fr), „Noch nicht getippt?“ (Sa), Tipp-Sieger,
// Top 5 Saison, Fans vs. Kabine (Mo). Einzelne Spieler (Kabine) erscheinen
// NUR positiv (Sieger, Top 5).
// v21-Design wie eine TV-Grafik: echtes Foto als Bühne (abgeblendet), Kopf
// links bündig (Wappen + „SVA Tipp-Liga“), Bauchbinden-Labels in Archivo
// Expanded, Zahlen in Anton, rote Kante statt Glow, Spieler-Freisteller groß.
// ─────────────────────────────────────────────────────────────
import '@fontsource-variable/archivo/wdth.css'
import { CARD_RATIO, FONT_BODY, FONT_DISPLAY, ensureCardFonts, loadImage } from '../ui/cardArt'
import { zeichneKarte, spielerBild } from './karteAdapter'
import type { BonusKey, KaderSpieler, PartnerInfo } from './api'
import { ABZEICHEN, BONUS, bonusLabel, datumKurz, kuerzel, nachname, uhrzeit } from './model'

export const W = 1080
export const H = 1920
const ROT = '#E91D29'
const WEISS = '#F4F2EF'
const GRAU = 'rgba(244,242,239,0.62)'
const LINIE = 'rgba(244,242,239,0.16)'
const GOLD = '#E8C15A'
const INSTA = '@svagathenburg'
const URL_TEXT = 'aga-erste.de/tippen'
const RAND = 84 // linker/rechter Satzspiegel

type Breite = 'normal' | 'expanded' | 'condensed'

function abstand(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}
function breite(ctx: CanvasRenderingContext2D, b: Breite) {
  const c = ctx as CanvasRenderingContext2D & { fontStretch?: string }
  if ('fontStretch' in c) c.fontStretch = b === 'normal' ? 'normal' : b === 'expanded' ? 'expanded' : 'condensed'
}

function setzeFont(ctx: CanvasRenderingContext2D, size: number, font: string, gewicht = '', b: Breite = 'normal') {
  breite(ctx, font === FONT_DISPLAY ? 'normal' : b)
  ctx.font = `${gewicht} ${size}px ${font}`.trim()
}

/** Schriftgröße so wählen, dass der Text in die Breite passt. */
function passend(ctx: CanvasRenderingContext2D, text: string, max: number, groesse: number, font = FONT_DISPLAY, gewicht = '', b: Breite = 'normal'): number {
  let g = groesse
  setzeFont(ctx, g, font, gewicht, b)
  while (ctx.measureText(text).width > max && g > 20) {
    g -= 4
    setzeFont(ctx, g, font, gewicht, b)
  }
  return g
}

interface TextOpts {
  size: number
  font?: string
  weight?: string
  color?: string
  align?: CanvasTextAlign
  spacing?: number
  max?: number
  breite?: Breite
}
function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, o: TextOpts) {
  ctx.textAlign = o.align ?? 'center'
  ctx.textBaseline = 'alphabetic'
  abstand(ctx, o.spacing ?? 0)
  ctx.fillStyle = o.color ?? WEISS
  const font = o.font ?? FONT_DISPLAY
  if (o.max) passend(ctx, t, o.max, o.size, font, o.weight, o.breite)
  else setzeFont(ctx, o.size, font, o.weight, o.breite)
  // Laufweite verschiebt zentrierten Text nach links → ausgleichen
  ctx.fillText(t, x + ((o.align ?? 'center') === 'center' ? (o.spacing ?? 0) / 2 : 0), y)
  abstand(ctx, 0)
  breite(ctx, 'normal')
}
/** Bauchbinden-Label: Archivo Expanded, Versal, gesperrt. */
const label = (ctx: CanvasRenderingContext2D, t: string, x: number, y: number, o: Partial<TextOpts> = {}) =>
  text(ctx, t.toUpperCase(), x, y, { size: 26, font: FONT_BODY, weight: '800', color: GRAU, spacing: 5, breite: 'expanded', ...o })

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

/** Foto als Bühne: deckend oben, nach unten in Schwarz auslaufend. */
async function buehne(ctx: CanvasRenderingContext2D, src: string, hoehe: number, staerke = 0.55) {
  const img = await loadImage(src)
  if (!img) return
  const s = Math.max(W / img.width, hoehe / img.height)
  const w = img.width * s
  const h = img.height * s
  ctx.save()
  ctx.globalAlpha = staerke
  ctx.drawImage(img, (W - w) / 2, 0, w, h)
  ctx.restore()
  const g = ctx.createLinearGradient(0, 0, 0, hoehe)
  g.addColorStop(0, 'rgba(11,10,11,0.35)')
  g.addColorStop(0.55, 'rgba(11,10,11,0.72)')
  g.addColorStop(1, 'rgba(11,10,11,1)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, W, hoehe + 2)
}

/** Spieler-Freisteller groß (Kopf/Oberkörper), unten weich ausgeblendet. */
async function freisteller(ctx: CanvasRenderingContext2D, k: KaderSpieler | undefined, x: number, y: number, hoehe: number, spiegeln = false) {
  if (!k) return
  const b = spielerBild(k)
  if (!b.src) return
  const src = b.freigestellt ? b.src.replace('/players/cutout/', '/players/cutout/hd/') : b.src
  const img = (await loadImage(src)) ?? (await loadImage(b.src))
  if (!img) return
  const w = (img.width / img.height) * hoehe
  const tmp = document.createElement('canvas')
  tmp.width = Math.round(w)
  tmp.height = Math.round(hoehe)
  const t = tmp.getContext('2d')!
  if (spiegeln) {
    t.translate(tmp.width, 0)
    t.scale(-1, 1)
  }
  t.drawImage(img, 0, 0, tmp.width, tmp.height)
  t.setTransform(1, 0, 0, 1, 0, 0)
  t.globalCompositeOperation = 'destination-in'
  const g = t.createLinearGradient(0, 0, 0, tmp.height)
  g.addColorStop(0, '#000')
  g.addColorStop(0.62, '#000')
  g.addColorStop(0.96, 'rgba(0,0,0,0)')
  t.fillStyle = g
  t.fillRect(0, 0, tmp.width, tmp.height)
  ctx.drawImage(tmp, x - w / 2, y)
}

export interface RahmenOpts {
  kicker: string
  partner?: PartnerInfo | null
  fussZeile?: string
  /** Foto-Bühne oben (Standard: Fan-Jubel) */
  foto?: string | null
}

/** Grund + Kopf + Fuß. Liefert den Canvas und den Kontext. */
export async function rahmen(o: RahmenOpts): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  await ensureCardFonts()
  try {
    await Promise.all([document.fonts.load('800 expanded 40px "Archivo Variable"'), document.fonts.load('700 condensed 40px "Archivo Variable"')])
  } catch {
    /* Normalbreite genügt */
  }
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0B0A0B'
  ctx.fillRect(0, 0, W, H)
  if (o.foto !== null) await buehne(ctx, o.foto ?? '/fans/torjubel.webp', 1000)

  // Kopf links bündig: Wappen · SVA TIPP-LIGA · Kicker (rote Kante)
  const wappen = await loadImage('/brand/aga-logo.png')
  if (wappen) {
    const h = 104
    const w = (wappen.width / wappen.height) * h
    ctx.drawImage(wappen, RAND, 88, w, h)
  }
  text(ctx, 'SVA TIPP-LIGA', RAND + 112, 160, { size: 58, align: 'left', spacing: 3 })
  label(ctx, 'SV Agathenburg-Dollern', RAND + 114, 192, { size: 20, spacing: 4 })
  ctx.fillStyle = ROT
  ctx.fillRect(RAND, 244, 10, 46)
  text(ctx, o.kicker.toUpperCase(), RAND + 30, 280, { size: 30, font: FONT_BODY, weight: '800', color: WEISS, spacing: 4, align: 'left', max: W - RAND * 2 - 30, breite: 'expanded' })

  // Fuß
  if (o.partner?.name) {
    const logo = o.partner.logoUrl ? await loadImage(o.partner.logoUrl) : null
    label(ctx, 'präsentiert von', RAND, H - 250, { align: 'left', size: 20 })
    if (logo) {
      const lh = 64
      const lw = Math.min(340, (logo.width / logo.height) * lh)
      ctx.drawImage(logo, RAND, H - 232, lw, (logo.height / logo.width) * lw)
    } else {
      text(ctx, o.partner.name.toUpperCase(), RAND, H - 180, { size: 44, align: 'left', max: 520 })
    }
  }
  ctx.fillStyle = LINIE
  ctx.fillRect(RAND, H - 128, W - RAND * 2, 2)
  ctx.fillStyle = ROT
  ctx.fillRect(RAND, H - 130, 140, 6)
  text(ctx, (o.fussZeile ?? URL_TEXT).toUpperCase(), RAND, H - 72, { size: 26, font: FONT_BODY, weight: '800', color: WEISS, spacing: 4, align: 'left', breite: 'expanded' })
  text(ctx, INSTA, W - RAND, H - 72, { size: 26, font: FONT_BODY, weight: '700', color: GRAU, align: 'right' })
  return { canvas, ctx }
}

function paarungZeile(heim: boolean, gegner: string) {
  return heim ? `SVA – ${gegner}` : `${gegner} – SVA`
}

/** Bandentafel des Gegners (wie auf der Website): Schwarz, rote Kante, Anton-Kürzel. */
function tafel(ctx: CanvasRenderingContext2D, cx: number, cy: number, gegner: string, w = 260) {
  const h = w / 2.6
  ctx.fillStyle = '#141213'
  rrect(ctx, cx - w / 2, cy - h / 2, w, h, 6)
  ctx.fill()
  ctx.strokeStyle = 'rgba(244,242,239,0.28)'
  ctx.lineWidth = 2
  ctx.stroke()
  ctx.fillStyle = ROT
  ctx.fillRect(cx - w / 2, cy - h / 2, 10, h)
  text(ctx, kuerzel(gegner), cx + 6, cy + h * 0.27, { size: h * 0.72, spacing: 4 })
}

/** Scorebug: Wappen links/rechts, Mitte Stand oder Zeit. */
async function scorebug(ctx: CanvasRenderingContext2D, y: number, heim: boolean, gegner: string, mitte: string, mitteGross = 200) {
  const wappen = await loadImage('/brand/aga-logo.png')
  const links = W / 2 - 330
  const rechts = W / 2 + 330
  const sva = heim ? links : rechts
  const geg = heim ? rechts : links
  if (wappen) {
    const h = 150
    const w = (wappen.width / wappen.height) * h
    ctx.drawImage(wappen, sva - w / 2, y - h / 2, w, h)
  }
  tafel(ctx, geg, y, gegner, 230)
  text(ctx, mitte, W / 2, y + mitteGross * 0.36, { size: mitteGross })
  label(ctx, heim ? 'SV Agathenburg' : gegner, links, y + 118, { size: 20, max: 300 })
  label(ctx, heim ? gegner : 'SV Agathenburg', rechts, y + 118, { size: 20, max: 300 })
}

// ── Fans ─────────────────────────────────────────────────────
export interface MeinTippDaten {
  gegner: string
  heim: boolean
  anstoss: string
  toreSva: number
  toreGegner: number
  joker: boolean
  torschuetze?: KaderSpieler
  bonus: { key: BonusKey; wert?: string; linie?: number }[]
  name?: string
  partner?: PartnerInfo | null
}

export async function bildMeinTipp(d: MeinTippDaten): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `Mein Tipp · ${datumKurz(d.anstoss)} · ${uhrzeit(d.anstoss)} Uhr`, partner: d.partner })
  const links = d.heim ? d.toreSva : d.toreGegner
  const rechts = d.heim ? d.toreGegner : d.toreSva
  await scorebug(ctx, 520, d.heim, d.gegner, `${links}:${rechts}`, 230)
  let y = 720
  if (d.joker) {
    ctx.fillStyle = ROT
    rrect(ctx, W / 2 - 140, y, 280, 64, 6)
    ctx.fill()
    text(ctx, 'JOKER ×2', W / 2, y + 47, { size: 38, spacing: 4 })
  }
  y = 860
  if (d.torschuetze) {
    await freisteller(ctx, d.torschuetze, W - 300, y - 40, 860)
    label(ctx, 'Erster Torschütze', RAND, y + 40, { align: 'left', color: ROT })
    text(ctx, nachname(d.torschuetze.name).toUpperCase(), RAND, y + 140, { size: 104, align: 'left', max: 560 })
    y += 230
  }
  for (const b of d.bonus) {
    ctx.fillStyle = LINIE
    ctx.fillRect(RAND, y, d.torschuetze ? 560 : W - RAND * 2, 2)
    label(ctx, BONUS[b.key].kurz, RAND, y + 50, { align: 'left', size: 22 })
    text(ctx, bonusLabel(b.key, b.wert).toUpperCase(), d.torschuetze ? RAND + 560 : W - RAND, y + 58, { size: 56, align: 'right' })
    y += 104
  }
  text(ctx, 'TIPPST DU BESSER?', RAND, H - 330, { size: 76, align: 'left', spacing: 2 })
  return canvas
}

export interface MeineElfDaten {
  gegner: string
  heim: boolean
  anstoss: string
  spieler: KaderSpieler[] // v21: Plätze [TW, ABW, MIT, MIT, ANG]
  kapitaen?: string
  partner?: PartnerInfo | null
}

export async function bildMeineElf(d: MeineElfDaten): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `Meine Elf · ${paarungZeile(d.heim, d.gegner)}`, partner: d.partner, foto: null })
  // Platz-Linien (perspektivisch angedeutet)
  ctx.save()
  ctx.strokeStyle = 'rgba(244,242,239,0.10)'
  ctx.lineWidth = 3
  rrect(ctx, 70, 360, W - 140, 1300, 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(W / 2, 360, 130, 0, Math.PI)
  ctx.stroke()
  ctx.strokeRect(W / 2 - 230, 1660 - 210, 460, 210)
  ctx.restore()
  const cw = 250
  const ch = cw * CARD_RATIO
  const abst = 30
  const yAng = 390
  const yMit = yAng + ch + abst
  const yHin = yMit + ch + abst
  const pos: [number, number][] = [
    [W / 2 + 24, yHin], // TW
    [W / 2 - cw - 24, yHin], // ABW
    [W / 2 - cw - 24, yMit], // MIT
    [W / 2 + 24, yMit], // MIT
    [W / 2 - cw / 2, yAng], // ANG
  ]
  for (let i = 0; i < d.spieler.length && i < 5; i++) {
    const k = d.spieler[i]
    if (!k) continue
    ctx.save()
    ctx.shadowColor = 'rgba(0,0,0,0.6)'
    ctx.shadowBlur = 40
    ctx.shadowOffsetY = 20
    await zeichneKarte(ctx, pos[i][0], pos[i][1], cw, k, k.id === d.kapitaen)
    ctx.restore()
    if (k.id === d.kapitaen) {
      ctx.fillStyle = GOLD
      rrect(ctx, pos[i][0] + cw / 2 - 110, pos[i][1] + ch - 6, 220, 46, 6)
      ctx.fill()
      text(ctx, 'KAPITÄN ×2', pos[i][0] + cw / 2, pos[i][1] + ch + 28, { size: 22, font: FONT_BODY, weight: '800', color: '#1b1406', spacing: 3, breite: 'expanded' })
    }
  }
  return canvas
}

export interface PlatzDaten {
  platz: number
  teilnehmer: number
  punkte: number
  /** v21: 'liga' → „Platz 2 von 9 in deiner Liga ‚…‘“ · 'spieltag' · 'saison' */
  art?: 'liga' | 'spieltag' | 'saison'
  /** Liga-Name bzw. Paarung bzw. Saison */
  bereich: string
  name?: string
  trend?: number
  code?: string
  partner?: PartnerInfo | null
}

/** Klartext für das Platz-Bild (auch für Tests). */
export function platzText(d: Pick<PlatzDaten, 'platz' | 'teilnehmer' | 'art' | 'bereich'>): { kicker: string; zeile: string } {
  if (d.art === 'liga') return { kicker: `Liga · ${d.bereich}`, zeile: `Platz ${d.platz} von ${d.teilnehmer} in deiner Liga „${d.bereich}“` }
  if (d.art === 'spieltag') return { kicker: `Spieltag · ${d.bereich}`, zeile: `Platz ${d.platz} von ${d.teilnehmer} am Spieltag ${d.bereich}` }
  return { kicker: d.bereich, zeile: `Platz ${d.platz} von ${d.teilnehmer} · ${d.bereich}` }
}

export async function bildPlatz(d: PlatzDaten): Promise<HTMLCanvasElement> {
  const t = platzText(d)
  const { canvas, ctx } = await rahmen({ kicker: t.kicker, partner: d.partner })
  label(ctx, 'Mein Platz', RAND, 470, { align: 'left', color: ROT })
  // riesige Platzziffer, links bündig
  text(ctx, String(d.platz), RAND - 12, 900, { size: 480, align: 'left' })
  setzeFont(ctx, 480, FONT_DISPLAY)
  const breitePlatz = ctx.measureText(String(d.platz)).width
  label(ctx, `von ${d.teilnehmer}`, RAND + breitePlatz + 20, 900, { align: 'left', size: 34, color: WEISS })
  if (d.trend) {
    const hoch = d.trend > 0
    label(ctx, `${hoch ? '+' : '−'}${Math.abs(d.trend)} ${Math.abs(d.trend) === 1 ? 'Platz' : 'Plätze'}`, RAND + breitePlatz + 20, 850, { align: 'left', size: 26, color: hoch ? '#3DDC84' : GRAU })
  }
  // Klartext-Zeile
  ctx.fillStyle = LINIE
  ctx.fillRect(RAND, 980, W - RAND * 2, 2)
  text(ctx, t.zeile, RAND, 1050, { size: 40, font: FONT_BODY, weight: '700', color: WEISS, align: 'left', max: W - RAND * 2 })
  // Punkte
  text(ctx, `${d.punkte}`, RAND, 1250, { size: 170, align: 'left' })
  setzeFont(ctx, 170, FONT_DISPLAY)
  label(ctx, 'Punkte', RAND + ctx.measureText(`${d.punkte}`).width + 24, 1250, { align: 'left', size: 30 })
  if (d.name) text(ctx, d.name.toUpperCase(), RAND, 1370, { size: 64, align: 'left', max: W - RAND * 2 })
  if (d.code) {
    ctx.strokeStyle = ROT
    ctx.lineWidth = 4
    rrect(ctx, RAND, 1430, W - RAND * 2, 190, 10)
    ctx.stroke()
    label(ctx, 'Komm in unsere Liga · Code', RAND + 36, 1490, { align: 'left', color: ROT, size: 24 })
    text(ctx, d.code, RAND + 36, 1590, { size: 92, spacing: 16, align: 'left' })
  }
  return canvas
}

export async function bildAbzeichen(key: string, name?: string, partner?: PartnerInfo | null): Promise<HTMLCanvasElement> {
  const a = ABZEICHEN.find((x) => x.key === key) ?? ABZEICHEN[0]
  const { canvas, ctx } = await rahmen({ kicker: 'Abzeichen freigeschaltet', partner })
  const cx = W / 2
  const cy = 820
  const [h, m, dkl] = a.stufe === 'gold' ? ['#fff1bd', '#d9aa45', '#7a5718'] : a.stufe === 'silber' ? ['#ffffff', '#9aa1aa', '#4e545c'] : ['#ff5a62', '#c3141f', '#6d0b12']
  const g = ctx.createLinearGradient(cx - 300, cy - 300, cx + 300, cy + 300)
  g.addColorStop(0, h)
  g.addColorStop(0.45, m)
  g.addColorStop(1, dkl)
  // Zacken-Rand
  ctx.beginPath()
  for (let i = 0; i <= 64; i++) {
    const r = i % 2 ? 292 : 310
    const w = (i / 64) * Math.PI * 2
    ctx.lineTo(cx + r * Math.cos(w), cy + r * Math.sin(w))
  }
  ctx.fillStyle = g
  ctx.fill()
  const innen = ctx.createRadialGradient(cx, cy - 80, 20, cx, cy, 250)
  innen.addColorStop(0, '#262223')
  innen.addColorStop(1, '#100e0f')
  ctx.beginPath()
  ctx.arc(cx, cy, 240, 0, Math.PI * 2)
  ctx.fillStyle = innen
  ctx.fill()
  ctx.strokeStyle = g
  ctx.lineWidth = 8
  ctx.stroke()
  text(ctx, a.titel.toUpperCase(), cx, cy + 40, { size: 110, max: 400 })
  text(ctx, a.text, cx, 1250, { size: 42, font: FONT_BODY, weight: '700', color: WEISS, max: W - RAND * 2 })
  if (name) label(ctx, name, cx, 1340, { size: 30, color: GRAU })
  return canvas
}

// ── Admin: Story-Grafiken der Woche ─────────────────────────
export interface OffenDaten {
  gegner: string
  heim: boolean
  anstoss: string
  anzahlTipps: number
}

export async function bildJetztTippen(s: OffenDaten, partner?: PartnerInfo | null, preise?: string | null, stars?: KaderSpieler[]): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `${datumKurz(s.anstoss)} · ${uhrzeit(s.anstoss)} Uhr · ${s.heim ? 'Heimspiel' : 'Auswärts'}`, partner })
  if (stars?.length) {
    await freisteller(ctx, stars[0], W / 2 + 230, 330, 980)
    if (stars[1]) await freisteller(ctx, stars[1], W / 2 - 250, 400, 900, true)
  }
  text(ctx, 'JETZT', RAND, 900, { size: 250, align: 'left' })
  text(ctx, 'TIPPEN.', RAND, 1130, { size: 250, align: 'left', color: ROT })
  await scorebug(ctx, 1300, s.heim, s.gegner, 'VS', 90)
  label(ctx, 'Ergebnis · Torschütze · Deine Elf', RAND, 1500, { align: 'left', color: WEISS, size: 26 })
  label(ctx, 'Tippschluss mit dem Anpfiff · 20 Sekunden', RAND, 1546, { align: 'left', size: 22 })
  if (preise) text(ctx, preise, RAND, 1610, { size: 30, font: FONT_BODY, weight: '700', color: GRAU, max: W - RAND * 2, align: 'left' })
  return canvas
}

export async function bildNochNichtGetippt(s: OffenDaten, storyCode?: string | null, partner?: PartnerInfo | null): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `Tippschluss ${datumKurz(s.anstoss)} · ${uhrzeit(s.anstoss)} Uhr`, partner })
  text(ctx, 'NOCH NICHT', RAND, 640, { size: 180, align: 'left' })
  text(ctx, 'GETIPPT?', RAND, 820, { size: 180, align: 'left', color: ROT })
  await scorebug(ctx, 1000, s.heim, s.gegner, 'VS', 90)
  if (s.anzahlTipps > 0) {
    text(ctx, `${s.anzahlTipps}`, RAND, 1330, { size: 210, align: 'left' })
    setzeFont(ctx, 210, FONT_DISPLAY)
    const w = ctx.measureText(`${s.anzahlTipps}`).width
    label(ctx, s.anzahlTipps === 1 ? 'Fan hat schon' : 'Fans haben schon', RAND + w + 28, 1270, { align: 'left', color: WEISS, size: 26 })
    label(ctx, 'getippt', RAND + w + 28, 1316, { align: 'left', size: 26 })
  }
  if (storyCode) {
    ctx.strokeStyle = ROT
    ctx.lineWidth = 4
    rrect(ctx, RAND, 1400, W - RAND * 2, 200, 10)
    ctx.stroke()
    label(ctx, 'Story-Code der Woche', RAND + 36, 1458, { align: 'left', color: ROT, size: 24 })
    text(ctx, storyCode.toUpperCase(), RAND + 36, 1560, { size: 88, spacing: 10, max: W - RAND * 2 - 72, align: 'left' })
  } else {
    label(ctx, '20 Sekunden · Link in der Story', RAND, 1460, { align: 'left', color: WEISS })
  }
  return canvas
}

export interface SiegerDaten {
  gegner: string
  heim: boolean
  toreSva?: number
  toreGegner?: number
  sieger: { name: string; punkte: number }[]
  teilnehmer: number
}

export async function bildTippSieger(d: SiegerDaten, partner?: PartnerInfo | null, preise?: string | null): Promise<HTMLCanvasElement> {
  const ergebnis = d.toreSva != null && d.toreGegner != null ? (d.heim ? `${d.toreSva}:${d.toreGegner}` : `${d.toreGegner}:${d.toreSva}`) : '–'
  const { canvas, ctx } = await rahmen({ kicker: `Spieltag · ${paarungZeile(d.heim, d.gegner)}`, partner })
  await scorebug(ctx, 470, d.heim, d.gegner, ergebnis, 170)
  label(ctx, 'Tipp-Sieger des Spieltags', RAND, 720, { align: 'left', color: ROT })
  const liste = d.sieger.slice(0, 3)
  let y = liste.length > 1 ? 860 : 920
  for (const s of liste) {
    text(ctx, s.name.toUpperCase(), RAND, y, { size: liste.length > 1 ? 120 : 170, max: W - RAND * 2, align: 'left' })
    y += liste.length > 1 ? 140 : 0
  }
  const p = liste[0]?.punkte ?? 0
  const py = liste.length > 1 ? y + 120 : 1180
  ctx.fillStyle = GOLD
  ctx.fillRect(RAND, py - 150, 10, 170)
  text(ctx, `${p}`, RAND + 36, py, { size: 200, align: 'left' })
  setzeFont(ctx, 200, FONT_DISPLAY)
  label(ctx, 'Punkte', RAND + 36 + ctx.measureText(`${p}`).width + 24, py, { align: 'left', size: 30, color: WEISS })
  label(ctx, `von ${d.teilnehmer} Tippern`, RAND + 36, py + 60, { align: 'left', size: 22 })
  if (preise) text(ctx, preise, RAND, 1560, { size: 30, font: FONT_BODY, weight: '700', color: GRAU, max: W - RAND * 2, align: 'left' })
  return canvas
}

export async function bildTop5(eintraege: { platz: number; name: string; punkte: number; kabine?: boolean }[], saison: string, partner?: PartnerInfo | null): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `Saison ${saison}`, partner })
  text(ctx, 'TOP 5', RAND, 560, { size: 240, align: 'left' })
  label(ctx, 'der Saison', RAND + 8, 630, { align: 'left', color: ROT, size: 30 })
  let y = 720
  for (const e of eintraege.slice(0, 5)) {
    const eins = e.platz === 1
    ctx.fillStyle = eins ? 'rgba(233,29,41,0.16)' : 'rgba(244,242,239,0.05)'
    rrect(ctx, RAND, y, W - RAND * 2, 150, 10)
    ctx.fill()
    if (eins) {
      ctx.fillStyle = ROT
      ctx.fillRect(RAND, y, 10, 150)
    }
    text(ctx, String(e.platz), RAND + 80, y + 108, { size: 96, color: eins ? ROT : WEISS })
    text(ctx, e.name.toUpperCase(), RAND + 170, y + 100, { size: 64, align: 'left', max: 520 })
    if (e.kabine) label(ctx, 'Kabine', RAND + 172, y + 132, { align: 'left', size: 18 })
    text(ctx, String(e.punkte), W - RAND - 36, y + 104, { size: 72, align: 'right' })
    y += 170
  }
  return canvas
}

export interface DuellDaten {
  fans?: number
  kabine?: number
  nFans: number
  nKabine: number
  titel: string // „Spieltag vs TuS Fischbek“ · „Saison 2026/27“
  kabineBester?: { name: string; punkte: number }
}

export async function bildFansVsKabine(d: DuellDaten, partner?: PartnerInfo | null): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: d.titel, partner, foto: '/clubhouse/jubel-traube.jpg' })
  const f = d.fans ?? 0
  const k = d.kabine ?? 0
  const vorne = f === k ? 'GLEICHSTAND!' : f > k ? 'DIE FANS LIEGEN VORNE!' : 'DIE KABINE LIEGT VORNE!'
  text(ctx, 'FANS', RAND, 600, { size: 200, align: 'left' })
  text(ctx, 'VS. KABINE', RAND, 790, { size: 200, align: 'left', color: ROT, max: W - RAND * 2 })
  const zahl = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  text(ctx, zahl(f), RAND, 1080, { size: 210, align: 'left' })
  text(ctx, zahl(k), W - RAND, 1080, { size: 210, align: 'right', color: ROT })
  label(ctx, `Fans · ${d.nFans}`, RAND, 1140, { align: 'left' })
  label(ctx, `Kabine · ${d.nKabine}`, W - RAND, 1140, { align: 'right' })
  // Balken
  const ges = Math.max(0.01, f + k)
  const bw = W - RAND * 2
  ctx.fillStyle = WEISS
  rrect(ctx, RAND, 1190, bw * (f / ges) - 4, 28, 4)
  ctx.fill()
  ctx.fillStyle = ROT
  rrect(ctx, RAND + bw * (f / ges) + 4, 1190, bw * (k / ges) - 4, 28, 4)
  ctx.fill()
  label(ctx, 'Ø Punkte pro Spieltag', RAND, 1280, { align: 'left', size: 22 })
  text(ctx, vorne, RAND, 1420, { size: 84, max: W - RAND * 2, align: 'left' })
  if (d.kabineBester) text(ctx, `Bester aus der Kabine: ${d.kabineBester.name} · ${d.kabineBester.punkte} P.`, RAND, 1500, { size: 32, font: FONT_BODY, weight: '600', color: GRAU, max: W - RAND * 2, align: 'left' })
  return canvas
}

// ── Teilen / Speichern ───────────────────────────────────────
export type TeilenErgebnis = 'geteilt' | 'gespeichert' | 'fehler'

export function canvasBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((ok, nein) => canvas.toBlob((b) => (b ? ok(b) : nein(new Error('toBlob'))), 'image/png'))
}

export async function teilen(canvas: HTMLCanvasElement, datei: string, titel: string): Promise<TeilenErgebnis> {
  try {
    const blob = await canvasBlob(canvas)
    const file = new File([blob], datei, { type: 'image/png' })
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.share && nav.canShare?.({ files: [file] })) {
      await nav.share({ files: [file], title: titel, text: `${titel} · ${URL_TEXT}` })
      return 'geteilt'
    }
    herunterladen(blob, datei)
    return 'gespeichert'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'geteilt'
    console.error('[tippen/teilen]', e)
    return 'fehler'
  }
}

export function herunterladen(blob: Blob, datei: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = datei
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
