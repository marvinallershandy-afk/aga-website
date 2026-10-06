import { useCallback, useEffect, useRef, useState } from 'react'
import type { TorDaten } from './TorJubel'

// ─────────────────────────────────────────────────────────────
// v22-T: erkennt ein NEUES Tor am Spielstand (SVA-Tore / Gegentore steigen)
// — nie beim ersten Laden, nie nach Spielwechsel, nur bei sichtbarer Seite.
// „bauen“ liefert die Einblendung (darf asynchron sein, z. B. Torschütze aus
// dem Ticker nachladen). Gemeinsam für /tippen und /live.
// ─────────────────────────────────────────────────────────────

export function useTorErkennung(
  spielKey: string | null,
  toreSva: number | null | undefined,
  toreGegner: number | null | undefined,
  bauen: (sva: boolean) => TorDaten | null | Promise<TorDaten | null>,
): [TorDaten | null, () => void] {
  const [tor, setTor] = useState<TorDaten | null>(null)
  const vorher = useRef<{ spiel: string | null; a: number; b: number } | null>(null)
  const bauenRef = useRef(bauen)
  useEffect(() => {
    bauenRef.current = bauen
  })
  useEffect(() => {
    if (!spielKey || toreSva == null || toreGegner == null) {
      vorher.current = spielKey ? null : { spiel: null, a: 0, b: 0 }
      return
    }
    const v = vorher.current
    vorher.current = { spiel: spielKey, a: toreSva, b: toreGegner }
    if (!v || v.spiel !== spielKey) return
    const sva = toreSva > v.a
    if (!sva && !(toreGegner > v.b)) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    let aktiv = true
    void Promise.resolve(bauenRef.current(sva)).then((d) => {
      if (aktiv && d) setTor(d)
    })
    return () => {
      aktiv = false
    }
  }, [spielKey, toreSva, toreGegner])
  const zu = useCallback(() => setTor(null), [])
  return [tor, zu]
}

/** Kürzel für Spielstands-Anzeigen (TuS Fischbek → FIS, SG Lühe → LÜH). */
export function teamKurz(name: string): string {
  if (/agathenburg/i.test(name)) return 'SVA'
  const woerter = name
    .replace(/\(.*?\)/g, '')
    .split(/[\s/-]+/)
    .filter((w) => w && !/^(sv|tsv|fc|vfl|tus|sg|ssv|jsg|mtv|vfr|sc|fsv|tsg|vfb|tv|sv\.)$/i.test(w))
  if (woerter.length === 0) return name.slice(0, 3).toUpperCase()
  if (woerter.length === 1) return woerter[0].slice(0, 3).toUpperCase()
  return woerter.map((w) => w[0]).join('').slice(0, 3).toUpperCase()
}
