import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Lock, Share2, Snowflake } from 'lucide-react'
import { ladeDuell, ladeRangliste, ladeVerteilung, type Duell, type KaderSpieler, type Lage, type NaechstesSpiel, type Rangliste, type TippSpiel, type Verteilung } from './api'
import { ABZEICHEN, BONUS, bonusLabel, datumKurz, nachname, paarung, uhrzeit } from './model'
import { SpieltagKarte } from './SpieltagKarte'
import { TippFormular } from './TippFormular'
import { Aufloesung } from './Aufloesung'
import { ElfReihe } from './DeineElf'
import { SpielerGesicht } from './SpielerKarte'
import { DuellBalken, LiveBlock } from './LiveBlock'
import { Avatar, Kapitel, Medaille, Zaehler } from './teile'
import { bildPlatz, teilen } from './share'
import { zaehleEreignis } from '../statistik/zaehlen'
import type { Tab } from './TippApp'

// ─────────────────────────────────────────────────────────────
// v20-T/v21: Bereich „Spieltag“: läuft ein Spiel → Live (Scorebug,
// Hochrechnung, Ticker, Live-Rangliste) · offener Tipp · Auflösung des
// letzten Spieltags (Punkte zählen hoch, Spieltagssieger, Fans vs. Kabine,
// neue Abzeichen). Winterpause mit Saisonstand.
// ─────────────────────────────────────────────────────────────

/** v21-UX (Befund 10): Gibt es in der Spitze punktgleiche Tipper (unterschiedlicher Platz)? */
function gleichstandOben(eintraege: { punkte: number }[]): boolean {
  const top = eintraege.slice(0, 6)
  return top.some((e, i) => i > 0 && e.punkte === top[i - 1].punkte)
}

export function SpieltagTab({
  lage,
  kader,
  now,
  angemeldet,
  teilnehmer,
  onAnmelden,
  onNeu,
  onTab,
}: {
  lage: Lage
  kader: Map<string, KaderSpieler>
  now: number
  angemeldet: boolean
  teilnehmer: boolean
  onAnmelden: (g: 'tipp' | 'allgemein') => void
  onNeu: () => Promise<Lage | null>
  onTab: (t: Tab) => void
}) {
  const { offen, gesperrt, gewertet, einstellungen } = lage
  const winter = einstellungen.winterpause.aktiv && !offen
  // Auflösung oben, wenn sie frisch ist (≤ 4 Tage) und nichts läuft
  const frisch = gewertet && now - new Date(gewertet.anstoss).getTime() < 4 * 86400_000

  if (!einstellungen.aktiv) {
    return (
      <div className="tp-leer">
        <p className="tp-kicker">Pause</p>
        <h1 className="tp-titel">Die Tipp-Liga macht kurz Pause</h1>
        <p className="tp-lead">Rangliste und Ligen bleiben sichtbar. Weiter geht’s mit dem nächsten Spieltag.</p>
      </div>
    )
  }

  // v22-T: EIN Fokus pro Zeitpunkt. Live → nur das Live-Spiel. Nach Abpfiff bis
  // zur Wertung → „Wertung folgt“. Das nächste Spiel nur als dezente Vorschau,
  // bis der Server es freigibt (Wertung, spätestens 24 h nach Abpfiff).
  const live = !!gesperrt && (gesperrt.status === 'live' || gesperrt.status === 'halbzeit')
  const wartet = !!gesperrt && gesperrt.status === 'beendet'
  const vorschau: NaechstesSpiel | undefined = lage.naechstes ?? (live && offen ? { id: offen.id, gegner: offen.gegner, heim: offen.heim, anstoss: offen.anstoss, spieltag: offen.spieltag } : undefined)

  return (
    <div className={`tp-spieltag${live ? ' is-live' : ''}`}>
      {!angemeldet && !live && <Intro onAnmelden={() => onAnmelden('allgemein')} />}

      {gesperrt && <GesperrtBlock spiel={gesperrt} kader={kader} angemeldet={angemeldet} />}

      {(live || (wartet && !offen)) && vorschau && <Vorschau n={vorschau} live={live} />}

      {frisch && !gesperrt && gewertet && <AufloesungBlock spiel={gewertet} kader={kader} now={now} lage={lage} angemeldet={angemeldet} onTab={onTab} />}

      {offen && !live ? (
        <div className="tp-offen">
          <SpieltagKarte spiel={offen} now={now} kicker={gesperrt ? 'Nächster Spieltag' : frisch && gewertet ? 'Jetzt offen · nächster Spieltag' : undefined} kompakt={!!gesperrt}>
            <p className="tp-match__zahl">
              {offen.anzahlTipps > 0 ? (
                <>
                  <b>{offen.anzahlTipps}</b> {offen.anzahlTipps === 1 ? 'Fan hat' : 'Fans haben'} schon getippt
                </>
              ) : (
                'Sei der Erste, der tippt'
              )}
            </p>
          </SpieltagKarte>
          <TippFormular key={offen.id} spiel={offen} lage={lage} kader={kader} angemeldet={angemeldet} teilnehmer={teilnehmer} onAnmelden={onAnmelden} onNeu={onNeu} />
        </div>
      ) : winter && !gesperrt ? (
        <Winterpause bis={einstellungen.winterpause.bis} onTab={onTab} />
      ) : (
        !gesperrt &&
        !vorschau && (
          <div className="tp-leer">
            <p className="tp-kicker">Nächster Spieltag</p>
            <h2 className="tp-titel">Der Spielplan kommt gleich</h2>
            <p className="tp-lead">Sobald das nächste Pflichtspiel feststeht, kannst du hier tippen.</p>
          </div>
        )
      )}

      {gewertet && !gesperrt && !frisch && <AufloesungBlock spiel={gewertet} kader={kader} now={now} lage={lage} angemeldet={angemeldet} onTab={onTab} kompakt />}
    </div>
  )
}

/** v22-T: dezente Vorschau des nächsten Spieltags (noch nicht tippbar). */
function Vorschau({ n }: { n: NaechstesSpiel; live?: boolean }) {
  const ab = n.oeffnetAb ? new Date(n.oeffnetAb) : null
  const spaetestens = ab
    ? ab.toLocaleString('de-DE', { weekday: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' }).replace(',', '')
    : null
  return (
    <aside className="tp-vorschau-spiel" aria-label="Nächster Spieltag">
      <Lock className="tp-vorschau-spiel__icon" size={16} strokeWidth={1.75} aria-hidden="true" />
      <span className="tp-vorschau-spiel__text">
        <small>Nächster Spieltag{n.spieltag ? ` · ${n.spieltag}.` : ''} · {datumKurz(n.anstoss)} {uhrzeit(n.anstoss)}</small>
        <b>
          {n.heim ? 'gegen' : 'bei'} {n.gegner}
        </b>
        <span>
          öffnet nach der Auflösung
          {spaetestens ? ` · spätestens ${spaetestens} Uhr` : ''}
        </span>
      </span>
    </aside>
  )
}

function Intro({ onAnmelden }: { onAnmelden: () => void }) {
  return (
    <section className="tp-intro" aria-label="So funktioniert die Tipp-Liga">
      <p className="tp-kicker">Kostenlos · für alle Fans</p>
      <h1 className="tp-held">Tipp den Sonntag.</h1>
      <p className="tp-lead">
        Ergebnis, drei Bonusfragen, deine Elf — in 20 Sekunden. Punkte sammeln, mit Freunden eine eigene Liga gründen und die Kabine schlagen. Jeder Tipp
        bringt eine Karte fürs Album.
      </p>
      <div className="tp-zeile-knoepfe">
        <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => window.dispatchEvent(new Event('tp-einfuehrung'))}>
          So funktioniert’s
        </button>
        <button type="button" className="tp-btn tp-btn--text tp-btn--sm" onClick={onAnmelden}>
          Schon dabei? Anmelden <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

function GesperrtBlock({ spiel, kader, angemeldet }: { spiel: TippSpiel; kader: Map<string, KaderSpieler>; angemeldet: boolean }) {
  const [v, setV] = useState<Verteilung | null>(null)
  useEffect(() => {
    let aktiv = true
    ladeVerteilung(spiel.id)
      .then((x) => aktiv && setV(x))
      .catch(() => {})
    return () => {
      aktiv = false
    }
  }, [spiel.id])
  const t = spiel.meinTipp
  return (
    <div className="tp-gesperrt">
      {spiel.status === 'beendet' && !spiel.gewertetAt && (
        <div className="tp-wertungfolgt" role="status">
          <span className="tp-wertungfolgt__puls" aria-hidden="true" />
          <span>
            <b>Abpfiff · Wertung folgt</b>
            <small>Deine Punkte kommen mit dem Spielbericht — meist am selben Abend. Danach öffnet der nächste Spieltag.</small>
          </span>
        </div>
      )}
      <LiveBlock spiel={spiel} kader={kader} />
      {!spiel.live && (
        <section className="tp-abschnitt" aria-labelledby="tp-h-meintipp">
          <Kapitel id="tp-h-meintipp" titel="Dein Tipp" meta={spiel.status === 'beendet' ? 'Auflösung folgt nach dem Spielbericht' : 'gesperrt'} />
          {t ? (
            <div className="tp-meintipp">
              <span className="tp-meintipp__stand">
                {spiel.heim ? t.toreSva : t.toreGegner}:{spiel.heim ? t.toreGegner : t.toreSva}
                {t.joker && <span className="tp-chip is-an">Joker</span>}
              </span>
              <ul className="tp-meintipp__extras">
                {t.ersterTorschuetze && (
                  <li>
                    <SpielerGesicht spieler={kader.get(t.ersterTorschuetze)} groesse={32} /> Erster Torschütze: <b>{nachname(kader.get(t.ersterTorschuetze)?.name ?? '–')}</b>
                  </li>
                )}
                {spiel.fragen.map((f) => (
                  <li key={f.key}>
                    {BONUS[f.key].kurz}: <b>{bonusLabel(f.key, t.bonus?.[f.key])}</b>
                  </li>
                ))}
              </ul>
              {spiel.meineElf && <ElfReihe kader={kader} spieler={spiel.meineElf.spieler} kapitaen={spiel.meineElf.kapitaen} />}
            </div>
          ) : (
            <p className="tp-lead">{angemeldet ? 'Für dieses Spiel hast du nicht getippt.' : 'Melde dich an, um beim nächsten Spieltag mitzutippen.'}</p>
          )}
        </section>
      )}
      {v && v.n > 0 && <VerteilungBlock v={v} spiel={spiel} kader={kader} />}
    </div>
  )
}

function VerteilungBlock({ v, spiel, kader }: { v: Verteilung; spiel: TippSpiel; kader: Map<string, KaderSpieler> }) {
  const p = paarung(spiel)
  const kap = v.kapitaen ? kader.get(v.kapitaen.spieler) : undefined
  return (
    <section className="tp-abschnitt" aria-labelledby="tp-h-vert">
      <Kapitel id="tp-h-vert" titel="So hat Aga getippt" meta={`${v.n} Tipps`} />
      <div className="tp-tendenz" role="img" aria-label={`Sieg SVA ${v.tendenz.sieg} Prozent, Remis ${v.tendenz.remis} Prozent, Niederlage ${v.tendenz.niederlage} Prozent`}>
        {(
          [
            ['sieg', v.tendenz.sieg, 'Sieg'],
            ['remis', v.tendenz.remis, 'Remis'],
            ['nl', v.tendenz.niederlage, 'Niederl.'],
          ] as const
        ).map(([k, n, l], i) => (
          <motion.span
            key={k}
            style={{ flexGrow: Math.max(1, n) }}
            className={`tp-tendenz__${k}`}
            initial={{ opacity: 0, scaleX: 0.6 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ duration: 0.5, delay: 0.2 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
          >
            <b>{n}%</b> {l}
          </motion.span>
        ))}
      </div>
      <ul className="tp-top-tipps">
        {v.ergebnisse.slice(0, 3).map((e, i) => (
          <li key={`${e.toreSva}-${e.toreGegner}`}>
            <small>{i + 1}.</small>
            <b>{spiel.heim ? `${e.toreSva}:${e.toreGegner}` : `${e.toreGegner}:${e.toreSva}`}</b>
            <span>{e.anteil}%</span>
          </li>
        ))}
      </ul>
      {kap && v.kapitaen && (
        <p className="tp-hilfe">
          Beliebtester Kapitän: <b>{nachname(kap.name)}</b> ({v.kapitaen.anteil}%) · {v.joker} Joker gesetzt · {p.heim} – {p.gast}
        </p>
      )}
    </section>
  )
}

function AufloesungBlock({
  spiel,
  kader,
  now,
  lage,
  angemeldet,
  onTab,
  kompakt,
}: {
  spiel: TippSpiel
  kader: Map<string, KaderSpieler>
  now: number
  lage: Lage
  angemeldet: boolean
  onTab: (t: Tab) => void
  kompakt?: boolean
}) {
  const [rl, setRl] = useState<Rangliste | null>(null)
  const [duell, setDuell] = useState<Duell | null>(null)
  const [teilt, setTeilt] = useState(false)
  useEffect(() => {
    let aktiv = true
    ladeRangliste('spieltag', spiel.id)
      .then((x) => aktiv && setRl(x))
      .catch(() => {})
    if (!kompakt)
      ladeDuell()
        .then((d) => aktiv && setDuell(d))
        .catch(() => {})
    return () => {
      aktiv = false
    }
  }, [spiel.id, kompakt])
  const ich = rl?.ich
  // Abzeichen der letzten 2 Tage (seit dem Spiel)
  const neu = (lage.ich?.abzeichen ?? []).filter((a) => new Date(a.at).getTime() > new Date(spiel.anstoss).getTime())
  const teilenPlatz = async () => {
    if (!ich || !rl) return
    setTeilt(true)
    try {
      const c = await bildPlatz({
        platz: ich.platz,
        teilnehmer: rl.teilnehmer,
        punkte: ich.punkte,
        art: 'spieltag',
        bereich: `${spiel.heim ? 'SVA – ' + spiel.gegner : spiel.gegner + ' – SVA'}`,
        name: lage.ich?.profil?.anzeigename,
        partner: lage.einstellungen.partner,
      })
      if ((await teilen(c, 'sva-tipp-platz.png', 'Mein Platz · SVA Tipp-Liga')) !== 'fehler') zaehleEreignis('tipp-teilen')
    } finally {
      setTeilt(false)
    }
  }
  const sieger = rl?.eintraege.filter((e) => e.platz === 1) ?? []
  return (
    <div className={`tp-auflblock${kompakt ? ' is-kompakt' : ''}`}>
      <SpieltagKarte spiel={spiel} now={now} kicker={kompakt ? `Letzter Spieltag · ${datumKurz(spiel.anstoss)}` : 'Auflösung'} kompakt={kompakt} />
      {spiel.meinePunkte ? (
        <Aufloesung spiel={spiel} kader={kader} platz={ich ? { platz: ich.platz, von: rl!.teilnehmer } : undefined} kompakt={kompakt} />
      ) : (
        <p className="tp-lead tp-auflblock__leer">{angemeldet ? 'Bei diesem Spieltag warst du nicht dabei.' : 'Melde dich an und tipp beim nächsten Spieltag mit.'}</p>
      )}

      {!kompakt && neu.length > 0 && (
        <section className="tp-abschnitt tp-neuabz" aria-labelledby="tp-h-neuabz">
          <Kapitel id="tp-h-neuabz" titel="Neu freigeschaltet" meta={`${neu.length} Abzeichen`} />
          <ul className="tp-neuabz__liste">
            {neu.map((n, i) => {
              const a = ABZEICHEN.find((x) => x.key === n.key)
              if (!a) return null
              return (
                <motion.li
                  key={n.key}
                  initial={{ opacity: 0, scale: 0.6, rotateY: 90 }}
                  whileInView={{ opacity: 1, scale: 1, rotateY: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.7, delay: 0.2 + i * 0.25, ease: [0.22, 1, 0.36, 1] }}
                >
                  <span className="tp-medaille-buehne">
                    <Medaille a={a} da groesse={84} />
                    <i className="tp-glanz" aria-hidden="true" />
                  </span>
                  <b>{a.titel}</b>
                  <small>{a.text}</small>
                </motion.li>
              )
            })}
          </ul>
        </section>
      )}

      {rl && rl.eintraege.length > 0 && (
        <section className="tp-abschnitt" aria-label="Spieltags-Sieger">
          <Kapitel titel={spiel.motm || !kompakt ? 'Spieltagssieger' : 'Spieltag-Top 3'} meta={`Ø ${rl.schnitt?.toLocaleString('de-DE') ?? '–'} Punkte · ${rl.teilnehmer} Tipper`} />
          {!kompakt && sieger.length > 0 && (
            <div className="tp-sieger">
              {sieger.slice(0, 2).map((s) => (
                <motion.div key={s.name} className={`tp-sieger__karte${s.ich ? ' is-ich' : ''}`} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}>
                  <span className="tp-sieger__pokal" aria-hidden="true">
                    <Medaille a={ABZEICHEN.find((a) => a.key === 'spieltagssieger')!} da groesse={56} />
                  </span>
                  <Avatar name={s.name} groesse={52} kabine={s.kabine} ich={s.ich} />
                  <span className="tp-sieger__name">
                    <small>{s.ich ? 'Das bist du!' : 'Tipp-Sieger'}</small>
                    <b>{s.name}</b>
                  </span>
                  <b className="tp-sieger__pkt">
                    <Zaehler wert={s.punkte} dauer={1.1} />
                    <small>Pkt.</small>
                  </b>
                </motion.div>
              ))}
            </div>
          )}
          <ol className="tp-rang tp-rang--mini">
            {rl.eintraege.slice(kompakt ? 0 : sieger.length > 0 ? sieger.length : 0, kompakt ? 3 : 5).map((e) => (
              <li key={`${e.platz}-${e.name}`} className={`tp-rang__zeile${e.ich ? ' is-ich' : ''}`}>
                <span className="tp-rang__platz">{e.platz}</span>
                <Avatar name={e.name} groesse={32} kabine={e.kabine} ich={e.ich} />
                <span className="tp-rang__name">
                  <b>{e.name}</b>
                  <small>{e.kabine && <span className="tp-tag tp-tag--kabine">Kabine</span>}</small>
                </span>
                <b className="tp-rang__pkt">{e.punkte}</b>
              </li>
            ))}
          </ol>
          {/* v21-UX (Befund 10): Tiebreak am Ort des Geschehens erklären */}
          {gleichstandOben(rl.eintraege) && <p className="tp-fussnote">Bei Punktgleichheit liegt vorne, wer mehr Ergebnisse exakt getippt hat.</p>}
          <div className="tp-zeile-knoepfe">
            <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => onTab('rangliste')}>
              Ganze Rangliste <ArrowRight size={16} strokeWidth={1.5} aria-hidden="true" />
            </button>
            {ich && (
              <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => void teilenPlatz()} disabled={teilt}>
                <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Platz {ich.platz} teilen
              </button>
            )}
          </div>
        </section>
      )}

      {!kompakt && duell?.spieltag && duell.spieltag.spielId === spiel.id && duell.spieltag.nKabine > 0 && (
        <section className="tp-abschnitt" aria-labelledby="tp-h-fvk">
          <Kapitel
            id="tp-h-fvk"
            titel="Fans vs. Kabine"
            meta={(duell.spieltag.fans ?? 0) === (duell.spieltag.kabine ?? 0) ? 'Gleichstand' : (duell.spieltag.fans ?? 0) > (duell.spieltag.kabine ?? 0) ? 'Die Fans gewinnen den Spieltag' : 'Die Kabine gewinnt den Spieltag'}
          />
          <DuellBalken fans={duell.spieltag.fans ?? 0} kabine={duell.spieltag.kabine ?? 0} />
        </section>
      )}
    </div>
  )
}

function Winterpause({ bis, onTab }: { bis: string; onTab: (t: Tab) => void }) {
  const d = new Date(`${bis}T12:00:00`)
  const datum = d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' })
  return (
    <section className="tp-winter" aria-labelledby="tp-h-winter">
      <Snowflake size={28} strokeWidth={1.5} aria-hidden="true" />
      <p className="tp-kicker">Winterpause</p>
      <h1 className="tp-held" id="tp-h-winter">
        Weiter am {datum}
      </h1>
      <p className="tp-lead">Die Rückrunde kommt. Bis dahin: Saisonstand checken, Liga gründen, Kumpels einladen.</p>
      <button type="button" className="tp-btn" onClick={() => onTab('rangliste')}>
        Zum Saisonstand <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </section>
  )
}
