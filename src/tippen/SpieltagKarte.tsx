import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { datumKurz, paarung, rest, uhrzeit } from './model'
import type { TippSpiel } from './api'
import { Wappen } from './teile'

// ─────────────────────────────────────────────────────────────
// v21-T: Spieltags-Kopf wie eine TV-Einblendung. Echtes Fan-Foto als
// Bühne (dunkel abgeblendet), darüber die Paarung: SVA-Wappen und der
// Gegner als Bandentafel (Anton-Kürzel, rote Kante). Mitte: Anstoßzeit
// bzw. Spielstand (Anton, tabellarisch), darunter Live-Minute/Endstand.
// Kompakt-Variante für Listen (ältere Spieltage).
// ─────────────────────────────────────────────────────────────

export function Countdown({ ziel, now, label = 'bis Tippschluss' }: { ziel: string; now: number; label?: string }) {
  const r = rest(ziel, now)
  const teile: [number, string][] = r.tage > 0 ? [[r.tage, r.tage === 1 ? 'Tag' : 'Tage'], [r.std, 'Std'], [r.min, 'Min'], [r.sek, 'Sek']] : [[r.std, 'Std'], [r.min, 'Min'], [r.sek, 'Sek']]
  const knapp = r.gesamtMs < 3 * 3600_000
  return (
    <div className={`tp-countdown${knapp ? ' is-knapp' : ''}`} role="timer" aria-label={`Noch ${r.tage} Tage, ${r.std} Stunden, ${r.min} Minuten ${label}`}>
      <p className="tp-countdown__label">{label}</p>
      <div className="tp-countdown__zahlen" aria-hidden="true">
        {teile.map(([n, l]) => (
          <span key={l} className="tp-countdown__teil">
            <b>{String(n).padStart(2, '0')}</b>
            <small>{l}</small>
          </span>
        ))}
      </div>
    </div>
  )
}

function Ziffer({ n }: { n: number }) {
  // Tor! → die Zahl kippt (wie eine Fallblatt-Anzeige)
  return (
    <span className="tp-ziffer">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.b key={n} initial={{ y: '-70%', opacity: 0 }} animate={{ y: '0%', opacity: 1 }} exit={{ y: '70%', opacity: 0 }} transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}>
          {n}
        </motion.b>
      </AnimatePresence>
    </span>
  )
}

export function SpieltagKarte({
  spiel,
  now,
  children,
  kicker,
  kompakt,
  minute,
}: {
  spiel: TippSpiel
  now: number
  children?: ReactNode
  kicker?: string
  kompakt?: boolean
  /** Live: Spielminute (z. B. „67′“) */
  minute?: string
}) {
  const p = paarung(spiel)
  const live = spiel.status === 'live' || spiel.status === 'halbzeit'
  const hatStand = spiel.toreSva != null && spiel.toreGegner != null && spiel.status !== 'geplant'
  const toreHeim = spiel.heim ? spiel.toreSva : spiel.toreGegner
  const toreGast = spiel.heim ? spiel.toreGegner : spiel.toreSva
  const kopf = [kicker ?? spiel.wettbewerb, spiel.wertung === 'winter' ? 'Winterwertung' : null, spiel.spieltag ? `${spiel.spieltag}. Spieltag` : null].filter(Boolean).join(' · ')
  const heimName = spiel.heim ? 'SV Agathenburg-Dollern' : p.heim
  const gastName = !spiel.heim ? 'SV Agathenburg-Dollern' : p.gast
  // nach dem Bindestrich umbrechen dürfen (nie mitten im Wort)
  const umbruch = (n: string) => n.replace(/-/g, '-\u200B')
  return (
    <section className={`tp-match${kompakt ? ' tp-match--kompakt' : ''}`} data-status={spiel.status} aria-label={`${heimName} gegen ${gastName}`}>
      {!kompakt && (
        <div className="tp-match__buehne" aria-hidden="true">
          <img src="/fans/torjubel.webp" alt="" loading="eager" decoding="async" />
        </div>
      )}
      <div className="tp-match__inhalt">
        <p className="tp-match__kopf">
          <span>{kopf}</span>
          {!kompakt && (
            <span>
              {datumKurz(spiel.anstoss)} · {uhrzeit(spiel.anstoss)}
            </span>
          )}
        </p>
        <div className="tp-match__band">
          <div className="tp-match__team">
            <Wappen sva={spiel.heim} name={p.heim} klein={kompakt} />
            <b>{umbruch(heimName)}</b>
          </div>
          <div className="tp-match__mitte">
            {hatStand ? (
              <span className="tp-match__stand" aria-live="polite" aria-label={`${toreHeim} zu ${toreGast}`}>
                <Ziffer n={toreHeim ?? 0} />
                <i>:</i>
                <Ziffer n={toreGast ?? 0} />
              </span>
            ) : (
              <span className="tp-match__zeit">
                <small>Anstoß</small>
                {uhrzeit(spiel.anstoss)}
              </span>
            )}
            {live ? (
              <span className="tp-match__status is-live">
                <i className="tp-puls" aria-hidden="true" /> {spiel.status === 'halbzeit' ? 'Halbzeit' : `Live${minute ? ` ${minute}` : ''}`}
              </span>
            ) : spiel.status === 'beendet' ? (
              <span className="tp-match__status">Endstand</span>
            ) : (
              <span className="tp-match__status">{spiel.heim ? 'Heimspiel' : 'Auswärts'}</span>
            )}
          </div>
          <div className="tp-match__team">
            <Wappen sva={!spiel.heim} name={p.gast} klein={kompakt} />
            <b>{umbruch(gastName)}</b>
          </div>
        </div>
        {spiel.offen && !kompakt && <Countdown ziel={spiel.schluss} now={now} />}
        {children}
      </div>
    </section>
  )
}
