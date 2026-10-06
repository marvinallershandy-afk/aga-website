import { useEffect, useState } from 'react'
import { ArrowRight, Radio, Share2, Snowflake } from 'lucide-react'
import { ladeRangliste, ladeVerteilung, type KaderSpieler, type Lage, type Rangliste, type TippSpiel, type Verteilung } from './api'
import { bonusLabel, BONUS, datumKurz, nachname, paarung } from './model'
import { SpieltagKarte } from './SpieltagKarte'
import { TippFormular } from './TippFormular'
import { Aufloesung } from './Aufloesung'
import { ElfReihe } from './DeineElf'
import { SpielerGesicht } from './SpielerKarte'
import { bildPlatz, teilen } from './share'
import { zaehleEreignis } from '../statistik/zaehlen'
import type { Tab } from './TippApp'

// ─────────────────────────────────────────────────────────────
// v20-T: Bereich „Spieltag“: laufendes Spiel (gesperrt) → offener Tipp →
// Auflösung des letzten Spieltags. Winterpause mit Saisonstand.
// ─────────────────────────────────────────────────────────────

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
      <div className="tp-panel tp-leer">
        <p className="tp-kicker">Pause</p>
        <h1 className="tp-h2">Die Tipp-Liga macht kurz Pause</h1>
        <p className="tp-lead">Rangliste und Ligen bleiben sichtbar. Weiter geht’s mit dem nächsten Spieltag.</p>
      </div>
    )
  }

  return (
    <div className="tp-spieltag">
      {!angemeldet && <Intro onAnmelden={() => onAnmelden('allgemein')} />}

      {gesperrt && <GesperrtBlock spiel={gesperrt} kader={kader} now={now} angemeldet={angemeldet} />}

      {frisch && !gesperrt && gewertet && <AufloesungBlock spiel={gewertet} kader={kader} now={now} lage={lage} angemeldet={angemeldet} onTab={onTab} />}

      {offen ? (
        <div className="tp-offen">
          <SpieltagKarte spiel={offen} now={now} kicker={gesperrt ? 'Nächster Spieltag' : undefined}>
            <p className="tp-hero__zahl">
              {offen.anzahlTipps > 0 ? `${offen.anzahlTipps} ${offen.anzahlTipps === 1 ? 'Fan hat' : 'Fans haben'} schon getippt` : 'Sei der Erste, der tippt'}
            </p>
          </SpieltagKarte>
          <TippFormular key={offen.id} spiel={offen} lage={lage} kader={kader} angemeldet={angemeldet} teilnehmer={teilnehmer} onAnmelden={onAnmelden} onNeu={onNeu} />
        </div>
      ) : winter ? (
        <Winterpause bis={einstellungen.winterpause.bis} onTab={onTab} />
      ) : (
        !gesperrt && (
          <div className="tp-panel tp-leer">
            <p className="tp-kicker">Nächster Spieltag</p>
            <h2 className="tp-h2">Der Spielplan kommt gleich</h2>
            <p className="tp-lead">Sobald das nächste Pflichtspiel feststeht, kannst du hier tippen.</p>
          </div>
        )
      )}

      {gewertet && (!frisch || gesperrt) && <AufloesungBlock spiel={gewertet} kader={kader} now={now} lage={lage} angemeldet={angemeldet} onTab={onTab} kompakt />}
    </div>
  )
}

function Intro({ onAnmelden }: { onAnmelden: () => void }) {
  return (
    <section className="tp-intro" aria-label="So funktioniert die Tipp-Liga">
      <p className="tp-kicker">Kostenlos · für alle Fans</p>
      <h1 className="tp-h1">Tipp den Sonntag.</h1>
      <p className="tp-lead">
        Ergebnis tippen, drei Bonusfragen, deine Elf aufstellen — in 20 Sekunden. Punkte sammeln, mit Freunden eine eigene Liga gründen und die Kabine
        schlagen. Jeder Tipp bringt eine Karte fürs Album.
      </p>
      <button type="button" className="tp-link" onClick={onAnmelden}>
        Schon dabei? Anmelden <ArrowRight size={14} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </section>
  )
}

function GesperrtBlock({ spiel, kader, now, angemeldet }: { spiel: TippSpiel; kader: Map<string, KaderSpieler>; now: number; angemeldet: boolean }) {
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
  const live = spiel.status === 'live' || spiel.status === 'halbzeit'
  const t = spiel.meinTipp
  return (
    <div className="tp-gesperrt">
      <SpieltagKarte spiel={spiel} now={now} kicker={live ? 'Läuft gerade' : spiel.status === 'beendet' ? 'Auflösung folgt nach dem Spielbericht' : 'Tippschluss'}>
        <a className="tp-btn tp-btn--line tp-btn--sm tp-hero__live" href="/live">
          <Radio size={16} strokeWidth={1.5} aria-hidden="true" /> {live ? 'Zum Liveticker' : 'Spieltag auf /live'}
        </a>
      </SpieltagKarte>
      <section className="tp-block" aria-labelledby="tp-h-meintipp">
        <div className="tp-block__kopf">
          <h2 className="tp-h3" id="tp-h-meintipp">
            Dein Tipp
          </h2>
          <span className="tp-block__punkte">gesperrt</span>
        </div>
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
      {v && v.n > 0 && <VerteilungBlock v={v} spiel={spiel} kader={kader} />}
    </div>
  )
}

function VerteilungBlock({ v, spiel, kader }: { v: Verteilung; spiel: TippSpiel; kader: Map<string, KaderSpieler> }) {
  const p = paarung(spiel)
  const kap = v.kapitaen ? kader.get(v.kapitaen.spieler) : undefined
  return (
    <section className="tp-block" aria-labelledby="tp-h-vert">
      <div className="tp-block__kopf">
        <h2 className="tp-h3" id="tp-h-vert">
          So hat Aga getippt
        </h2>
        <span className="tp-block__punkte">{v.n} Tipps</span>
      </div>
      <div className="tp-tendenz" role="img" aria-label={`Sieg SVA ${v.tendenz.sieg} Prozent, Remis ${v.tendenz.remis} Prozent, Niederlage ${v.tendenz.niederlage} Prozent`}>
        <span style={{ flexGrow: Math.max(1, v.tendenz.sieg) }} className="tp-tendenz__sieg">
          <b>{v.tendenz.sieg}%</b> Sieg
        </span>
        <span style={{ flexGrow: Math.max(1, v.tendenz.remis) }} className="tp-tendenz__remis">
          <b>{v.tendenz.remis}%</b> Remis
        </span>
        <span style={{ flexGrow: Math.max(1, v.tendenz.niederlage) }} className="tp-tendenz__nl">
          <b>{v.tendenz.niederlage}%</b> Niederl.
        </span>
      </div>
      <ul className="tp-top-tipps">
        {v.ergebnisse.slice(0, 3).map((e) => (
          <li key={`${e.toreSva}-${e.toreGegner}`}>
            <b>{spiel.heim ? `${e.toreSva}:${e.toreGegner}` : `${e.toreGegner}:${e.toreSva}`}</b>
            <span>{e.anteil}%</span>
          </li>
        ))}
      </ul>
      {kap && v.kapitaen && (
        <p className="tp-block__hilfe">
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
  const [teilt, setTeilt] = useState(false)
  useEffect(() => {
    let aktiv = true
    ladeRangliste('spieltag', spiel.id)
      .then((x) => aktiv && setRl(x))
      .catch(() => {})
    return () => {
      aktiv = false
    }
  }, [spiel.id])
  const ich = rl?.ich
  const teilenPlatz = async () => {
    if (!ich || !rl) return
    setTeilt(true)
    try {
      const c = await bildPlatz({
        platz: ich.platz,
        teilnehmer: rl.teilnehmer,
        punkte: ich.punkte,
        bereich: `Spieltag · ${spiel.heim ? 'vs' : 'bei'} ${spiel.gegner}`,
        name: lage.ich?.profil?.anzeigename,
        partner: lage.einstellungen.partner,
      })
      if ((await teilen(c, 'sva-tipp-platz.png', 'Mein Platz · SVA Tipp-Liga')) !== 'fehler') zaehleEreignis('tipp-teilen')
    } finally {
      setTeilt(false)
    }
  }
  return (
    <div className={`tp-auflblock${kompakt ? ' is-kompakt' : ''}`}>
      <SpieltagKarte spiel={spiel} now={now} kicker={`Auflösung · ${datumKurz(spiel.anstoss)}`} />
      {spiel.meinePunkte ? (
        <Aufloesung spiel={spiel} kader={kader} platz={ich ? { platz: ich.platz, von: rl!.teilnehmer } : undefined} />
      ) : (
        <p className="tp-lead tp-auflblock__leer">{angemeldet ? 'Bei diesem Spieltag warst du nicht dabei.' : 'Melde dich an und tipp beim nächsten Spieltag mit.'}</p>
      )}
      {rl && rl.eintraege.length > 0 && (
        <section className="tp-block" aria-label="Spieltags-Sieger">
          <div className="tp-block__kopf">
            <h2 className="tp-h3">Spieltag-Top 3</h2>
            <span className="tp-block__punkte">Ø {rl.schnitt?.toLocaleString('de-DE') ?? '–'} Punkte</span>
          </div>
          <ol className="tp-mini-rang">
            {rl.eintraege.slice(0, 3).map((e) => (
              <li key={`${e.platz}-${e.name}`} className={e.ich ? 'is-ich' : ''}>
                <span className="tp-mini-rang__platz">{e.platz}</span>
                <span className="tp-mini-rang__name">
                  {e.name}
                  {e.kabine && <small className="tp-tag">Kabine</small>}
                </span>
                <b>{e.punkte}</b>
              </li>
            ))}
          </ol>
          <div className="tp-zeile-knoepfe">
            <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => onTab('rangliste')}>
              Ganze Rangliste
            </button>
            {ich && (
              <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => void teilenPlatz()} disabled={teilt}>
                <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Platz {ich.platz} teilen
              </button>
            )}
          </div>
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
      <h1 className="tp-h1" id="tp-h-winter">
        Weiter am {datum}
      </h1>
      <p className="tp-lead">Die Rückrunde kommt. Bis dahin: Saisonstand checken, Liga gründen, Kumpels einladen.</p>
      <button type="button" className="tp-btn" onClick={() => onTab('rangliste')}>
        Zum Saisonstand <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>
    </section>
  )
}
