import { useMemo, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { ArrowDown, ArrowUp, Radio, Repeat2 } from 'lucide-react'
import type { KaderSpieler, LiveEreignis, LiveHochrechnung, RangEintrag, TippSpiel } from './api'
import { BONUS, bonusLabel, nachname } from './model'
import { bonusStand, hochrechnen } from './punkte'
import { SpieltagKarte } from './SpieltagKarte'
import { ElfReihe } from './DeineElf'
import { Avatar, Kapitel, Zaehler } from './teile'

// ─────────────────────────────────────────────────────────────
// v21-T: „Live“ während des Spiels — TV-Scorebug mit Minute, „TOR!“-
// Einblendung, deine Punkte als Live-Hochrechnung (zählen mit jedem
// Ereignis hoch/runter), Ereignis-Ticker, Live-Rangliste mit Auf/Ab
// (Zeilen gleiten an ihren neuen Platz) und Fans vs. Kabine live.
// Echte Spiele: Hochrechnung aus dem Spielstand (Ergebnis-Teil); die volle
// Live-Rangliste zeigt die Vorführung (Daten: Simulation).
// ─────────────────────────────────────────────────────────────

function minuteText(m: number, nach?: number) {
  return `${m}${nach ? `+${nach}` : ''}′`
}

export function LiveBlock({ spiel, kader }: { spiel: TippSpiel; kader: Map<string, KaderSpieler> }) {
  const live = spiel.live
  const s0 = spiel.toreSva ?? 0
  const s1 = spiel.toreGegner ?? 0
  const ende = spiel.status === 'beendet'
  // Echtbetrieb ohne Ereignisse: Hochrechnung nur aus dem Spielstand
  const ich: LiveHochrechnung | undefined = useMemo(
    () =>
      live?.ich ??
      (spiel.meinTipp
        ? hochrechnen({ spiel, tipp: spiel.meinTipp, stand: [s0, s1], ereignisse: [], minute: 0, ende, startelf: [], position: (id) => kader.get(id)?.position ?? 'MIT' })
        : undefined),
    [live?.ich, spiel, s0, s1, ende, kader],
  )
  const minute = live ? minuteText(live.minute, live.nachspielzeit) : undefined

  // v22-T: die TOR!-Einblendung kommt jetzt über allem aus TippApp
  // (src/ui/tor/TorJubel — gemeinsam mit /live), nicht mehr hier im Kasten.

  const elfPunkte = useMemo(() => new Map((ich?.elfSpieler ?? []).map((e) => [e.id, e.p])), [ich])

  return (
    <div className="tp-live">
      <div className="tp-live__buehne">
        <SpieltagKarte spiel={spiel} now={0} minute={minute} kicker={ende ? 'Abpfiff' : undefined}>
          {!live && (
            <a className="tp-btn tp-btn--line tp-btn--sm tp-match__live" href="/live">
              <Radio size={16} strokeWidth={1.5} aria-hidden="true" /> Zum Liveticker
            </a>
          )}
        </SpieltagKarte>
      </div>

      {ich && (
        <section className="tp-abschnitt tp-livepunkte" aria-labelledby="tp-h-livep">
          <Kapitel id="tp-h-livep" titel={ende ? 'Deine Punkte · vorläufig' : 'Deine Punkte · live'} meta={ende ? 'vorläufig bis zum Spielbericht' : 'Hochrechnung, Stand jetzt'} />
          <div className="tp-livepunkte__kopf">
            <b className="tp-livepunkte__zahl" aria-live="polite">
              <Zaehler wert={ich.gesamt} dauer={0.9} start={false} />
            </b>
            <dl className="tp-livepunkte__teile">
              <div>
                <dt>Tipp</dt>
                <dd>
                  <Zaehler wert={ich.tipp} start={false} />
                </dd>
              </div>
              <div>
                <dt>Elf</dt>
                <dd>
                  <Zaehler wert={ich.elf} start={false} />
                </dd>
              </div>
              {spiel.meinTipp?.joker && (
                <div className="is-joker">
                  <dt>Joker</dt>
                  <dd>×2</dd>
                </div>
              )}
            </dl>
          </div>
          <ul className="tp-livepunkte__liste">
            {ich.teile
              .filter((t) => t.k !== 'joker')
              .map((t) => (
                <li key={t.k} className={t.p > 0 ? 'is-plus' : ''}>
                  <span>{t.label}</span>
                  {t.offen && <small>läuft</small>}
                  <b>{t.p > 0 ? `+${t.p}` : t.p}</b>
                </li>
              ))}
          </ul>
          {live && spiel.fragen.length > 0 && <BonusLive spiel={spiel} ereignisse={live.ereignisse} minute={live.minute + (live.nachspielzeit ?? 0)} ende={ende} />}
          {spiel.meineElf && <ElfReihe kader={kader} spieler={spiel.meineElf.spieler} kapitaen={spiel.meineElf.kapitaen} punkte={live ? elfPunkte : undefined} />}
        </section>
      )}

      {live && live.ereignisse.length > 0 && <Ticker ereignisse={live.ereignisse} kader={kader} />}

      {live?.rangliste && <LiveRangliste eintraege={live.rangliste} />}

      {live?.duell && (
        <section className="tp-abschnitt" aria-labelledby="tp-h-liveduell">
          <Kapitel id="tp-h-liveduell" titel="Fans vs. Kabine · live" meta="Ø Punkte in diesem Spiel" />
          <DuellBalken fans={live.duell.fans} kabine={live.duell.kabine} />
        </section>
      )}
    </div>
  )
}

function BonusLive({ spiel, ereignisse, minute, ende }: { spiel: TippSpiel; ereignisse: LiveEreignis[]; minute: number; ende: boolean }) {
  const b = bonusStand(ereignisse, minute, ende)
  const offen = !ende && spiel.fragen.some((f) => !b[f.key]?.fest)
  return (
    <>
      <ul className="tp-bonuslive">
        {spiel.fragen.map((f) => {
          const s = b[f.key]
          const mein = spiel.meinTipp?.bonus?.[f.key]
          const richtig = !!s && mein === s.wert
          return (
            <li key={f.key} className={`${richtig ? 'is-richtig' : 'is-falsch'}${s?.fest ? ' is-fest' : ''}`}>
              <span>{BONUS[f.key].kurz}</span>
              <small>
                Du: {bonusLabel(f.key, mein)} · jetzt: {s ? bonusLabel(f.key, s.wert) : '–'}
              </small>
              <i>{s?.fest ? (richtig ? '+1' : '0') : richtig ? '+1?' : '0?'}</i>
            </li>
          )
        })}
      </ul>
      {/* v21-UX (Befund 7): Mikro-Legende für die „?“-Punkte */}
      {offen && <p className="tp-bonuslive__legende">? = läuft noch, zählt erst bei Abpfiff</p>}
    </>
  )
}

const EREIGNIS_TEXT: Record<LiveEreignis['typ'], string> = {
  anpfiff: 'Anpfiff',
  tor: 'Tor',
  gegentor: 'Gegentor',
  gelb: 'Gelbe Karte',
  gelbrot: 'Gelb-Rot',
  rot: 'Rote Karte',
  wechsel: 'Wechsel',
  halbzeit: 'Halbzeit',
  wiederanpfiff: 'Wiederanpfiff',
  abpfiff: 'Abpfiff',
  elfmeter: 'Elfmeter',
}

function Ticker({ ereignisse, kader }: { ereignisse: LiveEreignis[]; kader: Map<string, KaderSpieler> }) {
  const n = (id?: string) => (id ? nachname(kader.get(id)?.name ?? '') : '')
  const liste = [...ereignisse].reverse()
  return (
    <section className="tp-abschnitt" aria-labelledby="tp-h-ticker">
      <Kapitel id="tp-h-ticker" titel="Ticker" meta={`${ereignisse.filter((e) => e.typ === 'tor' || e.typ === 'gegentor').length} Tore`} />
      <ol className="tp-ticker">
        <AnimatePresence initial={false}>
          {liste.map((e) => (
            <motion.li
              key={`${e.minute}-${e.typ}-${e.spieler ?? ''}`}
              className={`tp-ticker__zeile is-${e.typ}`}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <b className="tp-ticker__min">{e.typ === 'abpfiff' ? '90+' : `${e.minute}′`}</b>
              <i className="tp-ticker__icon" aria-hidden="true">
                {e.typ === 'wechsel' ? <Repeat2 size={14} strokeWidth={2} /> : null}
              </i>
              <span className="tp-ticker__text">
                <b>
                  {EREIGNIS_TEXT[e.typ]}
                  {e.stand ? ` · ${e.stand[0]}:${e.stand[1]}` : ''}
                </b>
                <small>
                  {e.typ === 'wechsel'
                    ? `${n(e.spieler)} kommt für ${n(e.spieler2)}`
                    : [n(e.spieler), e.spieler2 && e.typ === 'tor' ? `Vorlage ${n(e.spieler2)}` : '', e.text].filter(Boolean).join(' · ')}
                </small>
              </span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
    </section>
  )
}

export function LiveRangliste({ eintraege, titel = 'Live-Rangliste', meta = 'Spieltag · Hochrechnung' }: { eintraege: RangEintrag[]; titel?: string; meta?: string }) {
  const [alle, setAlle] = useState(false)
  const ichIndex = eintraege.findIndex((e) => e.ich)
  const sicht = alle ? eintraege : eintraege.filter((e, i) => i < 8 || e.ich)
  return (
    <section className="tp-abschnitt" aria-labelledby="tp-h-liverang">
      <Kapitel id="tp-h-liverang" titel={titel} meta={meta} />
      <LayoutGroup>
        <ol className="tp-rang tp-rang--live">
          {sicht.map((e) => (
            <motion.li
              layout="position"
              key={e.name}
              className={`tp-rang__zeile${e.ich ? ' is-ich' : ''}${e.platz <= 3 ? ` is-p${e.platz}` : ''}`}
              transition={{ layout: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } }}
            >
              <span className="tp-rang__platz">{e.platz}</span>
              <Avatar name={e.name} groesse={34} kabine={e.kabine} ich={e.ich} />
              <span className="tp-rang__name">
                <b>{e.name}</b>
                <small>
                  {e.kabine && <span className="tp-tag tp-tag--kabine">Kabine</span>}
                  {e.ich && <span className="tp-tag tp-tag--ich">Du</span>}
                </small>
              </span>
              <Pfeil t={e.trend} />
              <b className="tp-rang__pkt">
                <Zaehler wert={e.punkte} start={false} />
              </b>
            </motion.li>
          ))}
        </ol>
      </LayoutGroup>
      {eintraege.length > 9 && (
        <button type="button" className="tp-link" onClick={() => setAlle((x) => !x)}>
          {alle ? 'Weniger zeigen' : `Alle ${eintraege.length} zeigen${ichIndex >= 8 ? '' : ''}`}
        </button>
      )}
    </section>
  )
}

function Pfeil({ t }: { t?: number }) {
  if (!t) return <span className="tp-pfeil" aria-hidden="true" />
  return (
    <motion.span
      key={t}
      className={`tp-pfeil ${t > 0 ? 'is-hoch' : 'is-runter'}`}
      initial={{ opacity: 0, y: t > 0 ? 6 : -6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      aria-label={t > 0 ? `${t} hoch` : `${-t} runter`}
    >
      {t > 0 ? <ArrowUp size={12} strokeWidth={2.5} /> : <ArrowDown size={12} strokeWidth={2.5} />}
      {Math.abs(t)}
    </motion.span>
  )
}

export function DuellBalken({ fans, kabine }: { fans: number; kabine: number }) {
  const ges = Math.max(0.01, fans + kabine)
  const fmt = (n: number) => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (
    <div className="tp-duellbalken">
      <div className="tp-duellbalken__zahlen">
        <span>
          <b>{fmt(fans)}</b>
          <small>Fans</small>
        </span>
        <span className="is-kabine">
          <b>{fmt(kabine)}</b>
          <small>Kabine</small>
        </span>
      </div>
      <div className="tp-duellbalken__balken" aria-hidden="true">
        <motion.i className="is-fans" animate={{ scaleX: fans / ges }} initial={false} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
        <motion.i className="is-kabine" animate={{ scaleX: kabine / ges }} initial={false} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} />
      </div>
    </div>
  )
}
