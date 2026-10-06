import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { ladeDuell, ladeRangliste, TippFehler, type Duell, type Lage, type RangArt, type Rangliste, type RangEintrag } from './api'
import { monatName } from './model'

// ─────────────────────────────────────────────────────────────
// v20-T: Ranglisten Spieltag · Monat · Saison (+ Winterwertung) mit
// Auf-/Ab-Pfeilen und dem Duell „Fans vs. Kabine“.
// Öffentlich stehen nur Fans, die ihren Namen zeigen wollen (+ du selbst).
// ─────────────────────────────────────────────────────────────

const ARTEN: { id: RangArt; label: string }[] = [
  { id: 'spieltag', label: 'Spieltag' },
  { id: 'monat', label: 'Monat' },
  { id: 'saison', label: 'Saison' },
]

export function RanglisteTab({ lage, angemeldet, onAnmelden }: { lage: Lage; angemeldet: boolean; onAnmelden: () => void }) {
  const [art, setArt] = useState<RangArt>('saison')
  const [daten, setDaten] = useState<Record<string, Rangliste>>({})
  const [fehler, setFehler] = useState('')
  const [duell, setDuell] = useState<Duell | null>(null)
  const zeigeWinter = lage.einstellungen.winterpause.aktiv

  useEffect(() => {
    let aktiv = true
    ladeRangliste(art)
      .then((r) => aktiv && setDaten((d) => ({ ...d, [art]: r })))
      .catch((e) => aktiv && setFehler(e instanceof TippFehler ? e.message : 'Rangliste nicht erreichbar.'))
    return () => {
      aktiv = false
    }
  }, [art])
  useEffect(() => {
    ladeDuell()
      .then(setDuell)
      .catch(() => {})
  }, [])

  const r = daten[art]
  const titel =
    art === 'spieltag' && r?.spiel
      ? `${r.spiel.heim ? 'vs' : 'bei'} ${r.spiel.gegner}`
      : art === 'monat' && r?.monat
        ? monatName(r.monat)
        : art === 'winter'
          ? `Winterwertung ${r?.saison ?? lage.saison}`
          : `Saison ${r?.saison ?? lage.saison}`
  const ichDrin = r?.eintraege.some((e) => e.ich)

  return (
    <div className="tp-rangliste">
      {duell && <DuellKarte duell={duell} />}

      <div className="tp-segment" role="tablist" aria-label="Wertung">
        {[...ARTEN, ...(zeigeWinter ? [{ id: 'winter' as RangArt, label: 'Winter' }] : [])].map((a) => (
          <button key={a.id} type="button" role="tab" aria-selected={art === a.id} onClick={() => setArt(a.id)}>
            {a.label}
            {art === a.id && <motion.i layoutId="tp-segment-mark" className="tp-segment__mark" transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }} />}
          </button>
        ))}
      </div>

      <div className="tp-rang-kopf">
        <h1 className="tp-h2">{titel}</h1>
        {r && (
          <p className="tp-meta">
            {r.teilnehmer} {r.teilnehmer === 1 ? 'Tipper' : 'Tipper'}
            {r.schnitt != null && ` · Ø ${r.schnitt.toLocaleString('de-DE')} Punkte`}
          </p>
        )}
      </div>

      {fehler && !r && <p className="tp-hinweis tp-hinweis--fehler">{fehler}</p>}
      {!r && !fehler && <div className="tp-skelett__zeile" />}
      {r && r.eintraege.length === 0 && (
        <p className="tp-panel tp-lead">
          {art === 'spieltag' ? 'Noch kein Spieltag gewertet. Die erste Auflösung kommt nach dem nächsten Spiel.' : 'Hier stehen bald die ersten Punkte.'}
        </p>
      )}
      {r && r.eintraege.length > 0 && (
        <ol className="tp-rang">
          {r.eintraege.map((e, i) => (
            <Zeile key={`${e.platz}-${e.name}`} e={e} i={i} trend={art !== 'spieltag'} />
          ))}
          {!ichDrin && r.ich && (
            <>
              <li className="tp-rang__luecke" aria-hidden="true">
                …
              </li>
              <Zeile e={r.ich} i={r.eintraege.length} trend={art !== 'spieltag'} />
            </>
          )}
        </ol>
      )}
      {!angemeldet && (
        <p className="tp-block__hilfe">
          Du willst hier stehen?{' '}
          <button type="button" className="tp-link" onClick={onAnmelden}>
            Mitmachen
          </button>
        </p>
      )}
      {angemeldet && lage.ich?.teilnehmer && !lage.ich.teilnehmer.sichtbar && (
        <p className="tp-block__hilfe">Du erscheinst öffentlich noch ohne Namen — nur du siehst dich hier. Ändern im Profil.</p>
      )}
    </div>
  )
}

function Zeile({ e, i, trend }: { e: RangEintrag; i: number; trend: boolean }) {
  return (
    <motion.li
      className={`tp-rang__zeile${e.ich ? ' is-ich' : ''}${e.platz <= 3 ? ` is-top is-p${e.platz}` : ''}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(i, 12) * 0.025, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="tp-rang__platz">{e.platz}</span>
      {trend && <Trend e={e} />}
      <span className="tp-rang__name">
        <b>{e.name}</b>
        <small>
          {e.spiele} {e.spiele === 1 ? 'Spieltag' : 'Spieltage'}
          {e.exakt > 0 && ` · ${e.exakt}× exakt`}
          {e.kabine && <span className="tp-tag">Kabine</span>}
          {e.ich && <span className="tp-tag tp-tag--ich">Du</span>}
        </small>
      </span>
      <span className="tp-rang__pkt">{e.punkte}</span>
    </motion.li>
  )
}

function Trend({ e }: { e: RangEintrag }) {
  if (e.neu) return <span className="tp-trend tp-trend--neu">neu</span>
  if (e.trend == null) return <span className="tp-trend" aria-hidden="true" />
  if (e.trend > 0)
    return (
      <span className="tp-trend tp-trend--hoch" aria-label={`${e.trend} Plätze hoch`}>
        <ArrowUp size={14} strokeWidth={2} aria-hidden="true" />
        {e.trend}
      </span>
    )
  if (e.trend < 0)
    return (
      <span className="tp-trend tp-trend--runter" aria-label={`${-e.trend} Plätze runter`}>
        <ArrowDown size={14} strokeWidth={2} aria-hidden="true" />
        {-e.trend}
      </span>
    )
  return (
    <span className="tp-trend" aria-label="unverändert">
      <Minus size={14} strokeWidth={2} aria-hidden="true" />
    </span>
  )
}

export function DuellKarte({ duell }: { duell: Duell }) {
  const [sicht, setSicht] = useState<'saison' | 'spieltag'>('saison')
  const d = sicht === 'saison' ? duell.saison : duell.spieltag
  if (!duell.saison.nKabine && !duell.spieltag?.nKabine) return null
  const f = d?.fans ?? 0
  const k = d?.kabine ?? 0
  const ges = Math.max(0.01, f + k)
  const vorne = f === k ? 'Gleichstand' : f > k ? 'Die Fans liegen vorne' : 'Die Kabine liegt vorne'
  return (
    <section className="tp-duell" aria-labelledby="tp-h-duell">
      <div className="tp-duell__kopf">
        <p className="tp-kicker" id="tp-h-duell">
          Fans vs. Kabine
        </p>
        <div className="tp-mini-seg">
          <button type="button" aria-pressed={sicht === 'saison'} onClick={() => setSicht('saison')}>
            Saison
          </button>
          {duell.spieltag && (
            <button type="button" aria-pressed={sicht === 'spieltag'} onClick={() => setSicht('spieltag')}>
              Spieltag
            </button>
          )}
        </div>
      </div>
      <h2 className="tp-h3">{vorne}</h2>
      <div className="tp-duell__zahlen">
        <span>
          <b>{f.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
          <small>Fans · {d?.nFans ?? 0}</small>
        </span>
        <span className="tp-duell__k">
          <b>{k.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</b>
          <small>Kabine · {d?.nKabine ?? 0}</small>
        </span>
      </div>
      <div className="tp-duell__balken" aria-hidden="true">
        <motion.i className="tp-duell__f" initial={{ width: '50%' }} animate={{ width: `${(f / ges) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        <motion.i className="tp-duell__kb" initial={{ width: '50%' }} animate={{ width: `${(k / ges) * 100}%` }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
      <p className="tp-meta">Ø Punkte pro Spieltag{duell.kabineBester && sicht === 'saison' ? ` · Bester aus der Kabine: ${duell.kabineBester.name}` : ''}</p>
    </section>
  )
}
