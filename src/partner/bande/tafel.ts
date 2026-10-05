// ─────────────────────────────────────────────────────────────
// v18-P: EINE Zeichenfunktion für jede Bandentafel — 3D-Bande, Vorschau im
// Konfigurator, Spieltagsfoto, PNG-Export. So sieht ein Logo überall gleich aus.
//
// Regeln (docs/PARTNER.md „Logos auf der Bande"):
//   • Sicherheitsabstand rundum (13 % der Höhe, mind. 4 % der Breite)
//   • Logos nach FLÄCHE normiert (nicht nach Breite): ein quadratisches
//     Bildzeichen wird so groß wie eine lange Wortmarke „wiegt"
//     (Höhe ∝ Seitenverhältnis^-0.4, Banden-Korrektur gegenüber reiner Fläche ^-0.5)
//   • reines Bildzeichen (ohne Schrift) → Firmenname daneben, in Logo-Farbe
//   • Untergrund hell/dunkel nach Kontrast (logo.ts), Vereinsrot nur auf Wunsch
// ─────────────────────────────────────────────────────────────
import { FARBE, type Grund, type Logo } from './logo'

export interface TafelInhalt {
  name?: string
  zeile2?: string
  logo?: Logo | null
  /** 'auto' = nach Logo-Kontrast */
  grund?: Grund | 'auto'
}

const ANTON = (px: number) => `400 ${px}px Anton, "Arial Narrow", sans-serif`
const ARCHIVO = (px: number, w = 800) => `${w} ${px}px "Archivo Variable", Archivo, system-ui, sans-serif`

let schriften: Promise<void> | null = null
/** Anton + Archivo laden, bevor auf Canvas geschrieben wird (sonst Ersatzschrift). */
export function schriftenBereit(): Promise<void> {
  if (!schriften) {
    schriften = (async () => {
      try {
        await Promise.all([
          document.fonts.load(ANTON(64), 'BANDE'),
          document.fonts.load(ARCHIVO(64), 'Bäckerei'),
          document.fonts.load(ARCHIVO(64, 600), 'Bäckerei'),
        ])
      } catch {
        /* Ersatzschrift ist ok */
      }
    })()
  }
  return schriften
}

export function grundVon(inhalt: TafelInhalt): Grund {
  if (inhalt.grund && inhalt.grund !== 'auto') return inhalt.grund
  return inhalt.logo?.grund ?? 'hell'
}

function textFarbe(grund: Grund) {
  return grund === 'hell' ? FARBE.textHell : FARBE.textDunkel
}

/** Schriftgröße so wählen, dass jede Zeile in maxW passt (max. Start). */
function passend(ctx: CanvasRenderingContext2D, zeilen: string[], font: (px: number) => string, start: number, maxW: number, min = 6): number {
  let px = start
  for (; px > min; px -= Math.max(1, px * 0.04)) {
    ctx.font = font(px)
    if (zeilen.every((z) => ctx.measureText(z).width <= maxW)) break
  }
  return px
}

/** Name in 1 oder 2 Zeilen umbrechen — die Variante mit der größeren Schrift gewinnt. */
function umbruch(ctx: CanvasRenderingContext2D, text: string, font: (px: number) => string, start: number, maxW: number, maxH: number) {
  const eine = { zeilen: [text], px: Math.min(start, passend(ctx, [text], font, start, maxW)) }
  const worte = text.split(/\s+/)
  if (worte.length < 2) return eine
  // ausgewogenster Umbruch
  let bestSplit = 1, bestDiff = Infinity
  ctx.font = font(100)
  for (let i = 1; i < worte.length; i++) {
    const a = ctx.measureText(worte.slice(0, i).join(' ')).width
    const b = ctx.measureText(worte.slice(i).join(' ')).width
    if (Math.abs(a - b) < bestDiff) {
      bestDiff = Math.abs(a - b)
      bestSplit = i
    }
  }
  const z = [worte.slice(0, bestSplit).join(' '), worte.slice(bestSplit).join(' ')]
  const zweiStart = Math.min(start, maxH / 2 / 1.02)
  const zwei = { zeilen: z, px: passend(ctx, z, font, zweiStart, maxW) }
  return zwei.px > eine.px * 1.18 ? zwei : eine
}

function zeilenZeichnen(ctx: CanvasRenderingContext2D, zeilen: string[], x: number, cy: number, px: number, lh: number) {
  const y0 = cy - ((zeilen.length - 1) * px * lh) / 2
  zeilen.forEach((z, i) => ctx.fillText(z, x, y0 + i * px * lh))
}

/**
 * Eine Sponsoren-/Entwurfstafel in das Rechteck (x, y, w, h) zeichnen.
 * Gibt den verwendeten Untergrund zurück.
 */
export interface TafelLayout {
  /** Rand oben/unten als Anteil der Höhe (Standard 13 %) */
  rand?: number
  /** nutzbare Breite als Anteil (sehr lange 3D-Tafeln: Inhalt mittig halten,
   *  weil die Kamera nah heranfährt) */
  nutz?: number
}

/** Layout der langen 3D-Bandentafeln (≈ 6 : 1). */
export const BANDE_3D: TafelLayout = { rand: 0.09, nutz: 0.62 }

export function zeichneTafel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, inhalt: TafelInhalt, layout: TafelLayout = {}): Grund {
  const grund = grundVon(inhalt)
  ctx.save()
  ctx.fillStyle = FARBE[grund]
  ctx.fillRect(x, y, w, h)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.textBaseline = 'middle'

  const m = h * (layout.rand ?? 0.13)
  const mx = Math.max(m, w * 0.04, (w * (1 - (layout.nutz ?? 1))) / 2)
  const by = y + m, bw = w - 2 * mx, bh = h - 2 * m
  const name = (inhalt.name ?? '').trim()
  const zeile2 = (inhalt.zeile2 ?? '').trim()
  const logo = inhalt.logo ?? null
  const farbeText = grund === 'rot' ? '#ffffff' : textFarbe(grund)

  // Zeile 2 (Slogan/Ort) reserviert unten Platz
  const z2h = zeile2 ? bh * 0.16 : 0
  const z2gap = zeile2 ? bh * 0.08 : 0
  const ih = bh - z2h - z2gap // Höhe der Hauptzone
  const icy = by + ih / 2 // Mitte der Hauptzone

  if (logo && (logo.hatSchrift || !name)) {
    // a) nur Logo — Fläche normiert
    const { lw, lh } = logoMass(logo.seite, bw, ih, 0.92)
    ctx.drawImage(logo.bild, x + w / 2 - lw / 2, icy - lh / 2, lw, lh)
  } else if (logo) {
    // b) Bildzeichen + Name daneben (in Logo-Farbe)
    const markH = Math.min(ih * 0.86, (bw * 0.34) / Math.max(logo.seite, 0.4))
    const markW = markH * logo.seite
    const gap = Math.max(markH * 0.3, bw * 0.025)
    const nameMaxW = bw - markW - gap
    ctx.fillStyle = grund === 'rot' ? '#ffffff' : logo.grund === grund ? logo.tinte : farbeText
    const u = umbruch(ctx, name.toUpperCase(), (p) => ARCHIVO(p), ih * 0.44, nameMaxW, ih * 0.9)
    ctx.font = ARCHIVO(u.px)
    const nameW = Math.max(...u.zeilen.map((z) => ctx.measureText(z).width))
    const gesamt = markW + gap + nameW
    const sx = x + w / 2 - gesamt / 2
    ctx.drawImage(logo.bild, sx, icy - markH / 2, markW, markH)
    ctx.textAlign = 'left'
    zeilenZeichnen(ctx, u.zeilen, sx + markW + gap, icy + u.px * 0.04, u.px, 1.02)
  } else if (name) {
    // c) nur Name — groß, wie gedruckt
    ctx.fillStyle = farbeText
    ctx.textAlign = 'center'
    const u = umbruch(ctx, name.toUpperCase(), (p) => ARCHIVO(p), ih * 0.62, bw, ih)
    ctx.font = ARCHIVO(u.px)
    zeilenZeichnen(ctx, u.zeilen, x + w / 2, icy + u.px * 0.04, u.px, 1.0)
  }

  if (zeile2) {
    ctx.fillStyle = grund === 'hell' ? 'rgba(20,18,19,.66)' : 'rgba(255,255,255,.8)'
    ctx.textAlign = 'center'
    const px = passend(ctx, [zeile2], (p) => ARCHIVO(p, 600), z2h * 0.95, bw)
    ctx.font = ARCHIVO(px, 600)
    ctx.fillText(zeile2, x + w / 2, by + bh - z2h / 2)
  }
  ctx.restore()
  return grund
}

/** Logo-Maße nach Fläche (Höhe ∝ Seite^-0.4), begrenzt auf die Box. */
export function logoMass(seite: number, bw: number, bh: number, basis = 0.84) {
  let lh = (bh * basis) / Math.pow(Math.max(seite, 0.05), 0.4)
  lh = Math.min(lh, bh)
  let lw = lh * seite
  if (lw > bw) {
    lw = bw
    lh = lw / seite
  }
  return { lw, lh }
}

// ── Vereinstafeln der 3D-Bande ─────────────────────────────
export const LEER_CLAIMS = ['DIESE BANDE\nSUCHT DICH', 'HIER FEHLT\nDEIN NAME', 'DEIN LOGO.\nUNSER PLATZ.', 'PLATZ FÜR\nDEINE FIRMA']

/** Freie Tafel: schwarz, rote Kante, Claim in Anton — ohne gestrichelte Box. */
export function zeichneLeer(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, i: number) {
  ctx.save()
  ctx.fillStyle = FARBE.dunkel
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = FARBE.rot
  ctx.fillRect(x, y, Math.max(6, h * 0.05), h)
  ctx.textBaseline = 'middle'
  const claim = LEER_CLAIMS[i % LEER_CLAIMS.length].replace('\n', ' ')
  const m = h * 0.12
  // Claim mittig (die Kamera fährt nah heran), darunter die Einladung
  ctx.fillStyle = FARBE.hell
  ctx.textAlign = 'center'
  const px = passend(ctx, [claim], ANTON, h * 0.46, Math.min(w - 6 * m, w * 0.62))
  ctx.font = ANTON(px)
  ctx.fillText(claim, x + w / 2, y + h * 0.43)
  ctx.fillStyle = FARBE.rot
  const px2 = passend(ctx, ['WERDE PARTNER DES SVA'], (p) => ARCHIVO(p), h * 0.13, w * 0.5)
  ctx.font = ARCHIVO(px2)
  ctx.fillText('WERDE PARTNER DES SVA', x + w / 2, y + h * 0.43 + px * 0.5 + px2 * 0.95)
  ctx.restore()
}

/** Vereinstafel (Wappen + Name). Wappen optional (async nachgeladen). */
export function zeichneVerein(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, wappen?: HTMLImageElement | null) {
  ctx.save()
  ctx.fillStyle = FARBE.dunkel
  ctx.fillRect(x, y, w, h)
  ctx.fillStyle = FARBE.rot
  ctx.fillRect(x, y + h - Math.max(5, h * 0.045), w, Math.max(5, h * 0.045))
  const m = h * 0.14
  let tx = x + w / 2
  ctx.textBaseline = 'middle'
  ctx.fillStyle = FARBE.hell
  const zeilen = ['SV AGATHENBURG-DOLLERN']
  const wapH = wappen ? h - 2 * m : 0
  const wapW = wappen ? wapH * (wappen.naturalWidth / Math.max(1, wappen.naturalHeight)) : 0
  const px = passend(ctx, zeilen, ANTON, h * 0.36, w - 2 * m - wapW * 1.3)
  ctx.font = ANTON(px)
  const tw = ctx.measureText(zeilen[0]).width
  const gesamt = wapW ? wapW + wapH * 0.22 + tw : tw
  const sx = x + w / 2 - gesamt / 2
  if (wappen && wapW) {
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(wappen, sx, y + m, wapW, wapH)
    tx = sx + wapW + wapH * 0.22
    ctx.textAlign = 'left'
  } else {
    ctx.textAlign = 'center'
  }
  ctx.fillText(zeilen[0], tx, y + h / 2 + px * 0.03)
  ctx.restore()
}

/** CTA-Tafel in Vereinsrot. */
export function zeichneCta(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.save()
  ctx.fillStyle = FARBE.rot
  ctx.fillRect(x, y, w, h)
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#ffffff'
  const m = h * 0.14
  const px = passend(ctx, ['WERDE PARTNER'], ANTON, h * 0.42, w - 4 * m)
  ctx.font = ANTON(px)
  ctx.fillText('WERDE PARTNER', x + w / 2, y + h / 2 - px * 0.28)
  ctx.fillStyle = 'rgba(255,255,255,.88)'
  const px2 = passend(ctx, ['BANDE · TRIKOT · STORY'], (p) => ARCHIVO(p, 700), h * 0.13, w - 4 * m)
  ctx.font = ARCHIVO(px2, 700)
  ctx.fillText('BANDE · TRIKOT · STORY', x + w / 2, y + h / 2 + px * 0.5)
  ctx.restore()
}
