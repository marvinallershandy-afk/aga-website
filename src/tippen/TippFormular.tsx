import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Check, Share2, Sparkles } from 'lucide-react'
import { elfSpeichern, tippAbgeben, TippFehler, type BonusKey, type KaderSpieler, type Lage, type TippSpiel } from './api'
import { entwurfLesen, entwurfSchreiben, passt, type Entwurf } from './model'
import { ErgebnisStepper } from './Stepper'
import { SpielerLeiste } from './SpielerLeiste'
import { BonusDeck } from './BonusDeck'
import { DeineElf, type ElfStand } from './DeineElf'
import { Belohnung } from './Belohnung'
import { bildMeinTipp, bildMeineElf, teilen } from './share'
import { zaehleEreignis } from '../statistik/zaehlen'

// ─────────────────────────────────────────────────────────────
// v20-T: Der Tipp für einen Spieltag — in ≤ 20 Sekunden:
//   Ergebnis (2–4 Taps) → Bonusfragen (3 Taps/Wische) → Elf ist vom
//   letzten Mal vorbelegt → „Tipp abgeben“. Torschütze, Spieler des Spiels
//   und Joker sind optional.
// Ohne Login: Entwurf auf dem Gerät, Login, danach automatisch abgeschickt.
// ─────────────────────────────────────────────────────────────

interface Stand {
  toreSva: number
  toreGegner: number
  erster?: string
  motm?: string
  joker: boolean
  bonus: Partial<Record<BonusKey, string>>
  elf: ElfStand
}

function startStand(spiel: TippSpiel, lage: Lage, kader: Map<string, KaderSpieler>): Stand {
  const ent = entwurfLesen()
  const e = ent?.spielId === spiel.id ? ent : null
  const t = spiel.meinTipp
  const gueltig = (id?: string | null) => (id && kader.has(id) ? id : undefined)
  // Elf: gespeichert → Entwurf → letzte Elf (nur noch aktive, passende Spieler)
  let elf: ElfStand = { elf: [null, null, null, null, null], frei: false }
  const quelle = spiel.meineElf ?? (e ? { spieler: e.elf, kapitaen: e.kapitaen, frei: e.frei } : lage.ich?.letzteElf)
  if (quelle) {
    const frei = !!quelle.frei && lage.einstellungen.elfFrei
    const ids = [0, 1, 2, 3, 4].map((i) => {
      const id = gueltig(quelle.spieler[i] ?? undefined)
      return id && passt(i, kader.get(id), frei) ? id : null
    })
    const kap = quelle.kapitaen && ids.includes(quelle.kapitaen) ? quelle.kapitaen : (ids.find((x) => !!x) ?? undefined)
    elf = { elf: ids, kapitaen: kap, frei }
  }
  if (t) {
    return {
      toreSva: t.toreSva,
      toreGegner: t.toreGegner,
      erster: gueltig(t.ersterTorschuetze),
      motm: gueltig(t.motm),
      joker: t.joker,
      bonus: t.bonus ?? {},
      elf,
    }
  }
  if (e) {
    return { toreSva: e.toreSva, toreGegner: e.toreGegner, erster: gueltig(e.ersterTorschuetze), motm: gueltig(e.motm), joker: e.joker, bonus: e.bonus, elf }
  }
  return { toreSva: 0, toreGegner: 0, joker: false, bonus: {}, elf }
}

function gleich(a: unknown, b: unknown) {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function TippFormular({
  spiel,
  lage,
  kader,
  angemeldet,
  teilnehmer,
  onAnmelden,
  onNeu,
}: {
  spiel: TippSpiel
  lage: Lage
  kader: Map<string, KaderSpieler>
  angemeldet: boolean
  teilnehmer: boolean
  onAnmelden: (grund: 'tipp') => void
  onNeu: () => Promise<Lage | null>
}) {
  const [s, setS] = useState<Stand>(() => startStand(spiel, lage, kader))
  const [gespeichert, setGespeichert] = useState<Stand | null>(() => (spiel.meinTipp ? startStand(spiel, lage, kader) : null))
  const [laeuft, setLaeuft] = useState(false)
  const [fehler, setFehler] = useState('')
  const [belohnung, setBelohnung] = useState<null | { karte: boolean; abzeichen: string[] }>(null)
  const [teilt, setTeilt] = useState(false)
  const autoGesendet = useRef(false)

  const kaderListe = useMemo(() => [...kader.values()], [kader])
  const elfVoll = s.elf.elf.every(Boolean) && !!s.elf.kapitaen
  const bonusZahl = spiel.fragen.filter((f) => s.bonus[f.key]).length
  const geaendert = !gespeichert || !gleich(s, gespeichert)
  const jokerGesperrt = lage.ich?.jokerFrei === false && !spiel.meinTipp?.joker

  // Entwurf mitschreiben (falls die Seite zugeht, bevor man sich anmeldet)
  useEffect(() => {
    if (teilnehmer && spiel.meinTipp && !geaendert) return
    const e: Entwurf = {
      spielId: spiel.id,
      toreSva: s.toreSva,
      toreGegner: s.toreGegner,
      ersterTorschuetze: s.erster,
      motm: s.motm,
      joker: s.joker,
      bonus: s.bonus,
      elf: s.elf.elf,
      kapitaen: s.elf.kapitaen,
      frei: s.elf.frei,
      absenden: entwurfLesen()?.absenden && entwurfLesen()?.spielId === spiel.id,
    }
    entwurfSchreiben(e)
  }, [s, spiel.id, spiel.meinTipp, teilnehmer, geaendert])

  const abgeben = useCallback(
    async (stand: Stand) => {
      setFehler('')
      if (!angemeldet || !teilnehmer) {
        const e = entwurfLesen()
        if (e) entwurfSchreiben({ ...e, absenden: true })
        onAnmelden('tipp')
        return
      }
      setLaeuft(true)
      try {
        const r = await tippAbgeben(spiel.id, {
          toreSva: stand.toreSva,
          toreGegner: stand.toreGegner,
          ersterTorschuetze: stand.erster,
          motm: stand.motm,
          joker: stand.joker,
          bonus: stand.bonus,
        })
        zaehleEreignis('tipp-abgegeben')
        if (stand.elf.elf.every(Boolean) && stand.elf.kapitaen) {
          await elfSpeichern(spiel.id, { spieler: stand.elf.elf as string[], kapitaen: stand.elf.kapitaen, frei: stand.elf.frei })
          zaehleEreignis('elf-gespeichert')
        }
        entwurfSchreiben(null)
        setGespeichert(stand)
        setBelohnung({ karte: r.karte, abzeichen: r.abzeichen ?? [] })
        void onNeu()
      } catch (err) {
        setFehler(err instanceof TippFehler ? err.message : 'Das hat nicht geklappt.')
        if (err instanceof TippFehler && err.code === 'tipp_geschlossen') void onNeu()
      } finally {
        setLaeuft(false)
      }
    },
    [angemeldet, teilnehmer, spiel.id, onAnmelden, onNeu],
  )

  // Nach dem Login: Entwurf automatisch abschicken
  useEffect(() => {
    if (!teilnehmer || autoGesendet.current) return
    const e = entwurfLesen()
    if (!(e?.absenden && e.spielId === spiel.id)) return
    autoGesendet.current = true
    // nach dem Rendern abschicken (Entwurf = externer Zustand aus dem Login-Rücksprung)
    const t = window.setTimeout(() => void abgeben(s), 0)
    return () => window.clearTimeout(t)
  }, [teilnehmer, spiel.id, abgeben, s])

  const teilenTipp = async () => {
    setTeilt(true)
    try {
      const c = await bildMeinTipp({
        gegner: spiel.gegner,
        heim: spiel.heim,
        anstoss: spiel.anstoss,
        toreSva: s.toreSva,
        toreGegner: s.toreGegner,
        joker: s.joker,
        torschuetze: s.erster ? kader.get(s.erster) : undefined,
        bonus: spiel.fragen.map((f) => ({ key: f.key, wert: s.bonus[f.key], linie: f.linie })),
        partner: lage.einstellungen.partner,
      })
      if ((await teilen(c, `sva-tipp-${spiel.gegner.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`, 'Mein Tipp · SVA Tipp-Liga')) !== 'fehler') zaehleEreignis('tipp-teilen')
    } finally {
      setTeilt(false)
    }
  }
  const teilenElf = async () => {
    if (!elfVoll) return
    setTeilt(true)
    try {
      const c = await bildMeineElf({
        gegner: spiel.gegner,
        heim: spiel.heim,
        anstoss: spiel.anstoss,
        spieler: s.elf.elf.map((id) => kader.get(id as string)!),
        kapitaen: s.elf.kapitaen,
        partner: lage.einstellungen.partner,
      })
      if ((await teilen(c, 'sva-meine-elf.png', 'Meine Elf · SVA Tipp-Liga')) !== 'fehler') zaehleEreignis('tipp-teilen')
    } finally {
      setTeilt(false)
    }
  }

  return (
    <div className="tp-formular">
      <section className="tp-block" aria-labelledby="tp-h-ergebnis">
        <div className="tp-block__kopf">
          <h2 className="tp-h3" id="tp-h-ergebnis">
            Dein Tipp
          </h2>
          <span className="tp-block__punkte">4 · 3 · 2 Punkte</span>
        </div>
        <ErgebnisStepper heim={spiel.heim} gegner={spiel.gegner} toreSva={s.toreSva} toreGegner={s.toreGegner} onChange={(a, b) => setS((x) => ({ ...x, toreSva: a, toreGegner: b }))} />
        <p className="tp-block__hilfe">Exakt 4 · richtige Tordifferenz 3 · richtige Tendenz 2</p>
      </section>

      <section className="tp-block" aria-labelledby="tp-h-bonus">
        <div className="tp-block__kopf">
          <h2 className="tp-h3" id="tp-h-bonus">
            Bonusfragen
          </h2>
          <span className="tp-block__punkte">
            {bonusZahl}/{spiel.fragen.length} · je +1
          </span>
        </div>
        <BonusDeck fragen={spiel.fragen} bonus={s.bonus} onAntwort={(k, w) => setS((x) => ({ ...x, bonus: { ...x.bonus, [k]: w } }))} />
      </section>

      <section className="tp-block" aria-labelledby="tp-h-elf">
        <div className="tp-block__kopf">
          <h2 className="tp-h3" id="tp-h-elf">
            Deine Elf
          </h2>
          <span className="tp-block__punkte">{s.elf.elf.filter(Boolean).length}/5 · Kapitän ×2</span>
        </div>
        <DeineElf kader={kader} stand={s.elf} freiErlaubt={lage.einstellungen.elfFrei} onChange={(elf) => setS((x) => ({ ...x, elf }))} />
        {!elfVoll && <p className="tp-block__hilfe">Ohne volle Elf zählt nur dein Ergebnis-Tipp.</p>}
        <details className="tp-regeln">
          <summary>So punktet deine Elf</summary>
          <dl>
            <div><dt>Einsatz</dt><dd>+1</dd></div>
            <div><dt>Tor</dt><dd>+5</dd></div>
            <div><dt>Vorlage</dt><dd>+3</dd></div>
            <div><dt>Zu null (TW/ABW, ab 60 Min.)</dt><dd>+4</dd></div>
            <div><dt>Spieler des Spiels</dt><dd>+5</dd></div>
            <div><dt>Sieg (eingesetzt)</dt><dd>+2</dd></div>
            <div><dt>Gelb · Gelb-Rot · Rot</dt><dd>−1 · −3 · −4</dd></div>
          </dl>
        </details>
      </section>

      <section className="tp-block" aria-labelledby="tp-h-extra">
        <div className="tp-block__kopf">
          <h2 className="tp-h3" id="tp-h-extra">
            Extrapunkte
          </h2>
          <span className="tp-block__punkte">freiwillig</span>
        </div>
        <p className="tp-block__unter">
          Erster SVA-Torschütze <b>+3</b>
        </p>
        <SpielerLeiste kader={kaderListe} wert={s.erster} onWahl={(id) => setS((x) => ({ ...x, erster: id }))} label="Erster SVA-Torschütze" />
        <p className="tp-block__unter">
          Spieler des Spiels <b>+2</b> <small>· gewählt wird auf Instagram</small>
        </p>
        <SpielerLeiste kader={kaderListe} wert={s.motm} onWahl={(id) => setS((x) => ({ ...x, motm: id }))} label="Spieler des Spiels" sortierung="kader" />
        <label className={`tp-joker${s.joker ? ' is-an' : ''}${jokerGesperrt ? ' is-aus' : ''}`}>
          <input type="checkbox" checked={s.joker} disabled={jokerGesperrt} onChange={(e) => setS((x) => ({ ...x, joker: e.target.checked }))} />
          <Sparkles size={22} strokeWidth={1.5} aria-hidden="true" />
          <span>
            <b>Joker setzen</b>
            <small>{jokerGesperrt ? 'Diesen Monat schon gesetzt — ab dem 1. wieder da.' : 'Verdoppelt deine Tipp-Punkte. 1× pro Monat.'}</small>
          </span>
          <i className="tp-joker__schalter" aria-hidden="true" />
        </label>
      </section>

      <div className="tp-abgabe" role="region" aria-label="Tipp abgeben">
        <div className="tp-abgabe__status" aria-live="polite">
          <span className={s.toreSva + s.toreGegner >= 0 ? 'is-ok' : ''}>
            <Check size={14} strokeWidth={2} aria-hidden="true" /> {spiel.heim ? `${s.toreSva}:${s.toreGegner}` : `${s.toreGegner}:${s.toreSva}`}
          </span>
          <span className={bonusZahl === spiel.fragen.length ? 'is-ok' : ''}>Bonus {bonusZahl}/{spiel.fragen.length}</span>
          <span className={elfVoll ? 'is-ok' : ''}>Elf {s.elf.elf.filter(Boolean).length}/5</span>
          {s.joker && <span className="is-joker">Joker</span>}
        </div>
        {fehler && (
          <p className="tp-hinweis tp-hinweis--fehler" role="alert">
            {fehler}
          </p>
        )}
        <div className="tp-abgabe__knoepfe">
          {gespeichert && !geaendert ? (
            <>
              <span className="tp-abgabe__ok">
                <Check size={18} strokeWidth={2} aria-hidden="true" /> Gespeichert · änderbar bis Anpfiff
              </span>
              <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => void teilenTipp()} disabled={teilt}>
                <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Teilen
              </button>
            </>
          ) : (
            <button type="button" className="tp-btn tp-btn--gross" onClick={() => void abgeben(s)} disabled={laeuft}>
              {laeuft ? 'Wird gespeichert …' : gespeichert ? 'Änderungen speichern' : angemeldet && teilnehmer ? 'Tipp abgeben' : 'Tipp abgeben'}
            </button>
          )}
        </div>
      </div>

      <AnimatePresence>
        {belohnung && (
          <Belohnung
            karte={belohnung.karte}
            abzeichenNeu={belohnung.abzeichen}
            onWeiter={() => setBelohnung(null)}
            onTeilen={() => {
              setBelohnung(null)
              void (elfVoll ? teilenElf() : teilenTipp())
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
