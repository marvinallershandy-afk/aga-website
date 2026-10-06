import { useMemo, useState } from 'react'
import { Check, Copy, Gift, Share2, Users } from 'lucide-react'
import {
  AlbumFehler,
  codeEinloesen,
  freundHinzufuegen,
  tauschAnbieten,
  tauschZurueckziehen,
  wunschkarte,
  type Karte,
  type Katalog,
  type Mein,
  type PackArt,
} from './api'
import { SvaKarte } from '../karten/SvaKarte'
import { kartenDaten } from './kartenDaten'
import { doppelteListe, name, type Platz } from './model'
import { Zaehler } from './Zaehler'
import { ZieleVitrine } from './Ziele'

// ─────────────────────────────────────────────────────────────
// v20-K: Sammel-Seite des Albums: Code einlösen (Story/Partner/Advent),
// Sammelziele, Freunde (Freund-Bonus), Tauschen (Link/Code, 1:1),
// Wunschkarte (3 Doppelte → 1 Karte), Lose & Verlosungen, Adventskalender.
// Alles über RPCs — der Server prüft Regeln und Limits.
// ─────────────────────────────────────────────────────────────

const CODE_TEXT: Record<string, string> = {
  ungueltig: 'Diesen Code kennen wir nicht. Bitte noch einmal prüfen.',
  noch_nicht: 'Der Code gilt erst ab seinem Tag. Bis dann!',
  abgelaufen: 'Der Code ist abgelaufen — Story-Codes gelten 24 Stunden.',
  schon: 'Diesen Code hast du schon eingelöst.',
  gesperrt: 'Zu viele Versuche. Bitte in einer Stunde noch einmal.',
  kein_profil: 'Bitte zuerst deinen Vornamen speichern.',
}

export interface PackNeu {
  id: string
  art: PackArt
  titel?: string
}

interface Props {
  katalog: Katalog
  mein: Mein
  ps: Platz[]
  besitz: Map<string, number>
  onPack: (p: PackNeu) => void
  onNeu: () => void
}

function Fehler({ text }: { text: string }) {
  return text ? (
    <p className="al-hinweis al-hinweis--fehler" role="alert">
      {text}
    </p>
  ) : null
}
const fehlerVon = (e: unknown) => (e instanceof AlbumFehler ? e.message : 'Das hat nicht geklappt. Bitte gleich noch einmal.')

export function CodeEinloesen({ onPack, onNeu, vorbelegt }: { onPack: Props['onPack']; onNeu: () => void; vorbelegt?: string }) {
  const [code, setCode] = useState(vorbelegt ?? '')
  const [laeuft, setLaeuft] = useState(false)
  const [text, setText] = useState('')
  const senden = async (e: React.FormEvent) => {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c.length < 4) return
    setLaeuft(true)
    setText('')
    try {
      const r = await codeEinloesen(c)
      if (r.ok) {
        setCode('')
        onPack({ id: r.packId, art: r.art, titel: r.titel })
        onNeu()
      } else setText(CODE_TEXT[r.grund] ?? CODE_TEXT.ungueltig)
    } catch (err) {
      setText(fehlerVon(err))
    } finally {
      setLaeuft(false)
    }
  }
  return (
    <form className="sa-code" onSubmit={(e) => void senden(e)}>
      <label className="al-feld">
        Code aus Story, Laden oder Adventskalender
        <span className="sa-code__zeile">
          <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="z. B. SVA-K7P3" autoComplete="off" autoCapitalize="characters" spellCheck={false} maxLength={24} />
          <button type="submit" className="al-btn" disabled={laeuft || code.trim().length < 4}>
            {laeuft ? '…' : 'Einlösen'}
          </button>
        </span>
      </label>
      <Fehler text={text} />
    </form>
  )
}

// v21-A: Ziele als Medaillen-Vitrine (Ziele.tsx); Leiste oben mit Mini-Medaille
export { NaechstesZiel } from './Ziele'

function Freunde({ mein, onNeu }: { mein: Mein; onNeu: () => void }) {
  const [code, setCode] = useState('')
  const [text, setText] = useState('')
  const [ok, setOk] = useState('')
  const link = mein.freundCode ? `${window.location.origin}/album?f=${mein.freundCode}` : ''
  const teilen = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'SVA-Sammelalbum', text: 'Sammel mit mir im SVA-Album — wenn wir beide beim Heimspiel einchecken, gibt es eine Extra-Karte.', url: link })
      else await navigator.clipboard.writeText(link)
      setOk('Link kopiert.')
    } catch {
      /* abgebrochen */
    }
  }
  const hinzu = async (e: React.FormEvent) => {
    e.preventDefault()
    setText('')
    try {
      const r = await freundHinzufuegen(code.trim().toUpperCase())
      setOk(`${r.name} ist jetzt dein Freund im Album.`)
      setCode('')
      onNeu()
    } catch (err) {
      setText(fehlerVon(err))
    }
  }
  return (
    <div className="sa-block">
      <h3 className="hf-zwischen">
        Freunde <span>{mein.freunde?.length ?? 0}</span>
      </h3>
      <p className="hf-klein">Checkt ihr beim selben Heimspiel ein, bekommt ihr beide eine Extra-Karte.</p>
      {mein.freundCode && (
        <div className="sa-freund-code">
          <span>
            Dein Code <b>{mein.freundCode}</b>
          </span>
          <button type="button" className="al-btn al-btn--sm al-btn--ghost" onClick={() => void teilen()}>
            <Share2 size={14} strokeWidth={1.5} aria-hidden="true" /> Einladen
          </button>
        </div>
      )}
      <form className="sa-code__zeile" onSubmit={(e) => void hinzu(e)}>
        <input aria-label="Code eines Freundes" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="Code eines Freundes" maxLength={12} autoCapitalize="characters" />
        <button type="submit" className="al-btn al-btn--ghost" disabled={code.trim().length < 4}>
          <Users size={16} strokeWidth={1.5} aria-hidden="true" /> Hinzufügen
        </button>
      </form>
      {(mein.freunde?.length ?? 0) > 0 && <p className="hf-klein">{mein.freunde!.join(' · ')}</p>}
      <Fehler text={text} />
      {ok && <p className="al-hinweis al-hinweis--ok">{ok}</p>}
    </div>
  )
}

function KartenWahl({ karten, wahl, onWahl, katalog, ps, leer }: { karten: Karte[]; wahl: string[]; onWahl: (id: string) => void; katalog: Katalog; ps: Platz[]; leer: string }) {
  const nr = useMemo(() => new Map(ps.flatMap((p) => [...p.versionen, ...p.glanz].map((v) => [v.id, p.nr] as const))), [ps])
  if (!karten.length) return <p className="hf-klein">{leer}</p>
  return (
    <ul className="sa-wahl hb-nicht-ziehen">
      {karten.map((k) => {
        const n = wahl.filter((w) => w === k.id).length
        return (
          <li key={k.id}>
            <button type="button" className={n ? 'is-gewaehlt' : undefined} onClick={() => onWahl(k.id)} aria-pressed={n > 0} aria-label={name(k)}>
              <SvaKarte daten={kartenDaten(k, nr.get(k.id), undefined, katalog.saison)} stufe="klein" />
              {n > 0 && <span className="sa-wahl__n">{n > 1 ? `×${n}` : <Check size={14} strokeWidth={2} aria-hidden="true" />}</span>}
            </button>
          </li>
        )
      })}
    </ul>
  )
}

function Tauschen({ katalog, mein, ps, besitz, onNeu }: Props) {
  const doppelte = doppelteListe(katalog, besitz).map((d) => d.karte)
  const fehlend = ps.filter((p) => p.gruppe !== 'bonus' && !p.beste).map((p) => p.versionen[0])
  const [biete, setBiete] = useState<string | null>(null)
  const [wunsch, setWunsch] = useState<string | null>(null)
  const [text, setText] = useState('')
  const [link, setLink] = useState('')
  const zuNeu = (mein.kontoTage ?? 99) < (katalog.regeln.tauschMinTage ?? 7)
  const anbieten = async () => {
    if (!biete || !wunsch) return
    setText('')
    try {
      const r = await tauschAnbieten(biete, wunsch)
      const url = `${window.location.origin}/album?t=${r.code}`
      setLink(url)
      setBiete(null)
      setWunsch(null)
      onNeu()
      try {
        if (navigator.share) await navigator.share({ title: 'Tausch im SVA-Album', text: 'Ich tausche eine Karte mit dir:', url })
        else await navigator.clipboard.writeText(url)
      } catch {
        /* egal */
      }
    } catch (e) {
      setText(fehlerVon(e))
    }
  }
  const offen = (mein.tausche ?? []).filter((t) => t.status === 'offen')
  return (
    <div className="sa-block">
      <h3 className="hf-zwischen">
        Tauschen <span>{mein.tauscheWoche ?? 0}/{katalog.regeln.tauschProWoche ?? 5} diese Woche</span>
      </h3>
      {zuNeu ? (
        <p className="hf-klein">Tauschen geht ab {katalog.regeln.tauschMinTage ?? 7} Tagen im Album — so bleibt es fair.</p>
      ) : (
        <>
          <p className="hf-klein">1. Eine Doppelte anbieten · 2. Wunschkarte wählen · 3. Link an einen Freund schicken.</p>
          <KartenWahl karten={doppelte} wahl={biete ? [biete] : []} onWahl={(id) => setBiete(id === biete ? null : id)} katalog={katalog} ps={ps} leer="Noch keine Doppelten." />
          {biete && (
            <>
              <p className="hf-klein">Dafür möchtest du:</p>
              <KartenWahl karten={fehlend} wahl={wunsch ? [wunsch] : []} onWahl={(id) => setWunsch(id === wunsch ? null : id)} katalog={katalog} ps={ps} leer="Dir fehlt keine Karte mehr." />
            </>
          )}
          <button type="button" className="al-btn al-btn--gross" disabled={!biete || !wunsch} onClick={() => void anbieten()}>
            <Share2 size={16} strokeWidth={1.5} aria-hidden="true" /> Tausch-Link erstellen
          </button>
        </>
      )}
      {link && (
        <p className="al-hinweis al-hinweis--ok">
          Link kopiert: <span className="sa-link">{link}</span>
        </p>
      )}
      {offen.length > 0 && (
        <ul className="sa-tausche">
          {offen.map((t) => (
            <li key={t.code}>
              <span>
                {t.eigen ? 'Du bietest' : `${t.partner ?? 'Ein Fan'} bietet`} <b>{name(katalog.karten.find((k) => k.id === t.biete) ?? ({ titel: '?' } as Karte))}</b> gegen{' '}
                <b>{name(katalog.karten.find((k) => k.id === t.wunsch) ?? ({ titel: '?' } as Karte))}</b>
              </span>
              {t.eigen && (
                <button
                  type="button"
                  className="al-btn al-btn--sm al-btn--ghost"
                  onClick={async () => {
                    try {
                      await tauschZurueckziehen(t.code)
                      onNeu()
                    } catch (e) {
                      setText(fehlerVon(e))
                    }
                  }}
                >
                  Zurückziehen
                </button>
              )}
              {t.eigen && (
                <button type="button" className="al-iconbtn" aria-label="Link kopieren" onClick={() => void navigator.clipboard?.writeText(`${window.location.origin}/album?t=${t.code}`)}>
                  <Copy size={16} strokeWidth={1.5} aria-hidden="true" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      <Fehler text={text} />
    </div>
  )
}

function Wunsch({ katalog, ps, besitz, onPack, onNeu }: Props) {
  const kosten = katalog.regeln.wunschKosten ?? 3
  const doppelte = doppelteListe(katalog, besitz)
  const vorrat = doppelte.reduce((a, d) => a + d.extra, 0)
  const ziele = ps.filter((p) => p.gruppe !== 'bonus' && !p.beste).map((p) => p.versionen[0]).filter((k) => k.seltenheit === 'bronze' || k.seltenheit === 'silber')
  const [wunsch, setWunsch] = useState<string | null>(null)
  const [gegen, setGegen] = useState<string[]>([])
  const [text, setText] = useState('')
  const extra = new Map(doppelte.map((d) => [d.karte.id, d.extra]))
  const waehle = (id: string) =>
    setGegen((g) => {
      const n = g.filter((x) => x === id).length
      if (n < (extra.get(id) ?? 0) && g.length < kosten) return [...g, id]
      return g.filter((x) => x !== id)
    })
  const los = async () => {
    if (!wunsch || gegen.length !== kosten) return
    setText('')
    try {
      const r = await wunschkarte(wunsch, gegen)
      setWunsch(null)
      setGegen([])
      onPack({ id: r.packId, art: 'wunsch', titel: 'Wunschkarte' })
      onNeu()
    } catch (e) {
      setText(fehlerVon(e))
    }
  }
  return (
    <div className="sa-block">
      <h3 className="hf-zwischen">
        Wunschkarte <span>{kosten} Doppelte → 1</span>
      </h3>
      {vorrat < kosten ? (
        <p className="hf-klein">
          Du hast {vorrat} {vorrat === 1 ? 'Doppelte' : 'Doppelte'}. Ab {kosten} kannst du dir eine fehlende Kader- oder Silber-Karte aussuchen.
        </p>
      ) : (
        <>
          <p className="hf-klein">Welche Karte fehlt dir?</p>
          <KartenWahl karten={ziele} wahl={wunsch ? [wunsch] : []} onWahl={(id) => setWunsch(id === wunsch ? null : id)} katalog={katalog} ps={ps} leer="Keine passende Karte offen." />
          {wunsch && (
            <>
              <p className="hf-klein">
                {kosten} Doppelte abgeben ({gegen.length}/{kosten}):
              </p>
              <KartenWahl karten={doppelte.map((d) => d.karte)} wahl={gegen} onWahl={waehle} katalog={katalog} ps={ps} leer="" />
            </>
          )}
          <button type="button" className="al-btn al-btn--gross" disabled={!wunsch || gegen.length !== kosten} onClick={() => void los()}>
            <Gift size={16} strokeWidth={1.5} aria-hidden="true" /> Wunschkarte holen
          </button>
        </>
      )}
      <Fehler text={text} />
    </div>
  )
}

function LoseVerlosungen({ katalog, mein }: { katalog: Katalog; mein: Mein }) {
  const v = mein.verlosungen ?? []
  return (
    <div className="sa-block">
      <h3 className="hf-zwischen">
        Deine Lose <span>Saison {mein.saison}</span>
      </h3>
      <div className="ls">
        <div className="ls-stapel" aria-hidden="true">
          {(mein.lose ?? 0) > 2 && <span className="ls-ticket ls-ticket--h2" />}
          {(mein.lose ?? 0) > 1 && <span className="ls-ticket ls-ticket--h1" />}
          <span className="ls-ticket ls-ticket--oben">
            <b>
              <Zaehler wert={mein.lose ?? 0} />
            </b>
            <i />
            <span>Los</span>
          </span>
        </div>
        <p className="ls-text">
          <b>
            {mein.lose ?? 0} {(mein.lose ?? 0) === 1 ? 'Los' : 'Lose'}
          </b>
          <span>aus Check-ins, Meilensteinen und Sammelzielen — je mehr Lose, desto größer die Chance bei der Verlosung.</span>
        </p>
      </div>
      {v.map((x) => (
        <div key={x.id} className={`sa-verlosung${x.gewonnen ? ' is-gewonnen' : ''}`}>
          {x.bildUrl && <img src={x.bildUrl} alt="" loading="lazy" />}
          <div>
            <small>{x.status === 'gezogen' ? 'Gezogen' : x.stichtag ? `Ziehung ${new Date(x.stichtag).toLocaleDateString('de-DE', { day: 'numeric', month: 'long' })}` : 'Verlosung'}</small>
            <b>{x.titel}</b>
            {x.preis && <span>{x.preis}</span>}
            {x.partner && <span>präsentiert von {x.partner.name}</span>}
            {x.status === 'gezogen' ? (
              <em>{x.gewonnen ? 'Du hast gewonnen! Wir melden uns bei dir.' : `Gewonnen hat ${x.gewinnerName ?? '—'}`}</em>
            ) : (
              <em className={x.teilnahme ? 'sa-verlosung__dabei' : undefined}>{x.teilnahme ? 'Du bist dabei' : 'Sammel Lose, um dabei zu sein.'}</em>
            )}
          </div>
        </div>
      ))}
      {katalog.regeln.teilnahmeText && (
        <details className="sa-teilnahme">
          <summary>Teilnahmebedingungen</summary>
          <p>{katalog.regeln.teilnahmeText}</p>
        </details>
      )}
    </div>
  )
}

export function Advent({ tage, onPack, onNeu }: { tage: { tag: number; eingeloest: boolean }[]; onPack: Props['onPack']; onNeu: () => void }) {
  const heute = new Date().getDate()
  return (
    <div className="sa-block sa-advent">
      <h3 className="hf-zwischen">
        Adventskalender <span>{tage.filter((t) => t.eingeloest).length}/24</span>
      </h3>
      <ol className="sa-tuerchen">
        {tage.map((t) => (
          <li key={t.tag} className={`${t.eingeloest ? 'is-offen' : ''}${t.tag === heute ? ' is-heute' : ''}${t.tag === 24 ? ' is-24' : ''}`}>
            <span>{t.tag}</span>
          </li>
        ))}
      </ol>
      <p className="hf-klein">Jeden Tag ein Code in unserer Instagram-Story. Am 24. wartet die Weihnachts-Spezialkarte.</p>
      <CodeEinloesen onPack={onPack} onNeu={onNeu} />
    </div>
  )
}

export function SammelSeite(props: Props) {
  const { mein, katalog, onPack, onNeu } = props
  return (
    <div className="sa">
      {mein.advent && <Advent tage={mein.advent} onPack={onPack} onNeu={onNeu} />}
      {!mein.advent && (
        <div className="sa-block">
          <h3 className="hf-zwischen">Code einlösen</h3>
          <CodeEinloesen onPack={onPack} onNeu={onNeu} />
        </div>
      )}
      {(mein.ziele?.length ?? 0) > 0 && <ZieleVitrine ziele={mein.ziele!} />}
      <Tauschen {...props} />
      <Wunsch {...props} />
      <Freunde mein={mein} onNeu={onNeu} />
      <LoseVerlosungen katalog={katalog} mein={mein} />
    </div>
  )
}
