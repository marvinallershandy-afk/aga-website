// ─────────────────────────────────────────────────────────────
// v20-K: Material-Muster als SVG-Data-URLs — dieselbe Datei für DOM
// (background-image / mask-image) und Canvas (Image aus Data-URL).
// Einmal erzeugt, als Modul-Konstante gecacht.
//
//  · GUILLOCHE  — Gold-Gravur (feine Wellenlinien wie auf Banknoten)
//  · BUERSTUNG  — gebürstetes Metall (Silber), deterministisch gestreut
//  · FUNKELN    — Glitzer-Punkte der Spezial-Folie (als Maske)
//  · RAUTEN     — Prägeraster der Kader-Karte (blind, kaum sichtbar)
// ─────────────────────────────────────────────────────────────

const svg = (w: number, h: number, inner: string) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${inner}</svg>`)}`

function guilloche(): string {
  // 100 × 140 (Kartenmaß): zwei Scharen phasenversetzter Sinuslinien,
  // dazu ein Rosetten-Ring um die Kartenmitte — Gravur statt Fläche.
  let p = ''
  for (let k = 0; k < 26; k++) {
    const y0 = 4 + k * 5.4
    let d = `M0 ${y0.toFixed(2)}`
    for (let x = 0; x <= 100; x += 2.5) {
      const y = y0 + Math.sin(x / 7.5 + k * 0.55) * 2.2 + Math.sin(x / 19 - k * 0.3) * 1.1
      d += ` L${x} ${y.toFixed(2)}`
    }
    p += `<path d="${d}"/>`
  }
  let rose = ''
  for (let k = 0; k < 36; k++) {
    const a0 = (k / 36) * Math.PI * 2
    let d = ''
    for (let t = 0; t <= 64; t++) {
      const a = (t / 64) * Math.PI * 2
      const rr = 30 + Math.sin(a * 6 + a0 * 3) * 4 + Math.cos(a * 11 + a0) * 1.6
      const x = 50 + Math.cos(a) * rr
      const y = 62 + Math.sin(a) * rr * 1.08
      d += `${t ? 'L' : 'M'}${x.toFixed(2)} ${y.toFixed(2)}`
    }
    rose += `<path d="${d}Z"/>`
  }
  return svg(100, 140, `<g fill="none" stroke="#f3d27a" stroke-width=".16">${p}</g><g fill="none" stroke="#f3d27a" stroke-width=".11" opacity=".9">${rose}</g>`)
}

function buerstung(): string {
  let seed = 11
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let lines = ''
  for (let y = 0; y < 140; y += 0.7) {
    const v = rnd()
    const o = (0.03 + v * 0.1).toFixed(3)
    lines += `<rect x="0" y="${y.toFixed(2)}" width="100" height=".25" fill="${v > 0.5 ? '#fff' : '#000'}" opacity="${o}"/>`
  }
  return svg(100, 140, lines)
}

function funkeln(): string {
  let seed = 23
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647
  let dots = ''
  for (let i = 0; i < 260; i++) {
    const x = rnd() * 100
    const y = rnd() * 140
    const s = 0.12 + rnd() * 0.45
    // vierstrahliger Funke statt Kreis
    dots += `<path d="M${x.toFixed(1)} ${(y - s * 2).toFixed(2)}L${(x + s * 0.4).toFixed(2)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y + s * 2).toFixed(2)}L${(x - s * 0.4).toFixed(2)} ${y.toFixed(1)}ZM${(x - s * 2).toFixed(2)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y + s * 0.4).toFixed(2)}L${(x + s * 2).toFixed(2)} ${y.toFixed(1)}L${x.toFixed(1)} ${(y - s * 0.4).toFixed(2)}Z" opacity="${(0.35 + rnd() * 0.65).toFixed(2)}"/>`
  }
  return svg(100, 140, `<g fill="#fff">${dots}</g>`)
}

function rauten(): string {
  return svg(6, 6, `<path d="M3 0L6 3L3 6L0 3Z" fill="none" stroke="#fff" stroke-width=".22" opacity=".9"/>`)
}

let cache: { guilloche: string; buerstung: string; funkeln: string; rauten: string } | null = null
export function muster() {
  if (!cache) cache = { guilloche: guilloche(), buerstung: buerstung(), funkeln: funkeln(), rauten: rauten() }
  return cache
}

/** Seltenheits-Symbol (1–3 Balken bzw. Stern) als SVG-Pfad in 10 × 10. */
export const SYMBOL_PFAD: Record<'bronze' | 'silber' | 'gold' | 'spezial', string> = {
  bronze: 'M3.6 2h2.8v6H3.6z',
  silber: 'M1.8 2h2.4v6H1.8zM5.8 2h2.4v6H5.8z',
  gold: 'M.8 2h2.2v6H.8zM3.9 2h2.2v6H3.9zM7 2h2.2v6H7z',
  spezial: 'M5 .6l1.3 3 3.2.3-2.4 2.1.7 3.2L5 7.6 2.2 9.2l.7-3.2L.5 3.9l3.2-.3z',
}
