import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import type { Konferenz as KonferenzDaten, KonferenzSpiel } from './model'

// ─────────────────────────────────────────────────────────────
// v23-U: Kreisliga-Konferenz auf /live. Eingeklappt „Kreisliga live · 3 laufen“
// (pulsierender Punkt bei ≥ 1 LIVE), aufgeklappt die Spiele des Spieltags.
// SVA-Spiel fett + oben. Ganze Zeile verlinkt FuPa. Daten aus web_live v2
// (conference). Ohne Daten wird nichts gezeigt.
// ─────────────────────────────────────────────────────────────

const LS_KEY = 'sva-live-konferenz-auf'

function offenLesen(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === '1'
  } catch {
    return false
  }
}
function offenMerken(v: boolean) {
  try {
    localStorage.setItem(LS_KEY, v ? '1' : '0')
  } catch {
    /* privat */
  }
}

function uhrzeit(iso: string): string {
  return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })
}

function minuteText(s: KonferenzSpiel): string {
  if (s.section === 'POST') return 'Ende'
  if (s.section === 'PRE') return uhrzeit(s.anstoss)
  // LIVE
  if (s.minute != null) return `${s.minute}${s.nachspielzeit ? `+${s.nachspielzeit}` : ''}′`
  return 'live'
}

function stand(s: KonferenzSpiel): string {
  if (s.toreHeim == null || s.toreGast == null) return '–:–'
  return `${s.toreHeim}:${s.toreGast}`
}

export function Konferenz({ daten }: { daten: KonferenzDaten }) {
  const [auf, setAuf] = useState(offenLesen)
  const spiele = [...(daten.spiele ?? [])]
  if (spiele.length === 0) return null
  const live = spiele.filter((s) => s.section === 'LIVE').length
  const beendet = spiele.filter((s) => s.section === 'POST').length
  // SVA-Spiel oben, dann LIVE, dann PRE/POST nach Anstoß.
  const rang = (s: KonferenzSpiel) => (s.sva ? 0 : s.section === 'LIVE' ? 1 : s.section === 'PRE' ? 2 : 3)
  spiele.sort((a, b) => rang(a) - rang(b) || new Date(a.anstoss).getTime() - new Date(b.anstoss).getTime())

  const kopf = live > 0 ? `Kreisliga live · ${live} ${live === 1 ? 'läuft' : 'laufen'}` : `Kreisliga heute · ${beendet} beendet`

  const umschalten = () => {
    setAuf((x) => {
      offenMerken(!x)
      return !x
    })
  }

  return (
    <section className={`lv-konf${auf ? ' is-auf' : ''}`} aria-labelledby="lv-konf-h">
      <button type="button" className="lv-konf__kopf" aria-expanded={auf} onClick={umschalten}>
        {live > 0 && <i className="lv-puls" aria-hidden="true" />}
        <b id="lv-konf-h">{kopf}</b>
        <ChevronDown className="lv-konf__chev" size={18} strokeWidth={2} aria-hidden="true" />
      </button>
      {auf && (
        <>
          <ol className="lv-konf__liste">
            {spiele.map((s) => (
              <li key={s.fupaId} className={`lv-konf__zeile${s.sva ? ' is-sva' : ''}${s.section === 'LIVE' ? ' is-live' : ''}`}>
                <a href={s.url} target="_blank" rel="noopener">
                  <span className="lv-konf__teams">
                    <span>{s.heim}</span>
                    <span>{s.gast}</span>
                  </span>
                  <span className="lv-konf__stand">{s.section === 'PRE' ? '' : stand(s)}</span>
                  <span className={`lv-konf__min${s.section === 'LIVE' ? ' is-live' : ''}`}>{minuteText(s)}</span>
                </a>
              </li>
            ))}
          </ol>
          <p className="lv-konf__quelle">Quelle: FuPa</p>
        </>
      )}
    </section>
  )
}
