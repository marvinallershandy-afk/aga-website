import { useCallback, useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowRight, Copy, Shirt, LogOut, Share2, Users } from 'lucide-react'
import {
  ladeKabinenLiga,
  ladeRangliste,
  ligaBeitreten,
  ligaGruenden,
  ligaTipps,
  ligaVerlassen,
  ligaVorschau,
  meineLigen,
  TippFehler,
  type KaderSpieler,
  type Lage,
  type Liga,
  type LigaTipp,
  type Rangliste,
} from './api'
import { haptik, nachname } from './model'
import { Avatar, Kapitel } from './teile'
import { Sheet } from '../alltag/Sheet'
import { bildPlatz, teilen } from './share'
import { zaehleEreignis } from '../statistik/zaehlen'

// ─────────────────────────────────────────────────────────────
// v20-T: Stammtisch-Ligen — gründen, per Code/Link beitreten, teilen.
// Einladungslink: /tippen?liga=CODE (öffnet direkt „Beitreten“).
// In der Liga sehen Mitglieder sich gegenseitig mit Namen — und die Tipps
// der anderen, sobald der Ball rollt.
// ─────────────────────────────────────────────────────────────

function einladung(code: string) {
  return `${window.location.origin}/tippen?liga=${code}&utm_source=whatsapp`
}

export function LigenTab({
  lage,
  kader,
  angemeldet,
  teilnehmer,
  onAnmelden,
  onNeu,
}: {
  lage: Lage
  kader: Map<string, KaderSpieler>
  angemeldet: boolean
  teilnehmer: boolean
  onAnmelden: () => void
  onNeu: () => Promise<Lage | null>
}) {
  const [ligen, setLigen] = useState<Liga[] | null>(null)
  const [name, setName] = useState('')
  const [code, setCode] = useState(() => {
    try {
      return (new URLSearchParams(window.location.search).get('liga') ?? '').toUpperCase().slice(0, 6)
    } catch {
      return ''
    }
  })
  const [vorschauDaten, setVorschau] = useState<{ code: string; name: string; mitglieder: number } | null>(null)
  const vorschau = vorschauDaten && vorschauDaten.code === code ? vorschauDaten : null
  const [fehler, setFehler] = useState('')
  const [laeuft, setLaeuft] = useState(false)
  const [offen, setOffen] = useState<Liga | null>(null)
  const [neu, setNeu] = useState<{ id: string; name: string; code: string } | null>(null)
  const [kabine, setKabine] = useState<Liga | null>(null)

  // Die Kabinen-Liga ist für alle lesbar (Spieler-Konten, automatisch)
  useEffect(() => {
    let aktiv = true
    ladeKabinenLiga()
      .then((k) => aktiv && k && setKabine({ id: k.id, name: k.name, system: 'kabine', gruender: false, mitglieder: k.mitglieder }))
      .catch(() => {})
    return () => {
      aktiv = false
    }
  }, [])

  const laden = useCallback(async () => {
    if (!teilnehmer) return
    try {
      setLigen(await meineLigen())
    } catch {
      setLigen([])
    }
  }, [teilnehmer])
  useEffect(() => {
    if (!teilnehmer) return
    let aktiv = true
    meineLigen()
      .then((l) => aktiv && setLigen(l))
      .catch(() => aktiv && setLigen([]))
    return () => {
      aktiv = false
    }
  }, [teilnehmer])

  // Einladungs-Vorschau (auch ohne Login)
  useEffect(() => {
    if (code.length !== 6) return
    let aktiv = true
    ligaVorschau(code)
      .then((v) => aktiv && setVorschau(v ? { ...v, code } : null))
      .catch(() => aktiv && setVorschau(null))
    return () => {
      aktiv = false
    }
  }, [code])

  const gruenden = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    if (!teilnehmer) return onAnmelden()
    setLaeuft(true)
    try {
      const l = await ligaGruenden(name)
      zaehleEreignis('liga-gegruendet')
      setNeu(l)
      setName('')
      await laden()
      void onNeu()
    } catch (err) {
      setFehler(err instanceof TippFehler ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }
  const beitreten = async (e: React.FormEvent) => {
    e.preventDefault()
    setFehler('')
    if (!teilnehmer) return onAnmelden()
    setLaeuft(true)
    try {
      await ligaBeitreten(code)
      zaehleEreignis('liga-beigetreten')
      setCode('')
      try {
        const u = new URL(window.location.href)
        u.searchParams.delete('liga')
        window.history.replaceState(null, '', u.pathname + u.search)
      } catch {
        /* egal */
      }
      await laden()
      void onNeu()
    } catch (err) {
      setFehler(err instanceof TippFehler ? err.message : 'Das hat nicht geklappt.')
    } finally {
      setLaeuft(false)
    }
  }

  const eigene = (ligen ?? []).filter((l) => !l.system)
  const kabinenLiga = (ligen ?? []).find((l) => l.system === 'kabine') ?? kabine

  return (
    <div className="tp-ligen">
      <div className="tp-rang-kopf">
        <p className="tp-kicker">Stammtisch-Ligen</p>
        <h1 className="tp-titel">Deine Leute. Deine Liga.</h1>
        <p className="tp-lead">Gründe eine Liga für Freunde, Familie oder die Feuerwehr — teil den Link in eurer WhatsApp-Gruppe. Jeder tippt wie immer, ihr habt eure eigene Tabelle.</p>
      </div>

      {code.length === 6 && vorschau && (
        <section className="tp-einladung" aria-label="Einladung">
          <Users size={22} strokeWidth={1.5} aria-hidden="true" />
          <div>
            <p className="tp-kicker">Einladung</p>
            <b>{vorschau.name}</b>
            <small>
              {vorschau.mitglieder} {vorschau.mitglieder === 1 ? 'Mitglied' : 'Mitglieder'} · Code {code}
            </small>
          </div>
          {ligen?.some((l) => l.code === code) ? (
            <button type="button" className="tp-btn tp-btn--line" onClick={() => setOffen(ligen.find((l) => l.code === code) ?? null)}>
              Du bist schon drin · Öffnen
            </button>
          ) : (
            <button type="button" className="tp-btn" onClick={(e) => void beitreten(e as unknown as React.FormEvent)} disabled={laeuft}>
              {angemeldet && teilnehmer ? 'Beitreten' : 'Anmelden & beitreten'}
            </button>
          )}
        </section>
      )}

      {teilnehmer && eigene.length > 0 && (
        <ul className="tp-ligaliste">
          {eigene.map((l, i) => (
            <motion.li key={l.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.32, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}>
              <LigaZeile l={l} onOeffnen={() => setOffen(l)} />
            </motion.li>
          ))}
        </ul>
      )}

      {kabinenLiga && (
        <section className="tp-abschnitt" aria-labelledby="tp-h-kabliga">
          <Kapitel id="tp-h-kabliga" titel="Kabinen-Liga" meta="alle Spieler-Konten · automatisch" />
          <ul className="tp-ligaliste">
            <li>
              <LigaZeile l={kabinenLiga} onOeffnen={() => setOffen(kabinenLiga)} />
            </li>
          </ul>
          <p className="tp-hilfe">Spieler-Konten landen automatisch hier — ohne Code, ohne Preise. Fans vs. Kabine läuft in der Rangliste.</p>
        </section>
      )}

      {fehler && (
        <p className="tp-hinweis tp-hinweis--fehler" role="alert">
          {fehler}
        </p>
      )}

      <section className="tp-abschnitt" aria-labelledby="tp-h-neueliga">
        <Kapitel id="tp-h-neueliga" titel="Neue Liga" meta="max. 5 eigene" />
        <div className="tp-ligen__formen">
          <form className="tp-formblock" onSubmit={gruenden}>
            <h3 className="tp-formblock__titel">Liga gründen</h3>
            <label className="tp-feld">
              <span>Name</span>
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Stammtisch-Liga" maxLength={40} />
            </label>
            <button type="submit" className="tp-btn" disabled={laeuft || name.trim().length < 3}>
              Gründen
            </button>
          </form>
          <form className="tp-formblock" onSubmit={beitreten}>
            <h3 className="tp-formblock__titel">Mit Code beitreten</h3>
            <label className="tp-feld">
              <span>Liga-Code</span>
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder="ABC234"
                className="tp-feld__code"
                autoCapitalize="characters"
                inputMode="text"
              />
            </label>
            <button type="submit" className="tp-btn tp-btn--line" disabled={laeuft || code.length !== 6}>
              Beitreten
            </button>
          </form>
        </div>
      </section>
      {!angemeldet && (
        <p className="tp-hilfe">
          Für Ligen brauchst du ein Konto (dasselbe wie fürs Sammelalbum).{' '}
          <button type="button" className="tp-link" onClick={onAnmelden}>
            Anmelden
          </button>
        </p>
      )}

      <Sheet open={!!neu} onClose={() => setNeu(null)} label="tp-neu" kicker="Liga gegründet" titel={neu?.name ?? ''}>
        {neu && <Einladen code={neu.code} name={neu.name} />}
      </Sheet>

      <Sheet open={!!offen} onClose={() => setOffen(null)} label="tp-liga" kicker={offen?.system ? 'Kabinen-Liga · automatisch' : `Liga · Code ${offen?.code ?? ''}`} titel={offen?.name ?? ''}>
        {offen && (
          <LigaDetail
            liga={offen}
            lage={lage}
            kader={kader}
            mitglied={!offen.system || (ligen ?? []).some((l) => l.id === offen.id)}
            onVerlassen={async () => {
              await ligaVerlassen(offen.id)
              setOffen(null)
              await laden()
            }}
          />
        )}
      </Sheet>
    </div>
  )
}

function LigaZeile({ l, onOeffnen }: { l: Liga; onOeffnen: () => void }) {
  return (
    <button
      type="button"
      className={`tp-ligazeile${l.system ? ' is-system' : ''}`}
      onClick={() => {
        haptik(6)
        onOeffnen()
      }}
    >
      <span className="tp-ligazeile__wappen" aria-hidden="true">
        {l.system ? <Shirt size={20} strokeWidth={1.5} /> : l.name.slice(0, 2).toUpperCase()}
      </span>
      <span className="tp-ligazeile__name">
        <b>{l.name}</b>
        <small>
          {l.mitglieder} {l.mitglieder === 1 ? 'Mitglied' : 'Mitglieder'}
          {l.fuehrender ? ` · vorne: ${l.fuehrender}` : ''}
        </small>
      </span>
      {l.meinPlatz != null && (
        <span className="tp-ligazeile__platz">
          <b>{l.meinPlatz}</b>
          <small>Platz</small>
        </span>
      )}
      <ArrowRight size={18} strokeWidth={1.5} aria-hidden="true" />
    </button>
  )
}

function Einladen({ code, name }: { code: string; name: string }) {
  const [kopiert, setKopiert] = useState(false)
  const link = einladung(code)
  const text = `Tipp mit mir in „${name}“ — der SVA-Tipp-Liga. Code ${code}: ${link}`
  const kopieren = async () => {
    try {
      await navigator.clipboard.writeText(link)
      setKopiert(true)
      window.setTimeout(() => setKopiert(false), 2000)
    } catch {
      /* ohne Zwischenablage */
    }
  }
  const nativ = async () => {
    try {
      await navigator.share({ title: name, text, url: link })
      zaehleEreignis('tipp-teilen')
    } catch {
      /* abgebrochen */
    }
  }
  return (
    <div className="tp-einladen">
      <p className="tp-einladen__code" aria-label={`Code ${code.split('').join(' ')}`}>
        {code}
      </p>
      <div className="tp-zeile-knoepfe">
        <a className="tp-btn" href={`https://wa.me/?text=${encodeURIComponent(text)}`} target="_blank" rel="noopener" onClick={() => zaehleEreignis('tipp-teilen')}>
          Per WhatsApp einladen
        </a>
        {'share' in navigator && (
          <button type="button" className="tp-btn tp-btn--line" onClick={() => void nativ()}>
            <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Teilen
          </button>
        )}
        <button type="button" className="tp-btn tp-btn--line" onClick={() => void kopieren()}>
          <Copy size={16} strokeWidth={1.5} aria-hidden="true" /> {kopiert ? 'Kopiert' : 'Link kopieren'}
        </button>
      </div>
    </div>
  )
}

function LigaDetail({ liga, lage, kader, mitglied, onVerlassen }: { liga: Liga; lage: Lage; kader: Map<string, KaderSpieler>; mitglied: boolean; onVerlassen: () => Promise<void> }) {
  const [rl, setRl] = useState<Rangliste | null>(null)
  const [tipps, setTipps] = useState<LigaTipp[] | null>(null)
  const [teilt, setTeilt] = useState(false)
  const spiel = lage.gesperrt ?? lage.gewertet
  useEffect(() => {
    ladeRangliste('saison', null, liga.id).then(setRl).catch(() => setRl(null))
    if (spiel && mitglied) ligaTipps(liga.id, spiel.id).then(setTipps).catch(() => setTipps(null))
  }, [liga.id, spiel, mitglied])
  const teilenPlatz = async () => {
    if (!rl?.ich) return
    setTeilt(true)
    try {
      const c = await bildPlatz({
        platz: rl.ich.platz,
        teilnehmer: rl.teilnehmer,
        punkte: rl.ich.punkte,
        art: 'liga',
        bereich: liga.name,
        name: lage.ich?.profil?.anzeigename,
        trend: rl.ich.trend,
        code: liga.system ? undefined : liga.code,
        partner: lage.einstellungen.partner,
      })
      if ((await teilen(c, 'sva-liga-platz.png', `${liga.name} · SVA Tipp-Liga`)) !== 'fehler') zaehleEreignis('tipp-teilen')
    } finally {
      setTeilt(false)
    }
  }
  return (
    <div className="tp-ligadetail">
      <h3 className="tp-formblock__titel">Saison-Tabelle</h3>
      {!rl && <div className="tp-skelett__zeile" />}
      {rl && rl.eintraege.length === 0 && <p className="tp-lead">Noch keine Punkte — nach dem nächsten Spieltag steht hier eure Tabelle.</p>}
      {rl && rl.eintraege.length > 0 && (
        <ol className="tp-rang tp-rang--mini">
          {rl.eintraege.map((e) => (
            <li key={`${e.platz}-${e.name}`} className={`tp-rang__zeile${e.ich ? ' is-ich' : ''}`}>
              <span className="tp-rang__platz">{e.platz}</span>
              <Avatar name={e.name} groesse={32} kabine={e.kabine} ich={e.ich} />
              <span className="tp-rang__name">
                <b>{e.name}</b>
                <small>{e.kabine && !liga.system && <span className="tp-tag tp-tag--kabine">Kabine</span>}</small>
              </span>
              <b className="tp-rang__pkt">{e.punkte}</b>
            </li>
          ))}
        </ol>
      )}
      {spiel && tipps && tipps.length > 0 && (
        <>
          <h3 className="tp-formblock__titel">
            Tipps {spiel.heim ? 'gegen' : 'bei'} {spiel.gegner}
          </h3>
          <ul className="tp-ligatipps">
            {tipps.map((t) => (
              <li key={t.name} className={t.ich ? 'is-ich' : ''}>
                <span>{t.name}</span>
                <b>{t.toreSva != null ? (spiel.heim ? `${t.toreSva}:${t.toreGegner}` : `${t.toreGegner}:${t.toreSva}`) : '–'}</b>
                <small>
                  {t.joker ? 'Joker · ' : ''}
                  {t.kapitaen ? `C ${nachname(kader.get(t.kapitaen)?.name ?? '')}` : ''}
                </small>
                {t.punkte != null && <b className="tp-ligatipps__p">{t.punkte}</b>}
              </li>
            ))}
          </ul>
        </>
      )}
      {!liga.system && liga.code && (
        <>
          <h3 className="tp-formblock__titel">Einladen</h3>
          <Einladen code={liga.code} name={liga.name} />
        </>
      )}
      <div className="tp-zeile-knoepfe">
        {rl?.ich && (
          <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => void teilenPlatz()} disabled={teilt}>
            <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Platz {rl.ich.platz} in die Story
          </button>
        )}
        {!liga.system && (
          <button type="button" className="tp-btn tp-btn--text tp-btn--sm" onClick={() => void onVerlassen()}>
            <LogOut size={16} strokeWidth={1.5} aria-hidden="true" /> Liga verlassen
          </button>
        )}
      </div>
    </div>
  )
}
