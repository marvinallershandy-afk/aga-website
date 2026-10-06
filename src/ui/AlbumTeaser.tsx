import { useEffect, useState } from 'react'
import { ArrowRight } from 'lucide-react'
import { ALBUM_LINK } from '../data/club'
import { fanSitzung, standFrisch, standLesen, STAND_KEY, type FanStand } from '../album/fanStand'
import './album-teaser.css'

// ─────────────────────────────────────────────────────────────
// v18-P: ruhiger Zugang zum Sammelalbum (/album) — ein Satz Nutzen + CTA.
// Kein Popup. Varianten:
//   karte    — Startseite (Karte), unten links, nach dem Intro
//   panel    — Orts-Panels (Fans, Vereinsheim)
//   rundgang — Fans-Station im Rundgang
// v21-A: Eingeloggte Fans sehen „Angemeldet als Vorname“ + Fortschritt
// („3/42 · 1 Tütchen wartet“) — ohne Supabase-Bundle (src/album/fanStand.ts).
// Bewusst ohne Store/three → auch in /live nutzbar.
// ─────────────────────────────────────────────────────────────

type Fan = { stand: FanStand | null } | null

function useFan(): Fan {
  const [fan, setFan] = useState<Fan>(() => {
    const s = typeof window !== 'undefined' ? fanSitzung() : null
    return s ? { stand: standLesen(s.uid) } : null
  })
  useEffect(() => {
    const s = fanSitzung()
    if (!s) return
    let aus = false
    // frisch nachladen, wenn die Seite zur Ruhe gekommen ist (nie im ersten Bild)
    const los = () => standFrisch().then((st) => !aus && st && setFan({ stand: st }))
    const ric = (window as Window & { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => number }).requestIdleCallback
    const t = window.setTimeout(() => (ric ? ric(los, { timeout: 4000 }) : los()), 2500)
    // Album in einem anderen Tab hat den Stand aktualisiert
    const f = (e: StorageEvent) => {
      if (e.key !== STAND_KEY && e.key !== 'sva-album-auth') return
      const s2 = fanSitzung()
      setFan(s2 ? { stand: standLesen(s2.uid) } : null)
    }
    window.addEventListener('storage', f)
    return () => {
      aus = true
      window.clearTimeout(t)
      window.removeEventListener('storage', f)
    }
  }, [])
  return fan
}

function Stand({ stand }: { stand: FanStand | null }) {
  if (!stand) return <small>Dein Album wartet — weitersammeln</small>
  const p = stand.gesamt ? Math.min(1, stand.belegt / stand.gesamt) : 0
  return (
    <>
      <small className="alb-t__stand">
        <b>
          {stand.belegt}/{stand.gesamt}
        </b>{' '}
        Karten
        {stand.packs > 0 && (
          <span className="alb-t__packs">
            <i aria-hidden="true" />
            {stand.packs === 1 ? '1 Tütchen wartet' : `${stand.packs} Tütchen warten`}
          </span>
        )}
      </small>
      <span className="alb-t__balken" aria-hidden="true">
        <i style={{ transform: `scaleX(${p.toFixed(3)})` }} />
      </span>
    </>
  )
}

export function AlbumTeaser({ variante = 'panel' }: { variante?: 'karte' | 'panel' | 'rundgang' }) {
  const fan = useFan()
  if (variante === 'karte') {
    return (
      <a className={`alb-t alb-t--karte${fan ? ' is-fan' : ''}`} href={ALBUM_LINK.href} aria-label={fan ? `Mein Album öffnen${fan.stand?.vorname ? ` — angemeldet als ${fan.stand.vorname}` : ''}` : undefined}>
        <img src={ALBUM_LINK.bild} alt="" width="72" height="56" loading="lazy" decoding="async" />
        <span className="alb-t__text">
          {fan ? (
            <>
              <span className="alb-t__wer">
                <i aria-hidden="true" />
                {fan.stand?.vorname ? `Angemeldet als ${fan.stand.vorname}` : 'Angemeldet'}
              </span>
              <b>Mein Album</b>
              <Stand stand={fan.stand} />
            </>
          ) : (
            <>
              <b>{ALBUM_LINK.titel}</b>
              <small>{ALBUM_LINK.kurzNutzen}</small>
            </>
          )}
        </span>
        <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
      </a>
    )
  }
  return (
    <a className={`alb-t alb-t--${variante}${fan ? ' is-fan' : ''}`} href={ALBUM_LINK.href}>
      <img src={ALBUM_LINK.bild} alt="" width="108" height="84" loading="lazy" decoding="async" />
      <span className="alb-t__text">
        <span className="alb-t__kicker">{fan?.stand?.vorname ? `Angemeldet als ${fan.stand.vorname}` : 'Sammelalbum'}</span>
        <b>{fan ? 'Mein Album' : ALBUM_LINK.titel}</b>
        {fan ? <Stand stand={fan.stand} /> : <small>{ALBUM_LINK.nutzen}</small>}
        <span className="alb-t__cta">
          {fan ? 'Album öffnen' : ALBUM_LINK.cta} <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </span>
      </span>
    </a>
  )
}
