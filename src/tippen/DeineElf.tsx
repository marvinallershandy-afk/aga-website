import { useState } from 'react'
import { motion } from 'framer-motion'
import { Ban, Crown, Plus, Repeat2, Sparkles, UserMinus, Wand2 } from 'lucide-react'
import type { KaderSpieler, VorschlagElf } from './api'
import { elfEinordnen, PLAETZE, POS_LANG, haptik, nachname, passt, verfuegbar } from './model'
import { SpielerGesicht, SpielerKarte } from './SpielerKarte'
import { Sheet } from '../alltag/Sheet'

// ─────────────────────────────────────────────────────────────
// v21-T „Deine Elf“: 1 TW · 1 ABW · 2 MIT · 1 ANG (oder frei).
// Jeder Platz nimmt Spieler mit passender Haupt- ODER Zweitposition
// (z. B. offensive Mittelfeldspieler auch vorne). Nicht verfügbare Spieler
// stehen ausgegraut mit Hinweis in der Liste. Kapitän wird AUSDRÜCKLICH
// gewählt: Binde („C“) an der Karte antippen — keine Automatik mehr.
// Reihen von vorne nach hinten: Angriff oben, Abwehr + Tor unten.
// ─────────────────────────────────────────────────────────────

const REIHEN = [[4], [2, 3], [1, 0]]

export interface ElfStand {
  elf: (string | null)[]
  kapitaen?: string
  frei: boolean
}

export function DeineElf({
  kader,
  stand,
  freiErlaubt,
  gesperrt,
  vorschlag,
  onChange,
}: {
  kader: Map<string, KaderSpieler>
  stand: ElfStand
  freiErlaubt: boolean
  gesperrt?: boolean
  /** v21-UX: Vorschlags-Elf (letzte Vereins-Startelf) für neue Tipper. */
  vorschlag?: VorschlagElf
  onChange: (s: ElfStand) => void
}) {
  const [wahl, setWahl] = useState<number | null>(null) // Platz für die Auswahl-Liste
  const [aktion, setAktion] = useState<number | null>(null) // Platz für Kapitän/Tauschen

  const setzen = (slot: number, id: string | null) => {
    const elf = [...stand.elf]
    // Spieler war schon woanders? → Plätze tauschen (wenn der andere dort passt)
    const alt = id ? elf.indexOf(id) : -1
    if (alt !== -1 && alt !== slot) {
      const anderer = elf[slot]
      elf[alt] = anderer && passt(alt, kader.get(anderer), stand.frei) ? anderer : null
    }
    elf[slot] = id
    // Kapitän bleibt nur, wenn er noch auf dem Platz steht — sonst bewusst neu wählen
    const kap = stand.kapitaen && elf.includes(stand.kapitaen) ? stand.kapitaen : undefined
    onChange({ ...stand, elf, kapitaen: kap })
    haptik(8)
  }

  const kapitaenSetzen = (id: string) => {
    if (gesperrt) return
    onChange({ ...stand, kapitaen: id })
    haptik([10, 40, 14])
    try {
      localStorage.setItem('sva-tipp-binde-gesehen', '1')
    } catch {
      /* egal */
    }
  }

  // leere Plätze mit den treffsichersten verfügbaren Spielern füllen (Kapitän bleibt deine Wahl)
  const auffuellen = () => {
    const elf = [...stand.elf]
    const nach = [...kader.values()].filter(verfuegbar).sort((a, b) => b.tore - a.tore || b.spiele - a.spiele || (a.nummer ?? 99) - (b.nummer ?? 99))
    elf.forEach((id, i) => {
      if (id) return
      const k = nach.find((x) => !elf.includes(x.id) && (stand.frei || x.position === PLAETZE[i].pos)) ?? nach.find((x) => !elf.includes(x.id) && passt(i, x, stand.frei))
      if (k) elf[i] = k.id
    })
    onChange({ ...stand, elf })
    haptik([6, 30, 6, 30, 6])
  }

  // v21-UX (Vorschlag): letzte Vereins-Startelf übernehmen — Spieler setzen,
  // Kapitän bleibt DEINE bewusste Wahl. Nie automatisch abgegeben.
  const vorschlagUebernehmen = () => {
    if (!vorschlag) return
    const frei = !!vorschlag.frei && freiErlaubt
    const ids = elfEinordnen(
      vorschlag.spieler.map((x) => (x && kader.has(x) ? x : undefined)),
      kader,
      frei,
    )
    onChange({ elf: ids, kapitaen: undefined, frei })
    haptik([8, 36, 10])
  }

  const freiUmschalten = () => {
    const frei = !stand.frei
    const elf = frei ? stand.elf : stand.elf.map((id, i) => (id && passt(i, kader.get(id), false) ? id : null))
    const kap = stand.kapitaen && elf.includes(stand.kapitaen) ? stand.kapitaen : undefined
    onChange({ elf, kapitaen: kap, frei })
  }

  const voll = stand.elf.filter(Boolean).length
  // Hinweis zur Binde nur, solange noch nie ein Kapitän gewählt wurde
  const bindeHinweis = (() => {
    if (gesperrt || stand.kapitaen || voll === 0) return false
    try {
      return localStorage.getItem('sva-tipp-binde-gesehen') !== '1'
    } catch {
      return true
    }
  })()
  const ersterSlot = REIHEN.flat().find((i) => !!stand.elf[i])
  const wahlSlot = wahl ?? 0
  const soll = PLAETZE[wahlSlot].pos
  const kandidaten = [...kader.values()]
    .filter((k) => stand.frei || passt(wahlSlot, k, false))
    .sort(
      (a, b) =>
        Number(!verfuegbar(a)) - Number(!verfuegbar(b)) ||
        (stand.frei ? 0 : Number(a.position !== soll) - Number(b.position !== soll)) ||
        b.tore - a.tore ||
        b.spiele - a.spiele ||
        (a.nummer ?? 99) - (b.nummer ?? 99),
    )
  const aktSpieler = aktion != null ? kader.get(stand.elf[aktion] ?? '') : undefined

  return (
    <div className="tp-elf">
      <div className="tp-platz" aria-label={`Deine Elf: ${voll} von 5 Plätzen besetzt`}>
        <svg className="tp-platz__linien" viewBox="0 0 100 140" preserveAspectRatio="none" aria-hidden="true">
          <rect x="4" y="3" width="92" height="134" />
          <line x1="4" y1="3" x2="96" y2="3" />
          <path d="M 38 3 A 12 12 0 0 0 62 3" />
          <path d="M 26 137 L 26 114 L 74 114 L 74 137" />
          <path d="M 40 137 L 40 128 L 60 128 L 60 137" />
          <path d="M 41 114 A 10 10 0 0 1 59 114" />
          <circle cx="50" cy="121" r=".9" />
        </svg>
        {REIHEN.map((reihe, r) => (
          <div key={r} className={`tp-platz__reihe tp-platz__reihe--${reihe.length}`}>
            {reihe.map((slot) => {
              const id = stand.elf[slot]
              const k = id ? kader.get(id) : undefined
              const kap = !!k && stand.kapitaen === k.id
              const fehlt = !!k && !verfuegbar(k)
              return (
                <div key={slot} className={`tp-slot${kap ? ' is-kapitaen' : ''}${fehlt ? ' is-fehlt' : ''}`}>
                  <span className="tp-slot__pos">{stand.frei ? 'Frei' : PLAETZE[slot].label}</span>
                  {k ? (
                    <motion.div
                      className="tp-slot__karte"
                      initial={{ opacity: 0, scale: 0.86, y: 8 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
                      key={k.id}
                    >
                      <SpielerKarte spieler={k} kapitaen={kap} onClick={gesperrt ? undefined : () => setAktion(slot)} />
                      {!gesperrt && (
                        <button
                          type="button"
                          className={`tp-binde-knopf${kap ? ' is-an' : ''}`}
                          aria-pressed={kap}
                          aria-label={kap ? `${k.name} ist dein Kapitän` : `${k.name} zum Kapitän machen`}
                          onClick={() => kapitaenSetzen(k.id)}
                        >
                          C
                        </button>
                      )}
                      {bindeHinweis && slot === ersterSlot && (
                        <motion.span className="tp-binde-tipp" role="note" initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.4, ease: [0.22, 1, 0.36, 1] }}>
                          Tippe auf „C“, um deinen Kapitän zu wählen
                        </motion.span>
                      )}
                      {kap && (
                        <motion.span className="tp-slot__kap" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}>
                          <Crown size={12} strokeWidth={2} aria-hidden="true" /> Kapitän ×2
                        </motion.span>
                      )}
                      {fehlt && <span className="tp-slot__fehlt">Nicht verfügbar</span>}
                    </motion.div>
                  ) : (
                    <button type="button" className="tp-slot__leer" onClick={() => !gesperrt && setWahl(slot)} disabled={gesperrt} aria-label={`Platz ${stand.frei ? 'frei' : POS_LANG[PLAETZE[slot].pos]} besetzen`}>
                      <Plus size={22} strokeWidth={1.5} aria-hidden="true" />
                      <span>{stand.frei ? 'Spieler' : POS_LANG[PLAETZE[slot].pos]}</span>
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        ))}
      </div>

      {!gesperrt && (
        <div className="tp-elf__fuss">
          <p className={`tp-elf__hilfe${voll === 5 && !stand.kapitaen ? ' is-wichtig' : ''}`}>
            {voll < 5
              ? `${5 - voll} ${5 - voll === 1 ? 'Platz' : 'Plätze'} frei — Platz antippen.`
              : !stand.kapitaen
                ? 'Jetzt deinen Kapitän wählen: Binde „C“ antippen — er zählt doppelt.'
                : `Kapitän: ${nachname(kader.get(stand.kapitaen)?.name ?? '')} · Binde woanders antippen zum Wechseln.`}
          </p>
          {voll === 0 && vorschlag && vorschlag.spieler.some((x) => x && kader.has(x)) ? (
            <div className="tp-elf__vorschlag">
              <button type="button" className="tp-btn tp-btn--sm" onClick={vorschlagUebernehmen}>
                <Sparkles size={16} strokeWidth={1.5} aria-hidden="true" /> Vorschlag übernehmen
              </button>
              <small>
                {vorschlag.quelle ? `${vorschlag.quelle} — ` : 'Letzte Startelf — '}Spieler austauschen und Kapitän wählen kannst du danach.
              </small>
            </div>
          ) : (
            voll < 5 && (
              <button type="button" className="tp-btn tp-btn--line tp-btn--sm" onClick={auffuellen}>
                <Wand2 size={16} strokeWidth={1.5} aria-hidden="true" /> Freie Plätze füllen
              </button>
            )
          )}
          {freiErlaubt && (
            <label className="tp-umschalter">
              <input type="checkbox" checked={stand.frei} onChange={freiUmschalten} />
              <i aria-hidden="true" />
              <span>Frei aufstellen</span>
            </label>
          )}
        </div>
      )}

      {/* Auswahl-Liste für einen Platz */}
      <Sheet open={wahl !== null} onClose={() => setWahl(null)} label="tp-wahl" kicker={stand.frei ? 'Freier Platz' : POS_LANG[soll]} titel="Spieler wählen">
        <ul className="tp-wahl">
          {kandidaten.map((k) => {
            const drin = stand.elf.includes(k.id)
            const weg = !verfuegbar(k)
            const zweit = !stand.frei && k.position !== soll
            return (
              <li key={k.id}>
                <button
                  type="button"
                  disabled={weg}
                  onClick={() => {
                    setzen(wahlSlot, k.id)
                    setWahl(null)
                  }}
                  className={`${drin ? 'is-drin' : ''}${weg ? ' is-weg' : ''}`}
                >
                  <SpielerGesicht spieler={k} groesse={52} />
                  <span className="tp-wahl__name">
                    <b>{k.name}</b>
                    <small>
                      {k.nummer != null ? `#${k.nummer} · ` : ''}
                      {POS_LANG[k.position]}
                      {zweit && <span className="tp-tag tp-tag--zweit">auch {POS_LANG[soll]}</span>}
                      {!zweit && k.zweitposition && <span className="tp-tag">auch {k.zweitposition}</span>}
                      {drin && !weg && <span className="tp-tag tp-tag--ich">in deiner Elf</span>}
                    </small>
                    {weg && (
                      <small className="tp-wahl__weg">
                        <Ban size={12} strokeWidth={2} aria-hidden="true" /> Nicht verfügbar{k.hinweis ? ` · ${k.hinweis}` : ''}
                      </small>
                    )}
                  </span>
                  <span className="tp-wahl__zahlen">
                    <b>{k.spiele}</b>
                    <small>Spiele</small>
                  </span>
                  <span className="tp-wahl__zahlen">
                    <b>{k.tore}</b>
                    <small>Tore</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </Sheet>

      {/* Aktionen für einen besetzten Platz */}
      <Sheet open={aktion !== null && !!aktSpieler} onClose={() => setAktion(null)} label="tp-aktion" kicker={aktSpieler ? POS_LANG[aktSpieler.position] : ''} titel={aktSpieler ? nachname(aktSpieler.name) : ''}>
        {aktSpieler && aktion !== null && (
          <div className="tp-aktion">
            <div className="tp-aktion__karte">
              <SpielerKarte spieler={aktSpieler} kapitaen={stand.kapitaen === aktSpieler.id} gross />
            </div>
            <dl className="tp-aktion__zahlen">
              <div>
                <dt>Spiele</dt>
                <dd>{aktSpieler.spiele}</dd>
              </div>
              <div>
                <dt>Tore</dt>
                <dd>{aktSpieler.tore}</dd>
              </div>
              <div>
                <dt>Position</dt>
                <dd>
                  {aktSpieler.position}
                  {aktSpieler.zweitposition ? <small>/{aktSpieler.zweitposition}</small> : null}
                </dd>
              </div>
            </dl>
            {!verfuegbar(aktSpieler) && <p className="tp-hinweis tp-hinweis--fehler">Nicht verfügbar{aktSpieler.hinweis ? ` · ${aktSpieler.hinweis}` : ''} — bitte austauschen.</p>}
            <div className="tp-aktion__knoepfe">
              <button
                type="button"
                className="tp-btn tp-btn--gold"
                disabled={stand.kapitaen === aktSpieler.id}
                onClick={() => {
                  kapitaenSetzen(aktSpieler.id)
                  setAktion(null)
                }}
              >
                <Crown size={18} strokeWidth={1.5} aria-hidden="true" />
                {stand.kapitaen === aktSpieler.id ? 'Ist dein Kapitän' : 'Kapitänsbinde geben'}
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--line"
                onClick={() => {
                  setWahl(aktion)
                  setAktion(null)
                }}
              >
                <Repeat2 size={18} strokeWidth={1.5} aria-hidden="true" /> Austauschen
              </button>
              <button
                type="button"
                className="tp-btn tp-btn--text"
                onClick={() => {
                  setzen(aktion, null)
                  setAktion(null)
                }}
              >
                <UserMinus size={18} strokeWidth={1.5} aria-hidden="true" /> Rausnehmen
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  )
}

/** Kompakte Elf (gesperrt/Auflösung): Gesichter in einer Reihe. */
export function ElfReihe({ kader, spieler, kapitaen, punkte }: { kader: Map<string, KaderSpieler>; spieler: string[]; kapitaen?: string; punkte?: Map<string, number> }) {
  return (
    <ul className="tp-elfreihe">
      {spieler.map((id) => {
        const k = kader.get(id)
        const p = punkte?.get(id)
        return (
          <li key={id} className={kapitaen === id ? 'is-kapitaen' : ''}>
            <SpielerGesicht spieler={k} groesse={56} />
            <b>{k ? nachname(k.name) : '–'}</b>
            {kapitaen === id && <span className="tp-binde tp-binde--klein">C</span>}
            {p != null && <span className={`tp-elfreihe__p${p > 0 ? ' is-plus' : p < 0 ? ' is-minus' : ''}`}>{p > 0 ? `+${p}` : p}</span>}
          </li>
        )
      })}
    </ul>
  )
}
