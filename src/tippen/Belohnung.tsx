import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Check } from 'lucide-react'
import { abzeichen } from './model'

// ─────────────────────────────────────────────────────────────
// v20-T / v24-P: Bestätigung nach dem Tipp. Erster Tipp eines Spieltags →
// „Tipp-Pack · 2 Karten“ (Gutschrift macht die DB beim Abgeben). Ein kleines
// Tütchen dreht sich einmal auf — kein Konfetti, kein Dauer-Glitzer.
// v24-P (Bug „Ins Album“): Der Knopf ist ein Knopf (kein Link): Er wartet, bis
// die Abgabe sicher gespeichert ist (onAlbum), und springt dann direkt ins
// Album zu GENAU diesem Pack (/album?oeffnen=<id>). Solange er arbeitet, ist er
// gesperrt — kein Doppel-Tipp, kein Abbruch der Anfrage durch den Seitenwechsel.
// ─────────────────────────────────────────────────────────────

export interface BelohnungsPack {
  id?: string
  titel: string
  karten: number
}

export function Belohnung({
  pack,
  abzeichenNeu,
  onWeiter,
  onTeilen,
  onAlbum,
}: {
  /** Tipp-Pack (nur beim ersten Tipp eines Spieltags) */
  pack: BelohnungsPack | null
  abzeichenNeu: string[]
  onWeiter: () => void
  onTeilen: () => void
  /** wartet auf die gespeicherte Abgabe und wechselt dann ins Album */
  onAlbum: () => Promise<void>
}) {
  const [wechselt, setWechselt] = useState(false)
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && !wechselt && onWeiter()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onWeiter, wechselt])

  const zumAlbum = async () => {
    if (wechselt) return
    setWechselt(true)
    try {
      await onAlbum()
    } catch {
      setWechselt(false)
    }
  }
  const kartenWort = pack ? (pack.karten === 1 ? '1 Karte' : `${pack.karten} Karten`) : ''

  return (
    <motion.div className="tp-belohnung" role="dialog" aria-modal="true" aria-labelledby="tp-bel-titel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !wechselt && onWeiter()}>
      <div className="tp-belohnung__inner" onClick={(e) => e.stopPropagation()}>
        {pack ? (
          <motion.div
            className="tp-belohnung__pack"
            data-karten={pack.karten}
            initial={{ rotateY: 160, y: 40, opacity: 0 }}
            animate={{ rotateY: 0, y: 0, opacity: 1 }}
            transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
            aria-hidden="true"
          >
            {/* Kartenrücken, die oben aus dem Tütchen ragen (Anzahl = Karten im Pack) */}
            <span className="tp-belohnung__ruecken">
              {Array.from({ length: Math.min(4, pack.karten) }, (_, i) => (
                <i key={i} style={{ '--i': i, '--n': Math.min(4, pack.karten) } as React.CSSProperties} />
              ))}
            </span>
            <span className="tp-belohnung__tuete">
              <span className="tp-belohnung__glanz" />
              <img src="/brand/aga-logo.png" alt="" width="44" height="52" />
              <b>{pack.titel}</b>
              <small>{kartenWort}</small>
            </span>
          </motion.div>
        ) : (
          <motion.span className="tp-belohnung__haken" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
            <Check size={44} strokeWidth={1.5} aria-hidden="true" />
          </motion.span>
        )}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: pack ? 0.6 : 0.2, duration: 0.3 }}>
          <p className="tp-kicker">{pack ? 'Tipp gespeichert' : 'Gespeichert'}</p>
          <h2 className="tp-h2" id="tp-bel-titel">
            {pack ? `${pack.titel} · ${kartenWort}` : 'Dein Tipp steht'}
          </h2>
          <p className="tp-lead">
            {pack
              ? `Für jeden Spieltag, an dem du tippst, gibt’s ein ${pack.titel} fürs Album. Es liegt schon bereit — und dein Tipp ist sicher gespeichert, auch wenn du jetzt ins Album wechselst.`
              : 'Bis zum Anpfiff kannst du alles noch ändern.'}
          </p>
          {abzeichenNeu.length > 0 && (
            <ul className="tp-belohnung__abz">
              {abzeichenNeu.map((k) => (
                <li key={k}>
                  <b>Abzeichen: {abzeichen(k)?.titel ?? k}</b>
                  <small>{abzeichen(k)?.text}</small>
                </li>
              ))}
            </ul>
          )}
          <div className="tp-belohnung__knoepfe">
            {pack && (
              <button type="button" className="tp-btn" onClick={() => void zumAlbum()} disabled={wechselt} aria-busy={wechselt}>
                {wechselt ? 'Album wird geöffnet …' : `${pack.titel} öffnen`} <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
              </button>
            )}
            <button type="button" className={`tp-btn ${pack ? 'tp-btn--line' : ''}`} onClick={onTeilen} disabled={wechselt}>
              Tipp in die Story
            </button>
            <button type="button" className="tp-btn tp-btn--text" onClick={onWeiter} disabled={wechselt}>
              Weiter
            </button>
          </div>
        </motion.div>
      </div>
    </motion.div>
  )
}
