import { useEffect, useState } from 'react'
import { FlaskConical, RotateCcw, Sparkles, Star, Wand2, X, Layers } from 'lucide-react'
import { PACK_TYPEN_STANDARD, garantieText, kartenWort } from '../packTypen'
import { VF_PACK_EREIGNIS, vfPackAnlegen, vfZuruecksetzen, type TestPack } from './backend'
import { gesteRichtung, fundMelden, wappenTipp } from '../geheim/ei'
import './vorfuehrung.css'

// ─────────────────────────────────────────────────────────────
// v22-A Vorführung: Steuerleiste. Jede Animation einzeln abrufbar:
// normales Pack · Gold-Pack (Walkout) · Shiny-Pack · Test-Pack mit JEDER
// Kartenart · Geheimkarte finden (spielt die echte Easter-Egg-Sequenz ab) ·
// Kartenlabor. Alles im Speicher dieses Tabs.
// ─────────────────────────────────────────────────────────────

const GESTE: ('O' | 'U' | 'L' | 'R')[] = ['O', 'O', 'U', 'U', 'L', 'R', 'L', 'R']
const PFEIL = { O: '↑', U: '↓', L: '←', R: '→' }

export default function Steuerleiste({ onNeu, onLabor, versteckt }: { onNeu: () => void; onLabor: () => void; versteckt: boolean }) {
  const [auf, setAuf] = useState(false)
  const [geste, setGeste] = useState<number | null>(null)
  const [eiNr, setEiNr] = useState(0)
  // v25 Befund 18: beim Scrollen klappt die Pill auf den Icon-Knopf ein, damit
  // sie Inhalt/Fußzeile nicht verdeckt; nach kurzer Ruhe wieder ausgeschrieben.
  const [kompakt, setKompakt] = useState(false)
  useEffect(() => {
    let t = 0
    const onScroll = () => {
      setKompakt(true)
      window.clearTimeout(t)
      t = window.setTimeout(() => setKompakt(false), 900)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.clearTimeout(t)
    }
  }, [])

  const pack = (art: TestPack) => {
    const p = vfPackAnlegen(art)
    window.dispatchEvent(new CustomEvent(VF_PACK_EREIGNIS, { detail: p }))
    setAuf(false)
    onNeu()
  }
  // Geheimkarte finden: 1. Wisch-Geste (echt über den Gesten-Erkenner), 2. Ball, 3. 7× Wappen
  const finden = () => {
    setAuf(false)
    const n = eiNr % 3
    setEiNr((x) => x + 1)
    if (n === 0) {
      GESTE.forEach((r, i) =>
        window.setTimeout(() => {
          setGeste(i)
          gesteRichtung(r)
          if (i === GESTE.length - 1) window.setTimeout(() => setGeste(null), 700)
        }, 350 + i * 330),
      )
    } else if (n === 1) void fundMelden('ball|rundgang', 'Der verlorene Ball ist wieder da.')
    else for (let i = 0; i < 7; i++) window.setTimeout(() => wappenTipp(), 200 + i * 160)
  }

  if (versteckt) return null
  return (
    <>
      {geste !== null && (
        <div className="vf-geste" aria-live="polite">
          <small>Wisch-Geste</small>
          <span>
            {GESTE.map((r, i) => (
              <b key={i} className={i <= geste ? 'is-da' : ''}>
                {PFEIL[r]}
              </b>
            ))}
          </span>
        </div>
      )}
      <div className={`vf-leiste${auf ? ' is-auf' : ''}`}>
        {auf && (
          <div className="vf-leiste__panel" role="menu" aria-label="Vorführung steuern">
            <p className="vf-leiste__titel">
              Vorführung <span>nichts wird gespeichert</span>
            </p>
            {/* v24-P: jeder Pack-Typ mit eigener Tütchen-Optik und Reveal-Intensität */}
            <p className="vf-leiste__gruppe">Pack-Typen</p>
            <div className="vf-leiste__typen">
              {PACK_TYPEN_STANDARD.map((t) => (
                <button key={t.typ} type="button" role="menuitem" className={`vf-typ vf-typ--${t.optik}`} onClick={() => pack(t.typ)}>
                  <i aria-hidden="true" />
                  <span>
                    {t.titel}
                    <small>
                      {kartenWort(t.karten)}
                      {garantieText(t) ? ` · ${garantieText(t)}` : t.typ === 'event' ? ' · MOTM' : ''}
                    </small>
                  </span>
                </button>
              ))}
            </div>
            <button type="button" role="menuitem" className="is-shiny" onClick={() => pack('shiny')}>
              <Sparkles size={16} aria-hidden="true" /> Shiny-Pack
            </button>
            <button type="button" role="menuitem" onClick={() => pack('alle')}>
              <Layers size={16} aria-hidden="true" /> Test-Pack: alle Karten <small>9 Arten</small>
            </button>
            <button type="button" role="menuitem" onClick={finden}>
              <Wand2 size={16} aria-hidden="true" /> Geheimkarte finden <small>{['Geste', 'Ball', '7× Wappen'][eiNr % 3]}</small>
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setAuf(false)
                onLabor()
              }}
            >
              <FlaskConical size={16} aria-hidden="true" /> Kartenlabor <small>alle Karten</small>
            </button>
            <div className="vf-leiste__fuss">
              <button
                type="button"
                onClick={() => {
                  vfZuruecksetzen()
                  setAuf(false)
                  onNeu()
                }}
              >
                <RotateCcw size={14} aria-hidden="true" /> Zurücksetzen
              </button>
              <a href="/tippen?vorfuehrung=1">
                <Star size={14} aria-hidden="true" /> Tipp-Liga-Vorführung
              </a>
            </div>
          </div>
        )}
        <button type="button" className={`vf-leiste__knopf${kompakt && !auf ? ' is-kompakt' : ''}`} onClick={() => setAuf((a) => !a)} aria-expanded={auf} aria-label="Vorführung steuern">
          {auf ? <X size={16} aria-hidden="true" /> : <FlaskConical size={16} aria-hidden="true" />}
          <span className="vf-leiste__wort">{auf ? 'Schließen' : 'Vorführung steuern'}</span>
        </button>
      </div>
    </>
  )
}
