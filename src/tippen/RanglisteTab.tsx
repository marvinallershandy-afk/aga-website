import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'
import { ladeDuell, ladeRangliste, TippFehler, type Duell, type Lage, type RangArt, type Rangliste, type RangEintrag } from './api'
import { haptik, monatName } from './model'
import { DuellBalken } from './LiveBlock'
import { Avatar, Kapitel, Zaehler } from './teile'

// ─────────────────────────────────────────────────────────────
// v20-T/v21: Ranglisten Spieltag · Monat · Saison (+ Winterwertung).
// v21: Podest für die Top 3, Zeilen mit Avatar, Trend und Abzeichen
// (Kabine-Konten dezent markiert), Punkte zählen hoch.
// Öffentlich stehen nur Konten, die ihren Namen zeigen (+ du selbst).
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
    let aktiv = true
    ladeDuell()
      .then((d) => aktiv && setDuell(d))
      .catch(() => {})
    return () => {
      aktiv = false
    }
  }, [])

  const r = daten[art]
  const titel =
    art === 'spieltag' && r?.spiel
      ? `${r.spiel.heim ? 'SVA – ' + r.spiel.gegner : r.spiel.gegner + ' – SVA'}${r.spiel.toreSva != null ? ` ${r.spiel.heim ? r.spiel.toreSva : r.spiel.toreGegner}:${r.spiel.heim ? r.spiel.toreGegner : r.spiel.toreSva}` : ''}`
      : art === 'monat' && r?.monat
        ? monatName(r.monat)
        : art === 'winter'
          ? `Winterwertung ${r?.saison ?? lage.saison}`
          : `Saison ${r?.saison ?? lage.saison}`
  const ichDrin = r?.eintraege.some((e) => e.ich)
  const podest = r && r.eintraege.length >= 3 && r.eintraege[2].platz <= 3 ? r.eintraege.slice(0, 3) : null
  const rest = r ? (podest ? r.eintraege.slice(3) : r.eintraege) : []

  return (
    <div className="tp-rangliste">
      <div className="tp-rangliste__haupt">
        <div className="tp-segment" role="tablist" aria-label="Wertung">
          {[...ARTEN, ...(zeigeWinter ? [{ id: 'winter' as RangArt, label: 'Winter' }] : [])].map((a) => (
            <button
              key={a.id}
              type="button"
              role="tab"
              aria-selected={art === a.id}
              onClick={() => {
                setArt(a.id)
                haptik(5)
              }}
            >
              {a.label}
              {art === a.id && <motion.i layoutId="tp-segment-mark" className="tp-segment__mark" transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }} />}
            </button>
          ))}
        </div>

        <div className="tp-rang-kopf">
          <p className="tp-kicker">{art === 'spieltag' ? 'Spieltags-Wertung' : art === 'monat' ? 'Monats-Wertung' : 'Gesamtwertung'}</p>
          <h1 className="tp-titel">{titel}</h1>
          {r && (
            <p className="tp-meta">
              {r.teilnehmer} Tipper
              {r.schnitt != null && ` · Ø ${r.schnitt.toLocaleString('de-DE')} Punkte`}
            </p>
          )}
        </div>

        {fehler && !r && <p className="tp-hinweis tp-hinweis--fehler">{fehler}</p>}
        {!r && !fehler && (
          <div className="tp-skelett">
            <div className="tp-skelett__zeile" />
            <div className="tp-skelett__zeile" />
          </div>
        )}
        {r && r.eintraege.length === 0 && (
          <p className="tp-leer tp-lead">
            {art === 'spieltag' ? 'Noch kein Spieltag gewertet. Die erste Auflösung kommt nach dem nächsten Spiel.' : 'Hier stehen bald die ersten Punkte.'}
          </p>
        )}

        {podest && <Podest e={podest} key={art} />}

        {r && rest.length > 0 && (
          <ol className="tp-rang" key={`l-${art}`}>
            {rest.map((e, i) => (
              <Zeile key={`${e.platz}-${e.name}`} e={e} i={i} trend={art !== 'spieltag'} />
            ))}
            {!ichDrin && r.ich && (
              <>
                <li className="tp-rang__luecke" aria-hidden="true">
                  ···
                </li>
                <Zeile e={r.ich} i={rest.length} trend={art !== 'spieltag'} />
              </>
            )}
          </ol>
        )}
        {!angemeldet && (
          <p className="tp-hilfe">
            Du willst hier stehen?{' '}
            <button type="button" className="tp-link" onClick={onAnmelden}>
              Mitmachen
            </button>
          </p>
        )}
        {angemeldet && lage.ich?.teilnehmer && !lage.ich.teilnehmer.sichtbar && (
          <p className="tp-hilfe">Du erscheinst öffentlich noch ohne Namen — nur du siehst dich hier. Ändern im Profil.</p>
        )}
      </div>

      {duell && <DuellKarte duell={duell} />}
    </div>
  )
}

function Podest({ e }: { e: RangEintrag[] }) {
  // Reihenfolge 2 · 1 · 3 (Platz 1 in der Mitte, höher)
  const ordnung = [e[1], e[0], e[2]]
  return (
    <ol className="tp-podest" aria-label="Top 3">
      {ordnung.map((x, i) => (
        <motion.li
          key={x.name}
          className={`tp-podest__platz is-p${x.platz}${x.ich ? ' is-ich' : ''}`}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: [0.15, 0, 0.3][i], ease: [0.22, 1, 0.36, 1] }}
        >
          <Avatar name={x.name} groesse={x.platz === 1 ? 64 : 52} kabine={x.kabine} ich={x.ich} />
          <b className="tp-podest__name">{x.name}</b>
          <span className="tp-podest__pkt">
            <Zaehler wert={x.punkte} dauer={0.9} />
          </span>
          <span className="tp-podest__sockel">
            <i>{x.platz}</i>
          </span>
        </motion.li>
      ))}
    </ol>
  )
}

function Zeile({ e, i, trend }: { e: RangEintrag; i: number; trend: boolean }) {
  return (
    <motion.li
      className={`tp-rang__zeile${e.ich ? ' is-ich' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: Math.min(i, 12) * 0.03, ease: [0.22, 1, 0.36, 1] }}
    >
      <span className="tp-rang__platz">{e.platz}</span>
      <Avatar name={e.name} groesse={36} kabine={e.kabine} ich={e.ich} />
      <span className="tp-rang__name">
        <b>{e.name}</b>
        <small>
          {e.spiele} {e.spiele === 1 ? 'Spieltag' : 'Spieltage'}
          {e.exakt > 0 && ` · ${e.exakt}× exakt`}
          {e.kabine && <span className="tp-tag tp-tag--kabine">Kabine</span>}
          {e.ich && <span className="tp-tag tp-tag--ich">Du</span>}
        </small>
      </span>
      {trend ? <Trend e={e} /> : <span />}
      <span className="tp-rang__pkt">{e.punkte}</span>
    </motion.li>
  )
}

function Trend({ e }: { e: RangEintrag }) {
  if (e.neu) return <span className="tp-pfeil is-neu">neu</span>
  if (e.trend == null) return <span className="tp-pfeil" aria-hidden="true" />
  if (e.trend > 0)
    return (
      <span className="tp-pfeil is-hoch tp-trend--hoch" aria-label={`${e.trend} Plätze hoch`}>
        <ArrowUp size={12} strokeWidth={2.5} aria-hidden="true" />
        {e.trend}
      </span>
    )
  if (e.trend < 0)
    return (
      <span className="tp-pfeil is-runter tp-trend--runter" aria-label={`${-e.trend} Plätze runter`}>
        <ArrowDown size={12} strokeWidth={2.5} aria-hidden="true" />
        {-e.trend}
      </span>
    )
  return (
    <span className="tp-pfeil" aria-label="unverändert">
      <Minus size={12} strokeWidth={2.5} aria-hidden="true" />
    </span>
  )
}

export function DuellKarte({ duell }: { duell: Duell }) {
  const [sicht, setSicht] = useState<'saison' | 'spieltag'>('saison')
  const d = sicht === 'saison' ? duell.saison : duell.spieltag
  if (!duell.saison.nKabine && !duell.spieltag?.nKabine) return null
  const f = d?.fans ?? 0
  const k = d?.kabine ?? 0
  const vorne = f === k ? 'Gleichstand' : f > k ? 'Die Fans liegen vorne' : 'Die Kabine liegt vorne'
  return (
    <section className="tp-duell" aria-labelledby="tp-h-duell">
      <Kapitel id="tp-h-duell" titel="Fans vs. Kabine">
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
      </Kapitel>
      <p className="tp-duell__vorne">{vorne}</p>
      <DuellBalken fans={f} kabine={k} />
      <p className="tp-meta">
        Ø Punkte pro Spieltag · {d?.nFans ?? 0} Fans, {d?.nKabine ?? 0} Spieler
        {duell.kabineBester && sicht === 'saison' ? ` · Bester aus der Kabine: ${duell.kabineBester.name}` : ''}
      </p>
    </section>
  )
}
