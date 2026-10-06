import { useEffect, useMemo, useState } from 'react'
import { Crown, Share2, Trophy } from 'lucide-react'
import type { Mein, WallEintrag } from './api'
import { ruhigeBewegung, vibriere } from '../karten/medien'
import './endgame.css'

const GESEHEN = 'sva-album-gold-gesehen'
const datum = (iso?: string) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Berlin' }) : '')

// v26-E: Goldene Abschluss-Seite (nur bei 100 %). Einmalige Präge-Animation.
export function GoldeneSeite({ mein, optIn, onOptIn, onTeilen }: { mein: Mein; optIn: boolean; onOptIn: (v: boolean) => void; onTeilen: () => void }) {
  const [neu] = useState(() => {
    if (ruhigeBewegung()) return false
    try {
      if (localStorage.getItem(GESEHEN)) return false
      localStorage.setItem(GESEHEN, '1')
      return true
    } catch {
      return false
    }
  })
  useEffect(() => {
    if (neu) vibriere([14, 70, 20, 70, 28])
  }, [neu])
  return (
    <div className={`eg-gold${neu ? ' is-neu' : ''}`}>
      <span className="eg-gold__schimmer" aria-hidden="true" />
      <img className="eg-gold__wappen" src="/brand/aga-logo.png" alt="" width="64" height="76" />
      <p className="eg-gold__kicker">Album komplett</p>
      <b className="eg-gold__titel">100 %</b>
      <p className="eg-gold__saison">Saison {mein.saison}</p>
      <p className="eg-gold__name">{mein.profil?.anzeigename ?? 'Ein SVA-Fan'}</p>
      {mein.komplettAt && <p className="eg-gold__datum">{datum(mein.komplettAt)}</p>}
      <label className="eg-gold__optin">
        <input type="checkbox" checked={optIn} onChange={(e) => onOptIn(e.target.checked)} />
        <span>Mit Namen an die Wall of Fame</span>
      </label>
      <button type="button" className="eg-gold__teilen" onClick={onTeilen}>
        <Share2 size={16} strokeWidth={1.6} aria-hidden="true" /> Teilen
      </button>
    </div>
  )
}

// v26-E: Wall of Fame — volle Alben, Saison-Reiter, Gold-Plaketten.
export function WallOfFame({ eintraege }: { eintraege: WallEintrag[] | null }) {
  const saisons = useMemo(() => [...new Set((eintraege ?? []).map((e) => e.saison))].sort().reverse(), [eintraege])
  const [saison, setSaison] = useState<string | null>(null)
  const aktiv = saison ?? saisons[0] ?? null
  const liste = (eintraege ?? []).filter((e) => e.saison === aktiv)
  return (
    <div className="sa-block eg-wall">
      <h3 className="hf-zwischen">
        <Trophy size={15} strokeWidth={1.6} aria-hidden="true" /> Wall of Fame — volle Alben
      </h3>
      {saisons.length > 1 && (
        <div className="eg-wall__reiter" role="tablist" aria-label="Saison">
          {saisons.map((s) => (
            <button key={s} type="button" role="tab" aria-selected={s === aktiv} className={`eg-wall__r${s === aktiv ? ' is-aktiv' : ''}`} onClick={() => setSaison(s)}>
              {s}
            </button>
          ))}
        </div>
      )}
      {liste.length === 0 ? (
        <p className="eg-wall__leer">
          <Crown size={16} strokeWidth={1.6} aria-hidden="true" /> Noch hat es niemand geschafft. Wirst du der/die Erste?
        </p>
      ) : (
        <ul className="eg-wall__liste">
          {liste.map((e, i) => (
            <li key={`${e.name}-${e.at}-${i}`} className="eg-wall__plakette">
              <Crown size={15} strokeWidth={1.6} aria-hidden="true" />
              <b>{e.name}</b>
              <small>{datum(e.at)}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
