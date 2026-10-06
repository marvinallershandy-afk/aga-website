import type { ReactNode } from 'react'
import { datumKurz, kuerzel, paarung, rest, uhrzeit } from './model'
import type { TippSpiel } from './api'

// ─────────────────────────────────────────────────────────────
// v20-T: Spieltags-Karte — Paarung, Anstoß, Countdown bis Tippschluss
// bzw. Live-Stand/Endstand. Ruhige Bühne: Schwarz, roter Schein von oben.
// ─────────────────────────────────────────────────────────────

function Wappen({ sva, name }: { sva: boolean; name: string }) {
  return sva ? (
    <span className="tp-team__wappen tp-team__wappen--sva">
      <img src="/brand/aga-logo.png" alt="" width="44" height="52" />
    </span>
  ) : (
    <span className="tp-team__wappen" aria-hidden="true">
      {kuerzel(name)}
    </span>
  )
}

export function Countdown({ ziel, now, label = 'bis Tippschluss' }: { ziel: string; now: number; label?: string }) {
  const r = rest(ziel, now)
  const teile: [number, string][] = r.tage > 0 ? [[r.tage, r.tage === 1 ? 'Tag' : 'Tage'], [r.std, 'Std'], [r.min, 'Min'], [r.sek, 'Sek']] : [[r.std, 'Std'], [r.min, 'Min'], [r.sek, 'Sek']]
  const knapp = r.gesamtMs < 3 * 3600_000
  return (
    <div className={`tp-countdown${knapp ? ' is-knapp' : ''}`} role="timer" aria-label={`Noch ${r.tage} Tage, ${r.std} Stunden, ${r.min} Minuten ${label}`}>
      <div className="tp-countdown__zahlen" aria-hidden="true">
        {teile.map(([n, l], i) => (
          <span key={l} className="tp-countdown__teil">
            <b>{String(n).padStart(2, '0')}</b>
            <small>{l}</small>
            {i < teile.length - 1 && <i>:</i>}
          </span>
        ))}
      </div>
      <p className="tp-countdown__label">{label}</p>
    </div>
  )
}

export function SpieltagKarte({ spiel, now, children, kicker }: { spiel: TippSpiel; now: number; children?: ReactNode; kicker?: string }) {
  const p = paarung(spiel)
  const live = spiel.status === 'live' || spiel.status === 'halbzeit'
  const hatStand = spiel.toreSva != null && spiel.toreGegner != null && spiel.status !== 'geplant'
  const toreHeim = spiel.heim ? spiel.toreSva : spiel.toreGegner
  const toreGast = spiel.heim ? spiel.toreGegner : spiel.toreSva
  const kopf = [kicker, spiel.wertung === 'winter' ? 'Winterwertung' : spiel.wettbewerb, spiel.spieltag ? `${spiel.spieltag}. Spieltag` : null]
    .filter(Boolean)
    .join(' · ')
  return (
    <section className="tp-hero" data-status={spiel.status} aria-label={`${p.heim} gegen ${p.gast}`}>
      {kopf && <p className="tp-kicker">{kopf}</p>}
      <div className="tp-teams">
        <div className="tp-team">
          <Wappen sva={spiel.heim} name={p.heim} />
          <b className="tp-team__name">{spiel.heim ? 'SV Agathenburg-Dollern' : p.heim}</b>
        </div>
        <div className="tp-teams__mitte">
          {hatStand ? (
            <span className="tp-stand" aria-live="polite">
              {toreHeim}
              <i>:</i>
              {toreGast}
            </span>
          ) : (
            <span className="tp-zeit">{uhrzeit(spiel.anstoss)}</span>
          )}
          {live && (
            <span className="tp-pill tp-pill--live">
              <i className="tp-puls" aria-hidden="true" /> {spiel.status === 'halbzeit' ? 'Halbzeit' : 'Live'}
            </span>
          )}
          {spiel.status === 'beendet' && <span className="tp-pill">Endstand</span>}
        </div>
        <div className="tp-team">
          <Wappen sva={!spiel.heim} name={p.gast} />
          <b className="tp-team__name">{!spiel.heim ? 'SV Agathenburg-Dollern' : p.gast}</b>
        </div>
      </div>
      <p className="tp-meta">
        {datumKurz(spiel.anstoss)} · {uhrzeit(spiel.anstoss)} Uhr · {spiel.heim ? 'Heimspiel' : 'Auswärts'}
      </p>
      {spiel.offen && <Countdown ziel={spiel.schluss} now={now} />}
      {children}
    </section>
  )
}
