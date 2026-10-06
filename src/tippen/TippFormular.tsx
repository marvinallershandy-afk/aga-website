import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Check, Crown, Share2, Sparkles } from 'lucide-react'
import { elfSpeichern, tippAbgeben, TippFehler, type BonusKey, type KaderSpieler, type Lage, type TippSpiel } from './api'
import { datumKurz, elfEinordnen, entwurfLesen, entwurfSchreiben, haptik, kuerzel, uhrzeit, verfuegbar, type Entwurf } from './model'
import { Kapitel } from './teile'
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
  // Elf: gespeichert → Entwurf → letzte Elf. v21: alte Formation (1-2-2) wird in
  // 1 TW · 1 ABW · 2 MIT · 1 ANG eingeordnet; Kapitän nur, wenn er drin bleibt
  // (keine Automatik — Kapitän wählt man bewusst).
  let elf: ElfStand = { elf: [null, null, null, null, null], frei: false }
  const quelle = spiel.meineElf ?? (e ? { spieler: e.elf, kapitaen: e.kapitaen, frei: e.frei } : lage.ich?.letzteElf)
  if (quelle) {
    const frei = !!quelle.frei && lage.einstellungen.elfFrei
    const ids = elfEinordnen(quelle.spieler.map((x) => gueltig(x ?? undefined)), kader, frei)
    const kap = quelle.kapitaen && ids.includes(quelle.kapitaen) ? quelle.kapitaen : undefined
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

// v21-UX (Befund 2/3): Ist das Ergebnis schon „bewusst gewählt“? Ja, wenn ein
// gespeicherter Tipp vorliegt oder der Entwurf dieses Spiels es vermerkt hat.
function startBeruehrt(spiel: TippSpiel): boolean {
  if (spiel.meinTipp) return true
  const e = entwurfLesen()
  return !!(e && e.spielId === spiel.id && e.ergBeruehrt)
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
  // v21-UX (Befund 3): Ergebnis erst nach bewusster Wahl gültig; unberührtes 0:0 → Rückfrage.
  const [beruehrt, setBeruehrt] = useState(() => startBeruehrt(spiel))
  const [frage, setFrage] = useState(false)
  const autoGesendet = useRef(false)

  const kaderListe = useMemo(() => [...kader.values()], [kader])
  const elfVoll = s.elf.elf.every((id) => !!id && verfuegbar(kader.get(id))) && !!s.elf.kapitaen
  const bonusZahl = spiel.fragen.filter((f) => s.bonus[f.key]).length
  const geaendert = !gespeichert || !gleich(s, gespeichert)
  const jokerGesperrt = lage.ich?.jokerFrei === false && !spiel.meinTipp?.joker
  // v21-UX (Befund 8): für welches Spiel getippt wird — steht im Abgabe-Knopf
  const fuer = `für ${datumKurz(spiel.anstoss)} ${uhrzeit(spiel.anstoss)} · ${spiel.heim ? 'gegen' : 'bei'} ${kuerzel(spiel.gegner)}`
  // v22-T: was fehlt noch? (Rückfrage statt stillem 0:0 / halber Elf)
  const fehlt: { text: string; ziel: string; knopf: string }[] = []
  if (!beruehrt) fehlt.push({ text: 'Ergebnis', ziel: 'tp-h-ergebnis', knopf: 'Ergebnis wählen' })
  if (bonusZahl < spiel.fragen.length) fehlt.push({ text: `${spiel.fragen.length - bonusZahl} ${spiel.fragen.length - bonusZahl === 1 ? 'Bonusfrage' : 'Bonusfragen'}`, ziel: 'tp-h-bonus', knopf: 'Bonusfragen' })
  if (!s.elf.elf.every(Boolean)) fehlt.push({ text: `Elf ${s.elf.elf.filter(Boolean).length}/5`, ziel: 'tp-h-elf', knopf: 'Elf aufstellen' })
  else if (!s.elf.kapitaen) fehlt.push({ text: 'Kapitän', ziel: 'tp-h-elf', knopf: 'Kapitän wählen' })

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
      formation: 'v21',
      ergBeruehrt: beruehrt,
      absenden: entwurfLesen()?.absenden && entwurfLesen()?.spielId === spiel.id,
    }
    entwurfSchreiben(e)
  }, [s, spiel.id, spiel.meinTipp, teilnehmer, geaendert, beruehrt])

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
        if (stand.elf.elf.every((id) => !!id && verfuegbar(kader.get(id))) && stand.elf.kapitaen) {
          await elfSpeichern(spiel.id, { spieler: stand.elf.elf as string[], kapitaen: stand.elf.kapitaen, frei: stand.elf.frei })
          zaehleEreignis('elf-gespeichert')
        }
        entwurfSchreiben(null)
        setGespeichert(stand)
        setBelohnung({ karte: r.karte, abzeichen: r.abzeichen ?? [] })
        haptik([12, 60, 18])
        void onNeu()
      } catch (err) {
        setFehler(err instanceof TippFehler ? err.message : 'Das hat nicht geklappt.')
        if (err instanceof TippFehler && err.code === 'tipp_geschlossen') void onNeu()
      } finally {
        setLaeuft(false)
      }
    },
    [angemeldet, teilnehmer, spiel.id, onAnmelden, onNeu, kader],
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
    <div className="tp-formular" id="tp-tippschein">
      <section className="tp-abschnitt" aria-labelledby="tp-h-ergebnis">
        <Kapitel id="tp-h-ergebnis" titel="Dein Ergebnis" meta="Exakt 4 · Differenz 3 · Tendenz 2" />
        <ErgebnisStepper
          heim={spiel.heim}
          gegner={spiel.gegner}
          toreSva={s.toreSva}
          toreGegner={s.toreGegner}
          beruehrt={beruehrt}
          onChange={(a, b) => {
            setBeruehrt(true)
            setFrage(false)
            setS((x) => ({ ...x, toreSva: a, toreGegner: b }))
          }}
        />
        {!beruehrt && <p className="tp-hilfe">Tippe das Ergebnis mit den + und – Knöpfen — vorher ist der Tipp noch nicht gültig.</p>}
      </section>

      <section className="tp-abschnitt" aria-labelledby="tp-h-bonus">
        <Kapitel id="tp-h-bonus" titel="Bonusfragen" meta={`${bonusZahl}/${spiel.fragen.length} · je +1`} />
        <BonusDeck fragen={spiel.fragen} bonus={s.bonus} onAntwort={(k, w) => setS((x) => ({ ...x, bonus: { ...x.bonus, [k]: w } }))} />
      </section>

      <section className="tp-abschnitt tp-abschnitt--elf" aria-labelledby="tp-h-elf">
        <Kapitel
          id="tp-h-elf"
          titel="Deine Elf"
          meta={
            <>
              {s.elf.elf.filter(Boolean).length}/5 · <Crown size={12} strokeWidth={2} aria-hidden="true" /> ×2
            </>
          }
        />
        <DeineElf kader={kader} stand={s.elf} freiErlaubt={lage.einstellungen.elfFrei} vorschlag={lage.vorschlagElf} onChange={(elf) => setS((x) => ({ ...x, elf }))} />
        {!elfVoll && <p className="tp-hilfe">Ohne volle Elf mit Kapitän zählt nur dein Ergebnis-Tipp.</p>}
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
            <div><dt>Kapitän</dt><dd>×2</dd></div>
          </dl>
        </details>
      </section>

      <section className="tp-abschnitt" aria-labelledby="tp-h-extra">
        <Kapitel id="tp-h-extra" titel="Extrapunkte" meta="freiwillig" />
        <p className="tp-unter">
          Erster SVA-Torschütze <b>+3</b>
        </p>
        <SpielerLeiste kader={kaderListe} wert={s.erster} onWahl={(id) => setS((x) => ({ ...x, erster: id }))} label="Erster SVA-Torschütze" />
        <p className="tp-unter">
          Spieler des Spiels <b>+2</b> <small>· gewählt wird auf Instagram</small>
        </p>
        <SpielerLeiste kader={kaderListe} wert={s.motm} onWahl={(id) => setS((x) => ({ ...x, motm: id }))} label="Spieler des Spiels" sortierung="kader" />
        <label className={`tp-joker${s.joker ? ' is-an' : ''}${jokerGesperrt ? ' is-aus' : ''}`}>
          <input
            type="checkbox"
            checked={s.joker}
            disabled={jokerGesperrt}
            onChange={(e) => {
              haptik(e.target.checked ? [8, 30, 8] : 6)
              setS((x) => ({ ...x, joker: e.target.checked }))
            }}
          />
          <span className="tp-joker__karte" aria-hidden="true">
            <Sparkles size={22} strokeWidth={1.5} />
            <b>×2</b>
          </span>
          <span className="tp-joker__text">
            <b>Joker setzen</b>
            <small>{jokerGesperrt ? 'Diesen Monat schon gesetzt — ab dem 1. wieder da.' : 'Verdoppelt deine Tipp-Punkte. 1× pro Monat.'}</small>
          </span>
          <i className="tp-joker__schalter" aria-hidden="true" />
        </label>
      </section>

      <div className="tp-abgabe" role="region" aria-label="Tipp abgeben">
        <ol className="tp-abgabe__status" aria-live="polite">
          <li className={beruehrt ? 'is-ok' : 'is-offen'}>
            {beruehrt ? <Check size={12} strokeWidth={2.5} aria-hidden="true" /> : null} {beruehrt ? (spiel.heim ? `${s.toreSva}:${s.toreGegner}` : `${s.toreGegner}:${s.toreSva}`) : '– : –'}
          </li>
          <li className={bonusZahl === spiel.fragen.length ? 'is-ok' : ''}>
            {bonusZahl === spiel.fragen.length && <Check size={12} strokeWidth={2.5} aria-hidden="true" />} Bonus {bonusZahl}/{spiel.fragen.length}
          </li>
          <li className={s.elf.elf.every(Boolean) ? 'is-ok' : ''}>
            {s.elf.elf.every(Boolean) && <Check size={12} strokeWidth={2.5} aria-hidden="true" />} Elf {s.elf.elf.filter(Boolean).length}/5
          </li>
          <li className={s.elf.kapitaen ? 'is-ok is-gold' : ''} aria-label={s.elf.kapitaen ? 'Kapitän gewählt' : 'Kapitän fehlt'}>
            <Crown size={12} strokeWidth={2} aria-hidden="true" />
            <span className="tp-abgabe__lang">Kapitän</span>
          </li>
          {s.joker && <li className="is-joker">Joker</li>}
        </ol>
        {fehler && (
          <p className="tp-hinweis tp-hinweis--fehler" role="alert">
            {fehler}
          </p>
        )}
        {frage ? (
          <div className="tp-abgabe__frage" role="group" aria-label="Was noch fehlt">
            <p>
              Noch offen: <b>{fehlt.map((f) => f.text).join(' · ')}</b>
              <small>Ohne Ergebnis würdest du 0:0 tippen.{!elfVoll ? ' Ohne volle Elf mit Kapitän zählt nur dein Ergebnis-Tipp.' : ''}</small>
            </p>
            <div className="tp-abgabe__knoepfe">
              <button
                type="button"
                className="tp-btn tp-btn--line tp-btn--sm"
                onClick={() => {
                  setFrage(false)
                  document.getElementById(fehlt[0]?.ziel ?? 'tp-h-ergebnis')?.scrollIntoView({ behavior: 'smooth', block: 'center' })
                }}
              >
                {fehlt[0]?.knopf ?? 'Ergänzen'}
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--sm"
                onClick={() => {
                  setFrage(false)
                  setBeruehrt(true)
                  void abgeben({ ...s, toreSva: 0, toreGegner: 0 })
                }}
                disabled={laeuft}
              >
                Ja, 0:0 tippen
              </button>
            </div>
          </div>
        ) : (
          <div className="tp-abgabe__knoepfe">
            {gespeichert && !geaendert ? (
              <>
                <span className="tp-abgabe__ok">
                  <Check size={18} strokeWidth={2} aria-hidden="true" />
                  <span>
                    Gespeichert · änderbar bis Anpfiff
                    <small>{fuer}</small>
                  </span>
                </span>
                <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={() => void teilenTipp()} disabled={teilt}>
                  <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Teilen
                </button>
              </>
            ) : (
              <button
                type="button"
                className="tp-btn tp-btn--gross tp-abgabe__los"
                onClick={() => {
                  // v22-T: Rückfrage nur ohne bewusst gewähltes Ergebnis — sie nennt
                  // dann alles, was noch fehlt. Mit Ergebnis geht es direkt durch.
                  if (!beruehrt) {
                    setFrage(true)
                    haptik(10)
                    return
                  }
                  void abgeben(s)
                }}
                disabled={laeuft}
              >
                <span>{laeuft ? 'Wird gespeichert …' : gespeichert ? 'Änderungen speichern' : 'Tipp abgeben'}</span>
                <small className="tp-abgabe__fuer">{fuer}</small>
              </button>
            )}
          </div>
        )}
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
