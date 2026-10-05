// ─────────────────────────────────────────────────────────────
// v17-A: Kompakter QR-Code-Encoder (ISO/IEC 18004) ohne Bibliothek.
// Byte-Modus, Fehlerkorrektur M (~15 %), Versionen 1–10 (bis 213 Bytes) —
// reicht für „https://…/album?c=<24 Zeichen>". Maskenwahl per Strafpunkten
// wie im Standard. Nach dem Muster von Project Nayuki (MIT), stark gekürzt.
// Ergebnis: boolean[][] (true = dunkel), ohne Ruhezone.
// ─────────────────────────────────────────────────────────────

// Index = Version (1–10); Fehlerkorrektur-Stufe M
const ECC_PRO_BLOCK = [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const BLOCKE = [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const FORMAT_M = 0 // Format-Bits: L=1, M=0, Q=3, H=2

function rohModule(ver: number): number {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (ver >= 7) r -= 36
  }
  return r
}
const datenCodewoerter = (ver: number) => Math.floor(rohModule(ver) / 8) - ECC_PRO_BLOCK[ver] * BLOCKE[ver]

function gfMul(x: number, y: number): number {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z & 0xff
}
function rsDivisor(grad: number): number[] {
  const r = new Array<number>(grad).fill(0)
  r[grad - 1] = 1
  let root = 1
  for (let i = 0; i < grad; i++) {
    for (let j = 0; j < grad; j++) {
      r[j] = gfMul(r[j], root)
      if (j + 1 < grad) r[j] ^= r[j + 1]
    }
    root = gfMul(root, 0x02)
  }
  return r
}
function rsRest(daten: number[], div: number[]): number[] {
  const r = new Array<number>(div.length).fill(0)
  for (const b of daten) {
    const f = b ^ (r.shift() as number)
    r.push(0)
    div.forEach((c, i) => (r[i] ^= gfMul(c, f)))
  }
  return r
}
const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0

export function qrMatrix(text: string): boolean[][] {
  const bytes = Array.from(new TextEncoder().encode(text))
  let ver = 1
  for (; ver <= 10; ver++) {
    const bits = 4 + (ver < 10 ? 8 : 16) + bytes.length * 8
    if (bits <= datenCodewoerter(ver) * 8) break
  }
  if (ver > 10) throw new Error('Text zu lang für den QR-Code.')

  // ── Datenbits ──
  const bb: number[] = []
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bb.push((val >>> i) & 1)
  }
  push(0b0100, 4)
  push(bytes.length, ver < 10 ? 8 : 16)
  bytes.forEach((b) => push(b, 8))
  const kapazitaet = datenCodewoerter(ver) * 8
  push(0, Math.min(4, kapazitaet - bb.length))
  push(0, (8 - (bb.length % 8)) % 8)
  for (let pad = 0xec; bb.length < kapazitaet; pad ^= 0xec ^ 0x11) push(pad, 8)
  const daten: number[] = []
  for (let i = 0; i < bb.length; i += 8) daten.push(parseInt(bb.slice(i, i + 8).join(''), 2))

  // ── Fehlerkorrektur + Verschachtelung ──
  const nBloecke = BLOCKE[ver]
  const eccLen = ECC_PRO_BLOCK[ver]
  const roh = Math.floor(rohModule(ver) / 8)
  const kurze = nBloecke - (roh % nBloecke)
  const kurzLen = Math.floor(roh / nBloecke)
  const div = rsDivisor(eccLen)
  const bloecke: number[][] = []
  for (let i = 0, k = 0; i < nBloecke; i++) {
    const d = daten.slice(k, k + kurzLen - eccLen + (i < kurze ? 0 : 1))
    k += d.length
    const ecc = rsRest(d, div)
    if (i < kurze) d.push(0)
    bloecke.push(d.concat(ecc))
  }
  const cw: number[] = []
  for (let i = 0; i < bloecke[0].length; i++) {
    bloecke.forEach((b, j) => {
      if (i !== kurzLen - eccLen || j >= kurze) cw.push(b[i])
    })
  }

  // ── Matrix ──
  const size = ver * 4 + 17
  const m: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const fn: boolean[][] = Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  const setF = (x: number, y: number, d: boolean) => {
    m[y][x] = d
    fn[y][x] = true
  }
  for (let i = 0; i < size; i++) {
    setF(6, i, i % 2 === 0)
    setF(i, 6, i % 2 === 0)
  }
  const finder = (x: number, y: number) => {
    for (let dy = -4; dy <= 4; dy++)
      for (let dx = -4; dx <= 4; dx++) {
        const d = Math.max(Math.abs(dx), Math.abs(dy))
        const xx = x + dx
        const yy = y + dy
        if (xx >= 0 && xx < size && yy >= 0 && yy < size) setF(xx, yy, d !== 2 && d !== 4)
      }
  }
  finder(3, 3)
  finder(size - 4, 3)
  finder(3, size - 4)
  if (ver > 1) {
    const n = Math.floor(ver / 7) + 2
    const step = Math.floor((ver * 8 + n * 3 + 5) / (n * 4 - 4)) * 2
    const pos = [6]
    for (let p = size - 7; pos.length < n; p -= step) pos.splice(1, 0, p)
    for (let i = 0; i < n; i++)
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue
        for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setF(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
      }
  }
  const format = (maske: number) => {
    const d = (FORMAT_M << 3) | maske
    let rem = d
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((d << 10) | rem) ^ 0x5412
    for (let i = 0; i <= 5; i++) setF(8, i, bit(bits, i))
    setF(8, 7, bit(bits, 6))
    setF(8, 8, bit(bits, 7))
    setF(7, 8, bit(bits, 8))
    for (let i = 9; i < 15; i++) setF(14 - i, 8, bit(bits, i))
    for (let i = 0; i < 8; i++) setF(size - 1 - i, 8, bit(bits, i))
    for (let i = 8; i < 15; i++) setF(8, size - 15 + i, bit(bits, i))
    setF(8, size - 8, true)
  }
  format(0)
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3)
      const b = Math.floor(i / 3)
      setF(a, b, bit(bits, i))
      setF(b, a, bit(bits, i))
    }
  }
  // Codewörter im Zickzack
  let i = 0
  for (let rechts = size - 1; rechts >= 1; rechts -= 2) {
    if (rechts === 6) rechts = 5
    for (let v = 0; v < size; v++)
      for (let j = 0; j < 2; j++) {
        const x = rechts - j
        const hoch = ((rechts + 1) & 2) === 0
        const y = hoch ? size - 1 - v : v
        if (!fn[y][x] && i < cw.length * 8) {
          m[y][x] = bit(cw[i >>> 3], 7 - (i & 7))
          i++
        }
      }
  }

  const maskiere = (maske: number) => {
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        let inv: boolean
        switch (maske) {
          case 0: inv = (x + y) % 2 === 0; break
          case 1: inv = y % 2 === 0; break
          case 2: inv = x % 3 === 0; break
          case 3: inv = (x + y) % 3 === 0; break
          case 4: inv = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break
          case 5: inv = ((x * y) % 2) + ((x * y) % 3) === 0; break
          case 6: inv = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break
          default: inv = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
        }
        if (!fn[y][x] && inv) m[y][x] = !m[y][x]
      }
  }
  const strafe = () => {
    let p = 0
    const linie = (get: (a: number, b: number) => boolean) => {
      for (let a = 0; a < size; a++) {
        let lauf = 1
        let s = ''
        for (let b = 0; b < size; b++) {
          s += get(a, b) ? '1' : '0'
          if (b > 0 && get(a, b) === get(a, b - 1)) {
            lauf++
            if (lauf === 5) p += 3
            else if (lauf > 5) p++
          } else lauf = 1
        }
        const muster = /(?=(10111010000|00001011101))/g
        p += (s.match(muster) ?? []).length * 40
      }
    }
    linie((a, b) => m[a][b])
    linie((a, b) => m[b][a])
    for (let y = 0; y < size - 1; y++)
      for (let x = 0; x < size - 1; x++) {
        const c = m[y][x]
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) p += 3
      }
    const dunkel = m.reduce((a, r) => a + r.filter(Boolean).length, 0)
    p += Math.floor(Math.abs(dunkel * 20 - size * size * 10) / (size * size)) * 10
    return p
  }
  let beste = 0
  let min = Infinity
  for (let k = 0; k < 8; k++) {
    maskiere(k)
    format(k)
    const s = strafe()
    if (s < min) {
      min = s
      beste = k
    }
    maskiere(k)
  }
  maskiere(beste)
  format(beste)
  return m
}

/** QR in ein Canvas zeichnen (Ruhezone = 4 Module). */
export function zeichneQr(ctx: CanvasRenderingContext2D, matrix: boolean[][], x: number, y: number, groesse: number, farbe = '#000') {
  const n = matrix.length + 8
  const modul = groesse / n
  ctx.fillStyle = '#fff'
  ctx.fillRect(x, y, groesse, groesse)
  ctx.fillStyle = farbe
  matrix.forEach((zeile, r) =>
    zeile.forEach((d, c) => {
      if (d) ctx.fillRect(Math.floor(x + (c + 4) * modul), Math.floor(y + (r + 4) * modul), Math.ceil(modul), Math.ceil(modul))
    }),
  )
}
