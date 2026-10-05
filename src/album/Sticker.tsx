import { useState } from 'react'
import type { Karte } from './api'
import { SELTEN_LABEL, name } from './model'

// ─────────────────────────────────────────────────────────────
// v17-A: Sticker wie im gedruckten SVA-Stickerheft (Vorlage: Higgsfield-
// Entwurf „Das offizielle Stickerheft"): echtes Foto mit weißem
// Sticker-Rand, kleine Fußleiste (Nummer, Position, Wappen).
// Seltenheit = Veredelung wie bei Panini: Kader (normaler Sticker),
// Silber-Folie, Gold-Folie, Spezial = Holo-Glitzer.
// Detailansicht: Walkout-Video statt Foto, falls hinterlegt — fällt bei
// einem Ladefehler sauber auf das Foto zurück.
// ─────────────────────────────────────────────────────────────

interface Props {
  karte: Karte
  walkout?: boolean
  className?: string
}

const ROLLE: Record<string, string> = { trainer: 'Trainer', 'co-trainer': 'Co-Trainer', 'torwart-trainer': 'TW-Trainer', teammanager: 'Teammanager' }

export function Sticker({ karte, walkout, className }: Props) {
  const [videoKaputt, setVideoKaputt] = useState(false)
  const [bildKaputt, setBildKaputt] = useState(false)
  const s = karte.spieler
  const foto = !bildKaputt ? (karte.bildUrl ?? s?.fotoUrl ?? s?.cutoutUrl) : undefined
  const freisteller = !!foto && !!s?.cutoutUrl && foto === s.cutoutUrl
  const video = walkout && karte.walkoutUrl && !videoKaputt ? karte.walkoutUrl : null
  const logo = karte.typ === 'partner' && !karte.bildUrl ? karte.partner?.logoUrl : undefined
  const fuss =
    karte.typ === 'spieler'
      ? [s?.nummer != null ? `#${s.nummer}` : null, s?.position].filter(Boolean).join(' · ')
      : karte.typ === 'trainer'
        ? ROLLE[s?.rolle ?? ''] ?? 'Trainerstab'
        : karte.typ === 'partner'
          ? 'Partner'
          : karte.typ === 'moment'
            ? 'Moment'
            : 'Fans'

  return (
    <div
      className={`st st--${karte.seltenheit} st--${karte.typ}${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={`Sticker ${name(karte)}${karte.seltenheit !== 'bronze' ? `, ${SELTEN_LABEL[karte.seltenheit]}` : ''}`}
    >
      <div className={`st__bild${freisteller ? ' st__bild--frei' : ''}${logo ? ' st__bild--logo' : ''}`} aria-hidden="true">
        {video ? (
          <video src={video} poster={foto} autoPlay muted loop playsInline preload="metadata" onError={() => setVideoKaputt(true)} />
        ) : logo ? (
          <img src={logo} alt="" loading="lazy" decoding="async" draggable={false} />
        ) : foto ? (
          <img src={foto} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setBildKaputt(true)} />
        ) : (
          <div className="st__ohne">
            <img src="/brand/aga-logo.png" alt="" />
            {s?.nummer != null && <span>{s.nummer}</span>}
          </div>
        )}
        {s?.kapitaen && karte.typ === 'spieler' && <span className="st__c">C</span>}
        {karte.seltenheit !== 'bronze' && karte.untertitel && karte.typ === 'spieler' && <span className="st__band">{karte.untertitel}</span>}
      </div>
      <div className="st__fuss" aria-hidden="true">
        <span>{fuss}</span>
        <img src="/brand/aga-logo.png" alt="" />
      </div>
      {karte.seltenheit !== 'bronze' && <div className="st__folie" aria-hidden="true" />}
    </div>
  )
}

/** Sticker-Rückseite (Pack-Opening): Abziehpapier wie bei Panini. */
export function StickerRueckseite({ nr }: { nr?: number }) {
  return (
    <div className="st-rueck" aria-hidden="true">
      <img src="/brand/aga-logo.png" alt="" />
      <b>Stickerheft</b>
      <span>SV Agathenburg-Dollern</span>
      {nr != null && <em>Nr. {nr}</em>}
      <small>Hier abziehen ↗</small>
    </div>
  )
}
