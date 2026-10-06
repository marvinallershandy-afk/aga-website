// ─────────────────────────────────────────────────────────────
// v20-T: Teilen-Bilder 1080×1920 (Instagram-Story) — Canvas, wie
// src/ui/storyShare.ts. Fans: „Mein Tipp“, „Meine Elf“, „Platz X“,
// „Abzeichen“. Admin (Story-Grafiken der Woche): „Jetzt tippen“ (Fr),
// „Noch nicht getippt?“ (Sa), Tipp-Sieger, Top 5 Saison, Fans vs. Kabine.
// Einzelne Spieler (Kabine) erscheinen NUR positiv (Sieger, Top 5).
// Gemeinsamer Rahmen: Schwarz, roter Schein von oben, Wappen, „Tipp-Liga“,
// Fuß „aga-erste.de/tippen · @svagathenburg“, optional „präsentiert von“.
// ─────────────────────────────────────────────────────────────
import { CARD_RATIO, FONT_BODY, FONT_DISPLAY, ensureCardFonts, loadImage } from '../ui/cardArt'
import { zeichneKarte } from './karteAdapter'
import type { BonusKey, KaderSpieler, PartnerInfo } from './api'
import { ABZEICHEN, BONUS, bonusLabel, datumKurz, kuerzel, nachname, uhrzeit } from './model'

export const W = 1080
export const H = 1920
const ROT = '#E91D29'
const WEISS = '#F4F2EF'
const GRAU = 'rgba(244,242,239,0.62)'
const INSTA = '@svagathenburg'
const URL_TEXT = 'aga-erste.de/tippen'

function abstand(ctx: CanvasRenderingContext2D, px: number) {
  const c = ctx as CanvasRenderingContext2D & { letterSpacing?: string }
  if ('letterSpacing' in c) c.letterSpacing = `${px}px`
}

/** Schriftgröße so wählen, dass der Text in die Breite passt. */
function passend(ctx: CanvasRenderingContext2D, text: string, max: number, groesse: number, font = FONT_DISPLAY, gewicht = ''): number {
  let g = groesse
  ctx.font = `${gewicht} ${g}px ${font}`.trim()
  while (ctx.measureText(text).width > max && g > 20) {
    g -= 4
    ctx.font = `${gewicht} ${g}px ${font}`.trim()
  }
  return g
}

function text(ctx: CanvasRenderingContext2D, t: string, x: number, y: number, o: { size: number; font?: string; weight?: string; color?: string; align?: CanvasTextAlign; spacing?: number; max?: number }) {
  ctx.textAlign = o.align ?? 'center'
  ctx.textBaseline = 'alphabetic'
  abstand(ctx, o.spacing ?? 0)
  ctx.fillStyle = o.color ?? WEISS
  const font = o.font ?? FONT_DISPLAY
  if (o.max) passend(ctx, t, o.max, o.size, font, o.weight)
  else ctx.font = `${o.weight ?? ''} ${o.size}px ${font}`.trim()
  // Laufweite verschiebt zentrierten Text nach links → ausgleichen
  ctx.fillText(t, x + ((o.align ?? 'center') === 'center' ? (o.spacing ?? 0) / 2 : 0), y)
  abstand(ctx, 0)
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

export interface RahmenOpts {
  kicker: string
  partner?: PartnerInfo | null
  fussZeile?: string
}

/** Grund + Kopf + Fuß. Liefert den Canvas und den Kontext. */
export async function rahmen(o: RahmenOpts): Promise<{ canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D }> {
  await ensureCardFonts()
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#0B0A0B'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W / 2, 0, 40, W / 2, 260, 1200)
  glow.addColorStop(0, 'rgba(233,29,41,0.42)')
  glow.addColorStop(0.5, 'rgba(120,12,20,0.18)')
  glow.addColorStop(1, 'rgba(0,0,0,0)')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  // feine Diagonalen (CI), sehr leise
  ctx.save()
  ctx.globalAlpha = 0.045
  ctx.fillStyle = ROT
  for (let i = -H; i < W + H; i += 120) {
    ctx.beginPath()
    ctx.moveTo(i, H)
    ctx.lineTo(i + 40, H)
    ctx.lineTo(i + 40 + H * 0.6, 0)
    ctx.lineTo(i + H * 0.6, 0)
    ctx.closePath()
    ctx.fill()
  }
  ctx.restore()

  // Kopf: Wappen · TIPP-LIGA · Kicker
  const wappen = await loadImage('/brand/aga-logo.png')
  if (wappen) {
    const h = 110
    const w = (wappen.width / wappen.height) * h
    ctx.drawImage(wappen, W / 2 - w / 2, 92, w, h)
  }
  text(ctx, 'SVA TIPP-LIGA', W / 2, 286, { size: 54, spacing: 6 })
  text(ctx, o.kicker.toUpperCase(), W / 2, 344, { size: 26, font: FONT_BODY, weight: '800', color: ROT, spacing: 6, max: W - 160 })

  // Fuß
  let fussY = H - 120
  if (o.partner?.name) {
    const logo = o.partner.logoUrl ? await loadImage(o.partner.logoUrl) : null
    text(ctx, 'PRÄSENTIERT VON', W / 2, H - 300, { size: 22, font: FONT_BODY, weight: '700', color: GRAU, spacing: 5 })
    if (logo) {
      const lh = 72
      const lw = Math.min(360, (logo.width / logo.height) * lh)
      ctx.drawImage(logo, W / 2 - lw / 2, H - 278, lw, (logo.height / logo.width) * lw)
    } else {
      text(ctx, o.partner.name.toUpperCase(), W / 2, H - 228, { size: 44, max: W - 200 })
    }
    fussY = H - 110
  }
  text(ctx, o.fussZeile ?? `${URL_TEXT}  ·  ${INSTA}`, W / 2, fussY, { size: 28, font: FONT_BODY, weight: '700', color: GRAU, spacing: 4 })
  ctx.fillStyle = ROT
  ctx.fillRect(W / 2 - 60, fussY + 30, 120, 4)
  return { canvas, ctx }
}

function paarungZeile(heim: boolean, gegner: string) {
  return heim ? `SVA – ${gegner}` : `${gegner} – SVA`
}

async function wappenPaar(ctx: CanvasRenderingContext2D, y: number, heim: boolean, gegner: string) {
  const wappen = await loadImage('/brand/aga-logo.png')
  const links = heim
  const xs = [W / 2 - 300, W / 2 + 300]
  xs.forEach((x, i) => {
    const sva = (i === 0) === links
    if (sva && wappen) {
      const h = 150
      const w = (wappen.width / wappen.height) * h
      ctx.drawImage(wappen, x - w / 2, y - h / 2, w, h)
    } else {
      ctx.strokeStyle = 'rgba(244,242,239,0.35)'
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.arc(x, y, 70, 0, Math.PI * 2)
      ctx.stroke()
      text(ctx, kuerzel(gegner), x, y + 22, { size: 64 })
    }
  })
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
  const { canvas, ctx } = await rahmen({ kicker: `Mein Tipp · ${datumKurz(d.anstoss)} ${uhrzeit(d.anstoss)}`, partner: d.partner })
  await wappenPaar(ctx, 600, d.heim, d.gegner)
  const links = d.heim ? d.toreSva : d.toreGegner
  const rechts = d.heim ? d.toreGegner : d.toreSva
  text(ctx, `${links}:${rechts}`, W / 2, 712, { size: 270 })
  text(ctx, paarungZeile(d.heim, d.gegner).toUpperCase(), W / 2, 800, { size: 40, max: W - 160, spacing: 2 })
  let y = 850
  if (d.joker) {
    ctx.fillStyle = ROT
    rrect(ctx, W / 2 - 150, y, 300, 60, 6)
    ctx.fill()
    text(ctx, 'JOKER ×2', W / 2, y + 44, { size: 36, spacing: 4 })
    y += 100
  } else y += 40
  if (d.torschuetze) {
    const cw = 300
    await zeichneKarte(ctx, 130, y, cw, d.torschuetze)
    const tx = 130 + cw + 56
    text(ctx, 'ERSTER TORSCHÜTZE', tx, y + 60, { size: 24, font: FONT_BODY, weight: '800', color: ROT, align: 'left', spacing: 4 })
    text(ctx, nachname(d.torschuetze.name).toUpperCase(), tx, y + 136, { size: 68, align: 'left', max: W - tx - 80 })
    let by = y + 220
    for (const b of d.bonus) {
      text(ctx, BONUS[b.key].kurz.toUpperCase(), tx, by, { size: 22, font: FONT_BODY, weight: '700', color: GRAU, align: 'left', spacing: 3 })
      text(ctx, bonusLabel(b.key, b.wert), tx, by + 50, { size: 44, align: 'left' })
      by += 88
    }
  } else {
    let by = y + 40
    for (const b of d.bonus) {
      text(ctx, BONUS[b.key].frage(b.linie), W / 2, by, { size: 30, font: FONT_BODY, weight: '600', color: GRAU, max: W - 200 })
      text(ctx, bonusLabel(b.key, b.wert).toUpperCase(), W / 2, by + 66, { size: 56 })
      by += 150
    }
  }
  text(ctx, 'TIPPST DU BESSER?', W / 2, H - 370, { size: 60, spacing: 2 })
  return canvas
}

export interface MeineElfDaten {
  gegner: string
  heim: boolean
  anstoss: string
  spieler: KaderSpieler[] // Reihenfolge der Plätze [TW/ABW, MIT, MIT, ANG, ANG]
  kapitaen?: string
  partner?: PartnerInfo | null
}

export async function bildMeineElf(d: MeineElfDaten): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `Meine Elf · ${d.heim ? 'vs' : 'bei'} ${d.gegner}`, partner: d.partner })
  // Platz-Linien
  ctx.save()
  ctx.strokeStyle = 'rgba(244,242,239,0.10)'
  ctx.lineWidth = 3
  rrect(ctx, 70, 400, W - 140, 1220, 8)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(W / 2, 400, 130, 0, Math.PI)
  ctx.stroke()
  ctx.strokeRect(W / 2 - 230, 1620 - 200, 460, 200)
  ctx.restore()
  const cw = 262
  const ch = cw * CARD_RATIO
  const abst = 34
  const yAng = 432
  const yMit = yAng + ch + abst
  const yTw = yMit + ch + abst
  const pos = [
    [W / 2 - cw / 2, yTw], // TW/ABW
    [W / 2 - cw - 34, yMit], [W / 2 + 34, yMit], // MIT
    [W / 2 - cw - 34, yAng], [W / 2 + 34, yAng], // ANG
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
  }
  return canvas
}

export interface PlatzDaten {
  platz: number
  teilnehmer: number
  punkte: number
  bereich: string // „in Dodos Raum“ · „Saison 2026/27“
  name?: string
  trend?: number
  code?: string
  partner?: PartnerInfo | null
}

export async function bildPlatz(d: PlatzDaten): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: d.bereich, partner: d.partner })
  text(ctx, 'PLATZ', W / 2, 560, { size: 90, color: GRAU, spacing: 8 })
  text(ctx, String(d.platz), W / 2, 900, { size: 380 })
  text(ctx, `von ${d.teilnehmer}`, W / 2, 990, { size: 40, font: FONT_BODY, weight: '700', color: GRAU })
  if (d.trend) {
    const hoch = d.trend > 0
    text(ctx, `${hoch ? '▲' : '▼'} ${Math.abs(d.trend)} ${Math.abs(d.trend) === 1 ? 'Platz' : 'Plätze'}`, W / 2, 1080, { size: 48, color: hoch ? '#3DDC84' : GRAU })
  }
  ctx.fillStyle = 'rgba(244,242,239,0.08)'
  rrect(ctx, 160, 1150, W - 320, 170, 12)
  ctx.fill()
  text(ctx, `${d.punkte}`, W / 2 - 150, 1268, { size: 110 })
  text(ctx, 'PUNKTE', W / 2 + 120, 1260, { size: 44, color: GRAU, spacing: 4 })
  if (d.name) text(ctx, d.name.toUpperCase(), W / 2, 1410, { size: 60, max: W - 200 })
  if (d.code) {
    text(ctx, 'KOMM IN UNSERE LIGA · CODE', W / 2, 1500, { size: 26, font: FONT_BODY, weight: '800', color: ROT, spacing: 5 })
    text(ctx, d.code, W / 2, 1592, { size: 80, spacing: 14 })
  }
  return canvas
}

export async function bildAbzeichen(key: string, name?: string, partner?: PartnerInfo | null): Promise<HTMLCanvasElement> {
  const a = ABZEICHEN.find((x) => x.key === key) ?? ABZEICHEN[0]
  const { canvas, ctx } = await rahmen({ kicker: 'Abzeichen freigeschaltet', partner })
  const cx = W / 2
  const cy = 820
  // Medaille: Doppelring in Rot, innen Schwarz
  ctx.save()
  ctx.shadowColor = 'rgba(233,29,41,0.35)'
  ctx.shadowBlur = 80
  ctx.fillStyle = '#151314'
  ctx.beginPath()
  ctx.arc(cx, cy, 300, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
  ctx.strokeStyle = ROT
  ctx.lineWidth = 14
  ctx.beginPath()
  ctx.arc(cx, cy, 286, 0, Math.PI * 2)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(244,242,239,0.22)'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.arc(cx, cy, 250, 0, Math.PI * 2)
  ctx.stroke()
  text(ctx, a.titel.toUpperCase(), cx, cy + 40, { size: 120, max: 440 })
  text(ctx, a.text, cx, 1240, { size: 40, font: FONT_BODY, weight: '600', color: GRAU, max: W - 200 })
  if (name) text(ctx, name.toUpperCase(), cx, 1360, { size: 60, max: W - 200 })
  return canvas
}

// ── Admin: Story-Grafiken der Woche ─────────────────────────
export interface OffenDaten {
  gegner: string
  heim: boolean
  anstoss: string
  anzahlTipps: number
}

export async function bildJetztTippen(s: OffenDaten, partner?: PartnerInfo | null, preise?: string | null): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `${datumKurz(s.anstoss)} · ${uhrzeit(s.anstoss)} Uhr · ${s.heim ? 'Heimspiel' : 'Auswärts'}`, partner })
  text(ctx, 'JETZT', W / 2, 640, { size: 230 })
  text(ctx, 'TIPPEN', W / 2, 860, { size: 230, color: ROT })
  await wappenPaar(ctx, 1060, s.heim, s.gegner)
  text(ctx, 'VS', W / 2, 1082, { size: 64, color: GRAU })
  text(ctx, s.gegner.toUpperCase(), W / 2, 1230, { size: 64, max: W - 160 })
  const zeilen = ['Ergebnis · Torschütze · Deine Elf', 'Tippschluss mit dem Anpfiff']
  zeilen.forEach((z, i) => text(ctx, z, W / 2, 1330 + i * 56, { size: 36, font: FONT_BODY, weight: '600', color: GRAU }))
  if (preise) text(ctx, preise, W / 2, 1460, { size: 30, font: FONT_BODY, weight: '700', color: WEISS, max: W - 160 })
  return canvas
}

export async function bildNochNichtGetippt(s: OffenDaten, storyCode?: string | null, partner?: PartnerInfo | null): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `Tippschluss ${datumKurz(s.anstoss)} · ${uhrzeit(s.anstoss)} Uhr`, partner })
  text(ctx, 'NOCH NICHT', W / 2, 620, { size: 170 })
  text(ctx, 'GETIPPT?', W / 2, 800, { size: 170, color: ROT })
  text(ctx, `${s.heim ? 'SVA gegen' : 'SVA bei'} ${s.gegner}`, W / 2, 920, { size: 44, font: FONT_BODY, weight: '700', max: W - 160 })
  if (s.anzahlTipps > 0) {
    text(ctx, `${s.anzahlTipps}`, W / 2, 1130, { size: 200 })
    text(ctx, s.anzahlTipps === 1 ? 'FAN HAT SCHON GETIPPT' : 'FANS HABEN SCHON GETIPPT', W / 2, 1200, { size: 34, font: FONT_BODY, weight: '800', color: GRAU, spacing: 4 })
  }
  if (storyCode) {
    ctx.strokeStyle = ROT
    ctx.lineWidth = 4
    rrect(ctx, 140, 1290, W - 280, 220, 12)
    ctx.stroke()
    text(ctx, 'STORY-CODE DER WOCHE', W / 2, 1352, { size: 26, font: FONT_BODY, weight: '800', color: ROT, spacing: 5 })
    text(ctx, storyCode.toUpperCase(), W / 2, 1450, { size: 88, spacing: 10, max: W - 340 })
  } else {
    text(ctx, '20 Sekunden · Link in der Story', W / 2, 1380, { size: 36, font: FONT_BODY, weight: '600', color: GRAU })
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
  const ergebnis = d.toreSva != null && d.toreGegner != null ? (d.heim ? `${d.toreSva}:${d.toreGegner}` : `${d.toreGegner}:${d.toreSva}`) : ''
  const { canvas, ctx } = await rahmen({ kicker: `Spieltag · ${paarungZeile(d.heim, d.gegner)} ${ergebnis}`, partner })
  text(ctx, 'TIPP-SIEGER', W / 2, 600, { size: 150 })
  text(ctx, 'DES SPIELTAGS', W / 2, 690, { size: 56, color: ROT, spacing: 6 })
  const liste = d.sieger.slice(0, 3)
  let y = liste.length > 1 ? 920 : 1000
  for (const s of liste) {
    text(ctx, s.name.toUpperCase(), W / 2, y, { size: liste.length > 1 ? 110 : 150, max: W - 160 })
    y += liste.length > 1 ? 150 : 0
  }
  const p = liste[0]?.punkte ?? 0
  text(ctx, `${p} PUNKTE`, W / 2, liste.length > 1 ? y + 40 : 1140, { size: 64, color: ROT, spacing: 4 })
  text(ctx, `von ${d.teilnehmer} Tippern`, W / 2, liste.length > 1 ? y + 110 : 1210, { size: 36, font: FONT_BODY, weight: '600', color: GRAU })
  if (preise) text(ctx, preise, W / 2, 1420, { size: 30, font: FONT_BODY, weight: '700', color: GRAU, max: W - 160 })
  return canvas
}

export async function bildTop5(eintraege: { platz: number; name: string; punkte: number; kabine?: boolean }[], saison: string, partner?: PartnerInfo | null): Promise<HTMLCanvasElement> {
  const { canvas, ctx } = await rahmen({ kicker: `Saison ${saison}`, partner })
  text(ctx, 'TOP 5', W / 2, 600, { size: 220 })
  text(ctx, 'DER SAISON', W / 2, 690, { size: 56, color: ROT, spacing: 6 })
  let y = 820
  for (const e of eintraege.slice(0, 5)) {
    ctx.fillStyle = e.platz === 1 ? 'rgba(233,29,41,0.18)' : 'rgba(244,242,239,0.06)'
    rrect(ctx, 100, y, W - 200, 130, 10)
    ctx.fill()
    text(ctx, String(e.platz), 180, y + 92, { size: 72, color: e.platz === 1 ? ROT : WEISS })
    text(ctx, e.name.toUpperCase(), 260, y + 90, { size: 60, align: 'left', max: 520 })
    if (e.kabine) text(ctx, 'KABINE', 260, y + 118, { size: 18, font: FONT_BODY, weight: '800', color: GRAU, align: 'left', spacing: 4 })
    text(ctx, String(e.punkte), W - 140, y + 90, { size: 64, align: 'right' })
    y += 150
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
  const { canvas, ctx } = await rahmen({ kicker: d.titel, partner })
  const f = d.fans ?? 0
  const k = d.kabine ?? 0
  const vorne = f === k ? 'GLEICHSTAND!' : f > k ? 'DIE FANS LIEGEN VORNE!' : 'DIE KABINE LIEGT VORNE!'
  text(ctx, 'FANS', W / 2, 560, { size: 150 })
  text(ctx, 'VS. KABINE', W / 2, 700, { size: 150, color: ROT })
  const zahl = (n: number) => n.toLocaleString('de-DE', { maximumFractionDigits: 1, minimumFractionDigits: 1 })
  text(ctx, zahl(f), W / 2 - 230, 1000, { size: 190 })
  text(ctx, zahl(k), W / 2 + 230, 1000, { size: 190, color: ROT })
  text(ctx, `FANS · ${d.nFans}`, W / 2 - 230, 1060, { size: 28, font: FONT_BODY, weight: '800', color: GRAU, spacing: 4 })
  text(ctx, `KABINE · ${d.nKabine}`, W / 2 + 230, 1060, { size: 28, font: FONT_BODY, weight: '800', color: GRAU, spacing: 4 })
  // Balken
  const ges = Math.max(0.01, f + k)
  const bx = 140
  const bw = W - 280
  ctx.fillStyle = WEISS
  rrect(ctx, bx, 1110, bw * (f / ges), 26, 4)
  ctx.fill()
  ctx.fillStyle = ROT
  rrect(ctx, bx + bw * (f / ges), 1110, bw * (k / ges), 26, 4)
  ctx.fill()
  text(ctx, 'Ø PUNKTE PRO SPIELTAG', W / 2, 1200, { size: 26, font: FONT_BODY, weight: '700', color: GRAU, spacing: 5 })
  text(ctx, vorne, W / 2, 1340, { size: 76, max: W - 160 })
  if (d.kabineBester) text(ctx, `Bester aus der Kabine: ${d.kabineBester.name} · ${d.kabineBester.punkte} P.`, W / 2, 1420, { size: 32, font: FONT_BODY, weight: '600', color: GRAU, max: W - 160 })
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
