import { useEffect, useState } from 'react'
import { GEHEIM_EREIGNIS, fundMelden, type GeheimFund } from './ei'
import './geheim.css'

// ─────────────────────────────────────────────────────────────
// v22-A: Hinweis nach einem Easter-Egg-Fund (Startseite, Rundgang).
// Rendert nichts, bis ein Fund gemeldet wird. „Im Album abholen“ trägt nur
// das Token (?g=…) — das Album löst es serverseitig ein.
// ─────────────────────────────────────────────────────────────

export function GeheimHinweis() {
  const [fund, setFund] = useState<GeheimFund | null>(null)
  useEffect(() => {
    const f = (e: Event) => setFund((e as CustomEvent<GeheimFund>).detail)
    window.addEventListener(GEHEIM_EREIGNIS, f)
    return () => window.removeEventListener(GEHEIM_EREIGNIS, f)
  }, [])
  if (!fund) return null
  const vf = /[?&]vorfuehrung=/.test(window.location.search) ? '&vorfuehrung=1' : ''
  return (
    <div className="gh" role="status" key={fund.token}>
      <span className="gh__stern" aria-hidden="true">✦</span>
      <span className="gh__text">
        <b>{fund.text}</b>
        <small>Eine Geheimkarte wartet auf dich.</small>
      </span>
      <a className="gh__los" href={`/album?g=${encodeURIComponent(fund.token)}${vf}`}>
        Im Album abholen
      </a>
      <button type="button" className="gh__x" onClick={() => setFund(null)} aria-label="Hinweis schließen">
        ×
      </button>
    </div>
  )
}

/** v22-A (b): Ein Ball liegt versteckt im Rundgang. Antippen → rollt weg → Fund. */
export function VersteckterBall({ className }: { className?: string }) {
  const [weg, setWeg] = useState(false)
  return (
    <button
      type="button"
      className={`gh-ball${weg ? ' is-weg' : ''}${className ? ` ${className}` : ''}`}
      aria-label="Ein vergessener Ball"
      onClick={() => {
        if (weg) return
        setWeg(true)
        void fundMelden('ball|rundgang', 'Der verlorene Ball ist wieder da.')
      }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10.5" fill="#f4f2ef" stroke="#141213" strokeWidth="1" />
        <path d="M12 7.2l3.4 2.5-1.3 4H9.9l-1.3-4z" fill="#141213" />
        <path d="M12 7.2V2.6M15.4 9.7l4.3-1.4M14.1 13.7l2.7 3.7M9.9 13.7l-2.7 3.7M8.6 9.7L4.3 8.3" stroke="#141213" strokeWidth=".9" fill="none" />
      </svg>
    </button>
  )
}
