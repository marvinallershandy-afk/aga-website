import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { UserRound } from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import {
  AlbumFehler,
  abmelden,
  aktuelleSitzung,
  albumKonfiguriert,
  checkin,
  ladeKatalog,
  ladeMein,
  ladeRangliste,
  supabase,
  type Gutschein,
  type Karte,
  type Katalog,
  type Mein,
  type PackArt,
  type PackInhalt,
  type PartnerInfo,
  type RanglistenEintrag,
  starterHolen,
} from './api'
import { Gesamtstand, Heft } from './Heft'
import { BLAETTERN_MS, zuPlatzBlaettern } from './blaettern'
import { KarteDetail } from './KarteDetail'
import { CodeEinloesen, NaechstesZiel, SammelSeite, Advent, type PackNeu } from './Sammeln'
import { TauschDialog } from './Tausch'
import { SvaKarte } from '../karten/SvaKarte'
import { kartenDaten } from './kartenDaten'
import { Zaehler } from './Zaehler'
import { vibriere } from '../karten/medien'
import { GutscheinAnsicht } from './Gutschein'
import { KontoDialog } from './Konto'
import { Login } from './Login'
import { PackOpening } from './PackOpening'
import { ProfilForm } from './Profil'
import { MEILENSTEINE, besitzMap, fortschritt, karteById, plaetze, reduzierteBewegung, treue, type Platz } from './model'
import { InstagramZeile } from '../ui/InstagramZeile'

// ─────────────────────────────────────────────────────────────
// v17-A: Seite /album — „Das offizielle Stickerheft“ des SVA mit
// QR-Check-in (Treue-Pass). Startbild = geschlossenes Heft auf dem
// Kneipentisch (Higgsfield-Vorlage des Vereins); Tippen schlägt es auf.
// Einstieg vom QR-Code: /album?c=<token> → (Login) → Check-in → Tütchen
// → neue Sticker fliegen an ihren Platz im Heft („Einkleben“).
// Eigenes schlankes Bundle (album.html): kein three.js, keine Onepager-CSS.
// ─────────────────────────────────────────────────────────────

const C_KEY = 'sva-album-c'
const C_TS = 'sva-album-c-t'
const OFFEN_KEY = 'sva-album-offen'
const ENDGUELTIG = new Set(['album_code_zu_frueh', 'album_code_abgelaufen', 'album_code_unbekannt', 'album_schon_eingecheckt', 'album_pausiert'])

function speicher(fn: () => void) {
  try {
    fn()
  } catch {
    /* privat-Modus */
  }
}
/** ?c= aus der URL übernehmen (6 h gemerkt — überlebt den Login-Umweg) und aus
 *  der Adresszeile entfernen. `unlesbar` = es stand ein ?c= in der URL, war aber
 *  kein gültiger Code (Audit B §2.6: dann freundlichen Hinweis zeigen). */
function tokenUebernehmen(): { token: string | null; unlesbar: boolean } {
  let neu: string | null = null
  let unlesbar = false
  try {
    const url = new URL(window.location.href)
    const c = url.searchParams.get('c')
    if (c) {
      if (/^[A-Za-z0-9]{16,64}$/.test(c)) neu = c.toLowerCase()
      else unlesbar = true
    }
    if (url.searchParams.has('c')) {
      url.searchParams.delete('c')
      window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash)
    }
  } catch {
    /* egal */
  }
  if (neu) {
    speicher(() => {
      localStorage.setItem(C_KEY, neu!)
      localStorage.setItem(C_TS, String(Date.now()))
    })
    return { token: neu, unlesbar: false }
  }
  try {
    const t = localStorage.getItem(C_KEY)
    const ts = Number(localStorage.getItem(C_TS) || 0)
    if (t && Date.now() - ts < 6 * 3600_000) return { token: t, unlesbar }
    localStorage.removeItem(C_KEY)
  } catch {
    /* egal */
  }
  return { token: null, unlesbar }
}
function tokenVergessen() {
  speicher(() => {
    localStorage.removeItem(C_KEY)
    localStorage.removeItem(C_TS)
  })
}

type CheckinStatus =
  | { status: 'laeuft' }
  | { status: 'ok'; gegner: string; checkins: number }
  | { status: 'fehler'; text: string; nochmal: boolean }

interface PackAuftrag {
  id: string
  art: PackArt
  gegner?: string
  titel?: string
  partner?: PartnerInfo
}

/** v20-K: einmalige URL-Parameter (Tausch-Link, Freundes-Code, Story-Code). */
function urlParam(name: string, re: RegExp): string | null {
  try {
    const url = new URL(window.location.href)
    const v = url.searchParams.get(name)
    if (!url.searchParams.has(name)) return null
    url.searchParams.delete(name)
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash)
    return v && re.test(v) ? v.toUpperCase() : null
  } catch {
    return null
  }
}

export function AlbumApp() {
  const ruhig = useMemo(() => reduzierteBewegung(), [])
  const [katalog, setKatalog] = useState<Katalog | null>(null)
  const [katalogFehlt, setKatalogFehlt] = useState(false)
  const [session, setSession] = useState<Session | null | undefined>(undefined)
  const [meinRoh, setMein] = useState<Mein | null>(null)
  const [meinFehler, setMeinFehler] = useState('')
  const start = useMemo(() => tokenUebernehmen(), [])
  const [token, setToken] = useState<string | null>(start.token)
  const [codeUnlesbar, setCodeUnlesbar] = useState(start.unlesbar)
  const [ci, setCi] = useState<CheckinStatus | null>(null)
  const [packs, setPacks] = useState<PackAuftrag[]>([])
  const [detail, setDetail] = useState<Platz | null>(null)
  const [gutschein, setGutschein] = useState<Gutschein | null>(null)
  const [konto, setKonto] = useState(false)
  const [rangliste, setRangliste] = useState<RanglistenEintrag[] | null>(null)
  const [abschied, setAbschied] = useState(false)
  const [offen, setOffen] = useState(() => {
    try {
      return sessionStorage.getItem(OFFEN_KEY) === '1'
    } catch {
      return false
    }
  })
  const [aufschlagen, setAufschlagen] = useState(false)
  // Einkleben: Warteschlange neuer Karten (bis zur Landung im Heft unsichtbar)
  const [kleben, setKleben] = useState<string[]>([])
  const [flug, setFlug] = useState<{ karte: Karte; platzKey: string; nr: number; rect: DOMRect } | null>(null)
  const [frisch, setFrisch] = useState<Set<string>>(() => new Set())
  const [tauschCode, setTauschCode] = useState<string | null>(() => urlParam('t', /^[A-Za-z0-9-]{4,24}$/))
  const [freundCode] = useState<string | null>(() => urlParam('f', /^[A-Za-z0-9]{4,12}$/))
  const [storyCode] = useState<string | null>(() => urlParam('code', /^[A-Za-z0-9-]{4,24}$/))
  const [meldung, setMeldung] = useState<{ text: string; n: number } | null>(null)

  useEffect(() => {
    ladeKatalog()
      .then(setKatalog)
      .catch(() => setKatalogFehlt(true))
  }, [])

  useEffect(() => {
    let aktiv = true
    aktuelleSitzung().then((s) => aktiv && setSession(s))
    if (!albumKonfiguriert) return
    const { data } = supabase.auth.onAuthStateChange((_ev, s) => {
      if (aktiv) setSession(s)
    })
    return () => {
      aktiv = false
      data.subscription.unsubscribe()
    }
  }, [])

  const uid = session?.user?.id
  // Ohne Sitzung gibt es kein Heft (abgeleitet statt im Effekt zurückgesetzt)
  const mein = uid ? meinRoh : null
  const neuLaden = useCallback(async () => {
    try {
      const m = await ladeMein()
      setMein(m)
      setMeinFehler('')
      return m
    } catch (e) {
      setMeinFehler(e instanceof AlbumFehler ? e.message : 'Das Heft konnte nicht geladen werden.')
      return null
    }
  }, [])

  useEffect(() => {
    if (uid) queueMicrotask(() => void neuLaden())
  }, [uid, neuLaden])

  const einchecken = useCallback(
    async (t: string) => {
      setCi({ status: 'laeuft' })
      try {
        const r = await checkin(t)
        tokenVergessen()
        setToken(null)
        setCi({ status: 'ok', gegner: r.spiel.gegner, checkins: r.checkins })
        const neu: PackAuftrag[] = []
        if (r.packId) neu.push({ id: r.packId, art: 'checkin', gegner: r.spiel.gegner, partner: r.partner })
        if (r.bonusPackId) neu.push({ id: r.bonusPackId, art: 'heimsieg', gegner: r.spiel.gegner, partner: r.partner })
        if (r.freundPackId) neu.push({ id: r.freundPackId, art: 'freund', titel: r.freunde?.length ? `Freundes-Bonus · mit ${r.freunde.join(', ')}` : 'Freundes-Bonus' })
        setPacks((p) => [...p, ...neu])
        void neuLaden()
      } catch (e) {
        const f = e instanceof AlbumFehler ? e : new AlbumFehler('netz', 'Das hat nicht geklappt.')
        const endgueltig = ENDGUELTIG.has(f.code)
        if (endgueltig) {
          tokenVergessen()
          setToken(null)
        }
        setCi({ status: 'fehler', text: f.message, nochmal: !endgueltig && f.code !== 'album_kein_profil' })
      }
    },
    [neuLaden],
  )

  useEffect(() => {
    if (token && mein?.profil && ci === null) queueMicrotask(() => void einchecken(token))
  }, [token, mein, ci, einchecken])

  const imHeft = !!mein?.profil
  useEffect(() => {
    if (!imHeft) return
    ladeRangliste()
      .then(setRangliste)
      .catch(() => setRangliste([]))
  }, [imHeft, mein?.checkins])

  const besitz = useMemo(() => besitzMap(mein), [mein])
  const ohne = useMemo(() => new Set(kleben), [kleben])
  const ps = useMemo(() => plaetze(katalog, besitz, ohne), [katalog, besitz, ohne])
  const fs = useMemo(() => fortschritt(ps), [ps])
  const tr = useMemo(() => treue(katalog, mein?.checkins ?? 0), [katalog, mein?.checkins])
  const kartenMap = useMemo(() => karteById(katalog), [katalog])
  const nummern = useMemo(() => new Map(ps.flatMap((p) => [...p.versionen, ...p.glanz].map((v) => [v.id, p.nr] as const))), [ps])

  // v20-K: Starter-Pack direkt nach der Anmeldung (einmalig, serverseitig idempotent)
  const starterGeholt = useRef(false)
  useEffect(() => {
    if (!mein?.profil || !mein.starterOffen || starterGeholt.current) return
    starterGeholt.current = true
    starterHolen()
      .then((r) => {
        if (r.packId) setPacks((p) => [...p, { id: r.packId!, art: 'starter', titel: 'Dein Starter-Pack' }])
        void neuLaden()
      })
      .catch(() => {
        starterGeholt.current = false
      })
  }, [mein, neuLaden])
  // Freundes-Code aus dem Einladungs-Link einlösen
  const freundErledigt = useRef(false)
  useEffect(() => {
    if (!freundCode || !mein?.profil || freundErledigt.current) return
    freundErledigt.current = true
    import('./api').then(({ freundHinzufuegen }) =>
      freundHinzufuegen(freundCode)
        .then((r) => {
          setMeldung({ text: `${r.name} ist jetzt dein Freund im Album — checkt zusammen ein!`, n: Date.now() })
          void neuLaden()
        })
        .catch((e) => setMeldung({ text: e instanceof AlbumFehler ? e.message : 'Der Freundes-Code hat nicht geklappt.', n: Date.now() })),
    )
  }, [freundCode, mein, neuLaden])
  const packNeu = useCallback((p: PackNeu) => setPacks((q) => [...q, { id: p.id, art: p.art, titel: p.titel }]), [])

  // Meilensteine: kurze Meldung beim Überschreiten (10/25/50/75/100 %)
  const letzterStand = useRef<number | null>(null)
  useEffect(() => {
    if (kleben.length || !mein) return
    const v = letzterStand.current
    letzterStand.current = fs.prozent
    if (v == null) return
    const m = MEILENSTEINE.filter((x) => v < x && fs.prozent >= x).pop()
    if (m) {
      vibriere([20, 50, 20, 50, 60])
      setMeldung({ text: m === 100 ? 'Album komplett! Unfassbar.' : `${m} % geschafft — Meilenstein erreicht`, n: Date.now() })
    }
  }, [fs.prozent, kleben.length, mein])

  // Heft auf-/zuschlagen (gemerkt pro Tab)
  const heftAuf = useCallback(
    (sofort = false) => {
      speicher(() => sessionStorage.setItem(OFFEN_KEY, '1'))
      if (sofort || ruhig) {
        setOffen(true)
        return
      }
      setAufschlagen(true)
      window.setTimeout(() => {
        setOffen(true)
        setAufschlagen(false)
        window.scrollTo({ top: 0 })
      }, 650)
    },
    [ruhig],
  )
  const heftZu = () => {
    speicher(() => sessionStorage.removeItem(OFFEN_KEY))
    setOffen(false)
  }

  const packFertig = (_inhalt: PackInhalt | null, neue: string[]) => {
    setPacks((p) => p.slice(1))
    if (neue.length) {
      setFrisch(new Set())
      setKleben((k) => [...k, ...neue])
      heftAuf(true)
    }
    void neuLaden()
  }

  // ── Einkleben: Seite aufblättern → Sticker fliegt an seinen Platz ──
  const timers = useRef<number[]>([])
  useEffect(() => () => timers.current.forEach((t) => window.clearTimeout(t)), [])
  const landen = useCallback((key: string) => {
    setFrisch((s) => new Set(s).add(key))
    setKleben((k) => k.slice(1))
    setFlug(null)
  }, [])
  useEffect(() => {
    if (!kleben.length || flug || !offen || !katalog || !mein || packs.length) return
    const id = kleben[0]
    const platz = ps.find((p) => p.versionen.some((v) => v.id === id))
    const karte = kartenMap.get(id)
    if (!platz || !karte) {
      // Sticker nicht (mehr) im Katalog → überspringen
      queueMicrotask(() => setKleben((k) => k.slice(1)))
      return
    }
    const t1 = window.setTimeout(() => {
      zuPlatzBlaettern(platz.key, !ruhig)
      const t2 = window.setTimeout(
        () => {
          const el = document.querySelector<HTMLElement>(`[data-platz="${CSS.escape(platz.key)}"]`)
          if (!el || ruhig) return landen(platz.key)
          const r0 = el.getBoundingClientRect()
          if (r0.top < 70 || r0.bottom > window.innerHeight - 20) {
            window.scrollBy({ top: r0.top - window.innerHeight / 2 + r0.height / 2, behavior: 'auto' })
          }
          setFlug({ karte, platzKey: platz.key, nr: platz.nr, rect: el.getBoundingClientRect() })
        },
        ruhig ? 0 : BLAETTERN_MS + 80,
      )
      timers.current.push(t2)
    }, 150)
    timers.current.push(t1)
  }, [kleben, flug, offen, katalog, mein, packs.length, ps, kartenMap, ruhig, landen])

  const wartende = (mein?.packs ?? []).filter((p) => !packs.some((q) => q.id === p.id))
  const packsOeffnen = () => setPacks((p) => [...p, ...wartende.map((w) => ({ id: w.id, art: w.art, gegner: w.gegner, titel: w.titel }))])

  // ── Ansichten ──────────────────────────────────────────────
  const laedt = session === undefined || (!!session && !mein && !meinFehler)
  const bereit = !!session && !!mein?.profil
  const zeigeHeft = bereit && offen && !!katalog

  let unterCover: React.ReactNode
  if (laedt) {
    unterCover = <p className="al-start__hint">Album wird geholt …</p>
  } else if (!session) {
    unterCover = (
      <>
        {abschied && (
          <p className="al-ci al-ci--ok" role="status">
            <b>Konto gelöscht.</b> Deine Karten, Gutscheine und dein Profil sind weg. Danke, dass du dabei warst — komm gern wieder!
          </p>
        )}
        <Login katalog={katalog} checkinWartet={!!token} />
      </>
    )
  } else if (!mein) {
    unterCover = (
      <div className="al-panel">
        <p className="al-hinweis al-hinweis--fehler" role="alert">
          {meinFehler}
        </p>
        <button type="button" className="al-btn" onClick={() => void neuLaden()}>
          Noch einmal versuchen
        </button>
      </div>
    )
  } else if (!mein.profil) {
    unterCover = (
      <section className="al-panel">
        {token && <p className="al-hinweis al-hinweis--ok">Gleich gehört dein Check-in dir — nur noch kurz deinen Vornamen.</p>}
        <ProfilForm profil={null} email={mein.email} onGespeichert={() => void neuLaden()} />
      </section>
    )
  } else if (katalogFehlt || !katalog) {
    unterCover = <p className="al-panel al-lead">Das Album wird gerade gedruckt. Sobald die Karten da sind, kannst du hier aufschlagen.</p>
  } else {
    unterCover = (
      <div className="al-start__info">
        <p className="al-start__hint">Tippen zum Aufschlagen</p>
        {wartende.length > 0 && (
          <button type="button" className="hf-tuetchen hf-tuetchen--dunkel" onClick={packsOeffnen}>
            <span className="hf-tuetchen__bild" aria-hidden="true" />
            <span>
              <b>{wartende.length === 1 ? '1 Pack wartet' : `${wartende.length} Packs warten`}</b>
              <small>Jetzt aufreißen</small>
            </span>
          </button>
        )}
      </div>
    )
  }

  return (
    <div className={`al${zeigeHeft ? ' is-offen' : ''}`}>
      <header className="al-top">
        <a className="al-brand" href="/" aria-label="Zur Vereinsseite">
          <img src="/brand/aga-logo.png" alt="" width="28" height="33" />
          <span className="al-brand__wort">SV Agathenburg-Dollern</span>
        </a>
        <span className="al-top__tag">Sammelalbum</span>
        {zeigeHeft && (
          <button type="button" className="al-btn al-btn--sm al-btn--ghost" onClick={heftZu}>
            Zuklappen
          </button>
        )}
        {mein?.profil && (
          <button type="button" className="al-iconbtn" onClick={() => setKonto(true)} aria-label="Konto">
            <UserRound size={20} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
      </header>

      <main>
        {codeUnlesbar && !ci && (
          <div className="al-ci al-ci--fehler" role="alert">
            <span>Der QR-Code konnte nicht gelesen werden — scann ihn am Eingang einfach noch mal.</span>
            <button type="button" className="al-ci__x" onClick={() => setCodeUnlesbar(false)} aria-label="Hinweis schließen">
              ×
            </button>
          </div>
        )}
        {ci && <CheckinBanner ci={ci} onNochmal={() => token && void einchecken(token)} onWeg={() => setCi(null)} />}

        {meldung && (
          <div className="al-ci al-ci--ok al-meldung" role="status" key={meldung.n}>
            <span>{meldung.text}</span>
            <button type="button" className="al-ci__x" onClick={() => setMeldung(null)} aria-label="Hinweis schließen">
              ×
            </button>
          </div>
        )}
        {zeigeHeft && katalog && mein ? (
          <>
            <NaechstesZiel ziel={mein.naechstesZiel} />
            <Heft
              ps={ps}
              katalog={katalog}
              mein={mein}
              fs={fs}
              tr={tr}
              frisch={frisch}
              rangliste={rangliste}
              onPlatz={setDetail}
              onGutschein={setGutschein}
              onKonto={() => setKonto(true)}
              start={
                <div className="hb-startseite">
                  <Gesamtstand fs={fs} name={mein.profil?.anzeigename} />
                  {wartende.length > 0 && (
                    <button type="button" className="hf-tuetchen" onClick={packsOeffnen}>
                      <span className="hf-tuetchen__bild" aria-hidden="true" />
                      <span>
                        <b>{wartende.length === 1 ? '1 Pack wartet' : `${wartende.length} Packs warten`}</b>
                        <small>{wartende.some((w) => w.art === 'heimsieg') ? 'Heimsieg-Bonus! Jetzt aufreißen' : 'Jetzt aufreißen'}</small>
                      </span>
                    </button>
                  )}
                  {mein.advent ? (
                    <Advent tage={mein.advent} onPack={packNeu} onNeu={() => void neuLaden()} />
                  ) : (
                    <div className="sa-block">
                      <h3 className="hf-zwischen">Code einlösen</h3>
                      <CodeEinloesen onPack={packNeu} onNeu={() => void neuLaden()} vorbelegt={storyCode ?? undefined} />
                    </div>
                  )}
                </div>
              }
              sammeln={<SammelSeite katalog={katalog} mein={mein} ps={ps} besitz={besitz} onPack={packNeu} onNeu={() => void neuLaden()} />}
            />
            {wartende.length > 0 && !packs.length && (
              <button type="button" className="al-fach" onClick={packsOeffnen}>
                <span className="hf-tuetchen__bild" aria-hidden="true" />
                <span>
                  <b>
                    <Zaehler wert={wartende.length} /> {wartende.length === 1 ? 'Pack wartet' : 'Packs warten'}
                  </b>
                  <small>Tippen zum Öffnen</small>
                </span>
              </button>
            )}
          </>
        ) : (
          <section className="al-start" aria-label="Das offizielle Sammelalbum">
            <button
              type="button"
              className={`al-cover${aufschlagen ? ' is-auf' : ''}`}
              onClick={() => (bereit && katalog ? heftAuf() : document.getElementById('login')?.scrollIntoView({ behavior: 'smooth' }))}
              aria-label={bereit ? 'Album aufschlagen' : 'Das offizielle Sammelalbum — SV Agathenburg-Dollern'}
              disabled={laedt}
            >
              <span className="al-cover__seiten" aria-hidden="true" />
              <CoverFront saison={katalog?.saison} />
              {bereit && katalog && (
                <span className="al-cover__aufkleber" aria-hidden="true">
                  <b>
                    {fs.belegt}/{fs.gesamt}
                  </b>
                  <small>Karten</small>
                </span>
              )}
            </button>
            <div className="al-start__rechts">{unterCover}</div>
          </section>
        )}
      </main>

      <footer className="al-fuss">
        <span className="al-fuss__links">
          <a href="/">Vereinsseite</a> · <a href="/live">Live-Ticker</a> · <a href="/datenschutz#album">Datenschutz</a> · <a href="/impressum">Impressum</a>
        </span>
        <InstagramZeile className="ig-zeile--fuss" />
      </footer>

      {packs[0] && (
        <PackOpening
          key={packs[0].id}
          packId={packs[0].id}
          art={packs[0].art}
          gegner={packs[0].gegner}
          titel={packs[0].titel}
          partner={packs[0].partner}
          karten={kartenMap}
          nummern={nummern}
          gesamt={fs.gesamt}
          saison={katalog?.saison}
          fanName={mein?.profil?.anzeigename}
          onFertig={packFertig}
        />
      )}
      {flug && <Flug karte={flug.karte} nr={flug.nr} gesamt={fs.gesamt} saison={katalog?.saison} rect={flug.rect} onLanden={() => landen(flug.platzKey)} />}
      {detail && katalog && <KarteDetail platz={detail} besitz={besitz} gesamt={fs.gesamt} saison={katalog.saison} fanName={mein?.profil?.anzeigename} onSchliessen={() => setDetail(null)} />}
      {tauschCode && bereit && katalog && (
        <TauschDialog code={tauschCode} karten={kartenMap} saison={katalog.saison} onSchliessen={() => setTauschCode(null)} onErledigt={() => void neuLaden()} />
      )}
      {gutschein && (
        <GutscheinAnsicht gutschein={gutschein} name={mein?.profil?.anzeigename} onSchliessen={() => setGutschein(null)} onEingeloest={() => void neuLaden()} />
      )}
      {konto && mein && (
        <KontoDialog
          mein={mein}
          onSchliessen={() => setKonto(false)}
          onGespeichert={() => void neuLaden()}
          onAbgemeldet={() => {
            setKonto(false)
            setMein(null)
            setSession(null)
            heftZu()
          }}
          onGeloescht={() => {
            setKonto(false)
            setAbschied(true)
            setMein(null)
            setSession(null)
            heftZu()
            void abmelden()
          }}
        />
      )}
    </div>
  )
}

/** v20-K: Die neue Karte fliegt aus der Bildschirmmitte in ihren Platz (leichte
 *  3D-Drehung, Schatten wird kürzer) und wird angedrückt. */
function Flug({ karte, nr, gesamt, saison, rect, onLanden }: { karte: Karte; nr: number; gesamt: number; saison?: string; rect: DOMRect; onLanden: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return onLanden()
    const dx = window.innerWidth / 2 - (rect.left + rect.width / 2)
    const dy = window.innerHeight / 2 - (rect.top + rect.height / 2)
    const s = Math.min(2.4, (window.innerWidth * 0.5) / rect.width)
    void nr
    const a = el.animate(
      [
        { transform: `perspective(900px) translate(${dx}px, ${dy}px) scale(${s}) rotateY(-14deg) rotateX(8deg)` },
        { transform: `perspective(900px) translate(${dx * 0.12}px, ${dy * 0.12}px) scale(${1 + (s - 1) * 0.22}) rotateY(4deg) rotateX(-3deg)`, offset: 0.72 },
        { transform: 'perspective(900px) translate(0, 0) scale(.97) rotateY(0) rotateX(0)', offset: 0.9 },
        { transform: 'perspective(900px) translate(0, 0) scale(1)' },
      ],
      { duration: 1000, easing: 'cubic-bezier(.25,.8,.25,1)', fill: 'forwards' },
    )
    vibriere(8)
    a.onfinish = () => onLanden()
    return () => a.cancel()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return (
    <div className="hf-flug" ref={ref} style={{ left: rect.left, top: rect.top, width: rect.width }} aria-hidden="true">
      <SvaKarte daten={kartenDaten(karte, nr || undefined, nr ? gesamt : undefined, saison)} stufe="normal" eager />
    </div>
  )
}

function CheckinBanner({ ci, onNochmal, onWeg }: { ci: CheckinStatus; onNochmal: () => void; onWeg: () => void }) {
  if (ci.status === 'laeuft') {
    return (
      <div className="al-ci al-ci--laeuft" role="status">
        <span className="al-ci__puls" aria-hidden="true" /> Check-in läuft …
      </div>
    )
  }
  if (ci.status === 'ok') {
    return (
      <div className="al-ci al-ci--ok" role="status">
        <span>
          <b>Eingecheckt: SVA gegen {ci.gegner}.</b> Das ist dein {ci.checkins}. Heimspiel diese Saison.
        </span>
        <button type="button" className="al-ci__x" onClick={onWeg} aria-label="Hinweis schließen">
          ×
        </button>
      </div>
    )
  }
  return (
    <div className="al-ci al-ci--fehler" role="alert">
      <span>{ci.text}</span>
      {ci.nochmal ? (
        <button type="button" className="al-btn al-btn--sm" onClick={onNochmal}>
          Noch einmal
        </button>
      ) : (
        <button type="button" className="al-ci__x" onClick={onWeg} aria-label="Hinweis schließen">
          ×
        </button>
      )}
    </div>
  )
}

/** v17-D: Cover als gestaltete Vorderseite (statt Foto eines Papierhefts):
 *  dunkle Folie, drei scharfe Freisteller, große Typo, Rot als Band. */
const COVER_SPIELER = ['malte-pils', 'tobias-helck', 'marc-kevin-biedermann']
function CoverFront({ saison }: { saison?: string }) {
  return (
    <span className="al-cover__bild" aria-hidden="true">
      <span className="al-cover__kopf">
        <img src="/brand/aga-logo.png" alt="" width="44" height="52" />
        <span>
          Das offizielle
          <b>Sammelalbum</b>
        </span>
      </span>
      <span className="al-cover__saison">Saison {saison ?? '2026/27'}</span>
      <span className="al-cover__team">
        {/* v19-S (Audit C): 640er-Freisteller statt HD (960×1440) — die Köpfe
            werden klein gezeigt; halbiert den LCP-/Transfer-Aufwand mobil. */}
        {COVER_SPIELER.map((slug, i) => (
          <img key={slug} src={`/players/cutout/${slug}.webp`} alt="" draggable={false} fetchPriority={i === 0 ? 'high' : undefined} decoding="async" />
        ))}
      </span>
      <span className="al-cover__band">SV Agathenburg-Dollern · Kreisliga Stade</span>
    </span>
  )
}
