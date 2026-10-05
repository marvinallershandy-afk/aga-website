import { useCallback, useEffect, useRef, useState } from 'react'
import type { Gutschein, Katalog, Mein, RanglistenEintrag } from './api'
import { Sticker } from './Sticker'
import { GRUPPEN, SPIELER_GRUPPEN, name, type Fortschritt, type Gruppe, type Platz, type Treue } from './model'

// ─────────────────────────────────────────────────────────────
// v17-A: Das aufgeschlagene Stickerheft (Vorlage: Higgsfield-Doppelseite
// „Foto des Jahres / Torhüter"): Retro-Papier, rot-schwarze Doppellinie,
// „AGA“-Stempel + Wappen in den Ecken, „est. 2024“, Spielfeld-Skizze auf
// den Spielerseiten. Leere Plätze = gestrichelter Umriss mit Nummer, der
// Name steht wie gedruckt auf dem Namensfeld darunter.
// Mobil: eine Seite, seitlich wischen (Scroll-Snap). Ab 960 px: Doppelseite.
// ─────────────────────────────────────────────────────────────

interface Props {
  ps: Platz[]
  katalog: Katalog
  mein: Mein
  fs: Fortschritt
  tr: Treue
  frisch: Set<string>
  wartende: number
  heimsiegWartet: boolean
  rangliste: RanglistenEintrag[] | null
  onPlatz: (p: Platz) => void
  onGutschein: (g: Gutschein) => void
  onPacks: () => void
  onKonto: () => void
}

interface SeiteDef {
  id: string
  titel: string
  kurz: string
  gruppe?: Gruppe
}

/** Seite mit diesem Platz in den sichtbaren Bereich blättern. */
export function zuPlatzBlaettern(key: string, sanft = true): HTMLElement | null {
  const el = document.querySelector<HTMLElement>(`[data-platz="${CSS.escape(key)}"]`)
  const seite = el?.closest<HTMLElement>('.hf-seite')
  const leiste = document.querySelector<HTMLElement>('.hf-seiten')
  if (el && seite && leiste) leiste.scrollTo({ left: seite.offsetLeft - leiste.offsetLeft, behavior: sanft ? 'smooth' : 'auto' })
  return el
}

export function Heft(props: Props) {
  const { ps, katalog, mein, fs, tr, frisch, wartende, heimsiegWartet, rangliste, onPlatz, onGutschein, onPacks, onKonto } = props
  const leiste = useRef<HTMLDivElement>(null)
  const [aktiv, setAktiv] = useState(0)

  const seiten: SeiteDef[] = [
    { id: 'inhalt', titel: 'Mein Heft', kurz: 'Inhalt' },
    ...GRUPPEN.filter((g) => ps.some((p) => p.gruppe === g.id)).map((g) => ({
      id: g.id,
      titel: g.id === 'moment' && ps.filter((p) => p.gruppe === 'moment').length > 1 ? 'Momente der Saison' : g.titel,
      kurz: g.kurz,
      gruppe: g.id,
    })),
    { id: 'letzte', titel: 'Treueste Fans', kurz: 'Fans-Liste' },
  ]

  const blaettern = useCallback((i: number) => {
    const el = leiste.current
    const s = el?.querySelectorAll<HTMLElement>('.hf-seite')[i]
    if (el && s) el.scrollTo({ left: s.offsetLeft - el.offsetLeft, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const el = leiste.current
    if (!el) return
    const onScroll = () => {
      const w = el.querySelector<HTMLElement>('.hf-seite')?.offsetWidth || el.clientWidth
      setAktiv(Math.round(el.scrollLeft / w))
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  const offeneGut = mein.gutscheine.filter((g) => g.saison === mein.saison || g.status === 'offen')

  return (
    <div className="hf">
      <nav className="hf-reiter" aria-label="Seiten im Heft">
        {seiten.map((s, i) => {
          const p = s.gruppe ? ps.filter((x) => x.gruppe === s.gruppe) : null
          return (
            <button key={s.id} type="button" className={`hf-reiter__b${aktiv === i ? ' is-aktiv' : ''}`} aria-current={aktiv === i ? 'page' : undefined} onClick={() => blaettern(i)}>
              {s.kurz}
              {p && (
                <small>
                  {p.filter((x) => x.beste).length}/{p.length}
                </small>
              )}
            </button>
          )
        })}
      </nav>

      <div className="hf-buch">
        <div className="hf-seiten" ref={leiste} tabIndex={0} aria-label="Stickerheft — seitlich wischen zum Blättern">
          {seiten.map((s, i) => (
            <section key={s.id} className={`hf-seite hf-seite--${s.gruppe ?? s.id}`} data-seite={i} aria-labelledby={`hf-t-${s.id}`}>
              <div className="hf-papier">
                <span className="hf-aga" aria-hidden="true">AGA</span>
                <img className="hf-wappen" src="/brand/aga-logo.png" alt="" aria-hidden="true" />
                <h2 className="hf-titel" id={`hf-t-${s.id}`}>
                  {s.titel}
                </h2>
                {s.gruppe && SPIELER_GRUPPEN.includes(s.gruppe) && <Spielfeld />}

                {s.id === 'inhalt' && (
                  <InhaltSeite
                    mein={mein}
                    fs={fs}
                    tr={tr}
                    wartende={wartende}
                    heimsiegWartet={heimsiegWartet}
                    gutscheine={offeneGut}
                    seiten={seiten}
                    ps={ps}
                    onBlaettern={blaettern}
                    onPacks={onPacks}
                    onGutschein={onGutschein}
                  />
                )}
                {s.gruppe && (
                  <ul className={`hf-plaetze hf-plaetze--${s.gruppe}`}>
                    {ps
                      .filter((p) => p.gruppe === s.gruppe)
                      .map((p) => (
                        <PlatzView key={p.key} p={p} frisch={frisch.has(p.key)} onPlatz={onPlatz} />
                      ))}
                  </ul>
                )}
                {s.id === 'letzte' && <LetzteSeite katalog={katalog} liste={rangliste} mitmachen={!!mein.profil?.rangliste} onKonto={onKonto} />}

                <span className="hf-est" aria-hidden="true">est. 2024</span>
                <span className="hf-nr" aria-hidden="true">{i + 1}</span>
              </div>
            </section>
          ))}
        </div>
      </div>

      <div className="hf-blaettern">
        <button type="button" className="al-iconbtn" onClick={() => blaettern(Math.max(0, aktiv - 1))} disabled={aktiv === 0} aria-label="Vorherige Seite">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
        <span>
          Seite {Math.min(aktiv + 1, seiten.length)} von {seiten.length} · wischen zum Blättern
        </span>
        <button type="button" className="al-iconbtn" onClick={() => blaettern(Math.min(seiten.length - 1, aktiv + 1))} disabled={aktiv >= seiten.length - 1} aria-label="Nächste Seite">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </button>
      </div>
    </div>
  )
}

function PlatzView({ p, frisch, onPlatz }: { p: Platz; frisch: boolean; onPlatz: (p: Platz) => void }) {
  const k = p.beste ?? p.versionen[0]
  const rot = (((p.nr * 37) % 5) - 2) * 0.7
  const moment = p.gruppe === 'moment'
  return (
    <li className={`hf-platz${frisch ? ' is-frisch' : ''}`} style={{ '--rot': `${rot}deg` } as React.CSSProperties}>
      <button type="button" className="hf-platz__btn" data-platz={p.key} onClick={() => onPlatz(p)} aria-label={`Nr. ${p.nr}: ${name(k)}${p.beste ? '' : ', fehlt noch'}`}>
        {p.beste ? (
          <Sticker karte={p.beste} />
        ) : (
          <span className="hf-leer" aria-hidden="true">
            <span className="hf-leer__nr">{p.nr}</span>
            <svg viewBox="0 0 100 120">
              {p.gruppe === 'partner' ? (
                <path d="M20 40h60a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H20a6 6 0 0 1-6-6V46a6 6 0 0 1 6-6zm10 14v12h40V54z" />
              ) : moment || p.gruppe === 'fan' ? (
                <path d="M50 18l9 22 24 2-18 16 6 24-21-13-21 13 6-24-18-16 24-2z" />
              ) : (
                <path d="M50 14c11 0 19 9 19 21s-8 23-19 23-19-11-19-23 8-21 19-21zM14 120c0-26 14-46 36-46s36 20 36 46z" />
              )}
            </svg>
          </span>
        )}
        {p.anzahl > 1 && <span className="hf-platz__n">×{p.anzahl}</span>}
        {frisch && <span className="hf-platz__neu">Neu</span>}
      </button>
      {moment ? (
        <p className="hf-unterschrift">
          {k.untertitel && <small>{k.untertitel}</small>}
          {k.titel}
        </p>
      ) : (
        <span className="hf-label">
          <b>{name(k)}</b>
        </span>
      )}
    </li>
  )
}

function Spielfeld() {
  return (
    <svg className="hf-feld" viewBox="0 0 300 420" preserveAspectRatio="none" aria-hidden="true">
      <rect x="6" y="6" width="288" height="408" />
      <line x1="6" y1="210" x2="294" y2="210" />
      <circle cx="150" cy="210" r="38" />
      <rect x="70" y="6" width="160" height="62" />
      <rect x="112" y="6" width="76" height="24" />
      <rect x="70" y="352" width="160" height="62" />
      <rect x="112" y="390" width="76" height="24" />
    </svg>
  )
}

function InhaltSeite({
  mein,
  fs,
  tr,
  wartende,
  heimsiegWartet,
  gutscheine,
  seiten,
  ps,
  onBlaettern,
  onPacks,
  onGutschein,
}: {
  mein: Mein
  fs: Fortschritt
  tr: Treue
  wartende: number
  heimsiegWartet: boolean
  gutscheine: Gutschein[]
  seiten: SeiteDef[]
  ps: Platz[]
  onBlaettern: (i: number) => void
  onPacks: () => void
  onGutschein: (g: Gutschein) => void
}) {
  return (
    <div className="hf-inhalt">
      <p className="hf-gehoert">
        Dieses Heft gehört: <b>{mein.profil?.anzeigename}</b>
      </p>
      <div className="hf-stand">
        <p className="hf-stand__zahl" aria-label={`${fs.belegt} von ${fs.gesamt} Stickern eingeklebt`}>
          <b>{fs.belegt}</b>/{fs.gesamt}
          <small>Sticker</small>
        </p>
        <div className="hf-balken" aria-hidden="true">
          <i style={{ width: `${fs.gesamt ? (100 * fs.belegt) / fs.gesamt : 0}%` }} />
        </div>
        <p className="hf-stand__sub">
          Mannschaft {fs.spielerBelegt}/{fs.spielerGesamt}
          {fs.doppelte > 0 && <> · {fs.doppelte} Doppelte zum Tauschen</>}
          {fs.komplett && (
            <>
              {' '}
              · <b>Mannschaft komplett!</b>
            </>
          )}
        </p>
      </div>

      {wartende > 0 && (
        <button type="button" className="hf-tuetchen" onClick={onPacks}>
          <span className="hf-tuetchen__bild" aria-hidden="true" />
          <span>
            <b>{wartende === 1 ? '1 Tütchen wartet' : `${wartende} Tütchen warten`}</b>
            <small>{heimsiegWartet ? 'Heimsieg-Bonus! Jetzt aufreißen' : 'Jetzt aufreißen'}</small>
          </span>
        </button>
      )}

      {tr.stufen.length > 0 && (
        <div className="hf-treue" aria-labelledby="hf-treue-t">
          <h3 id="hf-treue-t">
            Treue-Pass <span>{tr.checkins} {tr.checkins === 1 ? 'Heimspiel' : 'Heimspiele'}</span>
          </h3>
          <ol className="hf-stempel" aria-label={`${tr.checkins} von ${tr.max} Stempeln`}>
            {Array.from({ length: tr.max }, (_, n) => {
              const stufe = tr.stufen.find((s) => s.checkins === n + 1)
              return (
                <li key={n} className={`${n < tr.checkins ? 'is-da' : ''}${stufe ? ' is-preis' : ''}`}>
                  {n < tr.checkins ? <img src="/brand/aga-logo.png" alt="" /> : <span>{n + 1}</span>}
                </li>
              )
            })}
          </ol>
          <p className="hf-treue__text">
            {tr.naechste ? (
              <>
                Noch <b>{tr.naechste.fehlen}</b> {tr.naechste.fehlen === 1 ? 'Heimspiel' : 'Heimspiele'} bis <b>{tr.naechste.titel}</b>
                {tr.naechste.partner && <> · präsentiert von {tr.naechste.partner.name}</>}
              </>
            ) : (
              <>Alle Treue-Belohnungen dieser Saison geholt — stark!</>
            )}
          </p>
        </div>
      )}

      {gutscheine.length > 0 && (
        <ul className="hf-gutscheine" aria-label="Deine Gutscheine">
          {gutscheine.map((g) => (
            <li key={g.id}>
              <button type="button" className={`hf-gut${g.status === 'eingeloest' ? ' is-eingeloest' : ''}`} onClick={() => onGutschein(g)}>
                <b>{g.titel}</b>
                <span>{g.code}</span>
                <em>{g.stufe === 'komplett' ? 'Verlosung' : g.status === 'eingeloest' ? 'Eingelöst' : 'Am Stand zeigen →'}</em>
              </button>
            </li>
          ))}
        </ul>
      )}

      <h3 className="hf-zwischen">Inhalt</h3>
      <ol className="hf-verzeichnis">
        {seiten.slice(1).map((s, idx) => {
          const p = s.gruppe ? ps.filter((x) => x.gruppe === s.gruppe) : null
          return (
            <li key={s.id}>
              <button type="button" onClick={() => onBlaettern(idx + 1)}>
                <span>{s.titel}</span>
                <i aria-hidden="true" />
                <span>{p ? `${p.filter((x) => x.beste).length}/${p.length}` : `S. ${idx + 2}`}</span>
              </button>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

function LetzteSeite({ katalog, liste, mitmachen, onKonto }: { katalog: Katalog; liste: RanglistenEintrag[] | null; mitmachen: boolean; onKonto: () => void }) {
  const r = katalog.regeln
  const komplett = r.belohnungen.find((b) => b.stufe === 'komplett')
  return (
    <div className="hf-letzte">
      {liste === null ? (
        <p className="hf-klein">Lädt …</p>
      ) : liste.length === 0 ? (
        <p className="hf-klein">Noch niemand in der Rangliste — die ersten Check-ins entscheiden.</p>
      ) : (
        <ol className="hf-rang">
          {liste.slice(0, 10).map((e) => (
            <li key={`${e.platz}-${e.name}`} className={e.ich ? 'is-ich' : undefined}>
              <span className="hf-rang__p">{e.platz}.</span>
              <span className="hf-rang__n">
                {e.name}
                {e.ich && <small> (du)</small>}
              </span>
              <span className="hf-rang__w">{e.checkins} Spiele</span>
            </li>
          ))}
        </ol>
      )}
      {!mitmachen && (
        <p className="hf-klein">
          Du stehst nicht in der Liste.{' '}
          <button type="button" className="hf-link" onClick={onKonto}>
            Mitmachen
          </button>
        </p>
      )}

      <h3 className="hf-zwischen">So funktioniert’s</h3>
      <ol className="hf-regeln">
        <li>
          <b>Scannen:</b> Bei jedem Heimspiel hängt am Eingang ein QR-Code — gültig ab {r.fensterVorMin} Minuten vor Anstoß bis kurz nach Abpfiff.
        </li>
        <li>
          <b>Aufreißen:</b> Pro Check-in ein Tütchen mit {r.kartenProPack === 1 ? 'einem Sticker' : `${r.kartenProPack} Stickern`}
          {r.bonusHeimsieg && ', bei einem Heimsieg ein Bonus-Tütchen'}.
        </li>
        <li>
          <b>Einkleben &amp; abholen:</b>{' '}
          {r.belohnungen
            .filter((b) => b.checkins)
            .map((b) => `${b.checkins}. Heimspiel: ${b.titel}`)
            .join(' · ')}
          {komplett && ` · Ganze Mannschaft im Heft: ${komplett.titel}`}.
        </li>
      </ol>
      <dl className="hf-chancen" aria-label="Chance pro Sticker">
        {(
          [
            ['bronze', 'Kader'],
            ['silber', 'Silber'],
            ['gold', 'Gold'],
            ['spezial', 'Glitzer'],
          ] as const
        ).map(([s, l]) => (
          <div key={s} className={`hf-chancen__s hf-chancen__s--${s}`}>
            <dt>{l}</dt>
            <dd>{String(r.chancen[s]).replace('.', ',')} %</dd>
          </div>
        ))}
      </dl>
      <p className="hf-klein">Chance je Sticker. Kostet nichts, nichts zu kaufen — nur Dabeisein zählt.</p>
    </div>
  )
}
