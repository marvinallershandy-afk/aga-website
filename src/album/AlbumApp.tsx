import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Book, CircleHelp } from 'lucide-react'
import { Einfuehrung, KartenQuellen } from './Einfuehrung'
import { einfuehrungGesehen } from './einfuehrung-logik'
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
  freundHinzufuegen,
  codeEinloesen,
  ALBUM_VORFUEHRUNG,
} from './api'
import { Gesamtstand, Heft } from './Heft'
import { BLAETTERN_MS, zuPlatzBlaettern, zuSeiteBlaettern } from './blaettern'
import { KarteBuehne, KarteDetail } from './KarteDetail'
import type { KartenDaten } from '../karten/typen'
import { GEHEIM_EREIGNIS, fundErledigt, fundMelden, gesteRichtung, istGeheimToken, offeneFunde, type GeheimFund } from './geheim/ei'
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
import { standAus, standSchreiben, standVergessen } from './fanStand'
import { useKippen } from './medaille-logik'
import './tiefe.css'
import './v22.css'
import './vorfuehrung/vorfuehrung.css'

// v22-A: Vorführung (/album?vorfuehrung=1) — Steuerleiste + Kartenlabor nur dann laden
const Steuerleiste = lazy(() => import('./vorfuehrung/Steuerleiste'))
const VorfuehrLabor = lazy(() => import('./vorfuehrung/Labor'))
const VF_PACK_EREIGNIS = 'album-vf-pack'

/** v22-A: ?g=<Token> (aus dem Easter-Egg-Hinweis der Startseite/des Rundgangs) übernehmen. */
function geheimAusUrl(): string | null {
  try {
    const url = new URL(window.location.href)
    const g = url.searchParams.get('g')
    if (!url.searchParams.has('g')) return null
    url.searchParams.delete('g')
    window.history.replaceState(null, '', url.pathname + (url.search || '') + url.hash)
    return g && istGeheimToken(g) ? g.trim().toUpperCase() : null
  } catch {
    return null
  }
}
const heuteMMTT = () => {
  const [d, m] = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', timeZone: 'Europe/Berlin' }).split('.')
  return `${m}-${d}`
}

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
  const coverKippen = useKippen<HTMLElement>()
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
  const [buehne, setBuehne] = useState<{ daten: KartenDaten; titel: string; text: string } | null>(null)
  const [labor, setLabor] = useState(false)
  const [einf, setEinf] = useState(false)
  const [geheimUrl] = useState<string | null>(() => geheimAusUrl())

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

  // v21-A: Tab-Rückkehr (z. B. nach dem Tippen in /tippen) → Stand frisch holen.
  // Die Sitzung selbst erneuert supabase-js (autoRefreshToken + visibilitychange).
  const zuletzt = useRef(0)
  useEffect(() => {
    if (!uid) return
    zuletzt.current = Date.now()
    const f = () => {
      if (document.visibilityState !== 'visible' || Date.now() - zuletzt.current < 20_000) return
      zuletzt.current = Date.now()
      void neuLaden()
    }
    document.addEventListener('visibilitychange', f)
    window.addEventListener('pageshow', f)
    return () => {
      document.removeEventListener('visibilitychange', f)
      window.removeEventListener('pageshow', f)
    }
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
  const kartenMap = useMemo(() => karteById(katalog, mein), [katalog, mein])
  const nummern = useMemo(() => new Map(ps.flatMap((p) => [...p.versionen, ...p.glanz].map((v) => [v.id, p.nr] as const))), [ps])

  // v21-A: Stand für die Startseiten-Kachel merken („3/42 · 1 Tütchen wartet“)
  useEffect(() => {
    if (uid && katalog && mein?.profil && !ALBUM_VORFUEHRUNG) standSchreiben(standAus(uid, katalog, mein))
  }, [uid, katalog, mein])

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
    freundHinzufuegen(freundCode)
      .then((r) => {
        setMeldung({ text: `${r.name} ist jetzt dein Freund im Album — checkt zusammen ein!`, n: Date.now() })
        void neuLaden()
      })
      .catch((e) => setMeldung({ text: e instanceof AlbumFehler ? e.message : 'Der Freundes-Code hat nicht geklappt.', n: Date.now() }))
  }, [freundCode, mein, neuLaden])
  const packNeu = useCallback((p: PackNeu) => setPacks((q) => [...q, { id: p.id, art: p.art, titel: p.titel }]), [])

  // ── v22-A: Geheimkarten (Easter Eggs) einlösen ─────────────
  // Quellen: ?g= aus dem Hinweis, gemerkte Funde (localStorage), Funde hier im Album
  // (Geste, Kerzen). Der Server entscheidet — hier wird nur das Token geschickt.
  const geheimLaeuft = useRef(new Set<string>())
  const geheimEinloesen = useCallback(
    async (token: string) => {
      if (geheimLaeuft.current.has(token)) return
      geheimLaeuft.current.add(token)
      try {
        const r = await codeEinloesen(token)
        if (r.ok) {
          fundErledigt(token)
          setPacks((q) => [...q, { id: r.packId, art: 'geheim', titel: 'Geheimkarte entdeckt' }])
          void neuLaden()
        } else {
          if (r.grund !== 'gesperrt' && r.grund !== 'kein_profil') fundErledigt(token)
          const text =
            r.grund === 'schon'
              ? 'Diese Geheimkarte hast du schon — schau auf deine Geheime Seite.'
              : r.grund === 'nicht_heute'
                ? 'Psst … diese Karte gibt es nur an einem ganz bestimmten Tag.'
                : r.grund === 'gesperrt'
                  ? 'Zu viele Versuche. Bitte in einer Stunde noch einmal.'
                  : 'Hier war nichts versteckt. Oder doch woanders?'
          setMeldung({ text, n: Date.now() })
        }
      } catch {
        geheimLaeuft.current.delete(token)
      }
    },
    [neuLaden],
  )
  useEffect(() => {
    if (!mein?.profil) return
    const offen = [...new Set([...(geheimUrl ? [geheimUrl] : []), ...offeneFunde()])]
    offen.forEach((t) => void geheimEinloesen(t))
  }, [mein?.profil, geheimUrl, geheimEinloesen])
  useEffect(() => {
    const f = (e: Event) => {
      const fund = (e as CustomEvent<GeheimFund>).detail
      if (mein?.profil) void geheimEinloesen(fund.token)
      else setMeldung({ text: `${fund.text} Melde dich an, um deine Geheimkarte abzuholen.`, n: Date.now() })
    }
    window.addEventListener(GEHEIM_EREIGNIS, f)
    return () => window.removeEventListener(GEHEIM_EREIGNIS, f)
  }, [mein?.profil, geheimEinloesen])
  // (d) Wisch-Geste im Album (Pfeiltasten oder Wischen) — geprüft wird nur ein Hash
  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest?.('input, textarea')) return
      const r = ({ ArrowUp: 'O', ArrowDown: 'U', ArrowLeft: 'L', ArrowRight: 'R' } as const)[e.key as 'ArrowUp']
      if (r) gesteRichtung(r)
    }
    let start: { x: number; y: number } | null = null
    const ab = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') start = { x: e.clientX, y: e.clientY }
    }
    const auf = (e: PointerEvent) => {
      if (!start) return
      const dx = e.clientX - start.x
      const dy = e.clientY - start.y
      start = null
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return
      gesteRichtung(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'R' : 'L') : dy > 0 ? 'U' : 'O')
    }
    window.addEventListener('keydown', taste)
    window.addEventListener('pointerdown', ab, { passive: true })
    window.addEventListener('pointerup', auf, { passive: true })
    return () => {
      window.removeEventListener('keydown', taste)
      window.removeEventListener('pointerdown', ab)
      window.removeEventListener('pointerup', auf)
    }
  }, [])
  // Vorführung: Test-Packs aus der Steuerleiste
  useEffect(() => {
    if (!ALBUM_VORFUEHRUNG) return
    const f = (e: Event) => {
      const p = (e as CustomEvent<PackNeu>).detail
      setPacks((q) => [...q, { id: p.id, art: p.art, titel: p.titel }])
    }
    window.addEventListener(VF_PACK_EREIGNIS, f)
    return () => window.removeEventListener(VF_PACK_EREIGNIS, f)
  }, [])
  // v22-A: Einführung einmal nach dem ersten Aufschlagen (nicht während Pack/Einkleben)
  const heftOffen = bereitHeft(offen, mein, katalog)
  useEffect(() => {
    if (!heftOffen || packs.length || kleben.length || einfuehrungGesehen()) return
    const t = window.setTimeout(() => setEinf(true), 900)
    return () => window.clearTimeout(t)
  }, [heftOffen, packs.length, kleben.length])
  const geburtstag = !!katalog?.regeln.vereinsGeburtstag && katalog.regeln.vereinsGeburtstag === heuteMMTT()

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

  const packFertig = (inhalt: PackInhalt | null, neue: string[]) => {
    setPacks((p) => p.slice(1))
    const geheimNeu = inhalt?.karten.some((k) => k.geheim) ?? false
    const shinyNeu = inhalt?.karten.filter((k) => k.shiny).length ?? 0
    const kleben2 = neue.filter((id) => !inhalt?.karten.find((k) => k.karteId === id)?.geheim)
    if (kleben2.length) {
      setFrisch(new Set())
      setKleben((k) => [...k, ...kleben2])
      heftAuf(true)
    }
    // v22: Geheimkarte → Geheime Seite aufschlagen; Shiny → Hinweis auf die Vitrine
    if (geheimNeu || shinyNeu) {
      heftAuf(true)
      window.setTimeout(() => zuSeiteBlaettern(geheimNeu ? 'geheim' : 'shiny', !ruhig), kleben2.length ? (BLAETTERN_MS + 1300) * kleben2.length + 300 : 400)
      if (shinyNeu) setMeldung({ text: 'Dein Shiny liegt jetzt in der Shiny-Vitrine (zählt nicht fürs Album — ist einfach nur schön).', n: Date.now() })
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

  // v21-A: Kapitel-Zeile auf der Start-Seite → zu dieser Seite blättern
  const kapitelAufschlagen = useCallback(
    (g: string) => {
      const p = ps.find((x) => x.gruppe === g)
      if (p) zuPlatzBlaettern(p.key, !ruhig)
    },
    [ps, ruhig],
  )
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
        {/* v25 Befund 16: Hinweis selbst tippbar — gleicher onClick wie das Cover */}
        <button type="button" className="al-start__hint al-start__hint--knopf" onClick={() => (bereit && katalog ? heftAuf() : undefined)}>
          Tippen zum Aufschlagen
        </button>
        {/* v20-T: gemeinsames Konto — jeder Tipp in der Tipp-Liga bringt eine Karte */}
        <a className="al-tipp" href="/tippen">
          <b>Tipp-Liga</b>
          <span>Jeder Tipp = 1 Karte fürs Heft · gleiches Konto</span>
        </a>
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
    <div className={`al${zeigeHeft ? ' is-offen' : ''}${ALBUM_VORFUEHRUNG ? ' al--vorfuehrung' : ''}`}>
      {ALBUM_VORFUEHRUNG && (
        <p className="al-vf-band" role="note">
          Vorführung <span>· Demo-Fan, nichts wird gespeichert</span>
        </p>
      )}
      <header className="al-top">
        <a className="al-brand" href="/" aria-label="Zur Vereinsseite">
          <img src="/brand/aga-logo.png" alt="" width="28" height="33" />
          <span className="al-brand__wort">SV Agathenburg-Dollern</span>
        </a>
        {/* v21-A: Umschalter Album | Tipp-Liga (gleiches Konto); v22: in der Vorführung zur Tipp-Liga-Vorführung */}
        <nav className="al-wechsel" aria-label="Bereich">
          <a className="al-wechsel__b is-aktiv" href={ALBUM_VORFUEHRUNG ? '/album?vorfuehrung=1' : '/album'} aria-current="page" onClick={(e) => { e.preventDefault(); if (zeigeHeft) window.scrollTo({ top: 0, behavior: 'smooth' }) }}>
            Album
          </a>
          <a className="al-wechsel__b" href={ALBUM_VORFUEHRUNG ? '/tippen?vorfuehrung=1' : '/tippen'}>
            Tipp-Liga
          </a>
        </nav>
        <span className="al-top__luft" />
        {bereit && wartende.length > 0 && !packs.length && (
          <button type="button" className="al-tuete-badge" onClick={packsOeffnen} aria-label={wartende.length === 1 ? '1 Tütchen wartet — jetzt öffnen' : `${wartende.length} Tütchen warten — jetzt öffnen`}>
            <span className="al-tuete-badge__bild" aria-hidden="true" />
            <b>{wartende.length}</b>
            <span className="al-tuete-badge__wort">{wartende.length === 1 ? 'Tütchen wartet' : 'Tütchen warten'}</span>
            <i className="al-tuete-badge__puls" aria-hidden="true" />
          </button>
        )}
        {bereit && (
          <button type="button" className="al-iconbtn al-hilfe" onClick={() => setEinf(true)} aria-label="So funktioniert das Album" title="So funktioniert’s">
            <CircleHelp size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
        {zeigeHeft && (
          <button type="button" className="al-iconbtn al-zu" onClick={heftZu} aria-label="Album zuklappen" title="Album zuklappen">
            <Book size={18} strokeWidth={1.5} aria-hidden="true" />
          </button>
        )}
        {mein?.profil && (
          <button type="button" className="al-ich" onClick={() => setKonto(true)} aria-label={`Konto — angemeldet als ${mein.profil.vorname}`}>
            <span className="al-ich__kreis" aria-hidden="true">
              {mein.profil.vorname.slice(0, 1).toUpperCase()}
            </span>
            <span className="al-ich__name">{mein.profil.vorname}</span>
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
              onKarte={(daten, info) => setBuehne({ daten, ...info })}
              start={
                <div className="hb-startseite">
                  {geburtstag && (
                    <button
                      type="button"
                      className="al-kerzen"
                      aria-label="Drei kleine Kerzen"
                      onClick={() => void fundMelden('geburtstag|kerzen', 'Alles Gute, SVA! Die Kerzen brennen.')}
                    >
                      <i />
                      <i />
                      <i />
                    </button>
                  )}
                  <Gesamtstand fs={fs} name={mein.profil?.anzeigename} onKapitel={kapitelAufschlagen} />
                  <KartenQuellen katalog={katalog} onMehr={() => setEinf(true)} />
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
          <section className="al-start" aria-label="Das offizielle Sammelalbum" ref={coverKippen}>
            <button
              type="button"
              data-kipp=""
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
          <a href="/">Vereinsseite</a> · <a href="/live">Live-Ticker</a> · <a href="/tippen">Tipp-Liga</a> · <a href="/datenschutz#album">Datenschutz</a> · <a href="/impressum">Impressum</a>
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
          shinyChance={katalog?.regeln.shinyChance}
          onFertig={packFertig}
        />
      )}
      {einf && katalog && <Einfuehrung katalog={katalog} onZu={() => setEinf(false)} />}
      {buehne && <KarteBuehne daten={buehne.daten} titel={buehne.titel} text={buehne.text} onSchliessen={() => setBuehne(null)} />}
      {ALBUM_VORFUEHRUNG && (
        <Suspense fallback={null}>
          <Steuerleiste versteckt={packs.length > 0 || labor} onNeu={() => void neuLaden()} onLabor={() => setLabor(true)} />
          {labor && katalog && (
            <VorfuehrLabor katalog={katalog} onSchliessen={() => setLabor(false)} />
          )}
        </Suspense>
      )}
      {flug && <Flug karte={flug.karte} nr={flug.nr} gesamt={fs.gesamt} saison={katalog?.saison} rect={flug.rect} onLanden={() => landen(flug.platzKey)} />}
      {detail && katalog && (
        <KarteDetail
          platz={detail}
          besitz={besitz}
          gesamt={fs.gesamt}
          saison={katalog.saison}
          fanName={mein?.profil?.anzeigename}
          shiny={(mein?.shiny ?? []).find((f) => [...detail.versionen, ...detail.glanz].some((k) => k.id === f.karteId))}
          onSchliessen={() => setDetail(null)}
        />
      )}
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
            standVergessen()
            setKonto(false)
            setMein(null)
            setSession(null)
            heftZu()
          }}
          onGeloescht={() => {
            standVergessen()
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

function bereitHeft(offen: boolean, mein: Mein | null, katalog: Katalog | null): boolean {
  return offen && !!mein?.profil && !!katalog
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
