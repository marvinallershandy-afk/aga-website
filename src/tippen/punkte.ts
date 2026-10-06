// ─────────────────────────────────────────────────────────────
// v21-T: Punkte-Regeln im Browser — NUR für die Live-Hochrechnung
// („Stand jetzt“) und die Vorführung. Verbindlich rechnet weiterhin die
// Datenbank (sva_tipp_ergebnis_punkte, sva_tipp_tipp_punkte,
// sva_tipp_spieler_punkte in 20261012100000_sva_tippliga.sql) — diese
// Funktionen sind 1:1 nachgebaut, damit „live“ und „gewertet“ zusammenpassen.
// ─────────────────────────────────────────────────────────────
import type { BonusKey, LiveEreignis, LiveHochrechnung, MeineElf, MeinTipp, Position, SpielerPosten, TippSpiel } from './api'

export function ergebnisPunkte(ts?: number | null, tg?: number | null, s?: number | null, g?: number | null): number {
  if (ts == null || tg == null || s == null || g == null) return 0
  if (ts === s && tg === g) return 4
  if (ts - tg === s - g) return 3
  if (Math.sign(ts - tg) === Math.sign(s - g)) return 2
  return 0
}

export const ERGEBNIS_ART = (p: number): 'exakt' | 'differenz' | 'tendenz' | 'daneben' => (p === 4 ? 'exakt' : p === 3 ? 'differenz' : p === 2 ? 'tendenz' : 'daneben')

export interface SpielerStand {
  eingesetzt: boolean
  minuten: number
  tore: number
  vorlagen: number
  zuNull: boolean
  karte?: 'gelb' | 'gelbrot' | 'rot'
  motm: boolean
  sieg: boolean
}

export function spielerPunkte(s: SpielerStand, position: Position): { punkte: number; posten: SpielerPosten[] } {
  if (!s.eingesetzt) return { punkte: 0, posten: [] }
  const posten: SpielerPosten[] = [{ k: 'einsatz', p: 1 }]
  if (s.tore > 0) posten.push({ k: 'tor', n: s.tore, p: 5 * s.tore })
  if (s.vorlagen > 0) posten.push({ k: 'vorlage', n: s.vorlagen, p: 3 * s.vorlagen })
  if (s.zuNull && (position === 'TW' || position === 'ABW') && s.minuten >= 60) posten.push({ k: 'zunull', p: 4 })
  if (s.motm) posten.push({ k: 'motm', p: 5 })
  if (s.sieg) posten.push({ k: 'sieg', p: 2 })
  if (s.karte === 'gelb') posten.push({ k: 'gelb', p: -1 })
  else if (s.karte === 'gelbrot') posten.push({ k: 'gelbrot', p: -3 })
  else if (s.karte === 'rot') posten.push({ k: 'rot', p: -4 })
  return { punkte: posten.reduce((a, x) => a + x.p, 0), posten }
}

/** Stand der Bonusfragen nach `minute` (vorläufig: ändert sich evtl. noch). */
export function bonusStand(ereignisse: LiveEreignis[], minute: number, ende: boolean): Partial<Record<BonusKey, { wert: string; fest: boolean }>> {
  const bis = ereignisse.filter((e) => e.minute <= minute)
  const gelb = bis.filter((e) => e.typ === 'gelb' && e.spieler).length
  const rot = bis.some((e) => e.typ === 'rot' || e.typ === 'gelbrot')
  const tore = bis.filter((e) => e.typ === 'tor' || e.typ === 'gegentor' || (e.typ === 'elfmeter' && !!e.stand))
  const erstes = tore[0]
  const tor20 = tore.some((e) => e.minute < 20)
  const hz1 = tore.filter((e) => e.minute <= 45).length
  const elf = bis.some((e) => e.typ === 'elfmeter' || /elfmeter/i.test(e.text ?? ''))
  return {
    gelb: { wert: gelb === 0 ? '0' : gelb <= 2 ? '1-2' : '3+', fest: ende || gelb >= 3 },
    rot: { wert: rot ? 'ja' : 'nein', fest: ende || rot },
    tor20: { wert: tor20 ? 'ja' : 'nein', fest: tor20 || minute >= 20 },
    tore_hz1: { wert: hz1 === 0 ? '0' : hz1 === 1 ? '1' : '2+', fest: minute > 45 || hz1 >= 2 },
    elfmeter: { wert: elf ? 'ja' : 'nein', fest: ende || elf },
    erstes_tor: { wert: !erstes ? 'niemand' : erstes.typ === 'gegentor' ? 'gegner' : 'sva', fest: !!erstes || ende },
  }
}

/** Spielerzustände aus Aufstellung + Ereignissen bis `minute`. */
export function spielerStaende(
  startelf: string[],
  ereignisse: LiveEreignis[],
  minute: number,
  stand: [number, number],
  motm?: string,
): Map<string, SpielerStand> {
  const m = new Map<string, SpielerStand>()
  const neu = (ein: number): SpielerStand => ({ eingesetzt: true, minuten: Math.max(0, Math.min(90, minute) - ein), tore: 0, vorlagen: 0, zuNull: false, motm: false, sieg: false })
  for (const id of startelf) m.set(id, neu(0))
  const bis = ereignisse.filter((e) => e.minute <= minute)
  for (const e of bis) {
    if (e.typ === 'wechsel' && e.spieler) {
      m.set(e.spieler, neu(e.minute))
      const raus = e.spieler2 ? m.get(e.spieler2) : undefined
      if (raus) raus.minuten = Math.max(0, e.minute)
    }
    if ((e.typ === 'tor' || (e.typ === 'elfmeter' && e.stand)) && e.spieler) {
      const s = m.get(e.spieler)
      if (s) s.tore++
      const v = e.spieler2 ? m.get(e.spieler2) : undefined
      if (v) v.vorlagen++
    }
    if ((e.typ === 'gelb' || e.typ === 'gelbrot' || e.typ === 'rot') && e.spieler) {
      const s = m.get(e.spieler)
      if (s) s.karte = e.typ
    }
  }
  const gegentore = bis.some((e) => e.typ === 'gegentor')
  for (const [id, s] of m) {
    s.zuNull = !gegentore
    s.sieg = stand[0] > stand[1]
    s.motm = id === motm
  }
  return m
}

/** Hochrechnung „Stand jetzt“ für einen Tipp + eine Elf. */
export function hochrechnen(o: {
  spiel: Pick<TippSpiel, 'fragen' | 'heim'>
  tipp?: MeinTipp
  elf?: MeineElf
  stand: [number, number]
  ereignisse: LiveEreignis[]
  minute: number
  ende: boolean
  startelf: string[]
  position: (id: string) => Position
  motm?: string
}): LiveHochrechnung {
  const teile: LiveHochrechnung['teile'] = []
  let tipp = 0
  const t = o.tipp
  if (t) {
    const erg = ergebnisPunkte(t.toreSva, t.toreGegner, o.stand[0], o.stand[1])
    teile.push({ k: 'ergebnis', label: `Ergebnis ${t.toreSva}:${t.toreGegner}`, p: erg, offen: !o.ende })
    tipp += erg
    const erster = o.ereignisse.find((e) => e.minute <= o.minute && (e.typ === 'tor' || (e.typ === 'elfmeter' && !!e.stand)) && e.spieler)
    if (t.ersterTorschuetze) {
      const p = erster && erster.spieler === t.ersterTorschuetze ? 3 : 0
      teile.push({ k: 'torschuetze', label: 'Erster Torschütze', p, offen: !erster })
      tipp += p
    }
    const b = bonusStand(o.ereignisse, o.minute, o.ende)
    let bp = 0
    let alleFest = true
    for (const f of o.spiel.fragen) {
      const s = b[f.key]
      if (!s) {
        alleFest = false
        continue
      }
      if (!s.fest) alleFest = false
      if (t.bonus?.[f.key] && t.bonus[f.key] === s.wert) bp++
    }
    teile.push({ k: 'bonus', label: 'Bonusfragen', p: bp, offen: !alleFest })
    tipp += bp
    if (o.motm && t.motm === o.motm) tipp += 2
    if (t.joker) {
      teile.push({ k: 'joker', label: 'Joker ×2', p: tipp })
      tipp *= 2
    }
  }
  const staende = spielerStaende(o.startelf, o.ereignisse, o.minute, o.stand, o.motm)
  const elfSpieler: LiveHochrechnung['elfSpieler'] = []
  let elf = 0
  for (const id of o.elf?.spieler ?? []) {
    const s = staende.get(id)
    const r = s ? spielerPunkte(s, o.position(id)) : { punkte: 0, posten: [] }
    const kap = o.elf?.kapitaen === id
    const p = kap ? r.punkte * 2 : r.punkte
    elf += p
    elfSpieler.push({ id, p, kapitaen: kap, posten: r.posten })
  }
  return { tipp, elf, gesamt: tipp + elf, teile, elfSpieler }
}
