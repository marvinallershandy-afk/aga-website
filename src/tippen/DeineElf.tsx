import { useState } from 'react'
import { motion } from 'framer-motion'
import { Crown, Plus, Repeat2, UserMinus } from 'lucide-react'
import type { KaderSpieler } from './api'
import { PLAETZE, POS_LANG, nachname, passt } from './model'
import { SpielerGesicht, SpielerKarte } from './SpielerKarte'
import { Sheet } from '../alltag/Sheet'

// ─────────────────────────────────────────────────────────────
// v20-T „Deine Elf“: 5 SVA-Spieler auf dem Platz (hinten TW/ABW, Mitte
// 2× MIT, vorne 2× ANG — oder frei), einer trägt die Kapitänsbinde (×2).
// Karten kommen über den Adapter SpielerKarte (playerMedia).
// Reihen von vorne nach hinten: Angriff oben, Torwart/Abwehr unten.
// ─────────────────────────────────────────────────────────────

const REIHEN = [[3, 4], [1, 2], [0]]

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
  onChange,
}: {
  kader: Map<string, KaderSpieler>
  stand: ElfStand
  freiErlaubt: boolean
  gesperrt?: boolean
  onChange: (s: ElfStand) => void
}) {
  const [wahl, setWahl] = useState<number | null>(null) // Platz für die Auswahl-Liste
  const [aktion, setAktion] = useState<number | null>(null) // Platz für Kapitän/Tauschen

  const setzen = (slot: number, id: string | null) => {
    const elf = [...stand.elf]
    // Spieler war schon woanders? → Plätze tauschen
    const alt = id ? elf.indexOf(id) : -1
    if (alt !== -1 && alt !== slot) elf[alt] = elf[slot]
    elf[slot] = id
    let kap = stand.kapitaen && elf.includes(stand.kapitaen) ? stand.kapitaen : undefined
    if (!kap) kap = elf.find((x) => !!x) ?? undefined
    onChange({ ...stand, elf, kapitaen: kap })
  }

  const freiUmschalten = () => {
    const frei = !stand.frei
    const elf = frei ? stand.elf : stand.elf.map((id, i) => (id && passt(i, kader.get(id), false) ? id : null))
    const kap = stand.kapitaen && elf.includes(stand.kapitaen) ? stand.kapitaen : (elf.find((x) => !!x) ?? undefined)
    onChange({ elf, kapitaen: kap, frei })
  }

  const voll = stand.elf.filter(Boolean).length
  const wahlSlot = wahl ?? 0
  const kandidaten = [...kader.values()]
    .filter((k) => stand.frei || PLAETZE[wahlSlot].erlaubt.includes(k.position))
    .sort((a, b) => b.tore - a.tore || b.spiele - a.spiele || (a.nummer ?? 99) - (b.nummer ?? 99))
  const aktSpieler = aktion != null ? kader.get(stand.elf[aktion] ?? '') : undefined

  return (
    <div className="tp-elf">
      <div className="tp-platz" aria-label={`Deine Elf: ${voll} von 5 Plätzen besetzt`}>
        <svg className="tp-platz__linien" viewBox="0 0 100 130" preserveAspectRatio="none" aria-hidden="true">
          <rect x="3" y="3" width="94" height="124" />
          <line x1="3" y1="3" x2="97" y2="3" />
          <path d="M 30 127 L 30 108 L 70 108 L 70 127" />
          <path d="M 41 127 L 41 120 L 59 120 L 59 127" />
          <path d="M 38 3 A 12 12 0 0 0 62 3" />
          <circle cx="50" cy="114" r=".8" />
        </svg>
        {REIHEN.map((reihe, r) => (
          <div key={r} className={`tp-platz__reihe tp-platz__reihe--${reihe.length}`}>
            {reihe.map((slot) => {
              const id = stand.elf[slot]
              const k = id ? kader.get(id) : undefined
              const kap = !!k && stand.kapitaen === k.id
              return (
                <div key={slot} className="tp-slot">
                  {k ? (
                    <motion.div
                      className={`tp-slot__karte${kap ? ' is-kapitaen' : ''}`}
                      layoutId={`elf-${k.id}`}
                      initial={{ opacity: 0, scale: 0.86 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <SpielerKarte spieler={k} kapitaen={kap} onClick={gesperrt ? undefined : () => setAktion(slot)} />
                      {kap && <span className="tp-slot__kap">Kapitän ×2</span>}
                    </motion.div>
                  ) : (
                    <button type="button" className="tp-slot__leer" onClick={() => !gesperrt && setWahl(slot)} disabled={gesperrt} aria-label={`Platz ${PLAETZE[slot].label} besetzen`}>
                      <Plus size={22} strokeWidth={1.5} aria-hidden="true" />
                      <span>{stand.frei ? 'Frei' : PLAETZE[slot].label}</span>
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
          <p className="tp-elf__hilfe">
            {voll < 5 ? `${5 - voll} ${5 - voll === 1 ? 'Platz' : 'Plätze'} frei · ` : ''}Karte antippen für die Kapitänsbinde (zählt doppelt)
          </p>
          {freiErlaubt && (
            <label className="tp-schalter tp-schalter--klein">
              <input type="checkbox" checked={stand.frei} onChange={freiUmschalten} />
              <span>Frei aufstellen</span>
            </label>
          )}
        </div>
      )}

      {/* Auswahl-Liste für einen Platz */}
      <Sheet open={wahl !== null} onClose={() => setWahl(null)} label="tp-wahl" kicker={stand.frei ? 'Freier Platz' : POS_LANG[PLAETZE[wahlSlot].erlaubt[PLAETZE[wahlSlot].erlaubt.length - 1]]} titel="Spieler wählen">
        <ul className="tp-wahl">
          {kandidaten.map((k) => {
            const drin = stand.elf.includes(k.id)
            return (
              <li key={k.id}>
                <button
                  type="button"
                  onClick={() => {
                    setzen(wahlSlot, k.id)
                    setWahl(null)
                  }}
                  className={drin ? 'is-drin' : ''}
                >
                  <SpielerGesicht spieler={k} groesse={48} />
                  <span className="tp-wahl__name">
                    <b>{k.name}</b>
                    <small>
                      {k.nummer != null ? `#${k.nummer} · ` : ''}
                      {POS_LANG[k.position]}
                      {drin ? ' · in deiner Elf' : ''}
                    </small>
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
              <SpielerKarte spieler={aktSpieler} kapitaen={stand.kapitaen === aktSpieler.id} />
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
                <dd>{aktSpieler.position}</dd>
              </div>
            </dl>
            <div className="tp-aktion__knoepfe">
              <button
                type="button"
                className="tp-btn tp-btn--gold"
                disabled={stand.kapitaen === aktSpieler.id}
                onClick={() => {
                  onChange({ ...stand, kapitaen: aktSpieler.id })
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
export function ElfReihe({ kader, spieler, kapitaen }: { kader: Map<string, KaderSpieler>; spieler: string[]; kapitaen?: string }) {
  return (
    <ul className="tp-elfreihe">
      {spieler.map((id) => {
        const k = kader.get(id)
        return (
          <li key={id} className={kapitaen === id ? 'is-kapitaen' : ''}>
            <SpielerGesicht spieler={k} groesse={52} />
            <b>{k ? nachname(k.name) : '–'}</b>
            {kapitaen === id && <span className="tp-binde tp-binde--klein">C</span>}
          </li>
        )
      })}
    </ul>
  )
}
