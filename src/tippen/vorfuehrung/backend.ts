// ─────────────────────────────────────────────────────────────
// v21-T Vorführung: beantwortet die tipp_*-Aufrufe aus api.ts im Browser.
// Kein Netz, keine Datenbank — Abgaben landen nur im Speicher (store.ts).
// ─────────────────────────────────────────────────────────────
import type { MeineElf, MeinTipp } from '../api'
import { TippFehler, fehlerText } from '../api'
import { NAECHSTES_SPIEL_ID, duell, istGewertet, lage, ligaTipps, meineLigen, rangliste, verteilung } from './sim'
import { simLesen, simSetzen } from './store'
import { uebergabeLesen, uebergeben } from '../../album/vorfuehrung/uebergabe'
import { PACK_TYPEN_STANDARD } from '../../album/packTypen'

const TIPP_PACK = PACK_TYPEN_STANDARD.find((t) => t.typ === 'tipp')!

const kurz = () => new Promise((r) => window.setTimeout(r, 90))

export async function simRpc(fn: string, a: Record<string, unknown>): Promise<unknown> {
  const z = simLesen()
  const p = z.phase
  switch (fn) {
    case 'tipp_lage':
      return { ...lage(p), tippPack: { titel: TIPP_PACK.titel, karten: TIPP_PACK.karten } }
    case 'tipp_rangliste':
      await kurz()
      return rangliste((a.p_art as 'spieltag') ?? 'saison', p, (a.p_liga as string) ?? null)
    case 'tipp_duell':
      return duell(p)
    case 'tipp_verteilung':
      return verteilung()
    case 'tipp_meine_ligen':
      await kurz()
      return meineLigen(p)
    case 'tipp_liga_tipps':
      return ligaTipps(String(a.p_liga), p)
    case 'tipp_kabinen_liga':
      return { id: 'vf-kabine', name: 'Kabinen-Liga', system: 'kabine', mitglieder: 5 }
    case 'tipp_liga_vorschau':
      return String(a.p_code ?? '').toUpperCase() === 'STAMM7' ? { name: 'Stammtisch-Liga', code: 'STAMM7', mitglieder: 6 } : null
    case 'tipp_abgeben': {
      // v22-T: ein Fokus — SG Lühe erst nach der Wertung des Fischbek-Spiels
      const naechstes = a.p_spiel === NAECHSTES_SPIEL_ID
      if (naechstes && !istGewertet(p)) throw new TippFehler('tipp_noch_nicht_offen', fehlerText('tipp_noch_nicht_offen'))
      if (!naechstes && p !== 'vor') throw new TippFehler('tipp_geschlossen', fehlerText('tipp_geschlossen'))
      await kurz()
      const neu = naechstes ? !z.naechsterTipp : !z.meinTipp
      const t: MeinTipp = {
        toreSva: Number(a.p_tore_sva),
        toreGegner: Number(a.p_tore_gegner),
        ersterTorschuetze: (a.p_erster as string) ?? undefined,
        motm: (a.p_motm as string) ?? undefined,
        joker: !!a.p_joker,
        bonus: (a.p_bonus as MeinTipp['bonus']) ?? {},
      }
      simSetzen(naechstes ? { naechsterTipp: t } : { meinTipp: t })
      // v24-P: erster Tipp → Tipp-Pack, per sessionStorage an die Album-Vorführung übergeben
      // (je Spiel genau eins; dort wird es wirklich gezogen, geöffnet und eingeklebt)
      if (!neu) return { ok: true, neu, karte: false, abzeichen: [], anzahlTipps: 16 }
      const pk = uebergeben({ id: `vf-tipp-${String(a.p_spiel)}`, art: 'tipp', typ: 'tipp', titel: TIPP_PACK.titel, karten: TIPP_PACK.karten, gegner: naechstes ? 'SG Lühe' : 'TuS Fischbek' })
      return { ok: true, neu, karte: true, abzeichen: [], anzahlTipps: 16, packId: pk.id, pack: { id: pk.id, typ: pk.typ, titel: pk.titel, karten: pk.karten } }
    }
    case 'tipp_elf_speichern': {
      const e: MeineElf = { spieler: a.p_spieler as string[], kapitaen: String(a.p_kapitaen), frei: !!a.p_frei }
      simSetzen(a.p_spiel === NAECHSTES_SPIEL_ID ? { naechsteElf: e } : { meineElf: e })
      return { ok: true }
    }
    case 'tipp_liga_gruenden': {
      const name = String(a.p_name ?? '').trim()
      if (name.length < 3) throw new TippFehler('tipp_ungueltig:liganame', fehlerText('tipp_ungueltig:liganame'))
      const l = { id: `vf-neu-${z.ligen.length + 1}`, name, code: ['K7Q2MX', 'R4HT9P', 'WZ8ME3'][z.ligen.length % 3] }
      simSetzen({ ligen: [...z.ligen, l] })
      return l
    }
    case 'tipp_liga_beitreten':
      if (String(a.p_code ?? '').toUpperCase() === 'STAMM7') return { id: 'vf-stammtisch', name: 'Stammtisch-Liga', code: 'STAMM7', abzeichen: [] }
      throw new TippFehler('tipp_liga_unbekannt', fehlerText('tipp_liga_unbekannt'))
    case 'tipp_liga_verlassen':
      if (a.p_liga === 'vf-kabine') throw new TippFehler('tipp_liga_system', fehlerText('tipp_liga_system'))
      simSetzen({ ligen: z.ligen.filter((l) => l.id !== a.p_liga) })
      return { ok: true }
    case 'tipp_beitreten':
    case 'tipp_profil_speichern':
      return { ok: true }
    case 'album_stand': {
      // Stand der Album-Vorführung (falls schon geöffnet), sonst Startwerte + übergebene Packs
      try {
        const a2 = JSON.parse(sessionStorage.getItem('sva-album-vf') ?? 'null') as { stand?: { belegt: number; gesamt: number; tuetchen: number } } | null
        if (a2?.stand) return { ...a2.stand, tuetchen: a2.stand.tuetchen + uebergabeLesen().filter((x) => !x.geoeffnet && !(a2 as { packIds?: string[] }).packIds?.includes(x.id)).length }
      } catch {
        /* egal */
      }
      return { belegt: 14, gesamt: 42, tuetchen: 2 + uebergabeLesen().filter((x) => !x.geoeffnet).length }
    }
    default:
      return null
  }
}
